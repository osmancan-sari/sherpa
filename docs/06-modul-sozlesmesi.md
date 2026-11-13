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
| `@/core/ui/module/ModuleProvider` | `useModule()`: ekran bileşeninin bağlamı (`row`, `definition`, `ctx`) |
| `@/core/app/hooks` | `useModuleQuery(row, anahtar, fn)`: modülün bağlamıyla hesaplanan ve her veri değişiminde tazelenen sorgu; `useNow()`: ortak saat |
| `@/core/app/actions` | `useRefreshAll()`: modül kendi bağlamıyla bir şey yazdıktan sonra ekranı hemen tazeler |
| `@/core/ui/Notices` | `useNotify()`, `SAVE_FAILED`: ekranın altındaki tek satırlık bildirim |
| `@/core/ui/kit` | Bileşen takımı (`StepRunner` dahil) |
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
}

type ModuleViewProps = { params: Record<string, string> }   // alt sayfalarda ':id' gibi parçalar

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

### Sahne (Ç3c)

Modül, kendi işi çalışırken Bugün ekranını devralan bir **sahne** verebilir: arka plan, kendi düğmeleri, adımlar, sayaçlar. Tasarımın gerekçesi `docs/12-sahne-ve-otomasyon.md`, bölüm A.

```ts
type ModuleScene = {
  when: (subject: SceneSubject) => boolean     // bu iş için sahne var mı (türüne, kaynağına, meta'sına göre)
  component: ComponentType<SceneProps>
  look?: { tone: 'calm' | 'focus' | 'energy' } // çekirdeğin geçiş ve arka plan tonu
}

type SceneSubject =
  | { kind: 'task'; task: Task; workItem: WorkItem | null }
  | { kind: 'rhythm'; rhythm: Rhythm }

type SceneProps = {
  subject: SceneSubject
  session: { id: string; startedAt: Date; elapsedSeconds: number }   // sunucudaki başlangıçtan; her cihazda aynı
  device: 'pano' | 'telefon'
  controls: {
    finish: () => Promise<void>      // çekirdeğin "Bitti"si
    stop: () => Promise<void>        // "Durdur"
    stuck: () => void                // "Takıldım" akışını açar (sahneden çıkar)
    exit: () => void                 // sahneden çık; oturum sürer
  }
  say: Say
  today: TodayBrief                  // günün kısa özeti (anlatım için; yalnızca okuma)
  ctx: ModuleUiContext
  facet: { key: string; name: string; color: string } | null   // Ç3e: çalışan işin bölümü; color çözülmüş renk
}
```

Kurallar:

1. **Ne zaman.** `plan.now` `running` ise, çalışan işin (iş ya da ritim; plansız oturumda sahne yoktur) modülü `scene` tanımlamışsa ve `when` doğru dönerse Bugün ekranı sahneyi çizer. Öneri durumunda standart kart kalır. İş bitince, durunca ya da ertelenince standart ekran döner. `when` hata verirse sahne yok sayılır.
2. **Çekirdeğin şeridi.** Sahnenin üstünde her zaman ince bir şerit durur: saat, işin adı, geçen süre, "Çık". Şerit çekirdeğindir, sahne onu gizleyemez. "Çık" standart ekrana döner; oturum sürer, kartta "Sahneye dön" çıkar. Çıkış cihaza özgüdür (öbür cihaz sahnede kalır) ve o oturum için hatırlanır.
3. **Oturum çekirdeğindir.** Başlatma, bitirme, ölçme, "Devam ediyor musun?" ve 30 dakika kuralı değişmez; sahne oturumu yalnızca `controls` ile etkiler.
4. **Sahne serbesttir** ama çekirdeğin tasarım dilini ve temasını kullanır, hareket azaltma tercihine uyar. Pano ve telefon aynı sahneyi kendi yerleşimiyle çizer (`device`). Sahnenin kalıcı durumu (hangi adımdayım) modülün kendi tablosundadır; ekranda tutulan durum öbür cihaza taşınmaz.
5. **Hata.** Sahne bileşeni hata verirse çekirdek standart kartı gösterir ve tek satırla bildirir ("Sahne açılamadı; iş sürüyor."); oturum etkilenmez.
6. **Tam ekranla ilişkisi.** `fullscreen` kullanıcının modül sayfasından açtığı görünümdür; sahne iş çalışırken Bugün ekranında kendiliğinden gelir. Aynı bileşen ikisinde de kullanılabilir.

