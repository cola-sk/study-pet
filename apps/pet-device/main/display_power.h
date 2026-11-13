#pragma once
#include <stdbool.h>
#include <stdint.h>
void display_power_init(void);
void display_power_tick(void);
bool display_power_filter_touch(bool pressed);
bool display_power_is_asleep(void);
uint32_t display_power_timeout(void);
bool display_power_set_timeout(uint32_t seconds);
