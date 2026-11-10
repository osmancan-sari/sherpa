# Modül sözleşmesi

Her modül çekirdeğe aynı sözleşmeyle bağlanır. Sözleşmenin dışındaki her şey (kendi tabloları, ekranları, hesapları) modülün kendi işidir. Çekirdek hiçbir modülü adıyla tanımaz; yalnızca `registry.ts` içindeki tanımları dolaşır.

## Bir modülün dosyaları

```
src/modules/<slug>/
  module.ts        ModuleDefinition (aşağıda)
  queries.ts       modülün kendi sorguları ve mutasyonları
  rules.ts         olay dinleyicileri: iş, ritim, blok ve soru üretimi
  page.tsx         modül sayfası (ModulePageShell içinde)
  components/      modüle özel bileşenler
  README.md        modülün kısa özeti; tasarımın kendisi docs/moduller/<slug>.md
supabase/migrations/NNNN_<slug>_*.sql
```

Yeni modül `src/modules/_sablon/` kopyalanarak başlar.

## Tanım

```ts
export type ModuleDefinition = {
  slug: string
  name: string
  kind: 'lifelong' | 'term' | 'until_goal'
  area?: string
  color: string

  // 1. Ana ekrana ne verir
  chip: (ctx: ModuleContext) => Promise<ChipData>          // tek satır durum + sağlık
  nowCard?: (task: Task) => NowCardContent | null           // kendi işleri için özel kart içeriği
  alerts?: (ctx: ModuleContext) => Promise<Alert[]>         // en fazla 1 tanesi gösterilir

  // 2. Hangi girişleri kabul eder
  intake: IntakeType[]

  // 3. Olaylar
  emits: string[]                                           // yayınladığı olay türleri
  on?: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>>

  // 4. Hayat moduna tepki
  modeBehavior: Record<LifeMode, ModeBehavior>

  // 5. Haftalık rapor
  weeklyReport: (ctx: ModuleContext, week: DateRange) => Promise<ModuleReport>

  // 6. Yaşam döngüsü
  onActivate?: (ctx: ModuleContext) => Promise<void>
  onArchive?: (ctx: ModuleContext) => Promise<void>
}

type ChipData = {
  text: string                       // 'teslim Cuma', 'süpürme 1/2'
  health: 'ok' | 'attention' | 'behind'
}

type IntakeType = {
  key: string                        // 'assessment', 'grade', 'weigh_in'
  label: string                      // hızlı girişte görünen ad
  fields: FieldSpec[]                // ad, tür, zorunlu mu, varsayılan
  examples: string[]                 // yönlendirici için örnek cümleler
  handle: (values: Record<string, unknown>, ctx: ModuleContext) => Promise<void>
}

type ModeBehavior = {
  weightMultiplier: number           // planlayıcıdaki önem çarpanı
  floorMultiplier: number            // tabanın ne kadarı korunur (0–1)
  note?: string                      // modülün bu modda ne yaptığı (kullanıcıya gösterilir)
}
```

## Yedi bağlantı noktası

| # | Nokta | Modül ne yapar |
| --- | --- | --- |
| 1 | İş teklif eder | `rules.ts` içinde çekirdeğe iş zarfı gönderir (`ctx.propose`). Çekirdek tablolara doğrudan yazmaz; tek istisna olay soruları (`prompts`) |
| 2 | Girdi kabul eder | `intake` listesi. Hızlı giriş ve yönlendirici bu listeyi okur; yeni modül eklenince kendiliğinden tanınır |
| 3 | Ana ekrana kart verir | `chip`, isteğe bağlı `nowCard` ve `alerts` |
| 4 | Olay yayınlar ve dinler | `emits` ve `on`. Modüller birbirini içe aktarmaz; yalnızca olaylarla haberleşir |
| 5 | Mod davranışını bildirir | `modeBehavior` |
| 6 | Haftalık rapor verir | `weeklyReport`: metrikler ve en fazla 2 öneri |
| 7 | Kural kartı verir | `docs/moduller/<slug>.md` içindeki "Kurallar" bölümü; `rules.ts` bunun kodudur |

