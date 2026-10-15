/**
 * Yayım adlandırıcı — TEDAŞ ham tanımından yayımlanabilir kısa ad üretir.
 *
 * AYRI DOSYA OLMA SEBEBİ: hem fiyat_kitabi_uret.mjs (BFK bedeliyle) hem
 * tedarikci_uret.mjs (ASTOR/Öznur bedeliyle) aynı adları üretmeli. Kurallar
 * iki kez kopyalanırsa motorun `ad` alanlarından ayrıştırdığı kablo
 * çekirdek/kesit bilgisi bozulur.
 *
 * TASARIM İLKESİ: ad bulunamazsa null döner, çağıran dosya yazmayı reddeder.
 * Böylece TEDAŞ tarif kitabı metni kazara yayımlanamaz.
 * Bkz. docs/decisions/2026-10-06-yayin-modeli.md
 */

// ---------------------------------------------------------------- açık metin eşleme
const YAYIM_ADI = {
  // Bara
  '85.203.1101': 'Dikdörtgen kesitli bakır bara',
  '85.203.1201': 'Dikdörtgen kesitli alüminyum bara',

  // İzolasyon kapağı
  '85.230.1101': 'Trafo AG buşing izolasyon kapağı (25-160 kVA)',
  '85.230.1102': 'Trafo AG buşing izolasyon kapağı (250-400 kVA)',
  '85.230.1103': 'Trafo AG buşing izolasyon kapağı (630-800 kVA)',
  '85.230.1104': 'Trafo AG buşing izolasyon kapağı (1000-2000 kVA)',
  '85.230.1106': 'OG buşing izolasyon kapağı',

  // OG koruma
  '85.530.2401': 'OG ana koruma sigorta grubu 12 kV / 630 A (takım)',
  '85.530.2402': 'OG ana koruma sigorta grubu 17,5 kV / 630 A (takım)',
  '85.530.2403': 'OG ana koruma sigorta grubu 36 kV / 630 A (takım)',

  // AG panosu
  '85.720.1301': 'AG ana dağıtım panosu 50 kVA',
  '85.720.1302': 'AG ana dağıtım panosu 100 kVA',
  '85.720.1303': 'AG ana dağıtım panosu 160 kVA',
  '85.720.1304': 'AG ana dağıtım panosu 250 kVA',
  '85.720.1305': 'AG ana dağıtım panosu 400 kVA',

  // Topraklama
  '85.790.1105': 'Topraklama örgülü çelik iletken 95 mm² (galvanizli)',
  '85.790.1106': 'Topraklama şeridi 100 mm² (sıcak daldırma galvanizli) ve gömülmesi',
  '85.790.1202': 'Topraklama düzeni (örgülü çelik iletken + köşebent), takım',
  '85.790.1203': 'Topraklama düzeni (köşebent + kazık bağlantısı), takım',
  '85.790.1204': 'Topraklama elektrodu (çelik çubuk + bakır kaplı uç), takım',

  // Platform / kanal
  '85.105.2301': 'Betonarme trafo platformu PL-250',
  '85.105.2302': 'Betonarme trafo platformu PL-400',
  '85.490.1201': 'Baklavalı sac kanal kapama elemanı',
  '85.490.1202': 'Beton kablo kanalı (kapağı hariç)',
  '85.490.1203': 'Beton kablo kanalı ve baklavalı sac kapak',

  // ---------------------------------------------------------------- hücreler (cell)
  // Yalnız ASTOR listesinde fiyatı olan 11 poz. Adlar BFK `tanim`/`grupAdi`
  // metninden türetilmiştir.
  // Bkz. docs/decisions/2026-10-07-yayin-modeli.md
  '85.500.1203': '36 kV 630 A yük ayırıcılı giriş-çıkış fonksiyonel birimi (tek baralı)',
  '85.500.1207': '36 kV 630 A sigortalı yük ayırıcılı koruma fonksiyonel birimi (tek baralı)',
  '85.500.1211': '36 kV 630 A kesicili giriş-çıkış fonksiyonel birimi (tek baralı)',
  '85.500.1215': '36 kV 630 A yük ayırıcılı bara bağlama/ayırma fonksiyonel birimi (tek baralı)',
  '85.500.1216': '36 kV 1250 A kesicili bara bağlama (kuplaj) fonksiyonel birimi (tek baralı)',
  '85.500.1219': '36 kV 630 A akım gerilim ölçü fonksiyonel birimi (tek baralı)',
  '85.500.1222': '36 kV 1250 A gerilim ölçü fonksiyonel birimi (tek baralı)',
  '85.510.2101': 'Kablo giriş bağlantı fonksiyonel birimi / kutusu',
  // 85.510.1102: kullanıcı BFK ekran görüntüsüyle doğruladı (2026-10-07).
  // Grup başlığı "YÜK AYIRICILI GİRİŞ-ÇIKIŞ FONKSİYONEL BİRİMİ", satır
  // "36 kV, 630 A, 16 KA". "Motorlu" ifadesi BFK'ta yazmadığı için ada
  // eklenmedi — ASTOR karşılığı (AS36 LC) motorlu tip olabilir, BFK pozu
  // bunu taahhüt etmiyor.
  '85.510.1102': '36 kV 630 A 16 kA yük ayırıcılı giriş-çıkış fonksiyonel birimi',
  '85.510.1302': '24/36 kV 0,1 kV gerilim transformatörü / iç ihtiyaç fonksiyonel birimi',
  // 85.530.2403 zaten yukarıda (OG koruma) tanımlı.
  };
 
