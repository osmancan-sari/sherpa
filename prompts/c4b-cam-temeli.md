# Ç4b: Cam temeli ve içeriği değişmeyen ekranlar

Claude Code'a yalnızca şunu yaz:

> `prompts/c4b-cam-temeli.md` dosyasını oku ve uygula.

Ön koşul: `c4a-tamam` etiketi ve `docs/tasarim/kareler/` klasöründe çizim kareleri.

---

## Görev

Uygulamanın görünüşünü cam diline geçir: tek renk sistemi, gökyüzü ve sakin zemin, ortak parçalar, form kabukları ve **içeriği değişmeyen** bütün ekranlar. Bugün, Takvim, kapanış ve alan sayfası Ç4c'dedir; bu fazda onlar yalnızca yeni temele (zemin, parçalar, menü) oturur, yerleşimleri değişmez. Bu oturumda yalnızca Ç4b yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir. Faz adı Ç4b, etiket `c4b-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c4b/`.

## Kaynaklar

- `docs/13-cam-dili.md`: **bağlayıcı tasarım.** Bölüm 1 (kararlar 1–5), 2 (gökyüzü), 3 (ortak parçalar), 4.4, 4.5, 4.7 (alan sayfası hariç), 4.8, 4.9, 4.10, 5 (gerçek cihazda bakılacaklar). `docs/05` ondan ayrıldığı yerde `docs/13` geçerlidir.
- `docs/tasarim/kareler/`: tuvalin karelerinin kaynak dosyaları (`<kare adı>.dc.html`; `docs/13`'teki kare adlarıyla) ve dizini. **Renk, ölçü, boşluk ve metinleri karelerden birebir al**; kareyi tarayıcıda açıp bakabilirsin. Bir ekranın karesi yoksa `docs/13`'teki "çizilmeyenler" kuralına göre en yakın kareden türet ve "görüşün gerek" diye işaretle. Tuvalin claude.ai bağlantısını açmaya çalışma; giriş ister. Klasör yoksa ya da boşsa **dur ve sor**: bu faz çizimsiz kurulmaz.
- `docs/moduller/ORTAK.md` bölüm 2–4; `docs/moduller/rutin-cizimler/degerler.md` (Rutin'in sahnesi ve modül sayfası; gökyüzünün değerleri).

## Tasarımın tek kaynağı (kullanıcının kararı, 15 Kas 2026; bu fazın ilk işi ve omurgası)

Tasarım bundan sonra panolarda değil depoda yaşar. Panolar taslak ve onay aşamasıdır; onaylanan kareler depoya donmuş başvuru olarak girer, kurulduktan sonra doğru olan kod ve galeridir. Üç yer, hiçbiri tekrar etmez:

1. **Değerler kodda, tek yerde:** `src/core/ui/tokens.css` (Tailwind 4 tema değişkenleri): renk, cam dolguları, kenar, gölge, köşe, boşluk, yazı boyları, süreler, gökyüzünün durakları. Bileşende, sayfada ve modülde sabit renk kodu ve keyfi piksel değeri olmaz; bunu denetleyen bir lint kuralı ya da test yaz (çizim verisi taşıyan SVG'ler ve `tokens.css` hariç). Dokümanlar değer yazmaz, token adını yazar.
2. **Bileşenler kodda:** ortak parçalar `src/core/ui/kit/` altında. Uygulamanın içinde bir **galeri** sayfası (`/tasarim`, giriş korumalı, menüde yok; Ayarlar'ın sonunda bağlantısı): her parça ve her hali gerçek bileşenle, gökyüzünün dört durumunda ve sakin zeminde, "Saydamlığı azalt" ve "Hareketi azalt" anahtarlarıyla. Yeni parça önce kit'e ve galeriye girer, sonra kullanılır.
3. **Kurallar ve düzenler depoda:** `docs/tasarim/`:
   - `README.md`: dizin ve çelişkide sıra (`ekranlar/<ekran>.md` > `parcalar.md` > `ilkeler.md` > `kareler/`).
   - `ilkeler.md`: görsel dil ve kararlar (`docs/13` bölüm 1–2 ve 5, `ORTAK.md` bölüm 2).
   - `parcalar.md`: her ortak parça: kural, halleri, koddaki dosyası, token adları (`docs/13` bölüm 3).
   - `ekranlar/`: ekran başına bir dosya: düzen (telefon ve pano), durumlar, başvuru karelerinin adları (`docs/13` bölüm 4; Rutin'in sahnesi ve modül sayfası `docs/moduller/rutin-cizimler/degerler.md`'den).
   - `kareler/`: onaylı pano karelerinin kaynak dosyaları ve `DIZIN.md` (donmuş; elle değiştirilmez).
   `docs/13-cam-dili.md` ve `degerler.md` bu yapıya taşınır; eski dosyalarda yalnızca yeni yeri gösteren tek satır kalır. `docs/05` davranışı anlatmaya devam eder, görünüş için `docs/tasarim/`'i gösterir. `ORTAK.md` bölüm 2–4 `docs/tasarim/`'e bağlanır (kural iki yerde yazmaz).

**Görsel denetim.** `tests/e2e/gorsel.spec.ts`: galeri ve ana ekranlar için onaylı görüntüler depoda (Playwright `toHaveScreenshot`; sabit saat, sabit veri, telefon ve pano). Görünüş istemeden değişince test kırılır; onaylı görüntü yalnızca bilerek yenilenir. `check:full`'a girer.

**`CLAUDE.md`'ye "Tasarım" bölümü ekle** (aynen, gerekirse yolları düzelterek):

- Görünüşle ilgili her işten önce oku: `docs/tasarim/README.md`, ilgili `ekranlar/<ekran>.md`, `parcalar.md`.
- Değer yazma: renk, boşluk, köşe, yazı boyu yalnızca `src/core/ui/tokens.css` içinden gelir; sabit renk kodu ve keyfi piksel yasaktır (denetimi var).
- Yeni bileşenden önce kit'e bak. Kit'te yoksa önce kit'e ekle, galeriye örneğini koy, `parcalar.md`'ye yaz; sonra kullan.
- Modüller aynı kit'i ve token'ları kullanır; kendi görsel dilini kurmaz (kendi zemini hariç).
- Çelişkide sıra: `ekranlar/<ekran>.md` > `parcalar.md` > `ilkeler.md` > `kareler/`. Kare başvurudur; dokümanla çelişirse doküman geçerlidir ve fark rapora yazılır.
- Çizilmemiş ekran ya da durum: en yakın kareden türet, "görüşün gerek" diye işaretle.
- Görünüşü değiştiren her commit: galeri güncel, ilgili doküman güncel, görsel testin onaylı görüntüsü bilerek yenilenmiş (gerekçesi commit mesajında).
- Her ekranın telefon ve pano görüntüsünü al, başvuru karesiyle karşılaştır, farkı düzelt.

`prompts/BASLA.md` ("Önce oku" ve "Doğrulama düzeni") ve `prompts/denetci.md` bu kuralları ve görsel testi içerecek şekilde güncellenir.

## Kapsam

1. **Tek renk sistemi.** Açık / koyu / sistem tema seçimi kalkar; her saatte koyu cam ve açık metin. Ayarlar → Görünüm: "Saydamlığı azalt" ve "Hareketi azalt" (cihazın kendi tercihini de izler).
2. **Gökyüzü ve sakin zemin çekirdekte.** Rutin'in gökyüzü bileşeni çekirdeğe taşınır (güneşin yüksekliği saf fonksiyon, şimdiki zaman parametre); tam manzara Bugün, sahne ve girişte, sakin zemin öbür bütün ekranlarda. Rutin kendi kopyasını bırakır ve çekirdeğinkini giydirir (güneş, ay, baykuş kendisinde kalır). Modüle özel zemin sözleşmesi (karar 4). Pano kuralları (karar 3): gerçek bulanıklık yalnızca altından içerik geçen yerde, sürekli hareket yok, gece karartması.
3. **Ortak parçalar** (`docs/13` bölüm 3; kit ve galeri): paneller, liste satırı, düğme türleri, alan, anahtar, parçalı seçim, hap, durum, sekme, ilerleme, uyarı satırı, bildirim, pencere. Kartta en çok bir birincil düğme. Modüller aynı parçaları kullanır (`deneme` örnekleri güncellenir).
4. **Kabuklar.** Form ve düzenleme: telefonda alttan açılan sayfa, panoda sağdan 440 px yan panel. Menü: telefonda cam alt menü ve ayrı "+" (seçili sayfa opak açık hap), panoda cam yan menü; "Hafta" yerine "Takvim" (yalnızca ad; sayfanın içi Ç4c'de).
5. **Ekranlar:** Gelen kutusu (4.4); hızlı giriş ve düzenleme, Zaman bölümü, yapay zekanın koyduğu değerin kesik kenarı (4.5); Modüller, modül sayfası iskeleti, sahne kabuğu ve üç tonu (4.7); Ayarlar'ın bölüm listesi ve bölüm sayfaları (4.8); giriş ekranları (4.9); boş ve hata durumları, "bağlantı yok" hapı (4.10).
6. **Rutin'in modül sayfası** cam diline ve sakin zemine geçer (`degerler.md` bölüm 8; Rutin 3. adımın görünüş kısmı). Düzenlilik bu fazda kurulmaz (Rutin 2).

## Kurallar

- **İçerik ve davranış değişmez.** Yeni özellik yok; metinler koddaki gibi, yenileri `docs/13`'teki gibi.
- **Karşıtlık ve erişilebilirlik:** metin ile zemin en az 4,5:1 (ölçümle, gökyüzünün dört durumunda); dokunma alanı en az 44 px; hareket ve saydamlık tercihleri her ekranda.
- **Başarım:** panoda bulanıklık yükünü ölç (uzun süre açık sayfada kare hızı ya da işlemci); sonucu rapora yaz.
- **Görüntüler:** her ekranın telefon ve pano görüntüsünü al, ilgili kareyle yan yana karşılaştır, farkı düzelt. Karşılaştırmayı rapora ekran ekran yaz ("aynı", "fark: …").
- **Kabul ölçütleri:** `docs/13` bölüm 5'in gerçek cihaz denetimleri "Senden bekleyenler"e adım adım yazılır.
- Kurulan her ekranda `docs/05`'i `docs/13`'e göre güncelle; iki doküman ayrışık kalmasın.
- **Denetçi:** temel (1–4) bitince adım kipinde; sonunda faz kipinde.

## Yayın ve sonunda

Önceki fazlardaki gibi (izin bu sohbette). Rapor; "Sıradaki adım": Ç4c (`prompts/c4c-bugun-takvim-kapanis.md`).
