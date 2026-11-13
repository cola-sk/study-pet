#include "screen_idle.h"
void screen_idle_init(screen_idle_t *screen, uint32_t timeout_s, uint64_t now_ms)
{
    *screen = (screen_idle_t){.timeout_s = timeout_s, .last_touch_ms = now_ms};
}
void screen_idle_tick(screen_idle_t *screen, uint64_t now_ms)
{
    if (screen->timeout_s && !screen->pressed && !screen->swallow && now_ms - screen->last_touch_ms >= (uint64_t)screen->timeout_s * 1000)
        screen->asleep = true;
}
bool screen_idle_touch(screen_idle_t *screen, bool pressed, uint64_t now_ms)
{
    screen->pressed = pressed;
    if (pressed) {
        screen->last_touch_ms = now_ms;
        if (screen->asleep) { screen->asleep = false; screen->swallow = true; }
    }
    if (screen->swallow) {
        if (!pressed) { screen->swallow = false; screen->last_touch_ms = now_ms; }
        return false;
    }
    return pressed;
}
void screen_idle_timeout(screen_idle_t *screen, uint32_t timeout_s, uint64_t now_ms)
{
    screen->timeout_s = timeout_s;
    screen->last_touch_ms = now_ms;
    screen->asleep = false;
}
