# İlkeler: görsel dil ve kararlar

Kaynak: `docs/13-cam-dili.md` bölüm 1, 2 ve 5 (14–15 Kas 2026, onaylı) ve `docs/moduller/ORTAK.md` bölüm 2 (Rutin oturumu, 13–14 Kas 2026). Değerler `src/core/ui/tokens.css`'tedir; burada token adlarıyla anılır.

## Görsel dil

- **Cam ortaktır, zemin değişir.** Paneller, şerit, düğmeler, liste satırları ve geçişler her ekranda aynı camdır: bulanık, yarı saydam koyu dolgu, ince açık kenar, üstte ışık çizgisi (`glass-*` sınıfları, `src/core/ui/kit/glass.css`). Zemin günün saatine göre gökyüzüdür; modül isterse kendi zeminini verir.
- **Renk tek başına anlam taşımaz.** Modülün ve bölümün rengi nokta, vurgu ve ilerleme çizgisinde kullanılır. Durumlar simge ve yazıyla birliktedir (`Status`).
- **Geçişler kesintisizdir.** Zemin aynıysa yalnızca paneller yer değiştirir; zemin değişiyorsa çapraz geçer (`--motion-slow`). Sıçrama, parlama, konfeti yok.
- **Ekranda tek opak açık öğe:** seçili sayfa ya da kartın birincil düğmesi (`color-light`). Kartta ya da panelde en çok bir birincil düğme olur.
- **Kesik kenar yapay zekanın koyduğu değerdir** (`border-edge-ai`, kesik); kullanıcı değiştirince düz olur.
- **Gökyüzü ilerlemeye değil saate bakar.** Hiçbir modül "adım ilerledikçe değişen zemin" kurmaz; ilerleme küçük bir çizgi dizisiyle gösterilir (`StepLines`).
- **Kendi zeminini veren modül** (aydınlık bir zemin) tonunu kendisi seçer; metin yine en az 4,5:1 okunur.
- **Metinler kısa ve düzdür;** ünlem, emoji, övgü yok. Kırmızı ve "gecikti" yok: "geride" sıcak mercandır (`color-behind`), alarm değil.

## Kararlar

| # | Konu | Karar (kullanıcı, 14–15 Kas 2026) |
| --- | --- | --- |
| 1 | Tema | **Tek renk sistemi:** her saatte koyu cam ve açık metin (`color-ink` üstünde `color-glass-*`). Açık / koyu / sistem seçeneği yoktur. Ayarlar → Görünüm'de "Saydamlığı azalt" (paneller düz ve opak, `color-solid`) ve "Hareketi azalt" (geçişler anlık, gökyüzü kıpırdamaz) durur; ikisi bu cihazın tercihidir ve kullanıcı dokunana kadar cihazın kendi erişilebilirlik tercihini izler (`src/core/ui/look/`). |
| 1b | Gökyüzü | Zemin yalnızca **günün saatine** bağlıdır: güneşin yüksekliği cihazda tarih, saat ve sabit koordinattan hesaplanır (varsayılan İstanbul). Hava durumu, konum izni ve dış servis yoktur (hava durumlu zemin "Fikirler"de). |
| 2 | Gökyüzü hangi ekranlarda | **Tam manzara** (güneş, yıldız, tepeler): Bugün, sahne, giriş ekranı. Öbür bütün ekranlar **sakin zemin**: aynı saatin gökyüzünün üst renkleri, ekran boyuna yayılmış; güneş, ay ve manzara yok. Uzun sayfada zemin sabit durur, içerik üstünden kayar. Rutin'in modül sayfası da sakin zemindedir. |
| 3 | Pano gün boyu açık | Gerçek bulanıklık yalnızca **altından içerik geçen yerde** (menü, alttan sayfa, yan panel, pencere, bildirim, sahne şeridi); durağan zeminin üstündeki panel panoda bulanıklıksız aynı görünüşte kurulur (telefonda, sayfa kayarken manzara arkasından geçtiği için bulanıktır). **İstisna (kullanıcının kararı, 15 Kas 2026; `docs/09-kararlar.md`):** panoda tam manzaranın (Bugün, giriş) üstündeki camlar da bulanıktır, çünkü arkalarında güneş ya da ay durabilir; bulanıksız camın ardında güneş keskin gri bir daire olarak görünüyordu (karelerde yumuşak ışıltı). Manzara dakikada bir değiştiği için bulanıklık ancak o zaman yeniden çizilir; sakin zeminde panolar yine bulanıksızdır. Panoda sürekli hareket yok (bulut kaymaz, yıldız titreşmez); gökyüzü dakikada bir güncellenir. Gece durumunda zemin karartılır (`color-night-dim`) ve ekranın uyumasına izin verilir. Kareler: `K3A` (olağan), `K3B` (saydamlık azaltılmış), `K3C` (gece). |
| 4 | Modüle özel zemin | Modül zemin verirse (`ui.backdrop`, `docs/06`) hem modül sayfasında hem sahnesinde kullanılır (Spor: siyah-yeşil); vermezse sakin zemin ve sahnenin tonu. Modüller listesinden girerken zemin çapraz solar. Çekirdek ekranlarında (Bugün, Takvim) modülün işi yalnızca renk noktasıyla görünür. Kare: `K4B`. |
| 5 | Yoğun ekranlar | Liste, tablo ve form sakin zeminde, daha dolu camda (`color-glass-dense`). Telefonda başlık `text-base`, ikincil yazı en az `text-sm`, satır en az `spacing-row`; ayırıcı `color-line`; sayılar hizalı rakam (`tabular-nums`). Panoda ikincil `text-note`, birincil `text-lead`–`text-lg`, "Şimdi" başlığı `text-now` ve üstü. |
| 6 | Bugün'ün üst satırı | Yalnızca "Bugün" ve tarih (panoda saatle). İlerleme, bitiş saati, uyanış ve yatış satırı, hayat modu ve bağlam seçici yok (Ç4a, Ç4c). |
| 7 | Sıradakiler | "Vakit kalırsa" yok; "Sıradakiler" günün kalan planıdır. "Bugün tamam" kartında düğme yok. |
| 8 | Günün 3 işi | Yok. Günaydın kartında "Günün işleri" satırı çizilmez; geri dönüş kartı sıradaki tek işi ve "Başla"yı gösterir. |

