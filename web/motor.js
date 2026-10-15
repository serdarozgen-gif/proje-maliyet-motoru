/**
 * Proje Yaklaşık Maliyet Motoru — Hesap Motoru
 * Kapsam: YG/AG Trafo Bağlantısı
 *
 * TASARIM ILKESI — bu dosyadaki her eslesme ya katalogdan dogrulanmistir ya da
 * "tespit" olarak isaretlenir. Motor sessizce tahmin etmez: emin olmadigi yeri
 * girdi olarak kullaniciya acar veya tespit listesine yazar.
 * Bkz. docs/decisions/2026-10-06-yayin-modeli.md
 *
 * KODLAMA UYARISI: bu dosya UTF-8'dir. PowerShell ile yeniden yazilirken
 * `Set-Content -Encoding UTF8` cift kodlama yapabilir; duzenleme icin
 * edit/write aracini kullanin.
 */

/** Her OG güzergâhi için pabuc adedi: 3 faz x 2 uc = 6 */
const PABUC_PER_GUZERGAH = 6;

/** Trafo AG busing izolasyon kapagi — kVA bandi. Kaynak: 85.230.1101-1104 */
// Kalibrasyon katsayilari normlar.json'dan gelir; burada sabit degildir.
// Asagidaki BUSING_KAPAGI / AG_PANO / OG_SIGORTA / PLATFORM varsayilandir ve
// normlar.json -> tanimTablosu varsa onunla degistirilir.

/** Poz onekine gore kalem tipi. Iscilik ek orani buna gore secilir. */
function kalemTipi(poz, ad = '') {
  // Kablo blokları: motor taradığı 5 bloğun TAMAMI burada olmalı.
  // 2026-10-07: 85.840.x (AG 4-damar) ve 85.850.x (kablo pabucu/ek) eksikti —
  // bu kalemler 'varsayilan' (%35) ek oranı alıyordu, ölçülmüş kablo-montaj
  // oranı (%0) uygulanmıyordu. KABLO_GRUPLARI ile bu liste AYNI olmalı.
  if (poz.startsWith('85.830.') || poz.startsWith('85.800.') ||
      poz.startsWith('85.840.') || poz.startsWith('85.850.') ||
      poz.startsWith('85.860.')) {
    return ad.includes('çekim') ? 'kablo-cekimi' : 'kablo-montaj';
  }
  if (poz.startsWith('85.105.') && ad.includes('platform')) return 'direk-dikimi';
  if (poz.startsWith('85.490.') || poz.startsWith('85.890.')) return 'kanal';
  // Hücre (switchgear): 85.500.x/85.510.x ASTOR hücre pozları, 85.520.x/85.530.x
  // eski sigorta grubu pozları. 2026-10-07: 85.500.x ve 85.510.x eklendi —
  // ASTOR hücreleri seçilir olunca tip yanlışlıkla 'varsayilan' düşüyordu.
  if (
    poz.startsWith('85.500.') || poz.startsWith('85.510.') ||
    poz.startsWith('85.520.') || poz.startsWith('85.530.')
  ) return 'hucre-montaj';
  if (poz.startsWith('85.610.') || poz.startsWith('85.630.')) return 'trafo-montaj';
  if (poz.startsWith('85.720.') || poz.startsWith('85.730.')) return 'pano-montaj';
  if (poz.startsWith('85.870.')) return 'kablo-baglanti';
  if (poz.startsWith('85.790.11')) return 'topraklama-serit';
  if (poz.startsWith('85.790.12')) return 'topraklama-kazik';
  if (poz.startsWith('85.790.')) return 'topraklama';
  if (poz.startsWith('85.203.')) return 'bara';
  return 'varsayilan';
}

const BUSING_KAPAGI = [
  { enFazla: 160, poz: '85.230.1101' },
  { enFazla: 400, poz: '85.230.1102' },
  { enFazla: 800, poz: '85.230.1103' },
  { enFazla: 2000, poz: '85.230.1104' },
];

/** AG ana dagitim panosu — kVA. Kaynak: 85.720.1301-1305 */
const AG_PANO = [
  { enFazla: 50, poz: '85.720.1301' },
  { enFazla: 100, poz: '85.720.1302' },
  { enFazla: 160, poz: '85.720.1303' },
  { enFazla: 250, poz: '85.720.1304' },
  { enFazla: 400, poz: '85.720.1305' },
];

