# Fiyat listesi hazırlama rehberi

Motor bugün `data/fiyat_kitabi.json` okuyor. Bu dosyayı **kendi gerçek
fiyat listenizle** değiştirmeniz gerekiyor. Formatı bozarsanız sayfa boş kalır.

## Format

```json
{
  "meta": {
    "surum": "1.0.0",
    "uretildi": "2026-10-06",
    "kapsam": "trafo-baglantisi",
    "kaynak": "atlasgrid-liste",
    "iscilikEkOrani": 0.35,
    "kdvDahil": false,
    "kalemSayisi": 543
  },
  "kalemler": {
    "85.610.1103": {
      "ad": "100 kVA yağlı tip trafo (6,3/0,4 kV, bakır sargılı)",
      "birim": "Ad",
      "malzeme": 232997.26,
      "montaj": 36822.50
    }
  }
}
```

Zorunlu alanlar: `meta.kaynak`, `meta.iscilikEkOrani`, `meta.kalemSayisi`,
ve her kalem için `ad`, `birim`, `malzeme`.

`meta.kaynak` = `seed-tedas-bfk` dışında herhangi bir değer olabilir; sayfa
uyarı bandını yalnızca tam olarak bu değerde gösterir. Gerçek listeyle
değiştirdiğinizde bant kendiliğinden kaybolur.

## Poz numaraları korunmalı

`poz` anahtarları motorun kapsam tanımına bağlıdır. Motor şu pozları arıyor:

| Poz | Kullanım yeri |
|---|---|
| `85.610.11xx` | yağlı trafo 6,3/0,4 |
| `85.610.13xx` | yağlı trafo 10,5/0,4 |
| `85.630.11xx` | hermetik trafo 6,3/0,4 |
| `85.630.13xx` | hermetik trafo 10,5/0,4 |
| `85.230.1101-1104` | trafo AG buşing izolasyon kapağı (kVA bandı) |
| `85.530.2401/2403` | OG koruma (12 kV / 36 kV) |
| `85.720.1301-1305` | AG ana dağıtım panosu (kVA) |
| `85.790.1202-1204` | topraklama |
| `85.105.2301/2302` | platform |
| `85.490.1201-1203` | kanal |
| `85.830.20xx`, `85.830.21xx` | OG kablo |
| `85.800.12xx`, `24xx-30xx` | AG kablo |
| `85.870.11xx-18xx` | pabuc ve ek manşonu |

Kendi numaralandırma sisteminiz varsa `web/motor.js` içindeki sabitleri
(`BUSING_KAPAGI`, `AG_PANO`, `OG_SIGORTA`, `PLATFORM`) ve arayıcıların
`poz.startsWith(...)` filtrelerini güncellemeniz gerekir.

## `ad` alanı yazarken

- Kendi cümlenizle yazın. TEDAŞ tarif kitabındaki açıklama cümlesini
  kopyalamayın (telif + gereksiz uzunluk).
- **Ayırt edici olsun.** Motor bazı kalemleri isimden okur:
  - trafo: `^(\d+) kVA` → kVA eşleşmesi bu sayıya bakar
  - OG kablo: `^OG kablo (\d+)×([\d,]+) mm² + (\d+)`
  - AG kablo: `^AG kablo (\d+)×([\d,]+) mm²`
  - pabuç/manşon: `^(Bakır|Alüminyum) kablo (pabucu|ek manşonu) ([\d,-]+) mm²`
- Kablo ve pabuçlarda **virgüllü** ondalık yazın (`1,5` değil `1.5` → `1,5`
  olur; yayım metninde virgül beklenir, motor sayıya çevirir).

## Eksik kalem davranışı

Bir kalem listede yoksa motor **hata vermez, atlamaz**; `eksikler` listesine
yazar ve arayüzde kırmızı kutu olarak gösterir. Trafo gücü listede yoksa en
yakın üst gücü kullanır ve bunu tespit olarak yazar.

Yani eksik kalem sessizce geçmez — ama kullanıcı gider görür.

## Doğrulama

Değiştirdikten sonra:

```bash
node tools/fiyat_kitabi_uret.mjs   # KENDI listenizi verirseniz bu script'i
                                    # güncellemeniz gerekir — şu an BFK okur
node tools/motor_test.mjs
node tools/arayuz_test.mjs
```

Fiyat listesini elle değiştirdiyseniz `web/fiyat_kitabi.json` kopyasını da
güncelleyin. Sunucu `web/` klasöründen servis yapar.

## Kâr marjı hakkında

Bu dosyaya **kâr yazmayın**. Motor `malzeme` ve `montaj` okur, `iscilikEkOrani`
ile işçiliği türetir, toplamı döndürür. Kâr teklif aşamasında eklenir.

Yazarsanız o rakam yayımlanır. Rakipleriniz liste fiyatlarını zaten biliyor;
yayımlanan iskontolu fiyattan sizin iskonto oranınızı, işçilik sütunundan
ekleme oranınızı, toplamdan maliyet tabanınızı hesaplayabilirler.