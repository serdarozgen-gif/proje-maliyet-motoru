# Proje Yaklaşık Maliyet Motoru

**Kapsam (v0.2):** YG/AG trafo bağlantısı
**Durum:** Çalışır. Testler geçiyor. Kalibrasyon döngüsü kuruldu, veri bekliyor.

## Komutlar

```bash
npm run build        # BFK → katalog → fiyat kitabı → web/ kopyası
npm test             # motor + arayüz testleri (80 kontrol)
npm run kalibrasyon  # ölçüm verisine göre katsayı raporu
npm run serve        # http://localhost:8099/
```

`file://` ile açmayın — ES module + fetch gerekiyor.

## Üç dosya, üç sorumluluk

| Dosya | Ne tutar |
|---|---|
| `data/olcum.json` | **Gerçek** fiyat/tutar, vaka vaka. Siz doldurursunuz. |
| `data/normlar.json` | **Katsayılar** — iskonto, tipe özel ek oran, eşleme tabloları |
| `web/motor.js` | Hesap kuralları. **İçinde katsayı yoktur.** |

Motor hiçbir katsayıyı kodda taşımaz. `motor.js` bilir *nasıl* hesaplanacağını,
`normlar.json` bilir *neyle* hesaplanacağını, `olcum.json` bilir *gerçeğin*
ne olduğunu. Kalibrasyon = üçüncüden ikinciye akış.

Detay: [`docs/KALIBRASYON_REHBERI.md`](KALIBRASYON_REHBERI.md)

## Testler

| Dosya | Kontrol | Sonuç |
|---|---|---|
| `tools/motor_test.mjs` | 37 | hepsi geçti |
| `tools/arayuz_test.mjs` | 43 | hepsi geçti |

`arayuz_test.mjs` tarayıcı olmadan `maliyet-motoru.js`'yi DOM taklidiyle
gerçekten çalıştırır — motor/UI bağlantı hatalarını yakalar.

## Kalibrasyon — ilk ölçümün sonucu

2 vaka, 23 satır gerçek veri işlendi (`data/olcum.json`):

**Malzeme** oranı (BFK ↔ bayi/teklif): %58 – %143, **dağılım 2,4x**
**İşçilik** oranı (BFK montaj ↔ gerçek ekip): %67 – %1094, **dağılım 16,3x**

Dağılım bu kadar genişken tek katsayı işe yaramaz. İki net ölçüm çıktı:

- **Kablo çekimi:** gerçek 120 TL/m vs BFK montaj 119,08 → oran 1,01.
  Ek oran **0** olmalı. Eski %35, kablo çekimini 1,35 kat gösteriyordu.
- **Hücre montajı:** gerçek 22.000 TL/ad vs BFK 32.709 → oran 0,67.
  Ek oran **-0,33** olmalı. Eski %35, gerçeğin **2 katını** üretiyordu.

Bu yüzden `normlar.json` katsayıyı kalem tipine göre veriyor
(`kablo-montaj`, `hucre-montaj`, `topraklama`, …). Motor hangi kaleme hangi
oranı uyguladığını `ozet.ekOranKullanim` ile raporlar; arayüz bunu ekranda gösterir.

### Çözülmemiş

- **Topraklama çelişkisi:** kazık oranı 1,66, şerit oranı 0,91. Tek tip ikisini
  birden doğru temsil edemiyor. Şimdilik 0,35 geçici.
- **Vaka seviyesi karşılaştırma geçerli değil.** Ölçüm vakası motordan
  geçirildi: motor 329.169 TL, gerçekleşen 828.661 TL. Fark **motor hatası
  değil** — kapsam eşleşmiyor (kanal kazısı, trafoya bağlı pano, faturanın
  kalem kalemi BFK pozuna eşlenmemiş). Geçerli test için `olcum.json`'a
  faturaların kalem kalemi dökümü eklenmeli.

## Fiyat kaynağı

`data/fiyat_kitabi.json` → `meta.kaynak = "tedarikci-net"`.
**ASTOR %70**, **Öznur %65** iskontoyla hesaplanmış net bedeller.
**1113 kalem** gerçek tedarikçi fiyatı, 1436 kalem BFK bedeliyle (listede yok).
Kalem bazında `kaynak` alanı hangisinin nereden geldiğini gösterir.

Detay: [`docs/TEDARIKCI_FIYATLARI.md`](TEDARIKCI_FIYATLARI.md)

**Döviz kuru 48,93 USD** (TCMB gösterge kuru, 30.09.2026 alış). Trafo
bedellerinin tamamı buna bağlı — 100 kVA'da 1 TL kuru ≈ 345 TL fark. Sayfa
uyarı gösteriyor, sipariş öncesi güncellenmeli.

**AG kablo: bakır NYY** (`kablo_secimi.json`). Trafo bağlantılarında bakır
seçiliyor. Alüminyum seçilirse 2 kesit üstü seçilir (akım kapasitesi düşer).

