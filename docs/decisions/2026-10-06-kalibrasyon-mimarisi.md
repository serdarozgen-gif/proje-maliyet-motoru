# Karar — Kalibrasyon Mimarisi

**Tarih:** 2026-10-06
**İlgili:** [2026-10-06-ilk-uygulama-kapsami.md](./2026-10-06-ilk-uygulama-kapsami.md)

## Karar

Katsayılar koddan ayrıldı. Üç dosya, üç sorumluluk:

| Dosya | Ne tutar | Kim yazar |
|---|---|---|
| `data/olcum.json` | **Gerçek** fiyat/tutar, vaka vaka | Kullanıcı, her iş sonrası |
| `data/normlar.json` | **Katsayılar** (iskonto, tipe özel ek oran) + eşleme tabloları | Kalibrasyon sonrası |
| `web/motor.js` | Hesap kuralları — **içinde katsayı yok** | Nadiren |

## Gerekçe

İlk sürümde `iscilikEkOrani = 0.35` `fiyat_kitabi.json` içinde sabit bir
sayıydı. Ölçüm verisi toplandığında bu yanlış olduğu görüldü: işçilik
oranlarında dağılım 16,3x. Tek sayı bu aralığı kapatamaz.

Ayrıca `fiyat_kitabi.json` **fiyat verisi** dosyasıdır; içine katsayı koymak
iki sorumluluğu birleştiriyordu. Fiyat listesi haftalık değişecek, katsayılar
ise iş başına kalibre edilecek — farklı güncelleme döngüleri.

## Ölçümle desteklenen iki düzeltme

**Kablo çekimi → ek oran 0.** Gerçek 120 TL/m, BFK montaj 119,08 → oran 1,01.
Sabit %35, kablo çekimini gerçeğin 1,35 katı gösteriyordu.

**Hücre montajı → ek oran -0,33.** Gerçek 22.000 TL/ad, BFK montaj 32.709 →
oran 0,67. Sabit %35 burada gerçeğin **2 katını** üretiyordu.

Bunlar `normlar.json` içinde `_` ile başlayan yorum notlarıyla birlikte
duruyor: hangisinin ölçüldüğü, hangisinin geçici olduğu dosyadan okunuyor.

## Kalibrasyon aracı neden yazmıyor

`tools/kalibrasyon.mjs` oranları hesaplar ve raporlar, **hiçbir değeri
dosyaya yazmaz**. `--yaz` bayrağı da yazmaz.

Gerekçe: ölçülmemiş bir değeri kalibrasyonlu gibi yazmak, kalibrasyonun
kendisini yanıltır. Hangi sayının gerçek ölçüm olduğu belli olmaz ve sonraki
her hesap yanlış temele oturur. Yazma kararı insanda kalıyor — dosyadaki
`_` notları zaten hangi değerin ölçülüp hangisinin geçici olduğunu söylüyor.

## İş tipi ayrımı kabul edildi

`motor.js` içinde `kalemTipi(poz, ad)` ile poz öneki kalem tipine çevrilir
(`kablo-montaj`, `hucre-montaj`, `topraklama`, …) ve `normlar.json`'daki
`iscilik.tipBazliEkOran` uygulanır. Her satır `tip` ve `ekOran` alanını
taşır; `ozet.ekOranKullanim` hangi tipin kaç birimde hangi oranı aldığını
raporlar. Arayüz bunu ekranda gösterir — kalibrasyon izlenebilir.

## Çözülmemiş (bilinçli)

**Topraklama çelişkisi.** Kazık oranı 1,66, şerit oranı 0,91 — zıt yönde.
Tek `topraklama` tipi ikisini birden temsil edemiyor. 0,35 geçici olarak
duruyor. Çözüm yolu: kalemi ikiye ayırmak veya ikisini birlikte ölçen vaka
toplamak.

**Vaka seviyesi karşılaştırma geçerli değil.** Ölçüm vakası (Özçam 100 kVA)
motordan geçirildi: motor 329.169 TL, gerçekleşen 828.661 TL, fark -60,3%.
Bu **motor hatası değil** — kapsam eşleşmiyor:

- motor kanal kazısı/hafriyat üretmiyor (bilinçli kapsam dışı)
- gerçekleşende trafoya bağlı pano 136.369 TL, motorun AG panosu 78.219 TL
- fatura kalem kalemi 511.458 TL — kalemler BFK pozuna eşlenmemiş
- motor OG kabloyu 3×50 alıyor, gerçekte 1×50 NYY 75 m + 3×50+25 35 m

Geçerli kalibrasyon testi için `olcum.json`'a faturaların kalem kalemi dökümü
eklenmeli (kalem adı, miktar, birim fiyat, tutar, BFK poz karşılığı). Bu veri
toplama işidir ve kullanıcıdan istenir.

## Doğrulama

| Test | Sonuç |
|---|---|
| `tools/motor_test.mjs` | 37/37 |
| `tools/arayuz_test.mjs` | 43/43 |

Motor 3b/3c/3d alt grupları yeni eklendi: tip bazlı oranların uygulanması,
iskonto çarpımı, normlar verilmediğinde geriye uyum.

## Uygulanmayacaklar

- Kâr marjı motorun dışında ve `normlar.json`'da olmayacak.
- Nakliye, şantiye, test-kabul, kepçe motorun dışında (bu vaka tipinde küçük;
  büyük işler için ayrı blok gerekir).
- Sözleşme/vade maliyeti yok.
- KDV yok — tüm bedeller hariç.