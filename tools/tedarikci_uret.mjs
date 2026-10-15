/**
 * Tedarikci net fiyatlarindan fiyat kitabi uretir.
 *
 * Girdi : data/tedas_bfk_2026.json  (katalog — poz ve isim icin)
 *         data/tedarikci_fiyatlari.json (ASTOR / Oznur net bedeller)
 * Cikti: data/fiyat_kitabi.json
 *
 * Motor mantigi: kalem varsa TEDARIKCI net bedeli kullanilir; yoksa BFK
 * bedeli * iskonto uygulanir. Hangi yolun izlendiği kalemde `kaynak` ile
 * işaretlenir — kullanıcı ekranda hangi kalemin gerçek fiyat, hangisinin
 * BFK'dan türetilmiş olduğunu görebilmelidir.
 *
 *   node tools/tedarikci_uret.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { yayimAdi } from './yayim_adi.mjs';

const KOK = path.join(import.meta.dirname, '..');
const OKU = (p) => JSON.parse(fs.readFileSync(path.join(KOK, p), 'utf8'));
const db = OKU('data/tedas_bfk_2026.json');
const ted = OKU('data/tedarikci_fiyatlari.json');
const CIKTI = path.join(KOK, 'data', 'fiyat_kitabi.json');

const kur = ted.dovizKuru.USD;
const trafoIskonto = ted.trafo.iskonto;
const kabloIskonto = ted.kablo.iskonto;

const bk = (n) => (Math.round(n * 100) / 100).toLocaleString('tr-TR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// ---------------------------------------------------------------- katalog indeks
const byPoz = new Map(db.kalemler.map((k) => [k.poz, k]));

/** Trafo: kVA -> poz (85.630.15xx hermetik 15,8/0,4) */
// ASTOR listesi HERMETİK trafo. BFK'ta 85.630.15xx = 15,8/0,4 kV (28,5-36 kV).
// ASTOR'un tamamı 28,5-36/0,4 kV. Bu yüzden kVA -> poz eşlemesi 85.630.15 bloğundan
// kurulur; diğer gerilim bloklarında ASTOR karşılığı YOK (BFK bedeliyle kalır).
const trafoPoz = new Map();
for (const k of db.kalemler) {
  if (!k.poz.startsWith('85.630.15')) continue;
  const m = k.tanim.match(/(\d+)\s*KVA/i);
  if (m) trafoPoz.set(Number(m[1]), k.poz);
}

/**
 * Kablo indeksi: (tip, çekirdek, kesit) -> poz LİSTESİ
 *
 * Çoklu olması şart: aynı teknik imza birden fazla grupta tekrarlanıyor.
 * Örnek 4x240 hem 85.800.3033 hem 85.840.2446'da. Tek poz tutarsak ikincisi
 * hiç işlenmez ve BFK bedeliyle kalır — sessiz kayıp.
 */
const kabloPoz = new Map();
for (const k of db.kalemler) {
  // Tip POZ GRUBUNDAN gelir, metinden değil. "3 X 25ş / 16" yazan bir AG
  // kablo ile bir OG kablonun metni aynı kalıba uyar; ayrım poz önekiyle
  // yapılır (85.830/85.850/85.860 = OG, 85.800/85.840 = AG).
  let tip = null;
  if (k.poz.startsWith('85.830.') || k.poz.startsWith('85.850.') || k.poz.startsWith('85.860.')) tip = 'OG';
  else if (k.poz.startsWith('85.800.') || k.poz.startsWith('85.840.')) tip = 'AG';
  if (!tip) continue;

  let anahtar = null;
  if (tip === 'OG') {
    const m = k.tanim.match(/(\d+)\s*X\s*([\d]+)\s*ş?\s*\/\s*([\d]+)/i);
    if (m) anahtar = `OG|${Number(m[1])}|${Number(m[2])}`;
  } else {
    // AG: "4 X 95 mm^2" -> AG|4|95. "3 X 35ş + 16 mm^2" (nötrlü) ->
    // AG|3|35; nötr bilgisi ham tanımda kalır, bedel seçiminde ham addan
    // okunur (ucNotr tablosu). 2026-10-07: 'ş?' ve '+ nötr' yoktu, nötrlü
    // pozlar eşleşme dışı kalıp BFK bedelinde duruyordu.
    const m = k.tanim.match(/(\d+)\s*X\s*([\d]+(?:[.,][\d]+)?)\s*ş?\s*(?:\+\s*[\d.,]+)?\s*mm/i);
    if (m) anahtar = `AG|${Number(m[1])}|${Number(m[2].replace(',', '.'))}`;
  }
  if (!anahtar) continue;
  if (!kabloPoz.has(anahtar)) kabloPoz.set(anahtar, []);
  kabloPoz.get(anahtar).push(k.poz);
}