// ---------------------------------------------------------------- kural tabanlı
const rakam = (n) => String(n).replace('.', ',');
const kesit = (s) => rakam(String(s).trim());

const TRAFO_TURLERI = { yagli: 'yağlı', hermetik: 'hermetik' };

/**
 * Trafo: "25 KVA .6.3 / 0.4 - 0.231 kV (Bakır sargılı)"
 * `tur` ve `og` verilmezse tanımdan çıkarılır.
 */
function trafoAd(tanim, tur, og) {
  const m = tanim.match(/(\d+)\s*KVA/i);
  if (!m) return null;
  return `${m[1]} kVA ${TRAFO_TURLERI[tur] ?? tur} tip trafo (${og ?? '?'} kV, bakır sargılı)`;
}

/**
 * AG kablo — birden fazla biçim:
 *   "1 X 10 mm^2"              → 1×10
 *   "3 X 16ş mm^2"             → 3×16
 *   "3 X 16ş + 185 mm^2"       → 3×16 + 185
 *   "3 X 16ş / 16 mm^2 ."      → 3×16 + 16
 *   "1.5 mm^2 ." / "10 c mm^2" → 1×1,5 / 1×10
 *   "4 X 150 - 4 X 95 mm^2"    → 4×95 + 4×150 (İKİ kademe)
 *
 * İki kademeli tanım BFK'ta yaygındır: dört damarlı kablonun her damarı
 * farklı kesitte olabilir. Motor addan tek kesit okuyabildiği için küçük
 * olanı esas alır, büyük olanı adda belirtir.
 */
