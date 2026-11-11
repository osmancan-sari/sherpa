# Modül sözleşmesi

Her modül çekirdeğe aynı sözleşmeyle bağlanır. Sözleşmenin dışındaki her şey (kendi tabloları, ekranları, hesapları) modülün kendi işidir. Çekirdek hiçbir modülü adıyla tanımaz; yalnızca `registry.ts` içindeki tanımları dolaşır.

## Bir modülün dosyaları

```
src/modules/<slug>/
  module.ts        ModuleDefinition (aşağıda)
  queries.ts       modülün kendi sorguları ve mutasyonları
  rules.ts         olay dinleyicileri: iş, ritim, blok ve soru üretimi
  components/      modülün ekranları: sekmeler, alt sayfalar, tam ekran görünümler, ayar formu
  README.md        modülün kısa özeti; tasarımın kendisi docs/moduller/<slug>.md
supabase/migrations/NNNN_<slug>_*.sql
```

Modülün ayrı bir sayfa dosyası yoktur: `/m/<slug>` rotasını ve `ModulePageShell` iskeletini çekirdek kurar, modül ekranlarını `module.ts` içindeki `ui` alanıyla bildirir.

Yeni modül `src/modules/_sablon/` kopyalanarak başlar.

### Modül çekirdekten neyi içe aktarabilir

Modül yalnızca kendi klasörünü, dış paketleri (`react`, `next/link`, `lucide-react`…) ve aşağıdakileri içe aktarır; başka bir modülü ya da çekirdeğin öbür iç dosyalarını içe aktarmaz. Liste `tests/unit/modules.test.ts` içinde denetlenir; listeye ekleme bu dokümanla birlikte yapılır.

| Nereden | Ne |
| --- | --- |
| `@/core/contract/types` | Sözleşmenin tipleri (`ModuleDefinition`, `ModuleContext`, `WorkProposal`…) |
| `@/core/types` | Satır tipleri (`Task`, `WorkItem`, `AppEvent`…) |
| `@/core/ui/module/ModuleProvider` | `useModule()`: ekran bileşeninin bağlamı (`row`, `definition`, `ctx`) |
| `@/core/app/hooks` | `useModuleQuery(row, anahtar, fn)`: modülün bağlamıyla hesaplanan ve her veri değişiminde tazelenen sorgu; `useNow()`: ortak saat |
| `@/core/app/actions` | `useRefreshAll()`: modül kendi bağlamıyla bir şey yazdıktan sonra ekranı hemen tazeler |
| `@/core/ui/Notices` | `useNotify()`, `SAVE_FAILED`: ekranın altındaki tek satırlık bildirim |
| `@/core/ui/kit` | Bileşen takımı |
| `@/components/ui/*`, `@/lib/date`, `@/lib/utils` | Düğme ve giriş alanı, tarih yardımcıları |
| `@/lib/supabase/database.types` | Modülün kendi tablolarının satır tipleri (`Tables<"<slug>_…">`) |

Ekran bileşeni bağlam üzerinden yazdığında (`ctx.propose`, kendi tablosu) işlem bitince `refreshAll()` çağırır; öbür cihazlar değişikliği Realtime ile alır. Yazma hata verirse `notify(SAVE_FAILED)` der.

## Tanım

Tiplerin tamamı `src/core/contract/types.ts` içindedir; modül oradan içe aktarır. Aşağısı özetidir.

