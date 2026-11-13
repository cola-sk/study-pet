#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "nvs.h"
#include "pet_behavior.h"
#include "display_power.h"

static int64_t monotonic_us;
static time_t wall;
static unsigned char disk[512], staged[512];
static size_t disk_size, staged_size;
static uint32_t disk_timeout=120, staged_timeout;
static bool fail_save;
uint8_t LCD_Backlight=70;
static unsigned brightness=70, backlight_changes;
int64_t esp_timer_get_time(void) { return monotonic_us; }
void Set_Backlight(uint8_t value) { brightness=value; backlight_changes++; }
void test_log(const char *tag,const char *format,...) { (void)tag; (void)format; }
static time_t test_time(time_t *out) { if(out)*out=wall; return wall; }
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *out) { (void)mode; *out=!strcmp(name,"pet_behavior")?1:2; return ESP_OK; }
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *out,size_t *size) { (void)h;(void)key; if(!disk_size || *size<disk_size)return ESP_FAIL; memcpy(out,disk,disk_size);*size=disk_size;return ESP_OK; }
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *in,size_t size) { (void)h;(void)key;assert(size<=sizeof(staged));memcpy(staged,in,size);staged_size=size;return ESP_OK; }
esp_err_t nvs_get_u32(nvs_handle_t h,const char *key,uint32_t *out) { (void)h;(void)key;*out=disk_timeout;return ESP_OK; }
esp_err_t nvs_set_u32(nvs_handle_t h,const char *key,uint32_t value) { (void)h;(void)key;staged_timeout=value;return ESP_OK; }
esp_err_t nvs_commit(nvs_handle_t h) { if(fail_save)return ESP_FAIL; if(h==1){memcpy(disk,staged,staged_size);disk_size=staged_size;}else disk_timeout=staged_timeout;return ESP_OK; }
void nvs_close(nvs_handle_t h) { (void)h; }
#define time test_time
#include "../../main/pet_behavior.c"
#undef time
#include "../../main/display_power.c"
static void pass(unsigned seconds) { monotonic_us+=(int64_t)seconds*1000000; if(wall)wall+=seconds;pet_behavior_tick(); }
static int64_t at(unsigned hour,unsigned minute) { return 1794499200LL+hour*3600+minute*60; }
int main(void)
{
    wall=at(15,10); pet_behavior_init();
    pass(7200); // scheduled nap at 17:10
    assert(pet_behavior_mood()==PET_SLEEPING);
    pass(50*60);assert(pet_behavior_mood()==PET_THIRSTY);
    pet_behavior_care(PET_CARE_WATER);
    assert(pet_behavior_mood()==PET_IDLE);
    monotonic_us=0;pet_behavior_init(); // power-cycle immediately after drinking
    assert(pet_behavior_mood()==PET_IDLE);
    pass(60);assert(pet_behavior_mood()!=PET_THIRSTY);
    wall+=4*3600;monotonic_us=0;pet_behavior_init(); // powered-off time counts
    assert(pet_behavior_mood()==PET_SLEEPING);
    pet_behavior_toggle_sleep();assert(pet_behavior_mood()==PET_THIRSTY);
    pet_behavior_care(PET_CARE_WATER);
    // NTP rollback cannot turn a fresh drink into a thirst request.
    wall-=3600;pass(60);assert(pet_behavior_mood()!=PET_THIRSTY);
    // If the clock is not ready at boot, retain care history and do not guess bedtime.
    wall=0;monotonic_us=0;pet_behavior_init();pass(60);
    pet_behavior_care(PET_CARE_WATER); // fresh action before NTP recovery
    wall=at(20,0);pet_behavior_tick();assert(pet_behavior_mood()!=PET_THIRSTY);
    // Switching child clears inherited needs.
    pet_behavior_bind_child("11111111-1111-4111-8111-111111111111");
    pass(7200);pet_behavior_bind_child("22222222-2222-4222-8222-222222222222");
    pet_behavior_toggle_sleep();assert(pet_behavior_mood()!=PET_THIRSTY);
    // Corrupt storage is ignored and never used as unbounded counters.
    disk[0]=255;monotonic_us=0;wall=at(16,0);pet_behavior_init();assert(pet_behavior_mood()==PET_IDLE);
    fail_save=true;pet_behavior_care(PET_CARE_WATER);assert(dirty);
    fail_save=false;pass(5);assert(!dirty);

    monotonic_us=0;display_power_init();assert(display_power_timeout()==120);
    monotonic_us=120000000;display_power_tick();assert(brightness==0 && display_power_is_asleep());
    unsigned changes=backlight_changes;
    display_power_tick();assert(backlight_changes==changes); // no repeated writes
    assert(!display_power_filter_touch(true) && brightness==70);
    assert(!display_power_filter_touch(true));assert(!display_power_filter_touch(false));
    assert(display_power_filter_touch(true));display_power_filter_touch(false);
    fail_save=true;assert(!display_power_set_timeout(300));assert(display_power_timeout()==120);
    fail_save=false;assert(display_power_set_timeout(300));display_power_init();assert(display_power_timeout()==300);
    assert(!display_power_set_timeout(7));assert(display_power_set_timeout(0));
    monotonic_us+=86400000000LL;display_power_tick();assert(!display_power_is_asleep());
    disk_timeout=999;display_power_init();assert(display_power_timeout()==120);
    puts("Care storage/reboot, delayed/rolled-back clocks, child reassignment, failed-save retry, screen setting persistence and wake suppression passed.");
}
