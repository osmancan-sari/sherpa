# Mimari

## Genel resim

```
İkinci ekran (tarayıcı)  ─┐
                          ├─►  Next.js uygulaması (Vercel)  ◄──►  Supabase (Postgres + Auth + Realtime)
Telefon (PWA)            ─┘            │
                                       ├─ /api/ai     ──►  Anthropic API (tahmin, yönlendirme, plan önerisi)
                                       ├─ /api/ingest ◄──  telefonun otomasyonu, bilgisayardaki toplayıcı (cihaz anahtarıyla, Ç3d)
                                       ├─ /api/jobs   ◄──  zamanlayıcı (Supabase pg_cron, 15 dakikada bir; Ç3d)
                                       └─ /api/mcp    ◄──  Claude sohbetleri ve ders projeleri (Ç5)
```

- Bütün veri Supabase'de durur. İki cihaz aynı uygulamayı açar; Realtime sayesinde birinde yapılan değişiklik diğerine saniyeler içinde yansır.
- Planlayıcı motoru tarayıcıda çalışan saf TypeScript'tir. Sunucuya ya da yapay zekaya sormadan "şimdi" işini hesaplar; bu yüzden ekran her zaman günceldir.
- Yapay zeka sunucu tarafında çalışır: girişlerden süre ve öncelik tahmin eder, serbest metni yönlendirir, her gece yarının planını önerir. Önerdiklerini veriye yazar; motor o veriyle çalışır.
- Ayrıca kullanıcının Claude sohbetleri bir MCP sunucusu üzerinden Sherpa'yı okur ve yazar (Ç5).
- Uygulama kapalıyken de çalışan taraf (Ç3d): dış kaynaklar giriş ucuna cihaz anahtarıyla yazar, modüllerin ve çekirdeğin zamanlanmış işleri sunucuda döner. İkisi de modül bağlamının sunucu sürümüyle, yalnızca o kullanıcının satırlarına erişerek çalışır.

## Yığın

| Katman | Seçim | Not |
| --- | --- | --- |
| Uygulama | Next.js (App Router), TypeScript strict | Kullanıcının bildiği yığın (başka projesinde aynı) |
| Arayüz | Tailwind, shadcn/ui | Açık ve koyu tema |
| Veri | Supabase Postgres | RLS açık |
| Kimlik | Supabase Auth: e-postaya tek kullanımlık kod ya da geçiş anahtarı | Tek kullanıcı, yeni kayıt kapalı. Sihirli bağlantı kullanılmaz (telefondaki kurulu uygulamada çalışmaz) |
| Canlı güncelleme | Supabase Realtime | Çekirdek tablolar için |
| İstemci verisi | TanStack Query | Realtime olayı ilgili sorguyu geçersiz kılar |
| Tarih | date-fns, `tr` yereli | Saat dilimi `Europe/Istanbul` |
| Yapay zeka | Anthropic API (sunucuda) | Hızlı model girişler, planlama modeli günlük plan için; ayrıntı `docs/10-yapay-zeka.md` |
| Test | Vitest | Planlayıcı için zorunlu |
| Yayın | Vercel | `main` → üretim, dallar → önizleme |

## Klasör yapısı

