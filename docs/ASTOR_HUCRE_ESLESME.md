# ASTOR hücre listesi ↔ BFK poz eşleşme durumu — 2026-10-07

ASTOR kaynağı: `data/2.-Astor-Hucre.pdf` (27.01.2025)
BFK kaynağı: `5 2026 Yılı TEDAŞ BFK.xlsx`

## Eşleşen kalemler (ASTOR → BFK)

11 ASTOR hücre kaleminin 11'i eşleşti.

| ASTOR | USD | BFK poz | BFK tanımı | Durum |
|---|---|---|---|---|
| AS36 LC RMU | 15.000 | 85.500.1203 | 36 kV 630A Yük Ayırıcılı Giriş-çıkış | ✓ |
| AS36 LF RMU | 20.000 | 85.500.1207 | 36 kV 630A Sigortalı Yük Ayırıcılı Koruma | ✓ |
| AS36 CBC RMU | 31.000 | 85.500.1211 | 36 kV 630A Kesicili Giriş-çıkış | ✓ |
| AS36 LC-Y RMU | 18.000 | 85.500.1215 | 36 kV 630A Yük Ayırıcılı Bara Bağlama | ✓ |
| AS36 CBC-C RMU | 45.000 | 85.500.1216 | 36 kV 1250A Kesicili Bara Bağlama | ✓ |
| AS36 VTC/2 RMU | 14.000 | 85.500.1219 | 36 kV 630A Akım Gerilim Ölçü | ✓ |
| AS36 LCV RMU | 19.000 | 85.500.1222 | 36 kV 1250A Gerilim Ölçü | ✓ |
| AS36 KB RMU | 6.500 | 85.510.2101 | Kablo Giriş Bağlantı Fonksiyonel Birimi | ✓ |
| AS36 LF | 6.650 | 85.530.2403 | 36 kV 630 A (Dahili Tip Sigorta Grubu) | ✓ |
| AS36 VTC/3 | 12.400 | 85.510.1302 | 24/36 kV/0,1 kV (BFK grup başlığı: GERİLİM TRANSFORMATÖRÜ FONKSİYONEL BİRİMİ) | ✓ 2026-10-07 kullanıcı BFK ekran görüntüsüyle doğruladı — ASTOR "iç ihtiyaç" eşleşmesi doğru |

## Eşleşmeyen kalem

| ASTOR | USD | Durum |
|---|---|---|
| AS36 LC (motorlu) | 5.900 | 85.510.1102 | 36 kV, 630 A, 16 KA (BFK grup başlığı: YÜK AYIRICILI GİRİŞ-ÇIKIŞ FONKSİYONEL BİRİMİ) | ✓ 2026-10-07 kullanıcı BFK ekran görüntüsüyle doğruladı |

BFK 85.510.1102'nin tanımı yalnız `36 kV , 630 A , 16 KA`. Ürün tipi
(yük ayırıcılı/kesicili/motorlu) yazmıyor. Doğru poz olduğu doğrulanamadığı
için kalem fiyat kitabına alınmadı.

**2026-10-07 güncellemesi: kullanıcı BFK ekran görüntüsüyle grup başlığının
"YÜK AYIRICILI GİRİŞ-ÇIKIŞ FONKSİYONEL BİRİMİ" olduğunu doğruladı. Eşleşme
kapatıldı, poz fiyat kitabına girdi.**

## VTC/3 çelişkisi (kapandı — 2026-10-07)

Soru: ASTOR "VTC/3 iç ihtiyaç hücresi" mi, BFK "trafo koruma hücresi" mi?

Yanıt: **ASTOR doğruymuş.** Kullanıcı BFK ekran görüntüsüyle grup başlığının
"GERİLİM TRANSFORMATÖRÜ FONKSİYONEL BİRİMİ" olduğunu doğruladı. BFK satırı
`24/36 kV / 0,1 kV`, bedel 280.505,76 TL.

Bu, katalogdaki bir veri hatasını da ortaya çıkardı: `data/tedas_bfk_2026.json`
içinde 85.510.1301 ve 85.510.1302'nin `grupAdi` alanı "YÜK AYIRICI + SİGORTA
BİRLEŞİĞİ TRANSFORMATÖR KORUMA FONKSİYONEL BİRİMİ" olarak yazıyor — yanlış.
xlsx→json çevriminde grup başlığı bu bloğa hatalı atanmış (teyitsiz: birleştirilmiş
başlık hücresi veya grup sınır tespiti). Motor `grupAdi`'ni işlevsel olarak
kullanmıyor (yalnız `yayim_adi.mjs` ad türetmede kullanıyordu, o da bu poz için
artık sabit kayıt), bu yüzden çevrim yeniden çalıştırılmadı — ama katalog
yeniden üretilirse bu bloğun kontrol edilmesi gerekir.

Yayım adı "24/36 kV 0,1 kV gerilim transformatörü / iç ihtiyaç fonksiyonel
birimi" olarak düzeltildi.