**Nerede tanımlanır.** `scene` nesnesi (`when` dahil) modülün sıradan bir dosyasında (`module.ts` ya da `scene.ts`) tanımlanır; yalnızca `component` `"use client"` dosyasından gelir. İstemci dosyasının dışa aktardığı nesne sunucuda yalnızca bir başvurudur: `when` orada fonksiyon olmaz ve kayıt denetimi uygulamayı açtırmaz.

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
  top: { title: string; module: string; reason: string | null }[]   // günün 3 işi
  blocks: { title: string; startsAt: Date; endsAt: Date }[]         // bugünün sabit blokları
  finishLine: Date
  wokeAt: Date | null
}
```

- Tek giriş noktası `src/core/voice/`; ilk sağlayıcı cihazın kendi konuşma sentezidir (Türkçe ses). Art arda gelen metinler sıraya girer, `interrupt` sıradakileri atar; uzun metin cümlelere bölünür.
- Ayarlar cihaz başınadır (Ayarlar → Sesli anlatım): açık ya da kapalı, ses, hız, "bu cihaz dokunuş olmadan da konuşsun". Kendiliğinden konuşma yalnızca bu ayarın açık olduğu cihazda olur; öbür cihaz yalnızca son 10 dakikada dokunulduysa konuşur.
- Anlatım kapalıysa, cihazda ses yoksa ya da tarayıcı izin vermezse `say` hiçbir şey yapmaz ve hata vermez. Sahne anlatıma bağımlı kurulmaz: söylenen her şey ekranda da yazar.
- **Yalnızca `say` konuşur.** Konuşma motoruna `say` ile istenenden başka hiçbir şey gitmez: ilk dokunuşta ısındırma, boş ya da sessiz anlatım yok; dokunuş yalnızca not edilir. Bu yüzden iOS'ta ilk anlatım bir dokunuşun içinde olmalıdır (sahnedeki "Anlat" gibi); dokunuşsuz ilk `say` reddedilirse sessiz kalır. Sayfa kapanınca kuyruk boşaltılır. Test: `tests/e2e/voice.spec.ts` (13 Kas 2026).
- Anlatılan metin ürün kurallarına uyar: suçlama ve geçmişi sayma yok.

### Günün kaydını okuma (Ç3c)

`ctx.days(sinceDay)` modülün günün çerçevesini okumasıdır (yalnızca okuma): `{ date, wokeAt, wokeEstimated, bedAt, plannedWake, plannedBed }[]`. Sabah ve akşam rutini gibi modüller uyanış, yatış ve uyku geçmişini buradan çizer.

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
  days: (sinceDay: string) => Promise<DayFrameRecord[]>   // Ç3c: uyanış ve yatış kayıtları (yalnızca okuma)
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
  order?: number                       // Ç3c: aynı çapadaki işlerin sırası (1, 2, …); yalnızca `anchor` ile
  after_finish?: true                  // Ç3c: bitiş çizgisinden sonra, akşama da konabilir
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
| `core.session_started` (Ç3c) | Oturum başladı | `{ module, session_id, task_id, rhythm_id, source: { type, id }, facet, started_at }`; `facet` işin bölümü (oturum işinde kendisininki, yoksa kaleminki) ya da `null` (Ç3e) | Yalnızca işin modülüne |
| `core.session_ended` (Ç3c) | Oturum kapandı | aynısı + `{ ended_at, result, minutes, measured }`; `result`: `done`, `stopped`, `deferred`, `stuck`, `unanswered` | Yalnızca işin modülüne |
| `core.day_started` (Ç3c) | Uyanış kaydedildi | `{ date, woke_at, estimated }` | Etkin bütün modüllere |
| `core.day_closed` (Ç3c) | Yatış kaydedildi | `{ date, bed_at }` | Etkin bütün modüllere |

Olaylar yayınlandıkları yerde teslim edilir: tarayıcıdaki eylemin olayı tarayıcıda, giriş ucunun ve zamanlanmış işlerin olayı sunucuda (Ç3d). Dinleyici iki yerde de aynı bağlamı alır; sunucuda dinleyicinin `ctx`'i sunucu bağlamıdır (aşağıda).

Oturum olayları yalnızca işin sahibi modüle verilir (oturumun `module_id`'si); modül başka modülün işini bu yoldan izleyemez. Plansız ve modülsüz oturumun olayı kaydedilir ama kimseye verilmez. `source` oturum işinin ya da ritmin kaynağıdır (`source_type`, `source_id`); modül kendi kaydını böyle tanır. Bir oturum başka bir iş başlatılınca kapanırsa `stopped` olarak bildirilir. `core.day_started` ve `core.day_closed` her kayıtta gelir: tahmini uyanıştan sonra "Uyandım" denmesi, "Biraz önce" düzeltmesi, ikinci cihazdan basılması yeniden bildirir; yük son değeri taşır, modül günü `date` ile tanır. İki cihaz aynı oturumu aynı anda kapatırsa olay iki kez gelebilir; modülün işleyicisi aynı `session_id` için bunu kaldırmalıdır. Kalem "bitti" diye kapatılınca üzerinde çalışan oturum `done` olarak bildirilir. Modülün kendi geri çekmesiyle (`withdraw`) duran oturum bildirilmez: geri çekmeyi modül kendisi yapmıştır. Olay yazılamazsa eylem yine geçerlidir.

Çekirdeğin Ç3d'de eklenen olayı:

| Olay | Ne zaman | Yük | Kime |
| --- | --- | --- | --- |
| `core.context_reported` (Ç3d) | Giriş ucu `core/context` bir bağlam bildirdi (konum otomasyonu) | `{ context, at }` | Etkin bütün modüllere. Ekranlar bunu henüz kullanmaz (konumdan bağlam seçimi sonra) |

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

Yeni bir modül önce `docs/moduller/<slug>.md` olarak tasarlanır ve onaylanır, sonra kodlanır. Doküman şu 11 başlığı doldurur; uymayan başlık boş bırakılmaz, "bu modülde yok" yazılır.

1. Kimlik: ad, tür, tek cümlelik amaç, başarı ölçütü
2. Yaşam döngüsü: başlangıç, bitiş koşulu, durumlar, dönem geçişi
3. Veri modeli: modüle özel tablolar ve çekirdeğe bağlantıları
4. Veri kaynakları ve otomasyon: her veri için kaynak ve seviye (otomatik, yarı otomatik, elle); dışarıdan gelenler için `ingest` türleri ve gövdeleri, zamanlanmış işler (`jobs`) ve dönemleri
5. Kurallar: modül içi otomasyonlar, yayınladığı ve dinlediği olaylar
6. Teklif ettiği işler: her zarf türü için `key`, hangi alanları modülün doldurduğu, hangilerini yapay zekaya bıraktığı, `sizingHints`
7. Veri girişi: `intake` türleri
8. Arayüz: çip, şimdi kartı, sayfanın beş bölgesi, sekmeler, alt sayfalar, tam ekran görünümler, hızlı eylemler, ayarlar; her ekranın çizimi ve her veri girişinin adımları
9. Mod davranışı
10. Haftalık rapor ve öğrenme
11. Açık sorular ve sonraki sürümler
