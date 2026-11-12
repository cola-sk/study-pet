"""Extract the supplied transparent 4x7 husky sheet into animation frames."""
from pathlib import Path
from PIL import Image
import sys
sheet = Image.open(sys.argv[1]).convert('RGBA')
if sheet.size != (1536, 1024):
    raise ValueError('Expected the supplied 1536x1024 sprite sheet')
out = Path(__file__).resolve().parent / 'source'
out.mkdir(exist_ok=True)
xs = [245, 510, 790, 1070, 1355]
ys = [0, 161, 321, 467, 601, 746, 876, 1024]
for row, action in enumerate(('hungry', 'thirsty', 'drink', 'sleepy', 'lonely', 'pet', 'joy')):
    for col in range(4):
        sheet.crop((xs[col], ys[row], xs[col + 1], ys[row + 1])).save(out / f'{action}_{col+1:02}.png')
