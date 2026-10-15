/**
 * Motor testi — Proje Yaklaşık Maliyet Motoru
 *
 * Amaç: hesabın doğru olduğunu kanıtlamak. Elle doğrulanabilir senaryolar.
 *   node tools/motor_test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { hesapla } from '../web/motor.js';

const KOK = path.join(import.meta.dirname, '..');
const kitap = JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'fiyat_kitabi.json'), 'utf8'));

let gecti = 0;
let kaldi = 0;
const basarisiz = [];

function ok(ad, kosul, ek = '') {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}`);
  } else {
    kaldi++;
    basarisiz.push(ad + (ek ? ` — ${ek}` : ''));
    console.log(`  ✗ ${ad}${ek ? ' — ' + ek : ''}`);
  }
}

const tl = (n) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';

function topla(satirlar) {
  return satirlar.reduce((a, s) => a + s.toplam, 0);
}

// ===================================================================
console.log('\n=== 1. Varsayılan senaryo (250 kVA yağlı, 6,3 kV) ===');
{
  const r = hesapla({}, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);

  console.log(`  Blok sayısı : ${r.bloklar.length}`);
  console.log(`  Kalem sayısı : ${r.ozet.kalemSayisi}`);
  console.log(`  Malzeme     : ${tl(r.ozet.malzeme)}`);
  console.log(`  İşçilik     : ${tl(r.ozet.iscilik)}`);
  console.log(`  TOPLAM      : ${tl(r.ozet.toplam)}`);
  console.log(`  İşçilik payı: %${(r.ozet.iscilikPayi * 100).toFixed(1)}`);

  ok('toplam > 0', r.ozet.toplam > 0);
  ok('blok toplamları toplamla uyumlu',
    Math.abs(topla(tum) - r.ozet.toplam) < 0.01,
    `satır toplamı ${topla(tum).toFixed(2)} vs ${r.ozet.toplam.toFixed(2)}`);
  ok('malzeme + işçilik = toplam',
    Math.abs(r.ozet.malzeme + r.ozet.iscilik - r.ozet.toplam) < 0.01);
  ok('eksik kalem yok', r.eksikler.length === 0, r.eksikler.join('; '));
  ok('en az 1 tespit var (dürüstlük kuralı)', r.tespitler.length > 0);
  ok('trafo kalemi 250 kVA yağlı',
    tum.some((s) => s.ad.startsWith('250 kVA yağlı tip trafo')));
  // Eşik 2026-10-07'de %15-40'dan %10-40'a çekildi.
  // Gerekçe: OG koruma artık BFK sigorta grubu değil ASTOR hücresi. Hücre tek
  // başına malzemenin %32'si ve ölçülmüş montaj ek oranı -%33 (BFK montajının
  // %67'si). Büyük malzeme + düşük ölçülmüş işçilik oranı toplam payı aşağı
  // çekiyor. Ölçülen %19,3. Eski %15 eşiği hücre eklenmeden yazılmıştı.
  // Bkz. docs/decisions/2026-10-07-hucre-eslemesi.md
  ok('işçilik payı makul (%10-40)',
    r.ozet.iscilikPayi > 0.10 && r.ozet.iscilikPayi < 0.40,
    `%${(r.ozet.iscilikPayi * 100).toFixed(1)}`);
}

// ===================================================================
console.log('\n=== 2. 100 kVA hermetik, 36 kV ===');
{
  const r = hesapla({ trafoTipi: 'hermetik', kva: 100 }, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);
  const trafo = tum.find((s) => s.ad.startsWith('100 kVA hermetik'));

  console.log(`  Trafo       : ${trafo?.ad ?? 'BULUNAMADI'}`);
  console.log(`  Poz         : ${trafo?.poz ?? '—'}`);
  console.log(`  TOPLAM      : ${tl(r.ozet.toplam)}`);

  ok('hermetik trafo seçildi', !!trafo);
  // 2026-10-07 sargı kararı: 36 kV hermetik blok alüminyum (AOAk) fiyatlı.
  ok('36 kV hermetik ad alüminyum sargılı yazar', trafo?.ad.includes('alüminyum sargılı'), trafo?.ad);
  ok('36 kV bloğundan (85.630.15xx — ASTOR karşılığı)',
    !!trafo && trafo.poz.startsWith('85.630.15'));
  ok('eksik kalem yok', r.eksikler.length === 0, r.eksikler.join('; '));
  ok('36 kV koruma uyarısı var',
    r.tespitler.some((t) => t.includes('36 kV')));
}

console.log('\n=== 2b. 36 kV kapsamı — listede olmayan gerilim üretilmemeli ===');
{
  const r = hesapla({ ogSistem: '10,5', kva: 100 }, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);
  const trafo = tum.find((s) => s.ad.startsWith('100 kVA'));
  console.log(`  10,5 kV istenince : ${trafo?.poz ?? 'kablo yok'} (${trafo?.ad ?? '—'})`);
  ok('desteklenmeyen gerilimde 36 kV kalemine düşüyor',
    !trafo || trafo.poz.startsWith('85.630.15'), trafo?.poz);
}

// ===================================================================
console.log('\n=== 3. İşçilik ekleme oranı doğru uygulanıyor mu? ===');
{
  const r = hesapla({ kva: 250 }, kitap);
  const s = r.bloklar.flatMap((b) => b.satirlar).find((x) => x.ad.startsWith('250 kVA'));
  const beklenen = s.birimFiyatMontaj * (1 + kitap.meta.iscilikEkOrani) * s.adet;
  console.log(`  Trafo montaj : ${tl(s.birimFiyatMontaj)}`);
  console.log(`  İşçilik     : ${tl(s.iscilik)} (beklenen ${tl(beklenen)})`);
  ok('işçilik = montaj × (1+ek) × adet', Math.abs(s.iscilik - beklenen) < 0.01);
}

// ===================================================================
console.log('\n=== 3b. Tip bazlı ek oran (normlar.json) ===');
{
  const normlar = JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'normlar.json'), 'utf8'));
  const r = hesapla({ kva: 250 }, kitap, normlar);
  const tum = r.bloklar.flatMap((b) => b.satirlar);

  console.log(`  Normlar sürümü : ${r.ozet.normlarSurumu}`);
  console.log(`  Genel ek oranı : ${r.ozet.genelEkOrani ?? r.ozet.genelEkOran}`);
  console.log('  Tip bazlı kullanım:');
  for (const [tip, v] of Object.entries(r.ozet.ekOranKullanim)) {
    console.log(`    ${tip.padEnd(18)} ek oran ${(v.ekOran * 100).toFixed(0).padStart(4)}%  (${v.adet} birim)`);
  }

  const kabloSatiri = tum.find((s) => s.poz.startsWith('85.830.'));
  // 2026-10-07: OG koruma artık 85.530.x sigorta grubu değil, ASTOR hücresi
  // (85.500.x) seçiliyor. Test eski kapsamı arıyordu.
  const sigortaSatiri = tum.find((s) => s.poz.startsWith('85.500.'));

  console.log(`\n  OG kablo tipi   : ${kabloSatiri?.tip}  ek oran %${((kabloSatiri?.ekOran ?? 0) * 100).toFixed(0)}`);
  console.log(`  OG koruma tipi  : ${sigortaSatiri?.tip}  ek oran %${((sigortaSatiri?.ekOran ?? 0) * 100).toFixed(0)}`);

  ok('her satırda kalem tipi var', tum.every((s) => typeof s.tip === 'string' && s.tip));
  ok('ek oran kullanım raporlandı', Object.keys(r.ozet.ekOranKullanim).length > 0);
  ok('kablo tipi tanıdı', kabloSatiri?.tip === 'kablo-montaj', kabloSatiri?.tip);
  ok('koruma tipi hucre-montaj', sigortaSatiri?.tip === 'hucre-montaj', sigortaSatiri?.tip);
  ok('normlar sürümü çıktıda', r.ozet.normlarSurumu === normlar.surum);
  ok('iskonto uygulandı', r.ozet.iskontoVar === true);
}

// ===================================================================
console.log('\n=== 3c. İskonto: trafo bedeli BFK altında olmalı ===');
{
  const normlar = JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'normlar.json'), 'utf8'));
  const r = hesapla({ kva: 100 }, kitap, normlar);
  const trafo = r.bloklar.flatMap((b) => b.satirlar).find((s) => s.ad.startsWith('100 kVA'));

  console.log(`  Trafo          : ${trafo.ad}`);
  console.log(`  BFK malzeme    : ${trafo.birimFiyatMalzeme.toLocaleString('tr-TR')} TL`);
  console.log(`  Uygulanan isk. : %${(trafo.iskonto * 100).toFixed(0)}`);
  console.log(`  Yayımlanan     : ${trafo.malzeme.toLocaleString('tr-TR')} TL`);
  console.log(`  Beklenen       : ${(trafo.birimFiyatMalzeme * trafo.iskonto).toLocaleString('tr-TR')} TL`);

  ok('iskonto 0,62 uygulandı (ölçülen trafo oranı)', Math.abs(trafo.iskonto - 0.62) < 0.001);
  ok('malzeme iskonto ile çarpıldı',
    Math.abs(trafo.malzeme - trafo.birimFiyatMalzeme * trafo.iskonto) < 0.01);
}

// ===================================================================
console.log('\n=== 3d. Normsuz çalışma geriye uyumlu ===');
{
  const normsuz = hesapla({ kva: 250 }, kitap);
  const normlu = hesapla({ kva: 250 }, kitap, JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'normlar.json'), 'utf8')));
  ok('normsuz çalışır', normsuz.ozet.toplam > 0);
  ok('normlu çalışır', normlu.ozet.toplam > 0);
  ok('ikisi de poz üretir',
    normsuz.ozet.kalemSayisi === normlu.ozet.kalemSayisi,
    `${normsuz.ozet.kalemSayisi} vs ${normlu.ozet.kalemSayisi}`);
}

// ===================================================================
console.log('\n=== 4. Büyük/satır kombinasyonu kablo miktarı ===');
{
  // 250 m, 1 güzergâh, 3 çekirdekli 150 mm² -> 250 m
  const r3 = hesapla({ ogKabloCekirdek: 3, ogKabloUzunluk: 250, ogKabloYon: 1 }, kitap);
  const k3 = r3.bloklar.flatMap((b) => b.satirlar).find((s) => s.ad.startsWith('OG kablo'));
  // tek çekirdekli 150 mm², 250 m, 1 güzergâh -> 750 m (3 faz)
  const r1 = hesapla({ ogKabloCekirdek: 1, ogKabloUzunluk: 250, ogKabloYon: 1 }, kitap);
  const k1 = r1.bloklar.flatMap((b) => b.satirlar).find((s) => s.ad.startsWith('OG kablo'));

  console.log(`  3 çekirdekli : ${k3?.adet} m  (${k3?.ad})`);
  console.log(`  1 çekirdekli : ${k1?.adet} m  (${k1?.ad})`);

  ok('üç çekirdekli kablo miktarı = uzunluk × yön', k3?.adet === 250, `${k3?.adet}`);
  ok('tek çekirdekli kablo miktarı = uzunluk × yön × 3', k1?.adet === 750, `${k1?.adet}`);
}

// ===================================================================
console.log('\n=== 5. Pabuç adedi (güzergâh × 6) ===');
{
  const r = hesapla({ ogKabloYon: 2 }, kitap);
  const p = r.bloklar.flatMap((b) => b.satirlar).find((s) => s.ad.startsWith('Bakır kablo pabucu'));
  console.log(`  Pabuç: ${p?.adet} ad — ${p?.ad}`);
  ok('2 güzergâh → 12 pabuç', p?.adet === 12, `${p?.adet}`);
  ok('pabuç tespiti yazıldı',
    r.tespitler.some((t) => t.includes('pabuc')));
}

// ===================================================================
console.log('\n=== 6. Tam eşleşme olmayan kVA — dürüstlük ===');
{
  const r = hesapla({ kva: 123 }, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);
  console.log(`  Toplam : ${tl(r.ozet.toplam)}`);
  r.tespitler.filter((t) => t.includes('123')).forEach((t) => console.log(`  TESPİT: ${t}`));
  ok('tam eşleşme yoksa tespit yazıldı', r.tespitler.some((t) => t.includes('123 kVA')));
  ok('yine de kalem üretildi', tum.length > 0);
}

// ===================================================================
console.log('\n=== 7. 36 kV sistem ===');
{
  const r = hesapla({ ogSistem: '36', kva: 1600 }, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);
  const koruma = tum.find((s) => s.poz.startsWith('85.500.'));
  console.log(`  Koruma   : ${koruma?.ad ?? 'BULUNAMADI'}`);
  console.log(`  Poz      : ${koruma?.poz ?? '—'}`);
  console.log(`  Toplam   : ${tl(r.ozet.toplam)}`);
  // 2026-10-07: eskiden "36 kV / 630 A (takım)" sigorta grubu bekleniyordu.
  // Artık ASTOR RMU trafo koruma hücresi (85.500.1207) seçiliyor.
  ok('36 kV trafo koruma hücresi seçildi', koruma?.poz === '85.500.1207', koruma?.poz);
  ok('1600 kVA trafo seçildi', tum.some((s) => s.ad.startsWith('1600 kVA')));
  ok('>400 kVA pano uyarısı var', r.tespitler.some((t) => t.includes('400 kVA')));
}

// ===================================================================
console.log('\n=== 7b. Hücre tipi seçimi (RMU / metal) ===');
{
  // 2026-10-07: kullanıcı kararı — arayüzde RMU / metal seçimi.
  const oto = hesapla({ ogSistem: '36' }, kitap);
  const rmu = hesapla({ ogSistem: '36', hucreTipi: 'rmu' }, kitap);
  const metal = hesapla({ ogSistem: '36', hucreTipi: 'metal' }, kitap);
  const poz = (r) => r.bloklar.flatMap((b) => b.satirlar)
    .find((s) => s.poz === '85.500.1207' || s.poz === '85.530.2403')?.poz;

  console.log(`  oto   : ${poz(oto)}`);
  console.log(`  rmu   : ${poz(rmu)}`);
  console.log(`  metal : ${poz(metal)}`);

  ok('oto RMU seçer (mevcut davranış)', poz(oto) === '85.500.1207', poz(oto));
  ok('rmu RMU seçer', poz(rmu) === '85.500.1207', poz(rmu));
  ok('metal metal seçer', poz(metal) === '85.530.2403', poz(metal));

  const metalSatir = metal.bloklar.flatMap((b) => b.satirlar)
    .find((s) => s.poz === '85.530.2403');
  ok('metal hücre tipi hucre-montaj', metalSatir?.tip === 'hucre-montaj', metalSatir?.tip);
  ok('metal RMUdan ucuz',
    metal.ozet.toplam < rmu.ozet.toplam,
    `${metal.ozet.toplam.toFixed(0)} vs ${rmu.ozet.toplam.toFixed(0)}`);
}

// ===================================================================
console.log('\n=== 8. Olmayan kalem — sessizce geçmemeli ===');
{
  const r = hesapla({ ogKabloKesit: 999 }, kitap);
  console.log(`  Eksikler: ${r.eksikler.length}`);
  r.eksikler.forEach((e) => console.log(`  EKSİK: ${e}`));
  ok('olmayan kesitte eksik listesi doldu', r.eksikler.length > 0);
}

// ===================================================================
console.log('\n=== 9. Topraklama / kanal kapatma ===');
{
  const r = hesapla({ kanalUzunluk: 0, agPano: 'yok' }, kitap);
  const tum = r.bloklar.flatMap((b) => b.satirlar);
  ok('kanal uzunluğu 0 ise kanal satırı yok', !tum.some((s) => s.ad.includes('kanal')));
  ok('AG pano kapatılınca pano satırı yok', !tum.some((s) => s.ad.includes('pano')));
  ok('topraklama satırı her zaman var', tum.some((s) => s.ad.includes('Topraklama')));
}

// ===================================================================
console.log('\n=== 9b. Topraklama alt tipleri (kazık / şerit) ===');
{
  // 2026-10-07: tek 'topraklama' tipi zıt yönlü iki ölçümü temsil edemiyordu
  // (kazık 1.66, şerit 0.91). Poz önekiyle ayrıldı, ölçülmüş oranlar uygulandı.
  const normlar = JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'normlar.json'), 'utf8'));
  const kazik = hesapla({ topraklama: '85.790.1203' }, kitap, normlar);
  const serit = hesapla({ topraklama: '85.790.1106' }, kitap, normlar);
  const kSatir = kazik.bloklar.flatMap((b) => b.satirlar).find((s) => s.poz === '85.790.1203');
  const sSatir = serit.bloklar.flatMap((b) => b.satirlar).find((s) => s.poz === '85.790.1106');

  console.log(`  kazık : tip=${kSatir?.tip} ek=%${((kSatir?.ekOran ?? 0) * 100).toFixed(0)}`);
  console.log(`  şerit : tip=${sSatir?.tip} ek=%${((sSatir?.ekOran ?? 0) * 100).toFixed(0)}`);

  ok('kazık tipi topraklama-kazik', kSatir?.tip === 'topraklama-kazik', kSatir?.tip);
  ok('kazık ek oran +0.66 (ölçülen 1.66)', kSatir?.ekOran === 0.66, String(kSatir?.ekOran));
  ok('şerit tipi topraklama-serit', sSatir?.tip === 'topraklama-serit', sSatir?.tip);
  ok('şerit ek oran -0.09 (ölçülen 0.91)', sSatir?.ekOran === -0.09, String(sSatir?.ekOran));
}

// ===================================================================
console.log('\n=== 10. Kitap meta bilgisi çıktıda ===');
{
  const r = hesapla({}, kitap);
  console.log(`  Kitap sürümü : ${r.ozet.kitapSurumu}`);
  console.log(`  Kitap kaynağı: ${r.ozet.kitapKaynagi}`);
  console.log(`  Kitap kalem  : ${r.ozet.kitapKalem}`);
  ok('kitap kaynağı çıktıda (tohum uyarısı görünür)', !!r.ozet.kitapKaynagi);
}

// ===================================================================
console.log('\n' + '='.repeat(64));
console.log(`GEÇEN: ${gecti}   KALAN: ${kaldi}`);
if (basarisiz.length) {
  console.log('\nKALAN TESTLER:');
  basarisiz.forEach((b) => console.log('  - ' + b));
}
console.log('='.repeat(64));
process.exit(kaldi ? 1 : 0);