# Karar — İlk Uygulama Kapsamı ve Teknik Yapı

**Tarih:** 2026-10-06
**İlgili:** [2026-10-06-yayin-modeli.md](./2026-10-06-yayin-modeli.md)

## Kararlar

1. **Kapsam:** Yalnızca YG/AG trafo bağlantısı. Havai hat ve yeraltı kablo
   hattı kapsam dışı bırakıldı.
2. **Hesaplama:** Tarayıcıda (istemci tarafı). Sunucu yok. Fiyat listesi
   statik JSON olarak servis edilir.
3. **Veri akışı:** Proje teknik girdileri sunucuya gitmez. Kişisel veri
   yalnızca talep formunda, kullanıcı gönderirse toplanır.

## Gerekçe

- Trafo bağlantısı: kapsamı en dar, malzemesi en standart iş tipi. BFK'ta
  poz karşılığı net. İlk sürümde varsayım hatası en az olur.
- İstemci tarafı hesap: sunucu maliyeti ve bakım yükü yok, KVKK yüzeyi küçük
  (teknik veri hiç dışarı çıkmıyor). Maliyet listesi haftalık güncellenecekse
  JSON'u yeniden yüklemek yeterli.
- Fiyat kitabı arayüzden okunabilir olmak zorunda (statik barındırma). Bu
  kabul, `docs/decisions/2026-10-06-yayin-modeli.md`'deki yayım kararıyla
  birlikte okunmalıdır: **yayımlanan bedeller, gerçek iç net maliyetiniz
  olmamalıdır.**

## Uygulama sırasında doğrulanan kararlar

**Poz eşleşme yaklaşımı — kabul edildi.** Motor pozları poz numarasından
bulur, isimden kVA/kesit çıkarır. Statik tablolarla eşleştirmek yerine bu
yaklaşım seçildi çünkü BFK'ta aynı teknik imzaya sahip birden fazla kalem
var (örn. `3×240 mm²` için 85.830.2020 ve 85.830.2109).

**Belirsizlikte ilkini seç ve yaz — kabul edildi.** Motor sessizce seçmez:
birden fazla kalem eşleşirse ilkini kullanır ve tespit listesine yazar.
Kullanıcı arayüzde bunu görür. Alternatif olan (seçim yapmadan durmak) MVP'yi
kullanılamaz hale getirecekti.

**Yayım adı zorunluluğu — kabul edildi.** `fiyat_kitabi_uret.mjs`, her kalem
için `ad` bulunamazsa dosyayı **yazmayı reddeder** ve listeler. Böylece TEDAŞ
tarif kitabı metni yanlışlıkla yayımlanamaz. Bu koruma gerçekten çalıştı:
ilk çalıştırmada 35 kalemin adı çözülemedi ve dosya yazılmadı.

**Test taklidi — kabul edildi.** Tarayıcı bağlantısı olmadığı için
`tools/arayuz_test.mjs`, `document`/`fetch` taklidiyle `maliyet-motoru.js`
dosyasını gerçekten çalıştırır. Bu, sözdizimi kontrolünden güçlüdür: DOM ile
motor arasındaki bağlantı hatalarını (yanlış id, seçilmemiş alan) yakalar.
İlk koşuda 21 kontrol kırmızıydı; 3'ü gerçek uygulama hatasıydı
(`Object.entries(kitap)` yanlış nesneyi geziyordu; `tabloBas` çok kalemli
bloklarda ilk kalemin adını basmıyordu; CSS dosya adı HTML ile eşleşmiyordu).

## Uygulanmayacaklar / bilinçli eksikler

- **Metraj otomasyonu yok.** Miktarı kullanıcı metre/adet verir. DXF'ten
  otomatik metraj ayrı bir iş kalemi; prototip notundaki Aşama 3 kapsamında.
- **Kanal kazı/hafriyat ve yol kaplama onarımı kapsam dışı.** BFK'ta ayrı
  kalemler (85.890.x). Trafo bağlantısının gerçek maliyetinde önemli
  olabilir; ayrı karar gerekir.
- **Platform tipi doğrulanmadı.** PL-250 / PL-400 seçimi kVA bandından
  öneriliyor ve tespit olarak yazılıyor. Proje bazında doğrulanmalı.
- **AG sigorta grubu bandı yok.** 85.720.130x yalnızca 50-400 kVA. Üstü için
  motor kalem üretmez, tespit yazar.

## Doğrulama durumu

| Test | Sonuç |
|---|---|
| `tools/motor_test.mjs` | 26/26 geçti |
| `tools/arayuz_test.mjs` | 30/30 geçti |

Katalog: 6224 satır → 4773 kalem, 0 bozuk poz, 0 gruplanmamış kalem
(`tools/bfk_katalog.mjs`).
Fiyat kitabı: 543 kalem, 0 adı atlanmış (`tools/fiyat_kitabi_uret.mjs`).

**Tarayıcıda görsel doğrulama yapılamadı** — oturuma masaüstü tarayıcısı
bağlı değildi. Sunucu 5 dosyanın hepsini 200 ile servis etti; arayüz
mantığı DOM taklidiyle doğrulandı. Görsel kontrol yapılmamıştır.

## Bilinmeyenler (teyitsiz)

- ASTOR / Öznur / HES listeleri diskte yok. Trafo bedelleri şu an BFK'tan
  geliyor; bu "Atlasgrid alış fiyatı" değildir.
- `85.830.2020` ile `85.830.2109` arasındaki teknik fark (varsayım: farklı
  yalıtım/ekran sınıfı) tarif kitabından doğrulanmadı.
- `iscilikEkOrani = 0,35` şimdilik makul bir başlangıç varsayımıdır;
  gerçek oran iş kırılım çalışmasıyla belirlenmeli.