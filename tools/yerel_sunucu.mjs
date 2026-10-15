/**
 * Yerel gelistirme sunucusu — module/fetch çalışsın diye (file:// yetmez).
 *   node tools/yerel_sunucu.mjs [port]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const PORT = Number(process.argv[2]) || 8099;

const TIPLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const sunucu = http.createServer((istek, yanit) => {
  let yol = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
  if (yol === '/') yol = '/maliyet-motoru.html';

  const tam = path.join(KOK, 'web', yol);
  // dizin disina cikis engeli
  if (!tam.startsWith(path.join(KOK, 'web'))) {
    yanit.writeHead(403).end('Yasak');
    return;
  }

  fs.readFile(tam, (hata, veri) => {
    if (hata) {
      yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      yanit.end(`Bulunamadi: ${yol}`);
      return;
    }
    yanit.writeHead(200, {
      'Content-Type': TIPLER[path.extname(tam).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    yanit.end(veri);
  });
});

sunucu.listen(PORT, () => {
  console.log(`Yerel sunucu: http://localhost:${PORT}/`);
  console.log('Durdurmak icin Ctrl+C');
});