/**
 * TEDAŞ Birim Fiyat Kitabı (BFK) -> temiz katalog JSON
 *
 * Kaynak: 5 2026 Yılı TEDAŞ BFK.xlsx  (Sayfa "2026BF")
 * Yapı:
 *   A = ESKİ POZ NO      B = YENİ POZ NO (TEDAŞ)   C = ANA   D = ALT
 *   E = açıklama/başlık   F = ÖLÇÜ (birim) veya başlıklarda sayfa no
 *   G = MALZEME (TL)      H = MONTAJ (TL)             I = DEMONTAJ (TL)
 *   J = DEMONTAJDAN MONTAJ (TL)                       K = AÇIKLAMA
 *
 * Ayrım kuralı: F sayısal ise başlık satırı, metin ise kalem satırıdır.
 * B sütunu gruplar arasında boş bırakılır; 85 öneki devralınır.
 *
 * Kullanım:
 *   node tools/bfk_katalog.mjs "<kaynak.xlsx>" [cikti.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const KAYNAK =
  process.argv[2] ||
  path.join(import.meta.dirname, '..', 'data', '5 2026 Yılı TEDAŞ BFK.xlsx');
const CIKTI =
  process.argv[3] ||
  path.join(import.meta.dirname, '..', 'data', 'tedas_bfk_2026.json');

// ---------------------------------------------------------------- okuma
const zip = await JSZip.loadAsync(fs.readFileSync(KAYNAK));

const ssXml = await zip.file('xl/sharedStrings.xml').async('string');
const shared = [];
for (const si of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  shared.push(
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((t) => t[1])
      .join('')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
  );
}

const sayfalar = {};
const wbXml = await zip.file('xl/workbook.xml').async('string');
const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
const relMap = {};
for (const r of relsXml.matchAll(/<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g)) {
  relMap[r[1]] = r[2];
}
for (const sh of wbXml.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)) {
  const p = 'xl/' + relMap[sh[2]].replace(/^\/?xl\//, '');
  const xml = await zip.file(p).async('string');
  sayfalar[sh[1]] = xml;
}

function hucreleriCoz(xml) {
  const satirlar = [];
  for (const row of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const o = {};
    for (const c of row[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = (c[1].match(/r="([A-Z]+)\d+"/) || [])[1];
      const tip = (c[1].match(/t="([^"]*)"/) || [])[1];
      let v = (c[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (tip === 's') v = shared[parseInt(v, 10)];
      else if (tip === 'inlineStr') {
        v = [...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('');
      }
      if (v != null) o[ref] = v;
    }
    satirlar.push({ r: +row[1], ...o });
  }
  return satirlar;
}

const sayfaAdi = Object.keys(sayfalar)[0];
const satirlar = hucreleriCoz(sayfalar[sayfaAdi]);

// ---------------------------------------------------------------- yardimci
const sayi = (v) => {
  if (typeof v !== 'string') return typeof v === 'number' ? v : undefined;
  const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const metin = (v) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : undefined;
const yuvarla = (n) => (n == null ? undefined : Math.round(n * 100) / 100);

// ---------------------------------------------------------------- ayrıştır
const grup = [];       // başlık satırları -> katalog ağacı
const kalemler = [];
let us = '85';         // devralınan üst önek
let aktifGrup = null;  // { kod, ad }

for (const s of satirlar) {
  if (s.B) us = metin(s.B);
  const kod = us ? `${us}.${s.C ?? ''}` : (s.C ?? '');
  const tanim = metin(s.E);
  if (!tanim) continue;

  const f = s.F;
  const fSayi = sayi(f);
  const fiyatlar = { malzeme: sayi(s.G), montaj: sayi(s.H), demontaj: sayi(s.I), dm: sayi(s.J) };
  const fiyatVar = Object.values(fiyatlar).some((v) => v != null && v > 0);

  // Başlık satırı: F sayısal ve fiyat sütunları boş
  if (fSayi != null && !fiyatVar) {
    aktifGrup = { kod, ad: tanim, sayfa: fSayi };
    grup.push(aktifGrup);
    continue;
  }

  // Kalem satırı: F metin (birim)
  if (typeof f === 'string' && f.trim()) {
    const poz = kod ? `${kod}.${s.D ?? ''}` : (s.D ?? '');
    kalemler.push({
      poz,
      grupKodu: kod,
      grupAdi: aktifGrup?.ad ?? '',
      tanim,
      birim: metin(f),
      ...Object.fromEntries(
        Object.entries(fiyatlar).map(([k, v]) => [k, yuvarla(v)]).filter(([, v]) => v != null)
      ),
      not: metin(s.K),
    });
  }
}

// Poz numarası doğrulaması
const pozDesen = /^\d{2}\.\d{3}\.\d{4}$/;
const hataliPoz = kalemler.filter((k) => !pozDesen.test(k.poz));
const eksikGrup = kalemler.filter((k) => !k.grupKodu);

// Ana grupları (kod 85.XXX toplanmış)
const anaGruplar = [...new Set(kalemler.map((k) => k.grupKodu))]
  .map((k) => {
    const g = grup.find((x) => x.kod === k);
    return { kod: k, ad: g?.ad ?? '', kalemSayisi: kalemler.filter((x) => x.grupKodu === k).length };
  })
  .sort((a, b) => a.kod.localeCompare(b.kod));

// ------------------------------------------------------- is kurallari (bu katalog)
/**
 * Yayımlanacak tanım metni TEDAŞ tarif kitabından kopyalanmaz.
 * Aşağıdaki eşleştirme, kalem adını yayım metnine çevirir.
 * Kural: marka/kapasite/kesit bilgisini koru, tarif cümlesini at.
 */
const YAYIM_TANIM = []; // ilk sürümde boş: yayım metni motor katmanında üretilir

const cikti = {
  meta: {
    kaynak: 'TEDAŞ Birim Fiyat Kitabı',
    dosya: path.basename(KAYNAK),
    sayfa: sayfaAdi,
    onay: 'TEDAŞ Yönetim Kurulu 18/02/2026 tarihli 15-274 sayılı karar',
    satirSayisi: satirlar.length,
    kalemSayisi: kalemler.length,
    grupSayisi: grup.length,
    birimler: kalemler.reduce((a, k) => ((a[k.birim] = (a[k.birim] || 0) + 1), a), {}),
  },
  anaGruplar,
  kalemler,
};

fs.mkdirSync(path.dirname(CIKTI), { recursive: true });
fs.writeFileSync(CIKTI, JSON.stringify(cikti, null, 0), 'utf8');

// ---------------------------------------------------------------- rapor
console.log(`Kaynak dosya      : ${path.basename(KAYNAK)}`);
console.log(`Sayfa             : ${sayfaAdi}`);
console.log(`Ham satır         : ${satirlar.length}`);
console.log(`Başlık (bölüm)    : ${grup.length}`);
console.log(`Kalem             : ${kalemler.length}`);
console.log(`Ana grup (85.XXX) : ${anaGruplar.length}`);
console.log(`Poz deseni bozuk  : ${hataliPoz.length}`);
console.log(`Grubu olmayan     : ${eksikGrup.length}`);
console.log(`Birimler          : ${Object.entries(cikti.meta.birimler).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`\nYazıldı           : ${CIKTI}`);

if (hataliPoz.length) {
  console.log('\nUYARI: poz deseni tutmayan ilk 10 kalem:');
  hataliPoz.slice(0, 10).forEach((k) => console.log('  ', k.poz, '|', k.tanim));
}