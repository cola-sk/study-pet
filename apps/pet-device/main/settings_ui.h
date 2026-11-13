#pragma once
#include "lvgl.h"
#include "network.h"

void settings_ui_init(lv_obj_t *host, const char *device_name, const char *version, void (*pair_callback)(void));
void settings_ui_open(void);
bool settings_ui_is_open(void);
void settings_ui_wallet_update(const network_wallet_update_t *update);
void settings_ui_pair_result(int result);
