# Planlayıcı

Planlayıcı günü yuvalara böler ve her yuvaya en uygun işi koyar. Saf TypeScript'tir (`src/core/planner/`): girdisi veri, çıktısı plan. Veritabanına, saate ve ağa dokunmaz; şimdiki zaman parametredir. Bu sayede her kural test edilir ve ekran yapay zekaya ya da sunucuya sormadan güncel kalır.

## Arayüz

```ts
type PlanInput = {
  now: Date
  date: string                 // 'YYYY-MM-DD'
  dayType: 'home' | 'office' | 'campus'
  lifeMode: 'normal' | 'busy' | 'minimum' | 'holiday'
  dayStart: Date               // günün ilk dokunuşu ya da varsayılan; çerçeve açıkken uyanış (Ç3c)
  finishLine: Date
  frame?: DayFrame             // Ç3c: uyanış, beklenen yatış, uyku planı ("Günün çerçevesi")
  blocks: Block[]
  tasks: Task[]                // todo ve doing
  workItems: WorkItem[]
  rhythms: RhythmWithProgress[]   // dönem içi yapılan sayısıyla
  modules: Module[]
  context: Context             // cihazın bağlamı: ikinci ekran 'desk', telefonda seçilen
  settings: Settings
  stats: PlannerStats
  advice?: PlanAdvice          // yapay zekanın önerisi: top3, prefer, defer
}

type Plan = {
  slots: Slot[]                // sıralı; her biri bir atama taşıyabilir
  top3: string[]               // iş ya da ritim id'leri
  now: NowState                // şu an ekranda ne olmalı
  overflow: string[]           // "vakit kalırsa" listesi
  warnings: Warning[]          // sıkışma, tanımsız sıradaki adım...
  usableMinutes: number
}

function buildPlan(input: PlanInput): Plan
function pickForMinutes(input: PlanInput, minutes: number): Candidate | null   // "X dk'm var"
```

## Yapay zekayla iş bölümü

Planlayıcı tek başına geçerli bir plan kurar. Yapay zeka bu planı iyileştirir, yerine geçmez (akış: `docs/10-yapay-zeka.md`, "Plan çağrısının akışı"):

- Süre, önem ve `planned_date` gibi alanları yapay zeka veriye yazar; planlayıcı bunları sıradan girdi olarak okur.
- `advice` verilmişse: `top3` bugün teslim işlerden sonra günün 3 işi olarak alınır (madde 8), `prefer` içindeki işlerin skoru 1,5 ile çarpılır, `defer` içindekiler bugünün adaylarından çıkarılır.
- Öneri hiçbir koruma kuralını aşamaz. Zorunlu bir iş `defer` edilmişse öneri yok sayılır ve uyarı üretilir; kapasiteyi aşan `top3` kırpılır.
- `advice` yoksa planlayıcı kendi taban planını üretir; plan yine geçerlidir.

## Plan ufukları

Plan dalga dalga ayrıntılanır: uzak ufuk kaba, yakın ufuk ince. Her ufukta hesap kodda, yargı yapay zekadadır.

| Ufuk | Birim | Kod ne yapar | Yapay zeka ne yapar | Ne zaman |
| --- | --- | --- | --- | --- |
| Dönem, ay | İş kalemi (toplam efor) | Hafta hafta talep ve kapasiteyi hesaplar (`loadByWeek`) | Sıkışan haftaları yorumlar; öne çekme, bırakma, mod önerir | Ayın ilk açılışında, sıkışan hafta varsa |
| Hafta | İş kalemi → oturum işleri | Kapasiteyi, tabanları ve bağımlılıkları denetler; taahhüt edilen kalemleri oturumlara böler | Haftanın kalemlerini ve modül başına saat payını seçer | Haftanın ilk açılışında; hafta içinde tetikleyicide |
| Gün | Oturum işi → yuva | Yuvaları kurar, süzgeçleri ve koruma kurallarını uygular | Günün 3 işini, sırayı ve ertelenecekleri seçer | Günde bir kez: akşam kapanışında ya da günün ilk açılışında |
| Şimdi | Tek iş | Sıradaki işi seçer, oturumu takip eder | — | Sürekli |

```ts
function loadByWeek(items: WorkItem[], rhythms, blocks, settings, range): WeekLoad[]   // talep ve kapasite
function commitWeek(input: WeekInput, advice?: WeekAdvice): WeekPlan                    // taahhüt + oturumlara bölme
```

Kurallar:

- **Talep.** Bir kalemin haftalara yayılan talebi: kalan efor, `earliest_at` ile `due_at` arasındaki haftalara kapasiteyle orantılı dağıtılır. Ritimler ve tabanlar her haftanın sabit talebidir.
- **Oturumlara bölme.** Bir kalem haftaya girerken o haftaya düşen eforu `session_minutes` uzunluğunda oturum işlerine bölünür (en fazla 90 dk). Sonraki haftaların eforu bölünmez; kalemde toplam olarak durur.
- **Bağımlılık.** `depends_on` içindeki kalem bitmeden bağlı kalem taahhüt edilmez.
- **Plan istikrarı.** Haftalık taahhüt hafta içinde kendiliğinden değişmez. Yeniden kurulmasını yalnızca şunlar tetikler: yeni zorunlu kalem, kaybedilen kapasite (yeni sabit blok, mod değişimi), kullanıcının isteği.
- **Efor istikrarı.** Kalemin eforu oluşurken bir kez tahmin edilir. Yeniden tahmin yalnızca kapsam değişince, kalemin çıktısı bir çalışma planı getirince (bkz. Okul modülü) ya da harcanan süre tahmini %50 aşınca yapılır.
- **Yedek.** Yapay zeka yoksa `commitWeek` kalemleri aciliyet ve öneme göre kapasite dolana kadar kendisi seçer.

## Gün nasıl kurulur

