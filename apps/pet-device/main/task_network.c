#include "task_network.h"
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
#include <stdlib.h>
#include <string.h>
#include <limits.h>

typedef struct { uint32_t format; char task_id[37], request_id[37]; } pending_checkin_t;
typedef struct { char *data; size_t length; bool overflow; } response_t;
#define RESPONSE_CAPACITY 32768
static QueueHandle_t page_updates, checkin_requests, checkin_results, refresh_requests;
static atomic_bool unsettled;
static bool storage_ready, has_pending;
static pending_checkin_t pending;
static task_page_t current;
static int64_t next_page, next_submit;
static unsigned retry_seconds = 5, requested_offset;
static const char *TAG="pet_tasks";
static esp_err_t http_event(esp_http_client_event_t *e) {
    response_t *r=e->user_data;
    if(e->event_id==HTTP_EVENT_ON_DATA && e->data_len>0) {
        if((size_t)e->data_len>RESPONSE_CAPACITY-1-r->length) {r->overflow=true;return ESP_FAIL;}
        memcpy(r->data+r->length,e->data,e->data_len);r->length+=e->data_len;r->data[r->length]=0;
    }
    return ESP_OK;
}
static int request(const char *token,const char *path,const char *body,response_t *r) {
    r->data=calloc(1,RESPONSE_CAPACITY);if(!r->data)return 0;
    char url[192],authorization[72];snprintf(url,sizeof(url),"https://keep.1203.fyi/api/v1/%s",path);
    snprintf(authorization,sizeof(authorization),"Bearer %s",token);
    esp_http_client_config_t config={.url=url,.crt_bundle_attach=esp_crt_bundle_attach,.timeout_ms=8000,.event_handler=http_event,.user_data=r};
    esp_http_client_handle_t client=esp_http_client_init(&config);if(!client)return 0;
    esp_http_client_set_header(client,"Authorization",authorization);
    if(body) {esp_http_client_set_method(client,HTTP_METHOD_POST);esp_http_client_set_header(client,"Content-Type","application/json");esp_http_client_set_post_field(client,body,strlen(body));}
    esp_err_t e=esp_http_client_perform(client);
    int status=e==ESP_OK && !r->overflow ? esp_http_client_get_status_code(client):0;
    esp_http_client_cleanup(client);return status;
}
static bool copy_text(const cJSON *json,const char *key,char *out,size_t size,bool optional) {
    const cJSON *v=cJSON_GetObjectItemCaseSensitive(json,key);
    if(optional && (!v || cJSON_IsNull(v))) {out[0]=0;return true;}
    if(!cJSON_IsString(v) || strlen(v->valuestring)>=size)return false;
    strlcpy(out,v->valuestring,size);return true;
}
static bool number(const cJSON *json,const char *key,unsigned *out,unsigned max) {
    const cJSON *v=cJSON_GetObjectItemCaseSensitive(json,key);
    if(!cJSON_IsNumber(v) || v->valuedouble<0 || v->valuedouble>max || v->valuedouble!=v->valueint)return false;
    *out=(unsigned)v->valueint;return true;
}
static bool status_value(const cJSON *json,task_status_t *status) {
    const cJSON *v=cJSON_GetObjectItemCaseSensitive(json,"status");
    const char *names[]={"pending","submitted","completed","rejected"};
    if(cJSON_IsString(v))for(unsigned n=0;n<4;n++)if(!strcmp(v->valuestring,names[n])) {*status=(task_status_t)n;return true;}
    return false;
}
static bool persist(bool clear) {
    nvs_handle_t h;if(nvs_open("pet_tasks",NVS_READWRITE,&h)!=ESP_OK)return false;
    esp_err_t e=clear?nvs_erase_key(h,"pending"):nvs_set_blob(h,"pending",&pending,sizeof(pending));
    if(clear && e==ESP_ERR_NVS_NOT_FOUND)e=ESP_OK;
    if(e==ESP_OK) e=nvs_commit(h);
    nvs_close(h);
    return e==ESP_OK;
}
static void publish_error(task_page_state_t state, bool force) {
    // Keep the last snapshot on transient failures. An authorization failure
    // invalidates it, as the device may no longer belong to the same child.
    if(current.state!=state || force) {
        if(state==TASKS_DENIED) memset(&current,0,sizeof(current));
        current.state=state;current.approved=false;xQueueOverwrite(page_updates,&current);
    }
}
static void load_page(const char *token) {
    char path[80];snprintf(path,sizeof(path),"device/tasks/today?offset=%u",requested_offset);
    response_t response={0};int http=request(token,path,NULL,&response);
    cJSON *json=http==200 && response.data?cJSON_Parse(response.data):NULL;
    task_page_t *page=calloc(1,sizeof(*page));
    const cJSON *items=cJSON_GetObjectItemCaseSensitive(json,"tasks");
    bool valid=page && cJSON_IsArray(items) && cJSON_GetArraySize(items)<=TASK_PAGE_SIZE;
    if(valid) valid=copy_text(json,"date",page->date,sizeof(page->date),false) && strlen(page->date)==10 &&
        copy_text(json,"childId",page->child_id,sizeof(page->child_id),false) && strlen(page->child_id)==36 &&
        number(json,"offset",&page->offset,999999) && page->offset==requested_offset &&
        number(json,"total",&page->total,10000) && number(json,"completed",&page->completed,10000) && page->completed<=page->total;
    if(valid) {
        const cJSON *entry;
        cJSON_ArrayForEach(entry,items) {
            pet_task_t *t=&page->items[page->count];
            const cJSON *confirm=cJSON_GetObjectItemCaseSensitive(entry,"confirm_type");
            if(!copy_text(entry,"id",t->id,sizeof(t->id),false) || strlen(t->id)!=36 ||
               !copy_text(entry,"title",t->title,sizeof(t->title),false) || !copy_text(entry,"description",t->description,sizeof(t->description),true) ||
               !copy_text(entry,"reject_reason",t->reason,sizeof(t->reason),true) || !number(entry,"reward_coins",&t->reward,10000) || !status_value(entry,&t->status) ||
               !cJSON_IsString(confirm) || (strcmp(confirm->valuestring,"parent_confirm") && strcmp(confirm->valuestring,"auto_confirm"))) {valid=false;break;}
            t->parent_confirm=!strcmp(confirm->valuestring,"parent_confirm");page->count++;
        }
        valid=valid && page->count<=page->total && (!page->count || page->offset+page->count<=page->total);
    }
    if(valid && !page->count && page->offset) {
        requested_offset=0;next_page=0;
        free(page);cJSON_Delete(json);free(response.data);return;
    }
    if(valid) {
        page->state=TASKS_READY;
        if(current.state==TASKS_READY && !strcmp(current.child_id,page->child_id))
            for(unsigned a=0;a<current.count;a++)for(unsigned b=0;b<page->count;b++)
                if(!strcmp(current.items[a].id,page->items[b].id) && current.items[a].status==TASK_SUBMITTED && page->items[b].status==TASK_COMPLETED)page->approved=true;
        if(current.state!=TASKS_READY || current.total!=page->total || current.completed!=page->completed)
            ESP_LOGI(TAG,"Today synchronized: %u/%u completed",page->completed,page->total);
        current=*page;xQueueOverwrite(page_updates,page);
        next_page=esp_timer_get_time()+5000000LL;
    } else {
        publish_error(http==401 || http==403?TASKS_DENIED:TASKS_FAILED,true);
        next_page=esp_timer_get_time()+10000000LL;
        ESP_LOGW(TAG,"Tasks unavailable: HTTP %d",http);
    }
    free(page);cJSON_Delete(json);free(response.data);
}
static void submit(const char *token) {
    char path[96],body[80];snprintf(path,sizeof(path),"task-instances/%s/submit",pending.task_id);
    snprintf(body,sizeof(body),"{\"requestId\":\"%s\"}",pending.request_id);
    response_t response={0};int http=request(token,path,body,&response);
    cJSON *json=response.data?cJSON_Parse(response.data):NULL;
    checkin_result_t result={.state=CHECKIN_UNKNOWN};strlcpy(result.task_id,pending.task_id,sizeof(result.task_id));
    bool definitive=false;
    if(http==200 && cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(json,"success")) && status_value(json,&result.status) && number(json,"credits",&result.credits,INT_MAX)) {
        result.state=CHECKIN_OK;result.awarded=cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(json,"awarded"));definitive=true;
    } else if(http==409 || http==404) {
        const cJSON *code=cJSON_GetObjectItemCaseSensitive(json,"code");
        if(cJSON_IsString(code)) {
            if(!strcmp(code->valuestring,"not_today")) {result.state=CHECKIN_EXPIRED;definitive=true;}
            else if(!strcmp(code->valuestring,"task_unavailable")) {result.state=CHECKIN_UNAVAILABLE;definitive=true;}
            else if(!strcmp(code->valuestring,"request_conflict")) result.state=CHECKIN_CONFLICT;
        }
    } else if(http==401 || http==403)result.state=CHECKIN_DENIED;
    cJSON_Delete(json);free(response.data);
    if(definitive && persist(true)) {
        has_pending=false;atomic_store(&unsettled,false);retry_seconds=5;next_page=0;
        xQueueOverwrite(checkin_results,&result);return;
    }
    if(definitive)result.state=CHECKIN_UNKNOWN;
    xQueueOverwrite(checkin_results,&result);
    next_submit=esp_timer_get_time()+(int64_t)retry_seconds*1000000LL;
    retry_seconds=retry_seconds<30?retry_seconds*2:60;
}
void task_network_init(void) {
    current.state=TASKS_LOADING;
    page_updates=xQueueCreate(1,sizeof(task_page_t));checkin_requests=xQueueCreate(1,sizeof(pending_checkin_t));
    checkin_results=xQueueCreate(1,sizeof(checkin_result_t));refresh_requests=xQueueCreate(1,sizeof(unsigned));
    nvs_handle_t h;if(nvs_open("pet_tasks",NVS_READWRITE,&h)!=ESP_OK) return;
    size_t size=sizeof(pending);esp_err_t e=nvs_get_blob(h,"pending",&pending,&size);nvs_close(h);
    storage_ready=e==ESP_ERR_NVS_NOT_FOUND || (e==ESP_OK && size==sizeof(pending) && pending.format==1 && pending.task_id[36]==0 && pending.request_id[36]==0 && strlen(pending.task_id)==36 && strlen(pending.request_id)==36);
    has_pending=e==ESP_OK && storage_ready;atomic_store(&unsettled,has_pending);
}
bool task_request_checkin(const char *id) {
    if(!checkin_requests || !storage_ready || !id || strlen(id)!=36 || atomic_exchange(&unsettled,true))return false;
    pending_checkin_t value={.format=1};strlcpy(value.task_id,id,sizeof(value.task_id));
    uint8_t b[16];esp_fill_random(b,sizeof(b));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    snprintf(value.request_id,sizeof(value.request_id),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);
    if(xQueueSend(checkin_requests,&value,0)==pdTRUE)return true;
    atomic_store(&unsettled,false);return false;
}
void task_network_tick(const char *token,bool online,bool clock_ready) {
    if(!page_updates || !checkin_requests || !checkin_results || !refresh_requests)return;
    if(!has_pending && xQueueReceive(checkin_requests,&pending,0)==pdTRUE) {
        if(persist(false)) {has_pending=true;next_submit=0;}
        else {atomic_store(&unsettled,false);checkin_result_t result={.state=CHECKIN_SAVE_FAILED};strlcpy(result.task_id,pending.task_id,sizeof(result.task_id));xQueueOverwrite(checkin_results,&result);}
    }
    unsigned offset;bool refresh=xQueueReceive(refresh_requests,&offset,0)==pdTRUE;
    if(refresh) {requested_offset=offset;next_page=0;next_submit=0;}
    if(!online || !clock_ready || strlen(token)!=64) {
        publish_error(strlen(token)==64?TASKS_OFFLINE:TASKS_DENIED,refresh);
        if(has_pending && esp_timer_get_time()>=next_submit) {
            checkin_result_t result={.state=CHECKIN_UNKNOWN};strlcpy(result.task_id,pending.task_id,sizeof(result.task_id));xQueueOverwrite(checkin_results,&result);next_submit=esp_timer_get_time()+10000000LL;
        }
        return;
    }
    if(has_pending && esp_timer_get_time()>=next_submit)submit(token);
    if(esp_timer_get_time()>=next_page)load_page(token);
}
void task_refresh(unsigned offset) {if(refresh_requests)xQueueOverwrite(refresh_requests,&offset);}
bool task_checkin_pending(void) {return atomic_load(&unsettled);}
bool task_take_page(task_page_t *page) {return page_updates && xQueueReceive(page_updates,page,0)==pdTRUE;}
bool task_take_checkin(checkin_result_t *result) {return checkin_results && xQueueReceive(checkin_results,result,0)==pdTRUE;}
