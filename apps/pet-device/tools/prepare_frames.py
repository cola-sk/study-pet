"""Prepare supplied sprite frames for browser preview and size-selected LVGL images."""
from pathlib import Path
import sys
from PIL import Image
import cv2
import numpy as np

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
output = root / 'preview' / 'frames'
output.mkdir(parents=True, exist_ok=True)
width, height = 140, 132
names = [f'{action}_{n:02}' for action in ('idle', 'eat', 'happy', 'sleep', 'hungry', 'thirsty', 'drink', 'sleepy', 'lonely', 'pet') for n in range(1, 5)]
new_actions = {'hungry', 'thirsty', 'drink', 'sleepy', 'lonely', 'pet', 'sleep'}
for name in names:
    frame_dir = root / 'tools' / 'source' if name.rsplit('_', 1)[0] in new_actions else source
    image = Image.open(frame_dir / f'{name}.png').convert('RGBA')
    # Sprite sheets can leave disconnected pieces of adjacent rows along
    # a cell's top/bottom edge. Remove only small edge components, not
    # separate objects (bowls, droplets and motion marks) inside the cell.
    pixels = np.array(image)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (pixels[:, :, 3] > 10).astype('uint8'), 8)
    if count > 1:
        largest = int(stats[1:, cv2.CC_STAT_AREA].max())
        for component in range(1, count):
            x, y, w, h, area = map(int, stats[component])
            touches_row_edge = y == 0 or y + h >= image.height - 1
            if touches_row_edge and area < largest * 0.04:
                pixels[labels == component, 3] = 0
        image = Image.fromarray(pixels)
    # Ignore faint background artifacts when calculating the crop.
    mask = image.getchannel('A').point(lambda a: 255 if a >= 80 else 0)
    box = (0, 0, image.width, image.height) if name.startswith('sleep_') else mask.getbbox()
    if box is None:
        raise ValueError(f'No visible pixels: {name}')
    image = image.crop(box)
    image.thumbnail((width - 4, height - 4), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (width, height), (255, 247, 231, 255))
    canvas.alpha_composite(image, ((width - image.width) // 2, height - image.height - 2))
    rgb = canvas.convert('RGB')
    rgb.save(output / f'{name}.png')

from embed_frames import embed
embed()
