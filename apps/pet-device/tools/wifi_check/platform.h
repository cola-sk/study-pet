/* Host substitutes for ESP-IDF. Used only to exercise the real Wi-Fi manager. */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#undef strlcpy
#define strlcpy pet_test_strlcpy
#define CONFIG_STUDY_PET_WIFI_SSID ""
#define CONFIG_STUDY_PET_WIFI_PASSWORD ""
#define ESP_OK 0
#define ESP_FAIL -1
#define NVS_READONLY 0
#define NVS_READWRITE 1
#define WIFI_IF_STA 0
#define WIFI_MODE_STA 1
#define WIFI_STORAGE_RAM 0
#define WIFI_EVENT 1
#define IP_EVENT 2
#define WIFI_EVENT_STA_DISCONNECTED 1
#define WIFI_EVENT_SCAN_DONE 2
#define IP_EVENT_STA_GOT_IP 3
#define ESP_EVENT_ANY_ID -1
#define WIFI_AUTH_OPEN 0
#define WIFI_AUTH_WPA_PSK 2
#define WIFI_AUTH_WPA2_PSK 3
#define WIFI_AUTH_WPA_WPA2_PSK 4
#define WIFI_AUTH_WPA3_PSK 6
#define WIFI_AUTH_WPA2_WPA3_PSK 7
#define WPA3_SAE_PWE_BOTH 3
#define BIT0 1u
#define BIT1 2u
#define BIT2 4u
#define pdTRUE 1
#define pdFALSE 0
#define pdPASS 1
#define pdMS_TO_TICKS(x) (x)
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) ((void)(x))
#define portEXIT_CRITICAL(x) ((void)(x))
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGE(...) ((void)0)
#define WIFI_INIT_CONFIG_DEFAULT() ((wifi_init_config_t){0})
typedef int esp_err_t, esp_event_base_t, nvs_handle_t, portMUX_TYPE;
typedef unsigned EventBits_t;
typedef void *QueueHandle_t, *EventGroupHandle_t;
typedef struct { int unused; } wifi_init_config_t;
typedef struct { bool show_hidden; } wifi_scan_config_t;
typedef struct { struct { uint8_t ssid[32],password[64];struct { bool capable; } pmf_cfg;int sae_pwe_h2e; } sta; } wifi_config_t;
typedef struct { uint8_t ssid[33];int8_t rssi;int authmode; } wifi_ap_record_t;
size_t strlcpy(char *,const char *,size_t);
int nvs_open(const char *,int,nvs_handle_t *);
int nvs_get_blob(nvs_handle_t,const char *,void *,size_t *);
int nvs_set_blob(nvs_handle_t,const char *,const void *,size_t);
int nvs_commit(nvs_handle_t);
void nvs_close(nvs_handle_t);
int64_t esp_timer_get_time(void);
QueueHandle_t xQueueCreate(unsigned,unsigned);
int xQueueSend(QueueHandle_t,const void *,unsigned);
int xQueueSendToFront(QueueHandle_t,const void *,unsigned);
void xQueueReset(QueueHandle_t);
int xQueueReceive(QueueHandle_t,void *,unsigned);
EventGroupHandle_t xEventGroupCreate(void);
EventBits_t xEventGroupSetBits(EventGroupHandle_t,EventBits_t);
EventBits_t xEventGroupClearBits(EventGroupHandle_t,EventBits_t);
EventBits_t xEventGroupWaitBits(EventGroupHandle_t,EventBits_t,int,int,unsigned);
int xTaskCreate(void (*)(void *),const char *,unsigned,void *,unsigned,void *);
int esp_wifi_set_config(int,const wifi_config_t *);
int esp_wifi_connect(void);
int esp_wifi_disconnect(void);
int esp_wifi_scan_start(const wifi_scan_config_t *,bool);
int esp_wifi_scan_stop(void);
int esp_wifi_clear_ap_list(void);
int esp_wifi_scan_get_ap_records(uint16_t *,wifi_ap_record_t *);
int esp_wifi_sta_get_ap_info(wifi_ap_record_t *);
int esp_netif_init(void);
int esp_event_loop_create_default(void);
void *esp_netif_create_default_wifi_sta(void);
int esp_wifi_init(const wifi_init_config_t *);
int esp_wifi_set_storage(int);
int esp_event_handler_register(int,int,void (*)(void *,int,int,void *),void *);
int esp_wifi_set_mode(int);
int esp_wifi_start(void);