```ts
export type ModuleDefinition = {
  slug: string                       // küçük harf, rakam, tire
  name: string
  kind: 'lifelong' | 'term' | 'until_goal'
  area?: { slug: string; name: string }
  color: string                      // #rrggbb

  // 1. Ana ekrana ne verir
  chip: (ctx: ModuleContext) => Promise<ChipData>          // tek satır durum + sağlık
  nowCard?: (task: Task) => NowCardContent | null           // kendi işleri için özel kart içeriği
  alerts?: (ctx: ModuleContext) => Promise<Alert[]>         // en fazla 1 tanesi gösterilir

  // 2. Hangi girişleri kabul eder
  intake: IntakeType[]
  blocks?: StructuredBlockHandler[]                         // yapıştırılan yapılı bloklar (`sherpa` bloğu)

  // 3. Olaylar
  emits: string[]                                           // yayınladığı olay türleri; '<slug>.' ile başlar
  on?: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>>

  // 4. Hayat moduna tepki
  modeBehavior: Record<LifeMode, ModeBehavior>

  // 5. Haftalık rapor
  weeklyReport: (ctx: ModuleContext, week: DateRange) => Promise<ModuleReport>

  // 6. Yaşam döngüsü
  onActivate?: (ctx: ModuleContext) => Promise<void>
  onArchive?: (ctx: ModuleContext) => Promise<void>

  // İş zarfı
  sizingHints?: string
  onOutcome?: (o: Outcome, ctx: ModuleContext) => Promise<void>

  // Yapıştırılan serbest metni okuyanlar (yapay zekanın `extract` çağrısı)
  extractors?: Extractor[]

  // Modülün kendi tabloları; '<slug>_' ile başlar. "Tümünü dışa aktar" bunları da alır
  tables?: string[]

  // Arayüz (aşağıda)
  ui: ModuleUi
}

type ChipData = {
  text: string                       // 'teslim Cuma', 'süpürme 1/2'
  health: 'ok' | 'attention' | 'behind'
}

type NowCardContent = {
  detail?: string                    // başlığın altında tek satır: tam olarak ne çalışılacak
  links?: { label: string; href: string }[]   // çekirdeğin eylemlerine ek bağlantılar
}

type Alert = { key: string; text: string; action?: { label: string; href: string } }

type IntakeType = {
  key: string                        // 'assessment', 'grade', 'weigh_in'
  label: string                      // hızlı girişte görünen ad
  fields: FieldSpec[]                // ad, etiket, tür (text, number, date, select), zorunlu mu, varsayılan
  examples: string[]                 // yönlendirici için örnek cümleler
  handle: (values: Record<string, unknown>, ctx: ModuleContext) => Promise<void>
}

type StructuredBlockHandler = {
  key: string
  match: (payload: unknown) => boolean       // bu blok bana mı ait?
  handle: (payload: unknown, ctx: ModuleContext) => Promise<void>
}

type ModeBehavior = {
  weightMultiplier: number           // planlayıcıdaki önem çarpanı
  floorMultiplier: number            // tabanın ne kadarı korunur (0–1)
  note?: string                      // modülün bu modda ne yaptığı (kullanıcıya gösterilir)
}

type ModuleReport = {
  metrics: { label: string; value: string }[]
  suggestions: string[]              // en fazla 2
}
```

Kayıt: `src/modules/registry.ts` tanımları `createRegistry` ile toplar. Sözleşmeye uymayan tanım (geçersiz `slug`, yinelenen sekme anahtarı, başka modülün adıyla başlayan olay ya da tablo gibi) uygulama açılırken ve testlerde hata verir; arayüzde bir yerde sessizce bozulmaz.

Modülün satırı: tanım modülün ne yapabildiğini, `modules` tablosundaki satır kullanılıp kullanılmadığını ve ayarlarını söyler. Satır, modül Ayarlar'dan ilk kez etkinleştirilince tanımdan açılır. Tanımı olmayan satır da geçerlidir (örnek veri, kodu kaldırılmış modül): çipi ve sayfası çekirdeğin varsayılanlarıyla görünür.

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
type ModuleUi = {
  tabs: { key: string; label: string; component: ComponentType<ModuleViewProps> }[]   // en az bir; ilki varsayılan
  routes?: { path: string; title?: string; component: ComponentType<ModuleViewProps> }[]   // /m/<slug>/ altında; 'kayit/:id'
  fullscreen?: { key: string; label: string; component: ComponentType<ModuleViewProps> }[] // /m/<slug>/tam/<key>
  actions?: { key: string; label: string; run: (ctx: ModuleUiContext) => void | Promise<void> }[]
  settings?: ComponentType
  history?: ComponentType            // 4. bölge; yoksa çekirdek haftalık harcanan süreyi gösterir
}

