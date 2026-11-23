# Modül sözleşmesi

Her modül çekirdeğe aynı sözleşmeyle bağlanır. Sözleşmenin dışındaki her şey (kendi tabloları, ekranları, hesapları) modülün kendi işidir. Çekirdek hiçbir modülü adıyla tanımaz; yalnızca `registry.ts` içindeki tanımları dolaşır.

## Bir modülün dosyaları

```
src/modules/<slug>/
  module.ts        ModuleDefinition (aşağıda)
  queries.ts       modülün kendi sorguları ve mutasyonları
  rules.ts         olay dinleyicileri: iş, ritim, blok ve soru üretimi
  ingest.ts        dışarıdan gelen veriyi işleyenler (Ç3d; isteğe bağlı)
  jobs.ts          zamanlanmış işler (Ç3d; isteğe bağlı)
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
| `@/core/ui/module/ModuleProvider` | `useModule()`: ekran bileşeninin bağlamı (`row`, `definition`, `ctx`); `useModuleChains()` (Ç3g): bugünün dizileri, salt okunur |
| `@/core/app/hooks` | `useModuleQuery(row, anahtar, fn)`: modülün bağlamıyla hesaplanan ve her veri değişiminde tazelenen sorgu; `useNow()`: ortak saat |
| `@/core/app/actions` | `useRefreshAll()`: modül kendi bağlamıyla bir şey yazdıktan sonra ekranı hemen tazeler |
| `@/core/ui/Notices` | `useNotify()`, `SAVE_FAILED`: ekranın altındaki tek satırlık bildirim |
| `@/core/ui/kit` | Bileşen takımı: cam dilinin ortak parçaları (`docs/tasarim/parcalar.md`; `StepRunner` dahil), `useReducedMotion()`, `useReducedTransparency()` (Ç4b) |
| `@/core/ui/tokens` | Tasarım değerleri veri olarak: `token(ad)`, `TOKENS` (Ç4b; renk ya da ölçü yazılmaz, buradan alınır: `CLAUDE.md` "Tasarım") |
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
  color: string                      // #rrggbb; varsayılan renk. Kurulumda modules.color'a kopyalanır, sonra kullanıcınındır (Ç3e)
  facets?: (ctx: ModuleContext) => Promise<ModuleFacet[]>   // Ç3e: bölümler; aşağıda "Bölümler"

  // 1. Ana ekrana ne verir
  chip: (ctx: ModuleContext) => Promise<ChipData>          // tek satır durum + sağlık
  nowCard?: (task: Task) => NowCardContent | null           // kendi işleri için özel kart içeriği
  alerts?: (ctx: ModuleContext) => Promise<Alert[]>         // en fazla 1 tanesi gösterilir
  hostsClosing?: (ctx: ModuleContext) => Promise<boolean>   // Ç4c: akşam kapanışını kendi sahnesinde barındırıyor mu (aşağıda "Diziler", kural 6)

  // 2. Hangi girişleri kabul eder
  intake: IntakeType[]
  blocks?: StructuredBlockHandler[]                         // yapıştırılan yapılı bloklar (`sherpa` bloğu)

  // 3. Olaylar
  emits: string[]                                           // yayınladığı olay türleri; '<slug>.' ile başlar
  on?: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>>

  // 4. Hayat moduna tepki. Ç4a: hayat modu kalktı; isteğe bağlı, kabul edilir ama okunmaz
  modeBehavior?: Partial<Record<LifeMode, ModeBehavior>>

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

  // Uygulama kapalıyken (Ç3d; aşağıda "Sunucu zemini")
  ingest?: IngestType[]                                     // dışarıdan gelen veri: POST /api/ingest/<slug>/<kind>
  jobs?: ModuleJob[]                                        // zamanlanmış işler

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

// Ç4a: kullanılmıyor. Bildiren eski modül reddedilmez; çekirdek denetlemez, yazmaz, okumaz.
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
| 5 | ~~Mod davranışını bildirir~~ | Ç4a'da kalktı: hayat modu yok. `modeBehavior` gönderen modül kırılmaz, alan yok sayılır |
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
| Bileşen takımı | Tablo (satır içi düzenleme, süzgeç), zaman çizelgesi, ızgara, çizgi ve çubuk grafik, sayı adımlayıcı, seçim çipleri, zamanlayıcı, adım yürütücü (`StepRunner`), boş ve hata durumları | Bunları kullanır; yetmediği yerde kendi bileşenini yazar |
| Sahne (Ç3c) | İş çalışırken Bugün ekranını sahneye bırakma, üstte çekirdeğin şeridi, çıkış ve dönüş, hata sınırı | Kendi işleri için sahne bileşenini ve ne zaman geleceğini verir (aşağıda "Sahne") |
| Sesli anlatım (Ç3c) | `say`: cihazın sesiyle, sıralı, kesilebilir anlatım; cihaz başına ayar | Ne söyleneceğine karar verir |

```ts
type ModuleUi = {
  tabs: { key: string; label: string; component: ComponentType<ModuleViewProps> }[]   // en az bir; ilki varsayılan
  routes?: { path: string; title?: string; component: ComponentType<ModuleViewProps> }[]   // /m/<slug>/ altında; 'kayit/:id'
  fullscreen?: { key: string; label: string; component: ComponentType<ModuleViewProps> }[] // /m/<slug>/tam/<key>
  actions?: { key: string; label: string; run: (ctx: ModuleUiContext) => void | Promise<void> }[]
  settings?: ComponentType
  history?: ComponentType            // 4. bölge; yoksa çekirdek haftalık harcanan süreyi gösterir
  scene?: ModuleScene                // Ç3c: iş çalışırken Bugün ekranını devralan görünüm (aşağıda)
  scenes?: Record<string, ModuleScene>   // Ç3e: adı verilen sahneler; bölümler bunlara başvurur
  backdrop?: ComponentType<ModuleBackdropProps>   // Ç4b: modülün kendi zemini (aşağıda)
  areaViews?: ModuleAreaView[]       // Ç4c: alanının sayfasına verdiği görünümler (aşağıda "Alan sayfası")
  page?: ModulePage | ((module: ModuleRow) => ModulePage)  // Okul çekirdek A: sayfanın biçimi (aşağıda "Modül sayfası")
}

type ModuleViewProps = { params: Record<string, string> }   // alt sayfalarda ':id' gibi parçalar

// Okul çekirdek A (23 Kas 2026): modül sayfasının biçimi; her alan isteğe bağlı, vermeyen modülde sayfa eskisi gibi
type ModulePage = {
  home?: { label: string; component: ComponentType<ModuleViewProps> }  // ilk giriş, bölüm değil ("Ana sayfa"); /m/<slug>
  facetView?: ComponentType<ModuleFacetViewProps>   // bölüm sayfası: listedeki her bölüm bir giriş; /m/<slug>/bolum/<anahtar>
  pickLabel?: string                 // telefondaki seçicinin, bölüm seçili değilken yazısı ("Ders seç"); varsayılan "Bölüm seç"
  status?: boolean                   // 1. bölgenin durumu: çip metni, "dikkat / geride", haftanın sayıları ve önerileri; varsayılan true
  subtitle?: (ctx: ModuleContext) => Promise<string | null>   // status kapalıyken adın altındaki kısa satır ("2026 Güz")
  upcoming?: boolean                 // 2. bölge "Yaklaşanlar"; varsayılan true
  history?: boolean                  // 4. bölge "Geçmiş" ve düğmesi; varsayılan true
  entries?: boolean                  // 5. bölge "Giriş ve ayarlar"; varsayılan true
}
type ModuleFacetViewProps = { facet: { key: string; name: string; color: string }; params: Record<string, string> }

