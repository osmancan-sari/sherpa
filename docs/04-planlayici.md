# Planlayıcı

Planlayıcı günü yuvalara böler ve her yuvaya en uygun işi koyar. Saf TypeScript'tir (`src/core/planner/`): girdisi veri, çıktısı plan. Veritabanına, saate ve ağa dokunmaz; şimdiki zaman parametredir. Bu sayede her kural test edilir ve ekran yapay zekaya ya da sunucuya sormadan güncel kalır.

## Arayüz

```ts
type PlanInput = {
  now: Date
  date: string                 // 'YYYY-MM-DD'
  dayType: 'home' | 'office' | 'campus'
  lifeMode: 'normal' | 'busy' | 'minimum' | 'holiday'
  dayStart: Date               // günün ilk dokunuşu ya da varsayılan
  finishLine: Date
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
- `advice` verilmişse: `top3` zorunlulardan sonra günün 3 işi olarak alınır, `prefer` içindeki işlerin skoru 1,5 ile çarpılır, `defer` içindekiler bugünün adaylarından çıkarılır.
- Öneri hiçbir koruma kuralını aşamaz. Zorunlu bir iş `defer` edilmişse öneri yok sayılır ve uyarı üretilir; kapasiteyi aşan `top3` kırpılır.
- `advice` yoksa planlayıcı kendi taban planını üretir; plan yine geçerlidir.

## Plan ufukları

Plan dalga dalga ayrıntılanır: uzak ufuk kaba, yakın ufuk ince. Her ufukta hesap kodda, yargı yapay zekadadır.

| Ufuk | Birim | Kod ne yapar | Yapay zeka ne yapar | Ne zaman |
| --- | --- | --- | --- | --- |
| Dönem, ay | İş kalemi (toplam efor) | Hafta hafta talep ve kapasiteyi hesaplar (`loadByWeek`) | Sıkışan haftaları yorumlar; öne çekme, bırakma, mod önerir | Ayda bir ve büyük bir kalem eklenince |
| Hafta | İş kalemi → oturum işleri | Kapasiteyi, tabanları ve bağımlılıkları denetler; taahhüt edilen kalemleri oturumlara böler | Haftanın kalemlerini ve modül başına saat payını seçer | Cumartesi; hafta içinde büyük değişiklikte |
| Gün | Oturum işi → yuva | Yuvaları kurar, süzgeçleri ve koruma kurallarını uygular | Günün 3 işini, sırayı ve ertelenecekleri seçer | Her gece |
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
8. **Günün 3 işi.** Yerleşen işler içinden en yüksek skorlu üçü; zorunlular önce gelir.

## Süzgeçler

Bir aday bir yuvaya ancak üçünü de geçerse girer:

| Süzgeç | Kural |
| --- | --- |
| Süre | `est_minutes × tahmin çarpanı ≤ yuva süresi` |
| Enerji | Derin yuva: deep ve light alır. Hafif yuva: light alır. Mola yuvası: physical ve 15 dk'yı geçmeyen light alır |
| Bağlam | İşin bağlamı `any` ya da cihazın bağlamına eşit. `status = waiting` olan iş hiçbir zaman aday değildir |

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

## "Şimdi" durumu

`plan.now` şu durumlardan biridir; Bugün ekranı buna göre çizilir:

| Durum | Koşul | Ekran |
| --- | --- | --- |
| `block` | Şu an bir sabit bloğun içinde | Bloğun adı ve bitiş saati; öneri yok |
| `running` | Açık bir oturum var | O iş, geçen süre |
| `suggest` | Boş yuva ve atanmış iş var | Yuvanın işi; Başla düğmesi |
| `prompt` | Bekleyen bir olay sorusu var ve oturum açık değil | Tek soru |
| `done` | Günün 3 işi ve zorunlular bitti | "Bugün tamam" |
| `night` | Bitiş çizgisi geçti ya da gün kapatıldı | Gece ekranı: yarının ilk işi |
| `return` | Son etkileşimden beri `return_after_days` gün geçti | Geri dönüş ekranı |

## Koruma kuralları

Her biri ayrı test edilir.

- **Taban.** Ömürlük modüllerin `weekly_floor_minutes` ve ritimlerin `floor_count` değerleri Yoğun modda da korunur. Taban tehlikedeyse ilgili iş zorunlu sayılır.
- **Borç sınırı.** Ritim borcu dönem bitince sıfırlanır; planlayıcı geçmiş dönemleri hiç görmez.
- **Büyük iş.** 90 dk üstü iş olamaz (şema kısıtı). Bu hafta taahhüt edilmiş bir kalemin açık oturum işi yoksa `warnings`'e "sıradaki adım tanımsız" eklenir.
- **Bekleyen iş.** Aday olmaz. `follow_up_on` günü gelince 5 dakikalık hafif bir "takip et" adayı üretilir.
- **Bitiş çizgisi.** `finishLine`'dan sonra derin yuva açılmaz. Günün işleri bitince `now = done` olur ve `overflow` yalnızca kullanıcı isterse gösterilir.
- **Otomatik plan.** `days.plan` yoksa (akşam kapanışı yapılmadıysa) plan günün ilk dokunuşunda aynı fonksiyonla kurulur; `plan_source = auto`.
- **Geri dönüş.** `return` durumunda: son tarihi geçmiş işler bugüne yığılmaz, `planned_date` değerleri temizlenir ve normal kurallarla yeniden dağıtılır. Kullanıcıya yalnızca bugünün 3 işi gösterilir.
- **Tek uyarı.** Aynı anda en fazla 2 uyarı üretilir; öncelik: yetişmeyecek son tarih, taban tehlikesi, tanımsız sıradaki adım.

## Yeniden planlama

Plan şu olaylarda yeniden kurulur (istemcide, anında): iş eklendi, değişti, bitti ya da ertelendi; blok değişti; oturum başladı ya da bitti; kullanıcı "Yeniden planla" dedi; dakikalık saat tiki yeni bir yuvaya geçti.

"Ertele" işi bugünün planından çıkarır (`planned_date = yarın`); aynı iş 3 kez ertelenirse uyarı üretir: böl, bırak ya da tarihe bağla.

## Oturum kuralları

- Başla: açık oturum varsa önce o kapatılır.
- Oturum `est_minutes × 2` süreyi geçerse ekran sorar: "Devam ediyor musun?" Cevap gelmezse oturum, tahmini sürede bitmiş sayılarak kapatılır ve `measured = false` olur.
- Bitti: oturum kapanır, iş `done` olur, ritimse `rhythm_logs`'a kayıt düşer, ilgili olay yayınlanır.

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
- `loadByWeek`: kalemin eforunun haftalara dağılımı; kapasiteyi aşan haftanın işaretlenmesi
- `commitWeek`: yalnızca o haftanın eforunun oturumlara bölünmesi; bağımlılığı bitmemiş kalemin taahhüt edilmemesi
- Hafta içinde tetikleyici yokken taahhüdün değişmemesi
