#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_NVS_NOT_FOUND 1
#define NVS_READWRITE 1
#define pdTRUE 1
typedef int nvs_handle_t;
typedef struct queue *QueueHandle_t;
QueueHandle_t xQueueCreate(unsigned count,unsigned size);
int xQueueSend(QueueHandle_t queue,const void *item,int timeout);
int xQueueReceive(QueueHandle_t queue,void *item,int timeout);
int xQueueOverwrite(QueueHandle_t queue,const void *item);
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *handle);
esp_err_t nvs_get_blob(nvs_handle_t handle,const char *key,void *data,size_t *size);
esp_err_t nvs_set_blob(nvs_handle_t handle,const char *key,const void *data,size_t size);
esp_err_t nvs_erase_key(nvs_handle_t handle,const char *key);
esp_err_t nvs_commit(nvs_handle_t handle);
void nvs_close(nvs_handle_t handle);
int64_t esp_timer_get_time(void);
void esp_fill_random(void *data,size_t size);
#ifndef __APPLE__
size_t strlcpy(char *dst,const char *src,size_t size);
#endif
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#define HTTP_EVENT_ON_DATA 1
#define HTTP_METHOD_POST 1
typedef struct { int event_id; int data_len; void *data; void *user_data; } esp_http_client_event_t;
typedef struct { const char *url; void *crt_bundle_attach; int timeout_ms; esp_err_t (*event_handler)(esp_http_client_event_t *);void *user_data; } esp_http_client_config_t;
typedef struct mock_client *esp_http_client_handle_t;
extern void *esp_crt_bundle_attach;
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *config);
void esp_http_client_set_header(esp_http_client_handle_t client,const char *key,const char *value);
void esp_http_client_set_method(esp_http_client_handle_t client,int method);
void esp_http_client_set_post_field(esp_http_client_handle_t client,const char *body,int length);
esp_err_t esp_http_client_perform(esp_http_client_handle_t client);
int esp_http_client_get_status_code(esp_http_client_handle_t client);
void esp_http_client_cleanup(esp_http_client_handle_t client);