// Ç4c: alan sayfasına bir görünüm; yoğun camlı panelde, başlığı ve sağında modülün adıyla çizilir
type ModuleAreaView = {
  key: string                        // küçük harf, rakam, tire, alt çizgi; modülde tekil
  title: string                      // panelin etiketi ("Son 14 gün · temel adımlar")
  component: ComponentType<{ device: 'pano' | 'telefon' }>   // useModule() ile kendi bağlamına ulaşır
  wide?: boolean                     // panoda geniş sütun
}
```

### Modül sayfası (Okul çekirdek A)

Modül, sayfasının biçimini `ui.page` ile verir (sabit bir nesne ya da modülün satırının fonksiyonu: ayara bağlıysa; fonksiyon hata verirse sayfa düz haliyle açılır). Vermeyen modülün sayfası olduğu gibidir. Gerekçe: Okul'un ana sayfası ve ders seçimi (`docs/moduller/okul-cekirdek-notlari.md`, madde 4 ve 5; kareler `AnaSayfa`, `DersSecici`, `PanoAna`).

1. **Girişler.** Sırayla: ilk giriş (`home`, bölüm olmayan "Ana sayfa"; varsa `/m/<slug>` onu açar), sekmeler (`tabs`; `home` varsa boş olabilir), bölüm sayfaları (`facetView` varsa modülün bölüm listesindeki her bölüm bir giriş; adres `/m/<slug>/bolum/<anahtar>`; bileşen bölümü çözülmüş rengiyle alır). `bolum` ve `tam` çekirdeğe ayrılmıştır. Listede olmayan bölümün sayfası "Bu modülde böyle bir sayfa yok." der.
2. **Seçim.** Panoda girişlerin hepsi sekmedir (bölümün renk noktasıyla; sığmazsa yana kayar). Telefonda `home` ya da `facetView` veren modülde ilk giriş ayrı bir hap, kalanlar kit'in açılır seçicisindedir (`Picker`; seçili değilken `pickLabel`; her satırda renk noktası, ad ve bölümün `detail` satırı). Vermeyen modülde telefonda da sekmeler (eskisi gibi).
3. **Sayfa başı.** `status: false` durum şeridinin tamamını kapatır: çip metni, "dikkat / geride" etiketi, haftalık raporun sayıları ve önerileri. Sayfa başı o zaman ad, varsa alanın adı (bağlantı) ve modülün kısa alt başlığıdır (`subtitle`; ucuz ve salt okuyan; örneğin dönem). Çekirdeğin yedek "İş ekle"si de çıkmaz; modülün kendi `actions`'ı ve tam ekran bağlantıları durur (her girişte aynı; yalnızca bir girişte istenen düğmeyi modül o girişin gövdesine koyar). Bugün'deki modül hapı, Modüller listesindeki satır ve alan sayfasındaki panel bu ayardan etkilenmez.
4. **Bölgeler.** `upcoming: false` "Yaklaşanlar"ı, `history: false` "Geçmiş"i ve düğmesini, `entries: false` "Giriş ve ayarlar"ı kaldırır (modül ayarlarına Ayarlar → Modüller'den gidilir). Panoda sağ sütun (Yaklaşanlar, Geçmiş) yoksa gövde genişliğin tamamını alır.
5. **Bölümün satırı.** `ModuleFacet.detail` (en çok 120 karakter) seçicide adın altında durur ("YZV303E · sıradaki: Midterm · 30 Kas"); bölüm listesi her veri değişiminde yeniden hesaplandığı için güncel kalır.

Örnek: `deneme`'nin ayarlarında "Sayfa: ana sayfalı" açılınca ana sayfa (bütün açık kayıtlar tarih sırasıyla), her bölümün sayfası, kapalı durum şeridi ("Sınama dönemi"), kapalı "Yaklaşanlar", "Geçmiş" ve "Giriş ve ayarlar". Test: `tests/e2e/module-page.both.spec.ts`, `src/core/contract/registry.test.ts`.

### Alan sayfası (Ç4c)

`/a/<alan>`, alanın (`area.slug`) etkin ve duraklatılmış üye modüllerini toplar: başlıkta alanın adı ve üyeleri; her üye için bir panel (renk noktası, ad, çipin durum metni, haftalık raporun ilk üç sayısı; dokununca modülün sayfası; duraklatılan soluk ve "duraklatıldı"); altında etkin üyelerin `ui.areaViews` görünümleri, her birinin sağ üstünde kaynağı. Girişler: Modüller'deki alan panelinde "Alan sayfası" ve modül sayfasının başlığında alanın adı. Kurallar: görünüm salt okur (yazmaz, eylem düğmesi koymaz), kendi modülünün bağlamıyla okur (`useModule()`, `useModuleQuery`), kit'in parçalarını ve token'ları kullanır; hata verirse yalnızca kendi paneli "Bu görünüm açılamadı." der. Sayfanın metrikleri tasarlanmadı (13 Kas 2026 kararı: en az iki modül iki hafta kullanıldıktan sonra); tek bir "puan" yoktur. Modüller arası türetilmiş metriğin yeri (çekirdek mi, alan mı) o tasarımda belirlenir (`docs/moduller/rutin.md`, çekirdek notu 12). Örnek: Rutin'in "Son 14 gün · temel adımlar" görünümü (sabah ve akşam, gün başına bir kare).

```ts

// Ekran bileşenleri bağlama `useModule()` ile ulaşır (src/core/ui/module/ModuleProvider).
type ModuleUiContext = ModuleContext & {
  openIntake: (key: string) => void  // hızlı girişi modülün bir giriş türünde açar
  extract: <T>(extractor: string, text: string, options?: { publishedAt?, context? })
    => Promise<{ status: "ok", suggestions: T[], note } | { status: "skipped" | "failed" | "unknown" }>
                                     // yapıştırılan metni modülün okuyucusuyla okutur (yapay zeka)
  navigate: (path: string) => void   // /m/<slug>/ altında bir yola gider
  say: Say                           // Ç3c: sesli anlatım (aşağıda)
}
```

### Modülün zemini (Ç4b)

Ekranlar cam dilinin zeminindedir (`docs/tasarim/ilkeler.md`, karar 2–4): Bugün, sahne ve giriş tam manzarada, öbürleri sakin zeminde. Modül isterse **kendi zeminini** verir (`ui.backdrop`); o zaman hem modül sayfasında hem bütün sahnelerinde, sahnenin tonunun yerine kullanılır. Modüller listesinden modüle girerken zemin çapraz solar.

```ts
type ModuleBackdropProps = {
  device: "pano" | "telefon"
  color: string                  // modülün rengi (kullanıcınınki, yoksa varsayılan); sahnede işin rengi: bölümü varsa bölümün çözülmüş rengi
                                 // (renk çözümleyiciden, `workColor`; Ayarlar'dan değişen renk anında yansır; Okul çekirdek A)
  sky: { phase: "night" | "dawn" | "day" | "dusk"; elevation: number }   // saatin gökyüzü, zemin saate bakacaksa
}
```

Kurallar: zemin durağandır (sürekli hareket yok; panoda gün boyu açık kalır) ve yalnızca çizimdir (yan etkisiz; çekirdek onu telefonda saat şeridinin yerinde, ekranın tam boyunda bir kez daha çizer: `docs/tasarim/ekranlar/menu.md`, "Saat şeridi ve ada"), renklerini token'lardan ya da kendi renginden alır (`CLAUDE.md` "Tasarım"; sabit renk kodu yazmaz), üstündeki cam ve metin çekirdeğindir: zemin metni okutmayacak kadar parlarsa modül zeminini koyulaştırır (en az 4,5:1). Panellerin, düğmelerin ve satırların görünüşü değişmez; modül yalnızca zemini verir. Çekirdek ekranlarında (Bugün, Takvim) modül yine yalnızca renk noktasıyla görünür. `deneme` örneği: kendi renginin bir köşede parladığı koyu zemin (`src/modules/deneme/components/Backdrop.tsx`).

Zemin vermeyen modülün sayfası sakin zemindedir; sahnesi tonunun zeminindedir: `calm` saatin tam manzarası, `focus` koyu ve düz, `energy` işin renginden koyuya geçiş (`docs/tasarim/ekranlar/sahne.md`).

### Sahne (Ç3c)

Modül, kendi işi çalışırken Bugün ekranını devralan bir **sahne** verebilir: arka plan, kendi düğmeleri, adımlar, sayaçlar. Tasarımın gerekçesi `docs/12-sahne-ve-otomasyon.md`, bölüm A.

```ts
type ModuleScene = {
  when: (subject: SceneSubject) => boolean     // bu iş için sahne var mı (türüne, kaynağına, meta'sına göre)
  component: ComponentType<SceneProps>
  look?: { tone: 'calm' | 'focus' | 'energy' } // çekirdeğin geçiş ve arka plan tonu
  keys?: 'scene'                               // Ç3g: sahne açıkken Bugün'ün tuşları (Boşluk ve öbürleri) sahnenindir
  welcome?: ComponentType<SceneWelcomeProps>   // Sabah açılışı (16 Kas 2026): iş başlamadan önceki karşılama (kural 7)
}

