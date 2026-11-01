# SFX Lab · процедурные картинки поверхностей для плиток выбора (img/surf/*.png, 320×200).
# Не ИИ-картинки: шум, зёрна, доски и штрихи считаются numpy'ем, чтобы плитки выглядели как фото фактуры.
import os, sys, numpy as np
from PIL import Image, ImageFilter, ImageDraw

W, H = 320, 200
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'surf')
rng = np.random.default_rng(7)

def noise(scale, w=W, h=H):
    """гладкий шум 0..1 с характерным размером scale px"""
    small = rng.random((max(2, h // scale + 2), max(2, w // scale + 2)))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    a = np.asarray(img).astype(np.float32) / 255
    return (a - a.min()) / (a.max() - a.min() + 1e-6)

def grain(amount=0.06):
    return rng.normal(0, amount, (H, W)).astype(np.float32)

def to_img(lum, tint, contrast=1.0):
    """lum 0..1 → RGB с оттенком tint (r,g,b множители) + лёгкая виньетка"""
    lum = np.clip((lum - 0.5) * contrast + 0.5, 0, 1)
    yy, xx = np.mgrid[0:H, 0:W]
    vig = 1 - 0.18 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    rgb = np.stack([lum * tint[i] * vig for i in range(3)], -1)
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))

def stones(count, rmin, rmax, base, light, dark):
    """гравий: случайные камешки с тенью и бликом"""
    lum = np.full((H, W), base, np.float32) + grain(0.04)
    img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8)).convert('L')
    d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = rng.random() * W, rng.random() * H
        r = rng.uniform(rmin, rmax); r2 = r * rng.uniform(0.6, 1.0); ang = rng.random() * 180
        shade = rng.uniform(dark, light)
        ellipse = Image.new('L', (int(2 * r) + 6, int(2 * r) + 6), 0)
        ImageDraw.Draw(ellipse).ellipse([3, 3 + (r - r2), 3 + 2 * r, 3 + r + r2], fill=int(shade * 255))
        ellipse = ellipse.rotate(ang, expand=False)
        shadow = ellipse.point(lambda v: int(v * 0.35)).filter(ImageFilter.GaussianBlur(2))
        img.paste(0, (int(x - r) + 2, int(y - r) + 3), shadow)
        img.paste(ellipse, (int(x - r), int(y - r)), ellipse)
    a = np.asarray(img).astype(np.float32) / 255
    return a + grain(0.03)

def concrete(gritty):
    lum = 0.46 + 0.10 * (noise(40) - 0.5) + 0.06 * (noise(8) - 0.5) + grain(0.035)
    if gritty:
        lum += 0.12 * (noise(3) - 0.5) + grain(0.06)
        img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8))
        d = ImageDraw.Draw(img)
        for _ in range(900):
            x, y = rng.random() * W, rng.random() * H; r = rng.uniform(0.6, 2.2)
            d.ellipse([x, y, x + r, y + r], fill=int(rng.uniform(40, 200)))
        lum = np.asarray(img).astype(np.float32) / 255
    return lum

def metal():
    lines = np.cumsum(rng.normal(0, 1, (H, 1)), 0); lines = (lines - lines.min()) / (lines.max() - lines.min() + 1e-6)
    brush = np.repeat(rng.normal(0, 0.05, (H, 1)), W, 1) + np.asarray(Image.fromarray((rng.random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((6, 0.4)))).astype(np.float32) / 255 * 0.25
    yy, xx = np.mgrid[0:H, 0:W]
    sheen = 0.18 * np.exp(-(((xx + yy * 0.6) - 230) / 90) ** 2)
    return 0.42 + 0.12 * (lines - 0.5) + brush - 0.12 + sheen + grain(0.02)

def sand():
    yy, xx = np.mgrid[0:H, 0:W]
    ripples = 0.08 * np.sin(yy / 9 + 3 * noise(60) + xx / 120) * (0.5 + noise(50))
    return 0.6 + ripples + 0.10 * (noise(5) - 0.5) + grain(0.05)

def planks(plank_h, plank_w, stagger, gap=3):
    lum = np.zeros((H, W), np.float32)
    img = Image.fromarray(np.zeros((H, W), np.uint8)); d = ImageDraw.Draw(img)
    row = 0; y = -rng.uniform(0, plank_h)
    while y < H:
        x = -(row * stagger) % plank_w - plank_w
        while x < W:
            base = rng.uniform(0.38, 0.62)
            d.rectangle([x + gap / 2, y + gap / 2, x + plank_w - gap / 2, y + plank_h - gap / 2], fill=int(base * 255))
            x += plank_w
        y += plank_h; row += 1
    base = np.asarray(img).astype(np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W]
    grainlines = 0.10 * np.sin(yy * 0.9 + 6 * noise(70) + xx / 25) * (0.4 + 0.6 * noise(30))
    fine = 0.05 * (noise(2) - 0.5)
    lum = base + grainlines * (base > 0.05) + fine + grain(0.02)
    lum[base < 0.05] = 0.12   # щели
    return lum

def grass():
    """трава: зелёный шум плюс штрихи-травинки"""
    lum = 0.42 + 0.12 * (noise(30) - 0.5) + 0.08 * (noise(4) - 0.5) + grain(0.03)
    img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8)); d = ImageDraw.Draw(img)
    for _ in range(2600):
        x, y = rng.random() * W, rng.random() * H; L = rng.uniform(6, 16); ang = rng.uniform(-0.6, 0.6)
        d.line([x, y, x + L * np.sin(ang), y - L * np.cos(ang)], fill=int(rng.uniform(70, 230)), width=1)
    return np.asarray(img).astype(np.float32) / 255

def snow():
    """снег: белый, мягкие сугробы, редкие блёстки"""
    lum = 0.86 + 0.08 * (noise(50) - 0.5) + 0.05 * (noise(6) - 0.5) + grain(0.02)
    img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8)); d = ImageDraw.Draw(img)
    for _ in range(140):
        x, y = rng.random() * W, rng.random() * H; d.point([x, y], fill=255)
    return np.asarray(img).astype(np.float32) / 255

SURFACES = {
    'grass':           (grass,                                           (0.62, 0.95, 0.40), 1.05),
    'snow':            (snow,                                            (0.96, 0.98, 1.00), 0.9),
    'concrete_clean':  (lambda: concrete(False),                         (1.00, 1.00, 1.00), 1.0),
    'concrete_gritty': (lambda: concrete(True),                          (1.00, 0.98, 0.95), 1.1),
    'gravel_light':    (lambda: stones(1400, 3, 7, 0.30, 0.80, 0.40),    (1.00, 0.97, 0.92), 1.0),
    'gravel_medium':   (lambda: stones(380, 8, 17, 0.26, 0.85, 0.35),    (1.00, 0.96, 0.90), 1.0),
    'metal':           (metal,                                           (0.90, 0.95, 1.05), 1.15),
    'sand':            (sand,                                            (1.00, 0.90, 0.68), 0.9),
    'wood_parquet':    (lambda: planks(34, 88, 44),                      (1.00, 0.76, 0.48), 1.0),
    'wood_plank':      (lambda: planks(50, 420, 160),                    (0.95, 0.70, 0.42), 1.0),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, (fn, tint, contrast) in SURFACES.items():
        img = to_img(fn(), tint, contrast)
        img.quantize(192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(OUT, name + '.png'), optimize=True)   # палитра: файл в 2–3 раза меньше
        print(name, os.path.getsize(os.path.join(OUT, name + '.png')))
