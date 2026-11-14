# Modül sahnesi, günün çerçevesi ve otomasyon zemini

**Durum: A–D numaralı dokümanlara işlendi ve Ç3c'de kuruldu (`c3c-tamam`); E numaralı dokümanlara işlendi (`docs/02`, `03`, `06`, `11`) ve Ç3d'de kuruldu (`c3d-tamam`); F numaralı dokümanlara işlendi (`docs/03`, `05`, `06`) ve Ç3e'de kuruldu (`c3e-tamam`); G numaralı dokümanlara işlendi (`docs/03`, `04`, `05`, `06`) ve Ç3f'de kuruldu (`c3f-tamam`).** A–F'nin bağlayıcı hali numaralı dokümanlardadır. Kurulurken netleşenler (E): kapsam adresle aynı yazılır (`core/wake`); sunucu kullanıcı adına veritabanına kullanıcı olarak gider; zamanlayıcı Supabase'in `pg_cron`'u. Bu dosya özet ve gerekçe olarak kalır.

## Neden

Kullanıcının çekirdekten beklediği (12 Kas 2026): modüller tek tek tasarlanmadan önce altyapı şu üç katmana hazır olmalı.

| Katman | Ne | Bugün | Eksik |
| --- | --- | --- | --- |
| 1. Modülün içi | Kendi verisi, veri bağlantıları, otomasyonları | Kendi tabloları, iş teklifi, olaylar, olay soruları, giriş türleri, yapılı blok ve metin okuyucu. Hepsi uygulama açıkken, tarayıcıda çalışır | Uygulama kapalıyken çalışan hiçbir şey yok: dışarıdan veri alan uç (`/api/ingest`, tasarlandı ama kurulmadı), modülün zamanlanmış işi, sunucuda modül bağlamı. Modül bir oturumun başladığını ya da bittiğini duyamıyor |
| 2. Modülün sayfası | Girince açılan, modüle özel ekranlar ve grafikler | Hazır: `/m/<slug>`, sekmeler, alt sayfalar, tam ekran görünümler, hızlı eylemler, ayarlar, grafik ve tablo bileşenleri | — |
| 3. İş sırasında ana ekran | Modülün işi çalışırken Bugün ekranının o modülün yüzüne bürünmesi: arka plan, modüle özel düğmeler, anlatım, ses | Yalnızca kartta bir satır ayrıntı ve bağlantılar (`nowCard`) | Sahne, sesli anlatım, oturum olayları |

Ayrıca günün kendisi bugün yalnızca bir çalışma penceresidir ("ilk dokunuş"tan bitiş çizgisine). Uyanış, yatış ve o saatlere bağlı rutinler yok; sabah ve akşam modülleri bunlar olmadan kurulamaz.

İki adım:

- **Ç3c. Sahne ve günün çerçevesi:** ana ekran tarafı (bölüm A–D).
- **Ç3d. Sunucu zemini:** uygulama kapalıyken çalışan taraf (bölüm E).
- **Ç3e. Modülün bölümleri:** bir modülün içinde ayrı renk ve sahne taşıyan parçalar; renklerin kullanıcıya açılması (bölüm F). Kullanıcının isteğiyle eklendi (12 Kas 2026).

Hiçbiri bir modüle özel değildir. Örneklerde sabah rutini geçer, çünkü bütün parçaları birden kullanan odur; kurulan şey genel bağlantı noktalarıdır ve `deneme` modülünde her birinin örneği bulunur.

---

## A. Sahne

Modül, kendi işi çalışırken Bugün ekranını devralan bir **sahne** verebilir.

```ts
type ModuleUi = {
  // …mevcut alanlar
  scene?: {
    when: (subject: SceneSubject) => boolean          // bu iş için sahne var mı (türüne, meta'sına göre)
    component: ComponentType<SceneProps>
    look?: { tone: 'calm' | 'focus' | 'energy' }      // çekirdeğin geçiş ve arka plan tonu
  }
}

type SceneSubject =
  | { kind: 'task'; task: Task; workItem: WorkItem | null }
  | { kind: 'rhythm'; rhythm: Rhythm }

type SceneProps = {
  subject: SceneSubject
  session: { startedAt: Date; elapsedSeconds: number }   // sunucudaki başlangıçtan; her cihazda aynı
  device: 'pano' | 'telefon'
  controls: {
    finish: () => Promise<void>      // çekirdeğin "Bitti"si
    stop: () => Promise<void>        // "Durdur"
    stuck: () => void                // "Takıldım" akışını açar
    exit: () => void                 // sahneden çık; oturum sürer
  }
  say: Say                           // bölüm C
  today: TodayBrief                  // bölüm C: günün kısa özeti (anlatım için)
  ctx: ModuleUiContext
}
```

Kurallar:

