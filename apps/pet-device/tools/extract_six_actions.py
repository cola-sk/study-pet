"""Extract the supplied 3x8 animation sheet with a fixed canvas per action."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / 'assets/sprites/husky-six-actions.png'
OUT = ROOT / 'preview/frames'
CENTERS = (126, 350, 572, 794, 1015, 1236, 1457, 1672)
ROWS = ((12, 282), (310, 580), (590, 860))
GROUPS = (('play', 0, 0), ('bath', 0, 4), ('treat', 1, 0),
          ('dress', 1, 4), ('achievement', 2, 0), ('stretch', 2, 4))

def extract():
    sheet = Image.open(SHEET).convert('RGBA')
    if sheet.size != (1774, 887):
        raise ValueError('Unexpected source sheet dimensions')
    OUT.mkdir(parents=True, exist_ok=True)
    for name, row, start in GROUPS:
        images = []
        for frame in range(4):
            cx = CENTERS[start + frame]
            source = np.array(sheet.crop((cx-116, ROWS[row][0], cx+116, ROWS[row][1])))
            alpha = source[:, :, 3]
            count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha >= 80).astype('uint8'), 8)
            largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            keep = np.zeros(alpha.shape, dtype='uint8')
            for component in range(1, count):
                x, y, w, h, area = (int(v) for v in stats[component])
                # Tiny detached fragments touching a crop boundary come from a
                # neighbouring frame; preserve the main figure and interior props.
                touches = x == 0 or y == 0 or x + w >= alpha.shape[1] or y + h >= alpha.shape[0]
                if component == largest or (name != 'stretch' and area >= 100 and not touches):
                    keep[labels == component] = 255
            keep = cv2.dilate(keep, np.ones((3, 3), dtype='uint8'), iterations=2)
            source[:, :, 3] = np.where(keep, alpha, 0)
            images.append(Image.fromarray(source, 'RGBA'))
        # Use the same crop for all four frames so the puppy does not resize
        # or jump as its pose and separate props change.
        union = Image.new('L', images[0].size)
        for image in images:
            union = ImageChops.lighter(union, image.getchannel('A').point(lambda a: 255 if a >= 80 else 0))
        box = union.getbbox()
        if not box:
            raise ValueError(f'Empty animation group: {name}')
        box = (max(0, box[0]-2), max(0, box[1]-2), min(images[0].width, box[2]+2), min(images[0].height, box[3]+2))
        for frame, image in enumerate(images):
            image = image.crop(box)
            image.thumbnail((136, 128), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (140, 132), (255, 247, 231, 255))
            canvas.alpha_composite(image, ((140-image.width)//2, 132-image.height-2))
            canvas.convert('RGB').save(OUT / f'{name}_{frame+1:02}.png', optimize=True)
    print('Extracted 24 frames with fixed action alignment')

if __name__ == '__main__':
    extract()
