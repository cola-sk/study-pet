#pragma once
#include <stdbool.h>
#include <stdint.h>
typedef struct {
    uint64_t last_touch_ms;
    uint32_t timeout_s;
    bool asleep, pressed, swallow;
} screen_idle_t;
void screen_idle_init(screen_idle_t *screen, uint32_t timeout_s, uint64_t now_ms);
void screen_idle_tick(screen_idle_t *screen, uint64_t now_ms);
bool screen_idle_touch(screen_idle_t *screen, bool pressed, uint64_t now_ms);
void screen_idle_timeout(screen_idle_t *screen, uint32_t timeout_s, uint64_t now_ms);