function agKabloAd(tanim, etiket = 'NYY 0,6/1 kV') {
  const ikiKademe = tanim.match(
    /(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*(?:\/\s*[\d.,]+)?\s*-\s*\d+\s*X\s*([\d]+(?:[.,][\d]+)?)/i
  );
  if (ikiKademe) {
    const c = ikiKademe[1];
    const a = Number(kesit(ikiKademe[2]));
    const b = Number(kesit(ikiKademe[3]));
    return `AG kablo ${c}×${kesit(Math.min(a, b))} + ${c}×${kesit(Math.max(a, b))} mm² (${etiket})`;
  }

  const cok = tanim.match(
    /^(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*ş?\s*(?:[+/]\s*([\d]+(?:[.,][\d]+)?)\s*)?mm/i
  );
  if (cok) {
    const ek = cok[3] ? ` + ${kesit(cok[3])}` : '';
    return `AG kablo ${cok[1]}×${kesit(cok[2])} mm²${ek} (${etiket})`;
  }
  const tek = tanim.match(/^([\d]+(?:[.,][\d]+)?)\s*c?\s*mm/i);
  if (tek) return `AG kablo 1×${kesit(tek[1])} mm² (${etiket})`;
  return null;
}

/**
 * OG kablo: "3 X 150ş / 25 mm^2", "3 X 150ş / 3 X 25 mm^2",
 *           "1 X 150 / 25 mm^2"
 * `zirh` verilirse adın sonuna eklenir (aynı kesit birden fazla grupta
 * tekrarladığı için ayrım zorunlu).
 */
function ogKabloAd(tanim, zirh = null) {
  const m = tanim.match(
    /(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*ş?\s*(?:\/\s*(?:(\d+)\s*X\s*)?(\d+)\s*)?mm/i
  );
  if (!m) return null;
  const cekirdek = m[1];
  const faz = kesit(m[2]);
  const ekCekirdek = m[3] ?? '';
  const ek = m[4] ? ` + ${ekCekirdek}${m[4]}` : '';
  const zirhEtiket = zirh ? `, ${zirh}` : '';
  return `OG kablo ${cekirdek}×${faz} mm²${ek} (5,8/10 kV XLPE${zirhEtiket})`;
}

/**
 * Kablo pabucu / ek manşonu. Tekil ("150 mm^2") ve aralık ("35-150 mm^2")
 * biçimlerinin ikisini de kabul eder.
 */
function kesitAd(tanim, malzeme, tip, turAdi) {
  const aralik = tanim.match(/([\d]+(?:\.[\d]+)?)\s*-\s*([\d]+(?:\.[\d]+)?)\s*mm/i);
  const tekil = tanim.match(/([\d]+(?:\.[\d]+)?)\s*mm/i);
  const olcu = aralik
    ? `${kesit(aralik[1])}-${kesit(aralik[2])}`
    : tekil
      ? kesit(tekil[1])
      : null;
  if (!olcu) return null;
  return `${malzeme} ${turAdi} ${olcu} mm² (${tip.toLowerCase()})`;
}

const pabucAd = (tanim, k) => kesitAd(tanim, k.malzeme, k.tip, 'kablo pabucu');
const mansonAd = (tanim, k) => kesitAd(tanim, k.malzeme, k.tip, 'kablo ek manşonu');

// 85.870.x blok semantiği (tarif kitabı başlıklarından)
const KABLO_BLOKLARI = {
  '85.870.11': { malzeme: 'Bakır', tip: 'Sıkmalı tip', tur: 'pabuc' },
  '85.870.12': { malzeme: 'Bakır', tip: 'Mekanik tip', tur: 'pabuc' },
  '85.870.13': { malzeme: 'Alüminyum', tip: 'Sıkmalı tip', tur: 'pabuc' },
  '85.870.14': { malzeme: 'Alüminyum', tip: 'Mekanik tip', tur: 'pabuc' },
  '85.870.15': { malzeme: 'Bakır', tip: 'Sıkmalı tip', tur: 'manşon' },
  '85.870.16': { malzeme: 'Bakır', tip: 'Mekanik tip', tur: 'manşon' },
  '85.870.17': { malzeme: 'Alüminyum', tip: 'Sıkmalı tip', tur: 'manşon' },
  '85.870.18': { malzeme: 'Alüminyum', tip: 'Mekanik tip', tur: 'manşon' },
};

// Trafo bloğu → gerilim metni (motor.js ve arayüz ile aynı eşleme)
// Blok önekleri 4 haneli alt bloğu içerir: "85.630.15" → 85.630.1501
const TRAFO_BLOK_GERILIM = [
  ['85.610.11', { tur: 'yagli', og: '6,3' }],
  ['85.610.13', { tur: 'yagli', og: '10,5' }],
  ['85.610.15', { tur: 'yagli', og: '36' }],
  ['85.630.11', { tur: 'hermetik', og: '6,3' }],
  ['85.630.13', { tur: 'hermetik', og: '10,5' }],
  ['85.630.15', { tur: 'hermetik', og: '36' }],
];

/**
 * Poz + ham tanımdan yayım adı üretir.
 * @returns {string|null} null → ad üretilemedi, çağıran dosya yazmamalı
 */
export function yayimAdi(poz, tanim, grupAdi = '') {
  if (YAYIM_ADI[poz]) return YAYIM_ADI[poz];

  // Trafo — blok öneki poz ile başlamalı, poz "85.630.1501" olduğu için
  // "85.630.15" ile eşleşir; nokta eklemek eşleşmeyi bozuyordu.
  for (const [blok, bilgi] of TRAFO_BLOK_GERILIM) {
    if (poz.startsWith(blok) && /^\d{2}\.\d{3}\.\d{4}$/.test(poz)) {
      return trafoAd(tanim, bilgi.tur, bilgi.og);
    }
  }

  // Kablo — aynı kesit birden fazla grupta tekrarlanır (zırhsız / zırhlı).
  // Adlandırmada grup farkını korumak zorunlu: motor bu addan çekirdek ve
  // kesit okuyor, ayrım yapılamazsa doğru kalem bulunamaz.
  if (poz.startsWith('85.830.') || poz.startsWith('85.850.') || poz.startsWith('85.860.')) {
    const zirh = poz.startsWith('85.850.') ? 'yassı çelik tel zırhlı'
      : poz.startsWith('85.860.') ? 'çelik tel zırhlı' : null;
    return ogKabloAd(tanim, zirh);
  }
  if (poz.startsWith('85.800.') || poz.startsWith('85.840.')) {
    // 85.800.25xx Excel'de YAXV (NA2XY) alüminyum blok (satır 2864+).
    // Katalog grup başlığı yanlış (NVV/NYM yazıyor), ad tanımdan değil
    // bloktan belirlenir. Bkz. docs/decisions/2026-10-08-bfk-tarama-kurali.md
    if (poz.startsWith('85.800.25')) return agKabloAd(tanim, 'NA2XY 0,6/1 kV (alüminyum)');
    return agKabloAd(tanim);
  }

  for (const [blok, bilgi] of Object.entries(KABLO_BLOKLARI)) {
    if (poz.startsWith(blok)) {
      return bilgi.tur === 'pabuc' ? pabucAd(tanim, bilgi) : mansonAd(tanim, bilgi);
    }
  }

  return null;
}

/** Test ve teşhis için: açık eşleme tablosu */
export const ACIK_ESLESME = YAYIM_ADI;