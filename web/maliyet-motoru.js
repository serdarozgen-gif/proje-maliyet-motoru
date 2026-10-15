/**
 * Proje Yaklaşık Maliyet Motoru — arayüz katmanı
 *
 * Sorumluluk sınırı: bu dosya yalnızca girdi toplar, motoru çağırır ve
 * sonucu basar. Hesap kuralları motor.js içindedir.
 *
 * KVKK notu: hesaplama tamamen tarayıcıda yapılır. Proje teknik girdileri
 * sunucuya gönderilmez; sunucuya yalnızca kullanıcı talep formunu gönderirse
 * iletişim bilgileri gider.
 */

import { hesapla, VARSAYILAN_GIRDI } from './motor.js';

const KITAP_URL = new URL('./fiyat_kitabi.json', import.meta.url);
const NORMLAR_URL = new URL('./normlar.json', import.meta.url);

// ---------------------------------------------------------------- biçimlendirme
const para = new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
});
const sayiBicim = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- durum
let kitap = null;
// normlar YOKSA motor çalıştırılmaz. Eskiden null geçiyordu ve motor
// motor.js:239'daki kitap.meta.iscilikEkOrani'na düşüyordu; normlar.json
// 404 olduğunda sonuç sessizce %49 değişiyordu (ölçüldü: 750.499 -> 1.121.668 TL).
// Kaybolan sadece işçilik oranları değil, normlar.iskontoOranlari.varsayilan
// (0.65) de orada; o yüzden fark bu kadar büyük. Kalibrasyon dosyası zorunludur.
let normlar = null;
let sonSonuc = null;

/** Kalibrasyon dosyası hesap için zorunlu — eksikse neden sayılsın? */
function normlarSorunu(n, hata) {
  if (!n) return hata ?? 'kalibrasyon dosyası okunamadı';
  const eksik = ['iscilik', 'iskontoOranlari'].filter((a) => !n[a]);
  if (eksik.length) return `kalibrasyon dosyasında alan yok: ${eksik.join(', ')}`;
  return null;
}

/** Kitaptaki adlardan türetilen seçenek listeleri */
function kesitleri(kablon, ekKabul = []) {
  const k = new Set();
  for (const kalem of Object.values(kitap.kalemler)) {
    const m = kalem.ad.match(kablon);
    if (!m) continue;
    const s = m[1].replace(',', '.');
    if (Number(s) > 0) k.add(s);
  }
  ekKabul.forEach((e) => k.add(e));
  return [...k].map(Number).sort((a, b) => a - b);
}

function selectDoldur(el, degerler, secili) {
  el.innerHTML = '';
  for (const v of degerler) {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = String(v).replace('.', ',');
    if (String(v) === String(secili)) o.selected = true;
    el.appendChild(o);
  }
  // select'in değerini açıkça ata: seçim listede yoksa ilk kaleme düşer.
  const varMi = el.querySelector(`option[value="${CSS.escape(String(secili))}"]`);
  el.value = varMi ? String(secili) : (degerler[0] !== undefined ? String(degerler[0]) : '');
}

function trafoGucleri() {
  const k = new Set();
  for (const [poz, kalem] of Object.entries(kitap.kalemler)) {
    if (!poz.startsWith('85.610.') && !poz.startsWith('85.630.')) continue;
    const m = kalem.ad.match(/^(\d+) kVA/);
    if (m) k.add(Number(m[1]));
  }
  return [...k].sort((a, b) => a - b);
}

/**
 * Trafo tipi ve OG gerilimi değişince kVA listesi daralabilir.
 * Sadece secili tip/gerilim kombinasyonunda mevcut olan gucleri gosterir —
 * aksi halde kullanici listede olmayan bir guc secer ve motor "kalem yok" uyarisi
 * verir. (Ilk calistirmada bu oldu: 36 kV seciliyken listede 400 kVA vardi,
 * 1600 kVA yoktu.)
 */
/**
 * Trafo tipi ve OG gerilimine göre poz bloğu. motor.js ile AYNI olmalı —
 * ikisi ayrı yerde tanımlıysa liste ile hesap ayrışır.
 * ASTOR listesi 28,5-36/0,4 kV hermetik trafo veriyor → 85.630.15 bloğu.
 */
// motor.js ile AYNI olmalı — ikisi ayrı yerde tanımlıysa liste ile hesap
// ayrışır. Şimdilik 36 kV tek sistem (karar 2026-10-06).
const TRAFO_BLOKLARI = {
  yagli: { '36': '85.610.15' },
  hermetik: { '36': '85.630.15' },
};

