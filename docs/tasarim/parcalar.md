# Ortak parçalar

Kaynak: `docs/13-cam-dili.md` bölüm 3 (kareler `Parca1`, `Parca2`; onaylı 14 Kas 2026). Her parça `src/core/ui/kit/` içindedir, modüller `@/core/ui/kit`'ten alır; hepsi her haliyle galeridedir (`/tasarim`). Değerler `src/core/ui/tokens.css`'tedir; aşağıda token adlarıyla anılır (Tailwind sınıfı olarak: `bg-glass-dense`, `rounded-panel`, `h-control` …).

Yeni bir parça önce buraya ve galeriye girer, sonra kullanılır.

| Parça | Kural ve haller | Kod | Token'lar |
| --- | --- | --- | --- |
| **Ana panel** | Tam manzaranın üstünde; 1 px açık kenar, üstte ışık çizgisi. Tam manzarada gökyüzü parlaksa opaklığı büyür. | `Panel variant="main"` (`Panel.tsx`), `glass-main` | `color-glass-main`, `color-edge`, `shadow-panel`, `radius-panel`, `blur-panel` |
| **Yoğun panel** | Liste, tablo, form. | `Panel variant="dense"`, `glass-dense` | `color-glass-dense`, `radius-dense` |
| **İkincil panel** | Not, özet, küçük kutu, sekme hapı, uyarı satırı. | `Panel variant="soft"`, `glass-soft` | `color-glass-soft`, `color-edge-soft`, `shadow-soft`, `radius-soft`, `blur-soft` |
| **Panel etiketi** | "ŞİMDİ", "YAKLAŞANLAR": küçük, büyük harf, aralıklı, ikincil renk. | `PanelLabel`, `panel-label` | `text-xs`, `tracking-label`, `color-ink-2` |
| **Saydamlığı azalt** | Bütün camlar düz ve opak; bulanıklık yok. | `glass.css` (`:root[data-transparency="reduced"]`) | `color-solid` |
| **Liste satırı** | En az `spacing-row` (panoda `spacing-row-board`); başlık `text-base` yarı kalın, alt satır `text-sm` ikincil; ayırıcı `color-line`; seçili satır `color-fill-selected`; bekleyen soluk (%55). Satır eylemleri `IconButton`. Satırın tamamı bağlantı ya da düğme olabilir; eylemler dışında kalır. | `ListRow` (`ListRow.tsx`) | `spacing-row`, `color-line`, `color-fill-selected` |
| **Düğmeler** | Birincil: opak açık, koyu yazı; ekranda ya da kartta en çok bir tane. İkincil: saydam cam. Sessiz: yalnızca yazı. Tehlikeli: mercan kenar. Pasif: soluk. Boylar `control-lg` / `control` / `control-sm`; küçük düğmenin dokunma alanı kenarından taşar (en az `spacing-touch`). | `Button` (`variant`: `primary`, `secondary`, `quiet`, `danger`, `link`; `size`: `lg`, `md`, `sm`, `icon`) | `color-light`, `color-ink-dark`, `color-edge-light`, `shadow-primary`, `color-fill-button`, `color-edge-button`, `shadow-button`, `color-behind-fill`, `color-behind-edge`, `color-ink-danger`, `color-fill-quiet`, `color-ink-off` |
| **Simge düğmesi** | `spacing-touch` daire; basılı hali açık. Adı `label`'dır. | `IconButton` | `color-fill-field`, `color-edge-icon`, `color-fill-active`, `color-edge-pressed` |
| **Alan** | Yükseklik `spacing-field`, köşe `radius-field`, yazı `text-base` (telefonda yakınlaştırma olmasın). Odakta beyaz kenar ve halka; hatada mercan kenar ve altında simgeyle tek cümle. Saat alanı "SS:dd". Etiket üstte `text-sm` ikincil; ipucu altta `text-meta`. | `Input`, `Select`, `Textarea`, `Field`, `FieldError` (`Field.tsx`) | `spacing-field`, `radius-field`, `color-fill-field`, `color-edge-field`, `color-focus`, `shadow-focus`, `color-behind` |
| **Yapay zekanın koyduğu değer** | Alanın kenarı kesiklidir; altında simgeyle gerekçesi. Kullanıcı alanı değiştirince kenar düz olur, gerekçe kalkar. Hap olarak: kesik kenarlı hap. | `Input ai`, `Select ai`, `AiReason`, `AiTag` | `color-edge-ai` |
| **Anahtar** | Açık: opak açık, koyu topuz sağda; kapalı: soluk iz, açık topuz solda. Dokunma alanı `spacing-touch`. Satırda yazı solda, anahtar sağda. | `Switch`, `SwitchRow` (`Switch.tsx`) | `color-light`, `color-ink-dark`, `color-fill-off`, `color-edge-button` |
| **Parçalı seçim** | Birkaç seçenekten biri ("Her gün \| N günde bir"); seçili parça opak açık. | `Segmented` (`Choice.tsx`) | `color-fill-chip`, `radius-segment`, `color-ink-soft` |
| **Hap** | Modül hapı renk noktasıyla; seçili hap opak açık. Küçük etiket ("temel", "bekliyor"). | `Chip`, `Tag` | `spacing-control-sm`, `spacing-chip`, `color-fill-chip`, `color-edge` |
| **Durum** | Yolunda, dikkat, geride; her biri simge ve yazıyla. Kırmızı ve "gecikti" yok. | `Status` | `color-ok`, `color-attention`, `color-behind` |
| **Sekme ve geçmiş düğmesi** | Sekmeler bölümlerdir: cam hapta yan yana, seçili açık; sığmazsa yana kayar. Geçmiş görünümü ayrı düğmedir (grafik simgesi ve ad); açıkken opak açık ve hiçbir sekme seçili görünmez (`docs/moduller/ORTAK.md` bölüm 4). | `TabBar`, `TabLink`, `HistoryLink` (`Tabs.tsx`) | `radius-tabs`, `color-fill-tab` |
| **İlerleme** | Süre çubuğu işin rengiyle; adım çizgileri bölümün rengiyle, ulaşılmayanlar soluk. | `ProgressBar`, `StepLines` (`Feedback.tsx`) | `color-fill-track`, `color-fill-step` |
| **Uyarı satırı** | İkincil panel, simge, tek cümle, tek eylem; en çok iki satır. "Bilgi" tonu uyarı rengi kullanmaz (yapay zeka bütçesi). | `AlertRow` | `radius-alert`, `color-attention` |
| **Bildirim** | Altta ortada hap; 4 saniye (`--toast-time`); geri alınabilen işte "Geri al". Yenisi eskisinin yerini alır. | `Toast`; `useNotify()` (`src/core/ui/Notices.tsx`) | `color-glass-toast`, `blur-toast`, `shadow-toast` |
| **Bağlantı yok** | Üst satırın sağında küçük hap (simge ve "bağlantı yok"); son bilinen plan ekranda kalır. | `OfflinePill` | `color-glass-soft` |
| **Veri okunamadı** | Ekranın ana paneli yerinde tek cümle ve "Yeniden dene". | `ReadError` | `color-glass-dense` |
| **Pencere** | Onay: arkası `color-scrim` ile kararır; köşe `radius-panel`; "Vazgeç" her zaman var, birincil sağda; en çok `spacing-sheet` geniş. | `Window` (`Overlay.tsx`) | `color-glass-dialog`, `shadow-dialog`, `color-scrim` |
| **Alttan açılan sayfa / yan panel** | Form ve düzenleme. Telefonda alttan (tutamaç, başlık, "Kapat"); panoda aynı içerik sağdan `spacing-sheet` genişliğinde yan panel. İçerik kayar; alt satır sabittir: solda varsa ek eylem, sağda "Vazgeç" ve birincil. | `Sheet`, `SheetFooter` (`Overlay.tsx`) | `color-glass-sheet`, `blur-sheet`, `shadow-sheet`, `spacing-sheet`, `color-fill-handle` |
| **Menü** | Telefonda cam alt menü ve ayrı "+"; seçili sayfa öbürlerinden geniş, opak açık hap. Panoda cam yan menü; seçili sayfa opak açık. | `AppNav` (`src/core/ui/AppNav.tsx`), `QuickAddButton` | `color-glass-nav`, `color-glass-rail`, `spacing-nav`, `spacing-rail`, `shadow-selected` |
| **Sahne şeridi ve tonlar** | Telefonda en üstte kenardan kenara; panoda cam hap. Ton zeminleri: sakin, odak, enerji (`ekranlar/sahne.md`). | `SceneFrame` (`src/core/ui/today/Scene.tsx`), `Backdrop` | `spacing-strip`, `color-scene-strip`, `color-focus-tone`, `color-energy-base` |
| **Zemin** | Tam manzara, sakin zemin, modülün zemini (`ilkeler.md`). | `Backdrop`, `Landscape`, `useBackdrop` (`src/core/ui/sky/`) | `--sky-*`, `color-night-dim` |

Daha önceki kit parçaları (`NumberStepper`, `ChoiceChips`, `Timer`, `Timeline`, `HeatGrid`, `BarChart`, `LineChart`, `DataTable`, `StepRunner`, `EmptyState`, `ErrorState`) aynı token'larla çizilir; modüller onları da kullanır.

## Kullanım kuralları

- Bileşen ya da sayfa sabit renk kodu, renk işlevi ya da keyfi piksel yazmaz (`tests/unit/design-values.test.ts`); Tailwind'in hazır paleti kapalıdır.
- Hesapla bulunan renk (modülün rengi, işin rengi, gökyüzünün harmanı) satır içi stil olarak verilebilir; ölçüler sınıf olarak.
- Sınıf birleştirme `cn` (`src/lib/utils.ts`) ile yapılır: token adlarını tanır.
- Hareket `--motion-*` sürelerini kullanır; "Hareketi azalt" hepsini anlık yapar.
