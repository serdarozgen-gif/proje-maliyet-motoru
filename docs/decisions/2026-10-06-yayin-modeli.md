# Karar — Yayın Modeli ve Motor Mimarisi

**Tarih:** 2026-10-06
**Kapsam:** Proje Yaklaşık Maliyet Motoru — ilk sürüm

## Karar

Ticari isim **"Proje Yaklaşık Maliyet Motoru"**.

Ziyaretçiye gösterilen tablo **müşteriye verilecek teklif fiyatı değildir** ve
"net maliyet" olarak sunulmaz. Tablonun iki sütun grubu:

| Sütun grubu | Kaynak | Yayımlanma |
|---|---|---|
| Malzeme | Atlasgrid'in kendi hazırladığı iskontolu fiyat listeleri | Görünür |
| İşçilik | TEDAŞ BFK `MONTAJ (TL)` sütunu + yapılandırılabilir % ekleme | Görünür |

Motor **tek iş tipiyle** başlar: **YG/AG trafo bağlantısı**.
Hesaplama **istemci tarafında** (tarayıcıda), indirme/lead talebi **sunucu tarafında** toplanır.

## Gerekçe

- TEDAŞ BFK `MALZEME`/`MONTAJ` sütunları sayısal bedeldir; yayımlanan tablo
  TEDAŞ kitabının bir kopyası değil, kendi fiyat listemiz + TEDAŞ işçilik
  referansından türetilmiş bir **yaklaşık maliyet** tablosudur.
- Trafo bağlantısı: kapsamı en dar, malzemesi en standart, BFK'ta poz karşılığı
  en net olan iş tipidir. İlk sürümde varsayım hatası en az olur.

## Telif — ne yapılacak / ne yapılmayacak

- **Yapılacak:** kalem tanımları kendi cümlelerimizle yazılacak.
- **Yapılmayacak:** `BirimFiyatTarifleriKitabi` metninin kopyalanması/yayımlanması.
  TEDAŞ Genel Teknik Şartnamesi'ne atıf yapılabilir, metni aktarılamaz.
- Yayımlanan poz numaraları ve birimler olgusal veridir; kullanılabilir.

## Sızıntı riski — kapatılan nokta

**Karar:** Motoru gerçek iç net maliyetlerle değil, **piyasa listesi × sektör
tipik iskontosu** ile besleyeceğiz.

Gerekçe: Öznur / HES / ASTOR listeleri piyasada açıktır. Yayımlanan malzeme
fiyatı gerçek tedarik iskontosu olursa, rakip liste karşılığında **Atlasgrid'in
tedarik iskontosunu doğrudan** hesaplar. Aynı şekilde işçilik sütunundan işçilik
ekleme oranı, toplamdan ise maliyet tabanı okunur. Üçü birlikte Atlasgrid'in
bidanı üzerindeki fiyat politikasını verir.

Bu nedenle:

- `data/fiyat_kitabi_ornek.json` içindeki `kaynak: "seed-tedas-bfk"` fiyatları
  **yalnızca geçici başlangıç değeridir** ve `UYARI` alanı taşır.
- Gerçek yayın öncesi bu dosya, Atlasgrid'in kendi fiyat listesinden
  (piyasa listesi × tipik iskonto) üretilmiş `fiyat_kitabi.json` ile değiştirilir.
- Kâr marjı **hiçbir zaman** yayımlanmaz; sadece teklif aşamasında uygulanır.

## Uygulanmayacaklar

- Google Ads / SEO bütçesi kararları bu kod tabanında tutulmaz; ayrı dosyada.
- Fiyat listesi haftalık otomatik güncellemesi ilk sürümde yok. Manuel
  güncelleme + sürüm damgası ile ilerlenir.

## Doğrulama durumu

- BFK 2026: **doğrulandı** — 6224 satır, 4773 fiyatlı kalem, 127 başlık.
  Kaynak: `D:\Atlasgrid\tedaş şartnameler\5 2026 Yılı TEDAŞ BFK.xlsx`
- TEDAŞ onayı: YK 18/02/2026, 15-274 sayılı karar (tarif kitabı genel kurallar md.6)
- ASTOR / Öznur / HES listeleri: **diskte yok** (teyitsiz — temin edilmeli)