type SceneWelcomeProps = {                     // Sabah açılışı: oturum yok; karşılama yalnızca başlatmayı ister
  subject: SceneSubject                        // uyanış dizisinin ilk işi ("Başla"nın başlatacağı; henüz çalışmıyor)
  device: 'pano' | 'telefon'
  woke: Date | null                            // uyanış zaten kayıtlıysa (dışarıdan, `core/wake`); null: "Başla" önce uyanışı yazar
  controls: {
    start: (minutesAgo?: number) => Promise<void>   // "Başla": uyanışı (şimdi ya da 15/30/60 dk önce; `woke` varsa yazmaz) "Uyandım"ın yoluyla
                                                    // kaydeder, işi başlatır; sahne karşılamanın yerine gelir. Yazılamazsa reddeder, karşılama kalır
    later: () => void                          // "Şimdi değil": Bugün; o gün hiçbir cihazda karşılama bir daha kendiliğinden gelmez (gün kaydı)
  }
  today: TodayBrief                            // yalnızca okuma; "Başla"dan önce söylenmez
  ctx: ModuleUiContext
  facet: { key: string; name: string; color: string } | null
}

type SceneSubject =
  | { kind: 'task'; task: Task; workItem: WorkItem | null }
  | { kind: 'rhythm'; rhythm: Rhythm }

type SceneProps = {
  subject: SceneSubject
  session: { id: string; startedAt: Date; elapsedSeconds: number; day: string }
                                     // sunucudaki başlangıçtan; her cihazda aynı. Ç3g: day, başlangıcın planlama günü ("YYYY-MM-DD"; olaydaki `day` ile aynı)
  device: 'pano' | 'telefon'
  controls: {
    finish: (counted?: number | null) => Promise<void>   // çekirdeğin "Bitti"si. Okul çekirdek A: counted, sahnenin saydığı dakika (aşağıda kural 3b)
    stop: (counted?: number | null) => Promise<void>     // "Durdur"; counted aynı
    stuck: () => void                // "Takıldım" akışını açar (sahneden çıkar)
    exit: () => void                 // sahneden çık; oturum sürer
    closing: () => Promise<'confirmed' | 'skipped'>
                                     // Ç3f: akşam kapanışını sahnenin içinde açar (aşağıda "Diziler"). Ç4c: nasıl bittiğini döndürür ("Onayla": confirmed, "Vazgeç": skipped)
    bed: () => Promise<boolean>      // Ç3f: "Yatıyorum": yatışı kaydeder, oturumu "Bitti" ile kapatır. Ç3g: yatış aralığından 2 saatten çok önceyse önce sorar; "Vazgeç"te false döner, hiçbir şey değişmez
  }
  say: Say
  today: TodayBrief                  // günün kısa özeti (anlatım için; yalnızca okuma)
  ctx: ModuleUiContext
  facet: { key: string; name: string; color: string } | null   // Ç3e: çalışan işin bölümü; color çözülmüş renk
  chain: SceneChain | null           // Ç3f: çalışan iş bir çapalı dizinin parçasıysa o dizi
  bedtime: { at: Date; until: Date; undo: () => Promise<'undone' | 'expired' | 'changed'> } | null
                                     // Rutin 1: bu sahnenin bed()'i yatışı yazdı ve hâlâ geri alınabiliyor (aşağıda "Diziler", kural 6)
  strip: (strip: SceneStrip | null) => void
                                     // Ç3g: şeridin bu ekrandaki hali (kural 2); null çekirdeğinkine döndürür
  keys: { listen: (handler: (key: SceneKey) => void) => () => void } | null
                                     // Ç3g: sahne tuşları devraldıysa (ModuleScene.keys) Bugün'ün tuşları buraya gelir; yoksa null
}

type SceneStrip = { title?: string; since?: Date | null; hidden?: boolean; allotted?: number | null; detail?: string | null }
                                     // title: işin adı yerine; since: süre bu andan (null: süre yok); hidden: şerit yok
                                     // Okul çekirdek A: allotted: ayrılan dakika (yoksa işin planlanan süresi; null: yalnızca geçen);
                                     // detail: sürenin yerine kısa yazı ("2 / 4")
