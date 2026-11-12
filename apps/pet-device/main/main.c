#include "ST7789.h"
#include "I2C_Driver.h"
#include "LVGL_Driver.h"
#include "husky_frames.h"
#include "esp_random.h"

#define FRAMES(name) {&husky_##name##_01, &husky_##name##_02, &husky_##name##_03, &husky_##name##_04}
typedef enum { IDLE, EAT, HAPPY, SLEEP, HUNGRY, THIRSTY, DRINK, SLEEPY, LONELY, PET } pet_action_t;
static const lv_img_dsc_t *const frames[][4] = {
    FRAMES(idle), FRAMES(eat), FRAMES(happy), FRAMES(sleep), FRAMES(hungry),
    FRAMES(thirsty), FRAMES(drink), FRAMES(sleepy), FRAMES(lonely), FRAMES(pet)
};
static const pet_action_t needs[] = { HUNGRY, THIRSTY, SLEEPY, LONELY };
static pet_action_t action = IDLE;
static unsigned coins = 30, frame = 0, cycles = 0, need_ticks = 0;
static int last_need = -1;
static lv_obj_t *balance, *pet_image, *menu, *menu_balance, *notice, *sleep_label;

static void set_action(pet_action_t next)
{
    action = next; frame = 0; cycles = 0;
    lv_img_set_src(pet_image, frames[action][frame]);
    lv_label_set_text(sleep_label, action == SLEEP ? "Wake up     FREE" : "Sleep            FREE");
}
static bool menu_open(void) { return !lv_obj_has_flag(menu, LV_OBJ_FLAG_HIDDEN); }
static void animate_pet(lv_timer_t *timer)
{
    (void)timer;
    if (menu_open()) return;
    frame = (frame + 1) % 4;
    if (frame == 0) {
        cycles++;
        if ((action == EAT || action == DRINK || action == PET) && cycles >= 2) { set_action(HAPPY); return; }
        if (action == HAPPY && cycles >= 2) { set_action(IDLE); need_ticks = 0; return; }
    }
    if (action == IDLE || action == HUNGRY || action == THIRSTY || action == SLEEPY || action == LONELY) {
        if (++need_ticks >= 100) {
            unsigned pick = esp_random() % 4;
            if ((int)pick == last_need) pick = (pick + 1 + esp_random() % 3) % 4;
            last_need = (int)pick;
            set_action(needs[pick]); need_ticks = 0; return;
        }
    }
    lv_img_set_src(pet_image, frames[action][frame]);
}
static bool busy(void) { return action == EAT || action == DRINK || action == PET || action == HAPPY; }
static void close_menu(lv_event_t *event) { (void)event; lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN); }
static void show_menu(lv_event_t *event)
{
    (void)event;
    if (busy()) return;
    lv_label_set_text_fmt(menu_balance, "Your credits: %u", coins);
    lv_label_set_text(notice, "Choose an action");
    lv_obj_clear_flag(menu, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(menu);
}
static void spend(lv_event_t *event)
{
    bool water = (bool)(uintptr_t)lv_event_get_user_data(event);
    unsigned cost = water ? 5 : 10;
    if (coins < cost) { lv_label_set_text(notice, "Not enough credits"); return; }
    coins -= cost;
    lv_label_set_text_fmt(balance, "%u credits", coins);
    lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN);
    set_action(water ? DRINK : EAT);
    ESP_LOGI("PET", "%s, credits=%u", water ? "Drink" : "Feed", coins);
}
static void toggle_sleep(lv_event_t *event)
{
    (void)event;
    bool sleeping = action != SLEEP;
    lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN);
    set_action(sleeping ? SLEEP : IDLE); need_ticks = 0;
}
static void play_pet(lv_event_t *event)
{
    (void)event;
    lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN);
    set_action(PET);
}
static lv_obj_t *button(lv_obj_t *parent, int y, const char *text, uint32_t color, lv_event_cb_t cb, void *data)
{
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, 172, 30); lv_obj_set_pos(btn, 5, y);
    lv_obj_set_style_bg_color(btn, lv_color_hex(color), 0);
    lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, data);
    lv_obj_t *label = lv_label_create(btn); lv_label_set_text(label, text); lv_obj_center(label);
    return label;
}
void app_main(void)
{
    I2C_Init(); LCD_Init(); LVGL_Init();
    lv_obj_t *screen = lv_scr_act();
    lv_obj_set_style_bg_color(screen, lv_color_hex(0xfff7e7), 0);
    lv_obj_t *title = lv_label_create(screen); lv_label_set_text(title, "Keep going!"); lv_obj_align(title, LV_ALIGN_TOP_LEFT, 8, 12);
    balance = lv_label_create(screen); lv_label_set_text_fmt(balance, "%u credits", coins); lv_obj_align(balance, LV_ALIGN_TOP_RIGHT, -8, 12);
    pet_image = lv_img_create(screen); lv_img_set_src(pet_image, frames[IDLE][0]); lv_obj_align(pet_image, LV_ALIGN_CENTER, 0, 8);
    lv_obj_add_flag(pet_image, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(pet_image, show_menu, LV_EVENT_CLICKED, NULL);

    menu = lv_obj_create(screen); lv_obj_set_size(menu, 210, 244); lv_obj_center(menu);
    lv_obj_clear_flag(menu, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(menu, lv_color_hex(0xfffdf7), 0);
    lv_obj_set_style_radius(menu, 14, 0); lv_obj_set_style_border_width(menu, 1, 0);
    lv_obj_set_style_pad_all(menu, 12, 0);
    menu_balance = lv_label_create(menu); lv_obj_set_pos(menu_balance, 5, 0);
    notice = lv_label_create(menu); lv_obj_set_pos(notice, 5, 20);
    button(menu, 42, "Feed             10", 0x728e62, spend, (void *)(uintptr_t)0);
    button(menu, 76, "Water              5", 0x658faa, spend, (void *)(uintptr_t)1);
    sleep_label = button(menu, 110, "Sleep            FREE", 0x8797ac, toggle_sleep, NULL);
    button(menu, 144, "Pet                FREE", 0xc58574, play_pet, NULL);
    button(menu, 178, "Close", 0x89918c, close_menu, NULL);
    lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN);
    lv_timer_create(animate_pet, 300, NULL);
    while (1) { vTaskDelay(pdMS_TO_TICKS(10)); lv_timer_handler(); }
}
