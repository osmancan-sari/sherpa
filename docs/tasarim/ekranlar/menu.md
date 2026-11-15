# Uygulamanın kabuğu ve menü

Kaynak: `docs/13-cam-dili.md` bölüm 1 ve 4.3 ("Menü"), `docs/moduller/ORTAK.md` bölüm 2 ("Telefonun alt menüsü"), Rutin değerleri bölüm 10; kareler: her ekran karesinin menüsü (ör. `MT1`, `MP1`). Kurulum Ç4b: `src/core/ui/AppNav.tsx`, `src/core/ui/QuickAdd.tsx` (`QuickAddButton`), `src/app/(app)/layout.tsx`.

## Telefon

- Altta, kenarlardan ve alttan boşlukla duran **cam alt menü** (`glass-nav`, yükseklik `spacing-nav`, tam yuvarlak) ve yanında ayrı, aynı camdan **"+" dairesi** (`spacing-nav`). Güvenli alanın üstünde durur.
- Beş öğe: Bugün, Takvim, Modüller, Gelen, Ayarlar (simge ve `text-nav` yazı; seçili olmayanlar `color-ink-nav`).
- **Seçili sayfa** öbürlerinden geniş, opak açık hap (`color-light`, `color-ink-dark`, yarı kalın, `shadow-selected`). Ekranda tek opak açık öğe seçili sayfadır.
- İçerik menünün altından geçer (menü bulanık cam); sayfanın sonunda menü kadar boşluk (`spacing-nav-space`).

## Pano

- Solda, kenarlardan boşlukla duran **cam yan menü** (`glass-rail`, genişlik `spacing-rail`, köşe `radius-rail`): üstte "Sherpa", altında Bugün, Takvim, Modüller, Gelen kutusu, Ayarlar (`text-sm`).
- Seçili sayfa opak açık (`color-light`, `color-ink-dark`, `shadow-selected-rail`, köşe `radius-step`).
- Hızlı giriş panoda menüde değildir; ekranların kendi "+ Yeni giriş" düğmeleri ve `N` kısayolu açar.

## Adlar

"Hafta" yerine **"Takvim"** (yalnızca ad; adres `/hafta` kalır, sayfanın içi Ç4c'de). Telefonda "Gelen kutusu" kısaltılır: "Gelen".

## Sayfa başlığı

Liste sayfalarında başlık `text-title` (panoda `text-3xl`), kalın, `tracking-title`; içerik telefonda `px-4`, panoda `px-10` iç boşlukla, panoda en çok `spacing-board` geniş.
