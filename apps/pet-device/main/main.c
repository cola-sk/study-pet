#include "ST7789.h"
#include "I2C_Driver.h"
#include "LVGL_Driver.h"
#include "husky_frames.h"
#include "esp_random.h"
#include "network.h"

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
static bool wallet_notice = false;
static bool refresh_pending = false, refresh_feedback = false;
static uint32_t refresh_feedback_at;
static lv_obj_t *balance_button, *refresh_hint;
static lv_obj_t *balance, *pet_image, *buttons[4], *notice, *sleep_label, *pair_button, *pair_screen, *pair_input;

static void set_action(pet_action_t next)
{
    action = next; frame = next == SLEEPY ? 1 : 0; cycles = 0;
    lv_img_set_src(pet_image, frames[action][frame]);
    lv_label_set_text(sleep_label, action == SLEEP ? "Wake\nFREE" : "Sleep\nFREE");
}
static bool is_need(pet_action_t a) { return a == HUNGRY || a == THIRSTY || a == SLEEPY || a == LONELY; }
static bool menu_open(void) { return !lv_obj_has_flag(buttons[0], LV_OBJ_FLAG_HIDDEN); }
static void set_menu(bool open) {
    for (unsigned i = 0; i < 4; i++) {
        if (open) lv_obj_clear_flag(buttons[i], LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(buttons[i], LV_OBJ_FLAG_HIDDEN);
    }
    if (!wallet_notice) lv_obj_add_flag(notice, LV_OBJ_FLAG_HIDDEN);
}
static void animate_pet(lv_timer_t *timer)
{
    (void)timer;
    if (menu_open()) return;
    if (!is_need(action)) frame = (frame + 1) % 4;
    if (!is_need(action) && frame == 0) {
        cycles++;
        if ((action == EAT || action == DRINK || action == PET) && cycles >= 2) { set_action(HAPPY); return; }
        if (action == HAPPY && cycles >= 2) { set_action(IDLE); need_ticks = 0; return; }
    }
    if (action == IDLE || is_need(action)) {
        if (is_need(action) && need_ticks > 0 && need_ticks % 4 == 0) {
            unsigned base = action == SLEEPY ? 1 : 0;
            frame = base + (frame == base ? 1 : 0);
        }
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
static void show_menu(lv_event_t *event)
{
    (void)event;
    if (busy()) return;
    set_menu(!menu_open());
}
static void spend(lv_event_t *event)
{
    if (network_business_enabled()) { lv_label_set_text(notice, "Shop unavailable"); lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN); return; }
    bool water = (bool)(uintptr_t)lv_event_get_user_data(event);
    unsigned cost = water ? 5 : 10;
    if (coins < cost) { lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN); return; }
    coins -= cost;
    lv_label_set_text_fmt(balance, "%u credits", coins);
    set_menu(false);
    set_action(water ? DRINK : EAT);
    ESP_LOGI("PET", "%s, credits=%u", water ? "Drink" : "Feed", coins);
}
static void toggle_sleep(lv_event_t *event)
{
    (void)event;
    bool sleeping = action != SLEEP;
    set_menu(false);
    set_action(sleeping ? SLEEP : IDLE); need_ticks = 0;
}
static void play_pet(lv_event_t *event)
{
    (void)event;
    set_menu(false);
    set_action(PET);
}
static lv_obj_t *button(lv_obj_t *parent, int x, int y, const char *text, uint32_t color, lv_event_cb_t cb, void *data, lv_obj_t **out_button)
{
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, 64, 64); lv_obj_set_pos(btn, x, y);
    lv_obj_set_style_radius(btn, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_set_style_bg_color(btn, lv_color_hex(color), 0);
    lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, data);
    lv_obj_t *label = lv_label_create(btn);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(label);
    *out_button = btn;
    return label;
}
static void pair_keyboard_event(lv_event_t *event)
{
    lv_event_code_t type = lv_event_get_code(event);
    if (type == LV_EVENT_CANCEL) { lv_obj_del(pair_screen); pair_screen = NULL; return; }
    if (type != LV_EVENT_READY) return;
    if (!network_pair_request(lv_textarea_get_text(pair_input))) {
        lv_label_set_text(notice, "Invalid code");
    } else lv_label_set_text(notice, "Connecting...");
    lv_obj_del(pair_screen); pair_screen = NULL;
    lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
}
static void open_pairing(lv_event_t *event)
{
    (void)event;
    if (pair_screen || network_business_enabled()) return;
    set_menu(false);
    pair_screen = lv_obj_create(lv_scr_act());
    lv_obj_set_size(pair_screen, 240, 320); lv_obj_set_pos(pair_screen, 0, 0);
    lv_obj_set_style_pad_all(pair_screen, 0, 0); lv_obj_clear_flag(pair_screen, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t *label = lv_label_create(pair_screen);
    lv_label_set_text(label, "Enter family code (6 digits)");
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 10);
    pair_input = lv_textarea_create(pair_screen);
    lv_obj_set_size(pair_input, 220, 42); lv_obj_align(pair_input, LV_ALIGN_TOP_MID, 0, 32);
    lv_textarea_set_one_line(pair_input, true);
    lv_textarea_set_max_length(pair_input, 6);
    lv_textarea_set_accepted_chars(pair_input, "0123456789");
    lv_obj_t *keyboard = lv_keyboard_create(pair_screen);
    lv_obj_set_size(keyboard, 240, 180); lv_obj_align(keyboard, LV_ALIGN_BOTTOM_MID, 0, 0);
    lv_keyboard_set_textarea(keyboard, pair_input);
    lv_keyboard_set_mode(keyboard, LV_KEYBOARD_MODE_NUMBER);
    lv_obj_add_event_cb(keyboard, pair_keyboard_event, LV_EVENT_ALL, NULL);
}
static void refresh_wallet(lv_event_t *event)
{
    (void)event;
    if (refresh_pending) return;
    if (!network_business_enabled()) { open_pairing(NULL); return; }
    if (!network_refresh_wallet()) {
        lv_label_set_text(refresh_hint, "Try again");
        refresh_feedback = true; refresh_feedback_at = lv_tick_get();
        return;
    }
    refresh_pending = true; refresh_feedback = false;
    lv_obj_add_state(balance_button, LV_STATE_DISABLED);
    lv_label_set_text(refresh_hint, "Syncing...");
}
void app_main(void)
{
    I2C_Init(); LCD_Init(); LVGL_Init();
    network_start();
    lv_obj_t *screen = lv_scr_act();
    lv_obj_set_style_bg_color(screen, lv_color_hex(0xfff7e7), 0);
    lv_obj_t *title = lv_label_create(screen); lv_label_set_text(title, "Keep going!"); lv_obj_align(title, LV_ALIGN_TOP_LEFT, 8, 12);
    balance_button = lv_btn_create(screen);
    lv_obj_set_size(balance_button, 112, 36); lv_obj_align(balance_button, LV_ALIGN_TOP_RIGHT, -4, 2);
    lv_obj_set_style_bg_opa(balance_button, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(balance_button, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(balance_button, 0, LV_PART_MAIN);
    lv_obj_set_style_text_color(balance_button, lv_color_hex(0x433c32), LV_PART_MAIN);
    lv_obj_add_event_cb(balance_button, refresh_wallet, LV_EVENT_CLICKED, NULL);
    balance = lv_label_create(balance_button);
    lv_obj_set_width(balance, 108); lv_label_set_long_mode(balance, LV_LABEL_LONG_SCROLL_CIRCULAR);
    lv_obj_set_style_text_align(balance, LV_TEXT_ALIGN_RIGHT, 0);
    if (network_business_enabled()) { coins = 0; lv_label_set_text(balance, "-- credits"); }
    else { lv_label_set_text_fmt(balance, "%u credits", coins); }
    lv_obj_align(balance, LV_ALIGN_TOP_RIGHT, -4, 0);
    refresh_hint = lv_label_create(balance_button); lv_label_set_text(refresh_hint, "Tap to sync");
    lv_obj_align(refresh_hint, LV_ALIGN_BOTTOM_RIGHT, -4, -1);
    pet_image = lv_img_create(screen); lv_img_set_src(pet_image, frames[IDLE][0]); lv_obj_align(pet_image, LV_ALIGN_CENTER, 0, 8);
    lv_obj_add_flag(pet_image, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(pet_image, show_menu, LV_EVENT_CLICKED, NULL);

    button(screen, 88, 39, "Feed\n10 cr", 0x728e62, spend, (void *)(uintptr_t)0, &buttons[0]);
    button(screen, 5, 136, "Water\n5 cr", 0x658faa, spend, (void *)(uintptr_t)1, &buttons[1]);
    sleep_label = button(screen, 171, 136, "Sleep\nFREE", 0x8797ac, toggle_sleep, NULL, &buttons[2]);
    button(screen, 88, 237, "Pet\nFREE", 0xc58574, play_pet, NULL, &buttons[3]);
    pair_button = lv_btn_create(screen);
    lv_obj_set_size(pair_button, 55, 28); lv_obj_align(pair_button, LV_ALIGN_BOTTOM_RIGHT, -4, -4);
    lv_obj_add_event_cb(pair_button, open_pairing, LV_EVENT_CLICKED, NULL);
    lv_obj_t *pair_label = lv_label_create(pair_button); lv_label_set_text(pair_label, "Pair"); lv_obj_center(pair_label);
    if (network_business_enabled()) lv_obj_add_flag(pair_button, LV_OBJ_FLAG_HIDDEN);
    notice = lv_label_create(screen); lv_label_set_text(notice, "Not enough credits");
    lv_obj_align(notice, LV_ALIGN_BOTTOM_MID, 0, -1);
    set_menu(false);
    lv_timer_create(animate_pet, 300, NULL);
    while (1) {
        network_wallet_update_t updated;
        int pairing = network_take_pair_result();
        if (pairing == 1) {
            wallet_notice = true;
            coins = 0; lv_label_set_text(balance, "-- credits");
            lv_label_set_text(notice, "Select child in app");
            lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(pair_button, LV_OBJ_FLAG_HIDDEN);
        } else if (pairing == 2 || pairing == 3) {
            lv_label_set_text(notice, pairing == 2 ? "Code not accepted" : "Network error; retry");
            lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        }
        if (network_take_wallet(&updated)) {
            if (updated.state == WALLET_READY) {
                coins = updated.credits; lv_label_set_text_fmt(balance, "%u credits", coins);
                if (wallet_notice) { lv_obj_add_flag(notice, LV_OBJ_FLAG_HIDDEN); wallet_notice = false; }
            } else if (updated.state != WALLET_SYNC_FAILED) {
                wallet_notice = true;
                lv_label_set_text(balance, "-- credits");
                lv_label_set_text(notice, updated.state == WALLET_WAITING_FOR_CHILD ? "Select child in app" : "Check device in app");
                lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
            }
            if (updated.manual) {
                refresh_pending = false; refresh_feedback = true; refresh_feedback_at = lv_tick_get();
                lv_obj_clear_state(balance_button, LV_STATE_DISABLED);
                lv_label_set_text(refresh_hint, updated.state == WALLET_READY ? "Synced" : updated.state == WALLET_WAITING_FOR_CHILD ? "Pick child" : updated.state == WALLET_UNAUTHORIZED ? "Check pairing" : "Retry sync");
            }
        }
        if (refresh_feedback && lv_tick_elaps(refresh_feedback_at) >= 2500) {
            refresh_feedback = false; lv_label_set_text(refresh_hint, "Tap to sync");
        }
        vTaskDelay(pdMS_TO_TICKS(10)); lv_timer_handler();
    }
}
