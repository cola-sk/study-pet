"""Generate the device's 11px CJK font from Noto Sans SC (SIL OFL).
Usage: python generate_device_shop_font.py /path/to/NotoSansSC-VF.ttf
The generated font covers U+4E00..U+9FFF; ASCII uses LVGL's default font.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
font = ImageFont.truetype(sys.argv[1], 11)
output = Path(__file__).resolve().parents[1] / 'apps/pet-device/main/fonts/shop_cjk.c'
with output.open('w') as target:
    target.write('/* Generated from Noto Sans SC, SIL OFL: see OFL.txt. */\n#include "lvgl.h"\nstatic const uint8_t glyphs[] = {\n')
    for cp in range(0x4e00, 0xa000):
        canvas = Image.new('1', (11, 11))
        draw = ImageDraw.Draw(canvas)
        draw.text((0, 10), chr(cp), font=font, fill=1, anchor='ls', stroke_width=0)
        bits = ''.join('1' if canvas.getpixel((x, y)) else '0' for y in range(11) for x in range(11))
        data = int(bits.ljust(128, '0'), 2).to_bytes(16, 'big')
        target.write(','.join(f'0x{byte:02x}' for byte in data) + ',\n')
    target.write('''};
static bool glyph_dsc(const lv_font_t *font, lv_font_glyph_dsc_t *dsc, uint32_t letter, uint32_t next) {
    (void)font; (void)next;
    if (letter < 0x4e00 || letter > 0x9fff) return false;
    dsc->adv_w = 12; dsc->box_w = 11; dsc->box_h = 11;
    dsc->ofs_x = 0; dsc->ofs_y = 0; dsc->bpp = 1; dsc->is_placeholder = false;
    return true;
}
static const uint8_t *glyph_bitmap(const lv_font_t *font, uint32_t letter) {
    (void)font;
    if (letter < 0x4e00 || letter > 0x9fff) return NULL;
    return glyphs + (letter - 0x4e00) * 16;
}
const lv_font_t shop_cjk_font = {
    .get_glyph_dsc = glyph_dsc, .get_glyph_bitmap = glyph_bitmap,
    .line_height = 14, .base_line = 2, .fallback = LV_FONT_DEFAULT,
};
''')
print(f'Generated {output}, {20992 * 16} bitmap bytes')