1. **Pencere.** `[max(dayStart, now), finishLine]`.
2. **Sabit bloklar.** Her blok, yol süreleriyle genişletilip pencereden çıkarılır. Kalan aralıklardan `slot.light_min` (15 dk) altındakiler atılır.
3. **Yuvalar.** Her boş aralık yuvalara bölünür:
   - 45 dk ve üzeri aralık derin yuva olur; en fazla 90 dk. Daha uzun aralık, aralarına 15 dakikalık mola yuvaları konarak birden çok derin yuvaya bölünür.
   - 15–44 dk aralık hafif yuva olur.
4. **Kapasite.** `usableMinutes = toplam yuva süresi × capacityFactor(dayType)`. Çarpan önce `settings.capacity_factors`'tan, yeterli veri birikince `planner_stats`'tan gelir. Günün planı bu süreyi aşamaz; aşan işler `overflow`'a gider.
5. **Adaylar.** Süzgeçlerden geçen işler ve borcu olan ritimler.
6. **Zorunlular.** Aşağıdakiler önce yerleşir, son tarihe göre sıralı:
   - son tarihi bugün olan işler,
   - aciliyeti 0,8 ve üzeri olan işler (bugün başlanmazsa yetişmez),
   - tabanı tehlikede ritimler: `kalan gün sayısı ≤ tabana ulaşmak için gereken sayı`.
7. **Doldurma.** Kalan yuvalar sırayla, o yuvaya uyan en yüksek skorlu adayla doldurulur.
8. **Günün 3 işi.** Yerleşen işler içinden, sırayla: bugün teslim zorunlu işler; yapay zekanın (ya da kullanıcının) seçtikleri; motorun seçtikleri (öteki zorunlular, sonra en yüksek skor). Ritimler üçlüye girmez, zaman çizelgesinde ve Sıradakiler'de kalır; bir ritim yalnızca tabanı tehlikedeyse (`floor`) girer. Takip işi (`follow_up`) girmez.

## Süzgeçler

Bir aday bir yuvaya ancak dördünü de geçerse girer:

| Süzgeç | Kural |
| --- | --- |
| Süre | `est_minutes × tahmin çarpanı ≤ yuva süresi` |
| Enerji | Derin yuva: her işi alır (deep, light, physical). Hafif yuva: light ve physical alır. Mola yuvası: yalnızca süresine sığan physical ve 15 dk'yı geçmeyen light alır |
| Bağlam | İşin bağlamı `any` ya da cihazın bağlamına eşit. `status = waiting` olan iş hiçbir zaman aday değildir |
| Zaman | `timing` taşıyan iş için: çalışma aralığı uygun aralığın içinde, ayak izi boş aralığın içinde (aşağıda "Zaman kısıtları") |

Bağlam eşleşmesi: ikinci ekran `desk` bağlamındadır ve `desk`, `home`, `any` işlerini görür. Telefonda kullanıcı bağlam seçer (`office`, `campus`, `out`, `commute`).

## Skor

```
skor = önem × (aciliyet + ritimBorcu + bekleme)
```

| Terim | Hesap |
| --- | --- |
| önem | `module.weight × modÇarpanı(module, lifeMode) × önemKatsayısı(importance)`; önem katsayısı 1→0,5, 2→1, 3→1,5, 4→2 |
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
   - Yapay zekanın önerisi (`top3`, `prefer`) pencereyi çiğneyemez; çiğneyen öneri yok sayılır ve "reddedilen öneri" uyarısı çıkar.
   - **Pencere planlayıcıyı bağlar, kullanıcıyı değil.** Kullanıcı bir işi her saatte elle başlatabilir; oturum kuralları değişmez.
   - **Bitiş çizgisi.** Planlayıcı bitiş çizgisinden sonraya yalnızca `after_finish` taşıyan işi koyar (akşam, aşağıda "Günün çerçevesi"); pencere bunu değiştirmez. Uygun aralığı haftanın her günü bitiş çizgisinden sonraya (ya da günün başlangıcından önceye) düşen ve `after_finish` taşımayan iş hiç planlanamaz; kayıt sırasında kullanıcıya söylenir ("Saatleri bitiş çizgisinden sonra"). `after_finish` taşıyan işin penceresi akşamın içindeyse uyarı çıkmaz (karar: `docs/09-kararlar.md`, 12 Kas 2026).
   - `pickForMinutes` ("X dk'm var") aynı kuralları şu an için uygular; ayak izi verilen dakikaya sığmalıdır.
10. **Uyarı önceliği.** "Uygun saat yok" (bugün ya da hafta) yetişmeyecek son tarihten hemen sonra gelir; en çok iki uyarı kuralı değişmez.
11. **Çıktı ve oturum.** Atama, çalışma aralığını ve yol sürelerini ayrı taşır (`travelBefore`, `travelAfter`); zaman çizelgesi yolu ayrı çizer. Oturum yalnızca çalışmayı ölçer; yol ölçülmez ve öğrenmeye girmez.

Bilinen sınırlar: yol süresi iş başına tek sayıdır, nereden gelindiğine göre değişmez ve ardışık işler arasında zincirlenmez. Anlık veri (trafik, doluluk) yoktur. Kapasite öğrenmesi yolda geçen süreyi çalışılmamış sayar; yol süreli işler çoğalırsa çarpan gözlenmeli.

## Günün çerçevesi (Ç3c)

Gün iki gerçek olaya bağlanır: uyanış ve yatış (gerekçe: `docs/12-sahne-ve-otomasyon.md`, bölüm D; veri: `docs/03-veri-modeli.md`, `days` ve `settings.day_frame`). **`settings.day_frame` boşsa bu bölümdeki kurallar devreye girmez ve planlayıcı Ç3b'deki gibi çalışır; tek istisna çapalı iştir (aşağıda "Çerçeve kapalıyken çapalı iş", Ç3g).** Çerçeve açık ama uyanış kaydı, çapa ve `after_finish` yokken de çalışma penceresinin içindeki plan, aynı pencereyle Ç3b'nin kurduğu planın aynısıdır; değişen yalnızca pencerenin başıdır.

