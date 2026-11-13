# Shop font

`shop_cjk.c` is generated from [Noto Sans SC](https://github.com/notofonts/noto-cjk/blob/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf), licensed under SIL Open Font License 1.1 (`OFL.txt`).

It covers U+4E00–U+9FFF with fixed 11×11, 1-bit glyphs. ASCII falls back to LVGL's default font. This keeps the font in the existing firmware partition without moving persistent data. Rebuild with `python3 tools/generate_device_shop_font.py /path/to/NotoSansSC-VF.ttf` (Pillow required).
