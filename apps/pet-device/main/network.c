#include "network.h"
#include "sdkconfig.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sntp.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
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

#define CONNECTED_BIT BIT0
static const char *TAG = "pet_net";
static EventGroupHandle_t network_events;
static QueueHandle_t wallet_updates, pair_requests, pair_results;
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
static unsigned sync_wallet(void)
{
    const char *token = active_token();
    if (!token[0]) return 60;
    if (strlen(token) != 64) { ESP_LOGW(TAG, "Invalid device credential configuration"); return 60; }
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
            network_wallet_update_t update = { .state = WALLET_READY, .credits = (unsigned)balance->valueint };
            xQueueOverwrite(wallet_updates, &update);
            interval = 5;
            ESP_LOGD(TAG, "Wallet synchronized");
        } else ESP_LOGW(TAG, "Invalid wallet response");
        cJSON_Delete(json);
    } else if (result == ESP_OK && status == 409) {
        cJSON *json = cJSON_Parse(response.data);
        const cJSON *state = cJSON_GetObjectItemCaseSensitive(json, "state");
        if (cJSON_IsString(state) && strcmp(state->valuestring, "awaiting_child") == 0) {
            network_wallet_update_t update = { .state = WALLET_WAITING_FOR_CHILD };
            xQueueOverwrite(wallet_updates, &update);
            interval = 3;
        }
        cJSON_Delete(json);
    } else if (result == ESP_OK && (status == 401 || status == 403)) {
        network_wallet_update_t update = { .state = WALLET_UNAUTHORIZED };
        xQueueOverwrite(wallet_updates, &update);
        interval = 60;
        ESP_LOGW(TAG, "Wallet authorization unavailable: HTTP %d", status);
    } else ESP_LOGW(TAG, "Wallet request failed: HTTP %d (%s)", status, esp_err_to_name(result));
    esp_http_client_cleanup(client);
    return interval;
}
bool network_take_wallet(network_wallet_update_t *update) { return wallet_updates && xQueueReceive(wallet_updates, update, 0) == pdTRUE; }
bool network_business_enabled(void) { return paired || CONFIG_STUDY_PET_DEVICE_TOKEN[0] != '\0'; }

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


static void event_handler(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg; (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) esp_wifi_connect();
    else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        xEventGroupClearBits(network_events, CONNECTED_BIT);
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(network_events, CONNECTED_BIT);
    }
}
static void network_task(void *arg)
{
    (void)arg;
    if (!CONFIG_STUDY_PET_WIFI_SSID[0]) {
        ESP_LOGW(TAG, "Wi-Fi is not configured; network sync disabled");
        vTaskDelete(NULL);
        return;
    }
    if (strlen(CONFIG_STUDY_PET_WIFI_SSID) >= sizeof(((wifi_config_t *)0)->sta.ssid) ||
        strlen(CONFIG_STUDY_PET_WIFI_PASSWORD) >= sizeof(((wifi_config_t *)0)->sta.password)) {
        ESP_LOGE(TAG, "Wi-Fi configuration exceeds supported length"); vTaskDelete(NULL); return;
    }
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    network_events = xEventGroupCreate();
    if (!network_events) { ESP_LOGE(TAG, "No memory for network event group"); vTaskDelete(NULL); return; }
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, event_handler, NULL));
    wifi_config_t wifi = {0};
    strlcpy((char *)wifi.sta.ssid, CONFIG_STUDY_PET_WIFI_SSID, sizeof(wifi.sta.ssid));
    strlcpy((char *)wifi.sta.password, CONFIG_STUDY_PET_WIFI_PASSWORD, sizeof(wifi.sta.password));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi));
    ESP_ERROR_CHECK(esp_wifi_start());
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
    int64_t next_sync = 0;
    unsigned retry_seconds = 10;
    for (;;) {
        char code[7];
        bool waiting = xQueueReceive(pair_requests, code, pdMS_TO_TICKS(1000)) == pdTRUE;
        bool online = (xEventGroupGetBits(network_events) & CONNECTED_BIT) != 0;
        bool clock_ready = time(NULL) >= 1704067200;
        if (waiting) {
            if (online && clock_ready && !paired) { perform_pair(code); next_sync = 0; }
            else { int result = 3; xQueueOverwrite(pair_results, &result); }
        }
        if (online && clock_ready && esp_timer_get_time() >= next_sync) {
            unsigned interval = sync_wallet();
            if (!interval) { interval = retry_seconds; retry_seconds = retry_seconds < 30 ? retry_seconds * 2 : 60; }
            else retry_seconds = 10;
            next_sync = esp_timer_get_time() + (int64_t)interval * 1000000LL;
        }
    }
}
void network_start(void) {
    if (!load_identity()) { ESP_LOGE(TAG, "NVS unavailable; pairing disabled"); return; }
    wallet_updates = xQueueCreate(1, sizeof(network_wallet_update_t));
    pair_requests = xQueueCreate(1, 7);
    pair_results = xQueueCreate(1, sizeof(int));
    if (wallet_updates && pair_requests && pair_results) xTaskCreate(network_task, "pet_network", 8192, NULL, 5, NULL);
}
