#pragma once
#include "lvgl.h"

static inline void pet_image_set_menu_open(lv_obj_t *image, bool open)
{
    uint16_t zoom = open ? 144 : 256;
    if (lv_img_get_zoom(image) == zoom) return;
    /* LVGL 8.3 under-invalidates the old image area when shrinking.
     * Repaint its complete old footprint as well as its new footprint. */
    lv_obj_invalidate(image);
    lv_img_set_zoom(image, zoom);
    lv_obj_invalidate(image);
}
