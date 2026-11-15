# Sahne kabuğu

Kaynak: `docs/13-cam-dili.md` bölüm 4.7 ("Sahne kabuğu"; kareler `MS1`–`MS3`, `MSP1`–`MSP3`; onaylı 15 Kas 2026). Kurulum Ç4b: `src/core/ui/today/Scene.tsx` (`SceneFrame`), zeminin seçimi `src/core/ui/sky/moduleBackdrop.ts`. İçi modülündür (Rutin'inki: `rutin.md`).

## Düzen

- **Telefon:** sahne ekranı kaplar; alt menü ve "+" altında kalır. Şerit en üstte, kenardan kenara: yükseklik `spacing-strip`, `color-scene-strip-night` dolgu, `blur-strip`, altında `color-line` çizgi, yazı `text-sm`.
- **Pano:** sahne sayfanın içindedir, yan menü görünür kalır; şerit cam hap (`radius-rail`, `color-scene-strip`, kenar `color-edge-strip`, yazı `text-note`).
- **Şeridin içeriği:** saat (orta kalın, hizalı rakam), işin renginde nokta, ad (yarı kalın; sığmazsa kesilir), "· n dk" (ikincil), sağda "Çık" (yarı kalın, en az `spacing-touch`). Sahne şeridi kendisi verebilir ya da gizleyebilir (`SceneProps.strip`, `docs/06`).

## Zemin: tonlar

| Ton | Zemin | Kare |
| --- | --- | --- |
| `calm` (sakin) | Saatin tam manzarası | `MS1`, `MSP1` |
| `focus` (odak) | Koyu ve düz: `color-focus-tone` | `MS2`, `MSP2` |
| `energy` (enerji) | İşin renginden `color-energy-base`'e dikey geçiş | `MS3`, `MSP3` |

Ton bölümden, yoksa sahnenin `look.tone`'undan gelir (`docs/06`, "Bölümler" kural 6). Modül kendi zeminini verirse (`ui.backdrop`) ton yerine o kullanılır. Panoda zemin sayfanın zeminidir (menü üstünde cam kalır); telefonda sahne kendi zeminini taşır.

## Durumlar

- Şerit gizliyse (sahnenin isteği ya da yatış sonrası) sahne en üstten başlar.
- Sahne açılamazsa çekirdeğin standart kartı döner (Bugün, `bugun.md`).
- Akşam kapanışı sahnenin içinde açılır (`kapanis.md`).

## Modül sahnesinin ortak düzeni

Kaynak: `docs/moduller/ORTAK.md` bölüm 3 (Rutin oturumu, 13–14 Kas 2026). Modülün sahnesi bu düzene uyar; değerler token'lardır (`rutin.md`).

- **Düzen:** üstte cam şerit (saat, bölümün rengi ve adı, geçen süre, "Çık"); başlık ve varsa büyük sayaç; "Bu adımda" paneli; küçük "Sıradaki" paneli; altta ana düğme, "Atla", "Hepsini yaptım".
- **"Bu adımda" paneli** adımın alt adımlarını numaralı gösterir, en çok üç satır; alt adım bittikçe liste yukarı kayar.
- **Küçük panel** sıradaki adımı, "bu sabah 3 / 7" gibi sayıyı ve çizgileri gösterir; son adımda günün sıradaki işini ("Sonra: 10:30 …").
- **Son adımda ana düğme "Bitti"dir.**
- **Süreli alt adım** süresi bitince kendiliğinden sıradakine geçer ve adını söyler. "Süre dolmadan geçme" açıksa (varsayılan) ana düğme süre boyunca soluk "Erken geç · basılı tut" olur. Süresiz alt adım dokunuş bekler.
- **Açılış ve kapanış tek yazıdır:** "Günaydın" → "Kalktım"; bitince "İyi günler"; akşam "İyi geceler". Sayı, süre, övgü yazılmaz; yazı solarken sonraki ekran belirir.
- **Sahne her cihazda aynıdır;** pano ve telefon düzeni ayrı çizilir.

## Çizilmeyenler

Sahnenin içi (modülündür). `deneme`'nin sahneleri `deneme`'nin kendi zemininde durur; tonların örneği galeridedir (`/tasarim`, "Sahne tonları").
