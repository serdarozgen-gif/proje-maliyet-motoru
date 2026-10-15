/**
 * Arayüz dikey dilim testi (DOM taklidi ile)
 *
 * Tarayici olmadan maliyet-motoru.js dosyasini gercekten calistirir:
 * fiyat listesini yukler, secenekleri doldurur, hesaplar ve tabloyu basar.
 * Amac: DOM ile motor arasindaki baglanti hatasi (yanlis id, yanlis alan adi,
 * undefined okuma) yakalansin.
 *
 *   node tools/arayuz_test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KOK = path.join(import.meta.dirname, '..');
const WEB = path.join(KOK, 'web');

let gecti = 0, kaldi = 0;
const hatalar = [];

function ok(ad, kosul, ek = '') {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; hatalar.push(ad + (ek ? ` — ${ek}` : '')); console.log(`  ✗ ${ad}${ek ? ' — ' + ek : ''}`); }
}

// ------------------------------------------------------------------ DOM taklidi
const elemanlar = new Map();

function eleman(id) {
  if (elemanlar.has(id)) return elemanlar.get(id);
  // HTML'de tanimli select'ler ilk option ile baslar (tarayici davranisi)
  const ilkDeger = optionDegerleri.get(id)?.[0] ?? '';
  const e = {
    id,
    value: ilkDeger,
    // Gercek DOM'da innerHTML = '' cocuklari da siler. Taklit de aynisini
    // yapmali, yoksa selectDoldur her cagrida listeyi ust uste biriktirir.
    _html: '',
    _children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = v;
      if (v === '') { this._children.length = 0; this.value = ''; }
    },
    get children() { return this._children; },
    querySelector(secici) {
      // yalnizca option[value="..."] desteklenir (uygulamanin kullandigi tek bicim)
      const m = secici.match(/^option\[value="(.*)"\]$/);
      if (!m) return null;
      return this._children.find((o) => o.value === m[1]) ?? null;
    },
    textContent: '',
    disabled: false,
    hidden: false,
    style: {},
    appendChild(o) {
      this._children.push(o);
      // gercek DOM gibi: option eklenince select degerini ilk secenege dusurur
      if (this.value === '' && this._children.length === 1) this.value = o.value;
      return o;
    },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(t, f) { (this._ev ??= {})[t] = f; },
    scrollIntoView() {},
    reset() {},
    setAttribute() {},
    insertAdjacentHTML() {},
  };
  elemanlar.set(id, e);
  return e;
}

// HTML'de gercekten var olan id'leri oku — sahte id kullanilmasini engeller
const html = fs.readFileSync(path.join(WEB, 'maliyet-motoru.html'), 'utf8');
const gercekIdler = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const kullanilanIdler = new Set();

globalThis.document = {
  getElementById(id) {
    if (!gercekIdler.has(id)) {
      throw new Error(`getElementById('${id}') — HTML'de bu id YOK`);
    }
    kullanilanIdler.add(id);
    return eleman(id);
  },
  querySelector(sel) {
    if (!sel.includes('.girdi')) throw new Error(`querySelector('${sel}') — beklenmeyen secici`);
    return { insertAdjacentHTML() {} };
  },
  createElement(etiket) {
    return {
      tagName: etiket, value: '', textContent: '', innerHTML: '',
      children: [], classList: { add() {}, remove() {}, contains: () => false },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener() {}, style: {}, setAttribute() {},
    };
  },
};

// CSS.escape — tarayici globali; taklit gerekiyor
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, '\\$&') };
}

class FormDataTaklit {
  constructor(form) {
    this._d = {
      ad: 'Test Kullanıcı', eposta: 'test@ornek.com',
      telefon: '', firma: '', not: '100 kVA test',
    };
  }
  entries() { return Object.entries(this._d); }
}
globalThis.FormData = FormDataTaklit;

// Tarayıcıda <select> ilk option'a düşer; taklitte de öyle yapalım.
// HTML'den option degerlerini oku (yalnızca <select> icin).
const optionDegerleri = new Map();
for (const m of html.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g)) {
  const id = m[1];
  const opts = [...m[2].matchAll(/<option value="([^"]*)"/g)].map((o) => o[1]);
  optionDegerleri.set(id, opts);
}

const kitap = JSON.parse(fs.readFileSync(path.join(WEB, 'fiyat_kitabi.json'), 'utf8'));
const normlar = JSON.parse(fs.readFileSync(path.join(WEB, 'normlar.json'), 'utf8'));

let formAdres = '';
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith('fiyat_kitabi.json')) {
    return { ok: true, json: async () => kitap };
  }
  if (u.endsWith('normlar.json')) {
    return { ok: true, json: async () => normlar };
  }
  if (u.includes('form-hedef.txt')) {
    return { ok: true, text: async () => formAdres };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};

globalThis.window = globalThis;

// ------------------------------------------------------------------ calistir
console.log('\n=== Arayüz dikey dilim testi ===');

const mod = await import(pathToFileURL(path.join(WEB, 'maliyet-motoru.js')).href);
// modul yan etkili olarak calisir: baslat() + talepKur() promise zinciri baslar
await new Promise((r) => setTimeout(r, 150));

console.log('\n--- 1. Kimlikler ---');
const beklenen = ['kva', 'ogKabloKesit', 'agKabloKesit', 'toplam', 'dokum', 'tespit-alani'];
ok('tüm gerekli id’lere erişildi',
  beklenen.every((i) => kullanilanIdler.has(i)),
  `kullanılmayan: ${beklenen.filter((i) => !kullanilanIdler.has(i)).join(', ')}`);

// ------------------------------------------------------------------ 2. secenekler
console.log('\n--- 2. Seçenek listeleri ---');
const kvaEl = eleman('kva');
const kvaSecenek = [...kvaEl.children].map((o) => Number(o.value)).filter((n) => Number.isFinite(n));
console.log(`  Trafo güçleri: ${kvaSecenek.length} adet → ${kvaSecenek.slice(0, 12).join(', ')}…`);
ok('kVA listesi doldu', kvaSecenek.length > 5);
ok('kVA listesi artan sırada', kvaSecenek.every((v, i, a) => i === 0 || a[i - 1] < v));

const ogEl = eleman('ogKabloKesit');
const ogKesit = [...ogEl.children].map((o) => Number(o.value)).filter((n) => Number.isFinite(n));
console.log(`  OG kesitler  : ${ogKesit.length} adet → ${ogKesit.join(', ')}`);
ok('OG kablo kesitleri doldu', ogKesit.length > 5);
ok('OG listesi 150 mm² içeriyor', ogKesit.includes(150));

const agEl = eleman('agKabloKesit');
const agKesit = [...agEl.children].map((o) => Number(o.value)).filter((n) => Number.isFinite(n));
console.log(`  AG kesitler  : ${agKesit.length} adet → ${agKesit.slice(0, 14).join(', ')}`);
ok('AG kablo kesitleri doldu', agKesit.length > 5);

// ------------------------------------------------------------------ 3. ilk hesap
console.log('\n--- 3. Otomatik ilk hesap ---');
const toplam = eleman('toplam').innerHTML;
console.log(`  Toplam satırı : ${toplam}`);
console.log(`  Malzeme      : ${eleman('toplam-malzeme').textContent}`);
console.log(`  İşçilik      : ${eleman('toplam-iscilik').textContent}`);
console.log(`  Kalem         : ${eleman('toplam-kalem').textContent}`);

ok('toplam ₺ olarak basıldı', /₺/.test(toplam));
ok('KDV hariç notu var', /KDV hariç/i.test(toplam));
ok('malzeme/işçilik ayrı gösterildi',
  eleman('toplam-malzeme').textContent !== '' && eleman('toplam-iscilik').textContent !== '');
ok('çıktı bölümü görünür', eleman('cikti').hidden === false);

const dokum = eleman('dokum').innerHTML;
console.log(`  Döküm uzunluğu: ${dokum.length} karakter`);
ok('dökümde poz numarası var', /85\.\d{3}\.\d{4}/.test(dokum));
ok('dökümde blok başlığı var', /Dağıtım trafosu/.test(dokum));
ok('genel toplam satırı var', /GENEL TOPLAM/.test(dokum));
ok('tablo 1000+ karakter', dokum.length > 1000, `${dokum.length}`);

// ------------------------------------------------------------------ 4. tespitler
console.log('\n--- 4. Tespit listesi ---');
const tespit = eleman('tespit-alani').innerHTML;
const tespitSayisi = (tespit.match(/class="tespit/g) || []).length;
console.log(`  Tespit kutusu: ${tespitSayisi} adet`);
ok('tespitler basıldı', tespitSayisi > 0);
ok('doğrulama uyarısı içeriyor', /Doğrulama gerekiyor/.test(tespit));

// ------------------------------------------------------------------ 5. yeniden hesap
console.log('\n--- 5. Hesap düğmesi ile değişiklik ---');
// Trafo tipi değişince kVA listesi değişmeli
const kva36 = [...eleman('kva').children].map((o) => Number(o.value)).filter(Number.isFinite);
console.log(`  36 kV kVA listesi (${kva36.length}): ${kva36.join(', ')}`);
ok('36 kV kVA listesi dolu', kva36.length > 5, `${kva36.length} adet`);
ok('varsayılan güç listede', kva36.includes(250), `250 listede mi: ${kva36.includes(250)}`);

eleman('kva').value = '1600';
eleman('ogKabloKesit').value = '240';
eleman('ogKabloUzunluk').value = '300';
eleman('kanalUzunluk').value = '300';
eleman('btn-hesap')._ev?.click?.();

const yeniToplam = eleman('toplam').innerHTML;
console.log(`  Yeni toplam: ${yeniToplam}`);
ok('hesap düğmesi yeniden hesapladı', yeniToplam !== toplam);
// 2026-10-07: OG koruma artık "(takım)" sigorta grubu değil, ASTOR hücresi.
  ok('36 kV trafo koruma hücresi dökümde',
    eleman('dokum').innerHTML.includes('36 kV 630 A sigortalı yük ayırıcılı koruma'));

const dokum2 = eleman('dokum').innerHTML;
ok('240 mm² kablo dökümde', dokum2.includes('3×240'));
ok('kanal satırı eklendi', /kanal/i.test(dokum2));

// ------------------------------------------------------------------ 6. sıfırla
console.log('\n--- 6. Varsayılanlara dön ---');
eleman('btn-sifirla')._ev?.click?.();
ok('sıfırlama varsayılanı geri yükledi',
  eleman('kva').value === '250' && eleman('ogKabloUzunluk').value === '50'
  && eleman('ogSistem').value === '36' && eleman('hucreTipi').value === 'oto',
  `kva=${eleman('kva').value} uz=${eleman('ogKabloUzunluk').value} gerilim=${eleman('ogSistem').value} hucre=${eleman('hucreTipi').value}`);
// 6,3 kV yağlı blok ile 36 kV hermetik blok aynı kVA sayısını taşıyabilir.
// Test, listenin BOŞ olmadığını ve varsayılanın seçilebilir olduğunu doğrular.
const kva6 = [...eleman('kva').children].map((o) => Number(o.value)).filter(Number.isFinite);
ok('sıfırlama sonrası kVA listesi dolu', kva6.length > 0, `${kva6.length} adet`);
ok('varsayılan güç listede', kva6.includes(250), `250 listede mi: ${kva6.includes(250)}`);

console.log('\n--- 6b. Trafo tipi değişimi ---');
eleman('trafoTipi').value = 'hermetik';
eleman('trafoTipi')._ev?.change?.();
const kvaHerm = [...eleman('kva').children].map((o) => Number(o.value)).filter(Number.isFinite);
ok('hermetik seçilince liste değişti', kvaHerm.length !== kva36.length,
  `36kV yağlı=${kva36.length}, hermetik 6,3=${kvaHerm.length}`);
ok('hermetik trafo dökümde', /hermetik tip trafo/.test(eleman('dokum').innerHTML));

console.log('\n--- 6c. Hücre tipi seçimi (RMU / metal) ---');
// 2026-10-07: kullanıcı kararı — OG trafo koruma hücresi seçici.
eleman('hucreTipi').value = 'metal';
eleman('btn-hesap')._ev?.click?.();
const metalDokum = eleman('dokum').innerHTML;
ok('metal hücre dökümde', metalDokum.includes('85.530.2403'), '85.530.2403 arandı');
eleman('hucreTipi').value = 'rmu';
eleman('btn-hesap')._ev?.click?.();
ok('RMU hücre dökümde',
  eleman('dokum').innerHTML.includes('85.500.1207'), '85.500.1207 arandı');
eleman('hucreTipi').value = 'oto';

// ------------------------------------------------------------------ 7. tohum uyarısı
console.log('\n--- 6c. Normlar yüklendi ve kullanıldı ---');
const sonucNotu = eleman('sonuc-not').textContent;
console.log(`  ${sonucNotu}`);
ok('normlar sürümü sonuç notunda', sonucNotu.includes(`normlar v${normlar.surum}`), sonucNotu);
ok('kalem tipi bazlı oranlar gösterildi', /kablo-montaj/.test(sonucNotu), sonucNotu);
const iscOran = Number((sonucNotu.match(/İşçilik payı %([\d.]+)/) ?? [])[1]);
ok('işçilik payı makul kaldı', iscOran > 3 && iscOran < 45, `%${iscOran}`);
ok('hucre-montaj negatif oran uygulandı', /hucre-montaj %-16/.test(sonucNotu), sonucNotu);

console.log('\n--- 7. Yayın uyarısı ---');
const uyariEl = eleman('uyari');
const uyariMetni = eleman('uyari-metin').textContent;
console.log(`  Uyarı: ${uyariMetni.slice(0, 130)}…`);
ok('kaynak `tedarikci-net` olduğu için uyarı görünür',
  uyariEl.classList.contains('gizli') === false);
ok('döviz kuru uyarısı verildi', /Döviz kuru/.test(uyariMetni), uyariMetni);
ok('kur tarihi uyarıda', /2026-09-30/.test(uyariMetni), uyariMetni);
ok('AG kablo tipi uyarıda', /NYY-Cu/.test(uyariMetni), uyariMetni);
ok('ASTOR liste tarihi artık uyarılmıyor (liste güncel)',
  !/2024 tarihli/.test(uyariMetni), 'eski güncelleme uyarısı kaldırılmalı');

// P1 (2026-10-15): kalem kaynak dağılımı uyarıda. Sayılar SABİT YAZILMAZ,
// kitaptan hesaplanır — build fiyat kitabını yeniden üretir.
const dagilim = (() => {
  let ted = 0, top = 0;
  for (const k of Object.values(kitap.kalemler)) {
    top++;
    const src = String(k.kaynak ?? '');
    if (src.startsWith('Öznur') || src.startsWith('ASTOR')) ted++;
  }
  return { ted, ref: top - ted, top };
})();
console.log(`  Dağılım : ${dagilim.ted} tedarikçi / ${dagilim.ref} TEDAŞ referans`);
ok('uyarıda kalem kaynak dağılımı var', /ASTOR\/Öznur/.test(uyariMetni), uyariMetni);
ok(' TEDAŞ referans bedeli açıkça söyleniyor', /TEDAŞ 2026 Birim Fiyat/.test(uyariMetni), uyariMetni);
ok('dağılım sayıları doğru', new RegExp(`${dagilim.ted} adedi ASTOR/Öznur`).test(uyariMetni)
  && new RegExp(`${dagilim.ref} adedi`).test(uyariMetni), uyariMetni);
ok('referans bedeller kurdan bağımsız olduğu belirtiliyor',
  /bağlı değildir/.test(uyariMetni), uyariMetni);

// ------------------------------------------------------------------ 8. KVKK
console.log('\n--- 8. KVKK ve talep formu ---');
const kvkk = html.match(/class="kvkk"[\s\S]*?<\/p>/)?.[0] ?? '';
ok('KVKK aydınlatma metni sayfada', /KVKK aydınlatma metni/.test(kvkk));
ok('veri minimizasyonu ifadesi geçiyor', /veri minimizasyonu/i.test(kvkk));
ok('üçüncü taraf paylaşımı belirtiliyor', /üçüncü taraflarla/i.test(kvkk));
ok('silme taahhüdü var', /silinir/i.test(kvkk));
ok('teknik veri sunucuya gitmiyor uyarısı', /sunucuya gönderilmez/.test(html));
const zorunlu = (html.match(/\brequired\b/g) || []).length;
ok('yalnızca ad ve e-posta zorunlu (veri minimizasyonu)', zorunlu === 2,
  `${zorunlu} adet required — telefon/firma/not isteğe bağlı olmalı`);

// ------------------------------------------------------------------ 9. form hedefi yoksa
console.log('\n--- 9. Sunucu bağlı değilken form davranışı ---');
// Tarayıcı taklidinde location değişimi yakalanır (mailto: yönlendirmesi)
const yonlendirmeler = [];
globalThis.window = { ...globalThis, location: { href: '' } };
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  get: () => ({ location: { set href(v) { yonlendirmeler.push(v); }, get href() { return ''; } } }),
});

formAdres = '';
eleman('btn-gonder').disabled = false;
eleman('btn-gonder').textContent = 'Talebimi gönder';
const durumMetni = eleman('gonder-durum');
eleman('talep-form')._ev?.submit?.({ preventDefault() {} });
await new Promise((r) => setTimeout(r, 120));

ok('bağlı değilken mailto yönlendirmesi üretildi', yonlendirmeler.length > 0,
  `yonlendirme sayısı ${yonlendirmeler.length}`);
ok('mailto adresi doğru', (yonlendirmeler[0] ?? '').startsWith('mailto:serdar.ozgen@atlasgrid.com.tr'),
  (yonlendirmeler[0] ?? '').slice(0, 60));
const govde = decodeURIComponent((yonlendirmeler[0] ?? '').split('body=')[1] ?? '');
ok('projede özet gönderiliyor', /Özet:/.test(govde), govde.slice(0, 80));
ok('teknik girdiler gönderiliyor', /Girdiler:/.test(govde));
ok('kullanıcıya açıklama gösterildi', durumMetni.innerHTML.includes('tel:'),
  durumMetni.innerHTML.slice(0, 80));
console.log(`  Yönlendirme: ${(yonlendirmeler[0] ?? '(yok)').slice(0, 96)}…`);

// ------------------------------------------------------------------ sonuc
console.log('\n' + '='.repeat(64));
console.log(`GEÇEN: ${gecti}   KALAN: ${kaldi}`);
if (hatalar.length) {
  console.log('\nKALANLAR:');
  hatalar.forEach((h) => console.log('  - ' + h));
}
console.log('='.repeat(64));
process.exit(kaldi ? 1 : 0);