type SceneKey = 'space' | 'enter' | 'e' | 'x' | 'r'
```

Kurallar:

1. **Ne zaman.** `plan.now` `running` ise, çalışan işin (iş ya da ritim; plansız oturumda sahne yoktur) modülü `scene` tanımlamışsa ve `when` doğru dönerse Bugün ekranı sahneyi çizer. Öneri durumunda standart kart kalır. İş bitince, durunca ya da ertelenince standart ekran döner. `when` hata verirse sahne yok sayılır.
2. **Çekirdeğin şeridi.** Sahnenin üstünde ince bir şerit durur: saat, işin adı, geçen süre, "Çık". Şerit çekirdeğindir: "Çık" standart ekrana döner; oturum sürer, kartta "Sahneye dön" çıkar. Çıkış cihaza özgüdür (öbür cihaz sahnede kalır) ve o oturum için hatırlanır. **Ç3g:** sahne gösterdiği ekran için şeridin içeriğini verebilir (`strip`): işin adı yerine başka bir ad (bütün sabah "Sabah"), sürenin başka bir andan sayılması (uyanıştan) ya da hiç süre yazılmaması (`since: null`); açılış ve kapanış gibi kendiliğinden geçen ya da kendi çıkış yolu olan ekranlarda şeridi gizleyebilir (`hidden`: "Çık" da yoktur). Ekran değişince yeniden çağırır; `strip(null)` çekirdeğin haline döner, yeni oturum çekirdeğin haliyle başlar. Hiç çağırmayan sahnede şerit bugünkü gibidir. **Okul çekirdek A (23 Kas 2026):** şeridin süresi bütün modüllerde "geçen / ayrılan"dır ("26 dk / 2 sa"): geçen duvar saatiyle (mola dahil), ayrılan çalışan işin planlanan süresi (görevin ya da ritmin `est_minutes`'ı); ayrılan yoksa yalnızca geçen. `since` ile başka bir andan sayan sahne kendi ayrılanını verebilir (`allotted`; Rutin'in sabahı bütün sabah dizisinin dakikası), `detail` ile sürenin yerine kısa bir yazı koyabilir (kontrol listesinde "2 / 4").
3a. **Tuşlar (Ç3g).** Sahne `keys: 'scene'` bildirirse sahne açıkken Bugün'ün tuşları (`Space`, `Enter`, `E`, `X`, `R`; `docs/05` "Klavye") çekirdeğin değil sahnenindir: çekirdek onları yalnızca `SceneProps.keys.listen` ile verdiği dinleyicilere iletir (yazarken, pencere açıkken, sahneden açılan kapanışta ve odakta bir düğme ya da bağlantı varken `Space`/`Enter` iletilmez). Adımlı sahne `Space`'i "Sonraki" yapar; işi bitirmek sahnenin `controls.finish()`'idir. Bildirmeyen sahnede tuşlar standart karttaki gibidir (`Space` "Bitti"). Sahne `window`'da kendi tuş yakalamasını kurmaz.
3b. **Sayılan dakika (Okul çekirdek A, 23 Kas 2026).** Sahne oturumu kapatırken çekirdeğe sayılan dakikayı bildirebilir: `controls.finish(counted)`, `controls.stop(counted)` (molasız odak; pomodoro ve akışın molaları dışarıda). Değer 0 ile geçen dakika arasında olmalıdır; dışındaysa yok sayılır ve geçen süre kullanılır; bildirilmezse bugünkü gibi. Kalan efor (`effort_done_minutes`), öğrenme (tahmin çarpanı), modülün sonucu (`onOutcome`'un `spentMinutes`'ı) ve yapay zekanın benzer işleri sayılan dakikayı kullanır; oturumun saat aralığı (başlangıç, bitiş), kapasite çarpanı ve şeritteki "geçen" duvar saatidir. `core.session_ended` yükünde `minutes` geçen dakika, `counted` sayılan dakika (yoksa `null`). Tur, mola ve duraklatma sahnenin iç işidir; çekirdek bilmez (durumu cihazlar arası tutarlı kalsın diye modülün tablosunda tutulur; kit'in yerleşimleri bunun için saf durum verir, aşağıda "Sahne yerleşimleri"). Test: `tests/db/counted-minutes.test.ts`, `src/core/planner/learn.test.ts`.
3. **Oturum çekirdeğindir.** Başlatma, bitirme, ölçme, "Devam ediyor musun?" ve 30 dakika kuralı değişmez; sahne oturumu yalnızca `controls` ile etkiler.
4. **Sahne serbesttir** ama çekirdeğin tasarım dilini ve temasını kullanır, hareket azaltma tercihine uyar. Pano ve telefon aynı sahneyi kendi yerleşimiyle çizer (`device`). Sahnenin kalıcı durumu (hangi adımdayım) modülün kendi tablosundadır; ekranda tutulan durum öbür cihaza taşınmaz.
5. **Hata.** Sahne bileşeni hata verirse çekirdek standart kartı gösterir ve tek satırla bildirir ("Sahne açılamadı; iş sürüyor."); oturum etkilenmez.
6. **Tam ekranla ilişkisi.** `fullscreen` kullanıcının modül sayfasından açtığı görünümdür; sahne iş çalışırken Bugün ekranında kendiliğinden gelir. Aynı bileşen ikisinde de kullanılabilir.
7. **Karşılama (sabah açılışı; kullanıcının kararı, 16 Kas 2026).** Sahne bir karşılama verebilir (`welcome`): işi başlamadan önce, sabah uygulama Bugün yerine onunla açılır. **Ne zaman** (saf `welcomeOf`, `src/core/today/welcome.ts`): günün çerçevesi açık; bugünün uyanış kaydı yok ya da uyanış dışarıdan kaydedildi (`core/wake`; ekranda söylenen ya da dokunuştan tahmin edilen uyanışta karşılama yoktur, o an geçmiştir); saat bugünün uyanış aralığının başı (o günün beklenen uyanışı, `lastNight.expectedWake`, daha erkense o: "Yarın erken kalkacağım" denen sabah ya da uyanışı aralığın başından önceye çeken erken bir sabit blok) ile en geç uyanıştan (`lastNight.latestWake`) 2 saat sonrası arasında; çalışan oturum yok; uyanış dizisi başlamamış (içinde bugün yapılan, çalışan ya da "Ertele" denen iş yok; uyanış kayıtlıysa dizinin tamamı hâlâ sırada) ve o gün "Şimdi değil" denmemiş (`days.welcome_later_at`; yazılamazsa, örneğin bağlantı yokken, söylendiği ekranda o sayfa açık kaldıkça tutulur, yeniden açılan sayfada karşılama gelebilir; hesabın bütün cihazları için, canlı eşitlemeyle: bir cihazda denince öbüründeki karşılama da kapanır; bir cihazda "Başla" denince öbürü de sahneye geçer, çünkü açık oturum varken karşılama yoktur). O zaman dizinin ilk işinin modülü etkinse, iş bir görev ya da ritimse (henüz oturum işi açılmamış kalemde karşılama yoktur), o iş için seçilecek sahnenin (bölümün sahnesi, yoksa varsayılan; kural 1 ve "Bölümler" kural 5) `welcome`'ı varsa Bugün yerine karşılama çizilir. Sahneleyen modül yoksa Bugün olduğu gibidir (Günaydın kartı). Dışarıdan gelen uyanışta `start_on_wake` diziyi o an kendisi başlatıyorsa ("Diziler" kural 5) karşılama araya girmez. Akşam için karşılama yoktur. **Çekirdek** kabuğu verir (telefonda ekranın tamamı, panoda yan menünün yanında sayfa; sahnenin zemini, güvenli alan; şerit yoktur, çünkü oturum yoktur), "Başla"dan sonra sahne gelene kadar karşılamayı tutar, karşılamaya dokunuşu uyanış tahmini saymaz ve Bugün'ün tuşlarını karşılama açıkken dinlemez (düğmeler Boşluk ve Enter'ı kendileri alır). **Modül** bütün ekranı çizer: "Günaydın", tek birincil "Başla", küçük "Biraz önce uyandım" (yalnızca `woke` yokken; 15/30/60 dk) ve "Şimdi değil". "Başla"dan önce konuşmaz (sesli özet "Başla"nın dokunuşuyla açılır; sahne söyler). Karşılama hata verirse çekirdek, sayfa açık kaldıkça o gün Bugün'ü gösterir (yeniden yüklenen sayfa bir kez daha dener). "Başla"dan sonra başka bir ekran o arada bir iş başlatmışsa burada hiçbir şey başlamaz ve karşılama hemen bırakılır. Kayıt `welcome`'ın bir bileşen olduğunu denetler; tanımlandığı yer `component` gibidir. Örnekler: Rutin'in sabah sahnesi (`docs/tasarim/ekranlar/rutin.md`, "Karşılama"), `deneme`'nin odak ve antrenman sahnesi.

**Nerede tanımlanır.** `scene` nesnesi (`when` dahil) modülün sıradan bir dosyasında (`module.ts` ya da `scene.ts`) tanımlanır; yalnızca `component` `"use client"` dosyasından gelir. İstemci dosyasının dışa aktardığı nesne sunucuda yalnızca bir başvurudur: `when` orada fonksiyon olmaz ve kayıt denetimi uygulamayı açtırmaz.

### Diziler (Ç3f)

Uyanışa ve yatışa bağlı işler (`timing.anchor`) o gün birer **dizi** oluşturur: uyanış dizisi ve yatış dizisi. Dizideki iş çalışırken sahne bütün diziyi görür, başka modüllerin işleri dahil; bir iş bitince sıradaki kendiliğinden başlayabilir. Gerekçe `docs/12-sahne-ve-otomasyon.md`, bölüm G.

```ts
type SceneChain = {
  anchor: 'wake' | 'bed'
  items: {
    id: string                         // iş, kalem ya da ritim kimliği (kalemin oturum işi açıksa o iş)
    title: string
    module: { slug: string; name: string }
    facet: { key: string; name: string } | null
    color: string                      // çözülmüş renk (Bölümler, kural 4)
    minutes: number                    // planlanan süre
    state: 'done' | 'running' | 'next' | 'passed'   // bugün yapıldı, çalışıyor, sırada, bugün geçildi (ertelendi ya da zamanı geçti)
    mine: boolean                      // bu sahnenin modülünün işi mi
  }[]
}
```

1. **Türetilir.** Dizi planın çapalı yuvalarından ve bugünün kayıtlarından saf bir yardımcıyla kurulur (`chainOf`, `src/core/today/chain.ts`); planlayıcının girdisi ve çıktısı değişmez. Sıra planlayıcınındır (`order`, eşitse skor); bugün yapılan işler `done` olarak listede kalır.
2. **Başka modülün işi yalnızca görünür.** Satır yalnızca yukarıdaki alanları taşır; `source`, `meta` ve modülün verisi gelmez. Modüller birbirini tanımamaya devam eder.
3. **Sıra modüller arasında ortaktır.** `timing.order` 1–99 arası tek bir sayı ekseni; modüller araya yer bırakarak numara verir (10, 20, 30). Kullanıcı formdan değiştirebilir (alan kullanıcıya aittir).
4. **Kendiliğinden devam.** `settings.day_frame.chain_auto` açıkken (başlangıçta açık) dizideki çalışan iş "Bitti" ile kapanınca ya da çalışırken ertelenince dizinin sıradaki işi aynı cihazda hemen başlar; başka modülün işiyse onun sahnesi (yoksa standart kart) gelir. Durdur, Takıldım ve cevapsız kapanıştan sonra başlamaz; son iş bitince standart ekran döner. Başlatma çekirdeğin oturum yolundandır; kendiliğinden başlayan oturum her oturum gibidir ("Devam ediyor musun?" ve 30 dakika kuralı aynı). İki cihaz aynı anda bitirse de tek oturum başlar.
5. **Dışarıdan gelen uyanış.** Uyanış dışarıdan kaydedildiyse (`core/wake`) ve o gün uyanış dizisi hiç başlamadıysa, `start_on_wake` açıkken uygulama o cihazda ilk öne geldiğinde, dizi hâlâ önerilirken (bitişinden 60 dakika sonrasına kadar), dizinin ilk işi başlar. Elle "Uyandım"ın davranışı değişmez.
6. **Sahneden kapanış.** `controls.closing()` akşam kapanışını sahnenin içinde açar: çekirdeğin şeridi durur, oturum sürer; kapanış onaylanınca ya da vazgeçilince sahneye dönülür. Bu kapanışta "Onayla ve yat" yoktur: yatışı sahnenin kendi son adımı kaydeder, `controls.bed()` ile (çekirdeğin "Yatıyorum"u: yatışı şimdi olarak yazar, çalışan oturumu "Bitti" ile kapatır, ekran geceye geçer). Kapanışın yapıldığı `today.closed` ile okunur.
   **Kapanışın yeri (Ç4c; kullanıcının kararı, 15 Kas 2026).** Kapanışın ayrı sayfası ve Bugün'deki "Günü kapat" yoktur; kapanış çekirdeğin yeteneği olarak kalır ve yalnızca bir sahnenin içinde açılır. `controls.closing()` kapanış bitince çözülür: "Onayla" ile `confirmed`, "Vazgeç" (kapanışı atlar, sahne sürer) ya da sahnenin kapanması ile `skipped`; sahne buna göre sıradaki adımına geçer (beklemeden çağıran eski sahne de çalışır). Çekirdek modüle bağımlı olmaz: modül kapanışı o an barındırdığını `hostsClosing` ile söyler (ucuz ve salt okuyan; çip gibi her veri değişiminde yeniden sorulur, hata verirse "hayır" sayılır). Etkin hiçbir modül barındırmıyorsa Bugün'ün akşam kartında ikincil "Kapanış" düğmesi görünür ve kapanış standart sahne kabuğunda açılır (çekirdeğin şeridi "Akşam kapanışı" ve "Çık"; oturum yoktur; `ClosingShell`). Akşam sahnesi hiç açılmazsa kapanış atlanmış olur: sabah plan kendiliğinden kurulur, cevaplanmamış sorular ertesi güne kalır. Örnekler: Rutin akşam rutininde "Yarının listesi" adımı açıkken barındırır (adım gelince kapanışı açar); `deneme` açık bir akşam "rutin" kaydı varken (gece sahnesinde "Günü kapat").
   **Yatışın geri alınması (Rutin 1, 14 Kas 2026).** `bed()` gün kaydına yatışı yazan oturumu da yazar (`days.bed_session_id`). Yatıştan sonraki 10 dakika boyunca gece ekranı o oturumun sahnesidir (her cihazda, sayfa yenilense de; şerit yoktur, iş çalışmıyor): sahne `SceneProps.bedtime` alır (`at`, `until`, `undo`). `undo()` ("Geri al") yatışı hiç yazılmamış gibi kaldırır: yatış ve işaret silinir, oturumun "Bitti"sinin yaptığı geri alınır (ritim kaydı silinir; iş yeniden "yapılıyor", dakikaları kalemden düşülür), oturum kendi başlangıcıyla yeniden açılır ("Devam ediyor musun?" o andan sayılır). Uyku planı, yarının beklenen uyanışı ve planın kendisi gün kaydından türediği için kendiliğinden yeniden hesaplanır; ekran yeniden çalışan işin sahnesidir ve modül kendi tablosundaki yerden sürer. Çekirdek bütün modüllere `core.bed_undone` (`{ date }`), işin modülüne aynı `session_id` ile yeniden `core.session_started` söyler. 10 dakika geçtiyse `expired`; yatış başka yoldan yazıldıysa ya da silindiyse (çekirdeğin "Yatıyorum"u, kapanışın "Onayla ve yat"ı, `core/bed`: hepsi işareti siler) ya da yatıştan sonra başka bir iş başladıysa (bitmiş olsa da) `changed` döner ve hiçbir şey değişmez. Bu sürede çalışan iş yoktur: `finish`, `stop`, `stuck`, `exit`, `closing` etkisizdir; ikinci bir `bed()` yatışı yeniden yazar. Sınır: geç bir yatışın yarının kapasitesini düşürüp tetiklediği haftanın yeniden taahhüdü (`capacity_lost`) geri alınmaz; taahhüt kapasite artınca yeniden kurulmadığı için (plan istikrarı, `docs/04` "Hafta") hafta düşürülmüş taahhütle kalır, günün planı ise kendiliğinden düzelir. İki cihaz aynı anda geri alırsa tek sonuç olur (veritabanı fonksiyonu `undo_scene_bed`, gün satırını kilitler). Test: `tests/db/bed-undo.test.ts`; örnek: `deneme`'nin gece sahnesi.
7. **Standart kart.** Sahnesi olmayan ya da sahneden çıkılmış çapalı işte Şimdi kartı dizideki yeri tek satırla gösterir.

**Modül sayfasında dizi (Ç3g).** Modülün kendi ekranları bugünün uyanış ve yatış dizilerini `useModuleChains()` ile salt okunur alır: `{ wake: SceneChain | null; bed: SceneChain | null }`, sahnedeki `chain` ile aynı alanlar (kural 2: başka modülün satırında yalnızca ad, modül, bölüm, renk, süre, durum; `mine` bu modülün işidir). Dizi yoksa (çerçeve kapalı, çapaya bağlı iş yok) `null`. Modül başka modülün işini kendi listesinde gösterebilir ama düzenleyemez; satır o modülün sayfasına (`/m/<slug>`) götürür. Örnek: `deneme`'nin Kayıtlar sekmesi; Rutin'in Sabah sekmesinde başka modülün işi kendi grubu olarak, sıradaki yerinde.

**Adım yürütücü (`StepRunner`, bileşen takımında).** Sıralı adımlı sahneler (rutin, pişirme, antrenman) için: adım listesi (ad, süre ya da tekrar sayısı, açıklama), geri sayım, "Sonraki", "Atla", her adım bitince ve liste bitince geri çağrı. Yalnızca arayüzdür; hangi adımda olunduğunu modül saklar (`step` ve `onStep` ile denetimli kullanılır).

### Bölümler (Ç3e)

Modül kendini **bölümlere** ayırabilir: veri, sayfa, ayarlar, planlama ve olaylar ortak; ana ekranda ayrı renk ve sahne (rutinde Sabah ve Akşam, Okul'da her ders, Beslenme'de prep ve alışveriş). Gerekçe `docs/12-sahne-ve-otomasyon.md`, bölüm F.

```ts
type ModuleFacet = {
  key: string                  // modül içinde tekil; küçük harf, rakam, tire; en çok 40 ('sabah', 'yzv406e')
  name: string                 // 'Sabah', 'YZV406E Derin Öğrenme'
  color: string                // #rrggbb; bölümün varsayılan rengi, kullanıcı değiştirebilir
  scene?: string               // ui.scenes içindeki sahnenin anahtarı
  tone?: 'calm' | 'focus' | 'energy'   // sahne çerçevesinin tonu; yoksa sahnenin look.tone'u
  detail?: string              // Okul çekirdek A: modül sayfasının seçicisinde adın altındaki tek satır; en çok 120
}
```

1. **Liste.** `facets(ctx)` modülün bağlamıyla hesaplanır: sabit bir liste ya da modülün verisinden (her etkin ders). Ekranlarda modülün çipi gibi tutulur ve her veri değişiminde tazelenir; çekirdek her teklifte de yeniden hesaplar (teklif anındaki liste geçerlidir). Bu yüzden `facets` ucuz olmalı (tek sorgu) ve yalnızca okumalı: içinden `propose`, `emit` ya da yazma çağrılmaz. Bölümü olmayan modülde bu alan yoktur ve her şey Ç3c'deki gibidir.
2. **Denetim.** Kayıt `ui.scenes`'i denetler (anahtar biçimi, `when` ve bileşen). Listenin kendisi bağlamla hesaplandığı için kayıtta bilinemez; her hesaplandığında denetlenir: geçersiz ya da yinelenen anahtar, geçersiz renk, `ui.scenes`'te olmayan sahneye başvuru hata verir. Hata verince ekranlar bölümleri yok sayar (renk modülünkine döner) ve teklif reddedilir. Modülün testi listeyi hesaplayıp denetlemelidir.
3. **İş bölümünü taşır.** Zarfta `facet` (aşağıda "İş zarfı ve `propose`"). Oturum işinin kendi bölümü yoksa kaleminin bölümü geçerlidir. Bölümü listeden çıkan iş (ders kalktı) anahtarını korur ve modülün rengiyle görünür; hata vermez.
4. **Renk.** Çekirdeğin bir iş için kullandığı renk tek yardımcıdan gelir (`src/core/contract/colors.ts`, `workColor`): kullanıcının bölüm rengi (`modules.facet_colors`) → bölümün varsayılan rengi → kullanıcının modül rengi (`modules.color`) → modülün varsayılan rengi. Modül düzeyindeki yerler (çip, modül payları, modül listeleri) modülün rengini kullanır (`moduleColor`). Yerlerin listesi `docs/05-arayuz.md`, "Renkler ve bölümler".
5. **Sahne.** Çalışan işin bölümü `scene` taşıyor ve o sahnenin `when`'i doğru dönüyorsa o sahne gelir; yoksa modülün varsayılan sahnesi (`ui.scene`, kendi `when`'iyle). Sahne bileşeni bölümü `SceneProps.facet` ile alır; aynı bileşen birden çok bölümde kullanılabilir (her ders aynı "ders" sahnesini kendi rengiyle).
6. **Ton.** Bölümün `tone`'u → sahnenin `look.tone`'u → `calm`. `energy` tonu çözülmüş rengi kullanır. Bölümün sahnesi `when` ile hayır deyip modülün varsayılan sahnesine düşülse de ton bölümünkidir (ton bölüme aittir, sahneye değil).
7. **Planlamaya etkisi yok.** Bölüm planlayıcının girdisi değildir ve yapay zekaya gitmez; yapay zeka bölüm seçmez (serbest girişten modüle yönlenen iş bölümsüz açılır, bölümü kullanıcı formdan ya da modül kendi giriş türünden verir).

### Sesli anlatım ve günün özeti (Ç3c)

```ts
type Say = (text: string, options?: { interrupt?: boolean }) => void

