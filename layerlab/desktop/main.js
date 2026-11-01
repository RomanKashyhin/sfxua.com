// SFX Lab · настольная оболочка (Electron).
// Поднимает тот же сервер, что layerlab/serve.py (корень репозитория + монтирования из mounts.json,
// байтовые диапазоны для видео, без кэша), и открывает окно с layerlab/index.html.
// Запуск: SFXLab.cmd в папке layerlab (ставит Electron при первом запуске).
const { app, BrowserWindow, Menu, globalShortcut, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');                     // корень репозитория: /layerlab/index.html
const MOUNTS_FILE = path.join(HERE, '..', 'mounts.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
                '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function mounts() {
  try { return JSON.parse(fs.readFileSync(MOUNTS_FILE, 'utf8')); } catch (e) { return {}; }
}
function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  for (const [prefix, folder] of Object.entries(mounts())) {
    if (clean.startsWith(prefix)) {
      const full = path.normalize(path.join(folder, clean.slice(prefix.length)));
      return full.startsWith(path.normalize(folder)) ? full : null;
    }
  }
  const full = path.normalize(path.join(ROOT, clean));
  return full.startsWith(ROOT) ? full : null;
}

function serve(req, res) {
  const file = resolvePath(req.url);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  const size = fs.statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1;
  if (range) {
    if (range[1]) { start = +range[1]; end = range[2] ? Math.min(+range[2], size - 1) : size - 1; }
    else { start = Math.max(0, size - +range[2]); }
    if (start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    head['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  head['Content-Length'] = end - start + 1;
  res.writeHead(range ? 206 : 200, head);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());                          // браузер бросил диапазон при перемотке — норма
  stream.pipe(res);
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1100, minHeight: 700, backgroundColor: '#0f1113', title: 'SFX Lab',
    icon: path.join(HERE, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://127.0.0.1:${port}/layerlab/index.html`);
  win.webContents.on('did-fail-load', (e, code, desc) => dialog.showErrorBox('SFX Lab', `Страница не загрузилась: ${desc} (${code})`));
  globalShortcut.register('F12', () => win.webContents.toggleDevTools());
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  globalShortcut.register('F5', () => win.webContents.reload());
  return win;
}

app.whenReady().then(() => {
  const server = http.createServer(serve);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    console.log(`SFX Lab: http://127.0.0.1:${port}/layerlab/index.html  root ${ROOT}`);
    for (const [k, v] of Object.entries(mounts())) console.log(`  mount ${k} -> ${v}  ${fs.existsSync(v) ? 'ok' : 'MISSING'}`);
    createWindow(port);
  });
  app.on('window-all-closed', () => { globalShortcut.unregisterAll(); server.close(); app.quit(); });
});
