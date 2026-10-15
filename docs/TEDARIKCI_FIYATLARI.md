# Tedarikçi fiyatları — ASTOR %70, Öznur %65

**Güncelleme:** 2026-10-06
**Kaynak:** `data/` altındaki PDF'ler (kullanıcı yerleştirdi)

| Dosya | Tarih | Para birimi | Durum |
|---|---|---|---|
| `ASTOR-TRAFO-FIYAT-LISTESI-05.11.2024.pdf` | 05.11.2024 | USD | güncel (teyit edildi) |
| `2.-Astor-Hucre.pdf` | 27.01.2025 | USD | — |
| `Öznur_fiyat-listesi-Haziran-2026.pdf` | Haziran 2026 | TL/km | — |

## İskonto

| Tedarikçi | İskonto | Nereden |
|---|---|---|
| ASTOR | **%70** | kullanıcı, 2026-10-06 |
| Öznur | **%65** | kullanıcı, 2026-10-06 |

## Döviz kuru

**48,93 TL/USD** — TCMB gösterge kuru, 30.09.2026 alış. Serbest piyasa
48,76-49,17 aralığında.

Bu **trafo bedellerinin tamamını** belirliyor. 100 kVA örneği:

```
USD 11.500 × 48,93 = 562.695 TL → × %30 = 168.808 TL net
BFK malzeme 263.554 TL → %36 tasarruf
```

Yanlış kur (41,90) ile 144.555 TL hesaplanıyordu — %17 fark. Sipariş öncesi
güncellenmeli.

## Trafo

ASTOR listesi yalnızca **28,5-36/0,4 kV hermetik trafo** veriyor. Bu, BFK'taki
`85.630.15xx` bloğuna birebir karşılık geliyor.

| BFK bloğu | ASTOR karşılığı |
|---|---|
| `85.630.15xx` (36 kV hermetik) | ✅ var |
| `85.630.11xx` (6,3 kV) | ❌ yok — BFK bedeli |
| `85.630.13xx` (10,5 kV) | ❌ yok — BFK bedeli |
| `85.610.xx` (yağlı tip) | ❌ yok — BFK bedeli |

**Sonuç:** 36 kV seçiliyorsa gerçek fiyat, diğer gerilimlerde BFK bedeli.
Düşürülmedi — bu bir eksik değil, liste kapsamı.

12 kVA eşleşti (50-2500 kVA). BFK'taki 20 kVA'ya karşılık ASTOR'da yok.

## AG kablo — bakır NYY seçildi

`data/kablo_secimi.json` → `secim.varsayilan = "NYY-Cu"`

Trafo bağlantılarında bakır seçiliyor (kullanıcı teyidi). Alüminyum
seçilirse **2 kesit üstü** seçilir — akım taşıma kapasitesi düştüğü için:

```
4x95 Cu  →  4x150 Al
4x150 Cu →  4x240 Al
```

Bu eşleme `kablo_secimi.json → secim.aluminyumIcinKesitKurali.eslesme`
içinde. Motor aynı kesiti iki kere saymaz.

### Öznur listesinde olan (NYY-Cu, TL/m)

| Çekirdek | Kesitler |
|---|---|
| 1x | 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 · 95 · 120 · 150 · 185 · 240 · 300 · 400 · 500 · 630 |
| 2x | 0,75 · 1 · 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 |
| 3x | 0,75 · 1 · 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 · 95 · 120 · 150 · 185 · 240 · 300 |
| 4x | 0,75 · 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 · 95 · 120 · 150 · 185 · 240 · 300 |
| 5x | 1 · 1,5 · 2,5 · 4 · 6 · 10 · 16 · 35 · 50 · 70 · 95 · 120 · 150 · 185 · 240 · 300 |

Trafo bağlantısı için gereken 4 damar serisi **tam** (16-300 mm²).

### Öznur listesinde olmayan (BFK bedeliyle kalıyor)

| Kalem | Neden |
|---|---|
| AG 1x2,5 · 2x70 ve üstü · 4x400 | listede yok |
| **OG 3x25 … 3x400** | Öznur OG kabloları **tek çekirdekli** (1x) |
| OG 1x25 | listede yok (en küçük 35) |