// ---------------------------------------------------------------- toplayici
const kalemler = {};
const istatistik = {
  tedarikci: 0,
  bfkKatsayili: 0,
  bulunamadi: [],
  adsiz: [],
  cakisma: [],
  atlanan: [],
};

/**
 * Kalemi fiyatlandırır.
 * @param {string} poz
 * @param {object} secenek  { malzeme, kaynak }
 */
function kalemEkle(poz, secenek) {
  const k = byPoz.get(poz);
  if (!k) {
    istatistik.bulunamadi.push(poz);
    return false;
  }
  // YAYIM ADI katalogda YOKTUR — katalog ham TEDAŞ tanımı taşır.
  // Yayım adı tools/fiyat_kitabi_uret.mjs içindeki adlayıcılardan gelir.
  // Bu iki dosya birlikte çalışır; tek başına çalıştırılırsa buraya düşer.
  // İstisna: secenek.ad — fiyatlanan ürün BFK tanımından farklıysa (ör. trafo
  // alüminyum sargılı, BFK pozu bakır sargılı) çağıran doğru adı verir.
  // Bkz. docs/decisions/2026-10-07-trafo-sargi.md
  const ad = secenek.ad ?? yayimAdi(poz, k.tanim, k.grupAdi);
  if (!ad) {
    istatistik.adsiz.push(`${poz} "${k.tanim}"`);
    return false;
  }
  if (kalemler[poz]) {
    istatistik.cakisma.push(poz);
    return false;
  }
  kalemler[poz] = {
    ad,
    birim: k.birim,
    malzeme: secenek.malzeme,
    montaj: k.montaj ?? null,
    kaynak: secenek.kaynak,
    ...(secenek.not ? { not: secenek.not } : {}),
  };
  istatistik[secenek.sayac]++;
  return true;
}

// ---------------------------------------------------------------- 1. Trafo
// BFK'ta aynı kVA birden fazla pozda olabilir (faz bağlantısı vb.). ASTOR
// bedeli kVA'ya bağlı olduğundan poz başına bir kez yaz.
//
// SARGI KARARI (2026-10-07, kullanıcı): piyasada alüminyum sargılı seçiliyor,
// iki ölçüm vakası da alüminyum. Birincil fiyat AOAk (alüminyum), bakır A Plus
// alternatifi not alanında durur. BFK pozları bakır sargılı olduğu için ad
// açıkça "alüminyum sargılı" yazılır — yoksa fiyatla ad çelişir.
// Bkz. docs/decisions/2026-10-07-trafo-sargi.md
const islenmisTrafoPoz = new Set();
for (const [kva, poz] of trafoPoz) {
  if (islenmisTrafoPoz.has(poz)) continue;
  const alu = ted.trafo.aoAk['list USD'][kva];
  const bakir = ted.trafo.aPlus['list USD'][kva];
  if (alu == null) {
    istatistik.atlanan.push(`${poz}: ASTOR listesinde ${kva} kVA yok`);
    continue;
  }

  const tl = (usd) => usd * kur;
  const net = tl(alu) * (1 - trafoIskonto);

  islenmisTrafoPoz.add(poz);
  kalemEkle(poz, {
    malzeme: net,
    ad: `${kva} kVA hermetik tip trafo (36 kV, alüminyum sargılı)`,
    kaynak: `ASTOR AOAk alüminyum sargılı (USD ${alu} × ${kur} kur × %${trafoIskonto * 100} iskonto)`,
    sayac: 'tedarikci',
    not: bakir != null
      ? `ASTOR A Plus bakır sargılı alternatif: USD ${bakir} → net ${bk(tl(bakir) * (1 - trafoIskonto))} TL`
      : undefined,
  });
}

