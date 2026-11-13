#include "platform.h"
#include <assert.h>
#include <setjmp.h>
#include "../../main/wifi_manager.c"

static jmp_buf stopped;
static unsigned step, limit, commits, queued_count, scenario;
static int64_t now;
static EventBits_t event_bits;
static bool fail_commit, auto_ip;
static pet_wifi_credentials_t committed, staged;
static wifi_config_t applied;
static command_t queued[4];
enum { SUCCESS=1, TIMEOUT, CANCEL, SAVE_FAILURE };

size_t strlcpy(char *to,const char *from,size_t n) { size_t size=strlen(from);if(n){size_t copy=size<n-1?size:n-1;memcpy(to,from,copy);to[copy]=0;}return size; }
int nvs_open(const char *name,int mode,nvs_handle_t *handle) { (void)name;(void)mode;*handle=1;return ESP_OK; }
int nvs_get_blob(nvs_handle_t handle,const char *key,void *out,size_t *size) { (void)handle;(void)key;assert(*size==sizeof(committed));memcpy(out,&committed,sizeof(committed));return committed.version?ESP_OK:ESP_FAIL; }
int nvs_set_blob(nvs_handle_t handle,const char *key,const void *data,size_t size) { (void)handle;(void)key;assert(size==sizeof(staged));memcpy(&staged,data,size);return ESP_OK; }
int nvs_commit(nvs_handle_t handle) { (void)handle;if(fail_commit)return ESP_FAIL;committed=staged;commits++;return ESP_OK; }
void nvs_close(nvs_handle_t handle) { (void)handle; }
int64_t esp_timer_get_time(void) { return now; }
QueueHandle_t xQueueCreate(unsigned count,unsigned size) { (void)count;(void)size;return (void *)1; }
int xQueueSend(QueueHandle_t q,const void *value,unsigned ticks) { (void)q;(void)ticks;assert(queued_count<4);queued[queued_count++]=*(const command_t *)value;return pdTRUE; }
int xQueueSendToFront(QueueHandle_t q,const void *value,unsigned ticks) { (void)q;(void)ticks;memmove(queued+1,queued,queued_count*sizeof(*queued));queued[0]=*(const command_t *)value;queued_count++;return pdTRUE; }
void xQueueReset(QueueHandle_t q) { (void)q;queued_count=0; }
int xQueueReceive(QueueHandle_t q,void *out,unsigned ticks) {
    (void)q;(void)ticks;
    if(++step>limit) longjmp(stopped,1);
    now+=1000000;
    if(scenario==CANCEL && step==2) wifi_manager_cancel();
    if(!queued_count)return pdFALSE;
    *(command_t *)out=queued[0];memmove(queued,queued+1,--queued_count*sizeof(*queued));return pdTRUE;
}
EventGroupHandle_t xEventGroupCreate(void) { return (void *)1; }
EventBits_t xEventGroupSetBits(EventGroupHandle_t e,EventBits_t bits) { (void)e;event_bits|=bits;return event_bits; }
EventBits_t xEventGroupClearBits(EventGroupHandle_t e,EventBits_t bits) { (void)e;EventBits_t old=event_bits;event_bits&=~bits;return old; }
EventBits_t xEventGroupWaitBits(EventGroupHandle_t e,EventBits_t bits,int clear,int all,unsigned ticks) { (void)all;(void)ticks;return clear?xEventGroupClearBits(e,bits):event_bits; }
int xTaskCreate(void (*task)(void *),const char *name,unsigned stack,void *arg,unsigned priority,void *handle) { (void)task;(void)name;(void)stack;(void)arg;(void)priority;(void)handle;return pdPASS; }
int esp_wifi_set_config(int iface,const wifi_config_t *config) { (void)iface;applied=*config;return ESP_OK; }
int esp_wifi_connect(void) { if(auto_ip && !strncmp((char *)applied.sta.ssid,"New network",11))event_bits|=WIFI_GOT_IP;return ESP_OK; }
int esp_wifi_disconnect(void) { event_bits|=WIFI_DISCONNECTED;return ESP_OK; }
int esp_wifi_scan_start(const wifi_scan_config_t *scan,bool block) { (void)scan;(void)block;event_bits|=WIFI_SCAN_DONE;return ESP_OK; }
int esp_wifi_scan_stop(void) { return ESP_OK; }
int esp_wifi_clear_ap_list(void) { return ESP_OK; }
int esp_wifi_scan_get_ap_records(uint16_t *count,wifi_ap_record_t *records) {
    *count=4;records[0]=(wifi_ap_record_t){.ssid="One",.authmode=WIFI_AUTH_WPA2_PSK,.rssi=-30};
    records[1]=records[0];records[2]=(wifi_ap_record_t){0};records[3]=(wifi_ap_record_t){.ssid="Guest",.authmode=WIFI_AUTH_OPEN,.rssi=-70};return ESP_OK;
}
int esp_wifi_sta_get_ap_info(wifi_ap_record_t *ap) { memcpy(ap->ssid,applied.sta.ssid,32);ap->ssid[32]=0;return ESP_OK; }
int esp_netif_init(void) { return ESP_OK; }
int esp_event_loop_create_default(void) { return ESP_OK; }
void *esp_netif_create_default_wifi_sta(void) { return (void *)1; }
int esp_wifi_init(const wifi_init_config_t *config) { (void)config;return ESP_OK; }
int esp_wifi_set_storage(int storage) { assert(storage==WIFI_STORAGE_RAM);return ESP_OK; }
int esp_event_handler_register(int base,int id,void (*handler)(void *,int,int,void *),void *arg) { (void)base;(void)id;(void)handler;(void)arg;return ESP_OK; }
int esp_wifi_set_mode(int mode) { (void)mode;return ESP_OK; }
int esp_wifi_start(void) { return ESP_OK; }
static void run(unsigned mode,bool previous) {
    step=commits=queued_count=event_bits=0;now=0;limit=32;scenario=mode;fail_commit=mode==SAVE_FAILURE;auto_ip=mode==SUCCESS||mode==SAVE_FAILURE;
    trial=false;memset(&candidate,0,sizeof(candidate));memset(&snapshot,0,sizeof(snapshot));
    saved=(pet_wifi_credentials_t){.version=1,.ssid="Previous network",.password="old-password"};
    committed=previous?saved:(pet_wifi_credentials_t){0};have_saved=previous;snapshot.configured=previous;snapshot.state=previous?PET_WIFI_CONNECTED:PET_WIFI_UNCONFIGURED;
    commands=(void *)1;events=(void *)1;
    assert(wifi_manager_connect("New network","new-password"));
    if(!setjmp(stopped))manager_task(NULL);
    if(mode==SUCCESS) {
        assert(commits==1 && !strcmp(committed.ssid,"New network") && !strcmp(committed.password,"new-password"));
        assert(snapshot.attempt==PET_WIFI_ATTEMPT_SAVED && snapshot.state==PET_WIFI_CONNECTED && snapshot.configured);
        memset(&saved,0,sizeof(saved));assert(load_saved() && !strcmp(saved.ssid,"New network"));
    } else {
        assert(commits==0);
        assert(previous ? !strcmp(committed.ssid,"Previous network") : !committed.version);
        assert(previous ? !strncmp((char *)applied.sta.ssid,"Previous network",16) : snapshot.state==PET_WIFI_UNCONFIGURED);
        assert(snapshot.attempt==(mode==TIMEOUT?PET_WIFI_ATTEMPT_FAILED:mode==CANCEL?PET_WIFI_ATTEMPT_CANCELLED:PET_WIFI_ATTEMPT_SAVE_FAILED));
    }
    assert(!trial && !candidate.password[0]);
}
int main(void) {
    run(SUCCESS,true);run(SUCCESS,false);run(TIMEOUT,true);run(TIMEOUT,false);run(CANCEL,true);run(CANCEL,false);run(SAVE_FAILURE,true);run(SAVE_FAILURE,false);
    queued_count=0;snapshot.attempt=PET_WIFI_ATTEMPT_NONE;assert(wifi_manager_connect("Queued","12345678"));wifi_manager_cancel();assert(queued_count==1&&queued[0].type==COMMAND_CANCEL);
    pet_wifi_snapshot_t scan={0};collect_scan(&scan);assert(scan.count==2 && !strcmp(scan.networks[0].ssid,"One") && !scan.networks[1].secured);
    printf("Wi-Fi manager passed: save after IP, NVS reload, timeout/cancel/save-failure rollback with and without old network, queued cancellation, scan deduplication.\n");return 0;
}
