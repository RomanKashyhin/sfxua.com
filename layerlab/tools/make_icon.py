"""LayerLab app icon: dark rounded square, amber glowing ring, three stacked layer bars.
    py -3.11 layerlab/tools/make_icon.py   -> layerlab/desktop/icon.png + icon.ico
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'desktop')
N = 512
AMBER = (245, 184, 74)
TEAL = (79, 209, 161)
VIOLET = (167, 139, 250)


def rounded(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def build():
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded(d, (16, 16, N - 16, N - 16), 110, (21, 24, 29, 255), (58, 65, 76, 255), 4)

    # glow behind the ring
    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((96, 96, N - 96, N - 96), outline=AMBER + (255,), width=34)
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    img.alpha_composite(glow)

    d = ImageDraw.Draw(img)
    d.ellipse((104, 104, N - 104, N - 104), outline=AMBER + (255,), width=10)
    d.ellipse((132, 132, N - 132, N - 132), fill=(14, 16, 19, 255))

    # three layer bars: violet / teal / amber, narrowing upwards
    cx = N // 2
    for i, (w, col) in enumerate([(150, VIOLET), (190, TEAL), (230, AMBER)]):
        y = 214 + i * 46
        rounded(d, (cx - w // 2, y, cx + w // 2, y + 26), 13, col + (255,))
    # soft inner highlight
    hl = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    h = ImageDraw.Draw(hl)
    h.ellipse((150, 120, N - 150, 230), fill=(255, 255, 255, 26))
    hl = hl.filter(ImageFilter.GaussianBlur(30))
    img.alpha_composite(hl)
    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    img = build()
    img.save(os.path.join(OUT, 'icon.png'))
    img.save(os.path.join(OUT, 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print('ok', os.path.join(OUT, 'icon.ico'))
