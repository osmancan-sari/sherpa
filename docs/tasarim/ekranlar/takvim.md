# Takvim

Kaynak: `docs/13-cam-dili.md` bölüm 4.3 (15 Kas 2026, onaylı); kurulduğu faz Ç4c. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Takvim (eski adı Hafta; "3 · Takvim" sayfası; onaylandı, 15 Kas 2026)

Kullanıcı sayfanın baştan tasarlanmasını istedi (15 Kas 2026): menüdeki adı "Takvim", günler dokunulabilir, haftanın işleri teslim tarihine göre. Bu bölüm yalnızca görünüş değildir; içeriği ve davranışı da değiştirir (`docs/09-kararlar.md`). İlk Hafta çizimleri (`HT*`, `HP*`) tuvalden kaldırıldı. Sakin zemin, yoğun cam; örnek veriler uydurmadır.

**Üst satır.** "Takvim" ve hafta seçici: önceki hafta, "9–15 Kasım", sonraki hafta (`spacing-touch` sessiz düğmeler).

**Gün kutuları.** Yedi gün yan yana, telefonda da ekrana sığar (kaydırma yok). Telefonda gün adı, tarih ve o gün teslim ya da sınav varsa işin rengiyle küçük nokta; panoda ayrıca kalan vakit ("4 sa 10 dk vakit") ve teslimin adı. Bugün beyaz kenarlı, geçen günler soluk. Sayfa hiçbir gün seçili olmadan açılır. Güne dokununca kutu opak açık olur (seçili) ve altta o günün ayrıntısı açılır; aynı kutuya ya da ayrıntıdaki kapat düğmesine dokununca haftaya dönülür.

**Bu hafta (gün seçili değilken).** Tek yoğun panel.

- Başlık: "BU HAFTA", sağda "11 sa 10 dk iş · 17 sa 40 dk vakit"; altında modül renkleriyle ince yük çubuğu (`ProgressBar` kalınlığında) ve vaktin beyaz çizgisi. İş vakti aşınca dikkat rengi ve simgeyle "İstenen süre bu haftanın vaktini aşıyor.", altında "Yetişmeyebilir: …".
- İşler **teslim tarihine göre** sıralı. Satır: renk noktası, ad, sağda küçük modül adı; altında teslim ("Teslim Pazar, 15 Kas"); altında işin rengiyle ince ilerleme çubuğu; çubuğun altında solda yapay zekanın tek satır notu (simgeyle; yapay zeka kapalıysa boş), sağda işlenen ve pay ("1 sa 30 dk / 3 sa").
- Boşken: "Bu hafta için taahhüt edilen iş yok."
- "Modül payları" satırı ve ayrı kapasite paneli yoktur (aynı bilgi yük çubuğunda ve satırlardaki modül adında).

**Gün ayrıntısı (gün seçiliyken).** Başlıkta günün adı ve tek satır özet, sağda kapat düğmesi. Bölümler güne göre:

| Gün | Özet | Bölümler |
| --- | --- | --- |
| Geçmiş | "4 iş · 3 sa 40 dk" | Teslim ve sınav; Yapılanlar; Sabit. Yapılmayan iş gösterilmez (ürün kuralı 2). |
| Bugün | "3 iş bitti · 4 sa 10 dk vakit" | Sıradakiler; Sabit; Yapılanlar; "Bugün'e git". |
| Gelecek | "6 sa vakit" | Teslim ve sınav; Planlananlar; Sabit; altında "Plan tahminidir; o sabah yeniden kurulur." |

Satır: işaret (iş için renk noktası, sabit için gri kare), ad, altında süre ya da saat, sağda küçük modül adı.

**Önümüzdeki haftalar.** Sekiz küçük dikey çubuk; her çubuk o haftanın işi, beyaz çizgi vakti. Altında haftanın başladığı gün, ay değişince ayın kısaltması. Vakti aşan hafta dikkat renginde ve simgeyle; altında tek satır açıklaması ("30 Kasım haftası: 34 sa iş, 30 sa vakit · 3 teslim"). Çubuğa dokununca o haftaya gidilir.