```
src/
  app/                      Next.js rotaları
    (app)/                  oturum gerektiren kabuk
      page.tsx              Bugün
      hafta/
      gelen/
      kapanis/
      m/[slug]/[[...path]]/ modül sayfası, sekmeleri, alt sayfaları
      a/[slug]/             alan sayfası
      ayarlar/              moduller/, bloklar/
    (tam)/                  kabuksuz yerleşim: m/[slug]/tam/[key] (modülün tam ekran görünümü)
    api/
      export/               "Tümünü dışa aktar" (JSON)
      ai/                   enrich, extract, plan, replan, review
      ingest/[source]/[kind]/  dış kaynakların yazma ucu (Ç3d)
      jobs/tick/            zamanlayıcının tek ucu (Ç3d)
      mcp/                  Ç5
  core/                     modüllerden bağımsız çekirdek
    planner/                saf fonksiyonlar + testler (Ç3)
    ai/                     tek geçit: istemler, şemalar, bütçe, kayıt (Ç2)
    contract/               modül sözleşmesi: tipler, kayıt, iş zarfının saf kuralları
    app/                    istemci tarafı: sorgu önbelleği, canlı bağlantı (Realtime), saat, iyimser yazmalar
    data/                   sorgular ve yazmalar (Supabase istemcisini parametre alır; tarayıcıda ve sunucuda aynı)
    events/                 olay yayını ve abonelik
    jobs/                   zamanlanmış işlerin saf kuralları: dönem, sırası gelen işler (Ç3d)
    server/                 yalnızca sunucuda: kullanıcı adına veritabanı erişimi (tek yardımcı), giriş ucu, işlerin çalıştırıcısı (Ç3d)
    intake/                 hızlı giriş, gelen kutusu, yönlendirme
    today/                  planlayıcı gelene kadar Bugün ekranının saf seçim kuralları
    ui/                     NowCard, DayStrip, ModuleChip, QuickAdd...
    testing/                testler için satır üreticileri
  modules/
    registry.ts             kayıtlı modüller
    okul/                   module.ts, queries.ts, rules.ts, ingest.ts, jobs.ts, components/, README.md
    _sablon/                yeni modül için kopyalanacak iskelet
    deneme/                 çekirdeğin sınandığı modül; yalnızca NEXT_PUBLIC_SHERPA_DEMO_MODULE=1 iken kaydolur
  lib/                      supabase istemcisi, tarih yardımcıları
supabase/
  migrations/
scripts/
  seed-demo.ts              yerel hesaba örnek veri (demo-data.ts); yalnızca yerel Supabase
  import-notion.ts
data/
  notion-export/            aktarım için JSON dosyaları (git'e girmez)
docs/
```

Kural: `src/core/` hiçbir zaman `src/modules/*` içe aktarmaz.

## Ortamlar

- İki Supabase projesi: `dev` ve `prod`. Migration'lar önce `dev`'e uygulanır.
- Gizli anahtarlar `.env.local` ve Vercel ortam değişkenlerinde; depoya girmez.
- Supabase gizli anahtarı (`SUPABASE_SECRET_KEY`) yalnızca sunucu tarafında ve uygulamada yalnızca `src/core/server/db.ts` içinde kullanılır (aşağıda "Sunucuda kullanıcı adına erişim"). Kullanıcının bilgisayarında çalışan betikler (Ninova toplayıcısı) ve telefonun otomasyonu bu anahtarı taşımaz; `/api/ingest/*` rotasına iptal edilebilir bir cihaz anahtarıyla yazar.
- Zamanlayıcı ucunun sırrı `CRON_SECRET`: Vercel ortam değişkeninde ve Supabase Vault'ta (`sherpa_cron_secret`) aynı değer.

## Kimlik ve güvenlik

- Tek kullanıcı: giriş yapabilecek e-posta bir ortam değişkeninde tutulur (`ALLOWED_EMAIL`); başka e-posta ile giriş reddedilir.
- Her tabloda `user_id uuid not null default auth.uid()` ve `user_id = auth.uid()` RLS politikası.
- Oturum uzun ömürlü olmalı: ikinci ekran günlerce açık kalır. Yenileme belirteci otomatik yenilenir; oturum düşerse ekran sessizce giriş sayfasına döner.
- Oturumsuz yalnızca iki uç cevap verir: giriş ucu (`/api/ingest/*`, cihaz anahtarıyla) ve zamanlayıcı ucu (`/api/jobs/tick`, `CRON_SECRET` ile). Geçit (`proxy`) bu ikisini kendi denetimlerine bırakır; ikisi de anahtarsız istekte 401 verir ve hiçbir uç veri döndürmez.

### Cihaz anahtarları ve giriş ucu (Ç3d)