```
uyku │ uyanışa bağlı işler │ çalışma penceresi │ akşam │ yatışa bağlı işler │ uyku
     ▲ uyanış                                 ▲ bitiş çizgisi              ▲ yatış
```

Terimler:

- **Uyanış.** Kayıtlı uyanış (`days.woke_at`); yoksa kullanıcının o güne verdiği değer (`days.expected_wake`); yoksa uyku planının beklenen uyanışı.
- **Beklenen yatış.** Kayıtlı yatış (`days.bed_at`); yoksa kullanıcının o geceye verdiği değer (`days.expected_bed`); yoksa uyku planının yatışı.
- **Aralıklar.** Uyanış aralığı o günün tipine, yatış aralığı o günün gecesine göre `day_frame`'den (`by_day_type` varsa o). Aralıklar planlayıcıyı bağlar, kullanıcıyı değil.
- **Çapalı iş.** `timing.anchor` taşıyan aday. Uyanışa bağlı işlerin ayak izi, o günün uyanışa bağlı adaylarının sürelerinin toplamıdır.
- **Günün başı.** `uyanış + uyanışa bağlı işlerin ayak izi`. Çalışma penceresi `[max(günün başı, şimdi), bitiş çizgisi]` olur (`PlanInput.dayStart`).
- **Akşam.** `[bitiş çizgisi, beklenen yatış − yatışa bağlı işlerin ayak izi]`.

Kurallar:

1. **Çapa.** Uyanışa bağlı işler uyanıştan başlayarak art arda, yatışa bağlı işler beklenen yatışta bitecek biçimde geriye doğru dizilir. Sıra `order` (küçük önce; olmayan sonda), eşitse skordur. Çapalı iş yuvalara dağıtılmaz, kapasiteye sayılmaz, günün 3 işine girmez ve günün "tamam"ını bekletmez. Sabit bloklar çapalı işi kaydırmaz (uyku planı en geç uyanışı ilk yükümlülüğe göre zaten öne alır).
2. **Akşam.** Bitiş çizgisinden sonraya yalnızca `after_finish = true` taşıyan iş konur. Böyle bir iş önce gündüz yuvalarında olağan kurallarla yarışır; gündüz yerleşemezse akşamın yuvalarına (bloklar çıkarılmış, aynı yuva kuralları) konur. `windows` ve öbür kısıtlar yine geçerlidir. Akşam süresi kapasite çarpanına girmez (`usableMinutes` değişmez, akşama konan iş kapasiteden düşmez). `after_finish` taşıyan işin "bugün kapalı" denetimi bitiş çizgisine değil akşamın sonuna göre yapılır.
2a. **Yatışa bağlı iş yatıştan kısa süre önce öne gelir (Ç3g).** Yatışa bağlı işin yuvası beklenen yatışta biter; "Şimdi"ye yuvasının başından en çok 15 dakika önce gelir (`BED_LEAD`). Ondan önce akşam ekranı onu önermez; `evening` durumu onu `later` olarak taşır (iş ve yuvasının başı) ve kart "Sırada: Akşam kapanışı · 22:20" der, "Şimdi başla" ile erken başlatılır. Akşamdaki `after_finish` işleri olağan sırayla önerilir.
3. **Gün kısalınca.** Geç uyanılan günde pencere kısalır; sığmayanlar olağan kurallarla "vakit kalırsa"ya ya da sonraki günlere gider. Uyarı metinleri bunu kusur gibi anlatmaz.
4. **Hafta.** Haftanın kapasitesi her günü kendi başından sayar: bugün günün başından, yarın beklenen uyanıştan (uyku planı, yatış kaydı ve kullanıcının değerleriyle), sonraki günler en geç uyanıştan (yüke göre erkene çekme sonraki günler için hesaplanmaz), her biri uyanışa bağlı işlerin ayak iziyle. Haftanın taahhüdü yalnızca mevcut tetikleyiciyle yeniden kurulur: kalan günlerin kapasitesi toplamda 30 dakikadan çok düşerse. Kazanılan süre günün doldurmasına açılır, taahhüt yeniden kurulmaz.

**Çerçeve kapalıyken çapalı iş (Ç3g).** Çerçeve kapalıyken de çapa işin saatini taşır; çapalı iş yuvalara dağıtılmaz. Uyanış yerine ayarlardaki günün başı (`day_start_default`; günün ilk dokunuşu değil), yatış yerine bitiş çizgisi kullanılır: uyanışa bağlı işler günün başından art arda dizilir ve çerçeve açıkkenki gibi bittikten 60 dakika sonra o gün düşer; yatışa bağlı işler bitiş çizgisinde bitecek biçimde dizilir ve yuvalarından 15 dakika önce öne gelir. Çalışma penceresi uyanış dizisi önerildiği sürece onun bitişinde başlar, yatış dizisinin başında biter. Çerçeve kapalıyken dizi (`chainOf`) yoktur: sahne `chain` almaz, kendiliğinden devam ve kartın dizi satırı çalışmaz. `Plan.candidates` çerçevesiz günde çapalı işi de taşır (Ç3g öncesindeki gibi; Ç3 kabulündeki taban testi onu okur). Gerekçe: 14 Kas 2026'da çerçeve kapalıyken öğleden sonra etkinleştirilen Rutin'in sabahı ve akşamı sıradan ritim gibi öne geldi (`docs/ILERLEME.md`, Ç3g).

**Uyku planı (`sleepPlan`).** Her gece için bir yatış, ertesi sabah için bir uyanış seçer; amaç aralıkların içinde kalarak uyku hedefini tutturmaktır. Saf fonksiyondur; yapay zekaya sorulmaz. Uyku borcu tutulmaz: her gece kendi hedefiyle planlanır. Uygulama uyandırmaz; planlanan uyanış bilgidir.

