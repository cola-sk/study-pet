#include "settings_ui.h"
#include "wifi_manager.h"
#include "wifi_credentials.h"
#include "display_power.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

static pet_wifi_snapshot_t snapshot = {.state=PET_WIFI_CONNECTED,.configured=true,.ssid="S26"};
static unsigned scan_calls, connect_calls, cancel_calls, sync_calls, pair_calls;
static bool paired=true;
static uint32_t screen_timeout=120;
static bool fail_screen_save;
uint32_t display_power_timeout(void) { return screen_timeout; }
bool display_power_set_timeout(uint32_t seconds) { if(fail_screen_save)return false; screen_timeout=seconds; return true; }
static char requested_ssid[33], requested_password[65];
static lv_color_t pixels[240*320], buffer_pixels[240*20];
static const char *output;
void wifi_manager_snapshot(pet_wifi_snapshot_t *out) { *out=snapshot; }
bool wifi_manager_scan(void) { scan_calls++;snapshot.scanning=true;return true; }
bool wifi_manager_connect(const char *ssid,const char *password) {
    connect_calls++;snprintf(requested_ssid,sizeof(requested_ssid),"%s",ssid);snprintf(requested_password,sizeof(requested_password),"%s",password);
    snapshot.attempt_id++;snapshot.attempt=PET_WIFI_ATTEMPT_CONNECTING;return true;
}
void wifi_manager_cancel(void) { cancel_calls++;snapshot.attempt=PET_WIFI_ATTEMPT_CANCELLED; }
bool network_business_enabled(void) { return paired; }
bool network_refresh_wallet(void) { sync_calls++;return true; }
static void pair_callback(void) { pair_calls++; }
static void flush(lv_disp_drv_t *driver,const lv_area_t *area,lv_color_t *data) {
    unsigned width=lv_area_get_width(area);
    for(int y=area->y1;y<=area->y2;y++) memcpy(pixels+y*240+area->x1,data+(y-area->y1)*width,width*sizeof(*data));
    lv_disp_flush_ready(driver);
}
static lv_obj_t *find_text(lv_obj_t *parent,const char *value) {
    if(lv_obj_check_type(parent,&lv_label_class) && !strcmp(lv_label_get_text(parent),value)) return parent;
    for(unsigned i=0;i<lv_obj_get_child_cnt(parent);i++) { lv_obj_t *found=find_text(lv_obj_get_child(parent,i),value);if(found)return found; }
    return NULL;
}
static void dump_text(lv_obj_t *p) { if(lv_obj_check_type(p,&lv_label_class)) fprintf(stderr,"UI: %s\n",lv_label_get_text(p)); for(unsigned i=0;i<lv_obj_get_child_cnt(p);i++)dump_text(lv_obj_get_child(p,i)); }
static lv_obj_t *get_text(const char *value) { lv_obj_t *obj=find_text(lv_scr_act(),value);if(!obj){fprintf(stderr,"Missing UI text: %s\n",value);dump_text(lv_scr_act());abort();}return obj; }
static void click(const char *value) { lv_obj_t *obj=lv_obj_get_parent(get_text(value));lv_event_send(obj,LV_EVENT_CLICKED,NULL); }
static void tick(void) { lv_tick_inc(260);lv_timer_handler();lv_refr_now(NULL); }
static void capture(const char *name) {
    tick();char path[512];snprintf(path,sizeof(path),"%s/%s.ppm",output,name);FILE *file=fopen(path,"wb");assert(file);
    fprintf(file,"P6\n240 320\n255\n");
    for(unsigned i=0;i<240*320;i++) { unsigned v=pixels[i].full;unsigned char rgb[]={((v>>11)&31)*255/31,((v>>5)&63)*255/63,(v&31)*255/31};fwrite(rgb,1,3,file); }fclose(file);
}
static lv_obj_t *textarea(unsigned wanted) {
    lv_obj_t *root=lv_obj_get_child(lv_scr_act(),-1);
    for(unsigned i=0;i<lv_obj_get_child_cnt(root);i++) { lv_obj_t *obj=lv_obj_get_child(root,i);if(lv_obj_check_type(obj,&lv_textarea_class) && wanted--==0)return obj; }
    abort();
}
static lv_obj_t *get_keyboard(void) {
    lv_obj_t *root=lv_obj_get_child(lv_scr_act(),-1);
    for(unsigned i=0;i<lv_obj_get_child_cnt(root);i++) {lv_obj_t *obj=lv_obj_get_child(root,i);if(lv_obj_check_type(obj,&lv_keyboard_class))return obj;}
    abort();
}
int main(int argc,char **argv) {
    assert(argc==2);output=argv[1];
    assert(pet_wifi_credentials_valid("Open network",""));
    assert(!pet_wifi_credentials_valid("","12345678"));
    assert(!pet_wifi_credentials_valid("Test","short"));
    assert(pet_wifi_credentials_valid("12345678901234567890123456789012","12345678"));
    assert(!pet_wifi_credentials_valid("123456789012345678901234567890123","12345678"));
    assert(pet_wifi_credentials_valid("PSK","0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"));
    assert(!pet_wifi_credentials_valid("PSK","zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"));
    lv_init();lv_disp_draw_buf_t buffer;lv_disp_draw_buf_init(&buffer,buffer_pixels,NULL,240*20);
    lv_disp_drv_t driver;lv_disp_drv_init(&driver);driver.hor_res=240;driver.ver_res=320;driver.draw_buf=&buffer;driver.flush_cb=flush;lv_disp_drv_register(&driver);
    settings_ui_init(lv_scr_act(),"PET-TEST","1.0-test",pair_callback);
    assert(!settings_ui_is_open());settings_ui_open();
    network_wallet_update_t wallet={.state=WALLET_READY,.credits=42};settings_ui_wallet_update(&wallet);
    get_text("42 credits");capture("settings");click("Sync now");assert(sync_calls==1);
    assert(lv_obj_has_state(lv_obj_get_parent(get_text("Sync now")),LV_STATE_DISABLED));
    wallet.credits=43;wallet.manual=true;settings_ui_wallet_update(&wallet);get_text("43 credits");
    assert(!lv_obj_has_state(lv_obj_get_parent(get_text("Sync now")),LV_STATE_DISABLED));
    click("Wi-Fi");assert(scan_calls==1);get_text("Scanning nearby\n2.4 GHz networks...");
    snapshot.scanning=false;snapshot.count=2;
    snapshot.networks[0]=(pet_wifi_ap_t){.ssid="Test Wi-Fi",.secured=true,.supported=true,.rssi=-40};
    snapshot.networks[1]=(pet_wifi_ap_t){.ssid="Guest",.supported=true,.rssi=-70};
    tick();get_text("Guest");capture("wifi-list");
    click("Test Wi-Fi");lv_obj_t *password=textarea(1);assert(lv_textarea_get_password_mode(password));
    tick();lv_area_t keyboard_area;lv_obj_get_coords(get_keyboard(),&keyboard_area);assert(keyboard_area.y1==194 && keyboard_area.y2==319);
    assert(lv_keyboard_get_textarea(get_keyboard())==password);
    lv_event_send(textarea(0),LV_EVENT_CLICKED,NULL);assert(lv_keyboard_get_textarea(get_keyboard())==textarea(0));
    lv_event_send(password,LV_EVENT_CLICKED,NULL);assert(lv_keyboard_get_textarea(get_keyboard())==password);
    lv_textarea_set_text(password,"short");click("Connect");assert(connect_calls==0);get_text("Password: 8-63 chars");
    lv_textarea_set_text(password,"test-password");capture("join-hidden");click("Show");assert(!lv_textarea_get_password_mode(password));
    click("Hide");assert(lv_textarea_get_password_mode(password));
    bool typed=false;
    for(unsigned key=0;;key++) {
        const char *caption=lv_btnmatrix_get_btn_text(get_keyboard(),key);if(!caption)break;
        if(!strcmp(caption,"x")) {lv_btnmatrix_set_selected_btn(get_keyboard(),key);lv_event_send(get_keyboard(),LV_EVENT_VALUE_CHANGED,NULL);typed=true;break;}
    }
    assert(typed && !strcmp(lv_textarea_get_text(password),"test-passwordx"));lv_textarea_del_char(password);
    click("Connect");assert(connect_calls==1 && !strcmp(requested_ssid,"Test Wi-Fi") && !strcmp(requested_password,"test-password"));
    get_text("Cancel");capture("connecting");snapshot.attempt=PET_WIFI_ATTEMPT_FAILED;tick();get_text("Try again");capture("connection-failed");
    click("Try again");assert(!strcmp(lv_textarea_get_text(textarea(1)),""));
    lv_textarea_set_text(textarea(1),"test-password");click("Connect");click("Cancel");assert(cancel_calls==1);
    click("Manual");lv_textarea_set_text(textarea(0),"Hidden network");lv_textarea_set_text(textarea(1),"new-password");click("Connect");
    assert(!strcmp(requested_ssid,"Hidden network"));snapshot.attempt=PET_WIFI_ATTEMPT_SAVED;tick();get_text("Back to Settings");capture("connected");
    click("Back to Settings");get_text("Settings");
    click("Screen");get_text("2 minutes");capture("screen");
    click("5 minutes");assert(screen_timeout==300);
    assert(lv_obj_has_state(lv_obj_get_parent(get_text("5 minutes")),LV_STATE_CHECKED));
    fail_screen_save=true;click("Never");assert(screen_timeout==300);get_text("Save failed. Please try again.");
    fail_screen_save=false;click("Never");assert(screen_timeout==0);
    click("1 minute");assert(screen_timeout==60);click(LV_SYMBOL_LEFT);get_text("1 minute");
    strcpy(wallet.device_alias,"Desk pet");settings_ui_wallet_update(&wallet);
    click("Device");get_text("Family paired");get_text("Desk pet");capture("device");
    // Unlink while this page is already open: the pairing button must appear.
    paired=false;tick();click("Enter family code");assert(pair_calls==1);click(LV_SYMBOL_LEFT);click(LV_SYMBOL_LEFT);assert(!settings_ui_is_open());
    snapshot.configured=false;snapshot.state=PET_WIFI_UNCONFIGURED;snapshot.ssid[0]=0;
    settings_ui_init(lv_scr_act(),"PET-TEST","1.0-test",pair_callback);assert(settings_ui_is_open());get_text("Wi-Fi / 2.4 GHz");
    printf("Settings UI passed: sync, scan, manual SSID, password visibility/validation, cancel/retry/success, pairing, first-boot Wi-Fi.\n");return 0;
}