1. **Ne zaman.** `plan.now = running` ve çalışan işin modülü `scene` tanımlamışsa ve `when` doğru dönerse Bugün ekranı sahneyi çizer. Öneri durumunda (`suggest`) standart kart kalır; sahne iş başlayınca gelir. İş bitince, durunca ya da ertelenince standart ekran geri döner.
2. **Çekirdeğin çerçevesi kalır.** Sahnenin üstünde her zaman ince bir şerit durur: saat, işin adı, geçen süre, "Çık". Şerit sahnenin değil çekirdeğindir; sahne onu gizleyemez. "Çık" standart Bugün ekranına döndürür, oturum sürer ve kartta "Sahneye dön" çıkar.
3. **Oturum çekirdeğindir.** Başlatma, bitirme, ölçme, "Devam ediyor musun?" ve 30 dakikalık cevapsızlık kuralı değişmez. Sahne oturumu yalnızca `controls` ile etkiler.
4. **Sahne serbesttir.** Şeridin altındaki bütün alan modülündür: arka plan, kendi düğmeleri, adımlar, sayaçlar, metin. Çekirdeğin tasarım dilini ve temasını kullanır; hareket azaltma tercihine uyar.
5. **Geçiş.** Standart ekrandan sahneye ve geri geçiş yumuşaktır (kısa bir solma); `look.tone` arka planın tonunu belirler. Ayrıntılı görünüş Ç4'te cilalanır.
6. **İki cihaz.** Pano ve telefon aynı sahneyi kendi yerleşimiyle çizer (`device`). Sahnenin durumu (hangi adımdayım) modülün kendi verisindedir ve canlı bağlantıyla iki cihazda aynıdır; yalnızca ekranda tutulan durum öbür cihaza taşınmaz.
7. **Hata.** Sahne hata verirse çekirdek standart kartı gösterir ve tek satırla bildirir; oturum etkilenmez.
8. **Tam ekranla ilişkisi.** `fullscreen` kullanıcının modül sayfasından kendi açtığı görünümdür; sahne, iş çalışırken Bugün ekranında kendiliğinden gelendir. Aynı bileşen ikisinde de kullanılabilir.

Yerleşim (pano):

```
┌──────────────────────────────────────────────────────────────────────┐
│ 08:14   Sabah rutini · 6 dk                                    Çık   │  ← çekirdeğin şeridi
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        (modülün sahnesi)                             │
│        arka plan · adımlar · sayaç · modülün düğmeleri               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Adım yürütücü (bileşen takımına eklenir).** Sıralı adımlı sahneler (rutin, pişirme, antrenman) ortak bir bileşen kullanır: `StepRunner`. Adım listesi (ad, süre ya da tekrar sayısı, açıklama), geri sayım, "sonraki", "atla", adım bitince geri çağrı. Yalnızca arayüzdür; adımların kaydını modül kendi tablosunda tutar. Modül isterse kullanmaz.

**Görüşün gerek:** sahnenin yalnızca çalışan işte gelmesi (öneride değil); şeridin içeriği; "Çık"tan sonra dönüş yolu.

## B. Oturum ve gün olayları

Modül bugün yalnızca kalem kapanınca haber alır (`onOutcome`). Otomasyon için çekirdek şu olayları yayınlar (mevcut `on` düzeniyle; `events` tablosuna yazılır):

| Olay | Ne zaman | Yük | Kime |
| --- | --- | --- | --- |
| `core.session_started` | Oturum başladı | iş ya da ritim kimliği, `source`, başlangıç | İşin modülüne |
| `core.session_ended` | Oturum kapandı | aynısı + sonuç (`done`, `stopped`, `deferred`, `stuck`, `unanswered`), harcanan dakika, ölçüldü mü | İşin modülüne |
| `core.day_started` | Uyanış kaydedildi (bölüm D) | gün, uyanış saati, tahmini mi | Etkin bütün modüllere |
| `core.day_closed` | Yatış kaydedildi | gün, yatış saati | Etkin bütün modüllere |

Oturum olayları yalnızca işin sahibi modüle verilir; modül başka modülün işini bu yoldan izleyemez.

## C. Sesli anlatım

Çekirdek modüllere bir **anlat** servisi verir; ne söyleneceğine modül karar verir.

```ts
type Say = (text: string, options?: { interrupt?: boolean }) => void
// SceneProps.say ve ModuleUiContext.say

type TodayBrief = {                   // anlatım ve sahneler için günün kısa özeti (yalnızca okuma)
  top: { title: string; module: string; reason: string | null }[]   // günün odağı
  blocks: { title: string; startsAt: Date; endsAt: Date }[]         // bugünün sabit blokları
  finishLine: Date
  wokeAt: Date | null
}
```

Kurallar:

1. **Sağlayıcı arayüzü.** Yapay zeka geçidindeki gibi: `src/core/voice/` tek giriş noktasıdır. İlk sağlayıcı cihazın kendi konuşma sentezidir (ücretsiz, çevrimdışı). Ücretli, doğal sesli bir sağlayıcı sonradan aynı arayüze eklenebilir; modüller değişmez.
2. **Sıra ve kesme.** Art arda gelen metinler sıraya girer; `interrupt` sıradakileri atar. Uzun metin cümlelere bölünür (bazı tarayıcılar uzun konuşmayı keser).
3. **Hangi cihaz konuşur.** Varsayılan: dokunuşun yapıldığı cihaz. Ayarlarda cihaz başına: sesli anlatım açık ya da kapalı, ses, hız; "bu cihaz dokunuş olmadan da konuşsun" (pano için). İki cihazın aynı anda konuşmaması için kendiliğinden konuşma yalnızca bu ayarın açık olduğu cihazda olur.
4. **Tarayıcı kısıtları.** Telefonda ses bir dokunuşun içinden başlamalıdır; uygulama kendiliğinden konuşmaya başlayamaz. Panoda, uygulama olarak kurulmuş pencerede kendiliğinden konuşabildiği belgelenmiş, bu kurulumda denenmemiştir: Ç3c'de gerçek cihazlarda denenir ve sonuç yazılır.
5. **Sessizlik saygısı.** Anlatım kapalıysa ya da cihaz sessizdeyse `say` hiçbir şey yapmaz ve hata vermez; sahne anlatıma bağımlı kurulmaz (her söylenen ekranda da yazar).
6. **Ton.** Anlatılan metinler ürün kurallarına uyar: suçlama ve geçmişi sayma yok.
7. **Kapsam dışı:** sesle komut (dinleme), uygulama kapalıyken konuşma.

**Görüşün gerek:** cihazın kendi sesiyle başlamak; konuşan cihazın varsayılanı.

## D. Günün çerçevesi

Gün iki gerçek olaya bağlanır: uyanış ve yatış.

```
uyku │ uyanışa bağlı işler │ çalışma penceresi │ akşam │ yatışa bağlı işler │ uyku
     ▲ uyanış (kayıt)                          ▲ bitiş çizgisi (saat)       ▲ yatış (kayıt)