## Modül arayüzü

Her modülün kendine özel bir arayüzü vardır; modüller birbirine benzemek zorunda değildir (Okul veri yoğun tablolar ve dönem çizelgesi ister, Beslenme alışveriş listesi ve adım adım pişirme ekranı, Sabah rutini geri sayımlı bir koç ekranı). Arayüz her modülün tasarım oturumunda ayrıntılanır; çekirdek bunun için şu zemini sağlar:

| Parça | Çekirdek ne sağlar | Modül ne yapar |
| --- | --- | --- |
| Modül sayfası | `/m/<slug>` rotası ve `ModulePageShell` (beş bölge) | Bölgeleri doldurur; gövdede tamamen serbesttir |
| Sekmeler | Sekme çubuğu ve adres eşlemesi (`/m/<slug>/<sekme>`) | Sekmelerini ve her birinin bileşenini bildirir |
| Alt sayfalar | `/m/<slug>/…` altındaki bütün rotalar modüle aittir | Ayrıntı sayfaları (bir ders, bir tarif) ekler |
| Tam ekran görünüm | Kabuğu gizleyen görünüm modu; panoda ve telefonda çalışır | Koç modu, alışveriş modu gibi ekranlar tanımlar |
| Şimdi kartı | Kartın çerçevesi ve eylem düğmeleri | Kendi işleri için kart içeriği ve ek eylemler verir |
| Hızlı eylemler | Sayfa başında eylem çubuğu | Modüle özel eylemleri ekler ("not gir", "tartı gir") |
| Ayarlar | `/ayarlar/moduller/<slug>` | Kendi ayar formunu verir |
| Bileşen takımı | Tablo (satır içi düzenleme, süzgeç), zaman çizelgesi, ızgara, çizgi ve çubuk grafik, sayı adımlayıcı, seçim çipleri, zamanlayıcı, boş ve hata durumları | Bunları kullanır; yetmediği yerde kendi bileşenini yazar |

```ts
  // ModuleDefinition'a eklenir
  ui: {
    tabs: { key: string; label: string; component: ComponentType }[]
    routes?: { path: string; component: ComponentType }[]        // /m/<slug>/ altında
    fullscreen?: { key: string; label: string; component: ComponentType }[]
    actions?: { key: string; label: string; run: (ctx: ModuleContext) => void }[]
    settings?: ComponentType
  }
```

Kurallar: modül arayüzü çekirdeğin tasarım dilini (tipografi, renk, aralık, tema) kullanır; kendi bileşenleri de bu dile uyar. Pano ve telefon yerleşimlerinin ikisinde de çalışır. Çekirdekteki bir ekranı değiştirmez; yalnızca kendisine ayrılan yerlere içerik verir.

## İş zarfı ve `propose`

Modülün iş üretmesinin tek yolu budur. Zarfın alanları `docs/03-veri-modeli.md` içindedir.

```ts
type ModuleContext = {
  propose: (p: WorkProposal) => Promise<ProposalResult>   // oluşturur ya da aynı key ile günceller
  withdraw: (key: string) => Promise<void>                 // kaynak kayıt silinince
  emit: (type: string, payload: unknown) => Promise<void>
  // ... modülün kendi tablolarına erişim
}

type WorkProposal = {
  schema: 1
  key: string                          // modül içinde tekil ve kalıcı
  source: { type: string; id: string }
  title: string
  when: { due?: string; hard?: boolean; earliest?: string }
      | { recurrence: { count: number; period: 'day' | 'week' | 'month'; floor?: number } }
      | { fixed: { starts_at: string; ends_at: string; location?: string } }
  effort?: { total_minutes?: number; session_minutes?: number; bounds?: { min: number; max: number } }
  fit?: { energy?: Energy; context?: Context }
  importance?: 1 | 2 | 3 | 4
  depends_on?: string[]
  flex?: { splittable?: boolean; droppable?: boolean }
  artifact?: string
  meta?: Record<string, unknown>       // modüle özel; çekirdek yorumlamaz, yapay zekaya bağlam olarak verir
}
```