- Anahtar Ayarlar → Bağlantılar'da üretilir: `shp_` + 32 rastgele bayt (base64url). Tarayıcıda üretilir ve yalnızca bir kez gösterilir; veritabanına yalnızca SHA-256 özeti yazılır (`device_tokens.token_hash`). Anahtar hiçbir günlüğe, hata iletisine, `events` ya da `ingest_requests` kaydına yazılmaz.
- Her anahtarın kapsamı vardır: yazabildiği uçların listesi, adresle aynı biçimde (`core/wake`, `deneme/kayit`). Anahtar yalnızca yazar; hiçbir uç veri döndürmez.
- İstek: `POST /api/ingest/<kaynak>/<tür>`, `Authorization: Bearer <anahtar>`, JSON gövde, isteğe bağlı `Idempotency-Key`. Denetim sırası ve cevaplar: anahtar yok, tanınmıyor ya da iptal edilmiş → 401; tür yok → 404; kapsam dışı → 403; modül etkin değil → 409; hız sınırı (anahtar başına dakikada 20 istek) → 429; bozuk gövde → 400 (alanın adıyla); aynı `Idempotency-Key` daha önce işlendiyse → 200 ve `duplicate: true` (ikinci kez işlenmez), hâlâ işleniyorsa → 409; işleyici hata verirse → 500 (aynı anahtarla yeniden denenebilir); başarı → 200.
- Kimliği doğrulanmış her istek `ingest_requests` tablosuna yazılır (tür, sonuç, hata adı; gövde yazılmaz). Hız sınırı bu kayıttan sayılır.

### Sunucuda kullanıcı adına erişim (Ç3d)

Giriş ucunun ve zamanlanmış işlerin tarayıcı oturumu yoktur. Sunucu işi kimin adına yaptığını bilir (anahtarın sahibi, işin hesabı) ve veritabanına o kullanıcı olarak gider:

- `src/core/server/db.ts` tek yardımcıdır. Gizli anahtarla bir istemci kurar ve her isteğe `x-sherpa-user: <kullanıcı>` başlığını ekler. Veritabanının istek öncesi fonksiyonu (`public.sherpa_pre_request`, PostgREST `db_pre_request`) bu başlığı yalnızca gizli anahtarla gelen istekte okur ve isteği o kullanıcıya çevirir: rol `authenticated`, `auth.uid()` o kullanıcı. Böylece RLS, `user_id default auth.uid()` ve `auth.uid()` kullanan fonksiyonlar tarayıcıdakiyle aynı çalışır; başka hesabın satırı görünmez. Başlık geçersizse istek reddedilir.
- Yardımcı istemciyi vermeden önce dönüşümü doğrular (`sherpa_acting_user()` beklenen kullanıcıyı döndürmezse hata): istek öncesi fonksiyon bir ortamda eksikse istek tam yetkiyle değil, hiç çalışmaz.
- Gizli anahtarın başlıksız kullanıldığı yalnızca iki yer vardır, ikisi de aynı dosyada ve ikisi de kullanıcı verisi okumaz: anahtarın sahibini özetinden bulmak (`device_token_owner`) ve işlerin hangi hesaplar için çalışacağını bulmak (`job_users`). Bu iki fonksiyon yalnızca gizli anahtara açıktır.
- Sınırı tutan testler: başka hesabın satırına erişilemediği, varsayılanların ve fonksiyonların çalıştığı, bozuk başlığın reddedildiği (`tests/db/server.test.ts`); gizli anahtarın uygulamada başka dosyada geçmediği (`tests/unit/server-boundary.test.ts`).

## Canlı güncelleme

