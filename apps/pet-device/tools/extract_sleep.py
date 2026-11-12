"""Keep the puppy fixed and extract only the blue Z symbols from the sleep sheet."""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
sheet = Image.open(root / 'assets' / 'sleep-sheet.png').convert('RGBA')
if sheet.size != (1536, 1024):
    raise ValueError('Expected a 1536x1024 2x2 sleep sheet')
out = root / 'tools' / 'source'
out.mkdir(exist_ok=True)
base = sheet.crop((0, 0, 768, 512))
for index in range(4):
    quad = sheet.crop(((index % 2) * 768, (index // 2) * 512,
                       (index % 2 + 1) * 768, (index // 2 + 1) * 512))
    result = base.copy()
    if index:
        # Only extract blue Z marks above the puppy; never alter the body.
        z = np.array(quad)
        r, g, b = (z[:, :, i].astype('int16') for i in range(3))
        yy, xx = np.indices((512, 768))
        keep = (xx >= 440) & (yy < 210) & (b > 70) & (b > r * 1.2) & (b > g * 1.08)
        z[:, :, 3] = np.where(keep, z[:, :, 3], 0).astype('uint8')
        result.alpha_composite(Image.fromarray(z))
    # A common rectangle prevents the crop or scale from shifting across frames.
    result.crop((180, 100, 710, 465)).save(out / f'sleep_{index+1:02}.png')
