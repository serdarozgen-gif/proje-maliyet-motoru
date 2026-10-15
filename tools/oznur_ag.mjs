import fs from "node:fs";
import { pathToFileURL } from "url";

/**
 * Öznur fiyat listesinden AG kablo bedellerini çıkarır → data/oznur_ag.json
 *
 * ÇÖZÜLEN İKİ HATA
 * ----------------
 * 1) Sayfa iki (bazen üç) sütunlu ve PDF metin çıkarımı sütunları TEK
 *    satırda birleştirir. Belirti: aynı kalemin bedelleri arasında tam kat
 *    farkı ("3x25 → 172.500 | 1.481.000") — bir sütunun fiyatı diğerinin
 *    tipine yazılıyor.
 *
 * 2) Sütun bölme noktası satırdan satıra KAYAR (sütun genişlikleri eşit
 *    değil, uzun tip adı orta noktayı kaydırıyor). Bu yüzden "hangi sütun"
 *    durumunu satır bazında tutmak yanıltıyor.
 *
 * ÇÖZÜM: Tip etiketleri sayfa başında x konumlarıyla toplanır; her fiyat
 * kalemi kendisinden sola en yakın etikete atanır. Böylece bölme noktası
 * kaydığında da atama doğru kalır.
 *
 * Çıktı: { "<tip>|<çekirdek>x<kesit>": { kmTL, sayfa } }
 *   TL/km — motor m cinsinden çalıştığı için 1000'e bölme üreticide yapılır.
 */

const pdfjs = await import(pathToFileURL(
  "D:/Atlasgrid/tedaş şartnameler/tedas_asistan_prototip/node_modules/pdfjs-dist/legacy/build/pdf.mjs"
).href);

const KAYNAK = process.argv[2];
const CIKTI = process.argv[3];

const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(KAYNAK)),
  useSystemFonts: true,
}).promise;

/** "4x95" → 495 · "1x1.5" → 15 · "9.426.000" → 9426000 */
const sayi = (i) => String(i).replace(/[.,]/g, "");

// Tip adları: YAXV (NA2XY) · YXZ2V (N2XRY) · YVV (NYY) · NVV (NYM) · YVC7V (NYCY) ...
const TIPRE =
  /[YN][A-Z0-9]{1,6}\s*\((?:NA2XY|N2XY|N2XRY|N2XSH|N2XFY|N2XFGBY|NYY|NYM|NYCY|NYRY|NYFGBY|NYZ2V|NYFGBY)\)/;

// Fiyat kalemi: "4x95 700.700" · "3x150+70 9.426.000"
const KABLO_RE =
  /(\d+)\s*x\s*([\d]+(?:[.,][\d]+)?)(?:\s*\+\s*[\d.,]+)?\s+([\d.,]{5,})/g;

// ---------------------------------------------------------------- sayfa oku
const sayfalar = [];
for (let s = 1; s <= doc.numPages; s++) {
  const c = await (await doc.getPage(s)).getTextContent();
  const sat = new Map();
  for (const o of c.items) {
    if (!o.str || !o.str.trim()) continue;
    const y = Math.round(o.transform[5]);
    if (!sat.has(y)) sat.set(y, []);
    sat.get(y).push({ x: o.transform[4], t: o.str.trim() });
  }
  sayfalar.push({
    s,
    satirlar: [...sat.entries()].sort((a, b) => b[0] - a[0]).map(([, os]) =>
      os.sort((a, b) => a.x - b.x)
    ),
  });
}

// ------------------------------------------------- 1. geçiş: tip etiketleri
const etiketler = new Map(); // sayfaNo -> [{x, tip}]
for (const { s, satirlar } of sayfalar) {
  const liste = [];
  for (const os of satirlar) {
    const yazi = os.map((o) => o.t).join(" ");
    const m = yazi.match(TIPRE);
    if (!m) continue;
    // Etiket, kendi sütununun solunda durur. Sütun içindeki ilk öğenin
    // konumu etiketin gerçek sütun konumudur.
    liste.push({ x: Math.min(...os.map((o) => o.x)), tip: m[0] });
  }
  etiketler.set(s, liste);
}

