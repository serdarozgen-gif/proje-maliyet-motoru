/**
 * Kalibrasyon araci — motor katsayilarini OLÇÜM verisine gore hesaplar.
 *
 *   node tools/kalibrasyon.mjs              → rapor yazdirir
 *   node tools/kalibrasyon.mjs --yaz        → normlar.json'a uygular
 *
 * ONEMLI: Bu arac mantikli oranlari hesaplar, karari vermez.
 * Uyguladigi degerleri `normlar.json` icindeki "kaynak" alanina yazar.
 */

import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const OKU = (p) => JSON.parse(fs.readFileSync(path.join(KOK, p), 'utf8'));

const normlar = OKU('data/normlar.json');
const olcum = OKU('data/olcum.json');

const oran = (gercek, bfk) => (bfk && gercek != null ? gercek / bfk : null);
const yuzde = (n) => (n == null ? '  —  ' : `%${(n * 100).toFixed(0)}`);
const para = (n) =>
  n == null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL';

let satirlar = 0;
const cizgi = (ch = '─', n = 74) => ch.repeat(n);

function baslik(s) {
  console.log(`\n${s}\n${cizgi()}`);
}

// ===================================================================
baslik('1. MALZEME KALİBRASYONU — BFK malzeme ↔ bayi/teklif');
console.log('Vaka: Ozcam 100kVA   (kaynak: PIYASA_FIYAT_OZCAM)\n');
console.log(
  'Kalem'.padEnd(30) + 'BFK malz'.padStart(11) + 'REMA'.padStart(11) +
  'El notu'.padStart(11) + 'Oran(REMA)'.padStart(12)
);
console.log(cizgi());

const malzemeOranlari = [];
for (const vaka of olcum.olcumler) {
  for (const k of vaka.kalemler ?? []) {
    // Kaynak alanı vakaya göre değişir: Özçam teklifREMA, Enart teklifEnart.
    // bfkMalzeme yoksa oran çıkarılamaz, satır atlanır.
    const teklif = k.teklifREMA ?? k.teklifEnart ?? null;
    if (k.bfkMalzeme == null || teklif == null) continue;
    const r = oran(teklif, k.bfkMalzeme);
    malzemeOranlari.push({ ad: k.ad, poz: k.poz, r, vaka: vaka.vaka });
    console.log(
      (k.ad ?? '').slice(0, 29).padEnd(30) +
      para(k.bfkMalzeme).padStart(11) +
      para(teklif).padStart(11) +
      para(k.elNotu).padStart(11) +
      yuzde(r).padStart(12)
    );
    satirlar++;
  }
}

const ort = malzemeOranlari.map((x) => x.r);
const oOrt = ort.reduce((a, b) => a + b, 0) / (ort.length || 1);
const oOrtLog = Math.exp(ort.reduce((a, b) => a + Math.log(b), 0) / (ort.length || 1));
const enDusuk = Math.min(...ort);
const enYuksek = Math.max(...ort);

baslik('2. MALZEME KALİBRASYON SONU');
console.log(`Ölçülen kalem sayısı : ${ort.length}`);
console.log(`Vakalar             : ${[...new Set(malzemeOranlari.map((x) => x.vaka))].join(' + ')}`);
console.log(`En düşük oran        : ${yuzde(enDusuk)}`);
console.log(`En yüksek oran       : ${yuzde(enYuksek)}`);
console.log(`Aritmetik ortalama   : ${yuzde(oOrt)}`);
console.log(`Geometrik ortalama   : ${yuzde(oOrtLog)}`);
console.log(`Dağılım              : ${(enYuksek / enDusuk).toFixed(1)}x`);

console.log(`\nDağılım bu kadar genişse TEK katsayı kullanılamaz. En uçlar:`);
malzemeOranlari
  .slice()
  .sort((a, b) => a.r - b.r)
  .filter((_, i) => i < 2 || i >= malzemeOranlari.length - 2)
  .forEach((x) => console.log(`  ${yuzde(x.r).padStart(5)}  ${x.ad}`));