// ---------------------------------------------------------------- 2. AG kablo
// Tip seçimi data/kablo_secimi.json'dan gelir. Varsayılan bakır NYY —
// trafo bağlantılarında genelde bakır seçiliyor (kullanıcı teyidi).
// Alüminyum seçilirse kesit 2 kademe büyütülür (akım kapasitesi düşer).
const secim = OKU('data/kablo_secimi.json');
const bedelTipleri = secim.bedeller;
const alKural = secim.secim.aluminyumIcinKesitKurali?.eslesme ?? {};

const ADET_ADI = {
  1: 'tek', 2: 'iki', 3: 'uc', 4: 'dort', 5: 'bes',
  7: 'yedi', 9: 'dokuz', 12: 'onIki', 14: 'onDort',
  19: 'onDokuz', 21: 'yirmiBir', 24: 'yirmiDort', 30: 'otuz', 40: 'kirk',
};

/**
 * AG kablo net fiyatı (TL/m).
 * @param {string} tip   'NYY-Cu' | 'NA2XY-Al'
 * @returns {{net:number, kesit:string, tip:string}|null}
 */
function agBul(tip, cekirdek, kesit, buyut = true) {
  const bedel = bedelTipleri[tip];
  if (!bedel) return null;
  const adet = ADET_ADI[cekirdek];
  if (!adet) return null;

  // Alüminyum seçilmişse kesit 2 kademe büyütülür. İstisna: poz zaten
  // alüminyum kablo bloğuysa (85.800.25xx) büyütme yapılmaz — bedel
  // doğrudan o kesitin alüminyum karşılığıdır.
  let kullanilan = String(kesit);
  if (buyut && tip === 'NA2XY-Al' && alKural[kullanilan]) {
    kullanilan = alKural[kullanilan];
  }

  const tablo = bedel[adet];
  if (!tablo) return null;
  const km = tablo[kullanilan];
  if (km == null) return null;
  return { net: km * (1 - kabloIskonto), kesit: kullanilan, tip };
}

const aktifTip = secim.secim.varsayilan ?? 'NYY-Cu';
const aktifTipBilgi = secim.tipler[aktifTip];
// Bedeli doğrulanamayan pozlar: BFK yedek geçişine de girmez, eksikte kalır.
// (Örn. 85.800.25xx Al blokta NA2XY karşılığı olmayan kesit — bakır bedel
// yazılamaz, BFK bedeli de bakır bedeli olduğu için o da yazılamaz.)
const atlananPoz = new Set();

