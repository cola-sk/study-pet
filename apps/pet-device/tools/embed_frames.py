"""Embed prepared frames in LVGL, choosing PNG or RGB565 per frame by size.

After TinyPNG optimization: python3 apps/pet-device/tools/embed_frames.py
PNG is used only when its encoded bytes are smaller than raw RGB565 pixels.
The original frame dimensions and RGB565 fallback remain supported.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ACTIONS = ('idle','eat','happy','sleep','hungry','thirsty','drink','sleepy','lonely','pet','play','bath','treat','dress','achievement','stretch')

def embed(frame_dir=ROOT/'preview/frames', output=ROOT/'main/husky_frames.c'):
    records=[]; parts=['#include "lvgl.h"\n#include "husky_frames.h"\n']
    for action in ACTIONS:
        for n in range(1,5):
            name=f'{action}_{n:02}'; path=frame_dir/f'{name}.png'
            encoded=path.read_bytes()
            with Image.open(path) as image:
                if image.format!='PNG' or image.size!=(140,132): raise ValueError(f'Invalid frame: {name}')
                rgb=image.convert('RGB'); raw=bytearray()
                for r,g,b in rgb.getdata():
                    value=((r>>3)<<11)|((g>>2)<<5)|(b>>3)
                    raw.extend((value&255,value>>8))
            use_png=len(encoded)<len(raw)
            data=encoded if use_png else raw
            cf='LV_IMG_CF_RAW_ALPHA' if use_png else 'LV_IMG_CF_TRUE_COLOR'
            parts.append(f'static const uint8_t {name}_data[] = {{\n')
            parts.extend('  '+','.join(f'0x{x:02x}' for x in data[i:i+24])+',\n' for i in range(0,len(data),24))
            parts.append('};\n')
            parts.append(f'const lv_img_dsc_t husky_{name} = {{ .header.cf = {cf}, .header.w = 140, .header.h = 132, .data_size = sizeof({name}_data), .data = {name}_data }};\n')
            records.append({'name':name,'format':'png' if use_png else 'rgb565','encoded_bytes':len(data),'rgb565_bytes':len(raw)})
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix('.tmp');temporary.write_text(''.join(parts));temporary.replace(output)
    total=sum(r['encoded_bytes'] for r in records); raw=sum(r['rgb565_bytes'] for r in records)
    print(f'Embedded {len(records)} frames: {total} bytes vs RGB565 {raw} bytes ({(1-total/raw)*100:.1f}% smaller)')
    return records

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--frames',type=Path,default=ROOT/'preview/frames');parser.add_argument('--output',type=Path,default=ROOT/'main/husky_frames.c');parser.add_argument('--report',type=Path)
    args=parser.parse_args();report=embed(args.frames,args.output)
    if args.report:args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