```

**Veri.**

```
days
  woke_at timestamptz null          -- uyanış
  woke_estimated boolean default false   -- "Uyandım" denmedi; ilk etkileşimden alındı
  bed_at timestamptz null           -- yatış ("Yatıyorum")
  planned_wake time null            -- uyku planının bu gün için seçtiği uyanış
  planned_bed time null             -- uyku planının bu gece için seçtiği yatış
  expected_wake time null           -- kullanıcının yalnızca bu gün için verdiği uyanış ("yarın erken kalkacağım")
  expected_bed time null            -- kullanıcının yalnızca bu gece için verdiği yatış ("bu gece geç yatacağım")

settings
  day_frame jsonb                   -- aralıklar ve uyku hedefi:
                                    -- { wake: ["06:00","09:00"], bed: ["22:00","01:00"], sleep_minutes: 480,
                                    --   by_day_type: { office: { wake: […], bed: […] } } }
```

Uyanış ve yatış birer saat değil birer aralıktır; uyku hedefi bir süredir. Başlangıç değerleri kullanıcının söyledikleridir (12 Kas 2026): uyanış 06:00–09:00, yatış 22:00–01:00, uyku 8 saat. Ayarlar'dan değişir; gün tipine özel aralık isteğe bağlıdır. Aralıklar planlayıcıyı bağlar, kullanıcıyı değil: gerçek uyanış ve yatış aralığın dışında olabilir. Bitiş çizgisi mevcut ayarıyla kalır.

**Kayıt.**

- Sabah ilk açılışta ekran "Günaydın" durumundadır (`now = morning`): tek düğme, "Uyandım". Dokunuş `woke_at`'i şimdi olarak yazar; yanında "biraz önce" seçeneği (15, 30, 60 dk önce).
- "Uyandım" denmeden başka bir şeye dokunulursa uyanış o an sayılır ve `woke_estimated` işaretlenir.
- Gece: akşam ekranında ve akşam kapanışının sonunda "Yatıyorum". `bed_at` yazılır, ekran geceye geçer. Denmezse yatış kaydedilmez; uygulama uydurmaz.
- Uyku süresi = sonraki günün `woke_at`'i − `bed_at`; ikisi de kayıtlıysa hesaplanır. Tahmini uyanışla hesaplanan süre tahmini diye işaretlenir.
- Her ikisi de olay yayınlar (bölüm B) ve dışarıdan da kaydedilebilir (bölüm E: telefonun alarm ya da uyku otomasyonu).

**Uyku planı.** Planlayıcı her gece için bir yatış, her sabah için bir uyanış seçer; amaç aralıkların içinde kalarak uyku hedefini tutturmaktır. Saf bir fonksiyondur (`sleepPlan`), motorun parçasıdır; yapay zekaya sorulmaz.

1. **En geç uyanış.** Yarının ilk yükümlülüğüne yetişecek en geç an: `ilk sabit blok − bloğun yol süresi − uyanışa bağlı işlerin ayak izi`. Yükümlülük yoksa uyanış aralığının sonu. Aralığın sonunu geçemez.
2. **Yüke göre erkene çekme.** Yarının yükü (yarın zorunlu olacak işler ve haftanın kalan payının kalan günlere eşit bölümü) en geç uyanışla kurulan günün kapasitesine sığmıyorsa uyanış 15'er dakika erkene çekilir: sığana ya da uyanış aralığının başına gelene kadar. Yük hafifse uyanış en geç uyanışta kalır.
3. **Planlanan yatış** `planlanan uyanış − uyku hedefi`dir, yatış aralığına sıkıştırılır.
4. **Uyku iş yüküne feda edilmez.** Yük uyanışı ancak yatış da aynı kadar erkene alınabiliyorsa erkene çeker. Uykuyu hedefin altına yalnızca sabit bir yükümlülük (erken ders gibi) düşürebilir; o zaman ekran bunu açıkça söyler ("bu gece en çok 7 saat").
5. **Gerçek yatış planı değiştirir.** Yatış kaydedilince (ya da kullanıcı "bu gece geç yatacağım" deyince) yarının beklenen uyanışı `yatış + uyku hedefi` olur; uyanış aralığının başından erken, en geç uyanıştan geç olamaz. Geç yatılan gecede uyanış geriye kayar ve yarının çalışma süresi kısalır; erken yatılan gecede uyanış öne gelir ve süre uzar. Hedef süre en geç uyanışa sığmıyorsa uyku kısa kalır ve ekran söyler.
6. **Gerçek uyanış her şeyin önündedir.** Uyanış kaydedilince gün ona göre kurulur.
7. **Planın geri kalanına etkisi.** Beklenen uyanış değişince yarının planı yeniden kurulur. Haftanın taahhüdü yalnızca mevcut tetikleyiciyle yeniden kurulur: kalan günlerin kapasitesi toplamda 30 dakikadan çok düşerse. Kazanılan süre günün doldurmasına açılır; taahhüt bu yüzden yeniden kurulmaz (plan istikrarı).
8. **Uyku borcu tutulmaz.** Kısa geçen gece sonraki gecelere eklenmez; her gece kendi hedefiyle planlanır.
9. **Uygulama uyandırmaz.** Planlanan uyanış bilgidir; alarmı kullanıcı kurar. Akşam ekranı yarının uyanışını ve bu gecenin yatışını birlikte gösterir.

Örnek (aralıklar 06:00–09:00 ve 22:00–01:00, hedef 8 saat): yarın 10:30'da dersin var, yol 45 dakika, sabah rutini 45 dakika → en geç uyanış 09:00. Yük hafif → planlanan uyanış 09:00, yatış 01:00. Yarın iki teslim varsa ve gün sığmıyorsa → uyanış 07:30'a, yatış 23:30'a çekilir. O gece 00:30'da yattıysan → beklenen uyanış 08:30; bir saatlik çalışma süresi gider, plan yeniden kurulur.

**Planlayıcı.**

1. **Günün başı.** Çalışma penceresi `uyanış + uyanışa bağlı işlerin ayak izi`nde başlar. Uyanış henüz yoksa (yarının planı, sabah uyanmadan önce) sırayla: kullanıcının o güne verdiği değer (`days.expected_wake`); yoksa uyku planının beklenen uyanışı.
2. **Çapa.** `timing` bir alan daha taşır: `anchor: 'wake' | 'bed'`. Uyanışa bağlı işler uyanıştan başlayarak art arda dizilir; yatışa bağlı işler beklenen yatışta bitecek biçimde geriye doğru dizilir. Çapa kesindir: bu işler yuvalara dağıtılmaz. Birden çok iş aynı çapaya bağlıysa sıra modülün verdiği `order` ile, eşitse skorla belirlenir. Çapa `windows` ile birlikte kullanılmaz.
3. **Akşam.** Bitiş çizgisi ile yatışa bağlı işler arası akşamdır. Planlayıcı akşama yalnızca `timing.after_finish = true` taşıyan işleri koyar ("bitiş çizgisinden sonra da olur"); `windows` ve öbür kısıtlar yine geçerlidir. Başka hiçbir iş bitiş çizgisinden sonraya konmaz. Akşam süresi kapasite çarpanına girmez. Bu, `docs/09-kararlar.md` içindeki "penceresi bitiş çizgisinden sonraya düşen iş" açık sorusunu kapatır.
4. **Gün kısalınca.** Geç uyanılan günde çalışma penceresi kısalır; plan yeniden kurulur, sığmayanlar olağan kurallarla "vakit kalırsa"ya ya da sonraki günlere gider. Uyarı metinleri bunu kusur gibi anlatmaz.
5. **Kaydırma.** "Bu gece geç yatacağım" ve "yarın erken kalkacağım" tek dokunuşla o günün beklenen saatini değiştirir (`expected_bed`, `expected_wake`); uyku planı bu değerleri veri sayar, kalıcı ayar değişmez.

**Ekran durumları.** `plan.now`'a iki durum eklenir, biri değişir:

| Durum | Koşul | Ekran |
| --- | --- | --- |
| `morning` | Gün başladı, uyanış kaydı yok | "Günaydın", "Uyandım" düğmesi, bugünün kısa özeti |
| `evening` | Bitiş çizgisi geçti, yatış kaydı yok | Akşam: varsa akşama konan işler, "Günü kapat", "Yatıyorum". Sakin ekran |
| `night` | Yatış kaydedildi, ya da beklenen yatış aralığının sonu geçti | Gece ekranı (mevcut) |

Uyanışa bağlı ilk iş "Uyandım"dan sonra kendiliğinden önerilir; ayar açıksa kendiliğinden başlar (tek dokunuşla uyanış + rutin).

**Görünürlük.** Bugün ekranının üst şeridinde uyanış saati ve bu gecenin yatış aralığı; zaman çizelgesi uyanıştan beklenen yatışa uzanır, bölümler (uyanışa bağlı, çalışma, akşam, yatışa bağlı) ayırt edilir. Uyanış, yatış ve uyku süresinin haftalara yayılan görünümü çekirdeğin Hafta ekranında tek satırlık özet olarak, ayrıntısı rutin modülünün sayfasında yer alır (modül bu veriyi `ctx` üzerinden okur). Seri, puan, rozet yok.

**Görüşün gerek:** uyanışın dokunuşla kaydı ve dokunulmazsa ilk etkileşimden tahmin; "Uyandım"dan sonra rutinin kendiliğinden başlaması; yük hafifken uyanışın aralığın sonuna yakın seçilmesi; uyku borcunun tutulmaması; akşam ekranının içeriği.

---

## E. Sunucu zemini (Ç3d)

Bugün modülün bütün mantığı tarayıcıda, uygulama açıkken çalışır. Veri bağlantıları ve otomasyonlar için üç parça gerekir.

**1. Cihaz anahtarları.** Dış kaynakların (telefonun otomasyonu, bilgisayardaki toplayıcı) Sherpa'ya yazabilmesi için iptal edilebilir anahtarlar.

```
device_tokens
  name text                    -- "iPhone Kestirmeler", "Ninova toplayıcısı"
  token_hash text unique       -- anahtarın kendisi saklanmaz
  scopes text[]                -- izinli uçlar: 'core.wake', 'okul.ninova' …
  last_used_at timestamptz null
  revoked_at timestamptz null
