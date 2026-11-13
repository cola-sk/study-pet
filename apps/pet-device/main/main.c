#include "ST7789.h"
#include "I2C_Driver.h"
#include "LVGL_Driver.h"
#include "husky_frames.h"
#include "pet_behavior.h"
#include "display_power.h"
#include "network.h"
#include "shop_network.h"
#include "action_layout.h"
#include "pet_image_view.h"
#include "settings_ui.h"
#include "tasks_ui.h"
#include "esp_app_desc.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "nvs.h"
#include <stdio.h>
#include <string.h>
LV_FONT_DECLARE(shop_cjk_font);

#define FRAMES(name) {&husky_##name##_01, &husky_##name##_02, &husky_##name##_03, &husky_##name##_04}
typedef enum { IDLE, EAT, HAPPY, SLEEP, HUNGRY, THIRSTY, DRINK, SLEEPY, LONELY, PET, PLAY, BATH, TREAT, DRESS, ACHIEVEMENT, STRETCH } pet_action_t;
static const lv_img_dsc_t *const frames[][4] = {
    FRAMES(idle), FRAMES(eat), FRAMES(happy), FRAMES(sleep), FRAMES(hungry),
    FRAMES(thirsty), FRAMES(drink), FRAMES(sleepy), FRAMES(lonely), FRAMES(pet),
    FRAMES(play), FRAMES(bath), FRAMES(treat), FRAMES(dress), FRAMES(achievement), FRAMES(stretch)
};
static pet_action_t action = IDLE;
static unsigned coins = 0, server_credits = 0, frame = 0, cycles = 0, expression_ticks = 0, happy_target_cycles = 2;
static bool wallet_notice = false, wallet_known = false;
static char wallet_child[37];
static lv_obj_t *balance_button;
static lv_obj_t *balance, *pet_image, *buttons[12], *labels[12], *prices[12], *notice, *sleep_label, *pair_screen, *pair_input;

static shop_catalog_t latest_catalog, menu_catalog;
static unsigned menu_count = 2;
static bool menu_visible;
static bool menu_waiting_for_catalog;
static void render_menu(void);

typedef struct {
    uint32_t version;
    uint8_t known;
    char child_id[37];
    uint32_t server_credits;
    shop_catalog_t catalog;
} wallet_cache_t;

static void save_wallet_cache(void)
{
    nvs_handle_t handle;
    if (nvs_open("pet_wallet", NVS_READWRITE, &handle) != ESP_OK) return;
    esp_err_t err;
    if (!wallet_known) {
        err = nvs_erase_key(handle, "cache");
        if (err == ESP_ERR_NVS_NOT_FOUND) err = ESP_OK;
    } else {
        wallet_cache_t cache = { .version = 1, .known = 1, .server_credits = server_credits, .catalog = latest_catalog };
        strlcpy(cache.child_id, wallet_child, sizeof(cache.child_id));
        err = nvs_set_blob(handle, "cache", &cache, sizeof(cache));
    }
    if (err == ESP_OK) nvs_commit(handle);
    nvs_close(handle);
}

static void load_wallet_cache(void)
{
    nvs_handle_t handle;
    if (nvs_open("pet_wallet", NVS_READONLY, &handle) != ESP_OK) return;
    wallet_cache_t cache = {0};
    size_t size = sizeof(cache);
    if (nvs_get_blob(handle, "cache", &cache, &size) == ESP_OK && size == sizeof(cache) &&
        cache.version == 1 && cache.known == 1 && cache.child_id[36] == 0) {
        wallet_known = true;
        server_credits = cache.server_credits;
        strlcpy(wallet_child, cache.child_id, sizeof(wallet_child));
        if (cache.catalog.available && cache.catalog.count <= SHOP_LIMIT) latest_catalog = cache.catalog;
        if (wallet_child[0]) pet_behavior_bind_child(wallet_child);
    }
    nvs_close(handle);
}

static void update_balance_ui(void)
{
    unsigned pending = shop_pending_spend();
    coins = server_credits > pending ? server_credits - pending : 0;
    if (balance) {
        if (wallet_known) lv_label_set_text_fmt(balance, "%u cr", coins);
        else lv_label_set_text(balance, "-- cr");
    }
}