## Gökyüzü

Kod: `src/core/ui/sky/` (`sky.ts` saf hesap, `Landscape.tsx` tam manzara, `Backdrop.tsx` zemin). Kareler: "Gökyüzü" sayfası, üst sırada tam manzara, alt sırada aynı saatte sakin zemin (`Hava_safak`, `Hava_acik`, `Hava_batim`, `Hava_gece` ve `HavaSakin_*`).

- **Durumlar:** şafak, gündüz, gün batımı, gece. Aralar güneşin yüksekliğine göre yumuşak geçer; karelerin renkleri ölçü noktalarıdır (`--sky-*` token'ları). Sabah Rutin'in şafak kareleriyle doğar (güneş sağda), akşam gün batımı karesiyle batar (güneş solda).
- **Renk:** metin her saatte açıktır, paneller koyu camdır. Tam manzaranın üstündeki camlar (ana, yoğun, ikincil), arkalarında durabilecek herhangi bir renk (ufkun parlak bandı, açık bir tepe) metni, ikincil düğmenin ya da hapın yazısını 4,5:1'in altına düşürecek kadar parlaksa koyulaşır (yalnızca opaklığı büyür; `landscapeAlpha`). Tam manzarada panelsiz yazı ve düğme yalnızca koyu üst gökte durur; aşağıdakiler cama girer.
- **Sakin zemin** o saatin gökyüzünün üst renklerinin (yüksekliğin %0, 22, 42 ve 55'i) ekran boyuna yayılmış halidir.
- **Durumla saat:** kartın durumu gökyüzünü değiştirmez. "Günaydın" şafakta, "Akşam" gecede çizildi çünkü o saatlerde görünürler; aynı kart başka saatte o saatin gökyüzüyle durur.
- **Ay ve baykuş** çekirdeğin gece karelerinde yoktur; Rutin'in akşam sahnesinindir. Gece yıldızları telefonda hafifçe kıpırdar (panoda ve "Hareketi azalt" açıkken asla).

## Erişilebilirlik

- Metin ile zemin arasında en az **4,5:1**; gökyüzünün dört durumunda ölçülür (`src/core/ui/sky/sky.test.ts`, Rutin'in sahnesi `tests/unit/rutin-glass.test.ts`).
- Dokunma alanı en az **`spacing-touch`** (küçük düğme ve hap görünüşünden taşan dokunma alanıyla).
- Hareket ve saydamlık tercihleri her ekranda geçerlidir (`glass.css`).
- Renkli nokta ve çubuk camdan en az 3:1 ayrılır (`src/core/contract/colors.ts`, paletin on rengi).

## Gerçek cihazda bakılacaklar

Kareler masaüstü tarayıcıda çizilip bakıldı; şunlar gerçek telefonda ve panoda denenir (ayrıntılı adımlar `docs/ILERLEME.md` "Senden bekleyenler"de):

- Cam bulanıklığının iPhone'daki görünüşü ve kaydırma akıcılığı; panoda gün boyu yükü.
- Saat şeridi ve ada: içerik altına girmiyor, gökyüzü arkasına uzanıyor. Sayfa kayınca içerik saatin arkasından geçmez, şeridin altında solarak kaybolur (`ekranlar/menu.md`, "Saat şeridi ve ada"; tarayıcıda iPhone'un güvenli alanı verilerek denetlenir: `tests/e2e/safe-area.spec.ts`).
- Gündüz gökyüzünün açık ufkunda (ekranın alt yarısı) panelsiz yazıların okunurluğu.
- Zaman şeridinde telefonda dokunma: dar parçalara parmakla isabet (Ç4c).
- Kapanışın akşam sahnesinde kendiliğinden açılması; Rutin kapalıyken akşam kartındaki "Kapanış" (Ç4c).
- Telefonda alttan açılan sayfanın klavye açıkken davranışı (hızlı girişte kutu klavyenin üstünde kalmalı).
- Takvim'de yedi gün kutusunun küçük telefonda (375 px ve altı) sığması (Ç4c).
- Gece karartmasının panoda yeterli olup olmadığı.
- "Saydamlığı azalt" açıkken bütün ekranların görünüşü (yalnızca Bugün'ün pano karesi çizildi: `K3B`).