/** OG ana koruma — hücre (cell) eşleşmesi. Kaynak: ASTOR hücre listesi + BFK 85.500/85.510.
 * 36 kV 630A sınıfı için hücre tipleri.
 * Mevcut OG_SIGORTA (sigorta grubu) yedek olarak kalır.
 */
const OG_KORUMA_HUCRE = [
  // RMU (gaz yalıtımlı) — BFK 85.500.12xx
  { sistemler: ['36'], sinif: 'rmu', tip: 'trafo-koruma', poz: '85.500.1207', ad: 'AS36 LF RMU — Sigortalı trafo koruma' },
  { sistemler: ['36'], sinif: 'rmu', tip: 'giris-cikis', poz: '85.500.1203', ad: 'AS36 LC RMU — Giriş/çıkış' },
  { sistemler: ['36'], sinif: 'rmu', tip: 'kesicili', poz: '85.500.1211', ad: 'AS36 CBC RMU — Kesicili giriş/çıkış' },
  // Metal mahfazalı (hava yalıtımlı) — BFK 85.510.x / 85.530
  { sistemler: ['36'], sinif: 'metal', tip: 'trafo-koruma', poz: '85.530.2403', ad: 'AS36 LF Metal — Sigortalı koruma' },
  { sistemler: ['36'], sinif: 'metal', tip: 'giris-cikis', poz: '85.510.1102', ad: 'AS36 LC Metal — Giriş/çıkış' },
];

/** OG ana koruma sigorta grubu — sistem gerilimi. Kaynak: 85.530.2401-2403 (yedek) */
const OG_SIGORTA = [
  { sistemler: ['6,3', '10,5'], poz: '85.530.2401' }, // 12 kV anma gerilimli donanim
  { sistemler: ['36'], poz: '85.530.2403' },          // 36 kV
];

/** Trafo platformu — kVA bandina gore oneri (dogrulanmadi, secilebilir) */
const PLATFORM = [
  { enFazla: 400, poz: '85.105.2301' },
  { enFazla: Infinity, poz: '85.105.2302' },
];

function bantBul(tablo, kva) {
  return tablo.find((b) => kva <= b.enFazla) ?? null;
}

// ===================================================================
// Girdi
// ===================================================================

export const VARSAYILAN_GIRDI = {
  trafoTipi: 'yagli',      // 'yagli' | 'hermetik'
  kva: 250,
  // 36 kV tek gerilimle ilerliyoruz (karar 2026-10-06): ASTOR listesi ve
  // Öznur OG kablo serisi 28,5-36 kV sınıfı. Diğer sistemlerde bedel
  // BFK'ta kalır ve liste kısıtlıdır.
  ogSistem: '36',
  platform: 'yagli',       // 'yagli' | 'yok'
  topraklama: '85.790.1202',
  kanal: '85.490.1203',
  kanalUzunluk: 0,
  agPano: 'oto',           // 'oto' | 'yok' | poz
  ogSigorta: 'oto',         // 'oto' | 'yok' | poz
  hucreTipi: 'oto',          // 'oto' | 'rmu' | 'metal' — oto = RMU öncelikli (mevcut davranış)

  ogKabloCekirdek: 3,      // 3 = uc cekirdekli, 1 = tek cekirdekli
  ogKabloKesit: 150,       // mm² (faz)
  ogKabloYon: 1,           // kac güzergâh
  ogKabloUzunluk: 50,      // m / güzergâh
  ekMansonAdet: 0,
  pabuclu: true,
  pabucPerGuzergah: PABUC_PER_GUZERGAH,

  agKabloCekirdek: 4,
  agKabloKesit: 95,
  agKabloUzunluk: 10,
};

// ===================================================================
// Poz arayicilari
//
// Her arayici { poz, adaylar } doner. adaylar.length > 1 ise ayni teknik
// imzaya sahip birden fazla kalem vardir (ornegin 85.800.24xx / 25xx / 26xx
// bloklari). Motor ilkini secer ama tespit listesine yazar — sessizce secmez.
// ===================================================================