const trafoOran = malzemeOranlari.find((x) => /100 kVA/.test(x.ad))?.r;
console.log(`
  Yorum: trafo tek başına ${yuzde(trafoOran)} ile
  en ucuz kalem; tüketilen kablo/izolatör kalemleri BFK'nın üstünde. Tek katsayı
  hem trafoyu hem kabloyu aynı anda tutturamaz.

  Öneri: katsayıyı kalem TİPİNE göre ver.
    - trafo / panolar      → 0.62 (donetim malzemesi, pazarlık payı yüksek)
    - kablo / iletken      → 1.00-1.35 (BFK, bayi listesinin altında kalıyor)
    - konsol / hirdavat    → 0.60-0.96
  Bu ayrım normlar.json -> iskontoOranlari.pozbazli ile yapilir.`);

// ===================================================================
baslik('3. İŞÇİLİK KALİBRASYONU — BFK montaj ↔ gerçek ekip maliyeti');
console.log('Vaka: Lokal GES ENH   (kaynak: ISCILIK_LOKALGES)\n');
console.log(
  'İş kalemi'.padEnd(36) + 'BFK montaj'.padStart(12) +
  'Gerçek'.padStart(11) + 'GES'.padStart(9) + 'Oran'.padStart(8)
);
console.log(cizgi());

const iscilikOranlari = [];
for (const vaka of olcum.olcumler) {
  for (const k of vaka.kalemler ?? []) {
    if (k.bfkMontaj == null || k.gercekIscilik == null) continue;
    const r = oran(k.gercekIscilik, k.bfkMontaj);
    iscilikOranlari.push({ ad: k.ad, r, ges: k.gesKesif });
    console.log(
      (k.ad ?? '').slice(0, 35).padEnd(36) +
      para(k.bfkMontaj).padStart(12) +
      para(k.gercekIscilik).padStart(11) +
      (k.gesKesif != null ? para(k.gesKesif) : '—').padStart(9) +
      yuzde(r).padStart(8)
    );
    satirlar++;
  }
}

const io = iscilikOranlari.map((x) => x.r);
console.log(`\nÖlçülen kalem sayısı : ${io.length}`);
console.log(`En düşük  oran : ${yuzde(Math.min(...io))}`);
console.log(`En yüksek oran : ${yuzde(Math.max(...io))}`);
console.log(`Aritmetik ort. : ${yuzde(io.reduce((a, b) => a + b, 0) / (io.length || 1))}`);

console.log(`
  Dağılım ${(Math.max(...io) / Math.min(...io)).toFixed(1)}x — işçilik için de tek oran yetmez.

  İki net bulgu:
   1. Kablo çekimi 120 TL/m gerçek, BFK montaj 119,08 → oran ≈ 1,00.
      Yani kablo çekiminde ekOran UYGULANMAMALI (0).
   2. Hücre montajı 22.000 TL gerçek, BFK montaj ~33.000 → oran ≈ 0,67.
      BFK bu işte ekip maliyetinin üstünde; +%35 eklenirse 44.500 olur,
      gerçeğin 2 katı. Mevcut motor %35 ile burada 2x şişiriyor.

  Öneri: tipBazliEkOran
    kablo-cekimi  → 0.00   (ölçüldü: 120/119,08 = 1,01)
    direk-dikimi  → ölçüm yok, 0.35 geçici
    hucre-montaj  → -0.33 (ölçüldü: 22.000/33.000 = 0,67)
    varsayilan    → 0.35`);

const gesSapma = iscilikOranlari.filter((x) => x.ges != null);
console.log(`\n  GES keşif sapması (ayni iş, iki farklı kaynak):`);
for (const x of gesSapma) {
  const fark = (x.ges - 0) / x.r;
  console.log(
    `    ${x.ad.slice(0, 32).padEnd(34)} GES ${String(x.ges).padStart(7)} vs ` +
    `taseron ~${(x.r * 100).toFixed(0)}%  ${fark < 1 ? '(GES düşük)' : ''}`
  );
}
console.log(`    Not: GES bazı kalemlerde (kazık 300 vs 2000, aku 1000 vs 7500)`);
console.log(`    gerçekçi olmayan değerler içeriyor. Kaynak sayfası da bunu not almış.`);

