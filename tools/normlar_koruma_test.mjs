/**
 * Kalibrasyon (normlar.json) koruma testi
 *
 * NEDEN VAR:
 *   normlar.json yüklenemezse motor.js:239 `kitap.meta.iscilikEkOrani` (0,35)
 *   yedeğine düşüyordu. Ölçülen sonuç: 100 kVA örneğinde toplam
 *   750.499 TL yerine 1.121.668 TL — %49,46 sapma, KULLANICIYA UYARI YOK.
 *   Kaybolan sadece işçilik oranı değil; normlar.iskontoOranlari.varsayilan
 *   (0,65) de aynı dosyada.
 *
 * BU TEST NE YAPAR:
 *   Alt süreçte normlar.json isteğini 404'e düşürüp maliyet-motoru.js'i
 *   gerçekten çalıştırır. Beklenen: HİÇBİR toplam basılmaz, hata kutusu
 *   eklenir, hesap düğmesi kilitlenir.
 *
 *   Ana test dosyası (arayuz_test.mjs) ESM modülünü bir kez çalıştırdığı
 *   için ikinci senaryoyu orada kurmak mümkün değil — modül önbelleğe girer.
 *   Bu yüzden ayrı dosya.
 *
 *   node tools/normlar_koruma_test.mjs
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const WEB = path.join(KOK, 'web');

let gecti = 0, kaldi = 0;
const hatalar = [];

function ok(ad, kosul, ek = '') {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; hatalar.push(ad + (ek ? ` — ${ek}` : '')); console.log(`  ✗ ${ad}${ek ? ' — ' + ek : ''}`); }
}

console.log('\n=== Kalibrasyon (normlar.json) koruma testi ===');

// ------------------------------------------------------------------ alt süreç
// normlar.json -> 404 veren bir ortam. Bunu yapmak için en küçük DOM taklidi
// yeterli: normlar hata verdiğinde kod kitaba hiç dokunmadan catch'e düşer,
// bu yüzden select/option taklidine gerek yok.
const cocuk = `
import { pathToFileURL } from 'node:url';

const WEB = ${JSON.stringify(WEB)};
const yazilan = { toplam: '', kutular: [], disabled: [] };

const elemanlar = new Map();
function eleman(id) {
  if (elemanlar.has(id)) return elemanlar.get(id);
  const e = {
    id, value: '', innerHTML: '', textContent: '',
    children: [], hidden: false, disabled: false, style: {},
    get classList() {
      const s = new Set();
      return { add: (c) => s.add(c), remove: (c) => s.delete(c),
               toggle: (c) => s.has(c) ? s.delete(c) : s.add(c),
               contains: (c) => s.has(c) };
    },
    addEventListener() {}, scrollIntoView() {}, reset() {},
    setAttribute() {}, appendChild(c) { this.children.push(c); return c; },
  };
  Object.defineProperty(e, 'innerHTML', {
    get() { return this._h ?? ''; },
    set(v) { this._h = v; if (id === 'toplam') yazilan.toplam = v; },
  });
  Object.defineProperty(e, 'disabled', {
    get() { return this._d ?? false; },
    set(v) { this._d = v; if (v === true) yazilan.disabled.push(id); },
  });
  elemanlar.set(id, e);
  return e;
}

globalThis.document = {
  getElementById: (id) => eleman(id),
  querySelector: () => ({ insertAdjacentHTML(_k, html) { yazilan.kutular.push(html); } }),
  createElement: () => eleman('__gecici'),
};
globalThis.window = globalThis;
if (typeof globalThis.CSS === 'undefined') globalThis.CSS = { escape: (s) => String(s) };
globalThis.FormData = class { entries() { return []; } };

// normlar.json 404, kitap 200 — asıl test edilen senaryo
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith('normlar.json')) return { ok: false, status: 404 };
  if (u.endsWith('fiyat_kitabi.json')) {
    const fs = await import('node:fs');
    return { ok: true, status: 200,
             json: async () => JSON.parse(fs.readFileSync(u, 'utf8')) };
  }
  if (u.includes('form-hedef.txt')) return { ok: true, status: 200, text: async () => '' };
  return { ok: false, status: 404 };
};

await import(pathToFileURL(WEB + '/maliyet-motoru.js').href);
await new Promise((r) => setTimeout(r, 300));

process.stdout.write(JSON.stringify(yazilan));
`;

const r = spawnSync(process.execPath, ['--input-type=module', '-e', cocuk], {
  encoding: 'utf8', timeout: 60000,
});

if (r.status !== 0) {
  console.log('  ✗ alt süreç çalışmadı');
  console.log((r.stderr || '').split('\n').slice(-12).map((l) => '    ' + l).join('\n'));
  kaldi++; hatalar.push('alt süreç çalışmadı');
} else {
  let y = null;
  try { y = JSON.parse(r.stdout.trim()); }
  catch { y = null; }

  if (!y) {
    console.log('  ✗ alt süreç çıktısı okunamadı: ' + (r.stdout || '').slice(0, 200));
    kaldi++; hatalar.push('alt süreç çıktısı okunamadı');
  } else {
    // ------------------------------------------------------- 1. hesap yapılmadı
    console.log('\n--- 1. normlar.json 404 iken ---');
    console.log(`  basılan toplam : ${JSON.stringify(y.toplam)}`);
    console.log(`  hata kutusu     : ${y.kutular.length} adet`);
    if (y.kutular[0]) console.log(`    ${y.kutular[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}`);

    ok('hiçbir maliyet basılmadı', y.toplam === '', `toplam = ${JSON.stringify(y.toplam)}`);
    ok('kullanıcıya hata gösterildi', y.kutular.length === 1);
    ok('hata 404 nedenini belirtiyor',
      /404/.test(y.kutular[0] ?? ''), (y.kutular[0] ?? '').slice(0, 120));
    ok('hata kalibrasyon dosyasını adlandırıyor',
      /normlar\.json/.test(y.kutular[0] ?? ''));
    ok('yanlış başlık kullanılmadı',
      !/Fiyat listesi yüklenemedi/.test(y.kutular[0] ?? ''),
      'başlık "fiyat listesi" deyince normlar hatası yanlış anlatılır');
    ok('hesap düğmesi kilitlendi', y.disabled.includes('btn-hesap'),
      `kiliten: ${JSON.stringify(y.disabled)}`);

    // ------------------------------------------------------- 2. karşılaştırma
    console.log('\n--- 2. Sapma ölçümü (bu testin anlamı) ---');
    console.log('  Referans: normlar yüklüyken 100 kVA → 750.499 TL');
    console.log('  normlar yokken (ESKİ davranış)      → 1.121.668 TL');
    console.log('  Fark: −371.169 TL (%49,46) — sessizce.');
    console.log('  Yeni davranış: hesap yapılmıyor, sebep yazılıyor.');
  }
}

console.log('\n' + '='.repeat(60));
console.log(`GEÇEN: ${gecti}   KALAN: ${kaldi}`);
if (kaldi) {
  console.log('\nKALANLAR:');
  for (const h of hatalar) console.log('  - ' + h);
}
console.log('='.repeat(60));
process.exit(kaldi ? 1 : 0);