function enIyi(pozlar) {
  return pozlar.length ? { poz: pozlar[0], adaylar: pozlar } : { poz: null, adaylar: [] };
}

function imzadanTanim(imza) {
  return imza.replace(/\s+/g, ' ').trim();
}

// Kablo grupları — BFK'ta aynı kesit birden fazla grupta tekrarlanır:
//   85.830  OG XLPE bakır (zırhsız)
//   85.850  OG yassı çelik tel zırhlı
//   85.860  OG yuvarlak çelik tel zırhlı
//   85.800  AG NVV/NYM
//   85.840  AG zırhsız (büyük kesit)
// Hepsi taranır; birden fazla eşleşirse belirsizlik tespiti devreye girer.
const OG_KABLO_GRUPLARI = ['85.830.', '85.850.', '85.860.'];
const AG_KABLO_GRUPLARI = ['85.800.', '85.840.'];

/** OG kablo pozunu cekirdek ve kesitten bulur. */
function ogKabloPoz(kalemler, cekirdek, kesit) {
  const pozlar = [];
  for (const [poz, k] of Object.entries(kalemler)) {
    if (!OG_KABLO_GRUPLARI.some((g) => poz.startsWith(g))) continue;
    const m = k.ad.match(/^OG kablo (\d+)×([\d,]+) mm² \+ (\d+)/);
    if (!m) continue;
    if (Number(m[1]) === cekirdek && Number(m[2].replace(',', '.')) === kesit) pozlar.push(poz);
  }
  return enIyi(pozlar);
}

/** AG kablo pozunu cekirdek ve kesitten bulur. */
function agKabloPoz(kalemler, cekirdek, kesit) {
  const pozlar = [];
  for (const [poz, k] of Object.entries(kalemler)) {
    if (!AG_KABLO_GRUPLARI.some((g) => poz.startsWith(g))) continue;
    const m = k.ad.match(/^AG kablo (\d+)×([\d,]+) mm²/);
    if (!m) continue;
    if (Number(m[1]) === cekirdek && Number(m[2].replace(',', '.')) === kesit) pozlar.push(poz);
  }
  return enIyi(pozlar);
}

/** Kablo kesitinden bakir pabuc pozunu bulur (tam eslesme, yoksa en yakin buyuk). */
function pabucPoz(kalemler, kesit, aluminyum) {
  const adaylar = [];
  for (const [poz, k] of Object.entries(kalemler)) {
    if (!poz.startsWith('85.870.')) continue;
    const m = k.ad.match(/^(Bakır|Alüminyum) kablo pabucu ([\d,]+) mm²/);
    if (!m) continue;
    if ((m[1] === 'Alüminyum') !== aluminyum) continue;
    adaylar.push({ poz, kesit: Number(m[2].replace(',', '.')) });
  }
  if (!adaylar.length) return enIyi([]);
  adaylar.sort((a, b) => a.kesit - b.kesit);
  const tam = adaylar.filter((a) => a.kesit === kesit);
  if (tam.length) return enIyi(tam.map((a) => a.poz));
  const buyuk = adaylar.filter((a) => a.kesit > kesit);
  if (!buyuk.length) return enIyi([]);
  // tam eslesme yoksa en yakin buyuk kalem, uygun adaylar tek eleman
  return { poz: buyuk[0].poz, adaylar: [buyuk[0].poz] };
}

/** Cekirdek + ekleten alanina uyan ek mansion pozunu bulur. */
function mansonPoz(kalemler, cekirdekKesit, ekKesit, aluminyum) {
  const alani = cekirdekKesit + ekKesit;
  const pozlar = [];
  for (const [poz, k] of Object.entries(kalemler)) {
    if (!poz.startsWith('85.870.')) continue;
    const m = k.ad.match(/^(Bakır|Alüminyum) kablo ek manşonu ([\d,]+) mm²/);
    if (!m) continue;
    if ((m[1] === 'Alüminyum') !== aluminyum) continue;
    if (Number(m[2].replace(',', '.')) === alani) pozlar.push(poz);
  }
  return enIyi(pozlar);
}