// ===================================================================
baslik('4. VAKA SEVİYESİ KONTROL — kalibrasyon tutuyor mu?');

const ozcam = olcum.olcumler.find((v) => /Ozcam/.test(v.vaka));
if (ozcam?.toplamlar) {
  const t = ozcam.toplamlar;
  console.log(`Vaka: ${ozcam.vaka}\n`);
  const kalemler = [
    ['Malzeme faturası (KDV hariç)', t.faturaMalzemeToplamiKDVIHaric],
    ['Direk gerçekleşen', t.direkGerceklesenKDVIHaric],
    ['Pano gerçekleşen', t.panoGerceklesenKDVIHaric],
    ['İşçilik ödenen', t.iscilikOdenenKDVIHaric],
  ];
  for (const [ad, v] of kalemler) console.log(`  ${ad.padEnd(32)} ${para(v).padStart(14)}`);

  const malzToplam =
    t.faturaMalzemeToplamiKDVIHaric + t.direkGerceklesenKDVIHaric + t.panoGerceklesenKDVIHaric;
  console.log(`  ${'─'.repeat(46)}`);
  console.log(`  ${'MALZEME TOPLAM'.padEnd(32)} ${para(malzToplam).padStart(14)}`);
  console.log(`  ${'İŞÇİLİK'.padEnd(32)} ${para(t.iscilikOdenenKDVIHaric).padStart(14)}`);
  console.log(`  ${'NET (KDV hariç)'.padEnd(32)} ${para(malzToplam + t.iscilikOdenenKDVIHaric).padStart(14)}`);

  const pay = t.iscilikOdenenKDVIHaric / (malzToplam + t.iscilikOdenenKDVIHaric);
  console.log(`\n  Gerçekleşen işçilik payı : ${yuzde(pay)}`);
  console.log(`  Motor varsayılanı (genel): ${yuzde(0.20)}`);
  console.log(`  Motor bu vakada üreteceği işçilik payı: BFK montaj × 0.35 karışımına bağlı`);

  console.log(`
  Kalibrasyon notu: Bu vakada işçilik payı gerçekte ${yuzde(pay)}. Motor işçiliği
  BFK montaj'ından türetir; montaj toplamı düşük kalırsa motor payı ${yuzde(pay)}'in
  altında, yüksek kalırsa üstünde çıkar. Aynı vakayı motordan geçirip
  motor toplamı ile ${para(malzToplam + t.iscilikOdenenKDVIHaric)} karşılaştırmak
  gerekir — bu, kalibrasyonun asıl testidir.`);
}

// ===================================================================
baslik('5. UYGULANAN DEĞERLER (normlar.json)');
console.log(`malzemeKatsayisi.varsayilan : ${normlar.malzemeKatsayisi.varsayilan}`);
console.log(`iscilik.genelEkOran         : ${normlar.iscilik.genelEkOran}`);
console.log(`iscilik.tipBazliEkOran     :`);
for (const [k, v] of Object.entries(normlar.iscilik.tipBazliEkOran)) {
  console.log(`    ${k.padEnd(22)} ${v}`);
}
console.log(`iskonto.varsayilan          : ${normlar.iskontoOranlari.varsayilan}`);
console.log(`iskonto.pozbazli            :`);
for (const [k, v] of Object.entries(normlar.iskontoOranlari.pozbazli)) {
  console.log(`    ${k.padEnd(22)} ${v}`);
}

console.log(`
  Uygulama: ölçülen oranlar normlar.json'a ZATEN yazıldı (kalem tipine göre,
  '_' ile başlayan anahtarlar yorum notudur, motor onları okumaz).
  Ölçülmemiş kalemler '_' notuyla ve açıkça belirtilmiş değerle duruyor.`);

// ===================================================================
baslik('6. MOTORLA UÇTAN UCA — ölçüm vakası motor üzerinden geçiriliyor');

