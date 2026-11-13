#pragma once
#include "lvgl.h"
#include "task_network.h"
void tasks_ui_init(lv_obj_t *host);
void tasks_ui_open(void);
bool tasks_ui_is_open(void);
void tasks_ui_page(const task_page_t *page);
void tasks_ui_result(const checkin_result_t *result);
void tasks_ui_home_visible(bool visible);
