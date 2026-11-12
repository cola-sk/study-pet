"""Convert a provided 4x4 PNG frame set for browser preview and LVGL RGB565."""
from pathlib import Path
import sys
from PIL import Image

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
output = root / 'preview' / 'frames'
output.mkdir(parents=True, exist_ok=True)
width, height = 140, 132
names = [f'{action}_{n:02}' for action in ('idle', 'eat', 'happy', 'sleep') for n in range(1, 5)]
with (root / 'main' / 'husky_frames.c').open('w') as c:
    c.write('#include "lvgl.h"\n#include "husky_frames.h"\n')
    for name in names:
        image = Image.open(source / f'{name}.png').convert('RGBA')
        # Ignore faint background artifacts when calculating the crop.
        mask = image.getchannel('A').point(lambda a: 255 if a >= 80 else 0)
        box = mask.getbbox()
        if box is None:
            raise ValueError(f'No visible pixels: {name}')
        image = image.crop(box)
        image.thumbnail((width - 4, height - 4), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (width, height), (255, 247, 231, 255))
        canvas.alpha_composite(image, ((width - image.width) // 2, height - image.height - 2))
        rgb = canvas.convert('RGB')
        rgb.save(output / f'{name}.png')
        data = bytearray()
        for r, g, b in rgb.getdata():
            value = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            data.extend((value & 255, value >> 8))
        c.write(f'static const uint8_t {name}_data[] = {{\n')
        for i in range(0, len(data), 24):
            c.write('  ' + ','.join(f'0x{x:02x}' for x in data[i:i+24]) + ',\n')
        c.write('};\n')
        c.write(f'const lv_img_dsc_t husky_{name} = {{ .header.cf = LV_IMG_CF_TRUE_COLOR, .header.w = {width}, .header.h = {height}, .data_size = sizeof({name}_data), .data = {name}_data }};\n')