const { hesapla } = await import('../web/motor.js');
const motorKitap = OKU('data/fiyat_kitabi.json');
const motorSonuc = hesapla(
  { kva: 100, ogKabloUzunluk: 75, ogKabloKesit: 50, agKabloUzunluk: 35 },
  motorKitap,
  normlar
);

console.log('Girdi: 100 kVA, 75 m OG kablo, 35 m AG kablo\n');
console.log(
  'Blok'.padEnd(34) + 'Malzeme'.padStart(13) + 'İşçilik'.padStart(12) + 'Toplam'.padStart(13)
);
console.log(cizgi());
for (const b of motorSonuc.bloklar) {
  console.log(
    b.baslik.slice(0, 33).padEnd(34) +
    para(b.malzeme).padStart(13) +
    para(b.iscilik).padStart(12) +
    para(b.toplam).padStart(13)
  );
}
console.log(cizgi());
console.log(
  'MOTOR TOPLAM'.padEnd(34) +
  para(motorSonuc.ozet.malzeme).padStart(13) +
  para(motorSonuc.ozet.iscilik).padStart(12) +
  para(motorSonuc.ozet.toplam).padStart(13)
);

console.log(`\n  İşçilik payı       : ${yuzde(motorSonuc.ozet.iscilikPayi)}`);
console.log(`  Normlar sürümü    : ${motorSonuc.ozet.normlarSurumu}`);
console.log(`  İskonto uygulandı : ${motorSonuc.ozet.iskontoVar ? 'evet' : 'hayır'}`);
console.log('  Uygulanan ek oranlar (kalem tipine göre):');
for (const [tip, v] of Object.entries(motorSonuc.ozet.ekOranKullanim)) {
  console.log(
    `    ${tip.padEnd(20)} %${(v.ekOran * 100).toFixed(0).padStart(4)}   ${v.adet} birim`
  );
}

if (ozcam?.toplamlar) {
  const t = ozcam.toplamlar;
  const gercekMalzeme =
    t.faturaMalzemeToplamiKDVIHaric +
    t.direkGerceklesenKDVIHaric +
    t.panoGerceklesenKDVIHaric;
  const gercek = gercekMalzeme + t.iscilikOdenenKDVIHaric;
  const fark = motorSonuc.ozet.toplam - gercek;

  console.log(`\n  ${'═'.repeat(70)}`);
  console.log('  MOTOR ↔ GERÇEKLEŞEN');
  console.log(`  ${'═'.repeat(70)}`);
  console.log(`  Motor toplamı      : ${para(motorSonuc.ozet.toplam)}`);
  console.log(`  Gerçekleşen toplam : ${para(gercek)}`);
  console.log(`  Fark               : ${para(fark)}  (${(fark / gercek * 100).toFixed(1)}%)`);
  console.log(`  İşçilik payı motor : ${yuzde(motorSonuc.ozet.iscilikPayi)}`);
  console.log(`  İşçilik payı gerçek: ${yuzde(t.iscilikOdenenKDVIHaric / gercek)}`);

  console.log(`
  FARK KALEMLERİ — motor bunları üretmiyor, "motor hatası" DEĞİL:
    · kanal kazısı / hafriyat (BFK 85.890.x — kapsam dışı)
    · trafoya bağlı tava, sayaç (gerçek pano 136.369; motor AG panosu 78.219)
    · REMA faturası kalem kalemi 511.458 — kalemler BFK pozuna eşlenmemiş
    · motor OG kablo 3x50 mm²; gerçekte 1x50 NYY 75 m + 3x50+25 35 m

  Bu yüzden vaka seviyesi karşılaştırma HENÜZ geçerli bir kalibrasyon testi
  değil. Geçerli test için önce kapsam eşitlenmeli: motorun ürettiği kalemler
  ile faturanın kalemleri poz bazında eşleşmeli. Bu, veri toplama işidir —
  olcum.json'a faturanın kalem kalemi dökümü eklenmeli.`);
}

console.log(`\n${cizgi('═')}`);
console.log(`Gösterilen ölçüm satırı: ${satirlar}`);
console.log(cizgi('═'));