type TodayBrief = {
  work: { count: number; first: { title: string; module: string } | null }
                                     // Ç4a: bugünün planında kalan işler (çalışma penceresi; uyanışa ve yatışa bağlı işler sayılmaz), sayısı ve ilki. Günün 3 işi yok
  blocks: { title: string; startsAt: Date; endsAt: Date }[]         // bugünün sabit blokları
  bedtime: Date | null               // Ç4a: bu gecenin beklenen yatışı (kayıtlı, kullanıcının değeri, yoksa uyku planı); çerçeve kapalıysa null. Bitiş çizgisi yok
  wokeAt: Date | null
  closed: boolean                    // Ç3f: bugünün akşam kapanışı yapıldı mı
  date: string                       // Ç3g: çekirdeğin planlama günü; gece yarısından sonra, gece bitene kadar akşamın günü
  wokeFrom: 'screen' | 'outside' | 'estimate' | null
                                     // Ç3g: uyanışın kaynağı: ekrandaki "Uyandım"/"Biraz önce", dışarıdan (`core/wake`), ilk dokunuştan tahmin; uyanış yoksa ya da çerçeve kapalıysa null (`wokeAt` gibi)
  tomorrow: { wake: Date; sleepMinutes: number } | null
                                     // Ç3g: yarının beklenen uyanışı ve bu gecenin beklenen uykusu (planlayıcının çerçevesinden; gerçek yatış kaydırır, geri alınınca döner); çerçeve kapalıysa null
}
```

- Tek giriş noktası `src/core/voice/`; ilk sağlayıcı cihazın kendi konuşma sentezidir (Türkçe ses). Art arda gelen metinler sıraya girer, `interrupt` sıradakileri atar; uzun metin cümlelere bölünür.
- Ayarlar cihaz başınadır (Ayarlar → Sesli anlatım): açık ya da kapalı, ses, hız, "bu cihaz dokunuş olmadan da konuşsun". Kendiliğinden konuşma yalnızca bu ayarın açık olduğu cihazda olur; öbür cihaz yalnızca son 10 dakikada dokunulduysa konuşur.
- Anlatım kapalıysa, cihazda ses yoksa ya da tarayıcı izin vermezse `say` hiçbir şey yapmaz ve hata vermez. Cihazda Türkçe ses yoksa da sessizdir: başka dilin sesi Türkçe metni okumaz (Ç3g); Ayarlar → Sesli anlatım bunu söyler. Uçtan uca testlerde konuşma motoru ortak kurulumda sahtedir (`tests/e2e/fixtures.ts`). Sahne anlatıma bağımlı kurulmaz: söylenen her şey ekranda da yazar.
- **Yalnızca `say` konuşur.** Konuşma motoruna `say` ile istenenden başka hiçbir şey gitmez: ilk dokunuşta ısındırma, boş ya da sessiz anlatım yok; dokunuş yalnızca not edilir. Bu yüzden iOS'ta ilk anlatım bir dokunuşun içinde olmalıdır (sahnedeki "Anlat" gibi); dokunuşsuz ilk `say` reddedilirse sessiz kalır. Sayfa kapanınca kuyruk boşaltılır. Test: `tests/e2e/voice.spec.ts` (13 Kas 2026).
- Anlatılan metin ürün kurallarına uyar: suçlama ve geçmişi sayma yok.

### Günün kaydını okuma (Ç3c)

`ctx.days(sinceDay)` modülün günün çerçevesini okumasıdır (yalnızca okuma): `{ date, wokeAt, wokeEstimated, wokeFrom, bedAt, plannedWake, plannedBed }[]` (`wokeFrom` Ç3g). Sabah ve akşam rutini gibi modüller uyanış, yatış ve uyku geçmişini buradan çizer.

**Planlama günü (Ç3g).** Modül bir kaydın hangi güne ait olduğunu çekirdekten alır, kuralı kendi içinde kopyalamaz: sahnede `today.date` (şimdinin günü) ve `session.day` (oturumun başladığı an), olaylarda `core.session_started` ve `core.session_ended`'ın `day`'i, öbür yerlerde `ctx.day(at?)` (bir anın planlama günü; varsayılan şimdi). Kural `docs/04-planlayici.md` `planningDay`: gece, 05:00'te (ya da uyanış aralığı daha erken başlıyorsa onun başında) biter; ondan önceki an önceki günündür. Gece yarısından sonra basılan "Yatıyorum" böylece akşamın gününe yazılır.

Sınama modülü `deneme` her bağlantı noktasının çalışan örneğidir (`alerts` tanımlıdır ama çekirdek modül uyarılarını Ç3'te, `AlertBar` ile göstermeye başlar); yalnızca `NEXT_PUBLIC_SHERPA_DEMO_MODULE=1` verilen ortamlarda (yerel geliştirme, testler) kaydolur, üretimde kaydolmaz.

Adresler: `/m/<slug>` ilk girişi (`ui.page.home` varsa onu, yoksa ilk sekmeyi), `/m/<slug>/<sekme>` adı verilen sekmeyi, `/m/<slug>/bolum/<anahtar>` bölümün sayfasını (`ui.page.facetView`) açar; öbür yollar `routes` ile eşlenir. `tam` ve `bolum` parçaları çekirdeğe ayrılmıştır: sekme ya da alt sayfa bu adları alamaz.

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
  days: (sinceDay: string) => Promise<DayFrameRecord[]>   // Ç3c: uyanış ve yatış kayıtları (yalnızca okuma)
  day: (at?: Date) => Promise<string>                     // Ç3g: bir anın çekirdekteki planlama günü (varsayılan şimdi)
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
  timing?: Timing                      // zaman kısıtları (Ç3b); aşağıda
  facet?: string | null                // Ç3e: bölümün anahtarı; yalnızca bölümü olan modülde (yukarıda "Bölümler")
  importance?: 1 | 2 | 3 | 4
  depends_on?: string[]
  flex?: { splittable?: boolean; droppable?: boolean }
  artifact?: string
  meta?: Record<string, unknown>       // modüle özel; çekirdek yorumlamaz, yapay zekaya bağlam olarak verir
}

type TimeWindow = { days?: number[]; from: string; to: string }   // days: 1 = Pazartesi … 7 = Pazar; saatler 'HH:mm', İstanbul
type Timing = {
  windows?: TimeWindow[]               // kesin: iş yalnızca bu aralıklara yerleşir
  prefer?: TimeWindow[]                // esnek: bu aralıklarda öne geçer
  avoid?: TimeWindow[]                 // esnek: kaçınılır, başka yer yoksa yine konur
  travel?: { before?: number; after?: number }   // dakika
  rest_days?: number                   // yalnızca tekrar biçiminde: iki yapılış arasında en az bu kadar boş gün
  anchor?: 'wake' | 'bed'              // Ç3c: uyanıştan hemen sonra ya da yatıştan hemen önce (yuvalara dağıtılmaz)
  order?: number                       // Ç3c: aynı çapadaki işlerin sırası, 1–99, modüller arasında ortak (Ç3f: araya yer bırakarak 10, 20, 30); yalnızca `anchor` ile
  after_finish?: true                  // Ç3c: bitiş çizgisinden sonra, akşama da konabilir. Ç4a: gün bitiş çizgisi taşımaz; alan kabul edilir ve saklanır, planlayıcı okumaz
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
- **Zaman kısıtları (`timing`, Ç3b).** Modül, işlerinin ne zaman yapılabileceğini bildiği kadarıyla yazar: açılış saatleri, kaçınılan saatler, yol, dinlenme günü. Alanların tanımı, sınırları ve biçime göre hangilerinin kullanılabildiği `docs/03-veri-modeli.md` içinde "Zaman kısıtları" bölümündedir; planlayıcının davranışı `docs/04-planlayici.md` içinde. Beş alt alan da olgu alanıdır ve kaynağı alt alan başına tutulur (`timing.windows` …): kullanıcı bir işte kaçınılan saati değiştirirse modülün sonraki teklifi yalnızca onu ezmez. Modül bu değerleri genellikle kendi ayarından üretir (kullanıcı salon saatini bir kez girer, modül her işe yazar). Geçersiz `timing` (ters saat, boş liste, sığmayan `rest_days`, biçimin kullanmadığı alan) teklifi reddettirir.
- **Bölüm (`facet`, Ç3e).** Üç biçimde de kullanılabilir (kalem, ritim, blok). Teklif anında modülün o anki bölüm listesinde olmalıdır; yoksa teklif alanın adıyla reddedilir (`facet: "x" is not one of the module's facets`). Bölümü olmayan modül `facet` gönderemez. Bölümü olan modülde `facet` olgu alanıdır: her teklifte yazılır, boş gelirse bölüm kalkar; kullanıcı formdan değiştirdiyse ezilmez (`kept`). Bölümü olmayan modülün tekliflerinde `facet` hiç yazılmaz ve `changed` içinde görünmez.
- Efor boş ve `bounds` verilmişse sınırın ortası (5 dakikaya yuvarlanır) `default` kaynağıyla yazılır; var olan bir değerin üzerine yazılmaz. Sınır da yoksa efor boş kalır.
- Teklif edilen kalem `active` açılır (`proposed` durumu yapay zekanın bölme önerileri içindir, Ç2).
- `withdraw` hiçbir şeyi silmez: kalem ve açık oturum işleri `dropped`, ritim pasif, blok `cancelled` olur; kalemde çalışan oturum varsa durdurulur; bitmiş kayda dokunulmaz. Geri çekilen `key` yeniden teklif edilirse aynı kayıt geri gelir; kullanıcının kendi kapattığı kayıt (kalem, ritim, blok) geri gelmez. Kimin kapattığı `provenance` içinde durum alanının kaynağı olarak tutulur.