/** Fiyatın ait olduğu tip: kendisinden sola en yakın etiket. */
function tipAta(x, etiketListesi) {
  if (!etiketListesi.length) return null;
  let enIyi = null;
  for (const e of etiketListesi) {
    if (e.x <= x + 5 && (!enIyi || e.x > enIyi.x)) enIyi = e;
  }
  // Sola etiket yoksa (ilk sütun etiketi sayfa kenarında olabilir) en yakın
  return enIyi ?? etiketListesi[0];
}

// ------------------------------------- 2. geçiş: fiyat kalemleri → atama
const kayitlar = [];
for (const { s, satirlar } of sayfalar) {
  const el = etiketler.get(s) ?? [];
  for (const os of satirlar) {
    // Öğeleri x'e göre tek tek tara: kalem başladığı andaki x konumunu bilmeliyiz
    let i = 0;
    while (i < os.length) {
      const o = os[i];
      const kalan = os.slice(i).map((x) => x.t).join(" ");
      KABLO_RE.lastIndex = 0;
      const m = KABLO_RE.exec(kalan);
      if (!m) {
        // Bu öğeden başlayan kalem yoksa ilerle (tip adı, ambalaj vb.)
        i++;
        continue;
      }
      const tip = tipAta(o.x, el);
      if (tip) {
        kayitlar.push({
          sayfa: s,
          tip: tip.tip,
          cekirdek: +m[1],
          kesit: sayi(m[2]),
          kmTL: sayi(m[3]),
          x: o.x,
        });
      }
      // eşleşen öğelerin sayısını atla
      const harcanan = m[0].split(/\s+/).length;
      i += Math.max(1, harcanan);
    }
  }
}

// --------------------------------------------- 3. adım: benzersiz tablo
const tablo = new Map();
for (const k of kayitlar) {
  const anahtar = `${k.tip}|${k.cekirdek}x${k.kesit}`;
  if (!tablo.has(anahtar)) tablo.set(anahtar, []);
  tablo.get(anahtar).push(k);
}

const cikti = {};
const sorunlu = [];
for (const [anahtar, kayit] of tablo) {
  const bedeller = [...new Set(kayit.map((k) => k.kmTL))];
  if (bedeller.length === 1) {
    cikti[anahtar] = {
      kmTL: bedeller[0],
      sayfa: kayit[0].sayfa,
      mPerTl: Number((bedeller[0] / 1000).toFixed(2)),
    };
  } else {
    sorunlu.push({
      anahtar,
      bedeller: bedeller.map((b) => ({
        kmTL: b,
        mPerTl: Number((b / 1000).toFixed(2)),
        sayfa: kayit.find((k) => k.kmTL === b).sayfa,
      })),
    });
  }
}

fs.writeFileSync(CIKTI, JSON.stringify(cikti, null, 1), "utf8");

// ------------------------------------------------------------------ rapor
console.log(`Toplam kayıt   : ${kayitlar.length}`);
console.log(`Tekil kalem    : ${Object.keys(cikti).length}`);
console.log(`Çoklu bedelli  : ${sorunlu.length}`);
console.log(`Yazıldı        : ${CIKTI}`);

console.log("\nTİPLER:");
const tipSay = {};
for (const k of Object.keys(cikti)) {
  const t = k.split("|")[0];
  tipSay[t] = (tipSay[t] || 0) + 1;
}
for (const [t, n] of Object.entries(tipSay).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(20)} ${n}`);
}

if (sorunlu.length) {
  console.log("\nÇOKLU BEDELLİ KALEMLER — hangisi doğru, insan kararı:");
  for (const s of sorunlu) {
    console.log(
      `  ${s.anahtar.padEnd(22)} ` +
      s.bedeller.map((b) => `${b.mPerTl.toLocaleString('tr-TR')} TL/m (s${b.sayfa})`).join("  |  ")
    );
  }
}

console.log("\nMOTORUN OKUDUĞU KALEMLER (TL/m):");
for (const cekirdek of [1, 3, 4]) {
  for (const kesit of [95, 150, 240]) {
    const es = Object.entries(cikti).filter(([k]) => k.endsWith(`|${cekirdek}x${kesit}`));
    console.log(
      `  ${cekirdek}x${String(kesit).padEnd(4)} → ` +
      (es.length
        ? es.map(([k, v]) => `${k.split('|')[0].replace(/\s*\(.*\)/, '')}: ${v.mPerTl.toLocaleString('tr-TR')}`).join(' | ')
        : 'YOK')
    );
  }
}