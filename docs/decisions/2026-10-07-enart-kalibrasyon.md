# Enart 100 kVA direk tipi teklifi — kalibrasyon analizi (2026-10-07)

Kaynak: Enart Enerji tedarikçi teklifi, 26 satır, toplam 412.577 TL.
`data/olcum.json` içinde 3. vaka olarak kayıtlı.
Aritmetik doğrulandı (26 satır toplamı 412.577,00 — fark 0,00).

## Kapsam notu

Direk tipi proje. 26 satırın 7'si motor kapsamında, 19'u kapsam dışı
(OG direk donanımı, havai hat, sarf, levha, harici ayırıcı, kablo başlığı).
Motor-kapsamındaki satırlar toplamın %83'ü (343.735 TL).

## Birim fiyat varsayımı (DOĞRULANDI 2026-10-07)

Kullanıcı teyidi: birim fiyatlar malzeme. 419.000–412.577 farkı (6.423 TL)
bilinmiyor — şerhli, oranlara dokunulmadı.

## Oranlar (ölçüldü, tek veri)

| Kalem | Teklif | Motor malzeme | Oran | Yön |
|---|---|---|---|---|
| Trafo 100 kVA AL | 168.360 | 151.927,65 (AOAk %70) | 1,1082 | motor %10,8 düşük |
| Bakır bara (kg) | 900 | 916,85 (BFK) | 0,9816 | tutarlı (REMA 0,96 ile uyumlu) |
| Köşebent 2m (ad) | 725 | 822,45 (BFK) | 0,8815 | motor %11,8 yüksek |
| Örgülü tel (m) | 90* | 73,01 (BFK) | 1,2327 | motor %23,3 düşük |
| AG 1×50 NYY (m) | 360 | 299,46 (Öznur %65) | 1,2022 | motor %20,2 düşük |
| AG 3×50+25 NYY (m) | 1.300 | 1.063,30 (Öznur %65) | 1,2226 | motor %22,3 düşük |
| AG 3×35+16 NYY (m) | 1.010 | 774,20 (Öznur %65) | 1,3046 | motor %30,5 düşük |

\* 14. satır "5MT" seti ADET birimle satılmış; 1 ADET = 5 m varsayıldı.
Belirsiz — teyit gerekli.

## Güncelleme (2026-10-09)

Kalibrasyon aracı Enart vakasını okuyor (`teklifREMA ?? teklifEnart`,
16 kalem, 2 vaka). Çapraz doğrulama:

- Trafo: Özçam %62 ↔ Enart %64 (farklı BFK pozu, farklı tedarikçi)
- Bara: %96 ↔ %98
- 3×50+25: %143 ↔ %136
- 1×50: %135 ↔ %133
- B-35 demiri: iki vakada da 165 TL görüldü (BFK ~471) — oran 0,35
  iki bağımsız veriyle doğrulandı.

Enart vakasına `bfkMalzeme` eklendi (katalogdan). 14. satır set başına
(365,05 = 5m varsayımı) — şerh kalem notunda.

Testler: 48/48 + 49/49. `npm run kalibrasyon` çıkış kodu 0.

Kullanıcı ekran görüntüsüyle sayfa 8'deki nötrlü satırları doğruladı
(3×35+16: 2.212.000, 3×50+25: 3.038.000 TL/km). İki bulgu:

1. `uc` 35/50 sayıları (2028/2741) teyitli: nötrsüz 3×35/3×50 satırları.
2. Nötrlü pozlar (`3 X 35ş + 16` biçimi) `kabloPoz` regex'ine takılmıyordu
   (`ş?` ve `+ nötr` yoktu) — BFK bedelinde kalıyordu. Regex düzeltildi,
   `ucNotr` tablosu eklendi. Yukarıdaki iki oran güncellendi (1,36→1,22;
   1,45→1,30). Tedarikçi kalem 1522→1917.

## Normlara İŞLENMEDİ

Tek tedarikçi, tek proje, marka belirsiz, malzeme/montaj ayrımı teyitsiz.
Özellikle kablo oranları (1,20–1,45) Öznur iskonto varsayımını sorgulatıyor
ama tek veriyle iskonto değiştirilmez.

## Açık sorular (kullanıcıya)

1. Birim fiyatlar malzeme mi, malzeme+montaj mı?
2. El yazısı 419.000 ile tablodaki 412.577 farkı ne (6.423 TL)?
3. ~~Trafo iskontosu %70 → %67'ye çekilsin mi?~~ **KAPANDI (2026-10-07):**
   kullanıcı %70'te kalınmasını istedi. Teklifin ima ettiği %66,8 ikinci
   bağımsız veri gelene kadar şerhli not olarak durur.
4. Kablo iskontoları (%65 Öznur) gözden geçirilsin mi? 3 kalemde de
   teklif motorun %20-45 üzerinde. Ama tek veri + BFK bedelli kalemler
   (Öznur'da bu kesitler yok) karışık — **beklemede, ikinci veri gerekli**.
   **2026-10-07 kullanıcı kararı: şimdilik böyle kalsın, güncel iskonto
   daha sonra alınacak.**