Akış:

1. Modül bildiği olguları doldurup `propose` çağırır.
2. Çekirdek zarfı doğrular ve kaydeder. Boş kalan yargı alanları için yapay zekanın `size` çağrısı yapılır; modülün `sizingHints` metni ve `meta` bağlam olarak gider.
3. Kaynak kayıt değişince modül aynı `key` ile yeniden `propose` eder. Kalem henüz haftaya taahhüt edilmediyse sessizce güncellenir; edildiyse değişiklik kullanıcıya tek satırla bildirilir ("Midterm bir gün öne alındı, plan güncellendi").
4. Kullanıcı kalemi kapatınca (bitti ya da bırakıldı) çekirdek modüle sonucu bildirir (`onOutcome`): harcanan süre, kaç oturum, ertelenme sayısı. Modül bunu kendi tahmin ipuçlarını düzeltmek için kullanabilir.

**Olaylar.** `emit` olayı `events` tablosuna yazar ve yayınlandığı yerde, o türü dinleyen etkin modüllerin `on` işleyicilerine sırayla verir. Duraklatılmış ve arşivlenmiş modül olay almaz. Bir işleyicinin hatası öbürlerini ve yayınlayanı durdurmaz. Çekirdeğin kendi olayları `core.` ile başlar:

| Olay | Ne zaman | Yük | Kime |
| --- | --- | --- | --- |
| `core.prompt_answered` | Modülün sorusu cevaplandı | `{ module, kind, subject_type, subject_id, value }` | Dinleyen etkin modüllere |
| `core.session_started` (Ç3c) | Oturum başladı | `{ module, session_id, task_id, rhythm_id, source: { type, id }, facet, started_at, day }`; `facet` işin bölümü (oturum işinde kendisininki, yoksa kaleminki) ya da `null` (Ç3e); `day` başlangıcın planlama günü (Ç3g) | Yalnızca işin modülüne |
| `core.session_ended` (Ç3c) | Oturum kapandı | aynısı + `{ ended_at, result, minutes, measured, counted }`; `result`: `done`, `stopped`, `deferred`, `stuck`, `unanswered`; `counted` sahnenin bildirdiği sayılan dakika ya da `null` (Okul çekirdek A) | Yalnızca işin modülüne |
| `core.day_started` (Ç3c) | Uyanış kaydedildi | `{ date, woke_at, estimated, source }`; `source`: `screen`, `outside`, `estimate` (Ç3g) | Etkin bütün modüllere |
| `core.day_closed` (Ç3c) | Yatış kaydedildi | `{ date, bed_at }` | Etkin bütün modüllere |
| `core.bed_undone` (Rutin 1) | Sahnenin yazdığı yatış geri alındı ("Diziler", kural 6); Ç3g: yatış Ayarlar'dan silindi | `{ date }` | Etkin bütün modüllere |

