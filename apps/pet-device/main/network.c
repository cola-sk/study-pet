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
#include "nvs_flash.h"
#include <string.h>
#include <time.h>

#define CONNECTED_BIT BIT0
static const char *TAG = "pet_net";
static EventGroupHandle_t network_events;

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
    esp_err_t err = nvs_flash_init();
    // Do not erase existing NVS on failure; it may contain user data.
    if (err != ESP_OK) { ESP_LOGE(TAG, "NVS initialization failed: %s", esp_err_to_name(err)); vTaskDelete(NULL); return; }
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
    xEventGroupWaitBits(network_events, CONNECTED_BIT, pdFALSE, pdTRUE, portMAX_DELAY);
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
    for (;;) {
        xEventGroupWaitBits(network_events, CONNECTED_BIT, pdFALSE, pdTRUE, portMAX_DELAY);
        if (time(NULL) < 1704067200) {
            ESP_LOGW(TAG, "Waiting for network time before HTTPS");
            vTaskDelay(pdMS_TO_TICKS(5000));
            continue;
        } else {
            esp_http_client_config_t http_cfg = {
                .url = "https://keep.1203.fyi/api/device/health",
                .crt_bundle_attach = esp_crt_bundle_attach,
                .timeout_ms = 10000,
            };
            esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
            if (client) {
                esp_err_t result = esp_http_client_perform(client);
                if (result == ESP_OK) ESP_LOGI(TAG, "Health endpoint HTTP %d", esp_http_client_get_status_code(client));
                else ESP_LOGW(TAG, "HTTPS probe failed: %s", esp_err_to_name(result));
                esp_http_client_cleanup(client);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(60000));
    }
}
void network_start(void) { xTaskCreate(network_task, "pet_network", 8192, NULL, 5, NULL); }
