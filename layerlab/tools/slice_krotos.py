# SFX Lab · приземления тела на металл / бетон / землю / паркет из Krotos Hand-to-Hand Combat → тяжёлые удары.
# В файлах «Takedown Grab Throw Foley …» захват, бросок и приземление; берём самый громкий всплеск после 0,4 с
# (это приземление) и всё, что за ним; «Collapse Fall Concrete» — падение после удара, берём всплеск после 0,3 с.
# Пишем 48 кГц 24 бит стерео в media/vfa-extra/Krotos_<Материал>/NN.wav и дописываем index.json.
import os, json, glob, wave, numpy as np
SRC = r"D:/AudioLibrary/KROTOS/Krotos Hand-to-Hand Combat SFX Library WAV/Hand-to-Hand Combat/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media', 'vfa-extra')
SETS = { 'Krotos_Metal': ('Takedown Grab Throw Foley Metal', 0.4), 'Krotos_Dirt': ('Takedown Grab Throw Foley Dirt', 0.4),
         'Krotos_Parquet': ('Takedown Grab Throw Foley Parquet', 0.4), 'Krotos_Concrete': ('Punch Whoosh Impact Collapse Fall Concrete', 0.3) }
SR_OUT = 48000

def read(path):
    w = wave.open(path); sr, n, sw, ch = w.getframerate(), w.getnframes(), w.getsampwidth(), w.getnchannels(); raw = w.readframes(n); w.close()
    a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
    x = a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)
    x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float64) / (1 << 23)
    return sr, x.reshape(-1, ch)
def write24(path, x, sr):
    y = np.clip(x, -1, 1); i = np.round(y * ((1 << 23) - 1)).astype(np.int32).reshape(-1)
    b = np.empty((i.size, 3), np.uint8); b[:, 0] = i & 255; b[:, 1] = (i >> 8) & 255; b[:, 2] = (i >> 16) & 255
    w = wave.open(path, 'wb'); w.setnchannels(x.shape[1]); w.setsampwidth(3); w.setframerate(sr); w.writeframes(b.tobytes()); w.close()
def resample_half(x):
    n = 63; t = np.arange(n) - (n - 1) / 2; h = np.sinc(t / 2) / 2 * np.hamming(n); h /= h.sum()
    return np.stack([np.convolve(x[:, c], h, mode='same') for c in range(x.shape[1])], 1)[::2]

def main():
    os.makedirs(OUT, exist_ok=True)
    ip = os.path.join(OUT, 'index.json'); idx = json.load(open(ip, encoding='utf-8')) if os.path.exists(ip) else { 'sets': {} }
    for name, (folder, after) in SETS.items():
        out_dir = os.path.join(OUT, name); os.makedirs(out_dir, exist_ok=True)
        for f in os.listdir(out_dir): os.remove(os.path.join(out_dir, f))
        items = []
        for n, path in enumerate(sorted(glob.glob(SRC + folder + '/*.wav')), 1):
            sr, x = read(path); mono = np.abs(x).max(1); hop = int(sr * 0.005)
            env = np.array([mono[i:i + hop].max() for i in range(0, len(mono) - hop, hop)])
            start = int(after / 0.005); i = start + int(np.argmax(env[start:]))
            db = 20 * np.log10(env + 1e-9); j = i
            while j > start and db[j - 1] < db[i] - 1 and db[i] - db[j - 1] < 30: j -= 1   # назад к началу всплеска
            a = max(0, (j - 2) * hop); seg = x[a:].copy()
            fade = min(len(seg), int(sr * 0.002)); seg[:fade] *= np.linspace(0, 1, fade)[:, None]
            tail = min(len(seg), int(sr * 0.05)); seg[-tail:] *= np.linspace(1, 0, tail)[:, None]
            seg = resample_half(seg) if sr == 2 * SR_OUT else seg
            fn = f'{n:02d}.wav'; write24(os.path.join(out_dir, fn), seg, SR_OUT)
            items.append({ 'f': fn, 'peak': round(float(20 * np.log10(np.abs(seg).max() + 1e-9)), 1), 'rms': round(float(20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)), 1), 'sec': round(len(seg) / SR_OUT, 3) })
        idx['sets'][name] = items
        print(name, len(items), 'файлов', min(i['sec'] for i in items), '…', max(i['sec'] for i in items), 'с')
    idx['source'] = (idx.get('source', '') + '; Krotos Hand-to-Hand Combat landings sliced from the loudest late onset').strip('; ')
    json.dump(idx, open(ip, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('index.json обновлён')

if __name__ == '__main__': main()