static void set_action(pet_action_t next)
{
    static const char *names[] = {"idle", "eat", "happy", "sleep", "hungry", "thirsty", "drink", "sleepy", "lonely", "pet", "play", "bath", "treat", "dress", "achievement", "stretch"};
    if (action != next) ESP_LOGI("pet_ui", "Pet action: %s", names[next]);
    action = next; frame = next == SLEEPY ? 1 : 0; cycles = 0; expression_ticks = 0;
    lv_img_set_src(pet_image, frames[action][frame]);
    if (sleep_label) lv_label_set_text(sleep_label, action == SLEEP ? "Wake" : "Sleep");
}
static bool is_need(pet_action_t a) { return a == HUNGRY || a == THIRSTY || a == SLEEPY || a == LONELY; }
static pet_action_t current_pet_action(void)
{
    static const pet_action_t actions[] = { IDLE, HUNGRY, THIRSTY, SLEEPY, LONELY, SLEEP };
    return actions[pet_behavior_mood()];
}
static bool menu_open(void) { return menu_visible; }
static void set_menu(bool open) {
    menu_visible = open;
    tasks_ui_home_visible(!open);
    menu_waiting_for_catalog = open && !latest_catalog.available;
    if (open) render_menu();
    pet_image_set_menu_open(pet_image, open);
    for (unsigned i = 0; i < 12; i++) {
        if (open && i < menu_count) lv_obj_clear_flag(buttons[i], LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(buttons[i], LV_OBJ_FLAG_HIDDEN);
    }
    if (!wallet_notice) lv_obj_add_flag(notice, LV_OBJ_FLAG_HIDDEN);
}
static bool busy(void) { return action == EAT || action == DRINK || action == PET || action == HAPPY ||
    action == PLAY || action == BATH || action == TREAT || action == DRESS || action == ACHIEVEMENT || action == STRETCH; }
static void animate_pet(lv_timer_t *timer)
{
    (void)timer;
    if (display_power_is_asleep() || menu_open() || settings_ui_is_open() || tasks_ui_is_open()) return;
    // Stretch is a gentle idle gesture; a new need or sleep interrupts it.
    if (action == STRETCH && current_pet_action() != IDLE) set_action(current_pet_action());
    if (!busy()) {
        pet_action_t next = current_pet_action();
        if (action != next) set_action(next);
    }
    if (!is_need(action)) frame = (frame + 1) % 4;
    if (!is_need(action) && frame == 0) {
        cycles++;
        if ((action == EAT || action == DRINK || action == PET || action == PLAY || action == BATH || action == TREAT) && cycles >= 4) { happy_target_cycles = 2; set_action(HAPPY); return; }
        if (action == DRESS && cycles >= 4) { set_action(current_pet_action()); return; }
        if ((action == ACHIEVEMENT || action == STRETCH) && cycles >= 1) { set_action(current_pet_action()); return; }
        if (action == HAPPY && cycles >= happy_target_cycles) { happy_target_cycles = 2; set_action(current_pet_action()); return; }
    }
    static unsigned idle_ticks, next_stretch = 180;
    if (action == IDLE && ++idle_ticks >= next_stretch) {
        idle_ticks = 0; next_stretch = 150 + esp_random() % 151;
        set_action(STRETCH); return;
    }
    if (action == IDLE || is_need(action)) {
        if (is_need(action) && ++expression_ticks % 4 == 0) {
            unsigned base = action == SLEEPY ? 1 : 0;
            frame = base + (frame == base ? 1 : 0);
        }
    }
    lv_img_set_src(pet_image, frames[action][frame]);
}
static void show_menu(lv_event_t *event)
{
    (void)event;
    if (busy()) return;
    set_menu(!menu_open());
    if (!latest_catalog.available && menu_open()) {
        lv_label_set_text(notice, "Loading shop; see Settings"); lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        shop_refresh();
    }
}
static void toggle_sleep(lv_event_t *event)
{
    (void)event;
    set_menu(false);
    pet_behavior_toggle_sleep();
    set_action(current_pet_action());
}
static void play_pet(lv_event_t *event)
{
    (void)event;
    set_menu(false);
    pet_behavior_care(PET_CARE_COMPANY);
    set_action(PET);
}
static void menu_action(lv_event_t *event)
{
    unsigned index = (unsigned)(uintptr_t)lv_event_get_user_data(event);
    if (index == menu_catalog.count) { toggle_sleep(event); return; }
    if (index == menu_catalog.count + 1) { play_pet(event); return; }
    if (index >= menu_catalog.count) return;
    const shop_item_t *item = &menu_catalog.items[index];
    if (!wallet_known) {
        lv_label_set_text(notice, wallet_notice ? "Check device in app" : "Syncing balance...");
        lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        network_refresh_wallet();
        return;
    }
    update_balance_ui();
    if (coins < item->price) {
        lv_label_set_text(notice, "Not enough credits");
        lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    if (!shop_request_purchase(item)) {
        lv_label_set_text(notice, "Syncing purchases...");
        lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        shop_refresh();
        return;
    }
    update_balance_ui();
    network_wallet_update_t wallet = {.state = WALLET_READY, .credits = coins};
    settings_ui_wallet_update(&wallet);
    wallet_notice = false;
    set_menu(false);
    lv_obj_add_flag(notice, LV_OBJ_FLAG_HIDDEN);
    if (item->action == SHOP_EAT) pet_behavior_care(PET_CARE_FOOD);
    else if (item->action == SHOP_DRINK) pet_behavior_care(PET_CARE_WATER);
    else if (item->action == SHOP_PET || item->action == SHOP_PLAY) pet_behavior_care(PET_CARE_COMPANY);
    pet_action_t animations[] = {EAT,DRINK,PET,HAPPY,PLAY,BATH,TREAT,DRESS};
    if (item->action == SHOP_HAPPY) happy_target_cycles = 4;
    set_action(animations[item->action]);
}
static void render_menu(void)
{
    menu_catalog = latest_catalog;
    if (!menu_catalog.available) menu_catalog.count = 0;
    menu_count = menu_catalog.count + 2;
    sleep_label = labels[menu_catalog.count];
    for (unsigned i = 0; i < menu_count; i++) {
        action_bounds_t box = action_bounds(menu_count, i);
        lv_obj_set_size(buttons[i], box.width, box.height);
        lv_obj_set_pos(buttons[i], box.x, box.y);
        lv_obj_set_width(labels[i], box.width - 8);
        lv_obj_align(labels[i], LV_ALIGN_TOP_MID, 0, menu_count <= 6 ? 9 : 6);
        lv_obj_align(prices[i], LV_ALIGN_BOTTOM_MID, 0, menu_count <= 6 ? -7 : -5);
        if (i < menu_catalog.count) {
            const shop_item_t *item = &menu_catalog.items[i];
            lv_label_set_text(labels[i], item->name);
            lv_label_set_text_fmt(prices[i], "%u cr", item->price);
            uint32_t colors[] = {0x728e62,0x658faa,0xc58574,0xb88843,0xd29358,0x658faa,0xc58574,0x728e62};
            lv_obj_set_style_bg_color(buttons[i],lv_color_hex(colors[item->action]),0);
        } else {
            lv_label_set_text(labels[i], i == menu_catalog.count ? (action == SLEEP ? "Wake" : "Sleep") : "Pet");
            lv_label_set_text(prices[i], "FREE");
            lv_obj_set_style_bg_color(buttons[i],lv_color_hex(i == menu_catalog.count ? 0x8797ac : 0xc58574),0);
        }
    }
}
static void pair_keyboard_event(lv_event_t *event)
{
    lv_event_code_t type = lv_event_get_code(event);
    if (type == LV_EVENT_CANCEL) { lv_obj_del(pair_screen); pair_screen = NULL; return; }
    if (type != LV_EVENT_READY) return;
    if (!network_pair_request(lv_textarea_get_text(pair_input))) {
        lv_label_set_text(notice, "Invalid code");
        settings_ui_pair_result(2);
    } else { lv_label_set_text(notice, "Connecting..."); settings_ui_pair_result(0); }
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
static void settings_pair(void) { open_pairing(NULL); }
static void open_settings(lv_event_t *event)
{
    (void)event;
    set_menu(false);
    settings_ui_open();
}
void app_main(void)
{
    I2C_Init(); LCD_Init(); LVGL_Init();
    network_start();
    pet_behavior_init();
    display_power_init();
    lv_obj_t *screen = lv_scr_act();
    lv_obj_set_style_bg_color(screen, lv_color_hex(0xfff7e7), 0);
    lv_obj_t *title = lv_label_create(screen); lv_label_set_text(title, "Keep going!"); lv_obj_align(title, LV_ALIGN_TOP_LEFT, 8, 12);
    balance_button = lv_btn_create(screen);
    lv_obj_set_size(balance_button, 112, 40); lv_obj_align(balance_button, LV_ALIGN_TOP_RIGHT, -4, 2);
    lv_obj_set_style_bg_opa(balance_button, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(balance_button, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(balance_button, 0, LV_PART_MAIN);
    lv_obj_set_style_text_color(balance_button, lv_color_hex(0x433c32), LV_PART_MAIN);
    lv_obj_add_event_cb(balance_button, open_settings, LV_EVENT_CLICKED, NULL);
    balance = lv_label_create(balance_button);
    lv_obj_set_width(balance, 82); lv_label_set_long_mode(balance, LV_LABEL_LONG_SCROLL_CIRCULAR);
    lv_obj_set_style_text_align(balance, LV_TEXT_ALIGN_RIGHT, 0);
    lv_label_set_text(balance, "-- cr");
    lv_obj_align(balance, LV_ALIGN_TOP_RIGHT, -26, 10);
    lv_obj_t *settings_icon = lv_label_create(balance_button);
    lv_label_set_text(settings_icon, LV_SYMBOL_SETTINGS);
    lv_obj_align(settings_icon, LV_ALIGN_TOP_RIGHT, -4, 10);
    pet_image = lv_img_create(screen); lv_img_set_src(pet_image, frames[IDLE][0]); lv_obj_align(pet_image, LV_ALIGN_CENTER, 0, 8);
    lv_obj_add_flag(pet_image, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(pet_image, show_menu, LV_EVENT_CLICKED, NULL);

    for (unsigned i = 0; i < 12; i++) {
        buttons[i] = lv_btn_create(screen);
        lv_obj_clear_flag(buttons[i], LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_radius(buttons[i],16,0); lv_obj_set_style_pad_all(buttons[i],0,0);
        lv_obj_add_event_cb(buttons[i],menu_action,LV_EVENT_CLICKED,(void *)(uintptr_t)i);
        labels[i] = lv_label_create(buttons[i]);
        lv_obj_set_style_text_font(labels[i],&shop_cjk_font,0);
        lv_obj_set_style_text_align(labels[i],LV_TEXT_ALIGN_CENTER,0);
        lv_label_set_long_mode(labels[i],LV_LABEL_LONG_SCROLL_CIRCULAR); lv_obj_set_height(labels[i],14);
        lv_obj_align(labels[i],LV_ALIGN_TOP_MID,0,4);
        prices[i] = lv_label_create(buttons[i]);
        lv_obj_set_style_text_font(prices[i],&lv_font_montserrat_10,0);
        lv_obj_align(prices[i],LV_ALIGN_BOTTOM_MID,0,-3);
    }
    render_menu();
    notice = lv_label_create(screen); lv_label_set_text(notice, "Not enough credits");
    lv_obj_set_width(notice, 160); lv_obj_set_style_text_align(notice, LV_TEXT_ALIGN_LEFT, 0);
    lv_obj_align(notice, LV_ALIGN_BOTTOM_LEFT, 6, -7);
    set_menu(false);
    load_wallet_cache();
    update_balance_ui();
    uint8_t mac[6]; esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char name[24]; snprintf(name, sizeof(name), "PET-%02X%02X%02X", mac[3], mac[4], mac[5]);
    tasks_ui_init(screen);
    settings_ui_init(screen, name, esp_app_get_description()->version, settings_pair);
    if (wallet_known) {
        network_wallet_update_t cached = {.state = WALLET_READY, .credits = coins};
        strlcpy(cached.child_id, wallet_child, sizeof(cached.child_id));
        settings_ui_wallet_update(&cached);
    }
    lv_timer_create(animate_pet, 300, NULL);
    network_refresh_wallet();
    task_refresh(0);
    bool was_asleep = false, was_in_subpage = false;
    while (1) {
        pet_behavior_tick();
        display_power_tick();
        bool asleep = display_power_is_asleep();
        bool in_subpage = settings_ui_is_open() || tasks_ui_is_open();
        if ((was_asleep && !asleep) || (was_in_subpage && !in_subpage)) {
            network_refresh_wallet();
            task_refresh(0);
        }
        was_asleep = asleep;
        was_in_subpage = in_subpage;
        network_wallet_update_t updated;
        int pairing = network_take_pair_result();
        if (pairing) settings_ui_pair_result(pairing);
        if (pairing == 1) {
            wallet_notice = true; wallet_known = false; server_credits = 0; wallet_child[0] = 0;
            memset(&latest_catalog, 0, sizeof(latest_catalog));
            shop_clear_pending(); save_wallet_cache(); update_balance_ui();
            lv_label_set_text(notice, "Select child in app");
            lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        } else if (pairing == 2 || pairing == 3) {
            lv_label_set_text(notice, pairing == 2 ? "Code not accepted" : "Network error; retry");
            lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
        }
        if (network_take_wallet(&updated)) {
            if (updated.state == WALLET_READY) {
                if (updated.child_id[0]) {
                    if (strcmp(wallet_child, updated.child_id)) {
                        set_menu(false);
                        memset(&latest_catalog, 0, sizeof(latest_catalog));
                        if (wallet_child[0]) shop_clear_pending();
                    }
                    strlcpy(wallet_child, updated.child_id, sizeof(wallet_child));
                    pet_behavior_bind_child(updated.child_id);
                }
                wallet_known = true;
                server_credits = updated.credits;
                update_balance_ui();
                save_wallet_cache();
                updated.credits = coins;
                if (wallet_notice) { lv_obj_add_flag(notice, LV_OBJ_FLAG_HIDDEN); wallet_notice = false; }
            } else if (updated.state != WALLET_SYNC_FAILED) {
                set_menu(false); memset(&latest_catalog, 0, sizeof(latest_catalog));
                wallet_notice = true; wallet_known = false; server_credits = 0; wallet_child[0] = 0;
                shop_clear_pending(); save_wallet_cache(); update_balance_ui();
                lv_label_set_text(notice, updated.state == WALLET_WAITING_FOR_CHILD ? "Select child in app" : "Check device in app");
                lv_obj_clear_flag(notice, LV_OBJ_FLAG_HIDDEN);
            }
            settings_ui_wallet_update(&updated);
        }
        shop_catalog_t catalog_update;
        if (shop_take_catalog(&catalog_update)) {
            if (catalog_update.available) {
                latest_catalog = catalog_update;
                if (wallet_known) save_wallet_cache();
            } else if (!wallet_known) {
                latest_catalog = catalog_update;
            }
            // Keep cached catalog when temporarily offline if wallet is still known.
        }
        if (menu_open() && menu_waiting_for_catalog && latest_catalog.available) {
            bool touching = false;
            for (lv_indev_t *input = lv_indev_get_next(NULL); input; input = lv_indev_get_next(input)) {
                if (input->proc.state == LV_INDEV_STATE_PR) touching = true;
            }
            if (!touching) set_menu(true);
        }
        static task_page_t page_update;
        bool touching_tasks = false;
        for (lv_indev_t *input = lv_indev_get_next(NULL); input; input = lv_indev_get_next(input))
            if (input->proc.state == LV_INDEV_STATE_PR) touching_tasks = true;
        if (!touching_tasks && task_take_page(&page_update)) {
            if (page_update.state == TASKS_READY) pet_behavior_bind_child(page_update.child_id);
            tasks_ui_page(&page_update);
            if (page_update.approved) { if (pet_behavior_mood() != PET_SLEEPING) set_action(ACHIEVEMENT); network_refresh_wallet(); }
        }
        checkin_result_t checkin;
        if (!touching_tasks && task_take_checkin(&checkin)) {
            tasks_ui_result(&checkin);
            if (checkin.state == CHECKIN_OK) {
                wallet_known = true; server_credits = checkin.credits;
                update_balance_ui(); save_wallet_cache();
                network_wallet_update_t wallet = {.state = WALLET_READY, .credits = coins};
                settings_ui_wallet_update(&wallet); network_refresh_wallet();
                if (checkin.status == TASK_COMPLETED && checkin.awarded && pet_behavior_mood() != PET_SLEEPING) set_action(ACHIEVEMENT);
            }
        }
        purchase_result_t purchase;
        if (shop_take_result(&purchase)) {
            if (purchase.state == PURCHASE_OK) {
                wallet_known = true; server_credits = purchase.credits;
                update_balance_ui(); save_wallet_cache();
                network_wallet_update_t wallet = {.state = WALLET_READY, .credits = coins};
                settings_ui_wallet_update(&wallet);
                wallet_notice = false;
            } else {
                update_balance_ui();
                if (wallet_known) {
                    network_wallet_update_t wallet = {.state = WALLET_READY, .credits = coins};
                    settings_ui_wallet_update(&wallet);
                }
                if (purchase.state == PURCHASE_INSUFFICIENT) network_refresh_wallet();
                else if (purchase.state == PURCHASE_CHANGED || purchase.state == PURCHASE_UNAVAILABLE) shop_refresh();
                const char *messages[] = {"", "Confirming; see Settings", "Not enough credits", "Item changed; reopen", "Item removed; reopen", "Check pairing in app", "Save failed; try again", "Purchase needs review"};
                lv_label_set_text(notice,messages[purchase.state]); lv_obj_clear_flag(notice,LV_OBJ_FLAG_HIDDEN);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10)); lv_timer_handler();
    }
}