function uygunTrafoGucleri() {
  const tip = $('trafoTipi').value;
  const gerilim = $('ogSistem').value;
  const onEk = TRAFO_BLOKLARI[tip]?.[gerilim] ?? TRAFO_BLOKLARI.hermetik['36'];

  const k = new Set();
  for (const [poz, kalem] of Object.entries(kitap.kalemler)) {
    if (!poz.startsWith(onEk)) continue;
    const m = kalem.ad.match(/^(\d+) kVA/);
    if (m) k.add(Number(m[1]));
  }
  return [...k].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- girdi
function girdiOku() {
  const say = (id, vars) => {
    const n = parseFloat(String($(id).value).replace(',', '.'));
    return Number.isFinite(n) ? n : vars;
  };
  return {
    trafoTipi: $('trafoTipi').value,
    kva: say('kva', VARSAYILAN_GIRDI.kva),
    ogSistem: $('ogSistem').value,
    hucreTipi: $('hucreTipi')?.value ?? VARSAYILAN_GIRDI.hucreTipi,
    platform: $('platform').value,
    ogKabloCekirdek: say('ogKabloCekirdek', 3),
    ogKabloKesit: say('ogKabloKesit', 150),
    ogKabloUzunluk: say('ogKabloUzunluk', 50),
    ogKabloYon: say('ogKabloYon', 1),
    ekMansonAdet: say('ekMansonAdet', 0),
    agPano: $('agPano').value,
    agKabloCekirdek: say('agKabloCekirdek', 4),
    agKabloKesit: say('agKabloKesit', 95),
    agKabloUzunluk: say('agKabloUzunluk', 10),
    kanal: $('kanal').value,
    kanalUzunluk: say('kanalUzunluk', 0),
    topraklama: $('topraklama').value,
  };
}

function girdiYaz(g) {
  $('trafoTipi').value = g.trafoTipi;
  $('kva').value = String(g.kva);
  $('ogSistem').value = g.ogSistem;
  if ($('hucreTipi')) $('hucreTipi').value = g.hucreTipi ?? VARSAYILAN_GIRDI.hucreTipi;
  $('platform').value = g.platform;
  $('ogKabloCekirdek').value = String(g.ogKabloCekirdek);
  $('ogKabloKesit').value = String(g.ogKabloKesit);
  $('ogKabloUzunluk').value = String(g.ogKabloUzunluk);
  $('ogKabloYon').value = String(g.ogKabloYon);
  $('ekMansonAdet').value = String(g.ekMansonAdet);
  $('agPano').value = g.agPano;
  $('agKabloCekirdek').value = String(g.agKabloCekirdek);
  $('agKabloKesit').value = String(g.agKabloKesit);
  $('agKabloUzunluk').value = String(g.agKabloUzunluk);
  $('kanal').value = g.kanal;
  $('kanalUzunluk').value = String(g.kanalUzunluk);
  $('topraklama').value = g.topraklama;
}

// ---------------------------------------------------------------- çıktı
function tabloBas(satirlar) {
  // Her kalem kendi satırında basılır. (Daha önce çok kalemli bloklarda ilk
  // kalemin adı hiç basılmıyordu — kalem tabloda görünmez oluyordu.)
  return satirlar.map((s) => `
    <tr>
      <td class="poz">${s.poz}</td>
      <td class="urun">${s.ad}<br><span style="color:var(--muted);font-weight:400">${s.birim}</span></td>
      <td class="sayi">${sayiBicim.format(s.adet)}</td>
      <td class="sayi">${para.format(s.malzeme)}</td>
      <td class="sayi">${para.format(s.iscilik)}</td>
      <td class="sayi">${para.format(s.toplam)}</td>
    </tr>`).join('');
}

function dokumCiz(sonuc) {
  const govde = sonuc.bloklar.map((b) => `
    <tbody>
      <tr><th colspan="6" style="padding-top:18px;color:var(--navy)">${b.baslik}</th></tr>
      ${tabloBas(b.satirlar)}
      <tr>
        <td colspan="3" style="color:var(--muted)">Ara toplam</td>
        <td class="sayi">${para.format(b.malzeme)}</td>
        <td class="sayi">${para.format(b.iscilik)}</td>
        <td class="sayi ara-toplam">${para.format(b.toplam)}</td>
      </tr>
    </tbody>`).join('');

  const o = sonuc.ozet;
  return govde + `
    <tbody>
      <tr>
        <td colspan="3" style="font-weight:800;color:var(--navy)">GENEL TOPLAM (KDV hariç)</td>
        <td class="sayi" style="font-weight:800;color:var(--navy)">${para.format(o.malzeme)}</td>
        <td class="sayi" style="font-weight:800;color:var(--navy)">${para.format(o.iscilik)}</td>
        <td class="sayi" style="font-weight:800;color:var(--navy)">${para.format(o.toplam)}</td>
      </tr>
    </tbody>`;
}

function tespitCiz(sonuc) {
  const parcalar = [];
  for (const t of sonuc.tespitler) {
    parcalar.push(`<div class="tespit"><b>Doğrulama gerekiyor</b>${t}</div>`);
  }
  for (const e of sonuc.eksikler) {
    parcalar.push(`<div class="tespit hata"><b>Fiyat listesinde yok</b>${e}</div>`);
  }
  if (!parcalar.length) {
    parcalar.push('<div class="tespit"><b>Tespit yok</b>Tüm kalemler fiyat listesinde mevcut ve eşleşmesi tam.</div>');
  }
  return parcalar.join('');
}

function ciz(sonuc) {
  const o = sonuc.ozet;

  $('toplam').innerHTML = `${para.format(o.toplam)} <span>KDV hariç</span>`;
  $('toplam-malzeme').textContent = para.format(o.malzeme);
  $('toplam-iscilik').textContent = para.format(o.iscilik);
  $('toplam-kalem').textContent = o.kalemSayisi;

  const mPay = o.toplam ? (o.malzeme / o.toplam) * 100 : 50;
  $('pay-malzeme').style.width = `${mPay}%`;
  $('pay-iscilik').style.width = `${100 - mPay}%`;

  // Hangi kalem tipi hangi ek oranla hesaplandı — kalibrasyon izlenebilirliği
  const tipDagilim = Object.entries(o.ekOranKullanim ?? {})
    .map(([tip, v]) => `${tip} %${(v.ekOran * 100).toFixed(0)}`)
    .join(' · ');

  $('sonuc-not').textContent =
    `İşçilik payı %${(o.iscilikPayi * 100).toFixed(1)} · ` +
    (o.normlarSurumu
      ? `Katsayılar normlar v${o.normlarSurumu}`
      : `Genel ekleme oranı %${((o.genelEkOran ?? 0) * 100).toFixed(0)}`) +
    (tipDagilim ? ` (${tipDagilim})` : '') + ' · ' +
    `Fiyat listesi v${o.kitapSurumu} (${o.kitapKalem} kalem). ` +
    `Bu sonuç yaklaşık maliyettir, kesin teklif değildir.`;

  $('dokum').innerHTML = dokumCiz(sonuc);
  $('tespit-alani').innerHTML = tespitCiz(sonuc);
  $('cikti').hidden = false;
}

// ---------------------------------------------------------------- uyarı
/**
 * Fiyat kaynağı dağılımı — SABİT SAYI YAZILMAZ.
 *
 * Ölçülen: 2557 kalemin 1913'ü ASTOR/Öznur listesinden, 644'ü TEDAŞ 2026 BFK
 * referans bedelinden (tedarikçi listesi bulunmayan kalemler).
 *
 * Neden hesaplanıyor: `npm run build` fiyat kitabını yeniden üretir. Yazılan
 * sayı o gün yanlış olur. Sayı buradan, `tedarikci_uret.mjs`in kullandığı
 * AYNI testten geliyor: kaynak ASTOR veya Öznur ile başlıyorsa tedarikçi.
 */
function kaynakDagilimi(k) {
  const kalemler = Object.values(k?.kalemler ?? {});
  let tedarikci = 0;
  for (const kalem of kalemler) {
    const kaynak = String(kalem?.kaynak ?? '');
    if (kaynak.startsWith('Öznur') || kaynak.startsWith('ASTOR')) tedarikci++;
  }
  return { toplam: kalemler.length, tedarikci, referans: kalemler.length - tedarikci };
}

/**
 * Yayın uyarısı. Kaynak `seed-tedas-bfk` ise fiyat listesi hâlâ tohumdur.
 * `tedarikci-net` ise ASTOR/Öznur listelerinden hesaplanmıştır ama döviz
 * kuru tahmindir — o durumda kur uyarısı gösterilir.
 *
 * P1 (2026-10-15): Kur uyarısının yanına kalem kaynak dağılımı eklendi.
 * Önceki hâlde `meta.kaynak = "tedarikci-net"` tek başına gösteriliyordu ve
 * 644 kalemin TEDAŞ referans bedeli olduğu söylenmiyordu. O kalemler TL
 * bedelli, döviz kurundan etkilenmiyor — kur uyarısı onları hiç kapsamıyor.
 */
function tohumUyarisi() {
  if (kitap.meta.kaynak === 'seed-tedas-bfk') {
    $('uyari-metin').textContent =
      `Fiyat listesi henüz Atlasgrid'in kendi listesiyle değiştirilmedi; ` +
      `TEDAŞ 2026 BFK bedelleriyle tohumlandı. Yayına almadan önce ` +
      `data/fiyat_kitabi.json dosyasını gerçek fiyat listenizle güncelleyin. ` +
      `Bu uyarı yayına hazır sürümde otomatik gizlenir.`;
    $('uyari').classList.remove('gizli');
  } else if (kitap.meta.kaynak === 'tedarikci-net') {
    const kablo = kitap.meta.agKabloTipi ? ` · AG kablo: ${kitap.meta.agKabloTipi}` : '';
    const d = kaynakDagilimi(kitap);
    const kaynakNotu = d.referans > 0
      ? ` Listede ${d.toplam} kalemin ${d.tedarikci} adedi ASTOR/Öznur ` +
        `fiyatlarından, ${d.referans} adedi ise TEDAŞ 2026 Birim Fiyat ` +
        `Kitabı referans bedelinden hesaplandı (tedarikçi listemizde ` +
        `bulunmayan kalemler). Referans bedelli kalemler döviz kuruna ` +
        `bağlı değildir.`
      : ` Listenin ${d.toplam} kaleminin tamamı tedarikçi fiyatlarından.`;
    $('uyari-metin').textContent =
      `Döviz kuru 1 USD = ${kitap.meta.dovizKuru} TL` +
      (kitap.meta.dovizKuruTarih ? ` (${kitap.meta.dovizKuruTarih})` : '') +
      `. Trafo bedellerinin tamamı bu kura bağlı — 100 kVA'da 1 TL kuru ` +
      `değişimi yaklaşık 345 TL maliyet değiştirir.${kablo}.` +
      kaynakNotu +
      ` Kâr marjı uygulanmaz.`;
    $('uyari').classList.remove('gizli');
  }
}

// ---------------------------------------------------------------- olaylar
function hesaplaVeCiz() {
  if (!kitap || !normlar) return;   // normlar yoksa hesap YAPILMAZ — bkz. normlarSorunu()
  const sonuc = hesapla(girdiOku(), kitap, normlar);
  sonSonuc = sonuc;
  ciz(sonuc);
  $('cikti').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function baslat() {
  // Normlar ZORUNLUDUR. Sadece var/yok değil, beklenen alanlar da olmalı:
  // eksik alanla motor çalışırsa iskonto oranları da düşer ve sonuç yanlış çıkar.
  fetch(NORMLAR_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`kalibrasyon dosyası yüklenemedi (HTTP ${r.status})`);
      return r.json();
    })
    .then((n) => {
      const sorun = normlarSorunu(n);
      if (sorun) throw new Error(sorun);
      normlar = n;
    })
    .then(() => fetch(KITAP_URL))
    .then((r) => {
      if (!r.ok) throw new Error(`Fiyat listesi yüklenemedi (HTTP ${r.status})`);
      return r.json();
    })
    .then((k) => {
      kitap = k;

      selectDoldur($('kva'), uygunTrafoGucleri(), VARSAYILAN_GIRDI.kva);
      selectDoldur($('ogKabloKesit'), kesitleri(/^OG kablo \d+×([\d,]+)/), VARSAYILAN_GIRDI.ogKabloKesit);
      selectDoldur($('agKabloKesit'), kesitleri(/^AG kablo \d+×([\d,]+)/), VARSAYILAN_GIRDI.agKabloKesit);

      tohumUyarisi();
      hesaplaVeCiz();

      // Tip/gerilim değişince kVA listesini daralt ve geçersiz seçimi düzelt
      const kvaYenile = () => {
        const secili = $('kva').value;
        const gecerli = uygunTrafoGucleri();
        selectDoldur($('kva'), gecerli, secili);
        if (!gecerli.includes(Number(secili))) {
          // Seçim artık geçersiz: en yakın güce çek ve kullanıcıya bildir
          const hedef = gecerli.find((g) => g > Number(secili)) ?? gecerli.at(-1);
          if (hedef) $('kva').value = String(hedef);
        }
        hesaplaVeCiz();
      };
      $('trafoTipi').addEventListener('change', kvaYenile);
      $('ogSistem').addEventListener('change', kvaYenile);

      $('btn-hesap').addEventListener('click', hesaplaVeCiz);
      // Sıfırla: önce tip/gerilim değişkenlerini geri al, SONRA listeyi kur.
      // (Ters sırada olursa kVA listesi eski tip/gerilime göre kuruluyor ve
      // varsayılan güç listede olmadığı için yanlış değere düşüyordu.)
      $('btn-sifirla').addEventListener('click', () => {
        girdiYaz(VARSAYILAN_GIRDI);
        kvaYenile();
      });
      $('girdi-form').addEventListener('submit', (e) => {
        e.preventDefault();
        hesaplaVeCiz();
      });
    })
    .catch((h) => {
      // Başlık sabit değil: hata kalibrasyon dosyasından gelirse "fiyat listesi
      // yüklenemedi" demek yanlış olurdu. Gerçek nedeni göster.
      const normlarHatasi = /kalibrasyon/i.test(h.message);
      const baslik = normlarHatasi ? 'Hesaplama yapılamıyor' : 'Fiyat listesi yüklenemedi';
      const aciklama = normlarHatasi
        ? `İşçilik ve iskonto oranları <code>normlar.json</code> dosyasından gelir. ` +
          `Bu dosya okunamazsa motor tek oranı (0,35) kullanır ve sonuç ` +
          `yaklaşık %49 kayar; bu yüzden hesap durduruldu. ` +
          `Dosya yerinde mi, sunucuya yüklenmiş mi kontrol edin.`
        : '';
      document.querySelector('.motor .girdi').insertAdjacentHTML(
        'afterbegin',
        `<div class="tespit hata"><b>${baslik}</b>${aciklama}<br>${h.message}</div>`
      );
      $('btn-hesap').disabled = true;
    });
}