for (const [anahtar, pozler] of kabloPoz) {
  const [tip, cekirdekS, kesitS] = anahtar.split('|');
  if (tip !== 'AG') continue;
  const cekirdek = Number(cekirdekS);
  const kesit = Number(kesitS);
  const bulunan = agBul(aktifTip, cekirdek, kesit);
  if (!bulunan) continue;
  for (const poz of pozler) {
    // 85.800.25xx Excel'de alüminyum (NA2XY) bloktur. Aktif tip ne olursa
    // olsun bu poza bakır bedel yazılamaz — NA2XY-Al bedeli büyütmesiz
    // alınır. Bkz. docs/decisions/2026-10-08-bfk-tarama-kurali.md
    const alBlok = poz.startsWith('85.800.25');
    let net = bulunan.net;
    let tipEtiket = `${aktifTip} ${cekirdek}x${bulunan.kesit}`;
    if (alBlok) {
      const alu = agBul('NA2XY-Al', cekirdek, kesit, false);
      if (alu) {
        net = alu.net;
        tipEtiket = `NA2XY-Al ${cekirdek}x${alu.kesit} (85.800.25xx Al blok)`;
      } else {
        // Ad alüminyum diyor, bedel yoksa bakır bedel yazılamaz — kalem
        // dışarıda kalır, eksiklere düşer. Kural ilkesi: bedeli
        // doğrulanamayan kalem fiyat kitabına girmez.
        atlananPoz.add(poz);
        istatistik.atlanan.push(`${poz}: NA2XY-Al listede ${cekirdek}x${kesit} yok`);
        continue;
      }
    }
    // Nötrlü 3-damar (3xKesit+Nötr): BFK pozu nötrlü kabloyu gösterir
    // (örn. 85.800.1482 = 3x50+25) ama bedel tablosunda düz kesit fiyatı
    // yazıyordu. Ham katalog adından nötr okunur, ucNotr tablosundan
    // gerçek bedel alınır. Kaynak: ekran görüntüsü 2026-10-07 (sayfa 8).
    // Yalnız NYY-Cu + 3 damar + bakır blok için; Al blokta ucNotr (bakır
    // bedel) uygulanmaz.
    let notrBilgi = '';
    if (!alBlok && aktifTip === 'NYY-Cu' && cekirdek === 3) {
      const ham = byPoz.get(poz)?.tanim ?? '';
      const m = ham.match(/3\s*X\s*(\d+)[^+]*\+\s*(\d+)/i);
      if (m) {
        const notrTablo = bedelTipleri['NYY-Cu']?.ucNotr ?? {};
        const bedel = notrTablo[`${m[1]}+${m[2]}`];
        if (bedel != null) {
          net = bedel * (1 - kabloIskonto);
          notrBilgi = ` (nötrlü 3x${m[1]}+${m[2]})`;
        }
      }
    }
    kalemEkle(poz, {
      malzeme: net,
      kaynak:
        `Öznur ${tipEtiket}${notrBilgi} × %${kabloIskonto * 100} iskonto` +
        (bulunan.kesit !== String(kesit)
          ? ` (kesit ${kesit}→${bulunan.kesit}: Al için 2 kademe büyütme)`
          : ''),
      sayac: 'tedarikci',
    });
  }
}

// ---------------------------------------------------------------- 3. OG kablo
const a2xsy = ted.kablo.OG_A2XSY;

/**
 * OG kablo net fiyatı (TL/m).
 *
 * Sistem: Yalnızca 36 kV kapsamımızda. Doğru seri: 20,3/35 kV.
 *
 *   - cekirdek === 1 → A2XSY (tek çekirdekli)
 *   - cekirdek === 3 → A2XSEYFGbY (zırhlı, 3 damar — belge sayfa 60)
 *
 * 8,7/15 kV serisi daha düşük ve yalnızca 10,5 kV sistem içindir — kullanılmaz.
 */
function ogNet(cekirdek, kesit) {
  if (cekirdek === 1) {
    const o20 = a2xsy.tek_20_3_35[kesit];
    if (o20 != null) return (o20 / 1000) * (1 - kabloIskonto);
  }
  if (cekirdek === 3) {
    const o20 = a2xsy.A2XSEYFGbY?.uc_20_3_35?.[kesit];
    if (o20 != null) return (o20 / 1000) * (1 - kabloIskonto);
  }
  return null;
}

