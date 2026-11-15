# Planlayıcı

Planlayıcı günü yuvalara böler ve her yuvaya en uygun işi koyar. Saf TypeScript'tir (`src/core/planner/`): girdisi veri, çıktısı plan. Veritabanına, saate ve ağa dokunmaz; şimdiki zaman parametredir. Bu sayede her kural test edilir ve ekran yapay zekaya ya da sunucuya sormadan güncel kalır.

**Ç4a (15 Kas 2026; `docs/09-kararlar.md` 14–15 Kas satırları):** hayat modu, elle seçilen bağlam, saatle belirlenen gün bitişi (bitiş çizgisi ve "akşam"), "vakit kalırsa" ve günün 3 işi kalktı. Çalışma penceresi yatışa bağlı dizinin başına (o yoksa beklenen yatışa) uzanır; telefonun bağlamı tahmin edilir; plan günün kalanıdır. Aşağıdaki metin bu hali anlatır; eski kurallar yalnızca "Ç4a'da kalktı" notuyla durur.

## Arayüz

```ts
type PlanInput = {
  now: Date
  date: string                 // 'YYYY-MM-DD'
  dayType: 'home' | 'office' | 'campus'
  dayStart: Date               // günün ilk dokunuşu ya da varsayılan; çerçeve açıkken uyanış (Ç3c)
  bedtime: Date                // Ç4a: bu gecenin yatışı; çerçeve açıkken frame.bed, kapalıyken varsayılan yatış aralığının başı
  frame?: DayFrame             // Ç3c: uyanış, beklenen yatış, uyku planı ("Günün çerçevesi")
  blocks: Block[]
  tasks: Task[]                // todo ve doing
  workItems: WorkItem[]
  rhythms: RhythmWithProgress[]   // dönem içi yapılan sayısıyla
  modules: Module[]
  context: Context | null      // Ç4a: ikinci ekran 'desk'; telefonda tahmin (aşağıda "Bağlam tahmini"); null: süzgeç kapalı
  settings: Settings
  stats: PlannerStats
  advice?: PlanAdvice          // yapay zekanın önerisi: prefer, defer
}

type Plan = {
  slots: Slot[]                // sıralı; her biri bir atama taşıyabilir. Günün kalan planı (Sıradakiler)
  now: NowState                // şu an ekranda ne olmalı
  warnings: Warning[]          // sıkışma, tanımsız sıradaki adım...
  usableMinutes: number
}

function buildPlan(input: PlanInput): Plan
function pickForMinutes(input: PlanInput, minutes: number): Candidate | null   // "X dk'm var"
```

## Yapay zekayla iş bölümü

Planlayıcı tek başına geçerli bir plan kurar. Yapay zeka bu planı iyileştirir, yerine geçmez (akış: `docs/10-yapay-zeka.md`, "Plan çağrısının akışı"):

- Süre, önem ve `planned_date` gibi alanları yapay zeka veriye yazar; planlayıcı bunları sıradan girdi olarak okur.
- `advice` verilmişse: `prefer` içindeki işlerin skoru 1,5 ile çarpılır, `defer` içindekiler bugünün adaylarından çıkarılır. (Ç4a: `top3` kalktı; eskiden kaydedilmiş öneride durursa okunmaz.)
- Öneri hiçbir koruma kuralını aşamaz. Zorunlu bir iş `defer` edilmişse öneri yok sayılır ve uyarı üretilir.
- `advice` yoksa planlayıcı kendi taban planını üretir; plan yine geçerlidir.

## Plan ufukları

Plan dalga dalga ayrıntılanır: uzak ufuk kaba, yakın ufuk ince. Her ufukta hesap kodda, yargı yapay zekadadır.

| Ufuk | Birim | Kod ne yapar | Yapay zeka ne yapar | Ne zaman |
| --- | --- | --- | --- | --- |
| Dönem, ay | İş kalemi (toplam efor) | Hafta hafta talep ve kapasiteyi hesaplar (`loadByWeek`) | Sıkışan haftaları yorumlar; öne çekme, bırakma önerir (Ç4a: mod önermez) | Ayın ilk açılışında, sıkışan hafta varsa |
| Hafta | İş kalemi → oturum işleri | Kapasiteyi, tabanları ve bağımlılıkları denetler; taahhüt edilen kalemleri oturumlara böler | Haftanın kalemlerini ve modül başına saat payını seçer | Haftanın ilk açılışında; hafta içinde tetikleyicide |
| Gün | Oturum işi → yuva | Yuvaları kurar, süzgeçleri ve koruma kurallarını uygular; gelecek günleri tahmin eder (Ç4a, kaydetmeden) | Öne alınacakları ve ertelenecekleri seçer | Günde bir kez: akşam kapanışında ya da günün ilk açılışında |
| Şimdi | Tek iş | Sıradaki işi seçer, oturumu takip eder | — | Sürekli |

```ts
function loadByWeek(items: WorkItem[], rhythms, blocks, settings, range): WeekLoad[]   // talep ve kapasite
function commitWeek(input: WeekInput, advice?: WeekAdvice): WeekPlan                    // taahhüt + oturumlara bölme
```

Kurallar:

- **Talep.** Bir kalemin haftalara yayılan talebi: kalan efor, `earliest_at` ile `due_at` arasındaki haftalara kapasiteyle orantılı dağıtılır. Ritimler ve tabanlar her haftanın sabit talebidir.
- **Oturumlara bölme.** Bir kalem haftaya girerken o haftaya düşen eforu `session_minutes` uzunluğunda oturum işlerine bölünür (en fazla 90 dk). Sonraki haftaların eforu bölünmez; kalemde toplam olarak durur.
- **Bağımlılık.** `depends_on` içindeki kalem bitmeden bağlı kalem taahhüt edilmez.
- **Plan istikrarı.** Haftalık taahhüt hafta içinde kendiliğinden değişmez. Yeniden kurulmasını yalnızca şunlar tetikler: yeni zorunlu kalem, kaybedilen kapasite (yeni sabit blok), kullanıcının isteği. (Ç4a: mod değişimi tetikleyici değildir; hayat modu yok.)
- **Efor istikrarı.** Kalemin eforu oluşurken bir kez tahmin edilir. Yeniden tahmin yalnızca kapsam değişince, kalemin çıktısı bir çalışma planı getirince (bkz. Okul modülü) ya da harcanan süre tahmini %50 aşınca yapılır.
- **Yedek.** Yapay zeka yoksa `commitWeek` kalemleri aciliyet ve öneme göre kapasite dolana kadar kendisi seçer.

## Gün nasıl kurulur

1. **Pencere.** `[max(dayStart, now), bedtime − yatışa bağlı işlerin ayak izi]` (Ç4a: bitiş çizgisi yok; pencere yatışa bağlı dizinin başına, o yoksa beklenen yatışa uzanır).
2. **Sabit bloklar.** Her blok, yol süreleriyle genişletilip pencereden çıkarılır. Kalan aralıklardan `slot.light_min` (15 dk) altındakiler atılır.
3. **Yuvalar.** Her boş aralık yuvalara bölünür:
   - 45 dk ve üzeri aralık derin yuva olur; en fazla 90 dk. Daha uzun aralık, aralarına 15 dakikalık mola yuvaları konarak birden çok derin yuvaya bölünür.
   - 15–44 dk aralık hafif yuva olur.
4. **Kapasite.** `usableMinutes = toplam yuva süresi × capacityFactor(dayType)`. Çarpan önce `settings.capacity_factors`'tan, yeterli veri birikince `planner_stats`'tan gelir. Günün planı bu süreyi aşamaz; aşan işler o gün planlanmaz ve ekranda birikmez (Ç4a: "vakit kalırsa" yok), sonraki günlerin adayı olarak kalır.
5. **Adaylar.** Süzgeçlerden geçen işler ve borcu olan ritimler.
6. **Zorunlular.** Aşağıdakiler önce yerleşir, son tarihe göre sıralı:
   - son tarihi bugün olan işler,
   - aciliyeti 0,8 ve üzeri olan işler (bugün başlanmazsa yetişmez),
   - tabanı tehlikede ritimler: `kalan gün sayısı ≤ tabana ulaşmak için gereken sayı`.
7. **Doldurma.** Kalan yuvalar sırayla, o yuvaya uyan en yüksek skorlu adayla doldurulur.
8. ~~**Günün 3 işi.**~~ Ç4a'da kalktı: planlayıcı günün işlerinden üçünü ayırmaz. Plan, sırasıyla günün kalanıdır ("Sıradakiler").

