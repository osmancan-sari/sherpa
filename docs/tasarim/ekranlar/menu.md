# Uygulamanın kabuğu ve menü

Kaynak: `docs/13-cam-dili.md` bölüm 1 ve 4.3 ("Menü"), `docs/moduller/ORTAK.md` bölüm 2 ("Telefonun alt menüsü"), Rutin değerleri bölüm 10; kareler: her ekran karesinin menüsü (ör. `MT1`, `MP1`). Kurulum Ç4b: `src/core/ui/AppNav.tsx`, `src/core/ui/QuickAdd.tsx` (`QuickAddButton`), `src/app/(app)/layout.tsx`.

## Telefon

- Altta, kenarlardan ve alttan boşlukla duran **cam alt menü** (`glass-nav`, yükseklik `spacing-nav`, tam yuvarlak) ve yanında ayrı, aynı camdan **"+" dairesi** (`spacing-nav`). Güvenli alanın üstünde durur.
- Beş öğe: Bugün, Takvim, Modüller, Gelen, Ayarlar (simge ve `text-nav` yazı; seçili olmayanlar `color-ink-nav`).
- **Seçili sayfa** öbürlerinden geniş, opak açık hap (`color-light`, `color-ink-dark`, yarı kalın, `shadow-selected`). Ekranda tek opak açık öğe seçili sayfadır.
- İçerik menünün altından geçer (menü bulanık cam); sayfanın sonunda menü kadar boşluk (`spacing-nav-space`).

### Saat şeridi ve ada

Ana ekrana eklenen uygulama saat şeridinin ve adanın altına da çizer (`black-translucent`, `viewport-fit=cover`). Kareler bu şeridi çizmez: gökyüzü en üste kadar uzanır, üstünde hiçbir şey yoktur.

- **Her ekran güvenli alanın altından başlar** (`env(safe-area-inset-top)`), sonra kendi üst boşluğu gelir. Boşluk tek yerdedir: kabuğun `main`'i (`src/app/(app)/layout.tsx`); ekranlar eklemez. Panoda yan menü de bu boşluğu bırakır (`AppNav`).
- **Zemin arkasına uzanır:** gökyüzü ekranın tamamını kaplar, şeridin arkası da gökyüzüdür.
- **Kayınca içerik saatin arkasından geçmez:** kabuk şeridin yerine zeminin aynısını bir kez daha, şeride kırpılmış olarak içeriğin üstüne çizer (`SafeTopBand`, `src/core/ui/sky/Backdrop.tsx`); alt kenarı solar. Sayfa en üstteyken görünmez (aynı gökyüzü), kayınca içerik onun altında kaybolur ve saat hep gökyüzünün üstünde durur. Güvenli alanı olmayan ekranda yüksekliği sıfırdır.
- **Alttan açılan sayfa** en çok ekranın %94'ü kadar uzar ve her zaman adanın biraz altında (`--spacing(2)`) kalır (hızlı giriş dahil). **Sahne** telefonda ekranın tamamını alır: şeridi güvenli alanın altından başlar ve kendi zeminiyle aynı üst şeridi taşır. Modülün **tam ekran görünümü** de aynı boşlukla başlar.

## Pano

- Solda, kenarlardan boşlukla duran **cam yan menü** (`glass-rail`, genişlik `spacing-rail`, köşe `radius-rail`): üstte "Sherpa", altında Bugün, Takvim, Modüller, Gelen kutusu, Ayarlar (`text-sm`).
- Seçili sayfa opak açık (`color-light`, `color-ink-dark`, `shadow-selected-rail`, köşe `radius-step`).
- Hızlı giriş panoda menüde değildir; ekranların kendi "+ Yeni giriş" düğmeleri ve `N` kısayolu açar.

## Adlar

"Hafta" yerine **"Takvim"** (Ç4c: adres `/takvim`; eski `/hafta` yönlenir). Telefonda "Gelen kutusu" kısaltılır: "Gelen".

## Sayfa başlığı

Liste sayfalarında başlık `text-title` (panoda `text-3xl`), kalın, `tracking-title`; içerik telefonda `px-4`, panoda `px-10` iç boşlukla, panoda menünün yanındaki genişliğin tamamında (Modüller, modül sayfası); okunacak tek sütun (Gelen kutusu) en çok `spacing-read` geniş.