for (const [anahtar, pozler] of kabloPoz) {
  const [tip, cekirdekS, kesitS] = anahtar.split('|');
  if (tip !== 'OG') continue;
  const cekirdek = Number(cekirdekS);
  const kesit = Number(kesitS);
  const net = ogNet(cekirdek, kesit);
  if (net == null) continue;
  for (const poz of pozler) {
    kalemEkle(poz, {
      malzeme: net,
      kaynak:
        cekirdek === 3
          ? `Öznur A2XSEYFGbY 20,3/35 kV 3x${kesit} × %${kabloIskonto * 100} iskonto`
          : `Öznur A2XSY 20,3/35 kV 1x${kesit} × %${kabloIskonto * 100} iskonto`,
      sayac: 'tedarikci',
    });
  }
}

// ---------------------------------------------------------------- 4. Hücreler
// ASTOR hücre listesi (2.-Astor-Hucre.pdf, 27.01.2025) BFK pozlarıyla eşleşir.
// RMU (SF6 gaz yalıtımlı) → 85.500.12xx; metal mahfazalı (hava yalıtımlı) → 85.510.x.
// Eşleşme insan kararıdır — otomatik çıkarım yapılamaz.
//
// SIRA ÖNEMLİ: bu döngü, aşağıdaki "BFK bedeliyle kalan" geçişinden ÖNCE
// çalışmalıdır. kalemEkle çakışmada vazgeçtiği için hücre döngüsü sonra
// gelirse ASTOR iskontosu hiç uygulanmaz, pozlar BFK bedelinde kalır.
// Bu bir hata olarak görünür ama değildir — 2026-10-07'de düzeltildi.
const ASTOR_HUCRE = [
  // RMU (gaz yalıtımlı) — BF 85.500.12xx
  { poz: '85.500.1203', usd: 15000, ad: 'AS36 LC RMU — Yük ayırıcılı giriş/çıkış' },
  { poz: '85.500.1207', usd: 20000, ad: 'AS36 LF RMU — Sigortalı yük ayırıcılı trafo koruma' },
  { poz: '85.500.1211', usd: 31000, ad: 'AS36 CBC RMU — Kesicili giriş-çıkış / trafo koruma' },
  { poz: '85.500.1215', usd: 18000, ad: 'AS36 LC-Y RMU — Ayırıcılı kuplaj' },
  { poz: '85.500.1216', usd: 45000, ad: 'AS36 CBC-C RMU — Kesicili kuplaj (1250A)' },
  { poz: '85.500.1219', usd: 14000, ad: 'AS36 VTC/2 RMU — Gerilim transformatörü / iç ihtiyaç' },
  { poz: '85.500.1222', usd: 19000, ad: 'AS36 LCV RMU — Akım gerilim ölçü (mühürlü)' },
  { poz: '85.510.2101', usd: 6500, ad: 'AS36 KB RMU — Kablo bağlama hücresi' },
  // Metal mahfazalı (hava yalıtımlı) — BF 85.510.x
  { poz: '85.510.1102', usd: 5900, ad: 'AS36 LC — Yük ayırıcılı giriş/çıkış (motorlu)' },
  { poz: '85.530.2403', usd: 6650, ad: 'AS36 LF — Sigortalı yük ayırıcılı koruma' },
  { poz: '85.510.1302', usd: 12400, ad: 'AS36 VTC/3 — İç ihtiyaç hücresi' },
];

for (const h of ASTOR_HUCRE) {
  const k = byPoz.get(h.poz);
  if (!k) { istatistik.bulunamadi.push(h.poz); continue; }
  const net = h.usd * kur * (1 - ted.hucre.iskonto);
  kalemEkle(h.poz, {
    malzeme: net,
    kaynak: `ASTOR ${h.ad} (USD ${h.usd.toLocaleString('tr-TR')} × ${kur} × %${ted.hucre.iskonto * 100} iskonto)`,
    sayac: 'tedarikci',
  });
}

// ---------------------------------------------------------------- 5. Kalan
// Önceki üreticinin KAPSAM listesi — motorun okuyabileceği kalemler.
// Motorun TRAFO_BLOKLARI ile okuduğu blokların tamamı. Bu liste motor.js
// ve maliyet-motoru.js ile aynı olmalı — ayrışırsa kVA listesi boş kalır.
const TRAFO_BLOKLARI = [
  '85.610.11', '85.610.13', '85.610.15',
  '85.630.11', '85.630.13', '85.630.15',
];