1. **En geç uyanış.** `ilk sabit blok − bloğun yol süresi − uyanışa bağlı işlerin ayak izi`; yükümlülük yoksa uyanış aralığının sonu. Aralığın sonunu geçemez; sabit yükümlülük onu aralığın başından da erkene çekebilir.
2. **Yüke göre erkene çekme.** Günün yükü (o gün zorunlu olacak işlerin süresi ve haftanın taahhüt edilmiş payından kalanın haftanın kalan günlerine eşit bölümü) en geç uyanışla kurulan günün kapasitesine sığmıyorsa uyanış 15'er dakika erkene çekilir: sığana ya da sınıra gelene kadar. Yük sığıyorsa uyanış en geç uyanışta kalır.
3. **Uyku feda edilmez.** Erkene çekmenin sınırı `max(uyanış aralığının başı, yatış aralığının başı + uyku hedefi)`dir: yük uyanışı ancak yatış da aynı kadar erkene alınabiliyorsa erkene çeker.
4. **Planlanan yatış** `planlanan uyanış − uyku hedefi`, yatış aralığına sıkıştırılır. Uykuyu hedefin altına yalnızca sabit bir yükümlülük düşürebilir (en geç uyanış − yatış aralığının başı < hedef); o zaman plan bunu söyler (`short`, "Bu gece en çok 7 sa uyku").
5. **Gerçek yatış planı değiştirir.** Yatış kaydedilince (ya da kullanıcı o geceye bir yatış verince) beklenen uyanış `yatış + uyku hedefi` olur; uyanış aralığının başından erken, en geç uyanıştan geç olamaz. En geç uyanışa sığmayan uyku kısa kalır ve plan söyler.
6. **Kullanıcının uyanışı.** O güne verilen uyanış (`expected_wake`) yükten ve yatıştan önce gelir; yatış ondan `uyku hedefi` geriye sayılır (yatış aralığına sıkıştırılır).
7. **Gerçek uyanış her şeyin önündedir.** Uyanış kaydedilince gün ona göre kurulur.

## Günün çerçevesinin uygulama notları (Ç3c)

- Girdi: `PlanInput.frame` (uyanış, kayıtlı mı, tahmini mi, beklenen yatış, kayıtlı yatış, yatış aralığının sonu, sabah durumunun bittiği an, bu gecenin uyku planı). Satırlardan `planInput` kurar; çerçeve kapalıyken alan yoktur. Çıktı: `Plan.frame` (uyanış, günün başı, bitiş çizgisi, akşamın sonu, beklenen yatış) ve çapalı ya da akşamdaki yuvanın `part` alanı (`wake`, `evening`, `bed`).
- Gece, çerçeve açıkken `05:00`'te ya da uyanış aralığının başında (hangisi erkense) biter (`planningDay`).
- `morning` durumu uyanış aralığının sonundan bir saat sonra biter (**görüşün gerek**): o saate kadar "Uyandım" denmemiş ve hiçbir yere dokunulmamışsa gün beklenen uyanışla kurulur ve ekran olağan durumuna geçer (kural 3: sistem ritüele bağımlı değildir).
- "Uyandım" denmeden günün ilk dokunuşu sabah durumu sürerken yapılırsa uyanış o an yazılır ve tahmini işaretlenir (`woke_estimated`); sabahtan sonraki ilk dokunuş uyanış sayılmaz (gün beklenen uyanışla sürer). İlk dokunuş (`started_at`) her durumda yazılır.
- Akşam kapanışı yapıldıysa (`closed`) çerçeve açıkken ekran gece değil akşam durumundadır (yalnızca "Yatıyorum" kalır); gece yatışla ya da yatış aralığının sonuyla gelir.
- Uyku planının günün yükü için o günün adayları, günün başı en geç uyanışla kurulmuş bir girdiyle hesaplanır (döngüsüzlük için).
- Uyanışa bağlı işlerin dizisi, bittiği andan 60 dakika sonrasına kadar önerilir ("Biraz önce: 30 dk" denince rutin kaybolmasın); sonra o gün düşer. Yatışa bağlı iş zamanı geçince düşer. **Görüşün gerek.**
- **Diziler (Ç3f).** Ekrandaki dizi (`SceneChain`, `docs/06-modul-sozlesmesi.md` "Diziler") planlayıcının parçası değildir: `src/core/today/chain.ts` içindeki saf `chainOf` planın `part: 'wake'` ve `part: 'bed'` yuvalarından (sırada ya da çalışıyor), bugün yapılmış çapalı işlerden (`done`: bugün biten iş ve oturum işi, bugün kaydı düşen ritim), bugün ertelenen çapalı işlerden ve çapalı olup yuvası kalmamış adaylardan (`passed`) kurar. Sıra yuvaların sırasıdır; yapılmış ve geçilmiş işler `order`'larına göre araya girer. Kendiliğinden devam da (`day_frame.chain_auto`) planlayıcıyı değiştirmez: sıradaki işi bitirme anındaki plandan alır ve olağan oturum yolundan başlatır. Aynı girdi aynı planı verir (testle).
- Haftanın kapasitesinde yarın, yüke göre erkene çekilmiş uyanıştan değil en geç uyanıştan (yatış kaydı ya da kullanıcının değeri varsa ondan) sayılır: bugün iş bitirmek yarının yükünü hafifletip uyanışı geri kaydırır; bu, kapasite kaybı sayılıp taahhüdü yeniden kurdurmamalı.
- Basitleştirmeler: "bugün kapalı" denetimi `after_finish` işte akşamın sonu yerine beklenen yatışa bakar (yatışa bağlı işler düşülmez); "Saatleri bitiş çizgisinden sonra" uyarısı çerçeve açıkken bütün `after_finish` işlerde susar; gecenin bittiği saat ve 8 günden ötesinin başı genel uyanış aralığından (gün tipine özel aralık değil); yarının girdisi bugünün hayat modunu ve haftanın payını taşır (Pazar gecesi, Pazartesinin uyku planı biten haftanın payından hesaplanır); hafta ayarı `desk` bağlamıyla kurulur.
- "Bu hafta uygun saat yok": çerçeve açıkken her gün kendi başından sayılır, `after_finish` işin akşamı da (yatış aralığının sonuna kadar) bakılır.

