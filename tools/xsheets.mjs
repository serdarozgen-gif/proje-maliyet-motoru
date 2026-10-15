/**
 * XLSX sayfalarini listeler — hangi sayfada ne var bulmak icin.
 *   node tools/xsheets.mjs "<dosya.xlsx>"
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const JSZIP_MODUL =
  'D:/Atlasgrid/tedaş şartnameler/tedas_asistan_prototip/node_modules/jszip/lib/index.js';

export async function acSayfalari(dosya) {
  const JSZip = (await import(pathToFileURL(JSZIP_MODUL).href)).default;
  const zip = await JSZip.loadAsync(fs.readFileSync(dosya));

  const sh = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ss = await ssFile.async('string');
    for (const s of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      sh.push(
        [...s[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((x) => x[1])
          .join('')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&amp;/g, '&')
      );
    }
  }

  const wb = await zip.file('xl/workbook.xml').async('string');
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const ad = (m[1].match(/name="([^"]*)"/) || [])[1];
    const rid = (m[1].match(/r:id="([^"]*)"/) || [])[1];
    if (ad && rid) sheets.push({ ad, rid });
  }

  const rm = {};
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (relsFile) {
    const rels = await relsFile.async('string');
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const id = (m[1].match(/Id="([^"]*)"/) || [])[1];
      const tg = (m[1].match(/Target="([^"]*)"/) || [])[1];
      if (id && tg) rm[id] = tg;
    }
  }

  const coz = [];
  for (const s of sheets) {
    const target = rm[s.rid];
    if (!target) { coz.push({ ad: s.ad, satirlar: [], hata: 'rel yok' }); continue; }
    const p = target.startsWith('/')
      ? target.slice(1)
      : 'xl/' + target.replace(/^\/?xl\//, '');
    const f = zip.file(p);
    if (!f) { coz.push({ ad: s.ad, satirlar: [], hata: `${p} yok` }); continue; }
    const xml = await f.async('string');
    const satirlar = [];
    for (const row of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const o = {};
      for (const c of row[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const ref = (c[1].match(/r="([A-Z]+)\d+"/) || [])[1];
        const t = (c[1].match(/t="([^"]*)"/) || [])[1];
        let v = (c[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (t === 's') v = sh[parseInt(v, 10)];
        else if (t === 'inlineStr') {
          v = [...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('');
        }
        if (v != null) o[ref] = v;
      }
      satirlar.push({ r: +row[1], ...o });
    }
    coz.push({ ad: s.ad, satirlar });
  }
  return coz;
}

/** Sutun harfini 0 tabanli indekse cevirir (A=0, AA=26). */
export function sutunIndeks(ref) {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

if (import.meta.filename === process.argv[1]) {
  const sayfalar = await acSayfalari(process.argv[2]);
  for (const s of sayfalar) {
    const dolu = s.satirlar.filter((r) => Object.keys(r).length > 1).length;
    console.log(`${String(dolu).padStart(5)} satir  ${s.ad}${s.hata ? '  (' + s.hata + ')' : ''}`);
  }
}