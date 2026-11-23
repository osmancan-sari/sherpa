# Tasarım

Sherpa'nın görünüşünün tek kaynağı (kullanıcının kararı, 15 Kas 2026). Tasarım panolarda taslak olarak doğar ve onaylanır; onaylanan kareler buraya donmuş başvuru olarak girer. Kurulduktan sonra doğru olan **kod ve galeridir**. Üç yer vardır, hiçbiri öbürünü tekrar etmez:

| Ne | Nerede | Kural |
| --- | --- | --- |
| Değerler: renk, cam dolguları, kenar, gölge, köşe, boşluk, yazı boyları, süreler, gökyüzünün durakları | `src/core/ui/tokens.css` (TypeScript yansısı `tokens.gen.ts`, `npm run tokens`) | Bileşende, sayfada ve modülde sabit renk kodu ve keyfi piksel yazılmaz; denetimi `tests/unit/design-values.test.ts`. Dokümanlar değer yazmaz, token adını yazar. |
| Bileşenler | `src/core/ui/kit/` (modüller `@/core/ui/kit`'ten alır) | Galeri: uygulamada `/tasarim` (giriş korumalı, menüde yok; Ayarlar'ın sonunda bağlantı). Her parça ve her hali gerçek bileşenle, gökyüzünün dört durumunda ve sakin zeminde, "Saydamlığı azalt" ve "Hareketi azalt" anahtarlarıyla. Yeni parça önce kit'e ve galeriye girer, sonra kullanılır. |
| Kurallar ve düzenler | Bu klasör | Aşağıdaki dosyalar. |

## Dosyalar

- [`ilkeler.md`](ilkeler.md): görsel dil ve kararlar (tek renk sistemi, gökyüzü, pano kuralları, modülün zemini, yoğun ekranlar), gerçek cihazda bakılacaklar.
- [`parcalar.md`](parcalar.md): her ortak parça: kural, halleri, koddaki dosyası, token adları.
- [`ekranlar/`](ekranlar/): ekran başına bir dosya: düzen (telefon ve pano), durumlar, başvuru karelerinin adları.
  - [`menu.md`](ekranlar/menu.md): uygulamanın kabuğu, menü ve "+".
  - [`bugun.md`](ekranlar/bugun.md), [`takvim.md`](ekranlar/takvim.md), [`kapanis.md`](ekranlar/kapanis.md): içeriği değişen ekranlar (Ç4c).
  - [`gelen-kutusu.md`](ekranlar/gelen-kutusu.md), [`giris-ve-duzenleme.md`](ekranlar/giris-ve-duzenleme.md), [`moduller.md`](ekranlar/moduller.md), [`sahne.md`](ekranlar/sahne.md), [`ayarlar.md`](ekranlar/ayarlar.md), [`giris-ekranlari.md`](ekranlar/giris-ekranlari.md), [`bos-ve-hata.md`](ekranlar/bos-ve-hata.md): Ç4b.
  - [`rutin.md`](ekranlar/rutin.md): Rutin'in sahnesi ve modül sayfası.
  - [`okul-sahneler.md`](ekranlar/okul-sahneler.md), [`okul-sayfalar.md`](ekranlar/okul-sayfalar.md): Okul'un Bugün kartı, sahne yerleşimleri, blok görünümü ve modül sayfaları (onaylı 16–17 Kas 2026; henüz kurulmadı).
- [`kareler/`](kareler/): onaylı pano karelerinin kaynak dosyaları ve [`DIZIN.md`](kareler/DIZIN.md). **Donmuştur;** elle değiştirilmez. Modül kareleri alt klasördedir: [`kareler/okul/`](kareler/okul/).

## Çelişkide sıra

`ekranlar/<ekran>.md` > `parcalar.md` > `ilkeler.md` > `kareler/`. Kare başvurudur: dokümanla çelişirse doküman geçerlidir ve fark faz raporuna yazılır. Çizilmemiş bir ekran ya da durum en yakın kareden türetilir ve "görüşün gerek" diye işaretlenir.

## Görsel denetim

`tests/e2e/gorsel.spec.ts` galeriyi ve ana ekranları sabit saat ve sabit veriyle, telefon ve pano genişliğinde onaylı görüntülerle karşılaştırır (Playwright `toHaveScreenshot`; görüntüler testin yanında, `gorsel.spec.ts-snapshots/`). Görünüş istemeden değişince test kırılır. Onaylı görüntü yalnızca bilerek yenilenir (`npx playwright test gorsel --update-snapshots`) ve gerekçesi commit mesajına yazılır. `check:full`'un parçasıdır.

## Görünüşü değiştiren her iş

1. Önce oku: bu dosya, ilgili `ekranlar/<ekran>.md`, `parcalar.md`.
2. Değeri `tokens.css`'ten al; yoksa oraya ekle (ve `npm run tokens`).
3. Kit'te olmayan parçayı önce kit'e ekle, galeriye örneğini koy, `parcalar.md`'ye yaz; sonra kullan.
4. Ekranın telefon ve pano görüntüsünü al, başvuru karesiyle karşılaştır, farkı düzelt.
5. Commit'te: galeri güncel, ilgili doküman güncel, görsel testin onaylı görüntüsü bilerek yenilenmiş (gerekçesiyle).

Modüller aynı kit'i ve token'ları kullanır; kendi görsel dilini kurmaz, yalnızca kendi zeminini verebilir (`ilkeler.md`, karar 4; `docs/06-modul-sozlesmesi.md`, "Modülün zemini").

## Geçmiş

Çekirdek ekranları 14–15 Kas 2026'da ayrı bir tasarım oturumunda cam diliyle çizildi ve onaylandı (tuval: https://claude.ai/artifact/YDd1zPn8g5xJyxViNF2KeG, "Sherpa · Çekirdek ekranları"; Rutin'in tuvali `docs/moduller/rutin.md`'de). O oturumun dokümanı `docs/13-cam-dili.md` ve Rutin'in değerleri `docs/moduller/rutin-cizimler/degerler.md` Ç4b'de bu klasöre taşındı. Oturum içeriği de sadeleştirdi (hayat modu, elle bağlam seçimi, saatle gün bitişi, "Vakit kalırsa", günün 3 işi kalktı; Hafta "Takvim" oldu; kapanış Rutin'in akşam sahnesine taşındı): bunlar `docs/09-kararlar.md`'de 14–15 Kas satırlarıdır, Ç4a'da kuruldu; ekranları Ç4c'dedir.

Dışarıda bırakılanlar: `deneme` modülünün ekranları; modüllerin gövdeleri, sahnelerinin içi, giriş türlerinin alanları ve ayarları (modül tasarımında); alan sayfasının gerçek metrikleri (iki modül iki hafta kullanıldıktan sonra); hava durumlu zemin (`docs/09-kararlar.md` "Fikirler"); başka haftaya gidilmiş Takvim ve bazı ikincil haller (her ekran dosyasının sonunda "çizilmeyenler").