const KAPSAM = [
  ...TRAFO_BLOKLARI.map((b) => `${b}01`),   // her bloktan 20 kalem alınır, aşağıda filtrelenir
  '85.203.1101', '85.203.1201',
  '85.230.1101', '85.230.1102', '85.230.1103', '85.230.1104', '85.230.1106',
  '85.530.2401', '85.530.2402', '85.530.2403',
  // Hücreler — ASTOR listesi ile eşleşir (36 kV 630A sınıfı)
  '85.500.1203', '85.500.1207', '85.500.1211', '85.500.1215',
  '85.500.1216', '85.500.1219', '85.500.1222',
  '85.510.1102', '85.510.1302', '85.510.2101',
  '85.720.1301', '85.720.1302', '85.720.1303', '85.720.1304', '85.720.1305',
  '85.790.1105', '85.790.1106', '85.790.1202', '85.790.1203', '85.790.1204',
  '85.105.2301', '85.105.2302',
  '85.490.1201', '85.490.1202', '85.490.1203',
];

// Trafo bloklarının tamamı + tekil kalemler
// Trafo bloklarının TAMAMI + motorun okuyabildiği kablo blokları.
// Ön ek karşılaştırmasında nokta konulmamalı: poz "85.610.1101" ve blok
// "85.610.11" — "85.610.11." ile karşılaştırılırsa hiçbiri eşleşmez.
// Motorun taradığı kablo grupları — motor.js ile AYNI olmalı.
// Motor AG için 85.800.* + 85.840.*, OG için 85.830.* + 85.850.* + 85.860.* tarıyor.
const KABLO_GRUPLARI = ['85.800.', '85.840.', '85.830.', '85.850.', '85.860.'];

const hedefPozler = new Set(KAPSAM);
for (const k of db.kalemler) {
  if (TRAFO_BLOKLARI.some((b) => k.poz.startsWith(b))) hedefPozler.add(k.poz);
  if (KABLO_GRUPLARI.some((g) => k.poz.startsWith(g))) hedefPozler.add(k.poz);
}

for (const poz of hedefPozler) {
  if (kalemler[poz]) continue;
  if (atlananPoz.has(poz)) continue;
  const k = byPoz.get(poz);
  if (!k) { istatistik.bulunamadi.push(poz); continue; }
  kalemEkle(poz, {
    malzeme: k.malzeme,
    kaynak: 'TEDAŞ 2026 BFK (tedarikçi listesi yok — iskonto uygulanmadı)',
    sayac: 'bfkKatsayili',
  });
}

// Pabuç / ek manşonu — tamamı BFK
const kabloAksesuar = db.kalemler.filter((k) => k.poz.startsWith('85.870.'));
for (const k of kabloAksesuar) {
  if (kalemler[k.poz]) continue;
  kalemEkle(k.poz, {
    malzeme: k.malzeme,
    kaynak: 'TEDAŞ 2026 BFK (tedarikçi listesi yok)',
    sayac: 'bfkKatsayili',
  });
}

// ---------------------------------------------------------------- yaz
const cikti = {
  meta: {
    surum: '0.3.0',
    uretildi: new Date().toISOString().slice(0, 10),
    kapsam: 'trafo-baglantisi',
    kaynak: 'tedarikci-net',
    kaynakAciklama:
      'ASTOR %70, Öznur %65 iskonto ile hesaplanmış net bedeller. ' +
      'Listede olmayan kalemler TEDAŞ 2026 BFK bedeliyle duruyor.',
    uyari:
      `Döviz kuru ${ted.dovizKuru.USD} USD (${ted.dovizKuru.tarih}). Trafo ` +
      'bedellerinin tamamı bu kura bağlıdır. Kâr marjı bu dosyaya yazılmaz.',
    agKabloTipi: aktifTip,
    agKabloAdi: aktifTipBilgi?.ad ?? null,
    dovizKuru: kur,
    dovizKuruTarih: ted.dovizKuru.tarih ?? null,
    dovizKuruKaynak: ted.dovizKuru.kaynak ?? null,
    trafoIskonto,
    kabloIskonto,
    iscilikEkOrani: 0.35,
    kdvDahil: false,
    paraBirimi: 'TRY',
    kalemSayisi: Object.keys(kalemler).length,
    istatistik,
  },
  kalemler,
};

