"""Generate RGB565 reference pixels from the prepared PNGs for the LVGL check."""
from pathlib import Path
import sys
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from embed_frames import ACTIONS, ROOT

output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=True)
index = 0
for action in ACTIONS:
    for n in range(1, 5):
        with Image.open(ROOT / 'preview/frames' / f'{action}_{n:02}.png') as image:
            raw = bytearray()
            for r, g, b in image.convert('RGB').getdata():
                value = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
                raw.extend((value & 255, value >> 8))
        (output / f'{index:02}.rgb565').write_bytes(raw)
        index += 1
print(f'Generated {index} RGB565 reference frames.')