Akış:

1. Modül bildiği olguları doldurup `propose` çağırır.
2. Çekirdek zarfı doğrular ve kaydeder. Boş kalan yargı alanları için yapay zekanın `size` çağrısı yapılır; modülün `sizingHints` metni ve `meta` bağlam olarak gider.
3. Kaynak kayıt değişince modül aynı `key` ile yeniden `propose` eder. Kalem henüz haftaya taahhüt edilmediyse sessizce güncellenir; edildiyse değişiklik kullanıcıya tek satırla bildirilir ("Midterm bir gün öne alındı, plan güncellendi").
4. Kalem bitince çekirdek modüle sonucu bildirir (`onOutcome`): harcanan süre, kaç oturum, ertelenme sayısı. Modül bunu kendi tahmin ipuçlarını düzeltmek için kullanabilir.

`ModuleDefinition`'a iki alan eklenir:

```ts
  sizingHints?: string                 // yapay zekaya verilen, modüle özel efor ipuçları (kısa metin)
  onOutcome?: (o: Outcome, ctx: ModuleContext) => Promise<void>
```

## Kurallar

- **Kendi verisinin tek sahibi modüldür.** Başka modül o tabloları okumaz, yazmaz.
- **Her teklif geri izlenebilir ve tekrar edilebilir.** `source` kaynağı gösterir; `key` aynı teklifin ikinci kez kayıt açmasını önler.
- **Modül olgu verir, yargıyı dayatmaz.** Kesin bildiği süreyi yazabilir (sabah rutini 20 dk); bilmediğini boş bırakır ve sınır verir.
- **Formül yeten yerde yapay zeka yok.** "Prep'ten bir gün önce alışveriş" gibi kesin kurallarda modül bütün alanları kendisi doldurur; `size` çağrısı yapılmaz.
- **Türetilen işler yeniden üretilebilir olmalı.** Kaynak kayıt değişince (örneğin sınav tarihi) modül ilgili işleri günceller; kullanıcının elle değiştirdiği işi ezmez (`meta.user_edited = true`).
- **Arşivlenen modülün açık işleri `dropped` olur,** blok serileri kapanır, ritimleri pasifleşir. Verisi silinmez.
- **Modül sayfası çekirdek kabuğu kullanır.** Beş bölgeli iskeletin dışına çıkmaz; gövdede serbesttir.

## Modül tasarım şablonu

Yeni bir modül önce `docs/moduller/<slug>.md` olarak tasarlanır ve onaylanır, sonra kodlanır. Doküman şu 11 başlığı doldurur; uymayan başlık boş bırakılmaz, "bu modülde yok" yazılır.

1. Kimlik: ad, tür, tek cümlelik amaç, başarı ölçütü
2. Yaşam döngüsü: başlangıç, bitiş koşulu, durumlar, dönem geçişi
3. Veri modeli: modüle özel tablolar ve çekirdeğe bağlantıları
4. Veri kaynakları ve otomasyon: her veri için kaynak ve seviye (otomatik, yarı otomatik, elle)
5. Kurallar: modül içi otomasyonlar, yayınladığı ve dinlediği olaylar
6. Teklif ettiği işler: her zarf türü için `key`, hangi alanları modülün doldurduğu, hangilerini yapay zekaya bıraktığı, `sizingHints`
7. Veri girişi: `intake` türleri
8. Arayüz: çip, şimdi kartı, sayfanın beş bölgesi, sekmeler, alt sayfalar, tam ekran görünümler, hızlı eylemler, ayarlar; her ekranın çizimi ve her veri girişinin adımları
9. Mod davranışı
10. Haftalık rapor ve öğrenme
11. Açık sorular ve sonraki sürümler
