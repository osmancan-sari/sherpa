# Veri modeli (çekirdek)

Bu doküman çekirdek tabloları tanımlar. Modüllerin kendi tabloları kendi dokümanlarındadır (`docs/moduller/`). Aşağıdaki tanımlar şemanın niyetini verir; migration yazarken tipleri, indeksleri ve kısıtları buna göre kur.

## Ortak kurallar

- Her tabloda: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid()`, `created_at`, `updated_at` (tetikleyiciyle).
- Her tabloda RLS: `user_id = auth.uid()`.
- Zamanlar `timestamptz`; yalnızca gün gereken yerde `date`. Uygulama saat dilimi `Europe/Istanbul`.
- Enum'lar Postgres enum tipi olarak tanımlanır.
- Silme yerine durum: işler `dropped`, modüller `archived` olur. Kalıcı silme yalnızca ayarlardan.
- `source_type` + `source_id`: bir kaydı üreten modül kaydına geri bağlantı (örneğin bir hazırlık işi → `school_assessment`). Çekirdek bu alanları yorumlamaz, yalnızca taşır.
- Tablolar arası başvurular `(id, user_id)` çiftiyle kurulur: bir satır yalnızca aynı hesabın satırına bağlanabilir (düz yabancı anahtar RLS'siz denetlenir).
- `events`, `ai_calls` ve `ai_feedback` yalnızca eklenir ve okunur; `inbox_entries` silinemez (izinler de böyle verilir). Öbür tablolarda dört işlem de açıktır.
- Aşağıda `null` yazmayan ama değeri sonradan dolan sütunlar (gün planı, haftalık taahhüt gibi planlayıcının yazdıkları) veritabanında boş geçilebilir; kayıt, değeri üreten faz gelmeden de açılabilmelidir.

## İş zarfı

Modüller çekirdek tablolara doğrudan yazmaz; çekirdeğe **iş zarfı** teklif eder (`propose`, bkz. `docs/06-modul-sozlesmesi.md`). Zarfın temel alanları her modülde aynıdır:

```json
{
  "schema": 1,
  "key": "assessment:8f2c…:prep",
  "source": { "type": "okul.assessment", "id": "8f2c…" },
  "title": "BBF301E Midterm hazırlığı",
  "when": {
    "due": "2026-11-12T10:00:00+03:00", "hard": true,
    "earliest": null,
    "recurrence": null,
    "fixed": null
  },
  "effort": { "total_minutes": null, "session_minutes": null, "bounds": { "min": 120, "max": 600 } },
  "fit": { "energy": "deep", "context": "desk" },
  "importance": 4,
  "depends_on": [],
  "flex": { "splittable": true, "droppable": false },
  "artifact": null,
  "meta": { "course_code": "BBF301E", "weight": 30, "scope": "Hafta 1–6" }
}
```

- `key` teklifin kimliğidir: aynı `module + key` ile gelen teklif yeni kayıt açmaz, mevcut kaydı günceller.
- `when` üç biçimden birini taşır: son tarih (`due`), tekrar (`recurrence`: `{count, period}`) ya da sabit zaman (`fixed`: `{starts_at, ends_at}`). Çekirdek bunları sırasıyla `work_items`, `rhythms` ve `blocks` tablolarına yazar.
- Modül bildiği olguyu doldurur; bilmediğini `null` bırakır. Boş kalan yargı alanlarını (efor, oturum süresi, gerekirse önem ve enerji) yapay zeka doldurur (`size` çağrısı, bkz. `docs/10-yapay-zeka.md`). Modül `effort.bounds` ile sınır verebilir.
- Her alanın kaynağı saklanır (`provenance`: `module`, `ai`, `user`, `default`). Kullanıcının değiştirdiği alanı ne modül ne yapay zeka ezer. `default`, çekirdeğin yapay zeka yokken yazdığı değerdir (eforda sınırın ortası); modül ya da yapay zeka onu ezebilir.
- `depends_on` başka zarfların `key` değerleridir: bağımlılığı bitmeyen kalem planlanmaz. Anahtarlar `depends_on_keys` içinde olduğu gibi saklanır; kayda çözülenler `depends_on` içindedir. Bağımlılık kendisinden sonra teklif edilirse çözüm o zaman tamamlanır.
- `key` üç hedef tabloda da saklanır (`work_items`, `rhythms`, `blocks`); her birinde `(module_id, key)` tekildir.
- `source.id` modülün kendi kaydının kimliğidir (`uuid`).
- `artifact` kalemin çıktısına bağlantıdır (dosya yolu ya da adres).

## Tablolar

### areas
Modülleri tek sayfada birleştiren grup.
```
slug text unique, name text, sort int
```

### modules
```
slug text unique              -- 'okul', 'beslenme'
name text
kind enum(lifelong, term, until_goal)
status enum(active, paused, archived)
area_id uuid null -> areas
weight numeric default 1      -- planlayıcıdaki önem çarpanı
weekly_floor_minutes int default 0   -- haftalık taban; Yoğun modda küçülür ama sıfırlanmaz
color text
starts_on date null, ends_on date null, end_condition text null
mode_behavior jsonb           -- { normal:{...}, busy:{...}, minimum:{...}, holiday:{...} }
settings jsonb
sort int
```

### work_items
İş kalemi: sonucu olan iş. Zarfın `due` biçimi buraya yazılır; kullanıcının elle eklediği çok adımlı işler de buradadır.
```
module_id -> modules
parent_id uuid null -> work_items      -- alt kalemler (proje → adımlar)
key text null                          -- modül teklifinin kimliği; (module_id, key) tekil
title text
status enum(proposed, active, waiting, done, dropped)
due_at timestamptz null, due_is_hard boolean default false
earliest_at timestamptz null
effort_total_minutes int null          -- toplam efor; uzak ufukta kapasite hesabı bununla yapılır
effort_done_minutes int default 0      -- biten oturumlardan
effort_min_minutes int null, effort_max_minutes int null   -- zarfın `effort.bounds` değeri; yapay zekanın tahmini bu aralıkta kalır
session_minutes int null               -- önerilen oturum uzunluğu
importance smallint default 2
energy enum(deep, light, physical), context enum(any, desk, home, campus, office, out, commute)
depends_on uuid[] default '{}'
depends_on_keys text[] default '{}'    -- zarftaki bağımlılık anahtarları; depends_on bunların kayda çözülmüş hali
splittable boolean default true, droppable boolean default false
artifact_url text null
provenance jsonb default '{}'          -- { "effort_total_minutes": "ai", "due_at": "module", "importance": "user" }
ai jsonb null                          -- yapay zekanın gerekçeleri ve güveni
source_type text null, source_id uuid null
meta jsonb default '{}'
```
Kurallar:
- `active` bir kalemin kalan eforu varsa ve haftası geldiyse en az bir `todo` oturum işi olmalı. Oturum işleri kalem haftalık plana girerken üretilir (bkz. `docs/04-planlayici.md`, "Plan ufukları").
- Kalan efor = `effort_total_minutes − effort_done_minutes`; sıfıra inince kalem kullanıcıya "bitti mi?" diye sorulur, kendiliğinden kapanmaz.
- `proposed` kalem yapay zekanın bölme önerisidir (`parent_id` altında, `decompose` ya da `enrich` adımları): kullanıcı kabul edene kadar planlanmaz ve Bugün'de görünmez; kabul edilince `active`, reddedilince `dropped` olur.
- Açık (`active` ya da `waiting`) alt kalemi olan kalem Bugün'de kendisi görünmez; alt kalemleri onun yerine geçer. Alt kalemlerin hepsi kapanınca kalem yeniden görünür ve kapatılmayı bekler.
- Planlayıcı gelene kadar (Ç3) oturum işi, kalemde "Başla" denince o an üretilir: uzunluğu `session_minutes`, yoksa kalan eforun 45 dakikayı geçmeyen kısmı. Oturum işi kalemin `source_type` ve `source_id` değerlerini taşır; modül kendi işini böyle tanır.
- Açık oturum işi (`todo`, `doing`, `waiting`) kalemin adını, son tarihini, önemini, enerji ve bağlamını, kalemde oturum süresi (`session_minutes`) doluysa onu da izler: kalem değişince (kullanıcının düzenlemesi ya da modülün yeni teklifi) veritabanı açık oturum işlerini de günceller (`sync_open_sittings` tetikleyicisi). Bitmiş ve bırakılmış oturum işleri eski değerleriyle kalır.

### tasks
Tek oturumda biten iş.
```
module_id -> modules
work_item_id uuid null -> work_items
title text
kind enum(task, prep, deadline, admin)
est_minutes int default 30 check (est_minutes between 5 and 90)
due_at timestamptz null
planned_date date null        -- planlayıcının ya da kullanıcının koyduğu gün
energy enum(deep, light, physical) default light
context enum(any, desk, home, campus, office, out, commute) default any
importance smallint default 2 check (importance between 1 and 4)
status enum(todo, doing, waiting, done, dropped) default todo
waiting_on text null          -- kimi ya da neyi bekliyor
follow_up_on date null
position int null             -- iş kalemi içindeki sıra; kalemin açık iki oturum işi aynı sırayı paylaşamaz (kısmi tekil indeks)
source_type text null, source_id uuid null
meta jsonb default '{}'       -- modüle özel küçük veriler
ai jsonb null                 -- yapay zekanın koyduğu alanlar, güven ve gerekçe; kullanıcının değiştirdikleri
done_at timestamptz null
defer_count int default 0     -- "Ertele" ile kaç kez ertelendi; 3 olunca planlayıcı uyarır
```
90 dakikadan uzun iş kaydedilemez; arayüz iş kalemine çevirmeyi önerir (toplam efor + oturumlar).

### rhythms
Tekrarlanan hedef. Belirli güne bağlı değildir.
```
module_id -> modules
key text null                 -- modül teklifinin kimliği; (module_id, key) tekil
title text
target_count int              -- dönem başına hedef
period enum(day, week, month)
floor_count int default 0     -- Yoğun modda bile korunan en az sayı
est_minutes int
energy enum(deep, light, physical)
context enum(any, desk, home, campus, office, out, commute)
active boolean default true
mode_targets jsonb null       -- { busy: 1, minimum: 0, holiday: 0 } gibi mod başına hedef
provenance jsonb default '{}'
source_type text null, source_id uuid null
meta jsonb default '{}'
```

### rhythm_logs
```
rhythm_id -> rhythms
done_on date
session_id uuid null -> sessions
```
Borç = dönemin hedefi − dönemdeki kayıt sayısı. Dönem bitince borç silinir; sonraki döneme taşınmaz.

### block_series
Haftalık tekrar eden sabit bloklar (ders programı, standart çalışma saatleri).
```
module_id uuid null -> modules
title text
kind enum(work, class, appointment, protected)
weekday smallint              -- 1 = Pazartesi
start_time time, end_time time
location text null
travel_before_min int default 0, travel_after_min int default 0
day_type enum(home, office, campus) null   -- bu blok günün tipini belirler
valid_from date, valid_to date null
source_type text null, source_id uuid null
```

### blocks
Somut sabit bloklar. Seriden üretilir ya da tek seferlik girilir.
```
series_id uuid null -> block_series
occurrence_on date null       -- serinin hangi günü için üretildi; blok taşınsa da değişmez
module_id uuid null -> modules
key text null                 -- modül teklifinin kimliği (zarfın `fixed` biçimi); (module_id, key) tekil
title text
kind enum(work, class, appointment, protected)
starts_at timestamptz, ends_at timestamptz
location text null
travel_before_min int default 0, travel_after_min int default 0
day_type enum(home, office, campus) null   -- seriden kopyalanır; günün tipini belirler
status enum(planned, cancelled, done) default planned
provenance jsonb default '{}' -- kullanıcının elle değiştirdiği alanlar
source_type text null, source_id uuid null
unique (series_id, occurrence_on)
```
Seriden üretilen blok elle değiştirilebilir ya da iptal edilebilir; yeniden üretim elle değiştirilmiş bloğu ezmez. Tekillik başlangıç saatine değil serinin gününe bağlıdır: saati elle değiştirilen blok için eski saat yeniden üretilmez. İptal edilen blok silinmez (`cancelled`), böylece yeniden üretilmez. Seri bitirilince (`valid_to`) gelecek blokları silinir, elle değiştirilmiş ve iptal edilmiş olanlar dahil: seri kullanıcının kaldırdığı bir kuraldır ve üretilmiş bloklar onun türevidir; geçmiş bloklar kalır. Modül arşivlenince ise bloklar silinmez, `cancelled` olur.

### sessions
Bir işe harcanan gerçek zaman.
```
task_id uuid null -> tasks
rhythm_id uuid null -> rhythms
module_id uuid null -> modules
title text null               -- plansız iş için ("Başka bir şey yapıyorum")
started_at timestamptz
ended_at timestamptz null
measured boolean default true -- false ise öğrenmeye girmez
confirmed_at timestamptz null -- "Devam ediyor musun?" sorusuna "devam" denen an
```
Aynı anda en fazla bir açık oturum olur (tekil indeks). Oturumlar dört veritabanı fonksiyonuyla yürür, hepsi çağıranın yetkisiyle: `close_unanswered_session` ("Devam ediyor musun?" sorusu 30 dakika cevapsız kalınca oturumu tahmini sürede, ölçülmemiş olarak kapatır; iş havuza döner, tahmin kalemin eforuna eklenir), `start_session` (iş, kalem, ritim ya da yalnızca başlıkla plansız iş; açık oturum varsa önce onu durdurur), `end_session` (`done`: iş biter ya da ritim kaydı düşer; `stopped`: iş havuza döner; iki durumda da süre kalemin `effort_done_minutes` değerine eklenir), `complete_task` (tek dokunuşla bitirme).

### days
Günün planı ve sonucu. `(user_id, date)` tekil.
```
date date
day_type enum(home, office, campus)   -- gün planlanırken türetilen tip (bloklardan; yoksa ayarlardaki)
life_mode enum(normal, busy, minimum, holiday)   -- gün planlanırken geçerli mod
started_at timestamptz null   -- günün ilk dokunuşu
finish_line time              -- bu saatten sonra derin iş önerilmez
top3 uuid[]                   -- günün 3 işi
plan jsonb                    -- planın özeti: yapay zekanın önerisi (`advice`), bugün ertelenenler (`skipped`), bütün günün yuva süresi (`slotMinutes`), kullanılabilir süre (`usableMinutes`), yapay zekaya günün planının soruldu mu (`aiAsked`). Yuvalar ve atamalar kaydedilmez: ekran planı her değişiklikte aynı fonksiyonla yeniden kurar
plan_source enum(closing, ai, auto)   -- kapanışta onaylandı / yapay zeka önerdi / yalnızca motor
plan_reasons jsonb null       -- yapay zekanın gerekçeleri ("neden?")
closed_at timestamptz null    -- akşam kapanışı yapıldıysa
closing_note text null
```

### week_plans
Haftalık taahhüt. `(user_id, week_start)` tekil.
```
week_start date
committed uuid[]              -- bu hafta üzerinde çalışılacak iş kalemleri
module_budgets jsonb          -- { "okul": 720, "ev": 90 } dakika
capacity_minutes int          -- haftanın kullanılabilir süresi
plan_source enum(closing, ai, auto)
reasons jsonb null
life_mode enum(normal, busy, minimum, holiday) null   -- taahhüdün yapıldığı mod; mod değişince hafta yeniden kurulur
shares jsonb default '{}'     -- { "<kalem id>": { "minutes": 180, "from": 60 } } kalemin bu haftaki payı ve taahhüt anındaki biten eforu
day_capacity jsonb default '{}'  -- { "2026-11-18": 420 } taahhüt anında kalan her günün kapasitesi; kayıp bununla ölçülür
```

### horizon_reviews
Ay ve dönem ufku için yük görünümü ve öneriler.
```
scope enum(month, term)
period_start date
load jsonb                    -- hafta hafta talep ve kapasite
proposals jsonb               -- öne çekme, mod, bırakma önerileri ve durumları
```

### life_mode_periods
```
mode enum(normal, busy, minimum, holiday)
starts_on date, ends_on date
note text null
```
Kayıt yoksa mod `normal`.

### inbox_entries
Ham girişler. Hiç silinmez; durumu değişir.
```
raw_text text
status enum(new, needs_confirm, routed, dismissed) default new
suggestion jsonb null         -- yönlendirici önerisi: [{module, type, fields, confidence}]
routed jsonb null             -- sonuç: oluşturulan kayıtların tipi ve id'leri
routed_at timestamptz null
```

### prompts
Olay sonrası tek soru ("derse girdin mi?").
```
module_id -> modules
kind text                     -- modülün tanımladığı tür: 'attendance', 'submitted'
question text
options jsonb                 -- [{value, label}]
subject_type text, subject_id uuid
ask_after timestamptz         -- bu andan sonra gösterilir
status enum(pending, answered, expired) default pending
answer jsonb null, answered_at timestamptz null
```
Aynı anda ekranda en fazla bir soru görünür. 24 saat cevaplanmayan soru akşam kapanışı kuyruğuna, 7 gün cevaplanmayan haftalık bakışa geçer.

### events
Modüller arası sinyal. Yalnızca eklenir.
```
type text                     -- 'school.assessment_dated', 'health.workout_done'
module_slug text
payload jsonb
occurred_at timestamptz default now()
```

### weekly_reviews
```
week_start date unique per user
summary jsonb                 -- yapay zekanın haftalık bakışı: özet, en çok 3 öneri, gerekirse mod önerisi (`review`; modüllerin raporlarından)
```

### planner_stats
Planlayıcının öğrendiği değerler.
```
key text unique per user      -- 'est_multiplier:okul:prep', 'capacity:office'
value numeric
sample_size int
```

### settings
Kullanıcı başına tek satır.
```
finish_line_default time
day_start_default time
capacity_factors jsonb        -- { home: 0.7, office: 0.4, campus: 0.5 } (başlangıç varsayımı)
slot jsonb                    -- { deep_min: 45, deep_max: 90, light_min: 15, break_min: 15 }
default_day_type enum(home, office, campus)
return_after_days int default 3
ai_enabled boolean default true
ai_monthly_budget_usd numeric default 5   -- 0: yapay zeka o ay kapalı; eksi olamaz
```

### ai_calls, ai_feedback
Yapay zeka çağrılarının kaydı ve kullanıcı düzeltmeleri. Tanımları `docs/10-yapay-zeka.md` içinde. İkisi de yalnızca eklenir.

## Türetilen değerler (tablo değil)

- **Gün tipi:** O günün bloklarındaki `day_type` değerinden; yoksa `settings.default_day_type`.
- **Hayat modu:** Günü kapsayan `life_mode_periods` kaydından.
- **Ritim borcu:** Dönem içindeki `rhythm_logs` sayısından.
- **Modül sağlığı (yolunda, dikkat, geride):** Modülün kendi fonksiyonundan (sözleşme).
