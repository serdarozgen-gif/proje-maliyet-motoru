# Direk tipi eşleşme tablosu — 2026-10-08

Kaynak: Enart teklifi (26 satır) ↔ `tedas_bfk_2026.json` katalog taraması.
Oran = teklif birim fiyat / BFK malzeme.

## Eşleşenler

| # | Teklif satırı | Teklif | BFK poz | BFK malzeme | Oran |
|---|---|---|---|---|---|
| 3 | SWALLOW iletken (kg) | 250 | 85.209.1302 | 161,92 | 1,54 |
| 4 | VHD35 izolatör (ad) | 850 | 85.211.1806 | 1.525,34 | 0,56 |
| 6 | 40kN kompozit izolatör (ad) | 320 | 85.211.2201 (40kN/11B) | 652,82 | 0,49 |
| 7 | Tek gergi swallow (ad) | 365 | 85.211.2501 | 1.007,84 | 0,36 şerhli* |

\* Teklif "tek gergi" 365 TL, BFK takımı ~1.008 TL. Ürün aynı olmayabilir
(takım vs parça). Eşleşme şerhli.

## Birim uyumsuzluğu (eşleşme kurulamadı)

| # | Teklif satırı | Sorun |
|---|---|---|
| 2 | Omega tava (TK 1.650) | BFK 85.880.1201 kg işi (160,30/kg) — TK↔kg dönüşümü yok |
| 5 | B-35 izolatör demiri (ad 165) | BFK konsol/demir kg işi (85.105.x) — ad↔kg dönüşümü yok |

## BFK'ta karşılığı YOK

| # | Teklif satırı | Teklif | Not |
|---|---|---|---|
| 8 | Parafudr+ayırıcı+fleks kablo seti | 2.250/ad | Katalogda ürün yok (yalnız kapağı var) |
| 9 | Harici sigortalı ayırıcı 36kV 630A | 34.000/ad | Katalogda yok — direk tipi OG korumanın ana kalemi |
| 10 | OG sigorta 6A 61cm | 450/ad | Atgı; katalogda yok |
| 11 | Ölüm tehlike levhası | 26/ad | Aranmadı (sarf) |
| 17 | H/T başlık 3×50+25 | 800/ad | Katalogda yok |

## Güncelleme (2026-10-08, kullanıcı BFK pozları verdi)

- Parafudr grubu **85.211.2700** (metal oksit ZNO); 36kV 10kA = **85.211.2708**
  (3.421,84 TL). İlk tarama kaçırmıştı: tanımda "parafudr" yazmıyor, grup
  adında yazıyor. Ders: poz araması tanım+grup ile yapılmalı.
- Harici ayırıcı **85.530.2304** (36kV 630A 12,5kA, 36.383,26 TL). Aynı
  sebeple ilk taramada kaçtı.
- Sigorta atkısı (fuse link): **85.530.2700** grubu. Enart "61 CM 6A" =
  **85.530.2721** (36kV 2-20A L=635mm, 800,84 TL). Enart 450 → oran 0,56.
- İzolatör demiri B-35 = **85.211.1907** (470,79 TL). Enart 165 → oran
  0,35. Dikkat çekici düşüklükte — ürün şerhli (durdurucu travers demiri
  vs teklif kalemi).
- Kablo başlığı: BFK'ta yok. Kullanıcı başlık + ek mufu listesi verecek.
  85.840.1352 "düz kablo eki"dir (OG), başlık değil — karıştırılmadı.
- Tava 85.880.1201 (kg) + demir ad/kg uyumsuzluğu: kullanıcı cevaplamadı,
  **sabit kalem varsayımıyla bekliyor** (tava 1.650 TK, demir 165 ad).

1. BFK'sız kalemler (8, 9, 10, 17) nasıl fiyatlansın: Enart bedeliyle sabit
   kalem mi, kapsam dışı + tespit mi?
2. Birim uyumsuzları (2, 5) için TK↔kg, ad↔kg dönüşümü kurulacak mı?
3. 7. satır eşleşmesi doğru ürün mü?