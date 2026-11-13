#include "shop_network.h"
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
struct mock_client { esp_http_client_config_t config; char body[400]; int status; };
static int catalog_http=200,purchase_http=200,purchases;
static const char *binding="11111111-1111-4111-8111-111111111111";
static char catalog_json[1024], sent_binding[40], sent_request[40], first_request[40];
static bool sent_null;
static const char *purchase_response="{\"credits\":9,\"action\":\"drink\"}";
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *cfg) { struct mock_client *c=calloc(1,sizeof(*c)); c->config=*cfg; return c; }
void esp_http_client_set_header(esp_http_client_handle_t c,const char *k,const char *v) {(void)c;(void)k;(void)v;}
void esp_http_client_set_method(esp_http_client_handle_t c,int m) {(void)c;(void)m;}
void esp_http_client_set_post_field(esp_http_client_handle_t c,const char *body,int len) {assert((size_t)len<sizeof(c->body));memcpy(c->body,body,len);}
esp_err_t esp_http_client_perform(esp_http_client_handle_t c) {
    const char *body=catalog_json;
    if(c->body[0]) {
        purchases++; cJSON *j=cJSON_Parse(c->body); assert(j);
        cJSON *b=cJSON_GetObjectItemCaseSensitive(j,"expectedBindingVersion");sent_null=cJSON_IsNull(b);
        snprintf(sent_binding,sizeof(sent_binding),"%s",cJSON_IsString(b)?b->valuestring:"");
        snprintf(sent_request,sizeof(sent_request),"%s",cJSON_GetObjectItemCaseSensitive(j,"requestId")->valuestring);
        cJSON_Delete(j); c->status=purchase_http; body=purchase_response;
    } else c->status=catalog_http;
    if(!c->status)return ESP_FAIL;
    esp_http_client_event_t e={.event_id=HTTP_EVENT_ON_DATA,.data_len=(int)strlen(body),.data=(void*)body,.user_data=c->config.user_data};return c->config.event_handler(&e);
}
int esp_http_client_get_status_code(esp_http_client_handle_t c) {return c->status;}
void esp_http_client_cleanup(esp_http_client_handle_t c) {free(c);}
static const char *token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
static void tick(bool online) { now+=70000000; shop_network_tick(token,online,true); }
int main(void) {
    snprintf(catalog_json,sizeof(catalog_json),"{\"bindingVersion\":\"%s\",\"items\":[{\"id\":\"22222222-2222-4222-8222-222222222222\",\"name\":\"Water\",\"price\":1,\"action\":\"drink\",\"updated_at\":\"2026-11-13T00:00:00Z\"}]}",binding);
    shop_network_init(); tick(true); shop_catalog_t catalog; assert(shop_take_catalog(&catalog) && catalog.available && catalog.count==1);
    assert(!strcmp(catalog.items[0].binding_version,binding));
    shop_item_t item=catalog.items[0]; assert(shop_request_purchase(&item)); tick(false); assert(stored_size && purchases==0);
    shop_network_init(); purchase_http=0; tick(true); assert(purchases==1 && !strcmp(sent_binding,binding));strcpy(first_request,sent_request);
    shop_network_init(); purchase_http=200; tick(true); purchase_result_t result;
    assert(shop_take_result(&result) && result.state==PURCHASE_OK && !stored_size && !shop_purchase_pending());assert(!strcmp(first_request,sent_request));
    assert(shop_request_purchase(&item));purchase_http=409;purchase_response="{\"code\":\"item_changed\"}";tick(true);
    assert(shop_take_result(&result) && result.state==PURCHASE_CHANGED && !stored_size);
    // An older server without binding metadata must not enable new purchases.
    strcpy(catalog_json,"{\"items\":[]}");tick(true);assert(shop_take_catalog(&catalog) && !catalog.available);
    // Migrate the old NVS layout and confirm with NULL scope; never invent a scope.
    struct legacy { uint32_t format;char item_id[37],request_id[37],version[40];unsigned price; } old={.format=1,.price=1};
    strcpy(old.item_id,item.id);strcpy(old.request_id,"33333333-3333-4333-8333-333333333333");strcpy(old.version,item.version);
    memcpy(stored,&old,sizeof(old));stored_size=sizeof(old);shop_network_init();assert(shop_purchase_pending());tick(true);
    assert(sent_null && shop_take_result(&result) && result.state==PURCHASE_CHANGED && !shop_purchase_pending() && !stored_size);
    // Every new shop action is accepted from the catalog and purchase response.
    const char *names[]={"play","bath","treat","dress"};
    shop_action_t expected[]={SHOP_PLAY,SHOP_BATH,SHOP_TREAT,SHOP_DRESS};
    purchase_http=200;
    for(unsigned i=0;i<4;i++) {
        char response[128];
        snprintf(catalog_json,sizeof(catalog_json),"{\"bindingVersion\":\"%s\",\"items\":[{\"id\":\"22222222-2222-4222-8222-222222222222\",\"name\":\"Test\",\"price\":1,\"action\":\"%s\",\"updated_at\":\"2026-11-13T00:00:00Z\"}]}",binding,names[i]);
        snprintf(response,sizeof(response),"{\"credits\":9,\"action\":\"%s\"}",names[i]);purchase_response=response;
        shop_refresh();tick(true);assert(shop_take_catalog(&catalog) && catalog.available && catalog.items[0].action==expected[i]);
        assert(shop_request_purchase(&catalog.items[0]));tick(true);
        assert(shop_take_result(&result) && result.state==PURCHASE_OK && result.action==expected[i]);
    }
    // An unavailable token removes a previously published catalog.
    snprintf(catalog_json,sizeof(catalog_json),"{\"bindingVersion\":\"%s\",\"items\":[]}",binding);tick(true);assert(shop_take_catalog(&catalog) && catalog.available);
    shop_network_tick("",true,true);assert(shop_take_catalog(&catalog) && !catalog.available);
    puts("Shop network passed: scoped catalog, offline/reboot replay, old-binding refusal, legacy NVS migration, unavailable catalog.");
}
