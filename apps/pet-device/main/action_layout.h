#pragma once

typedef struct { int x, y, width, height; } action_bounds_t;

/* Clockwise groups around the pet: top, right, bottom, left. */
static inline action_bounds_t action_bounds(unsigned count, unsigned index)
{
    int width = count <= 4 ? 88 : count <= 6 ? 84 : count <= 8 ? 76 : 72;
    int height = count <= 4 ? 54 : count <= 6 ? 52 : count <= 8 ? 48 : 44;
    unsigned top = count == 2 ? 0 : count <= 4 ? 1 : count <= 8 ? 2 : 3;
    unsigned bottom = count <= 3 ? 0 : count <= 5 ? 1 : top;
    unsigned right = (count - top - bottom + 1) / 2;
    unsigned left = count - top - bottom - right;
    action_bounds_t box = {0, 0, width, height};
    if (index < top) {
        box.x = (240 - (int)top * width - ((int)top - 1) * 8) / 2 + (int)index * (width + 8);
        box.y = 50;
    } else if ((index -= top) < right) {
        box.x = 236 - width;
        box.y = count == 3 ? 204 : right == 1 ? 150 : right == 2 ? 116 + (int)index * 78 : 102 + (int)index * 52;
    } else if ((index -= right) < bottom) {
        box.x = (240 - (int)bottom * width - ((int)bottom - 1) * 8) / 2 + (int)(bottom - 1 - index) * (width + 8);
        box.y = 304 - height;
    } else {
        index -= bottom;
        box.x = 4;
        box.y = count == 3 ? 204 : left == 1 ? 150 : left == 2 ? 116 + (int)(left - 1 - index) * 78 : 102 + (int)(left - 1 - index) * 52;
    }
    return box;
}
