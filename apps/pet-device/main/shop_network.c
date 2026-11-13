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

#define SHOP_QUEUE_FORMAT 3u
typedef struct { uint32_t format; char item_id[37], request_id[37], version[40]; unsigned price; } legacy_purchase_t;
typedef struct { uint32_t format; char item_id[37], request_id[37], version[40]; unsigned price; char binding_version[37]; } pending_purchase_t;
typedef struct { uint32_t format; uint32_t count; pending_purchase_t items[SHOP_PENDING_MAX]; } pending_queue_t;
typedef struct { char data[4096]; size_t length; } response_t;

static QueueHandle_t catalog_updates, purchase_requests, purchase_results, refresh_requests, clear_requests;
static pending_queue_t queue;
static atomic_uint pending_spend;
static atomic_bool storage_ready_flag;
static bool storage_ready;
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
static bool persist_queue(void) {
    nvs_handle_t handle;
    if (nvs_open("pet_shop", NVS_READWRITE, &handle) != ESP_OK) return false;
    esp_err_t error;
    if (queue.count == 0) {
        error = nvs_erase_key(handle, "queue");
        if (error == ESP_ERR_NVS_NOT_FOUND) error = ESP_OK;
        esp_err_t legacy_err = nvs_erase_key(handle, "pending");
        if (error == ESP_OK && legacy_err != ESP_OK && legacy_err != ESP_ERR_NVS_NOT_FOUND) error = legacy_err;
    } else {
        queue.format = SHOP_QUEUE_FORMAT;
        error = nvs_set_blob(handle, "queue", &queue, sizeof(queue));
    }
    if (error == ESP_OK) error = nvs_commit(handle);
    nvs_close(handle); return error == ESP_OK;
}
static bool valid_item(const pending_purchase_t *p) {
    return p->format == 2 && p->item_id[36] == 0 && p->request_id[36] == 0 &&
           p->version[39] == 0 && p->binding_version[36] == 0;
}
static void sub_pending_spend(unsigned amount) {
    unsigned cur = atomic_load(&pending_spend);
    while (!atomic_compare_exchange_weak(&pending_spend, &cur, cur > amount ? cur - amount : 0)) {}
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
static void purchase_head(const char *token) {
    if (queue.count == 0) return;
    pending_purchase_t head = queue.items[0];
    char body[400], binding[40]; response_t response = {0};
    if (head.binding_version[0]) snprintf(binding, sizeof(binding), "\"%s\"", head.binding_version);
    else strlcpy(binding, "null", sizeof(binding));
    snprintf(body,sizeof(body),"{\"itemId\":\"%s\",\"requestId\":\"%s\",\"expectedPrice\":%u,\"expectedVersion\":\"%s\",\"expectedBindingVersion\":%s}",head.item_id,head.request_id,head.price,head.version,binding);
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
    if (definitive) {
        pending_queue_t backup = queue;
        for (uint32_t i = 1; i < queue.count; i++) queue.items[i - 1] = queue.items[i];
        queue.count--;
        memset(&queue.items[queue.count], 0, sizeof(pending_purchase_t));
        if (persist_queue()) {
            sub_pending_spend(head.price);
            retry_seconds = 10;
            next_catalog = 0;
            next_purchase = queue.count > 0 ? 0 : esp_timer_get_time();
            publish_result(result);
            return;
        }
        queue = backup;
        result.state = PURCHASE_UNKNOWN;
    }
    if (result.state == PURCHASE_DENIED || result.state == PURCHASE_CONFLICT) publish_result(result);
    next_purchase = esp_timer_get_time() + (int64_t)retry_seconds * 1000000LL;
    retry_seconds = retry_seconds < 30 ? retry_seconds * 2 : 60;
}
void shop_network_init(void) {
    catalog_updates = xQueueCreate(1, sizeof(shop_catalog_t));
    purchase_requests = xQueueCreate(SHOP_PENDING_MAX, sizeof(pending_purchase_t));
    purchase_results = xQueueCreate(1, sizeof(purchase_result_t));
    refresh_requests = xQueueCreate(1, sizeof(uint8_t));
    clear_requests = xQueueCreate(1, sizeof(uint8_t));
    memset(&queue, 0, sizeof(queue));
    queue.format = SHOP_QUEUE_FORMAT;
    atomic_store(&pending_spend, 0);
    storage_ready = false;
    atomic_store(&storage_ready_flag, false);
    nvs_handle_t handle;
    if (nvs_open("pet_shop", NVS_READWRITE, &handle) != ESP_OK) return;
    pending_queue_t loaded = {0};
    size_t size = sizeof(loaded);
    esp_err_t error = nvs_get_blob(handle, "queue", &loaded, &size);
    if (error == ESP_ERR_NVS_NOT_FOUND) {
        pending_purchase_t legacy_v2 = {0};
        size = sizeof(legacy_v2);
        error = nvs_get_blob(handle, "pending", &legacy_v2, &size);
        nvs_close(handle);
        bool legacy_v1 = error == ESP_OK && size == sizeof(legacy_purchase_t) && legacy_v2.format == 1;
        if (legacy_v1) { legacy_v2.format = 2; legacy_v2.binding_version[0] = 0; }
        if (error == ESP_ERR_NVS_NOT_FOUND) {
            storage_ready = true;
        } else if (error == ESP_OK && (size == sizeof(legacy_v2) || legacy_v1) && valid_item(&legacy_v2)) {
            queue.count = 1;
            queue.items[0] = legacy_v2;
            storage_ready = persist_queue();
        }
    } else {
        nvs_close(handle);
        if (error == ESP_OK && size == sizeof(loaded) && loaded.format == SHOP_QUEUE_FORMAT && loaded.count <= SHOP_PENDING_MAX) {
            bool ok = true;
            for (uint32_t i = 0; i < loaded.count; i++) if (!valid_item(&loaded.items[i])) { ok = false; break; }
            if (ok) { queue = loaded; storage_ready = true; }
        } else if (error == ESP_OK && size == sizeof(pending_purchase_t)) {
            pending_purchase_t single = {0};
            memcpy(&single, &loaded, sizeof(single));
            if (valid_item(&single)) { queue.count = 1; queue.items[0] = single; storage_ready = persist_queue(); }
        } else if (error == ESP_OK && size == sizeof(legacy_purchase_t)) {
            pending_purchase_t single = {0};
            memcpy(&single, &loaded, sizeof(legacy_purchase_t));
            if (single.format == 1) { single.format = 2; single.binding_version[0] = 0; }
            if (valid_item(&single)) { queue.count = 1; queue.items[0] = single; storage_ready = persist_queue(); }
        }
    }
    unsigned total = 0;
    for (uint32_t i = 0; i < queue.count; i++) total += queue.items[i].price;
    atomic_store(&pending_spend, total);
    atomic_store(&storage_ready_flag, storage_ready);
}
bool shop_request_purchase(const shop_item_t *item) {
    if (!item || strlen(item->binding_version) != 36 || !purchase_requests || !atomic_load(&storage_ready_flag)) return false;
    pending_purchase_t value = { .format = 2, .price = item->price };
    strlcpy(value.binding_version, item->binding_version, sizeof(value.binding_version));
    strlcpy(value.item_id, item->id, sizeof(value.item_id));
    strlcpy(value.version, item->version, sizeof(value.version));
    uint8_t bytes[16]; esp_fill_random(bytes, sizeof(bytes));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    snprintf(value.request_id, sizeof(value.request_id), "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
             bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
             bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
    atomic_fetch_add(&pending_spend, item->price);
    if (xQueueSend(purchase_requests, &value, 0) == pdTRUE) return true;
    sub_pending_spend(item->price);
    return false;
}
void shop_network_tick(const char *token, bool online, bool clock_ready) {
    if (!catalog_updates || !purchase_requests || !purchase_results || !refresh_requests || !clear_requests) return;
    uint8_t clear_flag;
    if (xQueueReceive(clear_requests, &clear_flag, 0) == pdTRUE) {
        pending_purchase_t dropped;
        while (xQueueReceive(purchase_requests, &dropped, 0) == pdTRUE) sub_pending_spend(dropped.price);
        unsigned dropped_sum = 0;
        for (uint32_t i = 0; i < queue.count; i++) dropped_sum += queue.items[i].price;
        queue.count = 0;
        memset(queue.items, 0, sizeof(queue.items));
        if (persist_queue()) sub_pending_spend(dropped_sum);
    }
    pending_purchase_t incoming;
    while (xQueueReceive(purchase_requests, &incoming, 0) == pdTRUE) {
        if (queue.count >= SHOP_PENDING_MAX) {
            sub_pending_spend(incoming.price);
            publish_result((purchase_result_t){ .state = PURCHASE_SAVE_FAILED });
            continue;
        }
        queue.items[queue.count] = incoming;
        queue.count++;
        if (!persist_queue()) {
            queue.count--;
            memset(&queue.items[queue.count], 0, sizeof(pending_purchase_t));
            sub_pending_spend(incoming.price);
            publish_result((purchase_result_t){ .state = PURCHASE_SAVE_FAILED });
        } else {
            next_purchase = 0;
        }
    }
    uint8_t refresh;
    if (xQueueReceive(refresh_requests, &refresh, 0) == pdTRUE) { next_catalog = 0; next_purchase = 0; }
    if (!online || !clock_ready || strlen(token) != 64) {
        if (strlen(token) != 64 && !published_unavailable) {
            shop_catalog_t empty = {0}; xQueueOverwrite(catalog_updates, &empty);
            published_unavailable = true; next_catalog = 0;
        }
        return;
    }
    int64_t now = esp_timer_get_time();
    if (queue.count > 0 && now >= next_purchase) purchase_head(token);
    if (now >= next_catalog) sync_catalog(token);
}
bool shop_purchase_pending(void) { return atomic_load(&pending_spend) > 0; }
unsigned shop_pending_spend(void) { return atomic_load(&pending_spend); }
void shop_clear_pending(void) { if (clear_requests) { uint8_t v = 1; xQueueOverwrite(clear_requests, &v); } }
bool shop_take_catalog(shop_catalog_t *catalog) { return catalog_updates && xQueueReceive(catalog_updates, catalog, 0) == pdTRUE; }
bool shop_take_result(purchase_result_t *result) { return purchase_results && xQueueReceive(purchase_results, result, 0) == pdTRUE; }
void shop_refresh(void) { if (refresh_requests) { uint8_t value = 1; xQueueOverwrite(refresh_requests, &value); } }
