#include "tasks_ui.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static bool pending;static unsigned requests,refreshes,offset;static char task_id[37];
static lv_color_t pixels[240*320],buffer_pixels[240*20];static const char *output;
bool task_checkin_pending(void) {return pending;}
bool task_request_checkin(const char *id) {if(pending)return false;pending=true;requests++;snprintf(task_id,sizeof(task_id),"%s",id);return true;}
void task_refresh(unsigned value) {refreshes++;offset=value;}
static void flush(lv_disp_drv_t *driver,const lv_area_t *area,lv_color_t *data) {
    unsigned width=lv_area_get_width(area);
    for(int y=area->y1;y<=area->y2;y++)memcpy(pixels+y*240+area->x1,data+(y-area->y1)*width,width*sizeof(*data));
    lv_disp_flush_ready(driver);
}
static lv_obj_t *find(lv_obj_t *parent,const char *value) {
    if(lv_obj_check_type(parent,&lv_label_class) && !strcmp(lv_label_get_text(parent),value))return parent;
    for(unsigned i=0;i<lv_obj_get_child_cnt(parent);i++){lv_obj_t *f=find(lv_obj_get_child(parent,i),value);if(f)return f;}
    return NULL;
}
static lv_obj_t *get(const char *value) {lv_obj_t *o=find(lv_scr_act(),value);if(!o){fprintf(stderr,"Missing: %s\n",value);abort();}return o;}
static void click(const char *value) {lv_event_send(lv_obj_get_parent(get(value)),LV_EVENT_CLICKED,NULL);}
static void tick(void) {lv_tick_inc(260);lv_timer_handler();lv_refr_now(NULL);}
static void capture(const char *name) {
    tick();char path[512];snprintf(path,sizeof(path),"%s/%s.ppm",output,name);FILE *f=fopen(path,"wb");assert(f);fprintf(f,"P6\n240 320\n255\n");
    for(unsigned i=0;i<240*320;i++){unsigned v=pixels[i].full;unsigned char rgb[]={((v>>11)&31)*255/31,((v>>5)&63)*255/63,(v&31)*255/31};fwrite(rgb,1,3,f);}fclose(f);
}
int main(int argc,char **argv) {
    assert(argc==2);output=argv[1];lv_init();lv_disp_draw_buf_t buf;lv_disp_draw_buf_init(&buf,buffer_pixels,NULL,240*20);
    lv_disp_drv_t driver;lv_disp_drv_init(&driver);driver.hor_res=240;driver.ver_res=320;driver.draw_buf=&buf;driver.flush_cb=flush;lv_disp_drv_register(&driver);
    tasks_ui_init(lv_scr_act());capture("tasks-home");click("Today");assert(tasks_ui_is_open() && refreshes==1);get("Loading tasks...");
    task_page_t page={.state=TASKS_READY,.count=3,.total=13,.completed=1};strcpy(page.date,"2026-11-13");strcpy(page.child_id,"11111111-1111-4111-8111-111111111111");
    for(unsigned i=0;i<3;i++){snprintf(page.items[i].id,37,"22222222-2222-4222-8222-%012u",i);page.items[i].reward=3;}
    strcpy(page.items[0].title,"自主阅读绘本十五分钟");strcpy(page.items[0].description,"读完后和家长分享一个喜欢的故事。每天坚持一点点，你会越来越棒！");page.items[0].parent_confirm=true;
    strcpy(page.items[1].title,"Drink water");page.items[1].status=TASK_COMPLETED;
    strcpy(page.items[2].title,"整理书桌和学习用品，再认真检查一遍，完成后记得打卡哦");page.items[2].status=TASK_REJECTED;strcpy(page.items[2].reason,"加油！再整理一下就好啦！");
    tasks_ui_page(&page);capture("tasks-list");
    click(LV_SYMBOL_LEFT);assert(!tasks_ui_is_open());click("Today");
    tick();get("2026-11-13  Updating...");get(page.items[0].title);
    click(page.items[0].title);get("+3 credits / Parent confirms");
    assert(lv_obj_has_state(lv_obj_get_parent(get("Updating...")),LV_STATE_DISABLED));
    page.state=TASKS_OFFLINE;tasks_ui_page(&page);
    get("2026-11-13  Offline (cached)");get(page.items[0].title);
    assert(lv_obj_has_state(lv_obj_get_parent(get("Connect to complete")),LV_STATE_DISABLED));
    page.state=TASKS_READY;tasks_ui_page(&page);get("Complete task");capture("tasks-detail");
    click("Complete task");assert(requests==1 && pending && !strcmp(task_id,page.items[0].id));get("Confirming check-in...");
    assert(lv_obj_has_state(lv_obj_get_parent(get("Confirming check-in...")),LV_STATE_DISABLED));capture("tasks-submitting");
    checkin_result_t result={.state=CHECKIN_UNKNOWN};strcpy(result.task_id,task_id);tasks_ui_result(&result);get("Saved. Waiting for network...");
    page.state=TASKS_OFFLINE;tasks_ui_page(&page);get("2026-11-13  Offline (cached)");get(page.items[0].title);capture("tasks-offline");
    page.state=TASKS_READY;page.items[0].status=TASK_SUBMITTED;pending=false;tasks_ui_page(&page);
    result.state=CHECKIN_OK;result.status=TASK_SUBMITTED;tasks_ui_result(&result);get("Waiting for parent");capture("tasks-waiting");
    page.items[0].status=TASK_COMPLETED;page.completed=2;tasks_ui_page(&page);get("Completed");capture("tasks-completed");
    click(LV_SYMBOL_LEFT);click("+3 cr  Try again");get("Try again / Complete");get("加油!再整理一下就好啦!");capture("tasks-rejected");
    click(LV_SYMBOL_LEFT);click(LV_SYMBOL_RIGHT);assert(offset==10);get("Loading tasks...");
    page.offset=10;page.count=0;page.total=10;tasks_ui_page(&page);lv_event_send(lv_obj_get_child(lv_obj_get_child(lv_scr_act(),-1),5),LV_EVENT_CLICKED,NULL);assert(offset==0);
    page.offset=0;page.count=0;page.total=0;page.completed=0;tasks_ui_page(&page);get("No tasks today.\nAsk your parent to add one.");capture("tasks-empty");
    page.state=TASKS_FAILED;tasks_ui_page(&page);get("2026-11-13  Sync failed (cached)");capture("tasks-error");
    page.state=TASKS_DENIED;tasks_ui_page(&page);get("Select child / pair in Settings");assert(!find(lv_scr_act(),page.items[0].title));
    click(LV_SYMBOL_LEFT);assert(!tasks_ui_is_open());tasks_ui_home_visible(false);assert(lv_obj_has_flag(lv_obj_get_parent(get("Today")),LV_OBJ_FLAG_HIDDEN));
    tasks_ui_home_visible(true);assert(!lv_obj_has_flag(lv_obj_get_parent(get("Today")),LV_OBJ_FLAG_HIDDEN));
    puts("Tasks UI passed: Chinese titles/details, paging, pending lock, offline retry, parent confirmation, rejection, completion, empty/error states.");
}
