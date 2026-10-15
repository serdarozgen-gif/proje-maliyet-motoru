# Kalibrasyon — nasıl çalışılır

Motordaki hiçbir katsayı kodda gömülü değil. Üç dosya var:

| Dosya | Ne tutar | Kim değiştirir |
|---|---|---|
| `data/olcum.json` | Sahadan gelen **gerçek** fiyat ve tutarlar, vaka vaka | Siz, her yeni iş bittikçe |
| `data/normlar.json` | **Katsayılar** (iskonto, ek oran) + eşleme tabloları | Siz / kalibrasyon sonrası |
| `web/motor.js` | Hesap kuralları — **katsayı yok** | Nadiren |

Ayrım şu: `olcum.json` **gerçeği** kaydeder, `normlar.json` **kararı** tutar.
Gerçeği silmek/elle değiştirmek yanlış olur; kararı değiştirmek normal çalışmadır.

## Döngü

```
1. İşi bitir → fatura ve ekip ödemesini data/olcum.json'a yaz
2. node tools/kalibrasyon.mjs
3. Raporda çıkan oranları normlar.json'a yaz
4. node tools/motor_test.mjs  → hâlâ yeşil mi
5. Tekrar
```

Kalibrasyon aracı **kendisi hiçbir değeri yazmaz**. `--yaz` bayrağı da
yazmaz; ölçülmemiş bir değeri kalibrasyonlu gibi göstermek kalibrasyonun
kendisini yanıltır. Yazma işi bilinçli olarak insanda bırakıldı.

## Bulgu — tek katsayı işe yaramıyor

İlk ölçümde (`olcum.json`, 2 vaka, 23 satır) çıkan sonuç:

**Malzeme** — BFK bedeli ↔ bayi/teklif oranı:

```
En düşük   %58   36kV polimer parafudr
En yüksek  %143  3x50+25 NYY kablo
Ortalama   %90
Dağılım    2,4x
```

**İşçilik** — BFK montaj ↔ gerçek ekip bedeli:

```
En düşük   %67   kompakt hücre montajı
En yüksek  %1094 sac tava (BFK montajı 27 TL, gerçek 300 TL)
Dağılım    16,3x
```

16,3x dağılım tek bir ekleme oranının işe yaramayacağını gösteriyor. Bu yüzden
`normlar.json` katsayıyı **kalem tipine** göre veriyor.

## İki net ölçüm

**Kablo çekimi:** gerçek 120 TL/m, BFK montaj 119,08 → oran 1,01.
Ek oran **uygulanmamalı**. Motor eskiden %35 ekliyordu, kablo çekimini
gerçeğin 1,35 katı gösteriyordu.

**Hücre montajı:** gerçek 22.000 TL/ad, BFK montaj 32.709 → oran 0,67.
BFK bu işte ekip maliyetinin **üstünde**. Eski %35 ek oranla 44.155 TL
üretiyordu, yani gerçeğin 2 katı. Şimdi **-0,33** uygulanıyor.

Motor `ozet.ekOranKullanim` ile hangi kaleme hangi oranı uyguladığını raporluyor.
Arayüzde de bu bilgi sonuç satırının altında görünüyor.

## Topraklama çelişkisi — çözülmedi

İki kalem zıt yönde:

| Kalem | Gerçek | BFK montaj | Oran |
|---|---|---|---|
| Topraklama kazığı | 2.000 TL/ad | 1.208 | 1,66 |
| Topraklama şeridi | 300 TL/m | 329 | 0,91 |

Tek `topraklama` tipi ikisini birden doğru temsil edemez. Şimdilik 0,35 geçici.
Çözüm: kalemi ikiye ayırmak (`topraklama-kazik` / `topraklama-serit`) ya da
ikisini birlikte ölçen bir vaka toplamak.

## Vaka seviyesi karşılaştırma — henüz geçerli değil

Ölçüm vakası (Özçam 100 kVA) motordan geçirildiğinde:

```
Motor toplamı      : 329.169 TL
Gerçekleşen toplam : 828.661 TL
Fark               : -499.492 TL (-60,3%)
```

**Bu fark motor hatası değil.** Kapsam eşleşmiyor:

- Motor kanal kazısı/hafriyat üretmiyor (BFK 85.890.x — bilinçli kapsam dışı)
- Gerçekleşende trafoya bağlı pano 136.369 TL, motorun AG panosu 78.219 TL
- Fatura kalem kalemi 511.458 TL — kalemler BFK pozuna eşlenmemiş, motor
  bunları üretemez
- Motor OG kabloyu 3×50 mm² alıyor; gerçekte 1×50 NYY 75 m + 3×50+25 35 m

**Geçerli kalibrasyon testi için kapsam önce eşitlenmeli.** Bunun için
`olcum.json`'a faturaların kalem kalemi dökümünü eklemek gerekiyor: her fatura
satırı için kalem adı, miktar, birim fiyat, tutar ve mümkünse BFK poz karşılığı.
O zaman motor bloğu ↔ fatura bloğu karşılaştırması yapılabilir.

## `olcum.json`'a ne yazılır

```json
{
  "vaka": "İş adı",
  "tarih": "2026-10-01 .. 2026-10-20",
  "kaynak": "Hangi dosya/fatura/eposta — izlenebilirlik için",
  "kalemler": [
    {
      "poz": "85.610.1103",
      "ad": "100 kVA trafo",
      "bfkMalzeme": 232997.26,
      "teklifREMA": null,
      "elNotu": null,
      "gerceklesen": 160580.25,
      "bfkMontaj": null,
      "gercekIscilik": null,
      "not": "Seri/donanım farkı, teslim süresi vb."
    }
  ],
  "toplamlar": {
    "faturaMalzemeToplamiKDVIHaric": null,
    "iscilikOdenenKDVIHaric": null
  }
}
```

Alanlar:
- `bfkMalzeme` — BFK bedeli. Fatura satırı BFK pozuyla eşleşiyorsa yazılır
- `teklifREMA` / `elNotu` / `elsan` — piyasa teklifleri (varsa)
- `gerceklesen` — **faturadan gelen gerçek bedel**. En değerli alan
- `bfkMontaj` + `gercekIscilik` — işçilik kalibrasyonu için çift
- `not` — neden farklı? (kapsam farkı, seri farkı, iskonto, vade)

Boş bırakılabilir (`null`); kalibrasyon aracı boş alanları atlar.

## Komutlar

```bash
node tools/kalibrasyon.mjs        # rapor
node tools/motor_test.mjs         # 37 kontrol
node tools/arayuz_test.mjs        # 43 kontrol
node tools/yerel_sunucu.mjs       # http://localhost:8099/
```

`data/` → `web/` kopyası üretimden sonra gerekiyor:
```powershell
Copy-Item data/normlar.json web/normlar.json -Force
Copy-Item data/fiyat_kitabi.json web/fiyat_kitabi.json -Force
```

## Olmayanlar

- **Kâr marjı motorun dışında.** `normlar.json` marj içermez ve içermemeli.
- **Nakliye, şantiye, test-kabul, kepçe** motorun dışında. Trafo bağlantısında
  bunlar küçük kalemler; büyük işler için ayrı blok gerekir.
- **Sözleşme/vade maliyeti** yok.
- **KDV yok** — tüm bedeller hariç.