- Realtime abonelikleri: `tasks`, `sessions`, `blocks`, `rhythm_logs`, `days`, `inbox_entries`, `events`; ayrıca ekranda görünen öbür çekirdek tablolar: `modules`, `work_items`, `rhythms`, `block_series`, `prompts`, `settings`, `device_tokens` (Ç3d: Ayarlar'daki son kullanım).
- İkinci ekran sekmesi arka planda kalsa bile güncel kalmalı: görünürlük geri geldiğinde ve dakikada bir "şimdi" yeniden hesaplanır.

## Telefon

- PWA: manifest, simgeler, tam ekran açılış. Bağlantısızken son plan görünür ve üç işlem kuyruğa alınır (Ç4); ayrıntı `docs/11-yayin-ve-cihazlar.md`.
- Sesle giriş için ayrı bir özellik yazılmaz: telefon klavyesinin dikte özelliği hızlı giriş kutusunda çalışır.
- Bildirim: v1'de yok. Web push Ç4'te denenir; çalışmazsa telefonun kendi takvim alarmı yedek kalır (bkz. açık sorular).

## Yapay zeka

İki ayrı bağlantı vardır:

1. **Yapay zeka katmanı (Ç2 ve Ç3).** Sunucudan Anthropic API'ye yapılan çağrılar: `enrich` (giriş → iş), `extract` (duyuru → tarih önerisi), `plan` ve `replan` (gün planı önerisi), `review` (haftalık). Kurallar, çağrı tablosu ve maliyet `docs/10-yapay-zeka.md` içindedir. Özet: yapay zeka önerir ve veriye yazar, motor kısıtları denetler ve günü yürütür; anahtar yokken ya da bütçe dolunca uygulama motorla çalışmaya devam eder.
2. **Claude köprüsü (Ç5).** `/api/mcp` altında uzak bir MCP sunucusu. Kullanıcı bunu Claude hesabına özel bağlayıcı olarak ekler; böylece herhangi bir Claude sohbeti, özellikle ders projeleri, Sherpa'yı okuyup günceller. Bu yol API bütçesini kullanmaz; kullanıcının Claude aboneliğiyle çalışır.

## Zamanlanmış işler (Ç3d)

Tek uç: `POST /api/jobs/tick` (`Authorization: Bearer <CRON_SECRET>`). Her çağrıda her hesap için sırası gelen işleri çalıştırır: çekirdeğin işleri ve etkin modüllerin `jobs` listesi (`docs/06-modul-sozlesmesi.md`). Her çalışma `job_runs`'a yazılır (iş, dönem, başlangıç, bitiş, sonuç, hata).

- **Dönem.** `hour`: İstanbul saatiyle her saat; `day`: her gün, `at` saatinden sonra (yoksa 00:00); `week`: her hafta Pazartesi, `at` saatinden sonra. Bir dönem için iş bir kez çalışır; kaçan dönem sonraki çağrıda bir kez çalışır, geçmiş dönemler tek tek yeniden çalıştırılmaz.
- **Tekillik.** `job_runs` (hesap, iş, dönem) tekildir: aynı anda gelen iki çağrıdan yalnızca biri çalıştırır. Hata veren iş sonraki çağrıda yeniden denenir (dönem başına en çok 3 deneme); 30 dakikadan uzun süren "çalışıyor" kaydı da yeniden denenebilir. İşin kendisi de idempotent yazılır.
- **Tetikleyici.** Supabase'in zamanlayıcısı (`pg_cron` + `pg_net`) 15 dakikada bir `public.sherpa_tick()` çalıştırır; o da uygulamanın adresini ve sırrı Vault'tan okuyup ucu çağırır (Vault'ta değer yoksa hiçbir şey yapmaz: yerelde ve kurulmamış projede). Yedek olarak Vercel Cron günde bir kez aynı ucu çağırır (`vercel.json`). Gerekçe: Vercel'in ücretsiz katmanı (Hobby) zamanlayıcıyı günde bire ve ±59 dakikalık hassasiyete sınırlar (Kasım 2026); saatlik işlere yetmez. Supabase'in zamanlayıcısı ücretsiz projelerde de vardır; 15 dakikada bir çağrı ayda yaklaşık 2 900 işlev çağrısıdır.
- **Çekirdeğin işleri:** `core/week` (her gün 00:15: haftanın taahhüdü yoksa ya da bir tetikleyici çalıştıysa kurar; yapay zeka açıksa önerisiyle), `core/blocks` (her gün 00:30: haftalık serilerin önümüzdeki 8 haftalık bloklarını üretir), `core/sessions` (her saat: "Devam ediyor musun?" sorusu cevapsız kalan oturumu tahminiyle kapatır). Tarayıcıdaki bekçi aynı işleri uygulama açıkken yapmayı sürdürür; ikisi aynı fonksiyonları kullanır ve idempotenttir.
- Ritim dönemlerinin kapanması iş değildir: borç `rhythm_logs`'tan her okumada hesaplanır. Yarın için `plan` çağrısı ve Cumartesi `review` şimdilik uygulama açılınca bekçiyle yapılır (sunucuya taşınması `docs/09` "Fikirler").

## Yedek

- Supabase'in günlük yedeği.
- Ayarlar sayfasında "Tümünü dışa aktar" (JSON): `/api/export`, kullanıcının kendi yetkisiyle bütün çekirdek tabloları ve kayıtlı modüllerin `tables` listesindeki tabloları okur. Veri hiçbir zaman uygulamaya kilitli kalmaz.

## Performans hedefleri

- Bugün ekranı ilk açılışta 2 saniyenin altında.
- Bir dokunuşun ekrana yansıması anında (iyimser güncelleme).
- Planlayıcının bir günü yeniden kurması 50 ms'nin altında (yüzlerce iş için).
