#include "task_network.h"
#include "mock.h"
#include "cJSON.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
struct queue { unsigned size; bool filled; char data[]; };
QueueHandle_t xQueueCreate(unsigned count,unsigned size) {(void)count;struct queue *q=calloc(1,sizeof(*q)+size);q->size=size;return q;}
int xQueueSend(QueueHandle_t q,const void *p,int timeout) {(void)timeout;if(q->filled)return 0;memcpy(q->data,p,q->size);q->filled=true;return 1;}
int xQueueReceive(QueueHandle_t q,void *p,int timeout) {(void)timeout;if(!q->filled)return 0;memcpy(p,q->data,q->size);q->filled=false;return 1;}
int xQueueOverwrite(QueueHandle_t q,const void *p) {q->filled=false;return xQueueSend(q,p,0);}
static char stored[256];static size_t stored_size;static bool fail_store,fail_erase;
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h) {(void)name;(void)mode;*h=1;return ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *data,size_t *size) {(void)h;(void)key;if(!stored_size)return ESP_ERR_NVS_NOT_FOUND;if(*size<stored_size)return ESP_FAIL;memcpy(data,stored,stored_size);*size=stored_size;return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *data,size_t size) {(void)h;(void)key;if(fail_store)return ESP_FAIL;assert(size<=sizeof(stored));memcpy(stored,data,size);stored_size=size;return ESP_OK;}
esp_err_t nvs_erase_key(nvs_handle_t h,const char *key) {(void)h;(void)key;if(fail_erase)return ESP_FAIL;stored_size=0;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h) {(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h) {(void)h;}
static int64_t now;int64_t esp_timer_get_time(void) {return now;}
void esp_fill_random(void *p,size_t n) {static unsigned count;unsigned char *b=p;for(unsigned i=0;i<n;i++)b[i]=(unsigned char)(i+count);count++;}
#ifndef __APPLE__
size_t strlcpy(char *d,const char *s,size_t n) {size_t len=strlen(s);if(n){size_t take=len<n?len:n-1;memcpy(d,s,take);d[take]=0;}return len;}
#endif
void *esp_crt_bundle_attach;
struct mock_client {esp_http_client_config_t config;char path[192],body[200];int status;};
static char last_request[80],prior_request[80];static int submissions;static int submit_http=200;static const char *submit_response="{\"success\":true,\"status\":\"completed\",\"credits\":3,\"awarded\":true}";
static const char *task_id="22222222-2222-4222-8222-222222222222";
static char page_json[2048];static int page_http=200;
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *cfg) {struct mock_client *c=calloc(1,sizeof(*c));c->config=*cfg;snprintf(c->path,sizeof(c->path),"%s",cfg->url);return c;}
void esp_http_client_set_header(esp_http_client_handle_t c,const char *k,const char *v) {(void)c;(void)k;(void)v;}
void esp_http_client_set_method(esp_http_client_handle_t c,int m) {(void)c;(void)m;}
void esp_http_client_set_post_field(esp_http_client_handle_t c,const char *body,int len) {assert((size_t)len<sizeof(c->body));memcpy(c->body,body,len);}
esp_err_t esp_http_client_perform(esp_http_client_handle_t c) {
    const char *body;
    if(strstr(c->path,"/submit")) {
        submissions++;cJSON *j=cJSON_Parse(c->body);assert(j);const cJSON *v=cJSON_GetObjectItemCaseSensitive(j,"requestId");assert(cJSON_IsString(v));
        strcpy(prior_request,last_request);snprintf(last_request,sizeof(last_request),"%s",v->valuestring);cJSON_Delete(j);
        c->status=submit_http;body=submit_response;if(!submit_http)return ESP_FAIL;
    } else {c->status=page_http;body=page_json;}
    esp_http_client_event_t e={.event_id=HTTP_EVENT_ON_DATA,.data_len=(int)strlen(body),.data=(void *)body,.user_data=c->config.user_data};
    return c->config.event_handler(&e);
}
int esp_http_client_get_status_code(esp_http_client_handle_t c) {return c->status;}
void esp_http_client_cleanup(esp_http_client_handle_t c) {free(c);}
static void tick(const char *token,bool online) {now+=11000000;task_network_tick(token,online,true);}
int main(void) {
    const char *token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    snprintf(page_json,sizeof(page_json),"{\"date\":\"2026-11-13\",\"childId\":\"11111111-1111-4111-8111-111111111111\",\"offset\":0,\"total\":1,\"completed\":0,\"tasks\":[{\"id\":\"%s\",\"title\":\"阅读\",\"description\":\"读书\",\"reject_reason\":null,\"reward_coins\":3,\"status\":\"pending\",\"confirm_type\":\"auto_confirm\"}]}",task_id);
    task_network_init();tick(token,true);task_page_t *page=calloc(1,sizeof(*page));assert(task_take_page(page));assert(page->state==TASKS_READY && page->count==1 && !strcmp(page->items[0].title,"阅读"));
    assert(task_request_checkin(task_id));assert(!task_request_checkin(task_id));tick(token,false);assert(stored_size && task_checkin_pending());
    checkin_result_t result;assert(task_take_checkin(&result) && result.state==CHECKIN_UNKNOWN);assert(submissions==0);
    assert(task_take_page(page) && page->state==TASKS_OFFLINE && page->count==1);
    task_refresh(0);tick(token,false);assert(task_take_page(page) && page->state==TASKS_OFFLINE && page->count==1);
    // Simulated reboot: NVS survives, while all in-memory queues are recreated.
    task_network_init();assert(task_checkin_pending());submit_http=0;tick(token,true);assert(submissions==1 && stored_size);assert(task_take_checkin(&result) && result.state==CHECKIN_UNKNOWN);
    char first_request[80];strcpy(first_request,last_request);
    task_network_init();assert(task_checkin_pending());submit_http=200;tick(token,true);
    assert(submissions==2 && !strcmp(first_request,last_request));assert(task_take_checkin(&result) && result.state==CHECKIN_OK && result.credits==3 && result.awarded);
    assert(!stored_size && !task_checkin_pending());
    fail_store=true;assert(task_request_checkin(task_id));tick(token,true);assert(task_take_checkin(&result) && result.state==CHECKIN_SAVE_FAILED);assert(submissions==2 && !stored_size && !task_checkin_pending());fail_store=false;
    assert(task_request_checkin(task_id));fail_erase=true;tick(token,true);assert(task_take_checkin(&result) && result.state==CHECKIN_UNKNOWN);assert(stored_size && task_checkin_pending());
    fail_erase=false;tick(token,true);assert(task_take_checkin(&result) && result.state==CHECKIN_OK);assert(!strcmp(last_request,prior_request) && !stored_size);
    assert(task_request_checkin(task_id));submit_http=409;submit_response="{\"code\":\"not_today\"}";tick(token,true);assert(task_take_checkin(&result) && result.state==CHECKIN_EXPIRED && !task_checkin_pending() && !stored_size);
    assert(task_request_checkin(task_id));submit_response="{\"code\":\"request_conflict\"}";tick(token,true);assert(task_take_checkin(&result) && result.state==CHECKIN_CONFLICT && task_checkin_pending() && stored_size);
    page_http=401;task_refresh(0);tick(token,true);
    assert(task_take_page(page) && page->state==TASKS_DENIED && page->count==0 && !page->child_id[0]);
    free(page);puts("Task network passed: parsed response, offline queue, reboot/timeout replay, one pending request, failed NVS write/erase, expired and conflict responses.");
}