```

Ayarlar → Bağlantılar: anahtar üretme (yalnızca bir kez gösterilir), kapsam seçme, son kullanım, iptal. Anahtar yalnızca kapsamındaki uca yazar; okuyamaz.

**2. Giriş ucu.** `POST /api/ingest/<kaynak>/<tür>`, anahtar başlıkta. Çekirdek anahtarı ve kapsamı denetler, gövdeyi türün şemasıyla doğrular, işleyiciyi sunucuda modülün bağlamıyla çalıştırır. Aynı isteğin yinelenmesi (`Idempotency-Key`) ikinci kez işlenmez. Hız sınırı vardır.

```ts
type ModuleDefinition = {
  // …
  ingest?: {
    kind: string                                   // 'ninova', 'tarti'
    schema: ZodType
    handle: (payload: unknown, ctx: ModuleContext) => Promise<void>
  }[]
}
```

Çekirdeğin kendi türleri: `core/wake`, `core/bed` (bölüm D; telefonun alarm ya da uyku otomasyonundan), `core/context` (bağlam; konum otomasyonu fikri için hazır uç, arayüzü sonra).

**3. Zamanlanmış işler.** Modül, uygulama kapalıyken dönen işler bildirebilir.

```ts
  jobs?: {
    key: string
    every: 'hour' | 'day' | 'week'
    at?: string                                    // 'HH:mm', İstanbul; gün ve hafta için
    run: (ctx: ModuleContext) => Promise<void>     // idempotent olmalı
  }[]
