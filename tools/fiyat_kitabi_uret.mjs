/**
 * Fiyat kıtabı üretici — Proje Yaklaşık Maliyet Motoru / Trafo Bağlantısı
 *
 * Girdi : data/tedas_bfk_2026.json  (tools/bfk_katalog.mjs üretimi)
 * Çıktı: data/fiyat_kitabi.json     (motorun tek fiyat kaynağı)
 *
 * İki kural bu dosyanın varlık sebebidir:
 *
 * 1) YAYIM GÜVENLİĞİ — `ad` alanı her kalem için ZORUNLUDUR. Bulunamazsa
 *    dosya yazılmaz ve eksik kalemler listelenir. Böylece TEDAŞ tarif
 *    kitabındaki açıklama cümleleri yanlışlıkla yayımlanamaz.
 *    Bkz. docs/decisions/2026-10-06-yayin-modeli.md
 *
 * 2) TOHUM UYARISI — Şu an bedeller TEDAŞ 2026 BFK'den gelir (meta.kaynak =
 *    "seed-tedas-bfk"). Yayına almadan önce Atlasgrid'in kendi fiyat listesiyle
 *    değiştirilmelidir. Kâr marjı hiçbir sürümde bu dosyaya yazılmaz.
 *
 * Kullanım:
 *   node tools/fiyat_kitabi_uret.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'tedas_bfk_2026.json'), 'utf8'));
const CIKTI = path.join(KOK, 'data', 'fiyat_kitabi.json');

// =============================================================== KAPSAM
/** Trafo bağlantısı iş tipinde fiyatı gerekebilecek poz blokları */
const KAPSAM = [
  // --- trafo (kVA/gerilim tanımdan okunur) ---
  { blok: '85.610.11', tur: 'yagli', og: '6,3', not: 'Yağlı tip trafo, bakır sargılı' },
  { blok: '85.610.13', tur: 'yagli', og: '10,5', not: 'Yağlı tip trafo, bakır sargılı' },
  { blok: '85.630.11', tur: 'hermetik', og: '6,3', not: 'Hermetik trafo, bakır sargılı' },
  { blok: '85.630.13', tur: 'hermetik', og: '10,5', not: 'Hermetik trafo, bakır sargılı' },

  // --- bara / izolasyon / koruma / pano (adlar açıkça yazılır) ---
  { blok: '85.203.1101', ad: 'Dikdörtgen kesitli bakır bara' },
  { blok: '85.203.1201', ad: 'Dikdörtgen kesitli alüminyum bara' },
  { blok: '85.230.1101', ad: 'Trafo AG buşing izolasyon kapağı (25-160 kVA)' },
  { blok: '85.230.1102', ad: 'Trafo AG buşing izolasyon kapağı (250-400 kVA)' },
  { blok: '85.230.1103', ad: 'Trafo AG buşing izolasyon kapağı (630-800 kVA)' },
  { blok: '85.230.1104', ad: 'Trafo AG buşing izolasyon kapağı (1000-2000 kVA)' },
  { blok: '85.230.1106', ad: 'OG buşing izolasyon kapağı' },
  { blok: '85.530.2401', ad: 'OG ana koruma sigorta grubu 12 kV / 630 A (takım)' },
  { blok: '85.530.2402', ad: 'OG ana koruma sigorta grubu 17,5 kV / 630 A (takım)' },
  { blok: '85.530.2403', ad: 'OG ana koruma sigorta grubu 36 kV / 630 A (takım)' },
  { blok: '85.720.1301', ad: 'AG ana dağıtım panosu 50 kVA' },
  { blok: '85.720.1302', ad: 'AG ana dağıtım panosu 100 kVA' },
  { blok: '85.720.1303', ad: 'AG ana dağıtım panosu 160 kVA' },
  { blok: '85.720.1304', ad: 'AG ana dağıtım panosu 250 kVA' },
  { blok: '85.720.1305', ad: 'AG ana dağıtım panosu 400 kVA' },
  { blok: '85.790.1202', ad: 'Topraklama düzeni (örgülü çelik iletken + köşebent), takım' },
  { blok: '85.790.1203', ad: 'Topraklama düzeni (köşebent + kazık bağlantısı), takım' },
  { blok: '85.790.1204', ad: 'Topraklama elektrodu (çelik çubuk + bakır kaplı uç), takım' },
  { blok: '85.105.2301', ad: 'Betonarme trafo platformu PL-250' },
  { blok: '85.105.2302', ad: 'Betonarme trafo platformu PL-400' },
  { blok: '85.490.1202', ad: 'Beton kablo kanalı (kapağı hariç)' },
  { blok: '85.490.1203', ad: 'Beton kablo kanalı ve baklavalı sac kapak' },
  { blok: '85.490.1201', ad: 'Baklavalı sac kanal kapama elemanı' },

  // --- kablo (ad tanımdan okunur) ---
  { blok: '85.800.12', tur: 'ag-kablo' },  // küçük kesitler (kontrol/devre)
  { blok: '85.800.24', tur: 'ag-kablo' },  // büyük kesitli AG kablo
  { blok: '85.800.25', tur: 'ag-kablo' },
  { blok: '85.800.26', tur: 'ag-kablo' },
  { blok: '85.800.28', tur: 'ag-kablo' },
  { blok: '85.800.29', tur: 'ag-kablo' },
  { blok: '85.800.30', tur: 'ag-kablo' },
  { blok: '85.830.20', tur: 'og-kablo' },
  { blok: '85.830.21', tur: 'og-kablo' },

  // --- kablo pabucu ve ek manşonu (ad blok + kesitten okunur) ---
  { blok: '85.870.11', tur: 'pabuc', malzeme: 'Bakır', tip: 'Sıkmalı tip' },
  { blok: '85.870.12', tur: 'pabuc', malzeme: 'Bakır', tip: 'Mekanik tip' },
  { blok: '85.870.13', tur: 'pabuc', malzeme: 'Alüminyum', tip: 'Sıkmalı tip' },
  { blok: '85.870.14', tur: 'pabuc', malzeme: 'Alüminyum', tip: 'Mekanik tip' },
  { blok: '85.870.15', tur: 'manşon', malzeme: 'Bakır', tip: 'Sıkmalı tip' },
  { blok: '85.870.16', tur: 'manşon', malzeme: 'Bakır', tip: 'Mekanik tip' },
  { blok: '85.870.17', tur: 'manşon', malzeme: 'Alüminyum', tip: 'Sıkmalı tip' },
  { blok: '85.870.18', tur: 'manşon', malzeme: 'Alüminyum', tip: 'Mekanik tip' },
];