fs.writeFileSync(CIKTI, JSON.stringify(cikti, null, 2), 'utf8');

// ---------------------------------------------------------------- rapor
console.log('KAYNAK DAĞILIMI');
console.log(`  AG kablo tipi       : ${aktifTip} — ${aktifTipBilgi?.ad ?? '?'}`);
console.log(`  Trafo poz eşleşmesi : ${trafoPoz.size}`);
console.log(`  ASTOR kVA anahtarı  : ${Object.keys(ted.trafo.aPlus['list USD']).length}`);
console.log(`  Trafo eşleşen       : ${[...trafoPoz.keys()].filter((k) => ted.trafo.aPlus['list USD'][k] != null).join(', ')}`);
console.log(`  Tedarikçi net fiyat : ${istatistik.tedarikci}`);
console.log(`  BFK (iskontosuz)     : ${istatistik.bfkKatsayili}`);
console.log(`  Toplam kalem         : ${Object.keys(kalemler).length}`);

// Kontrol: beklenen eşleşmeler gerçekleşti mi?
console.log('\nEŞLEŞME KONTROLÜ');
const bekle = [
  ['Trafo 100 kVA', (() => {
    for (const [kva, poz] of trafoPoz) if (kva === 100) return [poz];
    return null;
  })()],
  ['AG kablo 1x150', kabloPoz.get('AG|1|150')],
  ['AG kablo 4x95', kabloPoz.get('AG|4|95')],
  ['AG kablo 4x150', kabloPoz.get('AG|4|150')],
  ['AG kablo 4x240', kabloPoz.get('AG|4|240')],
  ['AG kablo 3x95', kabloPoz.get('AG|3|95')],
  ['AG kablo 3x150', kabloPoz.get('AG|3|150')],
  ['OG kablo 1x150', kabloPoz.get('OG|1|150')],
  ['OG kablo 3x150', kabloPoz.get('OG|3|150')],
  ['Pabuc 150 mm²', ['85.870.1110']],
  ['Bakır bara kg', ['85.203.1101']],
  ['OG koruma 36kV', ['85.530.2403']],
];

let sorunlu = 0;
for (const [ad, pozler] of bekle) {
  if (!pozler?.length) {
    sorunlu++;
    console.log(`  ${ad.padEnd(22)} ${'BULUNAMADI'.padEnd(13)} — katalogda poz yok`);
    continue;
  }
  const ilk = pozler[0];
  const v = kalemler[ilk];
  const tedarikciMi = v?.kaynak?.startsWith('Öznur') || v?.kaynak?.startsWith('ASTOR');
  if (!tedarikciMi) sorunlu++;
  console.log(
    `  ${ad.padEnd(22)} ${ilk.padEnd(13)} ` +
    `${v ? bk(v.malzeme) : '—'} TL/${v?.birim ?? '—'}` +
    `  ${pozler.length > 1 ? `(+${pozler.length - 1} benzer poz)` : ''}` +
    `  ${tedarikciMi ? 'tedarikçi' : 'BFK'}`
  );
}