```

Çekirdek tek bir zamanlayıcı ucundan sırası gelen işleri çalıştırır ve her çalışmayı kaydeder (`job_runs`: ne zaman, sonuç, hata). `docs/02-mimari.md` içindeki çekirdek işleri (yarının bloklarını üretme, ritim dönemlerini kapatma) de aynı düzenle çalışır. Tetikleyicinin ne olacağı (barındırıcının zamanlayıcısı ya da veritabanının zamanlayıcısı) kurulumda güncel plan koşullarına bakılarak seçilir: ücretsiz katmanda sıklık sınırı olabilir.

**Sunucuda modül bağlamı.** `ingest` ve `jobs` işleyicileri tarayıcı olmadan çalışır: `ModuleContext`'in sunucu sürümü kullanıcının verisine sunucu anahtarıyla, yalnızca o kullanıcının satırlarıyla sınırlı erişir. Modülün `rules.ts`, `ingest` ve `jobs` kodu tarayıcıya özgü hiçbir şey içe aktarmaz (lint kuralı). Sunucuda yayınlanan olaylar da dinleyen modüllerin işleyicilerine sunucuda verilir.

**Dışarı doğru eylem yok.** Sherpa dış sistemlere (ışık, bildirim servisi) kendisi komut göndermez; ev otomasyonu telefonun kendi otomasyonunda kalır ve Sherpa'ya yalnızca olay bildirir. Gerekirse sonra eklenir.

---

## F. Modülün bölümleri (Ç3e)

Bir modülün içinde, aynı veriyi ve sayfayı paylaşan ama ana ekranda ayrı yüzü olan parçalar vardır: rutin modülünde Sabah ve Akşam, Okul'da her ders, Beslenme'de prep ve alışveriş. Ç3c'de sahne, ton ve renk modül başına tektir: sabah rutini de akşam rutini de aynı renkle ve aynı çerçeveyle görünür. Ayrıca renk kodda sabittir; kullanıcı değiştiremez.

Çözüm: modül kendini **bölümlere** (`facets`) ayırabilir. Bölüm yalnızca görünüşü ve sahneyi belirler; veri, sayfa, ayarlar, planlama ve olay dinleme modülde ortak kalır.

```ts
type ModuleDefinition = {
  // …
  facets?: (ctx: ModuleContext) => Promise<ModuleFacet[]>   // sabit ya da modülün verisinden (dersler)
}

type ModuleFacet = {
  key: string                  // modül içinde tekil; küçük harf, rakam, tire ('sabah', 'yzv406e')
  name: string                 // 'Sabah', 'YZV406E Derin Öğrenme'
  color: string                // #rrggbb; varsayılan renk, kullanıcı değiştirebilir
  scene?: string               // ui.scenes içindeki sahnenin anahtarı
  tone?: 'calm' | 'focus' | 'energy'   // sahne çerçevesinin tonu; yoksa sahnenin kendi tonu
}