**Yapay zekanın notları** ikincil panelde, kısa. **"Haftayı yeniden kur"** sayfanın sonunda sessiz bağlantıdır; ardından "Hafta yeniden kuruldu." bildirimi. Uyku ortalaması satırı bu sayfada yoktur (Rutin → Düzenlilik'te durur).

**Pano.** Üst satır ve gün kutuları tam genişlikte; altında iki sütun (5:4). Solda her zaman "Bu hafta". Sağda gün seçili değilken önümüzdeki haftalar, notlar ve "Haftayı yeniden kur"; gün seçiliyken o günün ayrıntısı.

| Kare | İçerik |
| --- | --- |
| `TT1` | Telefon, açılış: gün seçili değil, bu haftanın işleri |
| `TT2` | Telefon, aşağı kaydırınca: önümüzdeki haftalar, notlar, "Haftayı yeniden kur" |
| `TT3` | Telefon, geçmiş gün seçili |
| `TT4` | Telefon, bugün seçili |
| `TT5` | Telefon, gelecek gün seçili |
| `TT6` | Telefon, iş vakti aşıyor; uygun saat uyarısı |
| `TT7` | Telefon, bu hafta iş yok; bildirim |
| `TP1` | Pano, açılış |
| `TP2` | Pano, gelecek gün seçili |
| `TP3` | Pano, bugün seçili |
| `TP4` | Pano, geçmiş gün seçili |
| `TP5` | Pano, iş vakti aşıyor; uygun saat uyarısı |

Çizilmeyen: başka bir haftaya gidildiğindeki görünüş (geçmiş ve gelecek hafta); kurallar bu haftayla aynıdır, geçmiş haftada işlerin yerinde yapılanlar durur.

**Menü.** Alt menüde ve yan menüde "Hafta" yerine "Takvim"; Bugün'deki uyarının eylemi "Takvime bak". Bütün kareler bu adla yeniden üretildi.

## Kurulum (Ç4c, 16 Kas 2026)

Kod: `src/core/ui/takvim/TakvimScreen.tsx`, adres `/takvim` (eski `/hafta` yönlenir). Veri: `useCalendar(week)` (Ç4a: tahmin ve haftanın işleri), `loadByWeek` (bu haftanın ve önümüzdeki sekiz haftanın iş ve vakti); sözler ve listeler saf `src/core/today/takvim.ts` (`weekLabel`, `dueText`, `horizonNote`, `dueOn`, `doneOn`; testli).

- **Gün kutuları:** yoğun cam, `radius-2xl`, telefonda `h-18`; seçili opak açık (`color-light`, ikincil yazı `color-ink-dark-2`), bugün `color-ink` kenarlı, geçen günler soluk. Panoda kutuda kalan vakit (bugün planın, gelecek günler tahminin vakti) ve ilk teslim.
- **Bu hafta:** başlıkta haftanın işi ve vakti (`loadByWeek`); yük çubuğu modül renkleriyle, vakit `color-flow-now` çizgisi. Satırlar `weekWork`'ten (teslim tarihine göre); teslim satırı "Teslim Pazar, 15 Kas" (altı gün içinde gün adıyla, sonrası "Teslim 3 Ara"). Bu haftanın "uygun saat yok" uyarıları altında uyarı satırı olarak.
- **Gün ayrıntısı:** geçmiş gün yapılanları günün oturumlarından toplar (işin oturumları birleşir; bitmemiş iş gösterilmez); okunmamış eski görevlerin adları için `listTasksById`. Bugün: Sıradakiler (planın işleri), Sabit, Yapılanlar, "Bugün'e git". Gelecek: Teslim ve sınav, Planlananlar (tahmin), Sabit, "Plan tahminidir; o sabah yeniden kurulur." Telefonda ayrıntı açıkken "Bu hafta" gizlenir (`TT3`–`TT5`); panoda sağ sütundadır.
- **Önümüzdeki haftalar:** gelecek haftadan başlayan sekiz hafta; çubuk `color-fill-bar`, vakti aşan hafta `color-attention` ve simgeli; ilk aşan haftanın açıklaması altta. Çubuk o haftaya götürür.
- **Başka hafta:** hafta seçiciyle; etiket "BU HAFTA" yerine haftanın adı; "Haftayı yeniden kur" yalnızca bu haftada. Geçmiş haftada satırlar o haftada teslimi olan işlerdir (karede çizilmedi; **görüşün gerek**).

Karelerden farklar: geçmiş günlerin sabit blokları gösterilmeyebilir (bloklar bugünden itibaren okunur); "Yetişmeyebilir" listesi haftanın teslimleri ağırlık sırasıyla.