/** Coklu aday varsa tespit metni uretir. */
function belirsizlikTespiti(bulunan, etiket) {
  if (!bulunan || bulunan.adaylar.length <= 1) return null;
  return (
    `${etiket}: ${bulunan.adaylar.length} kalem eşleşti (${bulunan.adaylar.join(', ')}). ` +
    `${bulunan.poz} kullanıldı. Doğru kalem tarif kitabıyla doğrulanmalıdır.`
  );
}

// ===================================================================
// Hesap
// ===================================================================

/**
 * @param {object} hamGirdi  kullanici girdileri
 * @param {object} kitap     data/fiyat_kitabi.json icerigi
 * @param {object} normlar   data/normlar.json — katsayilar. Verilmezse kitap.meta.
 */
export function hesapla(hamGirdi, kitap, normlar = null) {
  const g = { ...VARSAYILAN_GIRDI, ...hamGirdi };
  const kalemler = kitap.kalemler;

  // --- katsayilar: normlar.json > kitap.meta > gömülü varsayılan ---
  //
  // NOT (P3, 2026-10-15) — `kitap.meta.iscilikEkOrani` ÖLÜ KOD:
  // `data/normlar.json` `iscilik.genelEkOran` alanını taşıdığı için sol
  // taraf tanımlı olduğunda sağdaki dal HİÇ ÇALIŞMAZ. İki değer de 0.35
  // olduğu için davranış farkı yok — zararsız.
  //
  // Bu dal güvenli ölü kod çünkü P0 (2026-10-15) düzeltmesi sayesinde
  // normlar.json yüklenemezse motor artık hesap YAPMIYOR; normlarSorunu()
  // hatayı gösterip durduruyor. Yani bu yedeğe düşmek artık mümkün değil.
  //
  // İZLEMEDE: normlar.json yeniden üretilirse genelEkOran değişirse bu
  // yedek sessizce eskir. Fiyat_listesi_rehberi.md zaten bu alana bir şey
  // yazılmamasını söylüyor; risk alanın güncel TUTULMAMASI.
  const genelEkOran =
    normlar?.iscilik?.genelEkOran ?? kitap.meta.iscilikEkOrani ?? 0;
  // ÖLÇÜLMÜŞ oranlar (hucre-montaj -0.33, topraklama-kazik +0.66,
  // topraklama-serit -0.09, kablo-montaj 0) normlarda tanımlı. normlar
  // yüklüyken bunlar uygulanır; normlar yoksa hepsi tek orana düşer —
  // o yüzden normlar zorunludur, bkz. maliyet-motoru.js normlarSorunu().
  const tipOranlari =
    normlar?.iscilik?.tipBazliEkOran ?? { varsayilan: genelEkOran };
  const malzemeKatsayi = normlar?.malzemeKatsayisi?.varsayilan ?? 1;
  const iskonto = normlar?.iskontoOranlari ?? null;
  const tablo = normlar?.tanimTablosu ?? {};

  /** Poz öneki için iskonto oranı (en uzun eşleşen önek kazanır). */
  function iskontoBul(poz) {
    if (!iskonto) return null;
    const tabloPoz = iskonto.pozbazli ?? {};
    let enIyiOnEk = null;
    for (const onEk of Object.keys(tabloPoz)) {
      if (poz.startsWith(onEk) && (!enIyiOnEk || onEk.length > enIyiOnEk.length)) {
        enIyiOnEk = onEk;
      }
    }
    return enIyiOnEk ? tabloPoz[enIyiOnEk] : iskonto.varsayilan;
  }

  const bloklar = [];
  const tespitler = [];
  const eksikler = [];
  const ekOranKullanim = new Map();

  function satir(poz, adet) {
    const k = kalemler[poz];
    if (!k) {
      eksikler.push(`${poz} — fiyat kitabında yok`);
      return null;
    }
    if (!adet) return null;

    const tip = kalemTipi(poz, k.ad);
    const ekOran = tipOranlari[tip] ?? tipOranlari.varsayilan ?? genelEkOran;
    const nk = iskontoBul(poz);

    // Malzeme: katalog bedeli × malzeme katsayısı (varsayılan 1) × iskonto
    const malzeme = (k.malzeme ?? 0) * adet * malzemeKatsayi * (nk ?? 1);
    // İşçilik: montaj bedeli × (1 + tipe özel ek oran)
    const iscilik = (k.montaj ?? 0) * adet * (1 + ekOran);

    ekOranKullanim.set(tip, { ekOran, adet: (ekOranKullanim.get(tip)?.adet ?? 0) + adet });

    return {
      poz,
      ad: k.ad,
      birim: k.birim,
      tip,
      adet: Math.round(adet * 1000) / 1000,
      ekOran,
      iskonto: nk,
      birimFiyatMalzeme: k.malzeme ?? null,
      birimFiyatMontaj: k.montaj ?? null,
      malzeme,
      iscilik,
      toplam: malzeme + iscilik,
    };
  }

  function blokEkle(baslik, satirlar) {
    const dolu = satirlar.filter(Boolean);
    if (!dolu.length) return;
    bloklar.push({
      baslik,
      satirlar: dolu,
      malzeme: dolu.reduce((a, s) => a + s.malzeme, 0),
      iscilik: dolu.reduce((a, s) => a + s.iscilik, 0),
      toplam: dolu.reduce((a, s) => a + s.toplam, 0),
    });
  }

  // ---------------------------------------------------------- 1. Trafo
  // Trafo bloğu seçimi. ASTOR listesi 28,5-36/0,4 kV hermetik trafo
  // karşılığı veriyor; bu blok 85.630.15'tir.
  //   36 kV → 85.630.15 (28,5-36/0,4 kV — ASTOR ile birebir)
  //
  // KAPSAM: şimdilik 36 kV tek sistem (karar 2026-10-06). ASTOR listesi ve
  // Öznur OG kablo serisi bu sınıfta. Başka gerilime geçildiğinde buraya
  // blok eklenmeli — motor listede olmayan sistemde kalem üretmez.
  //
  // ÖN EK KARŞILAŞTIRMASI: poz "85.610.1501", blok "85.610.15" — blok sonuna
  // nokta konmaz. Nokta konursa hiçbir kalem eşleşmez ve kVA listesi boş kalır.
  const TRAFO_BLOKLARI = {
    yagli: { '36': '85.610.15' },
    hermetik: { '36': '85.630.15' },
  };
  const onEk = TRAFO_BLOKLARI[g.trafoTipi]?.[g.ogSistem] ?? TRAFO_BLOKLARI.hermetik['36'];

  const uygunTrafo = Object.entries(kalemler)
    .filter(([poz]) => poz.startsWith(onEk))
    .map(([poz, k]) => {
      const m = k.ad.match(/^(\d+) kVA/);
      return m ? { poz, kva: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.kva - b.kva);

  const trafoSatirlari = [];
  const tamEslesme = uygunTrafo.find((t) => t.kva === g.kva);
  if (tamEslesme) {
    trafoSatirlari.push(satir(tamEslesme.poz, 1));
  } else {
    const enYakin = uygunTrafo.find((t) => t.kva > g.kva) ?? uygunTrafo.at(-1);
    if (enYakin) {
      trafoSatirlari.push(satir(enYakin.poz, 1));
      tespitler.push(
        `${g.kva} kVA için kalem yok; listedeki en yakın ${enYakin.kva} kVA kalemi ` +
        `(${kalemler[enYakin.poz].ad}) kullanıldı. Sonuç gerçeği yansıtmayabilir — ` +
        `doğru gücü seçin veya fiyat listesine ekleyin.`
      );
    } else {
      eksikler.push(`${g.kva} kVA ${g.trafoTipi} trafo — fiyat kitabında karşılığı yok`);
    }
  }
  blokEkle('Dağıtım trafosu', trafoSatirlari);

  // ---------------------------------------------------------- 2. Izolasyon / platform
  const izolasyonSatirlari = [];
  const busing = bantBul(tablo.busingKapagi ?? BUSING_KAPAGI, g.kva);
  if (busing) {
    izolasyonSatirlari.push(satir(busing.poz, 1));
  } else {
    tespitler.push(`${g.kva} kVA için AG buşing izolasyon kapağı bandı bulunamadı (>2000 kVA).`);
  }
  if (g.platform === 'yagli') {
    const p = bantBul(tablo.platform ?? PLATFORM, g.kva);
    if (p) {
      izolasyonSatirlari.push(satir(p.poz, 1));
      tespitler.push(
        `Platform (${p.poz}) ${g.kva} kVA bandından seçildi. Platform gerekip ` +
        `gerekmediği projeye göre doğrulanmalıdır.`
      );
    }
  }
  blokEkle('İzolasyon ve platform', izolasyonSatirlari);

  // ---------------------------------------------------------- 3. OG koruma — hücre (cell) bazlı
  const korumaSatirlari = [];
  if (g.ogSigorta === 'oto') {
    // Önce hücre bazlı koruma dene (ASTOR hücre listesi)
    const adaylar = (tablo.ogKorumaHuc ?? OG_KORUMA_HUCRE).filter(
      (x) => x.sistemler.includes(g.ogSistem) && x.tip === 'trafo-koruma'
    );
    // hucreTipi 'oto' = listede ilk (RMU öncelikli) — mevcut davranış korunur.
    // 'rmu' / 'metal' = ilgili sınıfın trafo koruma hücresi.
    const h = g.hucreTipi === 'metal'
      ? adaylar.find((x) => x.sinif === 'metal')
      : g.hucreTipi === 'rmu'
        ? adaylar.find((x) => x.sinif === 'rmu')
        : adaylar[0];
    if (h) {
      korumaSatirlari.push(satir(h.poz, 1));
      tespitler.push(
        `OG koruma: ${g.ogSistem} kV sistem için ${kalemler[h.poz]?.ad ?? h.ad} seçildi ` +
        `(${h.sinif === 'metal' ? 'metal mahfazalı' : 'RMU'} trafo koruma hücresi). ` +
        `Donanım anma gerilimi ile sistem gerilimi eşleşmesi projeye göre doğrulanmalıdır.`
      );
    } else {
      // Yedek: sigorta grubu (eski yöntem)
      const s = (tablo.ogSigorta ?? OG_SIGORTA).find((x) => x.sistemler.includes(g.ogSistem));
      if (s) {
        korumaSatirlari.push(satir(s.poz, 1));
        tespitler.push(
          `OG koruma: ${g.ogSistem} kV sistem için ${kalemler[s.poz].ad} seçildi (sigorta grubu — yedek). ` +
          `Donanım anma gerilimi ile sistem gerilimi eşleşmesi projeye göre doğrulanmalıdır.`
        );
      } else {
        eksikler.push(`${g.ogSistem} kV için OG koruma kalemi yok`);
      }
    }
  } else if (g.ogSigorta !== 'yok') {
    korumaSatirlari.push(satir(g.ogSigorta, 1));
  }
  blokEkle('OG koruma', korumaSatirlari);

  // ---------------------------------------------------------- 4. OG kablo + pabuc
  const ogSatirlari = [];
  const ogBulunan = ogKabloPoz(kalemler, g.ogKabloCekirdek, g.ogKabloKesit);
  if (!ogBulunan.poz) {
    eksikler.push(`OG kablo ${g.ogKabloCekirdek}x${g.ogKabloKesit} mm² — fiyat kitabında yok`);
  } else {
    const bel = belirsizlikTespiti(ogBulunan, `OG kablo ${g.ogKabloCekirdek}x${g.ogKabloKesit} mm²`);
    if (bel) tespitler.push(bel);

    // Tek cekirdekli kabloda her güzergâh 3 adet (faz) cekirdek ister.
    const fazCarpani = g.ogKabloCekirdek === 1 ? 3 : 1;
    ogSatirlari.push(satir(ogBulunan.poz, g.ogKabloUzunluk * g.ogKabloYon * fazCarpani));

    // Pabuc: 3 faz x 2 uc = güzergâh basina 6 adet.
    if (g.pabuclu) {
      const pBulunan = pabucPoz(kalemler, g.ogKabloKesit, false);
      const pAdet = g.ogKabloYon * g.pabucPerGuzergah;
      if (pBulunan.poz) {
        ogSatirlari.push(satir(pBulunan.poz, pAdet));
        tespitler.push(
          `Kablo pabucu ${g.ogKabloYon} güzergâh x ${g.pabucPerGuzergah} uc = ` +
          `${pAdet} ad olarak hesaplandı (3 faz x 2 uc). Gercek uc adedi projeye gore doğrulanmalıdır.`
        );
      } else {
        eksikler.push(`${g.ogKabloKesit} mm² kablo pabucu — fiyat kitabında yok`);
      }
    }

    if (g.ekMansonAdet > 0) {
      const mBulunan = mansonPoz(kalemler, g.ogKabloKesit, 25, false);
      if (mBulunan.poz) {
        ogSatirlari.push(satir(mBulunan.poz, g.ekMansonAdet));
        const bel = belirsizlikTespiti(mBulunan, `Ek manşonu ${g.ogKabloKesit}+25 mm²`);
        if (bel) tespitler.push(bel);
      } else {
        eksikler.push(`Ek manşonu ${g.ogKabloKesit}+25 mm² — fiyat kitabında yok`);
      }
    }
  }
  blokEkle('OG kablo ve bağlantı elemanları', ogSatirlari);

  // ---------------------------------------------------------- 5. AG taraf
  const agSatirlari = [];
  if (g.agPano !== 'yok') {
    let panoPoz = g.agPano;
    if (g.agPano === 'oto') {
      panoPoz = bantBul(tablo.agPano ?? AG_PANO, g.kva)?.poz ?? null;
      if (!panoPoz) {
        tespitler.push(
          `${g.kva} kVA için AG ana dağıtım panosu kalemi yok (>400 kVA). ` +
          `Pano kapsamı projeye göre belirlenmelidir.`
        );
      } else {
        tespitler.push(
          `AG panosu ${g.kva} kVA bandından seçildi (${kalemler[panoPoz]?.ad}). ` +
          `Pano tipi ve besleme çıkışı projeye göre doğrulanmalıdır.`
        );
      }
    }
    if (panoPoz) agSatirlari.push(satir(panoPoz, 1));
  }

  if (g.agKabloUzunluk > 0) {
    const agBulunan = agKabloPoz(kalemler, g.agKabloCekirdek, g.agKabloKesit);
    if (agBulunan.poz) {
      agSatirlari.push(satir(agBulunan.poz, g.agKabloUzunluk));
      const bel = belirsizlikTespiti(agBulunan, `AG kablo ${g.agKabloCekirdek}x${g.agKabloKesit} mm²`);
      if (bel) tespitler.push(bel);
    } else {
      eksikler.push(`AG kablo ${g.agKabloCekirdek}x${g.agKabloKesit} mm² — fiyat kitabında yok`);
    }
  }
  blokEkle('AG taraf', agSatirlari);

  // ---------------------------------------------------------- 6. Topraklama / kanal
  const digerSatirlari = [satir(g.topraklama, 1)];
  if (g.kanalUzunluk > 0) digerSatirlari.push(satir(g.kanal, g.kanalUzunluk));
  blokEkle('Topraklama ve kanal', digerSatirlari);

  // ---------------------------------------------------------- toplam
  const toplamMalzeme = bloklar.reduce((a, b) => a + b.malzeme, 0);
  const toplamIscilik = bloklar.reduce((a, b) => a + b.iscilik, 0);
  const toplam = toplamMalzeme + toplamIscilik;

  return {
    bloklar,
    tespitler,
    eksikler,
    ozet: {
      malzeme: toplamMalzeme,
      iscilik: toplamIscilik,
      toplam,
      iscilikPayi: toplam > 0 ? toplamIscilik / toplam : 0,
      kalemSayisi: bloklar.reduce((a, b) => a + b.satirlar.length, 0),
      // Hangi kalem tipi hangi ek oranla hesaplandı — kalibrasyon izlenebilirliği
      ekOranKullanim: Object.fromEntries(ekOranKullanim),
      genelEkOran,
      malzemeKatsayi,
      iskontoVar: !!iskonto,
      normlarSurumu: normlar?.surum ?? null,
      kitapSurumu: kitap.meta.surum,
      kitapKaynagi: kitap.meta.kaynak,
      kitapKalem: kitap.meta.kalemSayisi,
      kdvDahil: kitap.meta.kdvDahil,
    },
  };
}