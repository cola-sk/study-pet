#include "settings_ui.h"
#include "wifi_manager.h"
#include "wifi_credentials.h"
#include "display_power.h"
#include <stdio.h>
#include <string.h>

LV_FONT_DECLARE(shop_cjk_font);
typedef enum { PAGE_SETTINGS, PAGE_WIFI, PAGE_JOIN, PAGE_PROGRESS, PAGE_DEVICE, PAGE_SCREEN } page_t;
static lv_obj_t *host, *root, *heading, *credit_value, *sync_status, *sync_button;
static lv_obj_t *wifi_name, *wifi_status, *device_status, *network_list, *scan_button;
static lv_obj_t *ssid_input, *password_input, *keyboard, *password_button, *connect_button;
static lv_obj_t *progress_message, *progress_button;
static page_t page;
static pet_wifi_snapshot_t view;
static char selected_ssid[33], device_name[24], firmware_version[32], cloud_alias[151];
static bool device_page_paired;
static bool password_required, credits_known, syncing, progress_finished;
static unsigned credits;
static uint32_t last_sync, sync_started, waiting_attempt;
static network_wallet_state_t wallet_state = WALLET_SYNC_FAILED;
static void (*pair_callback)(void);
static int pairing_feedback = -1;
static lv_obj_t *screen_choices[4], *screen_hint;
static const uint32_t screen_timeouts[] = {60, 120, 300, 0};
static const char *screen_names[] = {"1 minute", "2 minutes", "5 minutes", "Never"};
static void show_settings(void), show_wifi(bool scan), show_join(void), show_progress(void), show_device(void);
static void show_screen(void);

