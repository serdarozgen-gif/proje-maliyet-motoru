# Hücre (switchgear) pozlarının fiyat kitabına girişi — 2026-10-07

## Ne yapıldı

OG koruma, TEDAŞ BFK'nın "dahili tip sigorta grubu" kalemi
(`85.530.2403`) yerine ASTOR hücre listesiyle (`2.-Astor-Hucre.pdf`,
27.01.2025) fiyatlanan 11 hücre pozuna bağlandı.

## Kararlar

### 1. Döngü sırası hücre döngüsünden ÖNCE olmalı

`tools/tedarikci_uret.mjs` iki geçiş yapıyor:

1. ASTOR hücre döngüsü (USD → TL → iskonto)
2. "Kalan" geçişi — fiyatlanmamış pozları BFK bedeliyle ekler

`kalemEkle` çakışmada sessizce vazgeçiyor (`istatistik.cakisma`).
Hücre döngüsü ikinci geçişten sonra çalışınca hücreler önce BFK bedeliyle
yazılıyor, ASTOR iskontosu hiç uygulanmıyordu.

Hücre döngüsü ikinci geçişten **önce** çalışacak şekilde taşındı.

Belirti: `fiyat_kitabi.json` içindeki hücre kaynakları
"TEDAŞ 2026 BFK (tedarikçi listesi yok)" diyordu. ASTOR iskontosu
uygulanmamış gibi görünüyordu — uygulanmamıştı.

### 2. `85.510.1102` yazılmadı — BFK'ta ürün adı yok

BFK tanımı: `36 kV , 630 A , 16 KA`

Yük ayırıcılı mı, kesicili mi, motorlu mu BFK'ta yazmıyor. ASTOR
listesinde "AS36 LC — Yük ayırıcılı giriş/çıkış (motorlu)" adıyla geçiyor,
ama BFK pozunun ürün tipini doğrulayan metin yok.

Sonuç: `yayim_adi.mjs`'e bu poz için kayıt **yazılmadı**, kalem fiyat
kitabına giremedi. Uydurma ad yazmak yerine dışarıda bırakıldı.

**Bu poz için karar bekleniyor** (bkz. aşağıdaki açık sorular).

### 3. Önceki turun uydurma kayıtları silindi

Bir önceki denemede ~70 hücre pozuna ad yazılmıştı, ancak adlar BFK
tanımına bakılmadan poz numarasından türetilmişti. Bunların çoğu
doğrulanamıyordu (`(alt yapı)`, `(alt yapı 2)`, hatta ürün adı hiç
olmayan `'7,2/12/17,5 kV/0,1 kV 630A 16kA'`).

Hepsi silindi. Yerine ASTOR listesinde fiyatı olan 11 pozun BFK
`tanim`/`grupAdi` metninden türetilmiş adları yazıldı.

Not: `85.510.1302` için yazılan ad ASTOR listesinin "iç ihtiyaç hücresi"
ifadesiyle **çelişiyor**. BFK grubu "YÜK AYIRICI + SİGORTA BİRLEŞİĞİ
TRANSFORMATÖR KORUMA" diyor, yani bu trafo koruma hücresi. ASTOR'daki
eşleşme gözden geçirilmeli.

## Bulunan ek hatalar (bu iş sırasında)

### `motor.js` — `kalemTipi` güncel değildi

- Hücre blokları: `85.520.*` / `85.530.*` tanımlıydı. ASTOR pozları
  `85.500.*` / `85.510.*` → bu kalemler `hucre-montaj` yerine
  `varsayilan` (%35 ek oran) alıyordu. Ölçülmüş `hucre-montaj` oranı
  (-%33) uygulanmıyordu.
- Kablo blokları: `85.840.*` (AG 4-damar) ve `85.850.*` / `85.860.*`
  tanımlı değildi. Bu kalemler `kablo-montaj` (%0 ölçülmüş) yerine
  `varsayilan` (%35) alıyordu. `tedarikci_uret.mjs` `KABLO_GRUPLARI`
  ile motorun `kalemTipi` listesi **ayrışmıştı**.

Her iki liste artık eşitlendi ve yorumla bağlandı.

## Ölçülen sonuç (varsayılan senaryo, 250 kVA yağlı)

```
Malzeme  597.411 TL
İşçilik  142.726 TL
Toplam   740.137 TL
İşçilik payı  %19,3
```

Hücre tek başına toplam malzemenin **%32'si** (190.827 TL) ve ölçülmüş
ek oranı **-%33**. Bu yüzden işçilik payı %15'in altına düşüyor.

Test eşiği (`motor_test.mjs`, "işçilik payı makul (%15-40)") bu kapsam
için yazılmamıştı. Test **kasten gevşetilmemiştir** — eşiği değiştirmek
kalibrasyon eşiğini zayıflatır. Karar kullanıcıya bırakıldı.

## Test durumu

- `motor_test.mjs` — 37/38 (kalan: işçilik payı eşiği, yukarıda)
- `arayuz_test.mjs` — 47/47

`motor_test.mjs` içinde iki test eski kapsama göre yazılmıştı ve
yeni davranışa göre düzeltildi (sigorta grubu → hücre). Düzeltilen
testler: "koruma tipi hucre-montaj", "36 kV sigorta grubu seçildi"
→ artık `85.500.1207` bekleniyor.

## Açık sorular

1. `85.510.1102` — ~~ASTOR "AS36 LC (motorlu)" hangi BFK pozuna karşılık
   geliyor?~~ **KAPANDI (2026-10-07):** kullanıcı BFK ekran görüntüsüyle grup
   başlığının "YÜK AYIRICILI GİRİŞ-ÇIKIŞ FONKSİYONEL BİRİMİ" olduğunu
   doğruladı. Poz fiyat kitabına girdi.
2. ~~`85.510.1302` — ASTOR "VTC/3 iç ihtiyaç hücresi" mi, BFK "trafo
   koruma fonksiyonel birimi" mi?~~ **KAPANDI (2026-10-07):** kullanıcı BFK
   ekran görüntüsüyle grup başlığının "GERİLİM TRANSFORMATÖRÜ FONKSİYONEL
   BİRİMİ" olduğunu doğruladı. ASTOR eşleşmesi doğru. Ek bulgu: katalog
   JSON'unda bu bloğun `grupAdi` alanı yanlış (bkz. ASTOR_HUCRE_ESLESME.md).
3. ~~İşçilik payı test eşiği~~ **KAPANDI (2026-10-07):** kullanıcı onayıyla
   %10-40 yapıldı, gerekçe test içinde yazılı.
4. Hücre seçici (2026-10-07): kullanıcı "RMU / Metal iki seçeneği" kararını
   verdi. `hucreTipi` girdisi eklendi (`oto` | `rmu` | `metal`, varsayılan
   `oto` = RMU öncelikli, önceki davranış korunur). Testler: motor 7b,
   arayüz 6c.