// Çoklu imzalı anahtarlar: hepsi fiyatlanmalı, eksik kalan varsa raporla.
const coklu = [...kabloPoz.entries()].filter(([, p]) => p.length > 1);
const cokluEksik = coklu.filter(([, p]) =>
  p.some((poz) => !kalemler[poz]?.kaynak?.startsWith('Öznur'))
);
console.log(`\n  Çoklu imzalı kablo anahtarı : ${coklu.length}`);
console.log(`  Tamamı fiyatlanan          : ${coklu.length - cokluEksik.length}`);
console.log(`  Eksik kalan                : ${cokluEksik.length}`);

if (cokluEksik.length) {
  console.log('\n  ÖZNUR LİSTESİNDE BULUNMAYAN KESİTLER (BFK bedeliyle kalıyor):');
  const ozet = cokluEksik.map(([a, p]) => ({
    imza: a,
    eksik: p.filter((z) => !kalemler[z]?.kaynak?.startsWith('Öznur')).length,
    toplam: p.length,
  }));
  const sigli = new Set(ozet.map((o) => o.imza));
  for (const imza of sigli) {
    const parcalar = imza.split('|');
    const tip = parcalar[0];
    const cekirdek = parcalar[1];
    const kesit = parcalar[2];
    const kayit = cokluEksik.find(([a]) => a === imza);
    const eksik = kayit[1].filter((z) => !kalemler[z]?.kaynak?.startsWith('Öznur')).length;
    console.log(
      `    ${tip} ${cekirdek}x${kesit} mm² — ${eksik}/${kayit[1].length} poz fiyatlanmadı`
    );
  }
}

if (!istatistik.tedarikci) {
  console.error('\n  HATA: hiç tedarikçi fiyatı uygulanmadı — eşleşme bozuk.');
  process.exit(1);
}
if (istatistik.bulunamadi.length) {
  console.log(`  Katalogda bulunamayan: ${istatistik.bulunamadi.join(', ')}`);
}
console.log(`\nDöviz kuru: 1 USD = ${kur} TL`);
console.log(`Yazıldı   : ${CIKTI}`);

// Örnek doğrulama
console.log('\nÖRNEK — 100 kVA hermetik trafo');
const t100 = trafoPoz.get(100);
const t = kalemler[t100];
if (t) {
  const usd = ted.trafo.aPlus['list USD'][100];
  console.log(`  ASTOR liste      : USD ${usd.toLocaleString('tr-TR')}`);
  console.log(`  → TL (${kur})     : ${bk(usd * kur)} TL`);
  console.log(`  → %${trafoIskonto * 100} iskonto: ${bk(t.malzeme)} TL`);
  console.log(`  BFK malzeme      : ${bk(byPoz.get(t100).malzeme)} TL`);
  console.log(`  Tasarruf         : ${bk(byPoz.get(t100).malzeme - t.malzeme)} TL (%${((1 - t.malzeme / byPoz.get(t100).malzeme) * 100).toFixed(0)})`);
}

console.log('\nÖRNEK — OG kablo 1x150/25 (8,7/15 kV)');
for (const [anahtar, poz] of kabloPoz) {
  if (anahtar === 'OG|1|150' && kalemler[poz]) {
    console.log(`  ${poz}  ${kalemler[poz].ad}`);
    console.log(`  Net : ${bk(kalemler[poz].malzeme)} TL/m`);
    console.log(`  BFK : ${bk(byPoz.get(poz).malzeme)} TL/m`);
    break;
  }
}

// ---------------------------------------------------------------- kontrol
console.log('\nKONTROL');
const adsiz = Object.values(kalemler).filter((v) => !v.ad).length;
const birimsiz = Object.values(kalemler).filter((v) => v.birim == null).length;
const montajsiz = Object.values(kalemler).filter((v) => v.montaj == null).length;

console.log(`  Adı olmayan kalem : ${adsiz}`);
console.log(`  Birimi olmayan    : ${birimsiz}`);
console.log(`  Montajı olmayan   : ${montajsiz} (yalnız malzeme — normal)`);

if (adsiz || birimsiz) {
  console.error('\nHATA: fiyat kitabı eksik yazıldı. Dosya bozuk kalabilir.');
  process.exit(1);
}