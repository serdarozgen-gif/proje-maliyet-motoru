# 2026-10-15 — Kalibrasyon dosyası koruması (P0) ve bilerek ertelenenler

Tarih: 2026-10-15
Kapsam: `web/maliyet-motoru.js`, `tools/normlar_koruma_test.mjs` (yeni), `package.json`
Yedek: `D:\Atlasgrid\motor_YEDEK_20261015_030010`

---

## K1 — `normlar.json` zorunludur, motor onun yokluğuyla çalışmaz

**Karar.** `baslat()` artık `normlar.json` yüklenemezse hata fırlatır ve kullanıcıya
"hesap yapılamıyor" gösterir. `hesaplaVeCiz()` de `!normlar` durumunda çıkış yapar.

**Gerekçe (ölçülmüş).** `normlar.json` 404 olduğunda motor `motor.js:239`'daki
`kitap.meta.iscilikEkOrani` (0,35) yedeğine düşüyordu. 100 kVA örnek girdisinde:

| durum | toplam |
|---|---|
| normlar yüklü | 750.499,59 TL |
| normlar yok (eskiden) | 1.121.668,14 TL |
| **fark** | **−371.168,55 TL (%49,46)** |

Kaybolan sadece işçilik ek oranları değil. `normlar.iskontoOranlari.varsayilan`
(0,65) de aynı dosyada; farkın büyüklüğü bundan. Kullanıcıya **hiçbir uyarı
gösterilmiyordu** — yalnızca yanlış bir rakam basılıyordu.

Bu, `site_v3` incelemesinde bulunan "veri dosyası yoksa sessiz veri kaybı"
kusuruyla aynı sınıftır. O gün tespit edilip `site_v3`'te kapatılmış, burada
aynı desenin durduğu görüldü.

**Alternatifleri ve neden seçilmediği:**
- *Ölçülen oranları varsayılanlara yazmak (`kitap.meta` içine gömmek)* — reddedildi:
  kalibrasyon `normlar.json`'da yaşar, gömülürse tek doğruluk kaynağı kaybolur.
- *Kullanıcıya "kalibrasyon yok, düz oranla hesaplandı" deyip devam etmek* — reddedildi:
  rakam %49 kayar; rakamın yanına küçük harflerle "yaklaşık" yazmak, %49'luk
  hatayı meşrulaştırmak olur. Kullanıcı rakamı teklif kararında kullanıyor.

**Doğrulama.** `tools/normlar_koruma_test.mjs` — alt süreçte `normlar.json` isteği
404'e düşürülür, `maliyet-motoru.js` gerçekten çalıştırılır. 6 kontrol:
maliyet basılmıyor, hata kutusu ekleniyor, 404 sebebi geçiyor, `normlar.json`
adı geçiyor, yanlış başlık ("Fiyat listesi yüklenemedi") kullanılmıyor,
hesap düğmesi kilitleniyor.

**Not — neden ayrı dosya.** `arayuz_test.mjs` ESM modülünü bir kez içe aktarıyor;
ESM önbelleğe girdiği için aynı dosyada ikinci senaryo kurulamıyor. Ayrı dosya +
`npm test` zincirine eklenmesi bunun için.

---

## K2 — Uyarı bandındaki 1913/644 dağılımı **BİLEREK yapılmadı**

**Karar.** Uyarı bandı (`maliyet-motoru.js:246-254`) değiştirilmedi.

**Ölçülen durum.** 2557 kalemin dağılımı, kodun kendi tedarikçi testiyle
(`startsWith('Öznur'|'ASTOR')`, `tedarikci_uret.mjs:482` mantığı):

| kaynak | kalem | oran |
|---|---|---|
| Öznur | 1890 | %73,9 |
| ASTOR | 23 | %0,9 |
| TEDAŞ 2026 BFK referans | 644 | %25,2 |

Sınıflandırma 2557/2557 eksiksiz — hiçbir kalem "diğer" kategorisine düşmüyor.
`meta.kaynak: "tedarikci-net"` tek başına bu 644 kalemi saklıyor.

**Neden yapılmadı.** Kullanıcı kararı (2026-10-15): "Sadece P0'ı düzelt."

**Ertelendiği için bilinen durum.** Yayınlanan arayüzde 644 kalemin TEDAŞ referans
bedeli olduğu söylenmiyor; kullanıcı tüm kalemleri tedarikçi listesinden
hesaplanmış sanabilir. Bu metin **gerçeğe aykırı değil, eksik** — 1913 kalem
gerçekten tedarikçiden. Yanlış bilgi çıkan yer ise döviz kuru uyarısı: 644
kalem TL bedelli, kur uyarısı onları hiç kapsamıyor.

**Yarım bırakılmadı, iki nedenle:**
1. `meta.kaynak` bir **etiket**; tek kalemlik alan. Doğruyu söylemek için
   kitaptaki 2557 kalemin `kaynak` alanı taranmalı.
2. Sabit sayı yazılmamalı. `npm run build` fiyat kitabını yeniden üretir;
   yazılan sayı o gün yanlış olur. `tedarikci_uret.mjs` zaten dağılımı
   raporluyor (`:444`) — tek doğruluk kaynağı oradan okunmalı.

---

## K3 — `kitap.meta.iscilikEkOrani` ölü kod olarak bırakıldı

**Karar.** Dokunulmadı. Sadece not düşüldü.

**Durum.** `normlar.json` `iscilik.genelEkOran: 0.35` taşıdığı için
`motor.js:238-239`'daki `?? kitap.meta.iscilikEkOrani` dalı **hiç çalışmıyor**.
İki değer de 0,35 olduğu için davranış farkı yok — zararsız.

**Neden acil değil.** K1 sonrası bu dal normalde zaten devreye girmiyor; K1
sayesinde normlar yoksa motor hiç hesaplamıyor. Yani ölü kod **güvenli** ölü kod.

**İzlemede.** `normlar.json` yeniden üretildiğinde `genelEkOran` değişirse
bu yedek sessizce eskir. `Fiyat_listesi_rehberi.md:97` zaten
"`iscilikEkOrani`'a bir şey yazmayın" diyor; buradaki risk, alanın **güncel
tutulmaması**.

---

## Ölçüm disiplini notu

Bu oturumda yapılan ölçüm hataları (ürün hatası DEĞİL):

| hata | sonuç | düzeltme |
|---|---|---|
| `PSObject.Properties.Count` ile manifest sayımı | 53 yerine 1 raporlandı | `Get-Member -MemberType NoteProperty` kullanıldı; gerçek 53 |
| `npm test` çıktısı PowerShell'de bozuldu | "GEÇEN" regex'i tutmadı, 0 geçen göründü | Python ile ham UTF-8 bayttan sayıldı → 103 |
| Boş `<th>` dönüşümünde başlık/genişlik metriği | "sütunlar üst üste biner" denildi, ölçülmedi | iddia geri çekildi |

Son ikisi bu dosyaya yazıldı çünkü aynı hatalar tekrarlanıyor: PowerShell'in
Türkçe karakterleri konsola bozması, ve PowerShell koleksiyon `.Count`
özelliğinin `PSObject.Properties` üzerinde yanlış değer vermesi.