type ModuleUi = {
  // …
  scene?: ModuleScene                    // varsayılan sahne (Ç3c)
  scenes?: Record<string, ModuleScene>   // ad verilmiş sahneler; bölümler bunlara başvurur
}
```

Kurallar:

1. **İş bölümünü taşır.** İş zarfına isteğe bağlı `facet` alanı eklenir (bölümün anahtarı). Saklama: `work_items.facet`, `tasks.facet`, `rhythms.facet`, `blocks.facet` (`text`, boş geçilebilir). Oturum işinin kendi bölümü yoksa kaleminin bölümü geçerlidir. `facet` olgu alanıdır: modül her teklifte yazar; kullanıcı formdan değiştirdiyse ezilmez.
2. **Doğrulama.** Teklif anında `facet` modülün o anki bölüm listesinde olmalıdır; yoksa teklif alanın adıyla reddedilir. Bölüm sonradan listeden çıkarsa (dönem bitti, ders kalktı) iş anahtarı korur ve modülün rengiyle görünür; hata vermez.
3. **Bölüm listesi.** `facets` modülün bağlamıyla hesaplanır ve modülün verisi değişince tazelenir (çip gibi). Bölümü olmayan modülde bu alan yoktur ve her şey Ç3c'deki gibidir.
4. **Renk.** Çekirdeğin bir iş için kullandığı renk tek yardımcıdan gelir: `kullanıcının bölüm rengi → bölümün varsayılan rengi → kullanıcının modül rengi → modülün varsayılan rengi`. Bu yardımcı her yerde kullanılır: zaman çizelgesi (şerit ve yol), Şimdi kartı, Sıradakiler, "Vakit kalırsa", sahnenin çerçevesi, Hafta ekranındaki kalemler, akşam kapanışı, modül sayfasındaki listeler. Modül düzeyindeki yerler (çip, modül payları, modül listesi) modülün rengini kullanır.
5. **Sahne.** Çalışan işin bölümü `scene` taşıyorsa o sahne kullanılır (`ui.scenes[anahtar]`); yoksa modülün varsayılan sahnesi. Sahnenin `when` işlevi yine geçerlidir. Sahne bileşeni `SceneProps.facet` ile bölümü (anahtar, ad, renk) alır; aynı bileşen birden çok bölümde kullanılabilir (her ders aynı "ders" sahnesini kendi rengiyle).
6. **Ton.** Sahne çerçevesinin tonu: bölümün `tone`'u → sahnenin `look.tone`'u.
7. **Kullanıcının renkleri.** Ayarlar → Modüller → <modül>: modülün rengi ve her bölümün rengi seçilir; "varsayılana dön". Saklama: `modules.color` (modülün; kurulumda tanımdan kopyalanır, artık kullanıcı değiştirir) ve `modules.facet_colors jsonb default '{}'` (`{ "sabah": "#E8A33D" }`). Seçici açık ve koyu temada okunur kalan hazır bir paletten seçtirir; özel renk de girilebilir (`#rrggbb`). Değişiklik öbür cihaza canlı gider.
8. **Form.** Bölümü olan modülün işlerinde düzenleme formunda "Bölüm" seçimi vardır.
9. **Planlamaya etkisi yok.** Bölüm planlayıcının girdisi değildir: skor, süzgeçler, taban ve kapasite değişmez. (Bölüm başına ağırlık ya da taban gerekirse ayrı karar.)
10. **Olaylar ve dışa aktarım.** `core.session_started` ve `core.session_ended` yükü `facet`'i taşır. Dışa aktarım yeni sütunları ve renkleri içerir.
11. **Yapay zeka.** Bu adımda bölüm seçmez. Serbest girişten modüle yönlenen iş bölümsüz açılır; bölümü kullanıcı formdan ya da modül kendi giriş türünden verir. Planlama çağrılarına gitmez.

Örnek, rutin modülü: `facets` → Sabah (sıcak sarı, sahne `gunes`, ton `energy`), Akşam (lacivert, sahne `gece`, ton `calm`). Sabah rutini ritmi `facet: 'sabah'`, akşam rutini `facet: 'aksam'` taşır. Zaman çizelgesinde ikisi kendi renginde görünür; çalışınca biri güneşli, öbürü gece sahnesine geçer. Okul örneği: `facets` her etkin ders için bir bölüm döner, hepsi aynı `ders` sahnesini kullanır; şeritte her ders kendi rengindedir.

**Görüşün gerek:** renk paleti; Ayarlar'daki renk seçicinin yerleşimi; modül düzeyinde kalan yerler (çip, payların modül renginde kalması).

## G. Çapalı diziler (Ç3f)

Uyanışa ve yatışa bağlı işler planlayıcıda zaten art arda dizilir (bölüm D). Ama ekranda her biri ayrı bir iştir: sahne yalnızca kendi işini bilir, bir iş bitince sıradaki için "Başla"ya basmak gerekir, başka modülün işi sahneden görünmez. Kullanıcının isteği (13 Kas 2026): sabah tek bir akış olarak yaşansın. Diş ve su (Rutin), boyun hareketleri (Spor), duş ve hazırlık (Rutin) tek listede görünsün; biri bitince öbürü kendiliğinden gelsin; hareket adımında ekran Spor'un sahnesine geçsin ve bitince sabaha dönsün. Veri modüllerde ayrı kalır.

**Dizi**, aynı çapaya bağlı işlerin o günkü sıralı listesidir: uyanış dizisi ve yatış dizisi. Sırayı planlayıcı verir (`order`, eşitse skor); bu adım planlayıcıyı değiştirmez, dizinin görünürlüğünü ve akışını ekler.

```ts
type SceneChain = {
  anchor: 'wake' | 'bed'
  items: {
    id: string                         // iş ya da ritim kimliği
    title: string
    module: { slug: string; name: string }
    facet: { key: string; name: string } | null
    color: string                      // çözülmüş renk (bölüm F, kural 4)
    minutes: number
    state: 'done' | 'running' | 'next' | 'passed'   // bugün yapıldı, çalışıyor, sırada, bugün geçildi (ertelendi ya da zamanı geçti)
    mine: boolean                      // bu sahnenin modülünün işi mi
  }[]
}

type SceneProps = {
  // …
  chain: SceneChain | null             // çalışan iş bir dizinin parçasıysa o dizi
  controls: {
    // …
    closing: () => void                // akşam kapanışını sahnenin içinde açar (aşağıda kural 6)
  }
}
```

Kurallar:

1. **Dizi türetilir.** Planın çapalı yuvalarından ve bugünün kayıtlarından saf bir yardımcıyla kurulur (`chainOf`); bugün yapılmış çapalı işler `done` olarak listede kalır. Planlayıcının girdisi ve çıktısı değişmez.
2. **Başka modülün işi yalnızca görünür.** Dizideki başka modüle ait satır adını, modülünü, bölümünü, rengini, süresini ve durumunu taşır; `source`, `meta` ve modülün verisi gelmez. Modüller birbirini yine tanımaz; sahne satırı çizer, o kadar.
3. **Kendiliğinden devam.** Ayar: `day_frame.chain_auto` ("Dizide sıradaki iş kendiliğinden başlasın", başlangıçta açık). Dizideki çalışan iş "Bitti" ile kapanınca ya da çalışırken ertelenince, dizinin sıradaki işi aynı cihazda hemen başlar. Sıradaki iş başka modülünse onun sahnesi (yoksa standart kart) gelir; geçiş sahne geçişiyle aynıdır. Durdur, Takıldım ve cevapsız kapanıştan sonra kendiliğinden başlamaz. Dizinin son işi bitince standart ekran döner. Kendiliğinden başlayan oturum her oturum gibidir: durdurulur, sahneden çıkılır.
4. **Uyanış dışarıdan gelince.** Uyanış `core/wake` ile kaydedildiyse ve o gün uyanış dizisi hiç başlamadıysa, uygulama o cihazda ilk öne geldiğinde (`start_on_wake` açıkken ve dizinin önerildiği süre içinde: bölüm D'nin uygulama notlarındaki 60 dakika) dizinin ilk işi başlar. Elle "Uyandım"ın davranışı değişmez.
5. **Yatış dizisi** aynı kurallarla çalışır.
6. **Sahneden kapanış.** `controls.closing()` akşam kapanışını sahnenin içinde açar (çekirdeğin şeridi durur, oturum sürer); kapanış onaylanınca ya da vazgeçilince sahneye dönülür. Sahneden açılan kapanışta "Onayla ve yat" yoktur: yatışı sahnenin kendi son adımı kaydeder. Kapanışın yapılıp yapılmadığı `today.closed` ile okunur.
7. **Standart ekran.** Sahnesi olmayan ya da sahneden çıkılmış bir çapalı işte Şimdi kartı dizideki yeri tek satırla gösterir ("Sabah dizisi 2/3 · sırada Duş ve hazırlık").
8. **Sıra.** `timing.order` modüller arasında ortaktır (1–99); modüller araya yer bırakarak numara verir (10, 20, 30). Kullanıcı bir işin sırasını düzenleme formundan değiştirebilir (alan zaten kullanıcıya aittir).

Kapsam dışı: bir işin başka bir işin hemen ardına bağlanması ("antrenman o gün plandaysa duş onun ardına"; salon antrenmanı gelince ayrı karar), dizinin sürükleyerek sıralanması.

Kurulurken netleşen (Ç3f): yatışı sahnenin son adımının kaydedebilmesi için `controls.bed()` ("Yatıyorum") eklendi; kural 6 onsuz uygulanamıyordu.

**Görüşün gerek:** kendiliğinden devamın başlangıçta açık olması; ertelemeden sonra devam etmesi; standart karttaki satırın metni.

## Kabul ölçütleri

**Ç3c**

- [ ] `deneme` modülü bir sahne tanımlıyor: işi başlatınca Bugün ekranı sahneye geçiyor, bitince geri dönüyor; panoda ve telefonda
- [ ] Sahnedeyken üst şerit duruyor; "Çık" standart ekrana döndürüyor, oturum sürüyor, "Sahneye dön" çalışıyor
- [ ] Sahne hata verince standart kart geliyor, oturum etkilenmiyor
- [ ] Sahnesi olmayan modülde ve `scene.when` yanlış dönen işte ekran Ç3'teki gibi
- [ ] `StepRunner` ile adımlı bir örnek sahne: geri sayım, sonraki, atla
- [ ] Modül `core.session_started` ve `core.session_ended` olaylarını yalnızca kendi işleri için alıyor; `core.day_started` ve `core.day_closed` etkin bütün modüllere gidiyor
- [ ] `say`: cihazın sesiyle Türkçe konuşuyor, sıra ve kesme çalışıyor, kapalıyken sessiz ve hatasız; cihaz başına ayar
- [ ] Sesli anlatım gerçek telefonda (dokunuştan sonra) ve gerçek panoda denendi; sonuç `docs/ILERLEME.md` içinde (elle doğrulanacak)
- [ ] "Uyandım" ve "Yatıyorum" kaydediliyor; "Uyandım" denmeden dokunulunca uyanış tahmini olarak işaretleniyor
- [ ] Çalışma penceresi uyanışa göre başlıyor: geç uyanılan günde plan kısalıyor; uyanış yokken beklenen uyanış kullanılıyor
- [ ] Uyku planı: ilk yükümlülüğe göre en geç uyanış; yük sığmayınca uyanışın ve yatışın birlikte erkene çekilmesi; iş yükünün uykuyu hedefin altına düşürmemesi; sabit yükümlülük düşürünce ekranın söylemesi
- [ ] Gerçek yatış kaydedilince yarının beklenen uyanışı ve planı değişiyor (geç yatış → kısalan gün, erken yatış → uzayan gün); kapasite 30 dakikadan çok düşünce haftanın taahhüdü yeniden kuruluyor
- [ ] Akşam ekranı bu gecenin yatışını, yarının uyanışını ve uyku süresini birlikte gösteriyor
- [ ] `anchor: 'wake'` taşıyan iş uyanıştan hemen sonra, `anchor: 'bed'` taşıyan iş yatıştan önce duruyor; yuvalara dağıtılmıyor
- [ ] `after_finish` taşımayan hiçbir iş bitiş çizgisinden sonraya konmuyor; taşıyan iş akşama konabiliyor
- [ ] `morning` ve `evening` durumları doğru koşullarda geliyor; "bu gece geç yatacağım" ve "yarın erken kalkacağım" yalnızca o günü etkiliyor
- [ ] Ayarlar'da uyanış ve yatış aralıkları ile uyku hedefi değişiyor; gün tipine özel aralık verilebiliyor
- [ ] Günün çerçevesi kullanılmayan veride (uyanış kaydı yok, çapa yok, `after_finish` yok) çalışma penceresinin içindeki plan Ç3b'dekiyle aynı; Ç3 ve Ç3b testleri değiştirilmeden geçiyor ya da değişen her test gerekçesiyle kayıtlı

**Ç3d**

- [ ] Ayarlar → Bağlantılar'da anahtar üretiliyor (bir kez gösteriliyor), kapsamı seçiliyor, iptal ediliyor; iptal edilen anahtar reddediliyor
- [ ] Anahtar yalnızca kapsamındaki uca yazabiliyor; okuma yapamıyor; yanlış ya da eksik anahtar 401, kapsam dışı 403
- [ ] `core/wake` ve `core/bed` uçları uyanışı ve yatışı kaydediyor; açık ekranlar canlı güncelleniyor
- [ ] `deneme` modülünün bir `ingest` türü: geçerli gövde işleniyor, geçersiz gövde adıyla reddediliyor, yinelenen istek ikinci kez işlenmiyor
- [ ] `deneme` modülünün bir zamanlanmış işi uygulama kapalıyken çalışıyor; `job_runs` kaydı düşüyor; aynı iş iki kez tetiklenince veri bozulmuyor
- [ ] Sunucuda çalışan işleyici yalnızca anahtarın sahibinin verisine erişiyor (başka hesabın verisine erişemediği testle)
- [ ] Modülün sunucu kodu tarayıcıya özgü bir şey içe aktarınca lint hata veriyor
- [ ] iPhone Kestirmeler ile `core/wake` gerçek telefonda denendi (elle doğrulanacak; adımları `docs/ILERLEME.md` içinde)

**Ç3e**

- [ ] Bölümü olmayan modülde her şey Ç3c'deki gibi; önceki fazların testleri değiştirilmeden geçiyor
- [ ] `deneme` modülü iki sabit bölüm tanımlıyor; bölümlü işler zaman çizelgesinde, kartta, Sıradakiler'de, Hafta ekranında ve sahnenin çerçevesinde bölümün renginde
- [ ] Çalışan işin bölümüne göre sahne ve ton seçiliyor; bölümün sahnesi yoksa modülün sahnesi geliyor
- [ ] `deneme` modülünün verisinden üretilen dinamik bir bölüm listesi: kayıt eklenince bölüm listesi ve renkler canlı tazeleniyor
- [ ] Zarf: bilinmeyen `facet` alanın adıyla reddediliyor; oturum işi kalemin bölümünü devralıyor; kullanıcının formdan değiştirdiği bölüm modülün sonraki teklifinde ezilmiyor; listeden çıkan bölümün işi modülün rengiyle görünüyor
- [ ] Ayarlar'da modülün ve bölümlerin rengi değişiyor, "varsayılana dön" çalışıyor; değişiklik öbür cihazda canlı görünüyor
- [ ] Oturum olayları `facet`'i taşıyor; dışa aktarım yeni sütunları ve renkleri içeriyor
- [ ] Planlayıcının çıktısı bölümden bağımsız (aynı girdi, bölüm eklenince aynı plan)

**Ç3f**

- [ ] İki ayrı modülün (`deneme` ve şablon kopyası) uyanışa bağlı işleri aynı dizide; sahne `chain` ile hepsini sırasıyla, adı, modülü, rengi, süresi ve durumuyla alıyor; başka modülün satırında `source` ve `meta` yok
- [ ] Dizideki iş "Bitti" ile kapanınca sıradaki iş aynı cihazda kendiliğinden başlıyor; sıradaki iş başka modülünse o modülün sahnesi geliyor; ayar kapalıyken başlamıyor
- [ ] Ertele'den sonra sıradaki başlıyor; Durdur, Takıldım ve cevapsız kapanıştan sonra başlamıyor
- [ ] Dizinin son işi bitince standart ekran dönüyor; bugün yapılmış işler dizide `done` olarak duruyor
- [ ] Yatış dizisinde aynı davranış
- [ ] `core/wake` ile kaydedilen uyanıştan sonra uygulama öne gelince, `start_on_wake` açıksa dizinin ilk işi başlıyor; süre geçtiyse başlamıyor; elle "Uyandım" eskisi gibi
- [ ] Sahne `controls.closing()` ile akşam kapanışını açıyor; bitince sahneye dönülüyor, oturum sürüyor; sahneden açılan kapanışta "Onayla ve yat" yok; `today.closed` doğru
- [ ] Standart kartta dizideki yer tek satırla görünüyor
- [ ] Çapalı işi olmayan veride ve `chain` kullanmayan sahnede her şey Ç3e'deki gibi; önceki fazların testleri değiştirilmeden geçiyor
- [ ] Planlayıcının çıktısı değişmedi (aynı girdi, aynı plan; testle)

## Kapsam dışı

- Gerçek modüller (sabah ve akşam rutini dahil); her biri kendi tasarım oturumunda
- Sesle komut; ücretli ses sağlayıcısı
- Sherpa'nın dış sistemlere komut göndermesi (ışık, akıllı ev)
- Konumdan bağlam seçiminin arayüzü (uç hazır olur, akış sonra)
- Görsel cila: sahne geçişlerinin ve akşam ekranının son hali Ç4'te
- Bölüm başına planlama ağırlığı ya da taban; yapay zekanın bölüm seçmesi (Ç3e)
