#include "network.h"
#include "shop_network.h"
#include "wifi_manager.h"
#include "sdkconfig.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_sntp.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "cJSON.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_random.h"
#include "esp_timer.h"
#include <ctype.h>
#include <string.h>
#include <time.h>

static const char *TAG = "pet_net";
static QueueHandle_t wallet_updates, pair_requests, pair_results, refresh_requests;
static char device_token[65];
static bool paired;
static const char *active_token(void) { return paired ? device_token : CONFIG_STUDY_PET_DEVICE_TOKEN; }
bool network_pair_request(const char *code)
{
    if (!pair_requests || strlen(code) != 6) return false;
    char normalized[7];
    for (int i = 0; i < 6; i++) {
        if (!isdigit((unsigned char)code[i])) return false;
        normalized[i] = (char)tolower((unsigned char)code[i]);
    }
    normalized[6] = 0;
    return xQueueSend(pair_requests, normalized, 0) == pdTRUE;
}
int network_take_pair_result(void) { int result = 0; if (pair_results) xQueueReceive(pair_results, &result, 0); return result; }
static bool load_identity(void)
{
    if (nvs_flash_init() != ESP_OK) return false;
    nvs_handle_t handle;
    if (nvs_open("pet_pairing", NVS_READWRITE, &handle) != ESP_OK) return false;
    size_t size = sizeof(device_token); uint8_t state = 0;
    if (nvs_get_str(handle, "token", device_token, &size) != ESP_OK) device_token[0] = 0;
    if (nvs_get_u8(handle, "paired", &state) == ESP_OK && state == 1 && strlen(device_token) == 64) paired = true;
    nvs_close(handle); return true;
}
static bool save_identity(bool complete)
{
    nvs_handle_t handle;
    if (nvs_open("pet_pairing", NVS_READWRITE, &handle) != ESP_OK) return false;
    esp_err_t e = nvs_set_str(handle, "token", device_token);
    if (e == ESP_OK) e = nvs_set_u8(handle, "paired", complete ? 1 : 0);
    if (e == ESP_OK) e = nvs_commit(handle);
    nvs_close(handle); return e == ESP_OK;
}
typedef struct { char data[1024]; size_t length; } response_buffer_t;
static esp_err_t http_event(esp_http_client_event_t *event)
{
    response_buffer_t *buffer = event->user_data;
    if (event->event_id == HTTP_EVENT_ON_DATA && event->data_len > 0) {
        size_t n = (size_t)event->data_len;
        if (n > sizeof(buffer->data) - 1 - buffer->length) return ESP_FAIL;
        memcpy(buffer->data + buffer->length, event->data, n);
        buffer->length += n; buffer->data[buffer->length] = 0;
    }
    return ESP_OK;
}
// Return the next polling interval. Network failures back off separately below.
static unsigned sync_wallet(bool manual)
{
    const char *token = active_token();
    if (strlen(token) != 64) {
        if (manual) {
            network_wallet_update_t update = { .state = WALLET_UNAUTHORIZED, .manual = true };
            xQueueOverwrite(wallet_updates, &update);
        }
        if (token[0]) ESP_LOGW(TAG, "Invalid device credential configuration");
        return 60;
    }
    response_buffer_t response = {0};
    esp_http_client_config_t cfg = {
        .url = "https://keep.1203.fyi/api/v1/wallet", .crt_bundle_attach = esp_crt_bundle_attach,
        .timeout_ms = 10000, .event_handler = http_event, .user_data = &response,
    };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (!client) return 0;
    unsigned interval = 0;
    char authorization[72];
    snprintf(authorization, sizeof(authorization), "Bearer %s", token);
    esp_http_client_set_header(client, "Authorization", authorization);
    esp_err_t result = esp_http_client_perform(client);
    int status = esp_http_client_get_status_code(client);
    if (result == ESP_OK && status == 200) {
        cJSON *json = cJSON_Parse(response.data);
        const cJSON *balance = cJSON_GetObjectItemCaseSensitive(json, "credits");
        if (cJSON_IsNumber(balance) && balance->valuedouble >= 0 && balance->valuedouble <= 2147483647 && balance->valuedouble == balance->valueint) {
            network_wallet_update_t update = { .state = WALLET_READY, .credits = (unsigned)balance->valueint, .manual = manual };
            xQueueOverwrite(wallet_updates, &update);
            interval = 5;
            ESP_LOGD(TAG, "Wallet synchronized");
        } else ESP_LOGW(TAG, "Invalid wallet response");
        cJSON_Delete(json);
    } else if (result == ESP_OK && status == 409) {
        cJSON *json = cJSON_Parse(response.data);
        const cJSON *state = cJSON_GetObjectItemCaseSensitive(json, "state");
        if (cJSON_IsString(state) && strcmp(state->valuestring, "awaiting_child") == 0) {
            network_wallet_update_t update = { .state = WALLET_WAITING_FOR_CHILD, .manual = manual };
            xQueueOverwrite(wallet_updates, &update);
            interval = 3;
        }
        cJSON_Delete(json);
    } else if (result == ESP_OK && (status == 401 || status == 403)) {
        network_wallet_update_t update = { .state = WALLET_UNAUTHORIZED, .manual = manual };
        xQueueOverwrite(wallet_updates, &update);
        interval = 60;
        ESP_LOGW(TAG, "Wallet authorization unavailable: HTTP %d", status);
    } else ESP_LOGW(TAG, "Wallet request failed: HTTP %d (%s)", status, esp_err_to_name(result));
    esp_http_client_cleanup(client);
    return interval;
}
bool network_take_wallet(network_wallet_update_t *update) { return wallet_updates && xQueueReceive(wallet_updates, update, 0) == pdTRUE; }
bool network_business_enabled(void) { return paired || CONFIG_STUDY_PET_DEVICE_TOKEN[0] != '\0'; }
bool network_refresh_wallet(void)
{
    if (!refresh_requests || !network_business_enabled()) return false;
    uint8_t request = 1;
    return xQueueSend(refresh_requests, &request, 0) == pdTRUE;
}