## Süzgeçler

Bir aday bir yuvaya ancak dördünü de geçerse girer:

| Süzgeç | Kural |
| --- | --- |
| Süre | `est_minutes × tahmin çarpanı ≤ yuva süresi` |
| Enerji | Derin yuva: her işi alır (deep, light, physical). Hafif yuva: light ve physical alır. Mola yuvası: yalnızca süresine sığan physical ve 15 dk'yı geçmeyen light alır |
| Bağlam | İşin bağlamı `any` ya da cihazın bağlamına eşit; cihazın bağlamı bilinmiyorsa (`null`, Ç4a) süzgeç kapalıdır. `status = waiting` olan iş hiçbir zaman aday değildir |
| Zaman | `timing` taşıyan iş için: çalışma aralığı uygun aralığın içinde, ayak izi boş aralığın içinde (aşağıda "Zaman kısıtları") |

Bağlam eşleşmesi: ikinci ekran `desk` bağlamındadır ve `desk`, `home`, `any` işlerini görür. Telefonda bağlam seçilmez, tahmin edilir (aşağıda "Bağlam tahmini", Ç4a).

## Bağlam tahmini (Ç4a)

Kullanıcı bağlam seçmez (karar, 14 Kas 2026). `inferContext` (`src/core/planner/context.ts`, saf) cihazın bağlamını şu sırayla bulur:

1. **Pano** (`desk` cihazı; geniş ekran ve ince işaretçi) her zaman `desk`'tir.
2. **Telefonda, bildirilen yer:** `core/context` ucundan son 3 saat içinde yazılmış değer (`settings.reported_context`, `reported_context_at`; ileride konum otomasyonu buraya yazar). Gelecekten gelen (saati kayan) değer alınmaz; daha eski bir bildirim yenisinin yerine yazılmaz.
3. **Yeri olan sabit blok:** şu an içinde olunan ya da 30 dakika içinde başlayacak, `location` taşıyan blok (şimdiki önce). Yerin bağlamı: yazıda bilinen bir sözcük ("Ev", "Ofis"/"İş", "Kampüs"/"Okul"/"Üniversite"/"Fakülte", "Yol"/"Yolda"; büyük küçük harf ve Türkçe harfler fark etmez), yoksa bloğun gün tipi, o da yoksa `out`.
4. **Günün tipi:** günün bloklarının söylediği gün tipi (`home`, `office`, `campus`); ayardaki varsayılan gün tipi sayılmaz.
5. Hiçbiri yoksa bağlam bilinmez (`null`) ve süzgeç kapalıdır: her iş adaydır. Yol kuralları değişmez (yol, cihaz işin bağlamındayken 0 sayılır; bağlam bilinmiyorsa sayılır).

Telefon mu pano mu: ekran 768 px'den darsa ya da dokunmatik (kaba işaretçi) ise telefon (`useDeviceKind`). Gün tipleri ve `core/context` ucu durur.

## Skor

```
skor = önem × (aciliyet + ritimBorcu + bekleme)
```

| Terim | Hesap |
| --- | --- |
| önem | `module.weight × önemKatsayısı(importance)`; önem katsayısı 1→0,5, 2→1, 3→1,5, 4→2 (Ç4a: mod çarpanı yok) |
| aciliyet | Son tarihi olan iş için: `min(2, kalanİşSüresi ÷ sonTariheKadarKullanılabilirSüre)`. İş bir kaleme bağlıysa kalan iş süresi kalemin kalan toplam eforudur. Son tarihi yoksa 0 |
| ritimBorcu | Ritimler için: `(hedef − yapılan) ÷ hedef × dönemİlerlemesi`; dönem ilerlemesi 0–1 arası |
| bekleme | Son tarihsiz işler için: `min(0,3, bekleme günü ÷ 30)`; eski işler yavaşça yükselir |

`sonTariheKadarKullanılabilirSüre` bugünden son tarihe kadar her günün yuva süresi × kapasite çarpanı toplamıdır; gelecek günlerin blokları hesaba katılır.

`timing` taşıyan adayın skoru yuvaya göre bir zaman çarpanıyla çarpılır ve kullanılabilir süresi penceresine göre daralır (aşağıda "Zaman kısıtları", kural 4 ve 6).

## Zaman kısıtları (Ç3b)

İş, iş kalemi ve ritim isteğe bağlı bir `timing` değeri taşır (tanımı ve doğrulaması: `docs/03-veri-modeli.md`, "Zaman kısıtları"). **`timing` boşsa bu bölümdeki hiçbir kural devreye girmez ve plan, bu bölüm yokken çıkan planla birebir aynıdır.**

Terimler:

- **Geçerli değer.** Oturum işinin kendi `timing` değeri varsa o; yoksa bağlı olduğu kalemin değeri.
- **Ayak izi.** İşin günde kapladığı süre: `yol öncesi + est_minutes × tahmin çarpanı + yol sonrası`. Yol yoksa sürenin kendisidir.
- **Çalışma aralığı.** Ayak izinin yol dışındaki kısmı.
- **Uygun aralık.** `windows` içinde o günü kapsayan aralıkların birleşimi (İstanbul saati); `windows` yoksa bütün gün.
- **Boş aralık.** İki sabit blok (yol süreleriyle) arasında kalan kesintisiz boş süre; yuvalar bunun içinden kesilir ("Gün nasıl kurulur", madde 2 ve 3).

Kurallar:

1. **Zaman süzgeci (kesin).** İş bir yuvaya ancak çalışma aralığının tamamı uygun aralığa düşecek biçimde yerleşebiliyorsa girer. Yuva uygun aralıktan önce başlıyorsa çalışma, yuvanın başına değil uygun aralığın başladığı ana konur; yuvanın önde ve arkada artan parçaları kendi başlarına yuva olur (mevcut "yuvanın kalanı" kuralı). Yol, uygun aralığın dışına düşebilir (salon açılmadan yola çıkılır); boş aralığın dışına düşemez.
2. **Yol.** Yol süresi olan iş tek yuvaya sığmak zorunda değildir: ayak izi, başladığı yuvadan sonra aynı boş aralıktaki mola ve yuvalara taşabilir. Taştığı yerlerin hepsi boş olmalıdır; sabit bloğa, bloğun yol süresine ve günün penceresinin dışına taşamaz. Ayak izi mola yuvasında başlamaz. Enerji süzgeci ayak izinin başladığı yuvaya göre uygulanır. 90 dakika sınırı çalışma süresine uygulanır, yola değil. Kaplanan yuvalar ve molalar kapanır; son kaplananın artanı yeniden yuva olur. Yol kapasiteye (`usableMinutes`) sayılmaz, ama kapladığı süre başka işe verilmez. Yol süresi olmayan işte süre süzgeci bugünkü gibidir (tek yuvaya sığma).
3. **Bağlam ve yol.** Yol süresi tanımlı (öncesi ya da sonrası 0'dan büyük) iş bağlam süzgecinden her bağlamda geçer: yol, yer değiştirmenin bedelidir. Cihazın bağlamı işin bağlamına eşitse kullanıcı zaten oradadır; iki yol süresi de 0 sayılır.
4. **Tercih ve kaçınma (esnek).** Bir yerleşimin zaman durumu: çalışma aralığının en az yarısı bir `avoid` aralığına düşüyorsa *kaçınılan*; değilse en az yarısı bir `prefer` aralığına düşüyorsa *tercih edilen*; değilse *nötr*. Adayın o yuvadaki skoru çarpılır: tercih edilen 1,25, nötr 1, kaçınılan 0,5 (kodda tek yerde sabit; kullanımdan sonra ayara taşınabilir).
   - Doldurmada ("Gün nasıl kurulur", madde 7): bir aday, bugün ileride boş duran ve bütün süzgeçlerden geçtiği bir yuvada zaman durumu daha iyiyse bu yuvada atlanır.
   - Zorunlularda ("Gün nasıl kurulur", madde 6): iş, uyduğu yuvalar içinde zaman durumu en iyi olanların en erkenine konur. Kaçınılan yuvaya ancak başka yuva yoksa konur.
5. **Dinlenme günü.** `rest_days = n` olan ritim, son yapıldığı günden sonraki `n` gün aday değildir. Son yapılış `rhythm_logs`'tan gelir; `RhythmWithProgress` son yapılış gününü taşır.
6. **Aciliyet.** `windows` taşıyan iş için `sonTariheKadarKullanılabilirSüre`, her günün yalnızca uygun aralığa düşen yuva süresinden hesaplanır. `prefer` ve `avoid` bu süreyi değiştirmez.
7. **Ritim tabanı.** "Gün nasıl kurulur" madde 6'daki "kalan gün sayısı" yerine *ulaşılabilir sayı* kullanılır: dönemin kalan günlerinde, `windows`'un kapsadığı günlere en erkenden başlayıp birer kez yerleştirerek ve her yapılıştan sonra (dönem içindeki son gerçek yapılış dahil) `rest_days` kadar gün atlayarak ritmin en çok kaç kez yapılabileceği. `timing` yoksa bu, kalan gün sayısına eşittir.
8. **Hafta.** `loadByWeek` talebe oturum başına yol süresini ekler. Taahhüt edilmiş ya da bu hafta teslim olan, `windows` taşıyan bir kalemin (ya da tabanı olan ritmin) haftanın kalan günlerinde uygun aralığa düşen yuva süresi bir ayak izine yetmiyorsa uyarı üretilir: "Bu hafta uygun saat yok". Taahhüt ve istikrar kuralları değişmez.
9. **Çakışmalar.**
   - Kesin pencere her kuraldan önce gelir. Bugün teslim olan ya da zorunlu sayılan iş pencere dışına konmaz; bugün uyduğu yuva kalmadıysa yerleşmez ve uyarı üretilir: "Bugün uygun saat kalmadı".
   - Yapay zekanın önerisi (`prefer`) pencereyi çiğneyemez; çiğneyen öneri yok sayılır ve "reddedilen öneri" uyarısı çıkar.
   - **Pencere planlayıcıyı bağlar, kullanıcıyı değil.** Kullanıcı bir işi her saatte elle başlatabilir; oturum kuralları değişmez.
   - ~~**Bitiş çizgisi.**~~ Ç4a'da kalktı: gün yatışa bağlı dizinin başına kadar sürer; `after_finish` zarfta kabul edilir ama okunmaz; "Saatleri bitiş çizgisinden sonra" uyarısı (gün ve form) yoktur.
   - `pickForMinutes` ("X dk'm var") aynı kuralları şu an için uygular; ayak izi verilen dakikaya sığmalıdır.
10. **Uyarı önceliği.** "Uygun saat yok" (bugün ya da hafta) yetişmeyecek son tarihten hemen sonra gelir; en çok iki uyarı kuralı değişmez.
11. **Çıktı ve oturum.** Atama, çalışma aralığını ve yol sürelerini ayrı taşır (`travelBefore`, `travelAfter`); zaman çizelgesi yolu ayrı çizer. Oturum yalnızca çalışmayı ölçer; yol ölçülmez ve öğrenmeye girmez.

Bilinen sınırlar: yol süresi iş başına tek sayıdır, nereden gelindiğine göre değişmez ve ardışık işler arasında zincirlenmez. Anlık veri (trafik, doluluk) yoktur. Kapasite öğrenmesi yolda geçen süreyi çalışılmamış sayar; yol süreli işler çoğalırsa çarpan gözlenmeli.

## Günün çerçevesi (Ç3c)

Gün iki gerçek olaya bağlanır: uyanış ve yatış (gerekçe: `docs/12-sahne-ve-otomasyon.md`, bölüm D; veri: `docs/03-veri-modeli.md`, `days` ve `settings.day_frame`). **`settings.day_frame` boşsa bu bölümdeki kurallar devreye girmez ve planlayıcı Ç3b'deki gibi çalışır; tek istisna çapalı iştir (aşağıda "Çerçeve kapalıyken çapalı iş", Ç3g).** Çerçeve açık ama uyanış kaydı ve çapa yokken de çalışma penceresinin içindeki plan, aynı pencereyle Ç3b'nin kurduğu planın aynısıdır; değişen yalnızca pencerenin başı ve sonudur.

```
uyku │ uyanışa bağlı işler │ çalışma penceresi │ yatışa bağlı işler │ uyku
     ▲ uyanış                                 ▲ yatışa bağlı dizinin başı ▲ yatış
```

Ç4a: bitiş çizgisi ve "akşam" bölümü kalktı; çalışma penceresi yatışa bağlı dizinin başına kadar sürer.

Terimler:

- **Uyanış.** Kayıtlı uyanış (`days.woke_at`); yoksa kullanıcının o güne verdiği değer (`days.expected_wake`); yoksa uyku planının beklenen uyanışı.
- **Beklenen yatış.** Kayıtlı yatış (`days.bed_at`); yoksa kullanıcının o geceye verdiği değer (`days.expected_bed`); yoksa uyku planının yatışı.
- **Aralıklar.** Uyanış aralığı o günün tipine, yatış aralığı o günün gecesine göre `day_frame`'den (`by_day_type` varsa o). Aralıklar planlayıcıyı bağlar, kullanıcıyı değil.
- **Çapalı iş.** `timing.anchor` taşıyan aday. Uyanışa bağlı işlerin ayak izi, o günün uyanışa bağlı adaylarının sürelerinin toplamıdır.
- **Günün başı.** `uyanış + uyanışa bağlı işlerin ayak izi`. Çalışma penceresi `[max(günün başı, şimdi), beklenen yatış − yatışa bağlı işlerin ayak izi]` olur (`PlanInput.dayStart`; Ç4a, sonu `Plan.frame.workEnd`).

Kurallar:

1. **Çapa.** Uyanışa bağlı işler uyanıştan başlayarak art arda, yatışa bağlı işler beklenen yatışta bitecek biçimde geriye doğru dizilir. Sıra `order` (küçük önce; olmayan sonda), eşitse skordur. Çapalı iş yuvalara dağıtılmaz, kapasiteye sayılmaz ve günün "tamam"ını bekletmez. Sabit bloklar çapalı işi kaydırmaz (uyku planı en geç uyanışı ilk yükümlülüğe göre zaten öne alır).
2. ~~**Akşam.**~~ Ç4a'da kalktı: `after_finish` okunmaz; eski bitiş çizgisinden sonraki saatler çalışma penceresinin içindedir ve kapasiteye sayılır.
2a. **Yatışa bağlı iş yatıştan kısa süre önce öne gelir (Ç3g).** Yatışa bağlı işin yuvası beklenen yatışta biter; "Şimdi"ye yuvasının başından en çok 15 dakika önce gelir (`BED_LEAD`). Akşam durumunda (gün kapatıldıysa ya da yatış aralığı başlayıp günün işi bittiyse; Ç4a) iş henüz öne gelmediyse durum onu `later` olarak taşır (iş ve yuvasının başı) ve kart "Sırada: Akşam kapanışı · 22:20" der, "Şimdi başla" ile erken başlatılır.
3. **Gün kısalınca.** Geç uyanılan günde pencere kısalır; sığmayanlar olağan kurallarla sonraki günlere gider (Ç4a: "vakit kalırsa" yok). Uyarı metinleri bunu kusur gibi anlatmaz.
3a. **Uyku feda edilmez (Ç4a).** Pencere yatışın içine uzanmaz: iş yükü ne olursa olsun yatışa bağlı dizinin başında biter; uyku planının kuralları (aşağıda) aynen geçerlidir.
4. **Hafta.** Haftanın kapasitesi her günü kendi başından sayar: bugün günün başından, yarın beklenen uyanıştan (uyku planı, yatış kaydı ve kullanıcının değerleriyle), sonraki günler en geç uyanıştan (yüke göre erkene çekme sonraki günler için hesaplanmaz), her biri uyanışa bağlı işlerin ayak iziyle. Haftanın taahhüdü yalnızca mevcut tetikleyiciyle yeniden kurulur: kalan günlerin kapasitesi toplamda 30 dakikadan çok düşerse. Kazanılan süre günün doldurmasına açılır, taahhüt yeniden kurulmaz.

**Çerçeve kapalıyken çapalı iş (Ç3g).** Çerçeve kapalıyken de çapa işin saatini taşır; çapalı iş yuvalara dağıtılmaz. Uyanış yerine ayarlardaki günün başı (`day_start_default`; günün ilk dokunuşu değil), yatış yerine varsayılan yatış aralığının başı (22:00; Ç4a, önce bitiş çizgisiydi) kullanılır: uyanışa bağlı işler günün başından art arda dizilir ve çerçeve açıkkenki gibi bittikten 60 dakika sonra o gün düşer; yatışa bağlı işler bu yatışta bitecek biçimde dizilir ve yuvalarından 15 dakika önce öne gelir. Çalışma penceresi uyanış dizisi önerildiği sürece onun bitişinde başlar, yatış dizisinin başında biter. Çerçeve kapalıyken dizi (`chainOf`) yoktur: sahne `chain` almaz, kendiliğinden devam ve kartın dizi satırı çalışmaz. `Plan.candidates` çerçevesiz günde çapalı işi de taşır (Ç3g öncesindeki gibi; Ç3 kabulündeki taban testi onu okur). Gerekçe: 14 Kas 2026'da çerçeve kapalıyken öğleden sonra etkinleştirilen Rutin'in sabahı ve akşamı sıradan ritim gibi öne geldi (`docs/ILERLEME.md`, Ç3g).

**Uyku planı (`sleepPlan`).** Her gece için bir yatış, ertesi sabah için bir uyanış seçer; amaç aralıkların içinde kalarak uyku hedefini tutturmaktır. Saf fonksiyondur; yapay zekaya sorulmaz. Uyku borcu tutulmaz: her gece kendi hedefiyle planlanır. Uygulama uyandırmaz; planlanan uyanış bilgidir.

1. **En geç uyanış.** `ilk sabit blok − bloğun yol süresi − uyanışa bağlı işlerin ayak izi`; yükümlülük yoksa uyanış aralığının sonu. Aralığın sonunu geçemez; sabit yükümlülük onu aralığın başından da erkene çekebilir.
2. **Yüke göre erkene çekme.** Günün yükü (o gün zorunlu olacak işlerin süresi ve haftanın taahhüt edilmiş payından kalanın haftanın kalan günlerine eşit bölümü) en geç uyanışla kurulan günün kapasitesine sığmıyorsa uyanış 15'er dakika erkene çekilir: sığana ya da sınıra gelene kadar. Yük sığıyorsa uyanış en geç uyanışta kalır.
3. **Uyku feda edilmez.** Erkene çekmenin sınırı `max(uyanış aralığının başı, yatış aralığının başı + uyku hedefi)`dir: yük uyanışı ancak yatış da aynı kadar erkene alınabiliyorsa erkene çeker.
4. **Planlanan yatış** `planlanan uyanış − uyku hedefi`, yatış aralığına sıkıştırılır. Uykuyu hedefin altına yalnızca sabit bir yükümlülük düşürebilir (en geç uyanış − yatış aralığının başı < hedef); o zaman plan bunu söyler (`short`, "Bu gece en çok 7 sa uyku").
5. **Gerçek yatış planı değiştirir.** Yatış kaydedilince (ya da kullanıcı o geceye bir yatış verince) beklenen uyanış `yatış + uyku hedefi` olur; uyanış aralığının başından erken, en geç uyanıştan geç olamaz. En geç uyanışa sığmayan uyku kısa kalır ve plan söyler.
6. **Kullanıcının uyanışı.** O güne verilen uyanış (`expected_wake`) yükten ve yatıştan önce gelir; yatış ondan `uyku hedefi` geriye sayılır (yatış aralığına sıkıştırılır).
7. **Gerçek uyanış her şeyin önündedir.** Uyanış kaydedilince gün ona göre kurulur.

## Günün çerçevesinin uygulama notları (Ç3c)

- Girdi: `PlanInput.frame` (uyanış, kayıtlı mı, tahmini mi, beklenen yatış, kayıtlı yatış, yatış aralığının sonu, sabah durumunun bittiği an, bu gecenin uyku planı). Satırlardan `planInput` kurar; çerçeve kapalıyken alan yoktur. Çıktı: `Plan.frame` (uyanış, günün başı, çalışma penceresinin sonu `workEnd`, beklenen yatış) ve çapalı yuvanın `part` alanı (`wake`, `bed`; Ç4a: `evening` yok).
- **Günlerin sonu (Ç4a).** `dayFrameOf` her günün başını (`settings.dayStarts`) olduğu gibi sonunu da verir (`settings.dayEnds`): bugün beklenen yatış eksi bugünün yatışa bağlı işleri; sonraki 56 gün (tahminin erimi; `DAYS_AHEAD`), ertesi sabahın en geç uyanışından uyku hedefi geriye sayılan (o gecenin yatış aralığına sıkıştırılmış) yatış eksi o günün yatışa bağlı işlerinin kaba ayak izi. Listede olmayan gün ayardaki yatışta (`PlannerSettings.bedtime`: çerçevenin yatış aralığının başı, çerçeve kapalıyken 22:00) biter. Gün kapasitesi (`dayCapacity`) ve "Bu hafta uygun saat yok" bunu okur.
- Gece, çerçeve açıkken `05:00`'te ya da uyanış aralığının başında (hangisi erkense) biter (`planningDay`).
- `morning` durumu uyanış aralığının sonundan bir saat sonra biter (**görüşün gerek**): o saate kadar "Uyandım" denmemiş ve hiçbir yere dokunulmamışsa gün beklenen uyanışla kurulur ve ekran olağan durumuna geçer (kural 3: sistem ritüele bağımlı değildir).
- "Uyandım" denmeden günün ilk dokunuşu sabah durumu sürerken yapılırsa uyanış o an yazılır ve tahmini işaretlenir (`woke_estimated`); sabahtan sonraki ilk dokunuş uyanış sayılmaz (gün beklenen uyanışla sürer). İlk dokunuş (`started_at`) her durumda yazılır.
- Akşam kapanışı yapıldıysa (`closed`) çerçeve açıkken ekran gece değil akşam durumundadır (yalnızca "Yatıyorum" kalır); gece yatışla ya da yatış aralığının sonuyla gelir. Ç4a: kapanış yapılmasa da çalışma penceresi bitince (yatışa bağlı dizinin başı, o yoksa beklenen yatış) akşam durumu gelir.
- Uyku planının günün yükü için o günün adayları, günün başı en geç uyanışla kurulmuş bir girdiyle hesaplanır (döngüsüzlük için).
- Uyanışa bağlı işlerin dizisi, bittiği andan 60 dakika sonrasına kadar önerilir ("Biraz önce: 30 dk" denince rutin kaybolmasın); sonra o gün düşer. Yatışa bağlı iş zamanı geçince düşer. **Görüşün gerek.**
- **Diziler (Ç3f).** Ekrandaki dizi (`SceneChain`, `docs/06-modul-sozlesmesi.md` "Diziler") planlayıcının parçası değildir: `src/core/today/chain.ts` içindeki saf `chainOf` planın `part: 'wake'` ve `part: 'bed'` yuvalarından (sırada ya da çalışıyor), bugün yapılmış çapalı işlerden (`done`: bugün biten iş ve oturum işi, bugün kaydı düşen ritim), bugün ertelenen çapalı işlerden ve çapalı olup yuvası kalmamış adaylardan (`passed`) kurar. Sıra yuvaların sırasıdır; yapılmış ve geçilmiş işler `order`'larına göre araya girer. Kendiliğinden devam da (`day_frame.chain_auto`) planlayıcıyı değiştirmez: sıradaki işi bitirme anındaki plandan alır ve olağan oturum yolundan başlatır. Aynı girdi aynı planı verir (testle).
- Haftanın kapasitesinde yarın, yüke göre erkene çekilmiş uyanıştan değil en geç uyanıştan (yatış kaydı ya da kullanıcının değeri varsa ondan) sayılır: bugün iş bitirmek yarının yükünü hafifletip uyanışı geri kaydırır; bu, kapasite kaybı sayılıp taahhüdü yeniden kurdurmamalı.
- Basitleştirmeler: "bugün kapalı" denetimi (penceresi bugün kalmamış iş) bütün işlerde beklenen yatışa bakar (yatışa bağlı işler düşülmez; Ç4a); gecenin bittiği saat ve 8 günden ötesinin başı genel uyanış aralığından (gün tipine özel aralık değil); yarının girdisi haftanın payını taşır (Pazar gecesi, Pazartesinin uyku planı biten haftanın payından hesaplanır); hafta ayarı `desk` bağlamıyla kurulur.
- "Bu hafta uygun saat yok": çerçeve açıkken her gün kendi başından ve kendi sonuna (Ç4a: `dayEnds`) kadar sayılır.

## "Şimdi" durumu

`plan.now` şu durumlardan biridir; Bugün ekranı buna göre çizilir:

| Durum | Koşul | Ekran |
| --- | --- | --- |
| `block` | Şu an bir sabit bloğun içinde | Bloğun adı ve bitiş saati; öneri yok |
| `running` | Açık bir oturum var | O iş, geçen süre |
| `suggest` | Boş yuva ve atanmış iş var | Yuvanın işi; Başla düğmesi |
| `prompt` | Bekleyen bir olay sorusu var ve oturum açık değil | Tek soru |
| `done` | Ç4a: planda çalışma penceresinin yapılacak işi kalmadı (bitti, ertelendi ya da düştü; plan her dakika yeniden kurulduğu için kalan pencereye sığan iş de yok) ve bugün iş vardı: biten, düşen ya da ertelenen bir iş, ertelenen kalem ya da ritim, ya da çapasız bir ritmin bugünkü kaydı. Uyanışa ve yatışa bağlı işler koşula girmez; akşam durumu kendi saatinde gelir. Kapanışın yarından çıkardığı iş "bugün iş vardı" sayılmaz (yalnızca o gün "Ertele" denenler: `days.plan.putOff`) | "Bugün tamam" |
| `empty` | Planda iş yok ve bugün iş olmadı | "Bugün için planlanan bir şey yok" ve hızlı giriş |
| `night` | Çerçeve kapalıyken: yatış (varsayılan yatış aralığının başı; Ç4a) geçti ya da gün kapatıldı. Çerçeve açıkken (Ç3c): yatış kaydedildi ya da bu gecenin yatış aralığının sonu geçti | Gece ekranı: yarının ilk işi (çerçeve açıkken yarının uyanışı) |
| `morning` (Ç3c) | Çerçeve açık, gün başladı, uyanış kaydı yok, sabah durumunun sonu gelmedi | "Günaydın", "Uyandım", bugünün kısa özeti |
| `evening` (Ç3c) | Çerçeve açık, gece değil ve: çalışma penceresi bitti (Ç4a: yatışa bağlı dizinin başı, o yoksa beklenen yatış), gün kapatıldı ya da yatış aralığı başladı ve planda pencerenin işi kalmadı (Ç4a). Yatışa bağlı iş henüz öne gelmediyse `later` olarak bekler | Akşam: zamanı gelen yatışa bağlı iş, "Günü kapat", "Yatıyorum", bu gecenin yatışı, yarının uyanışı, uyku süresi |
| `return` | Son etkileşimden beri `return_after_days` gün geçti (etkileşim: oturum, ritim kaydı, giriş, biten iş, günün ilk dokunuşu ve kapanışı; Ç3d'den beri kaydedilen uyanış ve yatış da, dışarıdan yazılsa bile) | Geri dönüş ekranı: sıradaki tek iş ve "Başla" (Ç4a; `next`) |

Sıra: çalışan, blok, gece, akşam, sabah, geri dönüş, soru, tamam, öneri. Uyanışa bağlı ilk iş "Uyandım"dan sonra kendiliğinden önerilir (yuvası uyanış anındadır); `day_frame.start_on_wake` açıksa "Uyandım" onu başlatır.

## Koruma kuralları

Her biri ayrı test edilir.

- **Taban.** Ömürlük modüllerin `weekly_floor_minutes` ve ritimlerin `floor_count` değerleri korunur (Ç4a: hayat modu yok). Taban tehlikedeyse ilgili iş zorunlu sayılır.
- **Borç sınırı.** Ritim borcu dönem bitince sıfırlanır; planlayıcı geçmiş dönemleri hiç görmez.
- **Büyük iş.** 90 dk üstü iş olamaz (şema kısıtı). Bu hafta taahhüt edilmiş bir kalemin açık oturum işi yoksa `warnings`'e "sıradaki adım tanımsız" eklenir.
- **Bekleyen iş.** Aday olmaz. `follow_up_on` günü gelince 5 dakikalık hafif bir "takip et" adayı üretilir.
- **Yatış (Ç4a; önce bitiş çizgisi).** Yatışa bağlı dizinin başından (o yoksa beklenen yatıştan) sonra yuva açılmaz. Planda iş kalmayınca `now = done` olur; sığmayan iş ekranda birikmez.
- **Otomatik plan.** `days.plan` yoksa (akşam kapanışı yapılmadıysa) plan günün ilk dokunuşunda aynı fonksiyonla kurulur; `plan_source = auto`.
- **Geri dönüş.** `return` durumunda: son tarihi geçmiş işler bugüne yığılmaz, `planned_date` değerleri temizlenir ve normal kurallarla yeniden dağıtılır. Kullanıcıya yalnızca sıradaki iş gösterilir (Ç4a).
- **Tek uyarı.** Aynı anda en fazla 2 uyarı üretilir; öncelik: yetişmeyecek son tarih, uygun saat yok (Ç3b), taban tehlikesi, tanımsız sıradaki adım, reddedilen öneri, üç kez ertelenen iş. Sonrakiler öncekilere yer kalmazsa gösterilmez (öneri yine reddedilir).

## Yeniden planlama

Plan şu olaylarda yeniden kurulur (istemcide, anında): iş eklendi, değişti, bitti ya da ertelendi; blok değişti; oturum başladı ya da bitti; kullanıcı "Yeniden planla" dedi; dakikalık saat tiki yeni bir yuvaya geçti.

"Ertele" işi bugünün planından çıkarır (`planned_date = yarın`); aynı iş 3 kez ertelenirse uyarı üretir: böl, bırak ya da tarihe bağla.

## Oturum kuralları

- Başla: açık oturum varsa önce o kapatılır.
- Oturum `est_minutes × 2` süreyi geçerse ekran sorar: "Devam ediyor musun?" Cevap gelmezse oturum, tahmini sürede bitmiş sayılarak kapatılır ve `measured = false` olur.
- Bitti: oturum kapanır, iş `done` olur, ritimse `rhythm_logs`'a kayıt düşer, ilgili olay yayınlanır.
- Ç3c: her başlatma `core.session_started`, her kapanış (Bitti, Durdur, Ertele, Takıldım, cevapsız kapanış, başka işin başlatılması) `core.session_ended` olayını işin modülüne yayınlar (`docs/06-modul-sozlesmesi.md`, "Olaylar").

## Öğrenme (Ç3'ün ikinci yarısı)

Haftada bir, yalnızca `measured = true` oturumlardan:

- **Tahmin çarpanı.** `(modül, iş türü)` başına son 20 oturumun `gerçek ÷ tahmin` ortancası; 0,5–3 arasına sıkıştırılır; en az 5 örnek yoksa 1.
- **Kapasite çarpanı.** Gün tipi başına `çalışılan süre ÷ yuva süresi`, üstel hareketli ortalama; en az 5 gün yoksa ayarlardaki değer.

Değerler `planner_stats`'a yazılır. Öğrenme planlayıcının kendisini değiştirmez, yalnızca girdilerini.

## Akşam kapanışı

Kapanış, yarının planını kullanıcıya onaylatmaktır. Yapay zeka açıksa taslak `plan` çağrısından gelir ve gerekçeleriyle gösterilir; kapalıysa planlayıcının taban planı gösterilir:

1. Cevaplanmamış olay soruları (en fazla 5).
2. "Bugün başka ne yaptın?": açık kalan ya da kaydedilmemiş işler için tek dokunuşla işaretleme.
3. Yarının taslağı: `buildPlan(yarın)` çıktısının çalışma penceresindeki işleri, sırasıyla. Kullanıcı iş çıkarabilir ("İstemediğini çıkar."; Ç4a: işaret kutusu ve günün 3 işi yok).
4. Boşaltma kutusu: akla gelenler gelen kutusuna.
5. Onay: yarının işleri sırayla gösterilir; `days` kaydı yazılır (`plan_source = closing`; çıkarılanlar `skipped`), ekran gece moduna geçer.

## Gelecek günlerin tahmini (Ç4a)

Takvim'in gelecek günündeki "Planlananlar" için (`docs/13-cam-dili.md` 4.3; ekranı Ç4c'de). `forecastDays(input, todayPlan, { from, to })` (`src/core/planner/forecast.ts`, saf):

- Bugünün planındaki işler yapılmış sayılır; sonra yarından başlayarak her gün sırayla, aynı kurallarla (`buildPlan`, uyarısız) planlanır ve o güne konan işler sonraki günler için yapılmış sayılır: iş biter, oturum işi biter ve kalemin eforu artar (sıradaki oturum gelir), kalemin kendisi eforunu artırır, ritim o güne kaydedilir (dönemine göre), takip bir kez hatırlatılır. Haftalık tabanın harcanan süresi hafta hafta sayılır.
- Günün başı ve sonu `dayStarts` ve `dayEnds`'ten (yoksa ayardaki saatler); çerçeve, açık oturum, soru, ertelenenler ve yapay zekanın önerisi yoktur. Cihazın bağlamı taşınmaz: o gün nerede olunacağı bilinmediği için süzgeç kapalıdır (`context: null`); tahmin panoda da telefonda da aynıdır. Uyanışa ve yatışa bağlı işler tahmin edilmez; çerçeve açıkken süreleri tahminin bütün günlerinde günün başından ve sonundan düşülür (`dayStarts`, `dayEnds` tahminin erimi kadar hesaplanır). Çerçeve kapalıyken düşülmez (bilinen sınır: o günlerin kapasitesi rutin süresi kadar fazla).
- Bu haftanın günleri haftanın taahhüdüyle ve paylarıyla planlanır; sonraki haftaların taahhüdü yoktur: kalemleri taahhütsüz haftadaki gibi adaydır, yeni oturum işi açılmaz.
- Erim: bugünden en çok 8 hafta (`FORECAST_WEEKS`; bloklar da o kadar okunur); ötesindeki gün için tahmin yoktur. Kaydedilmez, her okunuşta yeniden hesaplanır; o günün sabahında gerçek plan onun yerini alır ("Plan tahminidir; o sabah yeniden kurulur."). Aynı girdi aynı tahmini verir; girdiyi ve bugünün planını değiştirmez (testle).
- Bilinen sınırlar: gün gün açgözlüdür (sonraki günlerin yükünü bilerek bugünü hafifletmez); yeni haftaların taahhüdü ve oturumlara bölünmesi tahmin edilmez; tahmin yuvalar kadar ayrıntılıdır, kullanıcı o güne kadar planı elbette değiştirir.

## Takvim'in verisi (Ç4a)

- **Haftanın işleri** (`weekWork`, `src/core/planner/week.ts`): bu hafta için taahhüt edilen kalemler ve haftada teslim olan her iş (kalem ya da tek iş), teslim tarihine göre sıralı, tarihsizler sonda. Satır: tür, ad, modül, teslim, pay (taahhütte haftanın payı; haftada teslim olan taahhütsüz kalemde kalanın tamamı; tek işte tahmini süre), işlenen süre (taahhütten beri; biten tek işte süresi), bitti mi, yapay zekanın haftalık notu (`week_plans.reasons`). Sonraki bir hafta için: yayılmanın (`spreadItem`) o haftaya verdiği pay ve o hafta teslim olanlar.
- **Sekiz haftanın iş ve vakti:** `loadByWeek` (talep ve kapasite, teslimler) seçili haftadan sekiz hafta.
- **Veriye ulaşan yol:** saf `calendarOf` (`src/core/planner/calendar.ts`, testli) ve onu bugünün planıyla birlikte yeniden hesaplayan `useCalendar(week)` (`src/core/app/hooks.ts`): tahmin, haftanın işleri ve sekiz hafta. Kapanış yarının kaydına `putOff: []` yazar: çıkardıkları ertesi günün "Ertele"si sayılmaz.

## Uygulama notları (Ç3)

Kod `src/core/planner/` içindedir; dokümanın açık bıraktığı yerler şöyle yorumlandı:

- **Girdi.** `PlanInput` yukarıdakine ek olarak taşır: `closed` (gün akşam kapatıldı), `spentThisWeek` (modül başına bu haftaki dakikalar; haftalık taban için), `committed` (haftanın taahhüt ettiği kalemler; yoksa `null`), `skipped` (bugün ertelenen kalem ve ritimler), `openSession`, `prompt`, `lastSeenAt` (bugünden önceki son kullanım: oturum, ritim kaydı, giriş, biten iş), `startedToday`. Girdi satırlardan `planInput` ile kurulur; ekran da sunucu da aynı fonksiyonu kullanır.
- **Yuvalar.** 90 dakikadan uzun aralık açgözlü bölünür: 90 dk derin, 15 dk mola, kalan için yeniden; artan parça uzunluğuna göre derin, hafif ya da atılır. İş yuvanın başına konur, yuvanın kalanı kendi başına bir yuva olur (derin, hafif ya da atılır; molanın kalanı atılır).
- **Kapasite.** Zorunlu işler kapasite çarpanını aşabilir, yuvaların fiziksel süresini aşamaz; enerjisi uymayan zorunlu iş süresi yeten ilk mola dışı yuvaya konur. Öğrenilen kapasite çarpanı 0,2–1 arasında tutulur (kaydı tutulmayan günler planı boşaltmasın).
- **Fiziksel iş.** Koşu, spor gibi masa başı olmayan iş süresi yeten her yuvaya girer; mola yuvası yalnızca kısa olanı alır. Doküman fiziksel işi yalnızca molaya koyuyordu; 15 dakikadan uzun fiziksel iş hiç planlanamıyordu. **Görüşün gerek.**
- **Acil kalem.** Aciliyet kalemin kalan toplam eforundan hesaplanır; aday olan (ve zorunlu sayılan) yalnızca sıradaki oturum işidir. Son tarihi bugün olan kalemin bütün oturumları adaydır ve zorunludur.
- **Haftanın payı.** Girdi her taahhüt edilmiş kalemin haftalık payını ve taahhüt anındaki biten eforunu taşır (`shares`). Pay işlenince kalem önerilmez ve "sıradaki adım tanımsız" uyarısı çıkmaz; eforun kalanı sonraki haftalarındır.
- **Yapay zekanın modül payları** (`week`): yapay zekanın önerdiği dakikalar geçerlidir, ama hiçbir modül ritimlerinin ve tabanının istediğinden aza düşmez.
- **Tahmin çarpanı.** Süre `est_minutes × çarpan`; 90 dakikayı aşan iş hiçbir yuvaya girmez ve o gün planlanmaz (Ç4a: "vakit kalırsa" yok). Bugün teslim olan böyle bir iş en uzun derin yuvaya konur (bugün başlanır, sonraki yuvada sürer).
- **Bekleme terimi** son tarihsiz işlere ve kalemlere uygulanır; ritimlerin yerine borçları vardır.
- **Öneri ve taban.** `defer` bütün zorunlu işaretlerden (haftalık taban dahil) sonra uygulanır; zorunlu iş ertelenemez, uyarı çıkar.
- **"X dk'm var"** 15 dakikanın altında mola yuvası gibi davranır: fiziksel ya da kısa hafif iş.
- **Geçmiş son tarih.** Son tarihi geçmiş iş zorunlu olmaz ve aciliyeti 0,5 sayılır: bugüne yığılmaz (kural 2), havuzda sıradan iş gibi planlanır.
- **Taban.** Ömürlük modülün haftalık tabanı `weekly_floor_minutes`'tır (Ç4a: mod çarpanı yok; `modules.mode_behavior` ve `rhythms.mode_targets` okunmaz). Taban, haftanın kalan günleri tabana ulaşmak için gereken 45 dakikalık oturum sayısından fazla değilse tehlikededir; o zaman modülün en iyi adayı zorunlu olur. Ritmin hedefi `target_count`'tur, `floor_count`'un altına inmez. Ağırlığı 0 olan modül yalnızca bugün teslim olan işini önerir.
- **Gece.** Yatıştan sonra (çerçeve kapalıyken varsayılan yatış; Ç4a), gün kapatılınca ve saat 05:00'ten (günün başlangıcı daha erkense ondan) önce `now = night`. Gece yarısından sonra, gece bitmeden yapılan kapanış (`tomorrowInput`) başlayan günü planlar (`planningDay`). Açık oturum, bloğun içinde olmak ve gece sırayla önce gelir; sonra geri dönüş, soru, tamam, öneri.
- **Tamam.** Ç4a: planda çalışma penceresinin işi kalmamışsa ve bugün iş olmuşsa (yukarıda "Şimdi" durumu). Günün üç işi kalktı.
- **Haftanın kalemleri.** Hafta planı varken Bugün yalnızca taahhüt edilmiş kalemleri (ve eforu dolup "Bitti mi?" bekleyenleri) önerir; kalemlerin oturum işleri her zaman aday olur. Tarihsiz kalem haftalık yüke girmez (kendi haftası yoktur); taahhütte kapasite kalırsa bir oturumluk payla girer. Bu hafta teslim olan kalem kapasiteyi aşsa da taahhüt edilir.
- **Pay.** Kalemin haftaya düşen payı `spreadItem`: kalan efor, başlangıçla (ya da şimdi) son tarih arasındaki haftalara kapasiteyle orantılı; aralığın ötesine düşen haftaların payı aralığa yüklenmez. Pay `session_minutes` uzunluğunda (yoksa 45, en çok 90) oturumlara bölünür, sonuncusu kısa olabilir (en az 15).
- **Yeniden taahhüt.** `recommitReason`: taahhüdün dışında bu hafta teslim olan yeni kalem ya da kalan günlerin kapasitesinin toplamda 30 dakikadan çok düşmesi (Ç4a: mod değişimi yok). Kapasite gün gün, taahhüt anında saklanan tam gün kapasitesiyle (`week_plans.day_capacity`) karşılaştırılır; geçen saatler kayıp sayılmaz. Kullanıcının isteği çağıranın işidir.
- **Haftanın kurulması.** Uygulama açıkken hafta kendiliğinden kurulur (`PlanKeeper`, `keepWeek`): haftanın ilk açılışında taahhüt, tetikleyiciyle yeniden taahhüt, yeni kalem gelince ekleme. Haftanın ilk taahhüdünde önce öğrenme çalışır, taahhüt öğrenilen değerlerle kurulur; öğrenme hafta içinde değişmez. Yapay zeka açıkken taahhüdü sunucu yapay zekanın önerisiyle kurar (`week`); gelecek haftanın Cumartesiden kurulması yoktur, hafta kendi ilk açılışında kurulur (`docs/10-yapay-zeka.md`, "Akışlar (Ç3)").
- **Oturum işleri.** Planlayıcı da Bugün listesi de bir kalemin yalnızca sıradaki oturum işini aday sayar: çalışan; yoksa bugüne planlanmış adım ("Adımı küçült"); yoksa sırası (`position`) en küçük olan; sırasız olan (elle başlatılmış) en sonda. O bitince plan yeniden kurulur, sıradaki gelir. Son tarihi bugün olan kalemin bütün oturum işleri aday ve zorunludur. Aynı kalemin açık iki oturum işi aynı sırayı paylaşamaz (tekil indeks): iki ekran haftayı aynı anda kurarsa ikinci yazma düşer. Eforu dolan kalemin başlanmamış oturum işleri bekler, kalemin kendisi "Bitti mi?" diye sorar: kendi yuvası gelince ve gün "tamam"a geçmeden önce. **Görüşün gerek** (listede tek oturum).
- **Ertele ve bekleme kalemde.** Bir oturum işi ertelenince kalemin öbür oturumları da o gün listeden çıkar; "Birini bekliyorum" denince kalemin kendisi `waiting` olur, takipte "Cevap geldi" kalemi yeniden açar.
- **Günün kaydı.** Otomatik plan (`plan_source = auto`) günün ilk açılışında yazılır; günün ilk dokunuşu (`started_at`) yalnızca kullanıcı bir ekrana dokununca ya da bir tuşa basınca yazılır (ikinci ekran gece de açık durur). Kayıt günün tipini (`day_type`) ve bütün günün yuva süresini (ilk kayıttaki değer; Ç4a: günün başından yatışa bağlı dizinin başına) tutar; kapasite öğrenmesi bunları okur. Ç4a: `top3` ve `life_mode` yazılmaz. Planlayıcının girdisinde gün tipi her zaman bloklardan türetilir.
- **Eksik oturum işleri.** Taahhüt edilmiş, haftalık payından kalanı olan ama açık oturum işi olmayan kalemin (hafta kaydı ile oturum işleri iki ayrı yazmadır, ikincisi yarıda kalabilir; ya da hepsi bırakılmıştır) payının kalanı yeniden oturumlara bölünür (`missingSittings`, `weekAction` → `repair`).
- **Yeni kalem.** Taahhütten sonra açılan kalem, haftada yer varsa taahhüde eklenir (`weekAction`, `appendable`); taahhüt edilmiş kalemlerin payı değişmez. Kullanıcının elle eklediği kalem (modül anahtarı yok) yer olmasa da eklenir: eklemek kullanıcının isteğidir.

## Uygulama notları (Ç3b)

Kod `src/core/planner/timing.ts` (yardımcılar), `candidates.ts` ve `plan.ts` içindedir. Dokümanın açık bıraktığı yerler:

- **Yalnızca `timing` taşıyan aday yeni yoldan geçer.** `timing` boşsa (ya da veritabanındaki değer şemadan geçmiyorsa) aday eskisi gibi yerleşir; Ç3'ün testleri değişmeden geçer.
- **Bugün kapalı iş.** Penceresi bugünü kapsamayan ya da bugünün kalan penceresinde (günün başı ya da şimdiden beklenen yatışa kadar; Ç4a) kendi süresi kadar kesintisiz aralık bırakmayan iş aday değildir. Zorunluysa "Bugün uygun saat kalmadı" uyarısını üretir.
- **Ayak izinin taşması.** Ayak izi yalnızca başladığı yuvanın ardından kesintisiz gelen boş yuva ve molalara taşar. Yuvalar kesilirken atılan kısa artıklar (15 dakikadan kısa) yuva olmadığı için kullanılamaz.
- **Atama.** Atamanın yuvası çalışma aralığıdır; yol süreleri atamada (`travelBefore`, `travelAfter`) taşınır ve hiçbir yuvada yer almaz. Yol, cihaz işin bağlamındayken 0'dır ve atamada hiç yazılmaz.
- **Zorunlu iş.** Enerjisi uymayan zorunlu iş, zaman kuralları içinde kalmak şartıyla enerji süzgeci olmadan yerleşir. Penceresi olan zorunlu iş hiçbir yuvaya sığmazsa yerleşmez ve "Bugün uygun saat kalmadı" der; "en uzun derin yuvaya kırparak koyma" ona uygulanmaz (pencere kesindir). Yol da kesindir: yolu olan zorunlu iş ayak izi sığmazsa yerleşmez ve aynı uyarıyı verir. Yalnızca tercih ya da kaçınma taşıyan zorunlu iş kendi kurallarıyla yerleşemezse Ç3'teki yedeklere (enerji, kırpma) düşer; orada tercih dikkate alınmaz.
- **Bugün kapalı işin son tarihi.** Pencereleri bugün kapalı iş de "yetişmeyecek son tarih" uyarısına girer (kullanılabilir süre pencereden sayılır), sonra "Bugün uygun saat kalmadı". Son tarihi bugünse yalnızca ikincisi çıkar.
- **Kart.** Kart planın zaman sırasındaki ilk işini önerir (Ç3'teki gibi). O iş pencereye ya da yola bağlıysa ve ayak izi henüz başlamadıysa kart onu `at` (ayak izinin başladığı an, yola çıkış) ile önerir; ekran saati söyler, kullanıcı yine elle başlatabilir. Önündeki boş zamanda serbest bir iş olsaydı doldurma onu oraya koyardı. **Görüşün gerek.**
- **Doldurma.** Zaman kısıtlı işin skoru yuvadaki zaman çarpanıyla çarpılır; sıralama `compareScored` ile yapılır (zorunlu önde). Bekletme yalnızca `prefer` ya da `avoid` taşıyan işe uygulanır.
- **Ulaşılabilir sayı.** Dinlenme günü, dönemin içindeki değil son gerçek yapılıştan sayılır (önceki dönemin son yapılışı da): kural 5 ile aynı. Gün düzeyinde sayılır: bugün, penceresi geçmiş olsa da haftanın günü uyuyorsa sayılır (taban uyarısı bir gün geç çıkabilir; bilinen basitleştirme).
- **Reddedilen öneri.** Yapay zekanın `prefer` önerisindeki iş bugün kapalıysa ya da penceresi içinde hiçbir boş yuvaya sığmıyorsa öneri uygulanmaz ve uyarı çıkar: "…: bu saatlerde yapılamaz, öneri plana alınmadı."
- **"X dk'm var".** Pencere ya da yol taşıyan iş yalnızca hemen (yolu varsa yoldan hemen sonra) başlayabiliyorsa önerilir; penceresi birazdan açılacak iş önerilmez. Verilen dakikalar mola uzunluğundaysa (15 dakikanın altı) önerilmez; yalnızca tercih ya da kaçınma taşıyan iş Ç3'teki gibi değerlendirilir.
- **Yol ve bağlam.** Yol yalnızca cihazın bağlamı işin bağlamına tam eşitse 0 sayılır (kural 3'ün lafzı). İkinci ekran (`desk`) `home` işini görür ama orada yol sayılmaya devam eder: yolu olan bir ev işi beklenmiyor. **Görüşün gerek.**
- **"Bu hafta uygun saat yok" (`weekNoTime`).** Haftanın kalan günlerinde (bugün şimdiden) boş aralıkla pencerenin kesişiminde bir ayak izi aranır: çalışma pencerenin içinde, yol boş aralığın içinde. Bilerek basit tutulanlar: yuva yerine boş aralık, tahmin çarpanı yok (kalemin sıradaki oturum uzunluğu, ritmin süresi), cihaz bağlamına göre yolun sıfırlanması yok, oturum işlerinin kendi `timing` değeri ve ritmin `rest_days` değeri okunmaz. Bakılanlar: taahhüt edilmiş (payı işlenmemiş) ya da bu hafta teslim kalemler; haftalık tabanı henüz karşılanmamış ritimler (aylık ve günlük ritimler haftaya göre yargılanmaz). Bir oturum işinin "Bugün uygun saat kalmadı" uyarısı varsa kalemi için ikinci uyarı çıkmaz.
- ~~**Bitiş çizgisinden sonra.**~~ Ç4a'da kalktı (gün uyarısı ve form uyarısı).
- **Reddedilen öneri ve enerji.** Pencere içindeki tek yuva işin enerjisine uymuyorsa öneri de reddedilir (zorunlu iş hariç: o enerjiden bağımsız yerleşir).

## Test kapsamı (en az)

- Blok ve yol süresi çıkarıldıktan sonra yuvaların doğru üretimi
- Uzun aralığın derin + mola yuvalarına bölünmesi
- Üç süzgecin her biri
- Zorunluların skordan bağımsız öne geçmesi
- Tabanın korunması (Ç4a: modsuz; saklı mod değerleri okunmaz)
- Yatıştan sonra yuva açılmaması ve `done` durumu (Ç4a koşulu)
- Otomatik planın kapanış planıyla aynı sonucu vermesi
- Geri dönüş durumunun gecikmiş işleri yığmaması
- Bekleyen işin aday olmaması, takip gününde hatırlatma üretmesi
- Ölçülmemiş oturumun öğrenmeye girmemesi
- `advice` içindeki önerinin koruma kurallarını aşamaması; `advice` yokken planın geçerli kalması
- `loadByWeek`: kalemin eforunun haftalara dağılımı; kapasiteyi aşan haftanın işaretlenmesi
- `commitWeek`: yalnızca o haftanın eforunun oturumlara bölünmesi; bağımlılığı bitmemiş kalemin taahhüt edilmemesi
- Hafta içinde tetikleyici yokken taahhüdün değişmemesi

Zaman kısıtları (Ç3b):

- `timing` taşımayan girdide planın değişmemesi: Ç3'ün bütün testleri değiştirilmeden geçer
- Pencere dışındaki yuvaya yerleşmeme; yuvanın pencereyle kesişimi işe yetmeyince yerleşmeme; çalışmanın pencerenin başladığı ana konması ve artan parçaların yuva olması
- `days` kısıtı: pencerenin kapsamadığı günde aday olmama
- Zaman çarpanı (tercih edilen, nötr, kaçınılan) ve "yarısı" eşiği
- Doldurmada bekletme: ileride daha iyi yuvası olan adayın atlanması; ileride yuvası yoksa kaçınılan yuvaya konması
- Zorunlu işin kaçınılan yuvaya yalnızca başka yuva yokken konması
- Ayak izi: yol + iş + yol; yuvayı aşan ayak izinin aynı boş aralıkta molaya ve sonraki yuvaya taşması; bloğa, bloğun yoluna ve günün penceresinin dışına taşmaması; molada başlamaması
- Yolun kapasiteye sayılmaması, kapladığı sürenin başka işe verilmemesi
- Bağlam: yol süresi tanımlı işin her bağlamda aday olması; cihaz işin bağlamındayken yolun 0 sayılması
- `rest_days`: son yapılıştan sonraki günlerde aday olmama; günü dolunca aday olma
- Ulaşılabilir sayı: `windows` günleri ve `rest_days` ile taban tehlikesinin doğru hesaplanması
- Aciliyet: pencereli işte kullanılabilir sürenin yalnızca pencere içinden sayılması; zorunlu eşiğinin buna göre aşılması
- Bugün teslim olan işin penceresi kalmadıysa yerleşmemesi ve "Bugün uygun saat kalmadı" uyarısı
- "Bu hafta uygun saat yok" uyarısı
- Pencereyi çiğneyen yapay zeka önerisinin reddedilmesi
- `pickForMinutes`'in pencereye ve ayak izine uyması
- Oturum işinin kendi `timing` değerinin kalemin değerinin önüne geçmesi
- Zarf doğrulaması: `from < to`, boş liste, 14 sınırı, `rest_days` uygunluğu, biçime göre izinli alanlar

Günün çerçevesi (Ç3c):

- Çerçeve kapalıyken planın Ç3b'dekiyle aynı olması; çerçeve açık ama uyanış kaydı ve çapa yokken pencerenin içindeki planın aynı pencereyle Ç3b'nin planı olması
- Günün başı: kayıtlı uyanış, yoksa `expected_wake`, yoksa uyku planı; uyanışa bağlı işlerin ayak izinin eklenmesi; geç uyanışta pencerenin kısalması
- Uyku planı: ilk yükümlülüğe göre en geç uyanış (yol ve ayak izi dahil); yükümlülük yokken aralığın sonu; yük sığmayınca 15'er dakika erkene çekme; yük hafifken çekmeme; uykunun yüke feda edilmemesi (yatış aralığının başı sınırı); sabit yükümlülüğün uykuyu kısaltması ve `short`; gerçek yatışın ertesi günün beklenen uyanışını değiştirmesi (geç yatış geriye, erken yatış öne, sınırlar); kullanıcının uyanış ve yatış değerleri
- Çapalı işler: uyanıştan art arda, yatışta bitecek biçimde geriye, `order` ve skor sırası, yuvalara dağıtılmama
- Ç3g: çerçeve kapalıyken uyanışa bağlı işin günün başında dizilmesi ve saati geçince düşmesi (öğleden sonra önerilmemesi); yatışa bağlı işin varsayılan yatıştan önce dizilmesi ve yalnızca yuvasından 15 dakika önce önerilmesi; kapatılmış günde yatışa bağlı işin `later` olarak beklemesi, vakti gelince `next` olması
- `now`: `morning`, `evening`, `night` koşulları ve sıraları; kapatılmış günün akşamda kalması
- Hafta: yarının beklenen uyanışı değişince günlük kapasitenin değişmesi ve 30 dakikadan çok düşüşün yeniden taahhüdü tetiklemesi

Sadeleşen çekirdek (Ç4a):

- Çalışma penceresinin yatışa bağlı dizinin başına (o yoksa beklenen yatışa; çerçeve kapalıyken varsayılan yatışa) uzanması; eski bitiş çizgisinden sonraki saatlerin kapasiteye sayılması; uykunun yüke feda edilmemesi (pencerenin yatışın içine uzanmaması)
- `after_finish`'in okunmaması: aynı iş alanla ve alansız aynı yere konur; "Saatleri bitiş çizgisinden sonra" uyarısının olmaması
- Akşam durumunun pencere bitince (ya da kapanışla) gelmesi; kapatılmış günde yatışa bağlı işin `later` olması
- "Bugün tamam": planda iş kalmayınca; sığan iş kalınca öneri; hepsi ertelenince ya da düşünce de tamam; çapasız ritim kaydı sayılır, çapalı sayılmaz; çapalı iş tamamı bekletmez
- Geri dönüşte sıradaki tek iş (`next`), iş yoksa `null`
- Hayat modunun girdide olmaması; saklı `mode_behavior` ve `mode_targets`'ın okunmaması; ağırlığı 0 olan modül
- Bağlam: bilinmeyen bağlamda süzgecin kapalı olması; `inferContext`'in dört kaynağı sırasıyla (bildirimin 3 saati, yeri olan bloğun şimdi ya da 30 dakika içinde olması, yerin sözcüğü ya da gün tipi, günün tipi; varsayılan gün tipinin sayılmaması), panonun her zaman `desk` olması
- Gelecek günlerin tahmini: bugünün sığmayanının yarına geçmesi; önceki günlere konanın düşülmesi (iş, oturum sırası, kalemin haftalık payı ve sonraki haftanın taahhütsüz olması, ritmin dönemi); blok ve pencerelere uyması; çapalı işin tahmin edilmemesi; aynı girdiyle aynı tahmin ve bugünün planının değişmemesi; istenen günler ve sekiz haftalık erim
- Haftanın işleri (`weekWork`): taahhüt edilenler ve haftada teslim olanlar teslim sırasıyla, tarihsizler sonda; pay ve işlenen süre; sonraki hafta için yayılan pay; biten iş, başka modülün ve kapalı işin dışarıda kalması
