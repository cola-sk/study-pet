#include "shop_network.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "cJSON.h"
#include "nvs.h"
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>
#include <limits.h>

typedef struct { uint32_t format; char item_id[37], request_id[37], version[40]; unsigned price; } legacy_purchase_t;
typedef struct { uint32_t format; char item_id[37], request_id[37], version[40]; unsigned price; char binding_version[37]; } pending_purchase_t;
typedef struct { char data[4096]; size_t length; } response_t;
static QueueHandle_t catalog_updates, purchase_requests, purchase_results, refresh_requests;
static atomic_bool unsettled;
static pending_purchase_t pending;
static bool has_pending, storage_ready;
static int64_t next_catalog, next_purchase;
static unsigned retry_seconds = 10;
static bool published_unavailable;
static const char *TAG = "pet_shop";
static unsigned last_catalog_count = UINT_MAX;
static esp_err_t http_event(esp_http_client_event_t *event) {
    response_t *response = event->user_data;
    if (event->event_id == HTTP_EVENT_ON_DATA && event->data_len > 0) {
        size_t n = (size_t)event->data_len;
        if (n > sizeof(response->data) - 1 - response->length) return ESP_FAIL;
        memcpy(response->data + response->length, event->data, n);
        response->length += n; response->data[response->length] = 0;
    }
    return ESP_OK;
}
static int request(const char *token, const char *path, const char *body, response_t *response) {
    char url[128], authorization[72];
    snprintf(url, sizeof(url), "https://keep.1203.fyi/api/v1/device/shop%s", path);
    snprintf(authorization, sizeof(authorization), "Bearer %s", token);
    esp_http_client_config_t cfg = { .url = url, .crt_bundle_attach = esp_crt_bundle_attach, .timeout_ms = 10000, .event_handler = http_event, .user_data = response };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (!client) return 0;
    esp_http_client_set_header(client, "Authorization", authorization);
    if (body) {
        esp_http_client_set_method(client, HTTP_METHOD_POST);
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, strlen(body));
    }
    esp_err_t error = esp_http_client_perform(client);
    int status = error == ESP_OK ? esp_http_client_get_status_code(client) : 0;
    esp_http_client_cleanup(client); return status;
}
static bool persist(bool clear) {
    nvs_handle_t handle;
    if (nvs_open("pet_shop", NVS_READWRITE, &handle) != ESP_OK) return false;
    esp_err_t error = clear ? nvs_erase_key(handle, "pending") : nvs_set_blob(handle, "pending", &pending, sizeof(pending));
    if (clear && error == ESP_ERR_NVS_NOT_FOUND) error = ESP_OK;
    if (error == ESP_OK) error = nvs_commit(handle);
    nvs_close(handle); return error == ESP_OK;
}
static bool parse_action(const cJSON *value, shop_action_t *action) {
    if (!cJSON_IsString(value)) return false;
    const char *names[] = { "eat", "drink", "pet", "happy", "play", "bath", "treat", "dress" };
    for (unsigned i = 0; i < sizeof(names)/sizeof(names[0]); i++) if (strcmp(value->valuestring, names[i]) == 0) { *action = (shop_action_t)i; return true; }
    return false;
}
static bool copy_string(const cJSON *json, const char *key, char *out, size_t size) {
    const cJSON *value = cJSON_GetObjectItemCaseSensitive(json, key);
    if (!cJSON_IsString(value) || !value->valuestring[0] || strlen(value->valuestring) >= size) return false;
    strlcpy(out, value->valuestring, size); return true;
}
static void sync_catalog(const char *token) {
    response_t response = {0}; shop_catalog_t catalog = {0};
    int status = request(token, "", NULL, &response);
    cJSON *json = status == 200 ? cJSON_Parse(response.data) : NULL;
    const cJSON *items = cJSON_GetObjectItemCaseSensitive(json, "items");
    char binding[37] = {0};
    bool valid = copy_string(json, "bindingVersion", binding, sizeof(binding)) && strlen(binding) == 36 && cJSON_IsArray(items) && cJSON_GetArraySize(items) <= SHOP_LIMIT;
    if (valid) {
        const cJSON *entry;
        cJSON_ArrayForEach(entry, items) {
            shop_item_t *item = &catalog.items[catalog.count];
            const cJSON *price = cJSON_GetObjectItemCaseSensitive(entry, "price");
            if (!copy_string(entry,"id",item->id,sizeof(item->id)) || !copy_string(entry,"name",item->name,sizeof(item->name)) ||
                !copy_string(entry,"updated_at",item->version,sizeof(item->version)) || !parse_action(cJSON_GetObjectItemCaseSensitive(entry,"action"), &item->action) ||
                !cJSON_IsNumber(price) || price->valuedouble < 1 || price->valuedouble > 10000 || price->valuedouble != price->valueint) { valid = false; break; }
            strlcpy(item->binding_version, binding, sizeof(item->binding_version));
            item->price = (unsigned)price->valueint; catalog.count++;
        }
    }
    cJSON_Delete(json);
    catalog.available = valid;
    if (valid && (published_unavailable || last_catalog_count != catalog.count)) ESP_LOGI(TAG, "Shop synchronized: %u items", catalog.count);
    if (valid) last_catalog_count = catalog.count;
    if (!valid) ESP_LOGW(TAG, "Shop sync failed: HTTP %d, response bytes %u", status, (unsigned)response.length);
    if (valid || !published_unavailable) xQueueOverwrite(catalog_updates, &catalog);
    published_unavailable = !valid;
    next_catalog = esp_timer_get_time() + (valid ? 10000000LL : 5000000LL);
}
static void publish_result(purchase_result_t result) { xQueueOverwrite(purchase_results, &result); }
static void purchase(const char *token) {
    char body[400], binding[40]; response_t response = {0};
    if (pending.binding_version[0]) snprintf(binding, sizeof(binding), "\"%s\"", pending.binding_version);
    else strlcpy(binding, "null", sizeof(binding));
    snprintf(body,sizeof(body),"{\"itemId\":\"%s\",\"requestId\":\"%s\",\"expectedPrice\":%u,\"expectedVersion\":\"%s\",\"expectedBindingVersion\":%s}",pending.item_id,pending.request_id,pending.price,pending.version,binding);
    int status = request(token,"/purchase",body,&response);
    cJSON *json = cJSON_Parse(response.data);
    purchase_result_t result = { .state = PURCHASE_UNKNOWN };
    bool definitive = false;
    if (status == 200) {
        const cJSON *credits = cJSON_GetObjectItemCaseSensitive(json,"credits");
        if (cJSON_IsNumber(credits) && credits->valuedouble >= 0 && credits->valuedouble <= INT_MAX && credits->valuedouble == credits->valueint && parse_action(cJSON_GetObjectItemCaseSensitive(json,"action"), &result.action)) {
            result.state = PURCHASE_OK; result.credits = (unsigned)credits->valueint; definitive = true;
        }
    } else if (status == 404 || status == 409) {
        const cJSON *code = cJSON_GetObjectItemCaseSensitive(json,"code");
        if (cJSON_IsString(code)) {
            if (!strcmp(code->valuestring,"insufficient_credits")) { result.state=PURCHASE_INSUFFICIENT; definitive=true; }
            else if (!strcmp(code->valuestring,"item_changed")) { result.state=PURCHASE_CHANGED; definitive=true; }
            else if (!strcmp(code->valuestring,"item_unavailable")) { result.state=PURCHASE_UNAVAILABLE; definitive=true; }
            else if (!strcmp(code->valuestring,"request_conflict")) { result.state=PURCHASE_CONFLICT; }
        }
    } else if (status == 401 || status == 403) result.state = PURCHASE_DENIED;
    cJSON_Delete(json);
    if (definitive && persist(true)) {
        has_pending=false; atomic_store(&unsettled,false); retry_seconds=10;
        next_catalog=0; publish_result(result); return;
    }
    if (definitive) result.state=PURCHASE_UNKNOWN;
    publish_result(result);
    next_purchase=esp_timer_get_time()+(int64_t)retry_seconds*1000000LL;
    retry_seconds=retry_seconds<30 ? retry_seconds*2 : 60;
}
void shop_network_init(void) {
    catalog_updates=xQueueCreate(1,sizeof(shop_catalog_t)); purchase_requests=xQueueCreate(1,sizeof(pending_purchase_t));
    purchase_results=xQueueCreate(1,sizeof(purchase_result_t)); refresh_requests=xQueueCreate(1,sizeof(uint8_t));
    nvs_handle_t handle;
    if (nvs_open("pet_shop",NVS_READWRITE,&handle)!=ESP_OK) { atomic_store(&unsettled,true); return; }
    memset(&pending, 0, sizeof(pending));
    size_t size=sizeof(pending); esp_err_t error=nvs_get_blob(handle,"pending",&pending,&size); nvs_close(handle);
    bool legacy=error==ESP_OK && size==sizeof(legacy_purchase_t) && pending.format==1;
    // Prefix layout is preserved. Legacy requests may only confirm an already
    // committed purchase on the server; an empty binding can never debit.
    if (legacy) { pending.format=2; pending.binding_version[0]=0; }
    storage_ready=error==ESP_ERR_NVS_NOT_FOUND || (error==ESP_OK && (size==sizeof(pending) || legacy) && pending.format==2 && pending.item_id[36]==0 && pending.request_id[36]==0 && pending.version[39]==0 && pending.binding_version[36]==0);
    has_pending=error==ESP_OK && storage_ready;
    atomic_store(&unsettled,has_pending || !storage_ready);
}
bool shop_request_purchase(const shop_item_t *item) {
    if (!item || strlen(item->binding_version)!=36 || !purchase_requests || !storage_ready || atomic_exchange(&unsettled,true)) return false;
    pending_purchase_t value={.format=2,.price=item->price};
    strlcpy(value.binding_version,item->binding_version,sizeof(value.binding_version));
    strlcpy(value.item_id,item->id,sizeof(value.item_id)); strlcpy(value.version,item->version,sizeof(value.version));
    uint8_t bytes[16]; esp_fill_random(bytes,sizeof(bytes)); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
    snprintf(value.request_id,sizeof(value.request_id),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",bytes[0],bytes[1],bytes[2],bytes[3],bytes[4],bytes[5],bytes[6],bytes[7],bytes[8],bytes[9],bytes[10],bytes[11],bytes[12],bytes[13],bytes[14],bytes[15]);
    if (xQueueSend(purchase_requests,&value,0)==pdTRUE) return true;
    atomic_store(&unsettled,false); return false;
}
void shop_network_tick(const char *token,bool online,bool clock_ready) {
    if (!catalog_updates || !purchase_requests || !purchase_results || !refresh_requests) return;
    if (!has_pending && xQueueReceive(purchase_requests,&pending,0)==pdTRUE) {
        if (!persist(false)) { atomic_store(&unsettled,false); publish_result((purchase_result_t){.state=PURCHASE_SAVE_FAILED}); }
        else { has_pending=true; next_purchase=0; }
    }
    uint8_t refresh;
    if (xQueueReceive(refresh_requests,&refresh,0)==pdTRUE) { next_catalog=0; next_purchase=0; }
    if (!online || !clock_ready || strlen(token)!=64) {
        if (strlen(token)!=64 && !published_unavailable) {
            shop_catalog_t empty={0}; xQueueOverwrite(catalog_updates,&empty); published_unavailable=true; next_catalog=0;
        }
        if (has_pending && esp_timer_get_time()>=next_purchase) { publish_result((purchase_result_t){.state=PURCHASE_UNKNOWN}); next_purchase=esp_timer_get_time()+10000000LL; }
        return;
    }
    int64_t now=esp_timer_get_time();
    if (has_pending && now>=next_purchase) purchase(token);
    if (now>=next_catalog) sync_catalog(token);
}
bool shop_purchase_pending(void) { return atomic_load(&unsettled); }
bool shop_take_catalog(shop_catalog_t *catalog) { return catalog_updates && xQueueReceive(catalog_updates,catalog,0)==pdTRUE; }
bool shop_take_result(purchase_result_t *result) { return purchase_results && xQueueReceive(purchase_results,result,0)==pdTRUE; }
void shop_refresh(void) { if (refresh_requests) { uint8_t value=1; xQueueOverwrite(refresh_requests,&value); } }