// ---------------------------------------------------------------- talep formu
// Sunucu tarafı yoksa istek yapılmaz; kullanıcı doğrudan iletişime yönlendirilir.
function talepKur() {
  const form = $('talep-form');
  const durum = $('gonder-durum');
  const dugme = $('btn-gonder');
  let uctanAdres = '';

  fetch('assets/js/form-hedef.txt')
    .then((r) => (r.ok ? r.text() : ''))
    .then((t) => { uctanAdres = t.trim(); })
    .catch(() => { uctanAdres = ''; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const veri = Object.fromEntries(new FormData(form).entries());

    // Hesaplama özetini ekle — kullanıcının girdiği teknik veri, kişisel değil.
    veri.ozet = sonSonuc
      ? `${sonSonuc.ozet.kalemSayisi} kalem, toplam ${para.format(sonSonuc.ozet.toplam)} TL (KDV hariç)`
      : '';
    veri.girdi = sonSonuc ? JSON.stringify(girdiOku()) : '';

    // Uctan adres yoksa: mevcut siteyle ayni yaklasim — mailto ile talep bize ulasir.
    if (!uctanAdres.startsWith('https://')) {
      const govde = [
        'Proje: ' + (veri.not || '(belirtilmedi)'),
        'Özet: ' + (veri.ozet || '-'),
        'Girdiler: ' + (veri.girdi || '-'),
      ].join('\n');
      durum.innerHTML =
        'Talebiniz e-posta olarak hazırlandı. Göndermek için açılan pencerede ' +
        'gönder düğmesine basın. Açılmazsa ' +
        '<a href="tel:+905304453854">0530 445 38 54</a> numarasından bize ulaşın.';
      dugme.disabled = false;
      dugme.textContent = 'E-posta ile gönder';
      window.location.href =
        'mailto:serdar.ozgen@atlasgrid.com.tr' +
        `?subject=${encodeURIComponent('Maliyet motoru talebi — ' + (veri.ad || ''))}` +
        `&body=${encodeURIComponent(`${veri.ad || ''} <${veri.eposta || ''}>\n${veri.firma ? 'Firma: ' + veri.firma + '\n' : ''}${veri.telefon ? 'Tel: ' + veri.telefon + '\n' : ''}\n${govde}`)}`;
      return;
    }

    dugme.disabled = true;
    durum.textContent = 'Gönderiliyor…';
    fetch(uctanAdres, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(veri),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        durum.textContent = 'Talebiniz alındı. En kısa sürede dönüş yapacağız.';
        form.reset();
      })
      .catch((h) => {
        durum.innerHTML =
          `Gönderilemedi (${h.message}). Lütfen ` +
          `<a href="mailto:serdar.ozgen@atlasgrid.com.tr">serdar.ozgen@atlasgrid.com.tr</a> ` +
          `adresine yazın veya bizi arayın.`;
      })
      .finally(() => { dugme.disabled = false; });
  });
}

baslat();
talepKur();