#include "wifi_manager.h"
#include "wifi_credentials.h"
#include "sdkconfig.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "nvs.h"
#include <stdlib.h>

#define WIFI_GOT_IP BIT0
#define WIFI_DISCONNECTED BIT1
#define WIFI_SCAN_DONE BIT2
#define ATTEMPT_TIMEOUT_US 25000000LL
typedef enum { COMMAND_SCAN, COMMAND_CONNECT, COMMAND_CANCEL } command_type_t;
typedef struct { command_type_t type; pet_wifi_credentials_t credentials; } command_t;
static QueueHandle_t commands;
static EventGroupHandle_t events;
static portMUX_TYPE snapshot_lock = portMUX_INITIALIZER_UNLOCKED;
static pet_wifi_snapshot_t snapshot;
static pet_wifi_credentials_t saved, candidate;
static bool have_saved, trial;
static int64_t attempt_deadline, next_reconnect;
static const char *TAG = "pet_wifi";

void wifi_manager_snapshot(pet_wifi_snapshot_t *out)
{
    portENTER_CRITICAL(&snapshot_lock); *out = snapshot; portEXIT_CRITICAL(&snapshot_lock);
}
static void publish(const pet_wifi_snapshot_t *value)
{
    portENTER_CRITICAL(&snapshot_lock); snapshot = *value; portEXIT_CRITICAL(&snapshot_lock);
}
bool wifi_manager_online(void)
{
    portENTER_CRITICAL(&snapshot_lock); bool online = snapshot.state == PET_WIFI_CONNECTED; portEXIT_CRITICAL(&snapshot_lock);
    return online;
}
static bool load_saved(void)
{
    nvs_handle_t handle;
    if (nvs_open("pet_wifi", NVS_READONLY, &handle) != ESP_OK) return false;
    size_t size = sizeof(saved);
    esp_err_t error = nvs_get_blob(handle, "credentials", &saved, &size);
    nvs_close(handle);
    return error == ESP_OK && size == sizeof(saved) && saved.version == 1 && saved.ssid[32] == 0 && saved.password[64] == 0 && pet_wifi_credentials_valid(saved.ssid, saved.password);
}
static bool persist_candidate(void)
{
    nvs_handle_t handle;
    if (nvs_open("pet_wifi", NVS_READWRITE, &handle) != ESP_OK) return false;
    esp_err_t error = nvs_set_blob(handle, "credentials", &candidate, sizeof(candidate));
    if (error == ESP_OK) error = nvs_commit(handle);
    nvs_close(handle);
    return error == ESP_OK;
}
static void wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg; (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) xEventGroupSetBits(events, WIFI_DISCONNECTED);
    if (base == WIFI_EVENT && id == WIFI_EVENT_SCAN_DONE) xEventGroupSetBits(events, WIFI_SCAN_DONE);
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) xEventGroupSetBits(events, WIFI_GOT_IP);
}
static bool apply_credentials(const pet_wifi_credentials_t *credentials)
{
    wifi_config_t config = {0};
    memcpy(config.sta.ssid, credentials->ssid, strlen(credentials->ssid));
    memcpy(config.sta.password, credentials->password, strlen(credentials->password));
    config.sta.pmf_cfg.capable = true;
    config.sta.sae_pwe_h2e = WPA3_SAE_PWE_BOTH;
    return esp_wifi_set_config(WIFI_IF_STA, &config) == ESP_OK && esp_wifi_connect() == ESP_OK;
}
static void stop_connection(void)
{
    if (esp_wifi_disconnect() == ESP_OK) xEventGroupWaitBits(events, WIFI_DISCONNECTED, pdTRUE, pdFALSE, pdMS_TO_TICKS(1000));
    xEventGroupClearBits(events, WIFI_GOT_IP | WIFI_DISCONNECTED);
}
static void restore_saved(pet_wifi_snapshot_t *view, pet_wifi_attempt_t result)
{
    stop_connection();
    trial = false;
    memset(&candidate, 0, sizeof(candidate));
    view->attempt = result;
    view->state = have_saved ? PET_WIFI_CONNECTING : PET_WIFI_UNCONFIGURED;
    strlcpy(view->ssid, have_saved ? saved.ssid : "", sizeof(view->ssid));
    if (have_saved && !apply_credentials(&saved)) view->state = PET_WIFI_OFFLINE;
    next_reconnect = esp_timer_get_time() + 3000000LL;
    ESP_LOGI(TAG, "Wi-Fi attempt ended; previous configuration retained");
}
static void collect_scan(pet_wifi_snapshot_t *view)
{
    wifi_ap_record_t *records = calloc(32, sizeof(*records));
    uint16_t count = 32;
    view->count = 0;
    view->scan_failed = !records || esp_wifi_scan_get_ap_records(&count, records) != ESP_OK;
    if (!view->scan_failed) {
        for (unsigned i = 0; i < count && view->count < PET_WIFI_SCAN_LIMIT; i++) {
            if (!records[i].ssid[0]) continue;
            bool duplicate = false;
            for (unsigned j = 0; j < view->count; j++) if (!strcmp(view->networks[j].ssid, (char *)records[i].ssid)) duplicate = true;
            if (duplicate) continue;
            pet_wifi_ap_t *ap = &view->networks[view->count++];
            strlcpy(ap->ssid, (char *)records[i].ssid, sizeof(ap->ssid));
            ap->rssi = records[i].rssi;
            ap->secured = records[i].authmode != WIFI_AUTH_OPEN;
            ap->supported = records[i].authmode == WIFI_AUTH_OPEN || records[i].authmode == WIFI_AUTH_WPA_PSK || records[i].authmode == WIFI_AUTH_WPA2_PSK || records[i].authmode == WIFI_AUTH_WPA_WPA2_PSK || records[i].authmode == WIFI_AUTH_WPA3_PSK || records[i].authmode == WIFI_AUTH_WPA2_WPA3_PSK;
        }
    }
    free(records); esp_wifi_clear_ap_list();
    view->scanning = false;
    ESP_LOGI(TAG, "Wi-Fi scan finished: %u networks", view->count);
}
static void manager_task(void *arg)
{
    (void)arg;
    pet_wifi_snapshot_t view; wifi_manager_snapshot(&view);
    if (have_saved && !apply_credentials(&saved)) view.state = PET_WIFI_OFFLINE;
    next_reconnect = esp_timer_get_time() + 3000000LL;
    publish(&view);
    for (;;) {
        command_t command = {0};
        if (xQueueReceive(commands, &command, pdMS_TO_TICKS(100)) == pdTRUE) {
            if (command.type == COMMAND_SCAN && !trial && !view.scanning) {
                if (view.state != PET_WIFI_CONNECTED) stop_connection();
                xEventGroupClearBits(events, WIFI_SCAN_DONE);
                wifi_scan_config_t scan = {.show_hidden = false};
                view.scan_failed = esp_wifi_scan_start(&scan, false) != ESP_OK;
                view.scanning = !view.scan_failed;
            } else if (command.type == COMMAND_CONNECT && !trial) {
                view.attempt_id++;
                if (view.scanning) { esp_wifi_scan_stop(); esp_wifi_clear_ap_list(); view.scanning = false; }
                stop_connection();
                candidate = command.credentials;
                trial = true; view.attempt = PET_WIFI_ATTEMPT_CONNECTING; view.state = PET_WIFI_CONNECTING;
                strlcpy(view.ssid, candidate.ssid, sizeof(view.ssid));
                attempt_deadline = esp_timer_get_time() + ATTEMPT_TIMEOUT_US;
                if (!apply_credentials(&candidate)) restore_saved(&view, PET_WIFI_ATTEMPT_FAILED);
            } else if (command.type == COMMAND_CANCEL && trial) restore_saved(&view, PET_WIFI_ATTEMPT_CANCELLED);
            memset(&command, 0, sizeof(command));
        }
        EventBits_t bits = xEventGroupClearBits(events, WIFI_GOT_IP | WIFI_DISCONNECTED | WIFI_SCAN_DONE);
        if ((bits & WIFI_SCAN_DONE) && view.scanning) collect_scan(&view);
        if (bits & WIFI_DISCONNECTED) {
            if (view.state == PET_WIFI_CONNECTED) view.state = PET_WIFI_OFFLINE;
            next_reconnect = esp_timer_get_time() + 1000000LL;
        }
        if (bits & WIFI_GOT_IP) {
            wifi_ap_record_t ap = {0};
            const char *expected = trial ? candidate.ssid : saved.ssid;
            if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK && !strcmp((char *)ap.ssid, expected)) {
                if (trial) {
                    if (persist_candidate()) {
                        saved = candidate; have_saved = true; trial = false;
                        memset(&candidate, 0, sizeof(candidate));
                        view.configured = true; view.attempt = PET_WIFI_ATTEMPT_SAVED;
                        view.state = PET_WIFI_CONNECTED;
                        ESP_LOGI(TAG, "Wi-Fi connected; configuration saved");
                    } else restore_saved(&view, PET_WIFI_ATTEMPT_SAVE_FAILED);
                } else view.state = PET_WIFI_CONNECTED;
            }
        }
        int64_t now = esp_timer_get_time();
        if (trial && now >= attempt_deadline) restore_saved(&view, PET_WIFI_ATTEMPT_FAILED);
        if (!view.scanning && view.state != PET_WIFI_CONNECTED && now >= next_reconnect && (trial || have_saved)) {
            esp_wifi_connect(); next_reconnect = now + 3000000LL;
        }
        publish(&view);
    }
}
bool wifi_manager_start(void)
{
    have_saved = load_saved();
    if (!have_saved && pet_wifi_credentials_valid(CONFIG_STUDY_PET_WIFI_SSID, CONFIG_STUDY_PET_WIFI_PASSWORD)) {
        memset(&saved, 0, sizeof(saved)); saved.version = 1;
        strlcpy(saved.ssid, CONFIG_STUDY_PET_WIFI_SSID, sizeof(saved.ssid));
        strlcpy(saved.password, CONFIG_STUDY_PET_WIFI_PASSWORD, sizeof(saved.password)); have_saved = true;
    }
    pet_wifi_snapshot_t view = {.configured = have_saved, .state = have_saved ? PET_WIFI_CONNECTING : PET_WIFI_UNCONFIGURED};
    strlcpy(view.ssid, have_saved ? saved.ssid : "", sizeof(view.ssid)); publish(&view);
    commands = xQueueCreate(2, sizeof(command_t)); events = xEventGroupCreate();
    if (!commands || !events) goto failed;
    if (esp_netif_init() != ESP_OK || esp_event_loop_create_default() != ESP_OK || !esp_netif_create_default_wifi_sta()) goto failed;
    wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
    if (esp_wifi_init(&init) != ESP_OK || esp_wifi_set_storage(WIFI_STORAGE_RAM) != ESP_OK) goto failed;
    if (esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event, NULL) != ESP_OK || esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event, NULL) != ESP_OK) goto failed;
    if (esp_wifi_set_mode(WIFI_MODE_STA) != ESP_OK || esp_wifi_start() != ESP_OK) goto failed;
    if (xTaskCreate(manager_task, "pet_wifi", 6144, NULL, 4, NULL) != pdPASS) goto failed;
    return true;
