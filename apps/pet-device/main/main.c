#include "ST7789.h"
#include "I2C_Driver.h"
#include "LVGL_Driver.h"
#include "husky_frames.h"

static const lv_img_dsc_t *const frames[][4] = {
    {&husky_idle_01, &husky_idle_02, &husky_idle_03, &husky_idle_04},
    {&husky_eat_01, &husky_eat_02, &husky_eat_03, &husky_eat_04},
    {&husky_happy_01, &husky_happy_02, &husky_happy_03, &husky_happy_04},
    {&husky_sleep_01, &husky_sleep_02, &husky_sleep_03, &husky_sleep_04},
};
typedef enum { IDLE, EAT, HAPPY, SLEEP } pet_action_t;
static pet_action_t action = IDLE;
static unsigned coins = 30, frame = 0, cycles = 0;
static lv_obj_t *balance, *message, *pet_image, *sleep_label;

static void set_action(pet_action_t next)
{
    action = next; frame = 0; cycles = 0;
    lv_img_set_src(pet_image, frames[action][frame]);
    lv_label_set_text(sleep_label, action == SLEEP ? "Wake up" : "Sleep");
}

static void animate_pet(lv_timer_t *timer)
{
    (void)timer;
    frame = (frame + 1) % 4;
    if (frame == 0) {
        cycles++;
        if (action == EAT && cycles >= 2) { set_action(HAPPY); return; }
        if (action == HAPPY && cycles >= 2) { set_action(IDLE); lv_label_set_text(message, "Hello, friend!"); return; }
    }
    lv_img_set_src(pet_image, frames[action][frame]);
}

static void feed(lv_event_t *event)
{
    (void)event;
    if (action == EAT || action == HAPPY) return;
    if (coins >= 10) {
        coins -= 10;
        lv_label_set_text_fmt(balance, "Coins: %u", coins);
        lv_label_set_text(message, "Yummy! Thank you!");
        set_action(EAT);
        ESP_LOGI("PET", "Feed accepted, coins=%u", coins);
    } else {
        lv_label_set_text(message, "Not enough coins");
        ESP_LOGI("PET", "Feed rejected: insufficient coins");
    }
}

static void toggle_sleep(lv_event_t *event)
{
    (void)event;
    if (action == EAT || action == HAPPY) return;
    bool sleeping = action != SLEEP;
    set_action(sleeping ? SLEEP : IDLE);
    lv_label_set_text(message, sleeping ? "Good night!" : "Hello, friend!");
}

void app_main(void)
{
    I2C_Init(); LCD_Init(); LVGL_Init();
    lv_obj_t *screen = lv_scr_act();
    lv_obj_set_style_bg_color(screen, lv_color_hex(0xfff7e7), 0);
    lv_obj_t *title = lv_label_create(screen);
    lv_label_set_text(title, "STUDY PET");
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 12);
    balance = lv_label_create(screen);
    lv_label_set_text_fmt(balance, "Coins: %u", coins);
    lv_obj_align(balance, LV_ALIGN_TOP_MID, 0, 38);
    pet_image = lv_img_create(screen);
    lv_obj_align(pet_image, LV_ALIGN_TOP_MID, 0, 65);
    lv_img_set_src(pet_image, frames[IDLE][0]);
    message = lv_label_create(screen);
    lv_label_set_text(message, "Hello, friend!");
    lv_obj_align(message, LV_ALIGN_TOP_MID, 0, 210);

    lv_obj_t *feed_btn = lv_btn_create(screen);
    lv_obj_set_size(feed_btn, 100, 48);
    lv_obj_align(feed_btn, LV_ALIGN_BOTTOM_LEFT, 15, -20);
    lv_obj_set_style_bg_color(feed_btn, lv_color_hex(0x728e62), 0);
    lv_obj_add_event_cb(feed_btn, feed, LV_EVENT_CLICKED, NULL);
    lv_obj_t *label = lv_label_create(feed_btn);
    lv_label_set_text(label, "Feed -10"); lv_obj_center(label);

    lv_obj_t *sleep_btn = lv_btn_create(screen);
    lv_obj_set_size(sleep_btn, 100, 48);
    lv_obj_align(sleep_btn, LV_ALIGN_BOTTOM_RIGHT, -15, -20);
    lv_obj_set_style_bg_color(sleep_btn, lv_color_hex(0x8797ac), 0);
    lv_obj_add_event_cb(sleep_btn, toggle_sleep, LV_EVENT_CLICKED, NULL);
    sleep_label = lv_label_create(sleep_btn);
    lv_label_set_text(sleep_label, "Sleep"); lv_obj_center(sleep_label);
    lv_timer_create(animate_pet, 300, NULL);
    while (1) { vTaskDelay(pdMS_TO_TICKS(10)); lv_timer_handler(); }
}
