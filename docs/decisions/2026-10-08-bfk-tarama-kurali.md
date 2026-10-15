# BFK tarama kuralı: önce grup adı — 2026-10-08

## Kural (kullanıcı)

TEDAŞ birim fiyat kitabı taranırken **önce grup adına bakılır**.
Tanım satırı ürün tipini yazmayabilir; tip grup başlığındadır.

## Kanıt (aynı gün)

- 85.211.2708 tanım: "36 KV 10 KA" — "parafudr" yazmıyor. Grup:
  metal oksit parafudr. Tanımla arama kaçırdı.
- 85.530.2304 tanım: "36 KV 630 A 12.5 KA" — "ayırıcı" yazmıyor. Grup:
  HARİCİ TİP SİGORTALI AYIRICILAR. Tanımla arama kaçırdı.

## Uygulama (2026-10-08)

Excel 2864. satır doğruladı: 85.800.25xx bloğu YAXV (NA2XY) alüminyum.
Katalog grup başlığı (NVV/NYM) ve fiyat kitabı adları (NYY/bakır) yanlıştı.

- `yayim_adi.mjs`: 85.800.25xx → "(NA2XY 0,6/1 kV (alüminyum))" etiketi.
- `tedarikci_uret.mjs`: bu bloğa NA2XY-Al bedeli (büyütmesiz).
- Bedeli doğrulanamayan Al kesit (örn. 1×10 — listede 16'dan başlıyor)
  fiyat kitabına girmez; `atlananPoz` BFK yedek geçişini de engeller.
- Testler: 48/48 + 49/49.