**OG üç çekirdekli** kablo için Öznur listesi işe yaramıyor. Trafo bağlantısında
OG kablo genelde tek çekirdekli (3 × 1x150 + 1x25) döşendiği için motorun
varsayılanı uygun; üç çekirdekli seçilirse BFK bedeli kullanılır.

## Kaç kalem tedarikçi fiyatı aldı

| Kaynak | Kalem |
|---|---|
| Öznur veya ASTOR bedeli | **1113** |
| BFK bedeliyle | 1436 |
| Toplam | 2549 |

Fiyat kitabı `meta.kaynak = "tedarikci-net"`. Her kalemde `kaynak` alanı
hangi bedelden geldiğini gösteriyor.

## PDF okuma — iki hata çözüldü

`tools/oznur_ag.mjs` yazıldı. İki sorun vardı:

**1. Sütun kayması.** PDF iki sütunlu ve metin çıkarımı ikisini tek satırda
birleştiriyor. Ortadan bölmek yanlıştı — sütun genişlikleri eşit değil, uzun
tip adı (`YAXV (NA2XY) 0,6/1 kV (CPR Class: Eca)`) orta noktayı kaydırıyordu.
Sonuç: bir sütunun fiyatı diğerinin tipine yazılıyordu. Belirti aynı kalemin
bedelleri arasında tam kat farkıydı (`3x25 → 172.500 | 1.481.000`).

Çözüm: tip etiketlerini sayfa başında x konumlarıyla toplayıp her fiyatı
kendisinden **sola en yakın etikete** atamak.

**2. BFK'ta iki kademeli kesit.** `85.840.2507` = "4 X 150 - **4 X 95** mm²"
yani 4×95 + 4×150. Adlandırıcı bunu `4×150` sanıyordu. `yayim_adi.mjs`
iki kademeli biçimi ayrıca ele alıyor, küçük kesiti esas alıyor.

## Bu oturumda düzeltilen hatalar

1. **Döviz kuru** 41,90 → 48,93 (tahmin, yanlış)
2. **`startsWith(blok + '.')`** — `85.610.11` bloğu için `85.610.11.` arıyordu,
   hiçbir poz eşleşmiyordu. KVA listesi boş kalıyordu
3. **Kablo grubu eksikliği** — motor yalnızca `85.830`/`85.800` tarıyordu;
   `85.850`/`85.860`/`85.840` yoktu
4. **`kabloPoz` tek poz tutuyordu** — aynı imzaya sahip ikinci poz
   (`85.800.3033`) hiç işlenmiyordu, BFK bedeliyle kalıyordu
5. **OG/AG regex karışıyordu** — "3 X 25ş / 16" yazan AG kablo OG sanılıyordu.
   Tip artık poz önekinden belirleniyor
6. **İki kademeli kesit** — "4 X 150 - 4 X 95" yanlış okunuyordu

## Test

| Dosya | Sonuç |
|---|---|
| `tools/motor_test.mjs` | 37/37 |
| `tools/arayuz_test.mjs` | 47/47 |

## Komutlar

```bash
npm run build      # ozktur → tedarikci_uret → web_eksle
node tools/oznur_ag.mjs "data/Öznur_fiyat-listesi-Haziran-2026.pdf" data/oznur_ag.json
```

## Sıradaki

1. **ASTOR'da 6,3 / 10,5 kV trafo** — bu gerilimlerde hâlâ BFK bedeli.
   Listede yoksa sorun değil; varsa eklenmeli
2. **ASTOR hücre listesi** — `2.-Astor-Hucre.pdf` henüz bağlanmadı. Motorun
   kapsamında hücre yok (OG koruma = 85.530.240x sigorta grubu)
3. **Döviz kuru otomatikleştir** — haftalık TCMB'den çekilmeli
4. **BFK bedeliyle kalan 1436 kalem** — bara, pabuc, kanal, pano, platform.
   Öncelik: trafo bağlantısında ağırlığı olanlar
5. **OG kablo gerilim sınıfı** — motor 8,7/15 kV serisini kullanıyor.
   `ogSistem` girdisine bağlanmalı (6/10 kV %4-8 daha ucuz)