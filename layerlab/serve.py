"""SFX Lab (LayerLab) dev server: the repository root plus sound libraries mounted from other drives.

    py -3.11 layerlab/serve.py 5174      -> http://127.0.0.1:5174/layerlab/index.html

Mounts (URL prefix -> folder on disk) live in layerlab/mounts.json, for example
    { "/vfa/": "D:/AudioLibrary/BOOM Library - Virtual Foley Artist Footsteps/PART 1/Virtual Foley Artist - Footsteps/Samples" }
Caching is off; byte ranges (206) are answered so a video can be sought before it is loaded.
"""
import http.server
import json
import os
import sys
import urllib.parse
from functools import partial

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
MOUNTS = {}
mounts_path = os.path.join(HERE, 'mounts.json')
if os.path.exists(mounts_path):
    MOUNTS = json.load(open(mounts_path, encoding='utf-8'))


class Handler(http.server.SimpleHTTPRequestHandler):
    # POST /_save/<имя файла> — сохранить тело запроса в layerlab/media/export (только для dev-сервера:
    # так Claude забирает архивы, выгнанные в браузере; в Electron этого нет)
    def do_POST(self):
        if not self.path.startswith('/_save/'):
            self.send_response(404); self.end_headers(); return
        name = os.path.basename(urllib.parse.unquote(self.path[len('/_save/'):]))
        out_dir = os.path.join(HERE, 'media', 'export'); os.makedirs(out_dir, exist_ok=True)
        n = int(self.headers.get('Content-Length', 0)); data = self.rfile.read(n)
        with open(os.path.join(out_dir, name), 'wb') as f: f.write(data)
        body = json.dumps({'saved': name, 'bytes': n}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.webp': 'image/webp',
                      '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.json': 'application/json',
                      '.mp4': 'video/mp4', '.webm': 'video/webm'}

    def translate_path(self, path):
        clean = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0])
        for prefix, folder in MOUNTS.items():
            if clean.startswith(prefix):
                rel = os.path.normpath(clean[len(prefix):]).lstrip('\\/')
                full = os.path.normpath(os.path.join(folder, rel))
                if full.startswith(os.path.normpath(folder)):
                    return full
        return super().translate_path(path)

    def send_head(self):
        rng = self.headers.get('Range', '')
        path = self.translate_path(self.path)
        if not rng.startswith('bytes=') or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, _, b = rng[6:].split(',')[0].partition('-')
        start = int(a) if a else max(0, size - int(b))
        end = min(int(b), size - 1) if (a and b) else size - 1
        if start >= size:
            self.send_response(416); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers()
            return None
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self._range = (f, end - start + 1)
        return f

    def copyfile(self, source, outputfile):
        rng = getattr(self, '_range', None)
        if not rng:
            return super().copyfile(source, outputfile)
        f, left = rng
        try:
            while left > 0:
                chunk = f.read(min(1 << 16, left))
                if not chunk:
                    break
                outputfile.write(chunk); left -= len(chunk)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass  # the browser dropped a range request (normal while seeking video)
        self._range = None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '206' not in str(args) and '200' not in str(args):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print(f'SFX Lab: http://127.0.0.1:{PORT}/layerlab/index.html  (root {ROOT})')
    for k, v in MOUNTS.items():
        print(f'  mount {k} -> {v}  {"ok" if os.path.isdir(v) else "MISSING"}')
    http.server.ThreadingHTTPServer(('0.0.0.0', PORT), partial(Handler, directory=ROOT)).serve_forever()