type ModuleViewProps = { params: Record<string, string> }   // alt sayfalarda ':id' gibi parçalar

// Ekran bileşenleri bağlama `useModule()` ile ulaşır (src/core/ui/module/ModuleProvider).
type ModuleUiContext = ModuleContext & {
  openIntake: (key: string) => void  // hızlı girişi modülün bir giriş türünde açar
  extract: <T>(extractor: string, text: string, options?: { publishedAt?, context? })
    => Promise<{ status: "ok", suggestions: T[], note } | { status: "skipped" | "failed" | "unknown" }>
                                     // yapıştırılan metni modülün okuyucusuyla okutur (yapay zeka)
  navigate: (path: string) => void   // /m/<slug>/ altında bir yola gider
}
```

Sınama modülü `deneme` her bağlantı noktasının çalışan örneğidir (`alerts` tanımlıdır ama çekirdek modül uyarılarını Ç3'te, `AlertBar` ile göstermeye başlar); yalnızca `NEXT_PUBLIC_SHERPA_DEMO_MODULE=1` verilen ortamlarda (yerel geliştirme, testler) kaydolur, üretimde kaydolmaz.

Adresler: `/m/<slug>` ilk sekmeyi, `/m/<slug>/<sekme>` adı verilen sekmeyi açar; öbür yollar `routes` ile eşlenir. `tam` parçası çekirdeğe ayrılmıştır: sekme ya da alt sayfa bu adı alamaz.

Sayfalar arası geçişte çıkılan sayfa bir süre belgede gizli olarak kalır (Next.js gezinme durumunu korur); modül bileşeni yan etkilerini `useEffect` temizliğine bağlamalı, belgede tekil olduğunu varsaymamalıdır.

Kurallar: modül arayüzü çekirdeğin tasarım dilini (tipografi, renk, aralık, tema) kullanır; kendi bileşenleri de bu dile uyar. Pano ve telefon yerleşimlerinin ikisinde de çalışır. Çekirdekteki bir ekranı değiştirmez; yalnızca kendisine ayrılan yerlere içerik verir.

## İş zarfı ve `propose`

Modülün iş üretmesinin tek yolu budur. Zarfın alanları `docs/03-veri-modeli.md` içindedir.

```ts
type ModuleContext = {
  module: ModuleRow                                        // modülün satırı: kimliği, durumu, ayarları
  db: Db                                                   // modülün kendi tablolarına erişim
  now: () => Date
  propose: (p: WorkProposal) => Promise<ProposalResult>   // oluşturur ya da aynı key ile günceller
  withdraw: (key: string) => Promise<void>                 // kaynak kayıt silinince
  emit: (type: string, payload?: object) => Promise<void>  // yalnızca `emits` içinde bildirdiği türler
  ask: (prompt: PromptRequest) => Promise<void>            // olay sorusu; yanıt `core.prompt_answered` olayıyla gelir
  work: {                                                  // modülün çekirdekteki işleri (yalnızca okuma)
    items: () => Promise<WorkItem[]>
    tasks: () => Promise<Task[]>
    rhythms: () => Promise<RhythmProgress[]>               // dönem içi yapılan, hedef, borç
    rhythmLogs: (sinceDay: string) => Promise<RhythmLog[]>
  }
  saveSettings: (settings: object) => Promise<void>        // modules.settings
}