## "Şimdi" durumu

`plan.now` şu durumlardan biridir; Bugün ekranı buna göre çizilir:

| Durum | Koşul | Ekran |
| --- | --- | --- |
| `block` | Şu an bir sabit bloğun içinde | Bloğun adı ve bitiş saati; öneri yok |
| `running` | Açık bir oturum var | O iş, geçen süre |
| `suggest` | Boş yuva ve atanmış iş var | Yuvanın işi; Başla düğmesi |
| `prompt` | Bekleyen bir olay sorusu var ve oturum açık değil | Tek soru |
| `done` | Günün 3 işi ve zorunlular bitti | "Bugün tamam" |
| `empty` | Hiç aday yok ve bugün bir şey bitmedi | "Bugün için planlanan bir şey yok" ve hızlı giriş |
| `night` | Çerçeve kapalıyken: bitiş çizgisi geçti ya da gün kapatıldı. Çerçeve açıkken (Ç3c): yatış kaydedildi ya da bu gecenin yatış aralığının sonu geçti | Gece ekranı: yarının ilk işi (çerçeve açıkken yarının uyanışı) |
| `morning` (Ç3c) | Çerçeve açık, gün başladı, uyanış kaydı yok, sabah durumunun sonu gelmedi | "Günaydın", "Uyandım", bugünün kısa özeti |
| `evening` (Ç3c) | Çerçeve açık, bitiş çizgisi geçti ya da gün kapatıldı, gece değil | Akşam: sıradaki akşam ya da yatışa bağlı iş, "Günü kapat", "Yatıyorum", bu gecenin yatışı, yarının uyanışı, uyku süresi |
| `return` | Son etkileşimden beri `return_after_days` gün geçti (etkileşim: oturum, ritim kaydı, giriş, biten iş, günün ilk dokunuşu ve kapanışı; Ç3d'den beri kaydedilen uyanış ve yatış da, dışarıdan yazılsa bile) | Geri dönüş ekranı |

Sıra: çalışan, blok, gece, akşam, sabah, geri dönüş, soru, tamam, öneri. Uyanışa bağlı ilk iş "Uyandım"dan sonra kendiliğinden önerilir (yuvası uyanış anındadır); `day_frame.start_on_wake` açıksa "Uyandım" onu başlatır.

## Koruma kuralları

Her biri ayrı test edilir.

- **Taban.** Ömürlük modüllerin `weekly_floor_minutes` ve ritimlerin `floor_count` değerleri Yoğun modda da korunur. Taban tehlikedeyse ilgili iş zorunlu sayılır.
- **Borç sınırı.** Ritim borcu dönem bitince sıfırlanır; planlayıcı geçmiş dönemleri hiç görmez.
- **Büyük iş.** 90 dk üstü iş olamaz (şema kısıtı). Bu hafta taahhüt edilmiş bir kalemin açık oturum işi yoksa `warnings`'e "sıradaki adım tanımsız" eklenir.
- **Bekleyen iş.** Aday olmaz. `follow_up_on` günü gelince 5 dakikalık hafif bir "takip et" adayı üretilir.
- **Bitiş çizgisi.** `finishLine`'dan sonra derin yuva açılmaz. Günün işleri bitince `now = done` olur ve `overflow` yalnızca kullanıcı isterse gösterilir.
- **Otomatik plan.** `days.plan` yoksa (akşam kapanışı yapılmadıysa) plan günün ilk dokunuşunda aynı fonksiyonla kurulur; `plan_source = auto`.
- **Geri dönüş.** `return` durumunda: son tarihi geçmiş işler bugüne yığılmaz, `planned_date` değerleri temizlenir ve normal kurallarla yeniden dağıtılır. Kullanıcıya yalnızca bugünün 3 işi gösterilir.
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
3. Yarının taslağı: `buildPlan(yarın)` çıktısı. Kullanıcı günün 3 işini değiştirebilir, iş çıkarabilir.
4. Boşaltma kutusu: akla gelenler gelen kutusuna.
5. Onay: `days` kaydı yazılır (`plan_source = closing`), ekran gece moduna geçer.

## Uygulama notları (Ç3)

Kod `src/core/planner/` içindedir; dokümanın açık bıraktığı yerler şöyle yorumlandı:

- **Girdi.** `PlanInput` yukarıdakine ek olarak taşır: `closed` (gün akşam kapatıldı), `spentThisWeek` (modül başına bu haftaki dakikalar; haftalık taban için), `committed` (haftanın taahhüt ettiği kalemler; yoksa `null`), `top3` (günün kaydındaki üç iş), `skipped` (bugün ertelenen kalem ve ritimler), `openSession`, `prompt`, `lastSeenAt` (bugünden önceki son kullanım: oturum, ritim kaydı, giriş, biten iş), `startedToday`. Girdi satırlardan `planInput` ile kurulur; ekran da sunucu da aynı fonksiyonu kullanır.
- **Yuvalar.** 90 dakikadan uzun aralık açgözlü bölünür: 90 dk derin, 15 dk mola, kalan için yeniden; artan parça uzunluğuna göre derin, hafif ya da atılır. İş yuvanın başına konur, yuvanın kalanı kendi başına bir yuva olur (derin, hafif ya da atılır; molanın kalanı atılır).
- **Kapasite.** Zorunlu işler kapasite çarpanını aşabilir, yuvaların fiziksel süresini aşamaz; enerjisi uymayan zorunlu iş süresi yeten ilk mola dışı yuvaya konur. Öğrenilen kapasite çarpanı 0,2–1 arasında tutulur (kaydı tutulmayan günler planı boşaltmasın).
- **Fiziksel iş.** Koşu, spor gibi masa başı olmayan iş süresi yeten her yuvaya girer; mola yuvası yalnızca kısa olanı alır. Doküman fiziksel işi yalnızca molaya koyuyordu; 15 dakikadan uzun fiziksel iş hiç planlanamıyordu. **Görüşün gerek.**
- **Acil kalem.** Aciliyet kalemin kalan toplam eforundan hesaplanır; aday olan (ve zorunlu sayılan) yalnızca sıradaki oturum işidir. Son tarihi bugün olan kalemin bütün oturumları adaydır ve zorunludur.
- **Haftanın payı.** Girdi her taahhüt edilmiş kalemin haftalık payını ve taahhüt anındaki biten eforunu taşır (`shares`). Pay işlenince kalem önerilmez ve "sıradaki adım tanımsız" uyarısı çıkmaz; eforun kalanı sonraki haftalarındır.
- **Yapay zekanın modül payları** (`week`): yapay zekanın önerdiği dakikalar geçerlidir, ama hiçbir modül ritimlerinin ve tabanının istediğinden aza düşmez.
- **Tahmin çarpanı.** Süre `est_minutes × çarpan`; 90 dakikayı aşan iş hiçbir yuvaya girmez ve "vakit kalırsa"da bekler. Bugün teslim olan böyle bir iş en uzun derin yuvaya konur (bugün başlanır, sonraki yuvada sürer).
- **Bekleme terimi** son tarihsiz işlere ve kalemlere uygulanır; ritimlerin yerine borçları vardır.
- **Öneri ve taban.** `defer` bütün zorunlu işaretlerden (haftalık taban dahil) sonra uygulanır; zorunlu iş ertelenemez, uyarı çıkar.
- **"X dk'm var"** 15 dakikanın altında mola yuvası gibi davranır: fiziksel ya da kısa hafif iş.
- **Geçmiş son tarih.** Son tarihi geçmiş iş zorunlu olmaz ve aciliyeti 0,5 sayılır: bugüne yığılmaz (kural 2), havuzda sıradan iş gibi planlanır.
- **Taban.** Ömürlük modülün haftalık tabanı `weekly_floor_minutes × floorMultiplier(mod)`; Yoğun modda çarpan en az 0,5'tir ("küçülür ama sıfırlanmaz"). Taban, haftanın kalan günleri tabana ulaşmak için gereken 45 dakikalık oturum sayısından fazla değilse tehlikededir; o zaman modülün en iyi adayı zorunlu olur. Ritmin Yoğun moddaki hedefi `mode_targets.busy`, ama `floor_count`'un altına inmez. Ağırlık çarpanı 0 olan modül (ör. Tatil) yalnızca bugün teslim olan işini önerir.
- **Gece.** Bitiş çizgisinden sonra, gün kapatılınca ve saat 05:00'ten (günün başlangıcı daha erkense ondan) önce `now = night`. Gece yarısından sonra, gece bitmeden yapılan kapanış (`tomorrowInput`) başlayan günü planlar (`planningDay`). Açık oturum, bloğun içinde olmak ve gece sırayla önce gelir; sonra geri dönüş, soru, tamam, öneri.
- **Tamam.** Günün üç işi (günün kaydındaki) bitmiş ve zorunlu iş kalmamışsa; hiç iş planlanmamış ama bugün bir şey bitmişse de. Üç işin bir üyesi kalemse, kalemin bugün biten bir oturum işi onu bitmiş sayar.
- **Haftanın kalemleri.** Hafta planı varken Bugün yalnızca taahhüt edilmiş kalemleri (ve eforu dolup "Bitti mi?" bekleyenleri) önerir; kalemlerin oturum işleri her zaman aday olur. Tarihsiz kalem haftalık yüke girmez (kendi haftası yoktur); taahhütte kapasite kalırsa bir oturumluk payla girer. Bu hafta teslim olan kalem kapasiteyi aşsa da taahhüt edilir.
- **Pay.** Kalemin haftaya düşen payı `spreadItem`: kalan efor, başlangıçla (ya da şimdi) son tarih arasındaki haftalara kapasiteyle orantılı; aralığın ötesine düşen haftaların payı aralığa yüklenmez. Pay `session_minutes` uzunluğunda (yoksa 45, en çok 90) oturumlara bölünür, sonuncusu kısa olabilir (en az 15).
- **Yeniden taahhüt.** `recommitReason`: taahhüdün dışında bu hafta teslim olan yeni kalem, kalan günlerin kapasitesinin toplamda 30 dakikadan çok düşmesi ya da hayat modunun değişmesi. Kapasite gün gün, taahhüt anında saklanan tam gün kapasitesiyle (`week_plans.day_capacity`) karşılaştırılır; geçen saatler kayıp sayılmaz. Kullanıcının isteği çağıranın işidir.
- **Haftanın kurulması.** Uygulama açıkken hafta kendiliğinden kurulur (`PlanKeeper`, `keepWeek`): haftanın ilk açılışında taahhüt, tetikleyiciyle yeniden taahhüt, yeni kalem gelince ekleme. Haftanın ilk taahhüdünde önce öğrenme çalışır, taahhüt öğrenilen değerlerle kurulur; öğrenme hafta içinde değişmez. Yapay zeka açıkken taahhüdü sunucu yapay zekanın önerisiyle kurar (`week`); gelecek haftanın Cumartesiden kurulması yoktur, hafta kendi ilk açılışında kurulur (`docs/10-yapay-zeka.md`, "Akışlar (Ç3)").
- **Oturum işleri.** Planlayıcı da Bugün listesi de bir kalemin yalnızca sıradaki oturum işini aday sayar: çalışan; yoksa bugüne planlanmış adım ("Adımı küçült"); yoksa sırası (`position`) en küçük olan; sırasız olan (elle başlatılmış) en sonda. O bitince plan yeniden kurulur, sıradaki gelir. Son tarihi bugün olan kalemin bütün oturum işleri aday ve zorunludur. Aynı kalemin açık iki oturum işi aynı sırayı paylaşamaz (tekil indeks): iki ekran haftayı aynı anda kurarsa ikinci yazma düşer. Eforu dolan kalemin başlanmamış oturum işleri bekler, kalemin kendisi "Bitti mi?" diye sorar: kendi yuvası gelince ve gün "tamam"a geçmeden önce. **Görüşün gerek** (listede tek oturum).
- **Ertele ve bekleme kalemde.** Bir oturum işi ertelenince kalemin öbür oturumları da o gün listeden çıkar; "Birini bekliyorum" denince kalemin kendisi `waiting` olur, takipte "Cevap geldi" kalemi yeniden açar.
- **Günün kaydı.** Otomatik plan (`plan_source = auto`) günün ilk açılışında yazılır; günün ilk dokunuşu (`started_at`) yalnızca kullanıcı bir ekrana dokununca ya da bir tuşa basınca yazılır (ikinci ekran gece de açık durur). Kayıt günün tipini ve modunu (`day_type`, `life_mode`) ve bütün günün yuva süresini (ilk kayıttaki değer) tutar; kapasite öğrenmesi bunları okur. Planlayıcının girdisinde gün tipi her zaman bloklardan türetilir.
- **Eksik oturum işleri.** Taahhüt edilmiş, haftalık payından kalanı olan ama açık oturum işi olmayan kalemin (hafta kaydı ile oturum işleri iki ayrı yazmadır, ikincisi yarıda kalabilir; ya da hepsi bırakılmıştır) payının kalanı yeniden oturumlara bölünür (`missingSittings`, `weekAction` → `repair`).
- **Yeni kalem.** Taahhütten sonra açılan kalem, haftada yer varsa taahhüde eklenir (`weekAction`, `appendable`); taahhüt edilmiş kalemlerin payı değişmez. Kullanıcının elle eklediği kalem (modül anahtarı yok) yer olmasa da eklenir: eklemek kullanıcının isteğidir.

## Uygulama notları (Ç3b)

Kod `src/core/planner/timing.ts` (yardımcılar), `candidates.ts` ve `plan.ts` içindedir. Dokümanın açık bıraktığı yerler:

- **Yalnızca `timing` taşıyan aday yeni yoldan geçer.** `timing` boşsa (ya da veritabanındaki değer şemadan geçmiyorsa) aday eskisi gibi yerleşir; Ç3'ün testleri değişmeden geçer.
- **Bugün kapalı iş.** Penceresi bugünü kapsamayan ya da bugünün kalan penceresinde (günün başı ya da şimdiden bitiş çizgisine kadar) kendi süresi kadar kesintisiz aralık bırakmayan iş aday değildir; "vakit kalırsa"da da görünmez. Zorunluysa "Bugün uygun saat kalmadı" uyarısını üretir.
- **Ayak izinin taşması.** Ayak izi yalnızca başladığı yuvanın ardından kesintisiz gelen boş yuva ve molalara taşar. Yuvalar kesilirken atılan kısa artıklar (15 dakikadan kısa) yuva olmadığı için kullanılamaz.
- **Atama.** Atamanın yuvası çalışma aralığıdır; yol süreleri atamada (`travelBefore`, `travelAfter`) taşınır ve hiçbir yuvada yer almaz. Yol, cihaz işin bağlamındayken 0'dır ve atamada hiç yazılmaz.
- **Zorunlu iş.** Enerjisi uymayan zorunlu iş, zaman kuralları içinde kalmak şartıyla enerji süzgeci olmadan yerleşir. Penceresi olan zorunlu iş hiçbir yuvaya sığmazsa yerleşmez ve "Bugün uygun saat kalmadı" der; "en uzun derin yuvaya kırparak koyma" ona uygulanmaz (pencere kesindir). Yol da kesindir: yolu olan zorunlu iş ayak izi sığmazsa yerleşmez ve aynı uyarıyı verir. Yalnızca tercih ya da kaçınma taşıyan zorunlu iş kendi kurallarıyla yerleşemezse Ç3'teki yedeklere (enerji, kırpma) düşer; orada tercih dikkate alınmaz.
- **Bugün kapalı işin son tarihi.** Pencereleri bugün kapalı iş de "yetişmeyecek son tarih" uyarısına girer (kullanılabilir süre pencereden sayılır), sonra "Bugün uygun saat kalmadı". Son tarihi bugünse yalnızca ikincisi çıkar.
- **Kart.** Kart planın zaman sırasındaki ilk işini önerir (Ç3'teki gibi). O iş pencereye ya da yola bağlıysa ve ayak izi henüz başlamadıysa kart onu `at` (ayak izinin başladığı an, yola çıkış) ile önerir; ekran saati söyler, kullanıcı yine elle başlatabilir. Önündeki boş zamanda serbest bir iş olsaydı doldurma onu oraya koyardı. **Görüşün gerek.**
- **Doldurma.** Zaman kısıtlı işin skoru yuvadaki zaman çarpanıyla çarpılır; sıralama `compareScored` ile yapılır (zorunlu önde). Bekletme yalnızca `prefer` ya da `avoid` taşıyan işe uygulanır.
- **Ulaşılabilir sayı.** Dinlenme günü, dönemin içindeki değil son gerçek yapılıştan sayılır (önceki dönemin son yapılışı da): kural 5 ile aynı. Gün düzeyinde sayılır: bugün, penceresi geçmiş olsa da haftanın günü uyuyorsa sayılır (taban uyarısı bir gün geç çıkabilir; bilinen basitleştirme).
- **Reddedilen öneri.** Yapay zekanın `top3` ya da `prefer` önerisindeki iş bugün kapalıysa ya da penceresi içinde hiçbir boş yuvaya sığmıyorsa öneri uygulanmaz ve uyarı çıkar: "…: bu saatlerde yapılamaz, öneri plana alınmadı."
- **"X dk'm var".** Pencere ya da yol taşıyan iş yalnızca hemen (yolu varsa yoldan hemen sonra) başlayabiliyorsa önerilir; penceresi birazdan açılacak iş önerilmez. Verilen dakikalar mola uzunluğundaysa (15 dakikanın altı) önerilmez; yalnızca tercih ya da kaçınma taşıyan iş Ç3'teki gibi değerlendirilir.
- **Yol ve bağlam.** Yol yalnızca cihazın bağlamı işin bağlamına tam eşitse 0 sayılır (kural 3'ün lafzı). İkinci ekran (`desk`) `home` işini görür ama orada yol sayılmaya devam eder: yolu olan bir ev işi beklenmiyor. **Görüşün gerek.**
- **"Bu hafta uygun saat yok" (`weekNoTime`).** Haftanın kalan günlerinde (bugün şimdiden) boş aralıkla pencerenin kesişiminde bir ayak izi aranır: çalışma pencerenin içinde, yol boş aralığın içinde. Bilerek basit tutulanlar: yuva yerine boş aralık, tahmin çarpanı yok (kalemin sıradaki oturum uzunluğu, ritmin süresi), cihaz bağlamına göre yolun sıfırlanması yok, oturum işlerinin kendi `timing` değeri ve ritmin `rest_days` değeri okunmaz. Bakılanlar: taahhüt edilmiş (payı işlenmemiş) ya da bu hafta teslim kalemler; haftalık tabanı henüz karşılanmamış ritimler (aylık ve günlük ritimler haftaya göre yargılanmaz). Bir oturum işinin "Bugün uygun saat kalmadı" uyarısı varsa kalemi için ikinci uyarı çıkmaz.
- **Bitiş çizgisinden sonra.** Pencereleri hiçbir gün günün başlangıcıyla bitiş çizgisi (ayarlardaki saatler) arasına düşmeyen iş, kural 9'daki "kayıt sırasında söylenir"e ek olarak günün uyarısı olarak da söylenir: "Saatleri bitiş çizgisinden sonra: …" (öncelik "uygun saat yok"la aynı). Formdaki uyarı yalnızca formdan girilene görünür; serbest girişte yapay zekanın ya da bir modülün yazdığı böyle bir kısıt da bu uyarıyla görünür. **Görüşün gerek.**
- **Reddedilen öneri ve enerji.** Pencere içindeki tek yuva işin enerjisine uymuyorsa öneri de reddedilir (zorunlu iş hariç: o enerjiden bağımsız yerleşir).

## Test kapsamı (en az)

- Blok ve yol süresi çıkarıldıktan sonra yuvaların doğru üretimi
- Uzun aralığın derin + mola yuvalarına bölünmesi
- Üç süzgecin her biri
- Zorunluların skordan bağımsız öne geçmesi
- Tabanın Yoğun modda korunması
- Bitiş çizgisi ve `done` durumu
- Otomatik planın kapanış planıyla aynı sonucu vermesi
- Geri dönüş durumunun gecikmiş işleri yığmaması
- Bekleyen işin aday olmaması, takip gününde hatırlatma üretmesi
- Ölçülmemiş oturumun öğrenmeye girmemesi
- `advice` içindeki önerinin koruma kurallarını aşamaması; `advice` yokken planın geçerli kalması
- Günün 3 işinin sırası (bugün teslim, sonra öneri, sonra motorun seçtikleri) ve ritmin yalnızca tabanı tehlikedeyken üçlüye girmesi
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

- Çerçeve kapalıyken planın Ç3b'dekiyle aynı olması; çerçeve açık ama uyanış kaydı, çapa ve `after_finish` yokken pencerenin içindeki planın aynı pencereyle Ç3b'nin planı olması
- Günün başı: kayıtlı uyanış, yoksa `expected_wake`, yoksa uyku planı; uyanışa bağlı işlerin ayak izinin eklenmesi; geç uyanışta pencerenin kısalması
- Uyku planı: ilk yükümlülüğe göre en geç uyanış (yol ve ayak izi dahil); yükümlülük yokken aralığın sonu; yük sığmayınca 15'er dakika erkene çekme; yük hafifken çekmeme; uykunun yüke feda edilmemesi (yatış aralığının başı sınırı); sabit yükümlülüğün uykuyu kısaltması ve `short`; gerçek yatışın ertesi günün beklenen uyanışını değiştirmesi (geç yatış geriye, erken yatış öne, sınırlar); kullanıcının uyanış ve yatış değerleri
- Çapalı işler: uyanıştan art arda, yatışta bitecek biçimde geriye, `order` ve skor sırası, yuvalara dağıtılmama, günün 3 işine girmeme
- Ç3g: çerçeve kapalıyken uyanışa bağlı işin günün başında dizilmesi ve saati geçince düşmesi (öğleden sonra önerilmemesi); yatışa bağlı işin bitiş çizgisinden önce dizilmesi ve yalnızca yuvasından 15 dakika önce önerilmesi; çerçeve açıkken akşamda yatışa bağlı işin `later` olarak beklemesi, vakti gelince `next` olması; akşamın `after_finish` işinin önce gelmesi
- Akşam: `after_finish` taşımayan işin bitiş çizgisinden sonraya konmaması; taşıyanın gündüz yer yoksa akşama konması, penceresine uyması, kapasiteye sayılmaması
- `now`: `morning`, `evening`, `night` koşulları ve sıraları; kapatılmış günün akşamda kalması
- Hafta: yarının beklenen uyanışı değişince günlük kapasitenin değişmesi ve 30 dakikadan çok düşüşün yeniden taahhüdü tetiklemesi