Olaylar yayınlandıkları yerde teslim edilir: tarayıcıdaki eylemin olayı tarayıcıda, giriş ucunun ve zamanlanmış işlerin olayı sunucuda (Ç3d). Dinleyici iki yerde de aynı bağlamı alır; sunucuda dinleyicinin `ctx`'i sunucu bağlamıdır (aşağıda).

Oturum olayları yalnızca işin sahibi modüle verilir (oturumun `module_id`'si); modül başka modülün işini bu yoldan izleyemez. Plansız ve modülsüz oturumun olayı kaydedilir ama kimseye verilmez. `source` oturum işinin ya da ritmin kaynağıdır (`source_type`, `source_id`); modül kendi kaydını böyle tanır. Bir oturum başka bir iş başlatılınca kapanırsa `stopped` olarak bildirilir. `core.day_started` ve `core.day_closed` her kayıtta gelir: tahmini uyanıştan sonra "Uyandım" denmesi, "Biraz önce" düzeltmesi, ikinci cihazdan basılması yeniden bildirir; yük son değeri taşır, modül günü `date` ile tanır. İki cihaz aynı oturumu aynı anda kapatırsa olay iki kez gelebilir; modülün işleyicisi aynı `session_id` için bunu kaldırmalıdır. Kalem "bitti" diye kapatılınca üzerinde çalışan oturum `done` olarak bildirilir. Modülün kendi geri çekmesiyle (`withdraw`) duran oturum bildirilmez: geri çekmeyi modül kendisi yapmıştır. Olay yazılamazsa eylem yine geçerlidir.

Çekirdeğin Ç3d'de eklenen olayı:

| Olay | Ne zaman | Yük | Kime |
| --- | --- | --- | --- |
| `core.context_reported` (Ç3d) | Giriş ucu `core/context` bir bağlam bildirdi (konum otomasyonu) | `{ context, at }` | Etkin bütün modüllere. Ç4a: çekirdek değeri saklar (`settings.reported_context`) ve telefonun ekranları bağlamı 3 saat boyunca ondan tahmin eder (`docs/04-planlayici.md`, "Bağlam tahmini") |

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

## Sunucu zemini (Ç3d)

Modül, uygulama kapalıyken de çalışan iki şey bildirebilir: dışarıdan gelen veriyi işleyenler (`ingest`) ve zamanlanmış işler (`jobs`). Gerekçe `docs/12-sahne-ve-otomasyon.md` bölüm E; uçlar, anahtarlar ve zamanlayıcı `docs/02-mimari.md`.

```ts
type IngestType = {
  kind: string                         // küçük harf, rakam, tire: 'ninova', 'tarti'; modül içinde tekil
  label?: string                       // Ayarlar → Bağlantılar'da kapsam seçerken görünen ad
  schema: ZodType                      // gövdenin şeması; geçmeyen gövde 400 ile ve alanın adıyla reddedilir
  handle: (payload: unknown, ctx: ModuleContext) => Promise<void>   // payload şemadan geçmiş haliyle gelir
}

type ModuleJob = {
  key: string                          // küçük harf, rakam, tire; modül içinde tekil
  every: 'hour' | 'day' | 'week'
  at?: string                          // 'HH:mm', İstanbul; yalnızca 'day' ve 'week' için ('week' Pazartesi)
  run: (ctx: ModuleContext) => Promise<void>   // idempotent olmalı
}
```

- **Adres ve kapsam.** Modülün türü `POST /api/ingest/<slug>/<kind>` adresinde dinlenir; anahtarın kapsamı `<slug>/<kind>`'dir. Çekirdeğin türleri `core/wake`, `core/bed`, `core/context`'tir; `core` bir modül adı olamaz.
- **İşin adı.** İş `job_runs`'ta `<slug>/<key>` adıyla tutulur (`deneme/ozet`); çekirdeğin işleri `core/…`.
- **Ne zaman çalışır.** İşleyici yalnızca modül etkinken çalışır (duraklatılmış ya da arşivlenmiş modülün türü 409 verir, işi atlanır). Giriş işleyicisi istekle aynı anda, iş sırası gelince (`docs/02-mimari.md`, "Zamanlanmış işler") çalışır.
- **Sunucu bağlamı.** İkisi de bağlamın sunucu sürümünü alır: aynı `ModuleContext`, ama veritabanı istemcisi isteğin sahibi kullanıcı adına çalışır (RLS geçerli; başka hesabın satırı yoktur). `propose`, `withdraw`, `emit`, `ask`, `work`, `saveSettings`, `days` tarayıcıdakiyle aynıdır; `emit` sunucuda da dinleyicilere teslim eder. Sunucuda `size` çağrısı (yapay zekanın efor tahmini) teklifin hemen ardından yapılır, yapay zeka açıksa; tarayıcıdaki gibi modülün bir şey yapması gerekmez.
- **Tarayıcıya özgü içe aktarma yok.** Modülün sunucuda çalışan dosyaları (`rules`, `queries`, `ingest`, `jobs`, `extract`; her uzantıyla ve klasöre bölündüğünde içindekilerle; `server/` altı) React'i, `next/navigation` ve `next/link`'i, `@tanstack/*`'ı, `@/core/app`, `@/core/ui`, `@/core/voice`'u, tarayıcının Supabase istemcisini, `components/` altını içe aktarmaz; `window`, `document`, `localStorage` gibi tarayıcı nesnelerini kullanmaz; `"use client"` taşımaz. Lint kuralı bunu denetler (`eslint.config.mjs`, `tests/unit/module-server-lint.test.ts`); kural yalnızca bu dosyalara baktığı için işleyiciler `module.ts` içinde satır içi değil, `ingest.ts` ve `jobs.ts` içinde yazılır. Modül içinde yalnızca bu dosyalar ve `server/` altı içe aktarılır, göreli yolla (lint `@/modules/…` takma adını, geri dönen yolu, dinamik içe aktarmayı ve `require`'ı da reddeder); `server/` altındaki her dosya (`.tsx` dahil) aynı kurala tabidir. Sunucu bağlamının `db`'si yalnızca veri yollarını açar (`from`, `rpc`); `auth`, `storage`, `channel` yoktur.
- **İdempotent yazın.** Aynı gövde ikinci kez gelebilir (göndereni `Idempotency-Key` vermediyse) ve aynı iş aynı dönem için yeniden denenebilir. İşleyici kendi tablosuna dış kaynağın kimliğiyle yazar (`upsert`), işi aynı `key` ile teklif eder; iş, dönemin anahtarıyla (gün, hafta) yazar.
- **Hata.** İşleyicinin fırlattığı hata isteği 500 ile bitirir (kayıtta yalnızca `handler_failed`; ileti sunucu günlüğüne), işi `failed` ile bitirir (ileti `job_runs.error`'a, 300 karakter). Anahtar ve gövde hiçbir yere yazılmaz; işin hata iletisine de kişisel veri koymayın. Gövdenin şemadan geçmemesi işleyiciye hiç gelmez.

## Kurallar

- **Kendi verisinin tek sahibi modüldür.** Başka modül o tabloları okumaz, yazmaz.
- **Her teklif geri izlenebilir ve tekrar edilebilir.** `source` kaynağı gösterir; `key` aynı teklifin ikinci kez kayıt açmasını önler.
- **Modül olgu verir, yargıyı dayatmaz.** Kesin bildiği süreyi yazabilir (sabah rutini 20 dk); bilmediğini boş bırakır ve sınır verir.
- **Formül yeten yerde yapay zeka yok.** "Prep'ten bir gün önce alışveriş" gibi kesin kurallarda modül bütün alanları kendisi doldurur; `size` çağrısı yapılmaz.
- **Türetilen işler yeniden üretilebilir olmalı.** Kaynak kayıt değişince (örneğin sınav tarihi) modül ilgili işleri günceller; kullanıcının elle değiştirdiği alanı çekirdek ezmez (alan kaynağı `provenance` içinde `user` olarak durur; modülün ayrıca bir şey işaretlemesi gerekmez).
- **Arşivlenen modülün açık işleri `dropped` olur,** blok serileri kapanır, ritimleri pasifleşir. Verisi silinmez. Modülün teklif ettiği kayıtlar (`key` taşıyanlar) geri çekilmiş sayılır: modül yeniden etkinleştirilip aynı `key` ile yeniden teklif edince (`onActivate`) geri gelir. Kullanıcının elle eklediği işler ve arşivden önce kendi kapattığı kayıtlar geri gelmez.
- **Modül sayfası çekirdek kabuğu kullanır.** Beş bölgeli iskeletin dışına çıkmaz; gövdede serbesttir.

## Modül tasarım şablonu

Yeni bir modül önce `docs/moduller/<slug>.md` olarak tasarlanır ve onaylanır, sonra kodlanır. Doküman şu 10 başlığı doldurur; uymayan başlık boş bırakılmaz, "bu modülde yok" yazılır. (Okul çekirdek A, 23 Kas 2026: eski 9. başlık "Mod davranışı" kalktı; hayat modu Ç4a'da kalktı. Daha önce yazılmış modül dokümanlarında başlık numaraları kaymasın diye tek cümleyle durabilir.)

1. Kimlik: ad, tür, tek cümlelik amaç, başarı ölçütü
2. Yaşam döngüsü: başlangıç, bitiş koşulu, durumlar, dönem geçişi
3. Veri modeli: modüle özel tablolar ve çekirdeğe bağlantıları
4. Veri kaynakları ve otomasyon: her veri için kaynak ve seviye (otomatik, yarı otomatik, elle); dışarıdan gelenler için `ingest` türleri ve gövdeleri, zamanlanmış işler (`jobs`) ve dönemleri
5. Kurallar: modül içi otomasyonlar, yayınladığı ve dinlediği olaylar
6. Teklif ettiği işler: her zarf türü için `key`, hangi alanları modülün doldurduğu, hangilerini yapay zekaya bıraktığı, `sizingHints`
7. Veri girişi: `intake` türleri
8. Arayüz: çip, şimdi kartı, sayfanın beş bölgesi, sekmeler, alt sayfalar, tam ekran görünümler, hızlı eylemler, ayarlar; her ekranın çizimi ve her veri girişinin adımları
9. Haftalık rapor ve öğrenme
10. Açık sorular ve sonraki sürümler
