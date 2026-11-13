#include "mock.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#define ESP_LOGD(...) ((void)0)
#define ESP_LOGE(...) ((void)0)
#include "../../main/network.c"
struct queue { unsigned size; bool filled; char data[]; };
QueueHandle_t xQueueCreate(unsigned count,unsigned size) {(void)count;struct queue *q=calloc(1,sizeof(*q)+size);q->size=size;return q;}
int xQueueSend(QueueHandle_t q,const void *p,int timeout) {(void)timeout;if(q->filled)return 0;memcpy(q->data,p,q->size);q->filled=true;return 1;}
int xQueueReceive(QueueHandle_t q,void *p,int timeout) {(void)timeout;if(!q->filled)return 0;memcpy(p,q->data,q->size);q->filled=false;return 1;}
int xQueueOverwrite(QueueHandle_t q,const void *p) {q->filled=false;return xQueueSend(q,p,0);}
static int64_t now;int64_t esp_timer_get_time(void) {return now;}
void esp_fill_random(void *p,size_t n) {static unsigned count;unsigned char *b=p;for(unsigned i=0;i<n;i++)b[i]=(unsigned char)(i+count);count++;}
#ifndef __APPLE__
size_t strlcpy(char *d,const char *s,size_t n) {size_t len=strlen(s);if(n){size_t take=len<n?len:n-1;memcpy(d,s,take);d[take]=0;}return len;}
#endif
void *esp_crt_bundle_attach;

static char saved_token[65];static uint8_t saved_state;static bool fail_save;
esp_err_t nvs_flash_init(void){return ESP_OK;}
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h){(void)name;(void)mode;*h=1;return ESP_OK;}
esp_err_t nvs_get_str(nvs_handle_t h,const char *key,char *out,size_t *size){(void)h;(void)key;if(!saved_token[0])return ESP_ERR_NVS_NOT_FOUND;assert(*size>=65);strcpy(out,saved_token);*size=65;return ESP_OK;}
esp_err_t nvs_set_str(nvs_handle_t h,const char *key,const char *value){(void)h;(void)key;if(fail_save)return ESP_FAIL;strcpy(saved_token,value);return ESP_OK;}
esp_err_t nvs_get_u8(nvs_handle_t h,const char *key,uint8_t *value){(void)h;(void)key;*value=saved_state;return ESP_OK;}
esp_err_t nvs_set_u8(nvs_handle_t h,const char *key,uint8_t value){(void)h;(void)key;saved_state=value;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
void shop_network_init(void){} void task_network_init(void){} void shop_refresh(void){} void task_refresh(unsigned offset){(void)offset;}
void shop_network_tick(const char *t,bool o,bool c){(void)t;(void)o;(void)c;}void task_network_tick(const char *t,bool o,bool c){(void)t;(void)o;(void)c;}
bool wifi_manager_start(void){return true;}bool wifi_manager_online(void){return true;}
struct mock_client { esp_http_client_config_t config; int status; char body[200]; };
static int wallet_http=200,pair_http=200;static char attempted_token[65];
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *cfg){struct mock_client *c=calloc(1,sizeof(*c));c->config=*cfg;return c;}
void esp_http_client_set_header(esp_http_client_handle_t c,const char *k,const char *v){(void)c;(void)k;(void)v;}
void esp_http_client_set_method(esp_http_client_handle_t c,int m){(void)c;(void)m;}
void esp_http_client_set_post_field(esp_http_client_handle_t c,const char *body,int size){assert(size<200);memcpy(c->body,body,size);}
esp_err_t esp_http_client_perform(esp_http_client_handle_t c){
    const char *body;
    if(c->body[0]){cJSON *j=cJSON_Parse(c->body);assert(j);strcpy(attempted_token,cJSON_GetObjectItemCaseSensitive(j,"deviceToken")->valuestring);cJSON_Delete(j);c->status=pair_http;body="{\"paired\":true}";}
    else {c->status=wallet_http;body="{\"credits\":12,\"childId\":\"11111111-1111-4111-8111-111111111111\",\"deviceAlias\":\"desk\"}";}
    if(!c->status)return ESP_FAIL;
    esp_http_client_event_t e={.event_id=HTTP_EVENT_ON_DATA,.data=(void*)body,.data_len=(int)strlen(body),.user_data=c->config.user_data};return c->config.event_handler(&e);
}
int esp_http_client_get_status_code(esp_http_client_handle_t c){return c->status;}void esp_http_client_cleanup(esp_http_client_handle_t c){free(c);}
int main(void){
    memset(saved_token,'a',64);saved_state=1;network_start();assert(network_business_enabled());
    wallet_http=0;sync_wallet(false);assert(network_business_enabled() && saved_state==1);
    wallet_http=503;sync_wallet(false);assert(network_business_enabled() && saved_state==1);
    wallet_http=200;sync_wallet(false);network_wallet_update_t update;assert(network_take_wallet(&update) && update.state==WALLET_READY && !strcmp(update.device_alias,"desk") && strlen(update.child_id)==36);
    wallet_http=401;sync_wallet(false);assert(!network_business_enabled() && saved_state==2 && !active_token()[0]);
    assert(network_take_wallet(&update) && update.state==WALLET_UNAUTHORIZED);
    load_identity();assert(!network_business_enabled() && atomic_load(&rejected));
    assert(network_pair_request("123456"));assert(!network_pair_request("12345x"));
    pair_http=0;perform_pair("123456");char retry_token[65];strcpy(retry_token,attempted_token);
    assert(strcmp(saved_token,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") && saved_state==0 && !network_business_enabled());
    load_identity();pair_http=200;perform_pair("123456");assert(!strcmp(retry_token,attempted_token) && saved_state==1 && network_business_enabled());
    puts("Pairing passed: transient failures retain identity; 401 persists revocation; explicit pairing rotates token; lost responses/reboot reuse retry identity.");
}