failed:
    view.state = PET_WIFI_UNAVAILABLE; publish(&view);
    ESP_LOGE(TAG, "Wi-Fi initialization failed; settings remain accessible");
    return false;
}
bool wifi_manager_scan(void)
{
    pet_wifi_snapshot_t view; wifi_manager_snapshot(&view);
    if (!commands || view.state == PET_WIFI_UNAVAILABLE || view.scanning || view.attempt == PET_WIFI_ATTEMPT_CONNECTING) return false;
    command_t command = {.type = COMMAND_SCAN}; return xQueueSend(commands, &command, 0) == pdTRUE;
}
bool wifi_manager_connect(const char *ssid, const char *password)
{
    pet_wifi_snapshot_t view; wifi_manager_snapshot(&view);
    if (!commands || view.state == PET_WIFI_UNAVAILABLE || view.attempt == PET_WIFI_ATTEMPT_CONNECTING || !pet_wifi_credentials_valid(ssid, password)) return false;
    command_t command = {.type = COMMAND_CONNECT, .credentials.version = 1};
    strlcpy(command.credentials.ssid, ssid, sizeof(command.credentials.ssid)); strlcpy(command.credentials.password, password, sizeof(command.credentials.password));
    bool accepted = xQueueSend(commands, &command, 0) == pdTRUE;
    memset(&command, 0, sizeof(command)); return accepted;
}
void wifi_manager_cancel(void)
{
    if (commands) { xQueueReset(commands); command_t command = {.type = COMMAND_CANCEL}; xQueueSendToFront(commands, &command, 0); }
}