static void perform_pair(const char *code)
{
    int result = 3;
    if (!device_token[0]) {
        unsigned char random[32]; esp_fill_random(random, sizeof(random));
        for (unsigned i = 0; i < sizeof(random); i++) snprintf(device_token + i * 2, 3, "%02x", random[i]);
        if (!save_identity(false)) { device_token[0] = 0; xQueueOverwrite(pair_results, &result); return; }
    }
    response_buffer_t response = {0};
    esp_http_client_config_t cfg = { .url = "https://keep.1203.fyi/api/v1/device/pair", .crt_bundle_attach = esp_crt_bundle_attach, .timeout_ms = 10000, .event_handler = http_event, .user_data = &response };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (client) {
        char body[128];
        snprintf(body, sizeof(body), "{\"code\":\"%s\",\"deviceToken\":\"%s\"}", code, device_token);
        esp_http_client_set_method(client, HTTP_METHOD_POST);
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, strlen(body));
        esp_err_t err = esp_http_client_perform(client);
        int status = esp_http_client_get_status_code(client);
        if (err == ESP_OK && status == 200) {
            cJSON *json = cJSON_Parse(response.data);
            if (cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(json, "paired")) && save_identity(true)) { paired = true; result = 1; }
            cJSON_Delete(json);
        } else if (err == ESP_OK && (status == 400 || status == 403)) result = 2;
        esp_http_client_cleanup(client);
    }
    xQueueOverwrite(pair_results, &result);
}


static void network_task(void *arg)
{
    (void)arg;
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "ntp.aliyun.com");
    esp_sntp_setservername(1, "time.cloudflare.com");
    esp_sntp_setservername(2, "pool.ntp.org");
    esp_sntp_init();
    int64_t next_sync = 0;
    unsigned retry_seconds = 10;
    int64_t next_clock_notice = 0;
    bool clock_was_ready = false;
    for (;;) {
        char code[7];
        bool waiting = xQueueReceive(pair_requests, code, pdMS_TO_TICKS(1000)) == pdTRUE;
        bool online = wifi_manager_online();
        bool clock_ready = time(NULL) >= 1704067200;
        if (online && !clock_ready && esp_timer_get_time() >= next_clock_notice) {
            ESP_LOGW(TAG, "Waiting for network time before HTTPS sync");
            next_clock_notice = esp_timer_get_time() + 30000000LL;
        }
        if (clock_ready && !clock_was_ready) ESP_LOGI(TAG, "Network time ready; HTTPS sync enabled");
        clock_was_ready = clock_ready;
        uint8_t refresh_request;
        bool manual = xQueueReceive(refresh_requests, &refresh_request, 0) == pdTRUE;
        if (waiting) {
            if (online && clock_ready && !paired) { perform_pair(code); next_sync = 0; }
            else { int result = 3; xQueueOverwrite(pair_results, &result); }
        }
        if (manual && (!online || !clock_ready)) {
            network_wallet_update_t update = { .state = WALLET_SYNC_FAILED, .manual = true };
            xQueueOverwrite(wallet_updates, &update);
        }
        if (manual) shop_refresh();
        if (online && clock_ready && (manual || esp_timer_get_time() >= next_sync)) {
            unsigned interval = sync_wallet(manual);
            if (!interval && manual) {
                network_wallet_update_t update = { .state = WALLET_SYNC_FAILED, .manual = true };
                xQueueOverwrite(wallet_updates, &update);
            }
            if (!interval) { interval = retry_seconds; retry_seconds = retry_seconds < 30 ? retry_seconds * 2 : 60; }
            else retry_seconds = 10;
            next_sync = esp_timer_get_time() + (int64_t)interval * 1000000LL;
        }
        shop_network_tick(active_token(), online, clock_ready);
    }
}
void network_start(void) {
    if (!load_identity()) { ESP_LOGE(TAG, "NVS unavailable; pairing disabled"); return; }
    if (!wifi_manager_start()) return;
    shop_network_init();
    wallet_updates = xQueueCreate(1, sizeof(network_wallet_update_t));
    pair_requests = xQueueCreate(1, 7);
    pair_results = xQueueCreate(1, sizeof(int));
    refresh_requests = xQueueCreate(1, sizeof(uint8_t));
    if (wallet_updates && pair_requests && pair_results && refresh_requests) xTaskCreate(network_task, "pet_network", 16384, NULL, 5, NULL);
}