type WorkProposal = {
  schema: 1
  key: string                          // modül içinde tekil ve kalıcı
  source: { type: string; id: string } // id: modülün kendi kaydının kimliği (uuid)
  title: string
  when?: { due?: string; hard?: boolean; earliest?: string }
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

type ProposalResult = {
  target: 'work_item' | 'rhythm' | 'block'
  id: string
  created: boolean                     // bu key için ilk kayıt mı
  changed: string[]                    // bu teklifin değiştirdiği alanlar
  kept: string[]                       // teklifin değiştirmek istediği ama kullanıcının sahip olduğu alanlar
}

type Outcome = {
  key: string
  source: { type: string | null; id: string | null }
  result: 'done' | 'dropped'
  estimatedMinutes: number | null
  spentMinutes: number
  sessionCount: number
  postponedCount: number               // "Ertele" Ç3'te gelene kadar 0
}
```

Zarfın kuralları (`src/core/contract/envelope.ts`, saf fonksiyonlar; yazma `src/core/data/propose.ts`):

- Zamanlar saat dilimi taşıyan ISO biçimindedir (`2026-11-12T10:00:00+03:00`). Boş alanlar `null` da yazılabilir.
- `when` tek biçim taşır; biçim kaydın tablosunu belirler ve aynı `key` sonradan başka biçime çevrilemez.
- `key` boşluk, virgül, süslü ayraç, tırnak ve ters eğik çizgi içeremez.
- Zarfın tanımadığı alan (yanlış yazılmış ad, fazladan alan) reddedilir ve hata iletisinde adıyla söylenir; iç nesnelerde de böyledir. Modülün kendine ait bilgisi `meta` içinde taşınır; `meta` serbesttir. Modülün kim olduğu zarfta yazmaz, bağlamdan (`ctx`) bilinir.
- Biçimin kullanmadığı alan reddedilir, sessizce atılmaz: tekrar biçiminde toplam efor, sınır, önem, bağımlılık, çıktı ve `flex`; sabit zaman biçiminde efor, `fit`, önem, bağımlılık, çıktı, `flex` ve `meta`.
- **Olgu alanları** (başlık, son tarih, en erken, çıktı, bağımlılıklar, `meta`, tekrar ve sabit zaman değerleri) her teklifte yazılır; boş gelen olgu da yazılır (son tarih kalkabilir). **Yargı alanları** (efor, oturum süresi, önem, enerji, bağlam, bölünebilirlik) yalnızca dolu geldiğinde yazılır.
- Kullanıcının değiştirdiği alan hiçbir teklifte ezilmez; teklif o alanı `kept` içinde geri bildirir.
- Efor boş ve `bounds` verilmişse sınırın ortası (5 dakikaya yuvarlanır) `default` kaynağıyla yazılır; var olan bir değerin üzerine yazılmaz. Sınır da yoksa efor boş kalır.
- Teklif edilen kalem `active` açılır (`proposed` durumu yapay zekanın bölme önerileri içindir, Ç2).
- `withdraw` hiçbir şeyi silmez: kalem ve açık oturum işleri `dropped`, ritim pasif, blok `cancelled` olur; kalemde çalışan oturum varsa durdurulur; bitmiş kayda dokunulmaz. Geri çekilen `key` yeniden teklif edilirse aynı kayıt geri gelir; kullanıcının kendi kapattığı kayıt (kalem, ritim, blok) geri gelmez. Kimin kapattığı `provenance` içinde durum alanının kaynağı olarak tutulur.

Akış:

1. Modül bildiği olguları doldurup `propose` çağırır.
2. Çekirdek zarfı doğrular ve kaydeder. Boş kalan yargı alanları için yapay zekanın `size` çağrısı yapılır; modülün `sizingHints` metni ve `meta` bağlam olarak gider.
3. Kaynak kayıt değişince modül aynı `key` ile yeniden `propose` eder. Kalem henüz haftaya taahhüt edilmediyse sessizce güncellenir; edildiyse değişiklik kullanıcıya tek satırla bildirilir ("Midterm bir gün öne alındı, plan güncellendi").
4. Kullanıcı kalemi kapatınca (bitti ya da bırakıldı) çekirdek modüle sonucu bildirir (`onOutcome`): harcanan süre, kaç oturum, ertelenme sayısı. Modül bunu kendi tahmin ipuçlarını düzeltmek için kullanabilir.

**Olaylar.** `emit` olayı `events` tablosuna yazar ve yayınlandığı yerde, o türü dinleyen etkin modüllerin `on` işleyicilerine sırayla verir. Duraklatılmış ve arşivlenmiş modül olay almaz. Bir işleyicinin hatası öbürlerini ve yayınlayanı durdurmaz. Çekirdeğin kendi olayları `core.` ile başlar; bugün tek tanesi vardır: `core.prompt_answered` (`{ module, kind, subject_type, subject_id, value }`).

`ModuleDefinition`'a iki alan eklenir:

```ts
  sizingHints?: string                 // yapay zekaya verilen, modüle özel efor ipuçları (kısa metin)
  onOutcome?: (o: Outcome, ctx: ModuleContext) => Promise<void>
```

`size` çağrısını tarayıcı başlatır: çekirdek her teklifi kaydettikten sonra yeni kalem ya da kapsamı (başlık, `meta`, `effort.bounds`) değişen kalem için sunucuya sorar; neyin boş olduğuna sunucu karar verir. Modülün ayrıca bir şey yapması gerekmez.

**Serbest metinden öneri (`extractors`).** Modül, yapıştırılan bir metni (duyuru, e-posta) okutmak isterse bir okuyucu tanımlar:

```ts
type Extractor<T> = {
  key: string            // modül içinde tekil: 'ninova_announcement'
  version: string        // talimat ya da şema değişince değişir (önceki yanıt yeniden kullanılmaz)
  instructions: string   // metinde ne aranacağı, modülün kendi diliyle
  item: ZodType<T>       // tek önerinin şeması
  max?: number           // bir metinden en çok kaç öneri (varsayılan 10)
}
```

Modül ekranından `ctx.extract(extractor, text, { publishedAt, context })` çağrılır (arkada `POST /api/ai/extract`); çekirdek çağrıyı yapar, şemaya uyan önerileri döndürür ve hiçbir şey yazmaz. `context`, modülün metni okumaya yarayan bilgisidir (örneğin dersin açık değerlendirmeleri). Önerilerin ne olacağına (genelde kullanıcının onayladığı bir kart) modül karar verir. Yapay zeka yoksa yanıt `skipped` olur; modül elle girişe döner.

## Kurallar

- **Kendi verisinin tek sahibi modüldür.** Başka modül o tabloları okumaz, yazmaz.
- **Her teklif geri izlenebilir ve tekrar edilebilir.** `source` kaynağı gösterir; `key` aynı teklifin ikinci kez kayıt açmasını önler.
- **Modül olgu verir, yargıyı dayatmaz.** Kesin bildiği süreyi yazabilir (sabah rutini 20 dk); bilmediğini boş bırakır ve sınır verir.
- **Formül yeten yerde yapay zeka yok.** "Prep'ten bir gün önce alışveriş" gibi kesin kurallarda modül bütün alanları kendisi doldurur; `size` çağrısı yapılmaz.
- **Türetilen işler yeniden üretilebilir olmalı.** Kaynak kayıt değişince (örneğin sınav tarihi) modül ilgili işleri günceller; kullanıcının elle değiştirdiği alanı çekirdek ezmez (alan kaynağı `provenance` içinde `user` olarak durur; modülün ayrıca bir şey işaretlemesi gerekmez).
- **Arşivlenen modülün açık işleri `dropped` olur,** blok serileri kapanır, ritimleri pasifleşir. Verisi silinmez. Modülün teklif ettiği kayıtlar (`key` taşıyanlar) geri çekilmiş sayılır: modül yeniden etkinleştirilip aynı `key` ile yeniden teklif edince (`onActivate`) geri gelir. Kullanıcının elle eklediği işler ve arşivden önce kendi kapattığı kayıtlar geri gelmez.
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
