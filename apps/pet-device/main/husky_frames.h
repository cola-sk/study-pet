#pragma once
#include "lvgl.h"
#define HUSKY_DECLARE(action) \
    extern const lv_img_dsc_t husky_##action##_01, husky_##action##_02, husky_##action##_03, husky_##action##_04;
HUSKY_DECLARE(idle)
HUSKY_DECLARE(eat)
HUSKY_DECLARE(happy)
HUSKY_DECLARE(sleep)
HUSKY_DECLARE(hungry)
HUSKY_DECLARE(thirsty)
HUSKY_DECLARE(drink)
HUSKY_DECLARE(sleepy)
HUSKY_DECLARE(lonely)
HUSKY_DECLARE(pet)