// =============================================================== AD ÜRETİMİ
const rakam = (n) => String(n).replace('.', ',');

/** Ondalık sayıyı yayım biçimine çevirir: 1.5 -> 1,5 */
const kesit = (s) => rakam(String(s).trim());

/** Trafo: "25 KVA .6.3 / 0.4 - 0.231 kV (Bakır sargılı)" */
const TUR_ADI = { yagli: 'yağlı', hermetik: 'hermetik' };
function trafoAd(tanim, k) {
  const m = tanim.match(/(\d+)\s*KVA/i);
  if (!m) return null;
  return `${m[1]} kVA ${TUR_ADI[k.tur] ?? k.tur} tip trafo (${rakam(k.og)}/0,4 kV, bakır sargılı)`;
}

/**
 * AG kablo — TEDAŞ metninde birden fazla biçim var:
 *   "1 X 10 mm^2"              → 1×10
 *   "3 X 16ş mm^2"             → 3×16
 *   "3 X 16ş + 185 mm^2"       → 3×16 + 185
 *   "3 X 16ş / 16 mm^2 ."      → 3×16 + 16
 *   "1.5 mm^2 ."  / "10 c mm^2"→ 1×1,5 / 1×10   (tek çekirdekli)
 */
function agKabloAd(tanim) {
  const cok = tanim.match(
    /^(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*ş?\s*(?:[+/]\s*([\d]+(?:[.,][\d]+)?)\s*)?mm/i
  );
  if (cok) {
    const ek = cok[3] ? ` + ${kesit(cok[3])}` : '';
    return `AG kablo ${cok[1]}×${kesit(cok[2])} mm²${ek} (NYY 0,6/1 kV)`;
  }
  const tek = tanim.match(/^([\d]+(?:[.,][\d]+)?)\s*c?\s*mm/i);
  if (tek) return `AG kablo 1×${kesit(tek[1])} mm² (NYY 0,6/1 kV)`;
  return null;
}

/** OG kablo: "3 X 150ş / 25 mm^2"  veya "1 X 150ş / 25 mm^2" */
function ogKabloAd(tanim, grupAdi) {
  const m = tanim.match(/(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*ş?\s*\/\s*([\d]+)\s*mm/i);
  if (!m) return null;
  const gerilim = /10\s*kV/i.test(grupAdi || '') ? '8,7/15 kV' : '5,8/10 kV';
  return `OG kablo ${m[1]}×${kesit(m[2])} mm² + ${m[3]} mm² (${gerilim} XLPE)`;
}

/**
 * Kablo pabucu / ek manşonu kesiti.
 * Hem tekil ("150 mm^2") hem aralık ("35-150 mm^2") biçimini kabul eder.
 *   tekil  -> pabuc:  "Bakır kablo pabucu 150 mm² (sıkmalı tip)"
 *             manşon: "Bakır kablo ek manşonu 150 mm² (sıkmalı tip)"
 *   aralık -> pabuc:  "Bakır kablo pabucu 35-150 mm² (mekanik tip)"
 *             manşon: "Bakır kablo ek manşonu 35-150 mm² (mekanik tip)"
 */
function kesitAd(tanim, k, turAdi) {
  const aralik = tanim.match(/([\d]+(?:\.[\d]+)?)\s*-\s*([\d]+(?:\.[\d]+)?)\s*mm/i);
  const tekil = tanim.match(/([\d]+(?:\.[\d]+)?)\s*mm/i);
  const olcu = aralik
    ? `${kesit(aralik[1])}-${kesit(aralik[2])}`
    : tekil
      ? kesit(tekil[1])
      : null;
  if (!olcu) return null;
  return `${k.malzeme} ${turAdi} ${olcu} mm² (${k.tip.toLowerCase()})`;
}

const pabucAd = (tanim, k) => kesitAd(tanim, k, 'kablo pabucu');
const mansonAd = (tanim, k) => kesitAd(tanim, k, 'kablo ek manşonu');

const ADLAYICI = {
  yagli: trafoAd,
  hermetik: trafoAd,
  'ag-kablo': agKabloAd,
  'og-kablo': ogKabloAd,
  pabuc: pabucAd,
  manşon: mansonAd,
};

// =============================================================== ÜRETİM
const kalemler = {};
const adsiz = [];

for (const k of KAPSAM) {
  // poz tam blok ile başlıyor mu (alt kalem numaralarını da al)
  const eslesen = db.kalemler.filter((x) => x.poz.startsWith(k.blok));
  if (!eslesen.length) {
    adsiz.push(`${k.blok}  →  KAPSAMDAKİ BLOK KATALOGDA YOK`);
    continue;
  }
  for (const x of eslesen) {
    if (x.malzeme == null && x.montaj == null) continue;

    let ad = k.ad ?? null;
    if (!ad && k.tur) {
      const f = ADLAYICI[k.tur];
      ad = f ? f(x.tanim, k, x.grupAdi) : null;
    }
    if (!ad) {
      adsiz.push(`${x.poz}  "${x.tanim}"`);
      continue;
    }
    kalemler[x.poz] = {
      ad,
      birim: x.birim,
      malzeme: x.malzeme ?? null,
      montaj: x.montaj ?? null,
      ...(k.not ? { not: k.not } : {}),
    };
  }
}

// =============================================================== KONTROL
if (adsiz.length) {
  console.error(`\nHATA: ${adsiz.length} kaleme yayım adı atanamadı. Dosya yazılmadı.\n`);
  adsiz.forEach((a) => console.error('  ' + a));
  console.error('\nBu kalemler ya KAPSAM listesine eklenmeli ya da `ad` alanı yazılmalı.');
  process.exit(1);
}

// kapsam boş kaldı mı?
const bosBlok = KAPSAM.filter((k) => !Object.keys(kalemler).some((p) => p.startsWith(k.blok)));
if (bosBlok.length) {
  console.error(`\nHATA: boş kalan bloklar: ${bosBlok.map((b) => b.blok).join(', ')}`);
  process.exit(1);
}

// =============================================================== YAZ
const cikti = {
  meta: {
    surum: '0.1.0',
    uretildi: new Date().toISOString().slice(0, 10),
    kapsam: 'trafo-baglantisi',
    kaynak: 'seed-tedas-bfk',
    kaynakAciklama:
      'TEDAŞ 2026 Birim Fiyat Kitabı bedelleri. GEÇİCİ tohum — yayın öncesi ' +
      'Atlasgrid fiyat listesiyle (piyasa listesi × tipik iskonto) değiştirilmelidir.',
    uyari:
      'TOHUM DEĞERDİR. Gerçek fiyat listesiyle değiştirilmeden yayına alınmaz. ' +
      'Kâr marjı bu dosyaya yazılmaz.',
    // YALNIZCA GERIYE UYUM: normlar.json yoksa bu oran devreye girer.
    // Iscilik ek orani kalem tipine gore secilir (normlar.json yonetir).
    // Bkz. docs/KALIBRASYON_REHBERI.md
    iscilikEkOrani: 0.35,
    kdvDahil: false,
    paraBirimi: 'TRY',
    kalemSayisi: Object.keys(kalemler).length,
  },
  kalemler,
};

fs.writeFileSync(CIKTI, JSON.stringify(cikti, null, 2), 'utf8');

// =============================================================== RAPOR
const n = Object.keys(kalemler).length;
console.log(`Kapsam           : trafo-baglantisi`);
console.log(`Kapsam bloğu     : ${KAPSAM.length}`);
console.log(`Fiyat kitabı     : ${n} kalem`);
console.log(`Adı atlanan      : 0`);
console.log(`Yazıldı          : ${CIKTI}`);
console.log(`\nUYARI: kaynak = "${cikti.meta.kaynak}" → yayın öncesi değiştirilmeli.`);

// Örnek hesap doğrulaması
const ornek = kalemler['85.610.1103'] ?? kalemler['85.610.1101'];
if (ornek) {
  const ek = cikti.meta.iscilikEkOrani;
  const isc = ornek.montaj * (1 + ek);
  console.log(
    `\nÖrnek: ${ornek.ad}\n` +
      `  malzeme ${ornek.malzeme.toLocaleString('tr-TR')} TL\n` +
      `  işçilik  ${ornek.montaj.toLocaleString('tr-TR')} × ${(1 + ek).toFixed(2)} = ${isc.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL\n` +
      `  satır    ${(ornek.malzeme + isc).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL`
  );
}