**ASTOR yalnızca 28,5-36/0,4 kV hermetik trafo veriyor** → 36 kV seçiminde
gerçek fiyat, 6,3 / 10,5 kV ve yağlı tiplerde BFK bedeli.
**Öznur OG kabloları tek çekirdekli** — üç çekirdekli OG kablolar BFK'ta.
**AG kablo 4 damar serisi tam** (16-300 mm²).

## Kalibrasyon aracı neden yazmıyor

`tools/kalibrasyon.mjs` oranları hesaplar, **kendisi hiçbir değeri dosyaya
yazmaz**. `--yaz` bayrağı da yazmaz. Ölçülmemiş bir değeri kalibrasyonlu gibi
göstermek, kalibrasyonun kendisini yanıltır — ve hangi sayının gerçek ölçüm
olduğu belli olmaz. Yazma işi bilinçli olarak insanda.

## Dosya düzeni

```
data/
  tedas_bfk_2026.json     ham katalog (4773 kalem, üretilmiş)
  fiyat_kitabi.json       yayımlanan fiyat listesi (2549 kalem) ← ÜRETİLİR
  normlar.json            katsayılar ve eşleme tabloları
  olcum.json              gerçek ölçüm verisi
  tedarikci_fiyatlari.json  ASTOR + Öznur ham bedelleri, iskonto, kur ← ELLE
  kablo_secimi.json       AG kablo tipi seçimi ve kesit kuralı ← ELLE
  oznur_ag.json           Öznur'dan çıkarılan AG bedelleri (üretilmiş)
web/
  motor.js                hesap motoru (saf fonksiyon, katsayısız)
  maliyet-motoru.js       arayüz
  maliyet-motoru.html     sayfa
  maliyet-motoru.css      sayfa stilleri (atlasgrid.css üstüne)
  assets/                 site_v3'ten kopyalandı
tools/
  bfk_katalog.mjs         xlsx → katalog
  yayim_adi.mjs           TEDAŞ ham tanımı → yayım adı (motor buradan okur)
  tedarikci_uret.mjs      katalog + tedarikçi listeleri → fiyat kitabı
  fiyat_kitabi_uret.mjs   eski üretici (BFK bedeliyle) — artık kullanılmıyor
  kalibrasyon.mjs         ölçüm → katsayı raporu
  oznur_ag.mjs            Öznur PDF → AG kablo bedelleri (sütun kayması çözümlü)
  motor_test.mjs          37 kontrol
  arayuz_test.mjs         43 kontrol
  xsheets.mjs             xlsx okuma yardımcısı
  web_eksle.mjs           data/ → web/ kopyası
  yerel_sunucu.mjs        yerel sunucu
docs/
  KALIBRASYON_REHBERI.md  ← okuyun
  Fiyat_listesi_rehberi.md
  TEKLIF_LISTESI_SABLON.csv
  decisions/
```

Kural: hesap `motor.js`, veri `data/`, gösterim `maliyet-motoru.js`.
Üçü karışırsa test kapsamı düşer.

## Yayına almadan önce

1. **`data/fiyat_kitabi.json` tohumdur** — TEDAŞ BFK bedelleri taşıyor.
   `meta.kaynak = seed-tedas-bfk`. Gerçek fiyat listesiyle değiştirilmeden
   yayına almayın. Sayfa bu değeri görünce uyarı bandı gösterir; gerçek liste
   girince bant kendiliğinden kaybolur.
2. **Kâr marjı bu dosyalara yazılmaz.** Motor kâr uygulamaz.
3. **`85.830.2020` / `85.830.2109` farkı** tarif kitabından doğrulanmadı.
   Motor ilkisini seçip tespit olarak yazıyor.
4. **Platform tipi (PL-250/PL-400)** kVA bandından öneriliyor, doğrulanmamış.

## KVKK

Hesaplama tamamen tarayıcıda; proje teknik girdileri sunucuya gitmez. Kişisel
veri yalnızca talep formunda, ad + e-posta zorunlu. Form bağlı değilse
`mailto:` ile talep bize ulaşır.

## Tuzaklar

- **PowerShell `Set-Content -Encoding UTF8` UTF-8 dosyaları çift kodlar.**
  Bu oturumda `×` → `Ã—` oldu ve kablo eşleşmeleri sessizce kırıldı.
  Edit/write aracını kullanın.
- `npm run build` `web/` kopyasını kendisi yapar; elle kopyalamaya gerek yok
  (eski sürümde gerekliydi, `web_eksle.mjs` eklendi).
- Arayüz `catch` hataları yutar. Testte "0 kalem" görüyorsan önce test
  taklidinin eksik DOM metodu var mı bak (`createElement`, `appendChild`,
  `querySelector`, `innerHTML=''` çocukları silmeli).