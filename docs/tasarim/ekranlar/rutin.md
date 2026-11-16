# Rutin: sahne ve modül sayfası

Kaynak: Rutin tuvali (`docs/moduller/rutin.md`'nin başındaki bağlantı; onaylı 13–14 Kas 2026). Rutin'in kareleri depoda değildir; karelerden birebir okunan değerler donmuş başvuru olarak `../kareler/rutin-degerler.md`'dedir. Kurulan kısımların değerleri `src/core/ui/tokens.css`'tedir; bu dosya kuralları token adlarıyla anlatır. Davranış ve içerik: `docs/moduller/rutin.md`.

Kod: sahne `src/modules/rutin/components/RutinScene.tsx`, gökyüzü `RutinSky.tsx` (çekirdeğin `Landscape`'i), cam tonları `src/modules/rutin/look.ts`, modül sayfası `StepsTab.tsx` (çekirdeğin iskeletinde, `moduller.md`).

## Gökyüzü

- Sahne çekirdeğin tam manzarasında durur (`ilkeler.md`, "Gökyüzü"). Sabah sahnesi saatin gökyüzündedir; **akşam sahnesi her saatte gecededir** (yıldızlar baştan).
- Rutin manzarayı kendi figürleriyle giydirir: akşam sağda ufka yakın **ay** (yeri ve evresi hesaplanmaz), solda dalında **baykuş** ("İyi geceler"de gözleri kapalı); akşam çekirdeğin güneşi kapalıdır. Renkler `--sky-moon*`, `--sky-owl*`; çizim verisi `RutinSky.tsx`.
- Telefonda düğmelerin arkasında alt karartma vardır (şafak ve gündüz; `--sky-shade`).

## Sahnenin camı: iki ton

Sabah şafağın sıcak camı (`--color-warm-*`), akşam gecenin serin camı (`--color-cool-*`).

| Parça | Sabah | Akşam |
| --- | --- | --- |
| Metin; ikincil; alt satır; açıklama | `warm-ink`, `warm-ink-2`, `warm-line`, `warm-note` | `cool-ink`, `cool-ink-2` (şeritte `cool-strip`), `cool-line` |
| "Bu adımda" paneli | `warm-panel`, kenar `scene-edge`, `shadow-warm-panel`, köşe `radius-scene` | `cool-panel`, `scene-edge-night`, `shadow-cool-panel` |
| "Sıradaki" paneli | `warm-small`, `scene-small-edge`, `shadow-warm-small`, `radius-soft` | `cool-small`, `scene-small-edge-night`, `shadow-cool-small` |
| Vurgu (dolu çember, ilerleme çizgisi) | `warm-accent`, içinde `warm-on-accent` | `cool-accent`, `cool-on-accent` |
| Etkin alt adım satırı | `warm-active`, `shadow-scene-active` | `cool-active` |
| Ana düğme | `warm-button`, yazı `warm-on-button`, `shadow-scene-button` | `cool-button`, `cool-on-accent`, `shadow-scene-button-night` |
| "Erken geç · basılı tut" | `warm-early`, kenar `edge-pressed` | `cool-early` |
| "Atla" | `scene-skip`, kenar `edge-button`, `blur-skip` | `scene-skip-night` |
| "Hepsini yaptım" | `warm-plain` | `cool-plain` |
| "Saydamlığı azalt" | paneller `warm-solid` | `cool-solid` |

Panellerin opaklığı, arkasındaki gökyüzü metni 4,5:1'in altına düşürecek kadar parlarsa büyür (gün doğumunda ve gündüz; `glassAlpha`). Ölçüm: `tests/unit/rutin-glass.test.ts`.

**Yazı:** başlık `text-scene` (panoda `text-board-title`), sayaç `text-counter` (kısa ekranda `text-counter-sm` / `-xs`, panoda `text-counter-board`), "Günaydın" ve "İyi günler" `text-greet`, "İyi geceler" `text-5xl`; panel etiketleri `text-xs` `tracking-label`.

## Düzen

- **Telefon:** şerit (çekirdeğin, `sahne.md`), başlık bölgesi (başlık; sayaç ya da açıklama; sabahın ilk bloğunda ses satırı), "Bu adımda" (en çok üç satır), "Sıradaki" (sayı ve çizgiler, "Sonra: …"), altta ana düğme, "Atla" ve "Hepsini yaptım". Ufuk ekranın yaklaşık %73'ündedir: kısa ekranda başlık ve paneller küçülür, manzara küçülmez.
- **Pano:** iki sütun (5:4). Solda başlık, sayaç ya da açıklama, "Bu adımda"; sağda "Günün planı" (sabah; "Tekrar anlat") ya da "Yarın" (akşam) ve dizinin paneli ("Bu sabah n / m"); altta sola yaslı düğmeler. Panoda çizilmeyen ekranlar (Günaydın, sayaçsız adım, son adım, "İyi günler", "İyi geceler") aynı parçalarla kurulur: **görüşün gerek**.
- **Açılış ve kapanış:** "Günaydın" ve tarih, "Kalktım"; son adımda sabah "Bitti", akşam "Işık kapalı." ve "Yatıyorum"; ardından "İyi günler" (solarak Bugün'e geçer) ya da "İyi geceler" ("YARIN" paneli, "Yatış … kaydedildi. Ekran birazdan kararır.", "Geri al"; ekran bir süre sonra `color-blackout` ile kararır).

Ekranların içeriği ve akışı `docs/moduller/rutin.md` (8.2–8.6) ve `../kareler/rutin-degerler.md` bölüm 3–7'dedir.

## Karşılama (sabah açılışı, 16 Kas 2026; **görüşün gerek**)

Onaylı karesi yoktur; sabah sahnesinin ilk karesinden ("Günaydın") türetildi. Ne zaman geldiği `docs/06-modul-sozlesmesi.md` "Sahne" kural 7'de, akışı `docs/moduller/rutin.md` 8.3'te. Kod: `RutinWelcome` (`src/modules/rutin/components/RutinScene.tsx`); kabuk çekirdeğin (`src/core/ui/today/Welcome.tsx`).

- **Zemin ve dil:** sabah sahnesinin gökyüzü (saatin gökyüzü, `RutinSky`; baykuş ve ay yok), metin `warm-ink`. Şerit yoktur (oturum yok); güvenli alan sahnedeki gibidir: telefonda içerik saatin ve adanın altından başlar, gökyüzü arkasına uzanır (`menu.md`, "Saat şeridi ve ada").
- **Düzen:** ortada "Günaydın" (`text-greet`, `tracking-greet`) ve altında tarih (`text-lead`, `warm-date`); "Günaydın" telefonda Günaydın ekranıyla aynı yükseklikte, panoda da öyle. Altta tam genişlikte (en çok `max-w-md`) ana düğme "Başla" (ana düğmenin sabah camı, `text-heading`, yükseklik 16). Hemen altında sessiz yazı düğmeleri (`warm-plain`, `text-note`, en az 44 px): "Biraz önce uyandım" ve "Şimdi değil"; "Biraz önce uyandım"a dokununca yerini "15 dk önce", "30 dk önce", "60 dk önce" alır. Uyanış dışarıdan kayıtlıysa "Biraz önce uyandım" yoktur.
- **Pano:** aynı parçalar, yan menü görünür; "Günaydın" Günaydın ekranının panodaki yerinde, düğmeler ortada. Panoda "Günün planı" paneli yoktur (karşılamada konuşulmaz, özet "Başla"dan sonra sahnede okunur).
- **"Başla"dan sonra:** düğmeler soluklaşır (tekrar dokunulmasın), sahne gelince yerini Diş bakımı alır.
- Ayrımlar (görüşün gerek): ikincillerin ana düğmenin altında tek satır sessiz yazı olması; karşılamada günün özetinin yazılı da olmaması; panoda ek panel olmaması.

## Modül sayfası

Çekirdeğin iskeletindedir (`moduller.md`), **sakin zeminde** (karar 2). Başlığın sağında "Adım ekle"; "Bu hafta" sayıları; "Yaklaşanlar"; sekmeler "Sabah" ve "Akşam" ve geçmiş düğmesi (Rutin'in geçmiş görünümü "Düzenlilik" Rutin 2'dedir; o zamana kadar düğme "Geçmiş").

- **Adım listesi:** blok başına yoğun panel; blok başlığında bölümün renginde nokta, büyük harfli etiket (`panel-label`) ve sağda özet ("uyanışta · toplam 4 dk"). Özet etiketin yanına sığmazsa kesilmez, alt satıra iner (etiketin hizasında, bütün olarak; telefonda "hareketlerden sonra · toplam 40 dk"). Satır: tutamaç, sıra no, ad (yarı kalın), alt satır, varsa "temel" etiketi (sabah `warm-tag`/`warm-tag-edge`/`warm-tag-ink`, akşam `cool-tag`/`cool-tag-edge`/`cool-label`), sağda anahtar (`Switch`). Ek adım girintili ve "+" ile; kapalı adım soluk. Başka modülün işi anahtarsız, sağında "Spor ›".
- **Akşamın altında** küçük panel: "YATAKTA · KAYDEDİLMEZ" ve `Işık kapalı. "Yatıyorum"dan sonraki ekranda hatırlatılır.`
- **Adımı düzenle / Adım ekle:** kit'in `Sheet`'i: telefonda alttan açılan sayfa, panoda sağdan yan panel. Başlık "Adımı düzenle" ("Adım ekle"), altında "SABAH · ADIM 1"; ad alanı; ayar grubu (süre ve "Kaç günde bir" kit'in sayacıyla, `Stepper` küçük boy: `size-8` daireler, dokunma alanı `spacing-touch`; sıklık ve "Nereye" `Segmented`; "Sırası" ve "Şunun eki" `Select`; "Temel adım" ve "Açık" `Switch`); "ALT ADIMLAR" (süre hapı `Chip`, süresizse kesik çizgili); alt satırda solda "Adımı sil", sağda "Vazgeç" ve birincil "Kaydet" ("Ekle").
  - **Karar (kullanıcı, 15 Kas 2026): "Adımı sil" ve "Vazgeç" kit'in alt satırında kalır.** Düzenleme sayfalarının ortak kuralı budur (`giris-ve-duzenleme.md`, "Kabuk"; eski `docs/13` 4.5): alt satırda solda ek eylem, sağda "Vazgeç" ve birincil. Rutin karesinde bu iki eylem baş satırında, "Kaydet" altta tam genişlikteydi (`../kareler/rutin-degerler.md` bölüm 8); kare bu noktada geçerli değildir.
- **Alt adımın süresi:** pencere (`Window`'un camı): süre (`Stepper`), "Sayaç göster", "Süre dolmadan geçme", not; "Süreyi kaldır" (ikincil) ve "Tamam".
- **Silme onayı:** pencere (`Window`): başlık "Adımı sil", "… silinsin mi?"; tek satırda "Vazgeç", "Kapat" (ikincil) ve "Sil" (tehlike).

Düzenlilik (Rutin 2) henüz kurulmadı: değerleri `../kareler/rutin-degerler.md` bölüm 9'dadır; kurulurken token'lara alınır.
