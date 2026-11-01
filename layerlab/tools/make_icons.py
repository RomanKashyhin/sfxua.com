"""SFX Lab: ten desktop-icon variants to choose from.
    py -3.11 layerlab/tools/make_icons.py            -> layerlab/desktop/icons/v01..v10.png + sheet.png
    py -3.11 layerlab/tools/make_icons.py 7          -> also writes layerlab/desktop/icon.png + icon.ico from variant 7
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'desktop', 'icons')
DESKTOP = os.path.join(HERE, '..', 'desktop')
N = 512
BG = (21, 24, 29, 255)
EDGE = (58, 65, 76, 255)
AMBER = (245, 184, 74)
TEAL = (79, 209, 161)
VIOLET = (167, 139, 250)
BLUE = (56, 189, 248)
FONT = next((f for f in [r'C:\Windows\Fonts\bahnschrift.ttf', r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf'] if os.path.exists(f)), None)


def base(radius=110, fill=BG):
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((16, 16, N - 16, N - 16), radius=radius, fill=fill, outline=EDGE, width=4)
    return img


def glow(img, draw_fn, blur=26):
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    draw_fn(ImageDraw.Draw(img))


def text(img, s, size, col, y=None, font=FONT):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(font, size) if font else ImageFont.load_default()
    box = d.textbbox((0, 0), s, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (N - w) // 2 - box[0]
    yy = (N - h) // 2 - box[1] if y is None else y - box[1]
    glow(img, lambda g: g.text((x, yy), s, font=f, fill=col + (255,)), blur=18)


def v01():  # ring + three layers (current)
    img = base()
    glow(img, lambda g: g.ellipse((104, 104, N - 104, N - 104), outline=AMBER + (255,), width=10))
    ImageDraw.Draw(img).ellipse((132, 132, N - 132, N - 132), fill=(14, 16, 19, 255))
    d = ImageDraw.Draw(img)
    for i, (w, col) in enumerate([(150, VIOLET), (190, TEAL), (230, AMBER)]):
        y = 214 + i * 46
        d.rounded_rectangle((N // 2 - w // 2, y, N // 2 + w // 2, y + 26), radius=13, fill=col + (255,))
    return img


def v02():  # equalizer bars
    img = base()
    hs = [120, 220, 330, 250, 170, 290, 140]
    cols = [TEAL, AMBER, AMBER, VIOLET, AMBER, TEAL, VIOLET]
    x0, w, gap = 96, 36, 12
    for i, (h, c) in enumerate(zip(hs, cols)):
        x = x0 + i * (w + gap)
        glow(img, lambda g, x=x, h=h, c=c: g.rounded_rectangle((x, N // 2 - h // 2, x + w, N // 2 + h // 2), radius=18, fill=c + (255,)), blur=14)
    return img


def v03():  # SFX letters
    img = base()
    text(img, 'SFX', 210, AMBER, y=150)
    text(img, 'LAB', 86, TEAL, y=372)
    return img


def v04():  # knob
    img = base()
    d = ImageDraw.Draw(img)
    glow(img, lambda g: g.arc((88, 88, N - 88, N - 88), start=135, end=405, fill=(70, 78, 90, 255), width=16), blur=0)
    glow(img, lambda g: g.arc((88, 88, N - 88, N - 88), start=135, end=330, fill=AMBER + (255,), width=16), blur=20)
    d = ImageDraw.Draw(img)
    d.ellipse((150, 150, N - 150, N - 150), fill=(32, 37, 44, 255), outline=(70, 78, 90, 255), width=3)
    a = math.radians(330)
    cx, cy = N / 2, N / 2
    glow(img, lambda g: g.line((cx + 40 * math.cos(a), cy + 40 * math.sin(a), cx + 92 * math.cos(a), cy + 92 * math.sin(a)), fill=AMBER + (255,), width=18), blur=14)
    return img


def v05():  # concentric distance rings + dot
    img = base()
    for r, c, w in [(60, AMBER, 12), (120, AMBER, 9), (180, TEAL, 7), (236, TEAL, 5)]:
        glow(img, lambda g, r=r, c=c, w=w: g.ellipse((N // 2 - r, N // 2 - r, N // 2 + r, N // 2 + r), outline=c + (255,), width=w), blur=12)
    glow(img, lambda g: g.ellipse((N // 2 - 22, N // 2 - 22, N // 2 + 22, N // 2 + 22), fill=AMBER + (255,)), blur=16)
    return img


def v06():  # hub with four nodes (scheme)
    img = base()
    cx, cy = N // 2, N // 2
    pts = [(120, 150), (120, 362), (392, 150), (392, 362)]
    for px, py in pts:
        glow(img, lambda g, px=px, py=py: g.line((px, py, cx, cy), fill=AMBER + (200,), width=6), blur=10)
    for px, py in pts:
        glow(img, lambda g, px=px, py=py: g.rounded_rectangle((px - 44, py - 30, px + 44, py + 30), radius=16, fill=(30, 34, 41, 255), outline=AMBER + (255,), width=4), blur=8)
    glow(img, lambda g: g.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), fill=(14, 16, 19, 255), outline=AMBER + (255,), width=8), blur=22)
    return img


def v07():  # isometric stacked layers
    img = base()
    cx = N // 2
    for i, (c, dy) in enumerate([(VIOLET, 0), (TEAL, 70), (AMBER, 140)]):
        y = 150 + dy
        poly = [(cx, y), (cx + 170, y + 70), (cx, y + 140), (cx - 170, y + 70)]
        glow(img, lambda g, poly=poly, c=c: g.polygon(poly, fill=c + (255,), outline=(14, 16, 19, 255)), blur=10)
    return img


def v08():  # whoosh bolt
    img = base()
    pts = [(300, 70), (150, 290), (250, 290), (205, 450), (370, 215), (265, 215)]
    glow(img, lambda g: g.polygon(pts, fill=VIOLET + (255,)), blur=24)
    return img


def v09():  # film frame + waveform
    img = base()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((80, 120, N - 80, N - 120), radius=26, fill=(14, 16, 19, 255), outline=(70, 78, 90, 255), width=4)
    for x in range(104, N - 90, 48):
        d.rounded_rectangle((x, 132, x + 24, 150), radius=5, fill=(70, 78, 90, 255))
        d.rounded_rectangle((x, N - 150, x + 24, N - 132), radius=5, fill=(70, 78, 90, 255))
    pts = []
    for i in range(0, 300):
        x = 106 + i
        y = N / 2 + math.sin(i / 14) * 60 * math.sin(i / 95) + math.sin(i / 3.3) * 14
        pts.append((x, y))
    glow(img, lambda g: g.line(pts, fill=AMBER + (255,), width=8, joint='curve'), blur=14)
    return img


def v10():  # footprint + wave
    img = base()
    # сапог-след: пятка и носок
    glow(img, lambda g: g.ellipse((150, 230, 250, 400), fill=AMBER + (255,)), blur=14)
    glow(img, lambda g: g.ellipse((160, 110, 260, 240), fill=AMBER + (255,)), blur=14)
    pts = [(290, 300 + math.sin(i / 10) * (40 if i < 120 else 18)) for i in range(0, 170)]
    pts = [(290 + i, y) for i, (_, y) in enumerate(pts)]
    glow(img, lambda g: g.line(pts, fill=TEAL + (255,), width=10, joint='curve'), blur=12)
    return img


VARIANTS = [v01, v02, v03, v04, v05, v06, v07, v08, v09, v10]
NAMES = ['кольцо и слои', 'эквалайзер', 'буквы SFX', 'крутилка', 'кольца дистанции', 'схема-узел', 'слои изометрия', 'вжух-молния', 'кадр и волна', 'след и волна']


def sheet(imgs):
    cell, pad = 200, 24
    cols = 5
    rows = math.ceil(len(imgs) / cols)
    W = cols * (cell + pad) + pad
    H = rows * (cell + pad + 34) + pad
    s = Image.new('RGBA', (W, H), (10, 12, 15, 255))
    d = ImageDraw.Draw(s)
    f = ImageFont.truetype(FONT, 22) if FONT else ImageFont.load_default()
    for i, im in enumerate(imgs):
        x = pad + (i % cols) * (cell + pad)
        y = pad + (i // cols) * (cell + pad + 34)
        s.alpha_composite(im.resize((cell, cell), Image.LANCZOS), (x, y))
        d.text((x + 4, y + cell + 6), f'{i + 1}. {NAMES[i]}', font=f, fill=(233, 236, 240, 255))
    return s


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    imgs = []
    for i, fn in enumerate(VARIANTS):
        im = fn()
        im.save(os.path.join(OUT, f'v{i + 1:02d}.png'))
        imgs.append(im)
    sheet(imgs).save(os.path.join(OUT, 'sheet.png'))
    if len(sys.argv) > 1:
        k = int(sys.argv[1]) - 1
        imgs[k].save(os.path.join(DESKTOP, 'icon.png'))
        imgs[k].save(os.path.join(DESKTOP, 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        print('icon <-', k + 1)
    print('ok', OUT)
