#include "display_power.h"
#include "screen_idle.h"
#include "ST7789.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "nvs.h"

static screen_idle_t screen;
static bool ready, backlight_off;
static uint64_t now_ms(void) { return (uint64_t)(esp_timer_get_time() / 1000); }
static bool valid_timeout(uint32_t seconds) { return seconds == 0 || seconds == 60 || seconds == 120 || seconds == 300; }
static void apply(void)
{
    if (backlight_off == screen.asleep) return;
    backlight_off = screen.asleep;
    Set_Backlight(backlight_off ? 0 : LCD_Backlight);
    ESP_LOGI("pet_display", "Screen %s", backlight_off ? "off" : "awake");
}
void display_power_init(void)
{
    uint32_t seconds = 120;
    nvs_handle_t handle;
    if (nvs_open("pet_display", NVS_READWRITE, &handle) == ESP_OK) {
        uint32_t stored;
        if (nvs_get_u32(handle, "timeout", &stored) == ESP_OK && valid_timeout(stored)) seconds = stored;
        nvs_close(handle);
    }
    screen_idle_init(&screen, seconds, now_ms());
    ready = true;
    backlight_off = false;
}
void display_power_tick(void) { if (ready) { screen_idle_tick(&screen, now_ms()); apply(); } }
bool display_power_filter_touch(bool pressed)
{
    if (!ready) return pressed;
    bool accepted = screen_idle_touch(&screen, pressed, now_ms());
    apply();
    return accepted;
}
bool display_power_is_asleep(void) { return ready && screen.asleep; }
uint32_t display_power_timeout(void) { return ready ? screen.timeout_s : 120; }
bool display_power_set_timeout(uint32_t seconds)
{
    if (!ready || !valid_timeout(seconds)) return false;
    nvs_handle_t handle;
    if (nvs_open("pet_display", NVS_READWRITE, &handle) != ESP_OK) return false;
    esp_err_t error = nvs_set_u32(handle, "timeout", seconds);
    if (error == ESP_OK) error = nvs_commit(handle);
    nvs_close(handle);
    if (error != ESP_OK) return false;
    screen_idle_timeout(&screen, seconds, now_ms());
    apply();
    return true;
}
