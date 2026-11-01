# SFX Lab · нарезка демо-записей BOOM VFA (PART 2, один wav на поверхность, 96 кГц) на отдельные шаги.
# В PART 1 трава и лужи не нарезаны по пятке/носку, есть только демо-прогулки; между шагами в них цифровая тишина,
# поэтому режем по тишине: каждый кусок = один шаг (пятка + носок вместе). Пишем 48 кГц 24 бит стерео в
# media/vfa-extra/<Имя>/NN.wav и index.json с громкостью каждого куска (движок делит их на три зоны силы).
#   py -3.11 layerlab/tools/slice_demo.py            (все: Grass, Puddle)
import os, sys, json, wave, numpy as np

SRC = r"D:/AudioLibrary/BOOM Library - Virtual Foley Artist Footsteps/PART 2/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media', 'vfa-extra')
NAMES = { 'Grass': 'VFAFS Generic Grass.wav', 'Puddle': 'VFAFS Generic Puddle.wav' }
SR_OUT = 48000

def read(path):
    w = wave.open(path); sr, n, sw, ch = w.getframerate(), w.getnframes(), w.getsampwidth(), w.getnchannels()
    raw = w.readframes(n); w.close()
    if sw == 3:
        a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        x = a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)
        x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float64) / (1 << 23)
    else:
        x = np.frombuffer(raw, dtype={2: np.int16, 4: np.int32}[sw]).astype(np.float64) / (2 ** (8 * sw - 1))
    return sr, x.reshape(-1, ch)

def write24(path, x, sr):
    y = np.clip(x, -1, 1); i = np.round(y * ((1 << 23) - 1)).astype(np.int32)
    b = np.empty((i.size, 3), np.uint8); flat = i.reshape(-1)
    b[:, 0] = flat & 0xFF; b[:, 1] = (flat >> 8) & 0xFF; b[:, 2] = (flat >> 16) & 0xFF
    w = wave.open(path, 'wb'); w.setnchannels(x.shape[1]); w.setsampwidth(3); w.setframerate(sr); w.writeframes(b.tobytes()); w.close()

def resample_half(x):
    """96 кГц → 48 кГц: оконный sinc (63 отвода) и каждый второй отсчёт"""
    n = 63; t = np.arange(n) - (n - 1) / 2; h = np.sinc(t / 2) / 2 * np.hamming(n); h /= h.sum()
    return np.stack([np.convolve(x[:, c], h, mode='same') for c in range(x.shape[1])], 1)[::2]

def slice_file(name, fname):
    sr, x = read(SRC + fname)
    mono = x.mean(1); hop = int(sr * 0.005)
    env = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2)) for i in range(0, len(mono) - hop, hop)])
    db = 20 * np.log10(env + 1e-9); peak = db.max()
    # начала шагов: подъём > 10 дБ за 30 мс, выше пика −32 дБ, не чаще чем раз в 200 мс
    on = []; last = -1e9
    for i in range(6, len(db)):
        if db[i] - db[i - 6] > 10 and db[i] > peak - 32 and (i - last) * 0.005 > 0.2: on.append(i); last = i
    pieces = []
    for k, i in enumerate(on):
        a = max(0, i - 1)                                     # 5 мс до начала
        b = (on[k + 1] - 2) if k + 1 < len(on) else len(db)   # до следующего шага
        b = min(b, i + 300)                                   # но не длиннее 1,5 с
        j = i + 8                                             # хвост: обрезаем, когда 60 мс подряд тише −70 dBFS
        while j < b:
            if db[j:j + 12].max() < -70: b = j; break
            j += 1
        pieces.append((a * hop, min(len(x), b * hop)))
    out_dir = os.path.join(OUT, name); os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir): os.remove(os.path.join(out_dir, f))
    index = []
    for n, (a, b) in enumerate(pieces, 1):
        seg = x[a:b]
        fade = min(len(seg), int(sr * 0.003)); seg[:fade] *= np.linspace(0, 1, fade)[:, None]
        tail = min(len(seg), int(sr * 0.03)); seg[-tail:] *= np.linspace(1, 0, tail)[:, None]
        seg = resample_half(seg) if sr == 2 * SR_OUT else seg
        peak = 20 * np.log10(np.abs(seg).max() + 1e-9); rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
        fn = f'{n:02d}.wav'; write24(os.path.join(out_dir, fn), seg, SR_OUT)
        index.append({ 'f': fn, 'peak': round(float(peak), 1), 'rms': round(float(rms), 1), 'sec': round(len(seg) / SR_OUT, 3) })
    print(name, len(pieces), 'шагов', 'длина', min(p['sec'] for p in index), '…', max(p['sec'] for p in index), 'с')
    return index

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    idx = {}
    for name, fname in NAMES.items():
        if not os.path.exists(SRC + fname): print('нет файла', fname); continue
        idx[name] = slice_file(name, fname)
    json.dump({ 'source': 'BOOM Library Virtual Foley Artist Footsteps, PART 2 demo walks, sliced by silence', 'sets': idx },
              open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('index.json готов')
