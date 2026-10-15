# Trafo sargı malzemesi: alüminyum varsayılan — 2026-10-07

## Kullanıcı girdisi

"Uzun süredir güç trafoları alüminyum sargılı olarak seçilir."

## Doğrulama

`data/tedarikci_fiyatlari.json` içinde iki seri zaten vardı:

- `trafo.aPlus` — TEDAŞ MLZ 99/032-E (bakır sargılı)
- `trafo.aoAk` — "A Plus'tan %10 ucuz. **Alüminyum sargılı seçenek.**"

Motor bakır (A Plus) fiyatlıyordu; alüminyum yalnızca `not` alanındaydı.
Ölçüm dosyasında da trafo kalemi zaten "100 kVA trafo (AL sargılı)" olarak
kayıtlı (`data/olcum.json`) — kullanıcının cevabı dosyayla tutarlı.

## Kararlar (kullanıcı, 2026-10-07)

1. **Varsayılan alüminyum (AOAk).** 100 kVA: 168.809 TL → ~151.928 TL.
2. **Arayüzde sargı seçici yok** — tek fiyat. Kapsam büyütülmedi.
3. **İki ölçüm vakası da alüminyum.** Eski bakır fiyatıyla yapılan
   motor↔gerçek karşılaştırmaları %10 sapmalıydı; artık aynı bazda.

## Uygulama

- `tools/tedarikci_uret.mjs` trafo döngüsü AOAk birincil, A Plus not'ta.
- `kalemEkle`'ye `secenek.ad` override eklendi: fiyatlanan ürün BFK
  tanımından farklıysa (alüminyum fiyat, bakır poz) ad açıkça
  "alüminyum sargılı" yazılır. BFK bedelli (bakır fiyatlı) kalemler
  "bakır sargılı" kalır — doğru, çünkü bedel bakır bedeli.
- Montaj ek oranları etkilenmez (montaj BFK montajı üzerinden).