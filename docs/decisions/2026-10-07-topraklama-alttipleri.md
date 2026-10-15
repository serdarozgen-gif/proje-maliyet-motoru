# Topraklama alt tipleri (kazık / şerit) — 2026-10-07

## Sorun

`normlar.json` ölçüm notu: kazık 2000 TL/ad (BFK 1208 → oran 1.66),
şerit 300 TL/m (BFK 329 → oran 0.91). Tek `topraklama` tipi zıt yönlü
iki ölçümü temsil edemiyordu; 0.35 geçici oran ikisini de yanlışlıyordu.

## Eşleşme (BFK kataloğundan doğrulandı)

- Kazık/elektrot (Ad bazlı): 85.790.1203 (montaj 1208.27), 85.790.1204
  (montaj 1208.27). Oran 2000/1208.27 = 1.6555 ~ 1.66 → ek oran **+0.66**.
- Şerit/iletken (m bazlı): 85.790.1105, 85.790.1106 (montaj 329.14).
  Oran 300/329.14 = 0.9115 ~ 0.91 → ek oran **-0.09**.

## Uygulama

- `motor.js` `kalemTipi`: `85.790.11` → `topraklama-serit`,
  `85.790.12` → `topraklama-kazik`, diğer `85.790.*` → `topraklama`.
- `normlar.json` 0.2.0 → 0.2.1: iki yeni tip + ölçüm notları.
- `topraklama` (0.35) korundu: motor varsayılanı 85.790.1202 karışık
  düzen (köşebent + 5 m örgülü iletken, montaj 2853.96) — bu kalem için
  ÖLÇÜM YOK.
- KAPSAM'a 85.790.1105/1106 eklendi + yayım adları yazıldı. Bunlar
  önceden fiyat kitabında yoktu (şerit ölçümü motorun kullanamadığı
  pozdaydı).
- Testler: motor 9b (4 test).

## Test durumu

- `motor_test.mjs` — 48/48
- `arayuz_test.mjs` — 49/49