static void text(lv_obj_t *label, const char *value)
{
    if (label && strcmp(lv_label_get_text(label), value)) lv_label_set_text(label, value);
}
static lv_obj_t *label(lv_obj_t *parent, const char *value, int x, int y, int width)
{
    lv_obj_t *obj = lv_label_create(parent);
    lv_obj_set_style_text_font(obj, &shop_cjk_font, 0);
    lv_obj_set_width(obj, width); lv_label_set_long_mode(obj, LV_LABEL_LONG_WRAP);
    lv_obj_set_pos(obj, x, y); lv_label_set_text(obj, value);
    return obj;
}
static lv_obj_t *button(lv_obj_t *parent, const char *value, int x, int y, int width, int height, lv_event_cb_t callback)
{
    lv_obj_t *obj = lv_btn_create(parent);
    lv_obj_set_pos(obj, x, y); lv_obj_set_size(obj, width, height);
    lv_obj_set_style_pad_all(obj, 0, 0); lv_obj_set_style_radius(obj, 12, 0);
    lv_obj_set_style_bg_color(obj, lv_color_hex(0x728e62), 0);
    lv_obj_set_style_shadow_width(obj, 0, 0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t *caption = label(obj, value, 0, 0, width - 12);
    lv_obj_set_style_text_align(caption, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(caption);
    if (callback) lv_obj_add_event_cb(obj, callback, LV_EVENT_CLICKED, NULL);
    return obj;
}
static void button_text(lv_obj_t *obj, const char *value) { text(lv_obj_get_child(obj, 0), value); }
static const char *connection_text(pet_wifi_state_t state)
{
    const char *names[] = {"Not configured", "Connecting...", "Connected", "Offline; reconnecting", "Wi-Fi unavailable"};
    return names[state];
}
static void close_settings(void)
{
    if (root) lv_obj_del(root);
    root = NULL;
}
static void back(lv_event_t *event)
{
    (void)event;
    if (page == PAGE_SETTINGS) close_settings();
    else if (page == PAGE_JOIN) show_wifi(false);
    else if (page == PAGE_PROGRESS) { if (!progress_finished) wifi_manager_cancel(); show_wifi(false); }
    else show_settings();
}
static void begin_page(page_t next, const char *title)
{
    if (!root) {
        root = lv_obj_create(host);
        lv_obj_set_pos(root, 0, 0); lv_obj_set_size(root, 240, 320);
        lv_obj_set_style_pad_all(root, 0, 0); lv_obj_set_style_border_width(root, 0, 0);
        lv_obj_set_style_radius(root, 0, 0); lv_obj_set_style_bg_color(root, lv_color_hex(0xfff7e7), 0);
        lv_obj_set_style_text_color(root, lv_color_hex(0x433c32), 0);
        lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE);
    } else lv_obj_clean(root);
    page = next;
    credit_value = sync_status = sync_button = wifi_name = wifi_status = device_status = NULL;
    network_list = scan_button = ssid_input = password_input = keyboard = password_button = connect_button = NULL;
    progress_message = progress_button = NULL;
    button(root, LV_SYMBOL_LEFT, 6, 4, 40, 36, back);
    heading = label(root, title, 56, 13, 178);
}
static lv_obj_t *card(int y, int height)
{
    lv_obj_t *obj = lv_obj_create(root);
    lv_obj_set_pos(obj, 12, y); lv_obj_set_size(obj, 216, height);
    lv_obj_set_style_bg_color(obj, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_border_width(obj, 0, 0); lv_obj_set_style_radius(obj, 12, 0);
    lv_obj_set_style_pad_all(obj, 0, 0); lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    return obj;
}
static void update_settings(void)
{
    char value[64];
    if (credits_known) snprintf(value, sizeof(value), "%u credits", credits);
    else snprintf(value, sizeof(value), "-- credits");
    text(credit_value, value);
    if (syncing) snprintf(value, sizeof(value), "Syncing...");
    else if (!network_business_enabled()) snprintf(value, sizeof(value), "Pair device first");
    else if (wallet_state == WALLET_WAITING_FOR_CHILD) snprintf(value, sizeof(value), "Select child in app");
    else if (wallet_state == WALLET_UNAUTHORIZED) snprintf(value, sizeof(value), "Check pairing in app");
    else if (view.state != PET_WIFI_CONNECTED) snprintf(value, sizeof(value), "Offline / last balance");
    else if (wallet_state == WALLET_SYNC_FAILED) snprintf(value, sizeof(value), "Sync failed; retry");
    else snprintf(value, sizeof(value), "Updated %lus ago", (unsigned long)(lv_tick_elaps(last_sync) / 1000));
    text(sync_status, value);
    if (sync_button) {
        if (syncing) lv_obj_add_state(sync_button, LV_STATE_DISABLED);
        else lv_obj_clear_state(sync_button, LV_STATE_DISABLED);
    }
    text(wifi_name, view.ssid[0] ? view.ssid : "Choose a network");
    text(wifi_status, connection_text(view.state));
    text(device_status, network_business_enabled() ? "Family paired" : "Tap to pair");
}
static void sync_now(lv_event_t *event)
{
    (void)event;
    if (syncing) return;
    if (!network_business_enabled()) { show_device(); return; }
    if (network_refresh_wallet()) { syncing = true; sync_started = lv_tick_get(); }
    else wallet_state = WALLET_SYNC_FAILED;
    update_settings();
}
static void open_wifi(lv_event_t *event) { (void)event; show_wifi(true); }
static void open_device(lv_event_t *event) { (void)event; show_device(); }
static void open_screen(lv_event_t *event) { (void)event; show_screen(); }
static void show_settings(void)
{
    wifi_manager_snapshot(&view);
    begin_page(PAGE_SETTINGS, "Settings");
    lv_obj_t *credit_card = card(52, 88);
    label(credit_card, "Credits", 12, 8, 192);
    credit_value = label(credit_card, "-- credits", 12, 28, 192);
    lv_obj_set_style_text_font(credit_value, &lv_font_montserrat_20, 0);
    sync_status = label(credit_card, "", 12, 56, 98);
    lv_obj_set_style_text_font(sync_status, &lv_font_montserrat_10, 0);
    sync_button = button(credit_card, "Sync now", 116, 46, 88, 36, sync_now);
    lv_obj_t *wifi_card = card(148, 64);
    lv_obj_add_flag(wifi_card, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(wifi_card, open_wifi, LV_EVENT_CLICKED, NULL);
    label(wifi_card, "Wi-Fi", 12, 8, 170); label(wifi_card, LV_SYMBOL_RIGHT, 192, 28, 16);
    wifi_name = label(wifi_card, "", 12, 26, 172); lv_label_set_long_mode(wifi_name, LV_LABEL_LONG_SCROLL_CIRCULAR);
    wifi_status = label(wifi_card, "", 12, 46, 192); lv_obj_set_style_text_font(wifi_status, &lv_font_montserrat_10, 0);
    lv_obj_t *device_card = card(220, 42);
    lv_obj_add_flag(device_card, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(device_card, open_device, LV_EVENT_CLICKED, NULL);
    label(device_card, "Device", 12, 6, 170); label(device_card, LV_SYMBOL_RIGHT, 192, 14, 16);
    device_status = label(device_card, "", 12, 25, 172);
    lv_obj_set_style_text_font(device_status, &lv_font_montserrat_10, 0);
    lv_obj_t *screen_card = card(270, 42);
    lv_obj_add_flag(screen_card, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(screen_card, open_screen, LV_EVENT_CLICKED, NULL);
    label(screen_card, "Screen", 12, 6, 170); label(screen_card, LV_SYMBOL_RIGHT, 192, 14, 16);
    const char *timeout = "2 minutes";
    for (unsigned i = 0; i < 4; i++) if (screen_timeouts[i] == display_power_timeout()) timeout = screen_names[i];
    lv_obj_t *screen_status = label(screen_card, timeout, 12, 25, 172);
    lv_obj_set_style_text_font(screen_status, &lv_font_montserrat_10, 0);
    update_settings();
}
static void choose_timeout(lv_event_t *event)
{
    unsigned choice = (unsigned)(uintptr_t)lv_event_get_user_data(event);
    if (choice >= 4) return;
    if (!display_power_set_timeout(screen_timeouts[choice])) { text(screen_hint, "Save failed. Please try again."); return; }
    for (unsigned i = 0; i < 4; i++) {
        if (i == choice) lv_obj_add_state(screen_choices[i], LV_STATE_CHECKED);
        else lv_obj_clear_state(screen_choices[i], LV_STATE_CHECKED);
    }
    text(screen_hint, "Touch to wake. Tap again to act.");
}
static void show_screen(void)
{
    begin_page(PAGE_SCREEN, "Screen");
    label(root, "Turn screen off after\nno touch activity:", 16, 52, 208);
    for (unsigned i = 0; i < 4; i++) {
        screen_choices[i] = button(root, screen_names[i], 16, 100 + i * 46, 208, 40, NULL);
        lv_obj_set_style_bg_color(screen_choices[i], lv_color_hex(0x43583a), LV_STATE_CHECKED);
        lv_obj_set_style_border_width(screen_choices[i], 2, LV_STATE_CHECKED);
        lv_obj_set_style_border_color(screen_choices[i], lv_color_hex(0xb9cf9e), LV_STATE_CHECKED);
        lv_obj_add_event_cb(screen_choices[i], choose_timeout, LV_EVENT_CLICKED, (void *)(uintptr_t)i);
        if (display_power_timeout() == screen_timeouts[i]) lv_obj_add_state(screen_choices[i], LV_STATE_CHECKED);
    }
    screen_hint = label(root, "Touch to wake. Tap again to act.", 16, 290, 208);
    lv_obj_set_style_text_font(screen_hint, &lv_font_montserrat_10, 0);
}
static void manual_network(lv_event_t *event)
{
    (void)event; selected_ssid[0] = 0; password_required = false; show_join();
}
static void select_network(lv_event_t *event)
{
    unsigned index = (unsigned)(uintptr_t)lv_event_get_user_data(event);
    if (index >= view.count || !view.networks[index].supported) return;
    snprintf(selected_ssid, sizeof(selected_ssid), "%s", view.networks[index].ssid);
    password_required = view.networks[index].secured; show_join();
}
static void fill_networks(void)
{
    lv_obj_clean(network_list);
    if (view.scanning) {
        label(network_list, "Scanning nearby\n2.4 GHz networks...", 8, 20, 200);
    } else if (view.scan_failed) {
        label(network_list, "Scan failed. Tap Scan again\nor enter the name manually.", 8, 20, 200);
    } else if (!view.count) {
        label(network_list, "No networks found.\nTap Scan or use Manual.", 8, 20, 200);
    } else {
        for (unsigned i = 0; i < view.count; i++) {
            pet_wifi_ap_t *ap = &view.networks[i];
            lv_obj_t *row = button(network_list, "", 0, (int)i * 62, 216, 54, NULL);
            lv_obj_set_style_bg_color(row, lv_color_hex(0xffffff), 0);
            lv_obj_set_style_text_color(row, lv_color_hex(0x433c32), 0);
            lv_obj_t *name = label(row, ap->ssid, 10, 7, 172); lv_label_set_long_mode(name, LV_LABEL_LONG_SCROLL_CIRCULAR);
            const char *detail = !ap->supported ? "Enterprise / WEP unsupported" : ap->secured ? "Password required" : "Open network";
            lv_obj_t *hint = label(row, detail, 10, 33, 192); lv_obj_set_style_text_font(hint, &lv_font_montserrat_10, 0);
            label(row, LV_SYMBOL_WIFI, 190, 10, 20);
            if (ap->supported) lv_obj_add_event_cb(row, select_network, LV_EVENT_CLICKED, (void *)(uintptr_t)i);
            else lv_obj_add_state(row, LV_STATE_DISABLED);
        }
    }
    if (scan_button) {
        button_text(scan_button, view.scanning ? "Scanning..." : "Scan");
        if (view.scanning) lv_obj_add_state(scan_button, LV_STATE_DISABLED);
        else lv_obj_clear_state(scan_button, LV_STATE_DISABLED);
    }
}
static void scan_networks(lv_event_t *event)
{
    (void)event;
    if (wifi_manager_scan()) { view.scanning = true; view.scan_failed = false; fill_networks(); }
    else if (!view.scanning) text(heading, "Wi-Fi busy; retry Scan");
}
static void show_wifi(bool scan)
{
    wifi_manager_snapshot(&view); begin_page(PAGE_WIFI, "Wi-Fi / 2.4 GHz");
    wifi_name = label(root, view.ssid[0] ? view.ssid : "No network configured", 12, 48, 216);
    lv_label_set_long_mode(wifi_name, LV_LABEL_LONG_SCROLL_CIRCULAR);
    wifi_status = label(root, connection_text(view.state), 12, 72, 216);
    lv_obj_set_style_text_font(wifi_status, &lv_font_montserrat_10, 0);
    scan_button = button(root, "Scan", 12, 96, 104, 38, scan_networks);
    button(root, "Manual", 124, 96, 104, 38, manual_network);
    network_list = lv_obj_create(root);
    lv_obj_set_pos(network_list, 12, 144); lv_obj_set_size(network_list, 216, 170);
    lv_obj_set_style_pad_all(network_list, 0, 0); lv_obj_set_style_border_width(network_list, 0, 0);
    lv_obj_set_style_bg_opa(network_list, LV_OPA_TRANSP, 0);
    lv_obj_set_scroll_dir(network_list, LV_DIR_VER);
    fill_networks();
    if (scan) scan_networks(NULL);
}
static void focus_input(lv_event_t *event)
{
    if (keyboard) lv_keyboard_set_textarea(keyboard, lv_event_get_target(event));
}
static void input_changed(lv_event_t *event) { (void)event; text(heading, "Join network"); }
static void toggle_password(lv_event_t *event)
{
    (void)event;
    bool hidden = lv_textarea_get_password_mode(password_input);
    lv_textarea_set_password_mode(password_input, !hidden);
    button_text(password_button, hidden ? "Hide" : "Show");
}
static void connect_network(lv_event_t *event)
{
    (void)event;
    const char *ssid = lv_textarea_get_text(ssid_input), *password = lv_textarea_get_text(password_input);
    if (!ssid[0] || strlen(ssid) > 32) { text(heading, "SSID: 1-32 bytes"); return; }
    if ((password_required && !password[0]) || !pet_wifi_credentials_valid(ssid, password)) { text(heading, "Password: 8-63 chars"); return; }
    wifi_manager_snapshot(&view); waiting_attempt = view.attempt_id;
    if (!wifi_manager_connect(ssid, password)) { text(heading, "Wi-Fi busy; try again"); return; }
    snprintf(selected_ssid, sizeof(selected_ssid), "%s", ssid);
    show_progress();
}
static void keyboard_event(lv_event_t *event)
{
    if (lv_event_get_code(event) == LV_EVENT_READY) connect_network(NULL);
    else if (lv_event_get_code(event) == LV_EVENT_CANCEL) show_wifi(false);
}
static void show_join(void)
{
    begin_page(PAGE_JOIN, "Join network");
    label(root, "Network name", 12, 42, 216);
    ssid_input = lv_textarea_create(root); lv_obj_set_pos(ssid_input, 12, 58); lv_obj_set_size(ssid_input, 216, 34);
    lv_obj_set_style_text_font(ssid_input, &shop_cjk_font, 0); lv_obj_set_style_pad_all(ssid_input, 6, 0);
    lv_textarea_set_one_line(ssid_input, true); lv_textarea_set_max_length(ssid_input, 32); lv_textarea_set_text(ssid_input, selected_ssid);
    label(root, "Password", 12, 96, 216);
    password_input = lv_textarea_create(root); lv_obj_set_pos(password_input, 12, 112); lv_obj_set_size(password_input, 152, 34);
    lv_obj_set_style_pad_all(password_input, 6, 0); lv_textarea_set_one_line(password_input, true);
    lv_textarea_set_max_length(password_input, 64); lv_textarea_set_password_mode(password_input, true); lv_textarea_set_password_show_time(password_input, 0);
    password_button = button(root, "Show", 172, 112, 56, 34, toggle_password);
    connect_button = button(root, "Connect", 12, 152, 216, 36, connect_network);
    keyboard = lv_keyboard_create(root); lv_obj_set_size(keyboard, 240, 126); lv_obj_align(keyboard, LV_ALIGN_BOTTOM_MID, 0, 0);
    lv_obj_set_style_pad_all(keyboard, 2, 0); lv_obj_set_style_pad_row(keyboard, 3, 0); lv_obj_set_style_pad_column(keyboard, 2, 0);
    lv_obj_set_style_text_font(keyboard, &lv_font_montserrat_10, LV_PART_ITEMS);
    lv_keyboard_set_mode(keyboard, LV_KEYBOARD_MODE_TEXT_LOWER);
    lv_keyboard_set_textarea(keyboard, selected_ssid[0] ? password_input : ssid_input);
    lv_obj_add_event_cb(ssid_input, focus_input, LV_EVENT_CLICKED, NULL);
    lv_obj_add_event_cb(password_input, focus_input, LV_EVENT_CLICKED, NULL);
    lv_obj_add_event_cb(ssid_input, input_changed, LV_EVENT_VALUE_CHANGED, NULL);
    lv_obj_add_event_cb(password_input, input_changed, LV_EVENT_VALUE_CHANGED, NULL);
    lv_obj_add_event_cb(keyboard, keyboard_event, LV_EVENT_READY, NULL);
    lv_obj_add_event_cb(keyboard, keyboard_event, LV_EVENT_CANCEL, NULL);
}
static void progress_action(lv_event_t *event)
{
    (void)event;
    if (!progress_finished) { wifi_manager_cancel(); show_wifi(false); }
    else if (view.attempt == PET_WIFI_ATTEMPT_SAVED) show_settings();
    else show_join();
}
static void show_progress(void)
{
    begin_page(PAGE_PROGRESS, "Wi-Fi connection"); progress_finished = false;
    label(root, selected_ssid, 18, 72, 204);
    progress_message = label(root, "Connecting...\nThis may take up to 25s.", 18, 116, 204);
    progress_button = button(root, "Cancel", 24, 224, 192, 42, progress_action);
}
static void pair_device(lv_event_t *event) { (void)event; if (pair_callback) pair_callback(); }
static void show_device(void)
{
    begin_page(PAGE_DEVICE, "Device");
    device_page_paired=network_business_enabled();
    lv_obj_t *alias_label=label(root, cloud_alias[0] ? cloud_alias : device_name, 16, 52, 208);
    lv_obj_set_height(alias_label,36); lv_label_set_long_mode(alias_label,LV_LABEL_LONG_DOT);
    char identity[64]; snprintf(identity,sizeof(identity),"%s | %s",device_name,firmware_version);
    label(root, identity, 16, 92, 208);

    device_status = label(root, network_business_enabled() ? "Family paired" : "Not paired", 16, 132, 208);
    const char *hint = network_business_enabled() ? "Manage child assignment\nin the parent app." : pairing_feedback == 0 ? "Pairing..." : pairing_feedback == 2 ? "Code not accepted.\nCheck the code and retry." : pairing_feedback == 3 ? "Network error.\nCheck Wi-Fi and retry." : "Connect Wi-Fi, then enter\nyour 6-digit family code.";
    label(root, hint, 16, 166, 208);
    if (!network_business_enabled()) button(root, "Enter family code", 16, 244, 208, 42, pair_device);
}
static void ui_tick(lv_timer_t *timer)
{
    (void)timer;
    if (syncing && lv_tick_elaps(sync_started) >= 35000) { syncing = false; wallet_state = WALLET_SYNC_FAILED; }
    if (!root) return;
    pet_wifi_snapshot_t next; wifi_manager_snapshot(&next);
    bool scan_changed = next.scanning != view.scanning || next.scan_failed != view.scan_failed || next.count != view.count || memcmp(next.networks, view.networks, sizeof(next.networks));
    view = next;
    if (page == PAGE_SETTINGS) update_settings();
    else if (page == PAGE_WIFI) {
        text(wifi_name, view.ssid[0] ? view.ssid : "No network configured"); text(wifi_status, connection_text(view.state));
        if (scan_changed) fill_networks();
    } else if (page == PAGE_PROGRESS && !progress_finished && view.attempt_id != waiting_attempt && view.attempt != PET_WIFI_ATTEMPT_CONNECTING) {
        progress_finished = true;
        const char *message = view.attempt == PET_WIFI_ATTEMPT_SAVED ? "Connected!\nNetwork saved on device." : view.attempt == PET_WIFI_ATTEMPT_SAVE_FAILED ? "Could not save network.\nPrevious settings kept." : "Connection failed.\nCheck network / password.\nPrevious settings kept.";
        text(progress_message, message);
        button_text(progress_button, view.attempt == PET_WIFI_ATTEMPT_SAVED ? "Back to Settings" : "Try again");
    } else if (page == PAGE_DEVICE && device_page_paired != network_business_enabled()) show_device();
}
void settings_ui_init(lv_obj_t *screen, const char *name, const char *version, void (*callback)(void))
{
    host = screen; pair_callback = callback;
    snprintf(device_name, sizeof(device_name), "%s", name); snprintf(firmware_version, sizeof(firmware_version), "%s", version);
    lv_timer_create(ui_tick, 250, NULL);
    wifi_manager_snapshot(&view);
    if (!view.configured) show_wifi(true);
}
void settings_ui_open(void) { show_settings(); }
bool settings_ui_is_open(void) { return root != NULL; }
void settings_ui_wallet_update(const network_wallet_update_t *update)
{
    wallet_state = update->state;
    bool alias_changed=update->device_alias[0] && strcmp(cloud_alias,update->device_alias);
    if (alias_changed) strlcpy(cloud_alias,update->device_alias,sizeof(cloud_alias));
    if (update->state==WALLET_UNAUTHORIZED) cloud_alias[0]=0;
    if (update->state == WALLET_READY) { credits = update->credits; credits_known = true; last_sync = lv_tick_get(); }
    else if (update->state != WALLET_SYNC_FAILED) credits_known = false;
    if (update->manual) syncing = false;
    if (root && page == PAGE_SETTINGS) update_settings();
    else if (root && page == PAGE_DEVICE && (alias_changed || device_page_paired!=network_business_enabled())) show_device();
}
void settings_ui_pair_result(int result)
{
    pairing_feedback = result;
    if (root && page == PAGE_DEVICE) show_device();
}
