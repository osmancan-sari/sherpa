# Mimari

## Genel resim

```
İkinci ekran (tarayıcı)  ─┐
                          ├─►  Next.js uygulaması (Vercel)  ◄──►  Supabase (Postgres + Auth + Realtime)
Telefon (PWA)            ─┘            │
                                       ├─ /api/ai   ──►  Anthropic API (tahmin, yönlendirme, plan önerisi)
                                       └─ /api/mcp  ◄──  Claude sohbetleri ve ders projeleri (Ç5)
```

- Bütün veri Supabase'de durur. İki cihaz aynı uygulamayı açar; Realtime sayesinde birinde yapılan değişiklik diğerine saniyeler içinde yansır.
- Planlayıcı motoru tarayıcıda çalışan saf TypeScript'tir. Sunucuya ya da yapay zekaya sormadan "şimdi" işini hesaplar; bu yüzden ekran her zaman günceldir.
- Yapay zeka sunucu tarafında çalışır: girişlerden süre ve öncelik tahmin eder, serbest metni yönlendirir, her gece yarının planını önerir. Önerdiklerini veriye yazar; motor o veriyle çalışır.
- Ayrıca kullanıcının Claude sohbetleri bir MCP sunucusu üzerinden Sherpa'yı okur ve yazar (Ç5).

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
      m/[slug]/             modül sayfası
      a/[slug]/             alan sayfası
      ayarlar/
    api/
      ai/                   enrich, extract, plan, replan, review
      mcp/                  Ç5
  core/                     modüllerden bağımsız çekirdek
    planner/                saf fonksiyonlar + testler (Ç3)
    ai/                     tek geçit: istemler, şemalar, bütçe, kayıt (Ç2)
    contract/               modül sözleşmesi: tipler, kayıt, iş zarfının saf kuralları
    data/                   sorgular, mutasyonlar, realtime
    events/                 olay yayını ve abonelik
    intake/                 hızlı giriş, gelen kutusu, yönlendirme
    today/                  planlayıcı gelene kadar Bugün ekranının saf seçim kuralları
    ui/                     NowCard, DayStrip, ModuleChip, QuickAdd...
    testing/                testler için satır üreticileri
  modules/
    registry.ts             kayıtlı modüller
    okul/                   module.ts, queries.ts, rules.ts, components/, page.tsx
    _sablon/                yeni modül için kopyalanacak iskelet
  lib/                      supabase istemcisi, tarih yardımcıları
supabase/
  migrations/
scripts/
  import-notion.ts
data/
  notion-export/            aktarım için JSON dosyaları (git'e girmez)
docs/
```

Kural: `src/core/` hiçbir zaman `src/modules/*` içe aktarmaz.

## Ortamlar

- İki Supabase projesi: `dev` ve `prod`. Migration'lar önce `dev`'e uygulanır.
- Gizli anahtarlar `.env.local` ve Vercel ortam değişkenlerinde; depoya girmez.
- Supabase servis anahtarı yalnızca sunucu tarafında kullanılır. Kullanıcının bilgisayarında çalışan betikler (Ninova toplayıcısı) servis anahtarı taşımaz; `/api/ingest/*` rotasına iptal edilebilir bir cihaz belirteciyle yazar.

## Kimlik ve güvenlik

- Tek kullanıcı: giriş yapabilecek e-posta bir ortam değişkeninde tutulur (`ALLOWED_EMAIL`); başka e-posta ile giriş reddedilir.
- Her tabloda `user_id uuid not null default auth.uid()` ve `user_id = auth.uid()` RLS politikası.
- Oturum uzun ömürlü olmalı: ikinci ekran günlerce açık kalır. Yenileme belirteci otomatik yenilenir; oturum düşerse ekran sessizce giriş sayfasına döner.

## Canlı güncelleme

- Realtime abonelikleri: `tasks`, `sessions`, `blocks`, `rhythm_logs`, `days`, `inbox_entries`, `events`; ayrıca ekranda görünen öbür çekirdek tablolar: `modules`, `work_items`, `rhythms`, `block_series`, `prompts`, `settings`.
- İkinci ekran sekmesi arka planda kalsa bile güncel kalmalı: görünürlük geri geldiğinde ve dakikada bir "şimdi" yeniden hesaplanır.

## Telefon

- PWA: manifest, simgeler, tam ekran açılış. Bağlantısızken son plan görünür ve üç işlem kuyruğa alınır (Ç4); ayrıntı `docs/11-yayin-ve-cihazlar.md`.
- Sesle giriş için ayrı bir özellik yazılmaz: telefon klavyesinin dikte özelliği hızlı giriş kutusunda çalışır.
- Bildirim: v1'de yok. Web push Ç4'te denenir; çalışmazsa telefonun kendi takvim alarmı yedek kalır (bkz. açık sorular).

## Yapay zeka

İki ayrı bağlantı vardır:

1. **Yapay zeka katmanı (Ç2 ve Ç3).** Sunucudan Anthropic API'ye yapılan çağrılar: `enrich` (giriş → iş), `extract` (duyuru → tarih önerisi), `plan` ve `replan` (gün planı önerisi), `review` (haftalık). Kurallar, çağrı tablosu ve maliyet `docs/10-yapay-zeka.md` içindedir. Özet: yapay zeka önerir ve veriye yazar, motor kısıtları denetler ve günü yürütür; anahtar yokken ya da bütçe dolunca uygulama motorla çalışmaya devam eder.
2. **Claude köprüsü (Ç5).** `/api/mcp` altında uzak bir MCP sunucusu. Kullanıcı bunu Claude hesabına özel bağlayıcı olarak ekler; böylece herhangi bir Claude sohbeti, özellikle ders projeleri, Sherpa'yı okuyup günceller. Bu yol API bütçesini kullanmaz; kullanıcının Claude aboneliğiyle çalışır.

## Zamanlanmış işler

Vercel Cron ile, hepsi idempotent:

- Her gece: yarının sabit bloklarını tekrar kurallarından üret, biten ritim dönemlerini kapat (borç sıfırlanır), süresi geçen olay sorularını akşam kapanışı kuyruğuna al; ardından yarın için `plan` çağrısını yap.
- Cumartesi sabahı: haftalık özet kaydını üret (`weekly_reviews`) ve `review` çağrısını yap.

## Yedek

- Supabase'in günlük yedeği.
- Ayarlar sayfasında "Tümünü dışa aktar" (JSON). Veri hiçbir zaman uygulamaya kilitli kalmaz.

## Performans hedefleri

- Bugün ekranı ilk açılışta 2 saniyenin altında.
- Bir dokunuşun ekrana yansıması anında (iyimser güncelleme).
- Planlayıcının bir günü yeniden kurması 50 ms'nin altında (yüzlerce iş için).
