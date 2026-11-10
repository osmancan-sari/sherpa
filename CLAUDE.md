# Sherpa

Tek kullanıcılı, modüler bir hayat planlama uygulaması. Kullanıcının bütün alanlarındaki işleri tek havuzda toplar ve her an "şimdi ne yapmalıyım?" sorusuna tek bir cevap verir. Masaüstünde ikinci ekranda sürekli açık durur, telefondan da kullanılır.

## Önce oku

Kod yazmadan önce ilgili dokümanı oku. Dokümanla çelişen bir şey yapman gerekiyorsa dur ve sor; sessizce sapma.

| Konu | Dosya |
| --- | --- |
| Ne yapıyoruz, neden, ilkeler, kapsam | `docs/01-urun.md` |
| Yığın, klasör yapısı, bileşenler | `docs/02-mimari.md` |
| Çekirdek tablolar | `docs/03-veri-modeli.md` |
| Planlayıcı motoru (yuvalar, skor, kurallar) | `docs/04-planlayici.md` |
| Ekranlar, bileşenler, etkileşim | `docs/05-arayuz.md` |
| Bir modül çekirdeğe nasıl bağlanır | `docs/06-modul-sozlesmesi.md` |
| Fazlar ve kabul ölçütleri | `docs/07-yol-haritasi.md` |
| Notion'dan veri aktarımı | `docs/08-notion-aktarim.md` |
| Alınan kararlar, açık sorular | `docs/09-kararlar.md` |
| Yapay zeka katmanı: çağrılar, kurallar, maliyet | `docs/10-yapay-zeka.md` |
| Yayın, gizlilik, telefon ve ikinci ekran, eşitleme | `docs/11-yayin-ve-cihazlar.md` |
| Modül tasarımları | `docs/moduller/*.md` |

## Yığın

- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Supabase: Postgres, Auth, Realtime, Row Level Security
- Vercel'de yayın; telefonda PWA olarak ana ekrana eklenir
- Sunucu durumu için TanStack Query; Supabase Realtime değişiklikleri sorguları geçersiz kılar
- Tarih: date-fns + `tr` yereli; saat dilimi her yerde `Europe/Istanbul`
- Yapay zeka: Anthropic API, yalnızca sunucuda; hızlı model girişler için, planlama modeli günlük plan için (modeller ortam değişkeninden)
- Test: planlayıcı motoru için Vitest (saf fonksiyonlar)

Paket sürümlerini ezberden yazma; kurarken güncel kararlı sürümü kullan ve gerekirse resmi dokümana bak.

## Komutlar

Ön koşul: Docker Desktop açık, `.env.local` dolu (`.env.example`'dan), `npm run db:start` çalışmış.

| Komut | Ne yapar |
| --- | --- |
| `npm run check` | Kapı: tip denetimi, lint, biçim denetimi, birim testleri. Her commit'ten önce |
| `npm run check:full` | `check` + veritabanı testleri + üretim derlemesi + uçtan uca testler. Faz etiketinden önce |
| `npm run dev` | Geliştirme sunucusu, `http://127.0.0.1:3210` |
| `npm run build` / `npm run start` | Üretim derlemesi / derlemeyi 3210'da çalıştır |
| `npm run typecheck` | Rota tiplerini üretir (`next typegen`), sonra `tsc --noEmit` |
| `npm run lint` | ESLint (çekirdek → modül içe aktarım yasağı dahil) |
| `npm run format` / `npm run format:check` | Prettier: yaz / denetle |
| `npm run test` / `npm run test:watch` | Vitest birim testleri |
| `npm run test:db` | Veritabanı testleri: RLS, kısıtlar, fonksiyonlar, iş zarfı (yerel Supabase ister) |
| `npm run test:e2e` | Derler, sonra Playwright (3100 portu, yerel Supabase ve Mailpit ister) |
| `npm run db:start` / `db:stop` / `db:status` | Yerel Supabase (Docker) |
| `npm run db:new -- <ad>` | Yeni migration dosyası |
| `npm run db:migrate` | Bekleyen migration'ları yerel veritabanına uygular |
| `npm run db:reset` | Yerel veritabanını sıfırlar ve bütün migration'ları baştan uygular |
| `npm run db:types` | Yerel şemadan `src/lib/supabase/database.types.ts` üretir |
| `npm run db:push` | Migration'ları bağlı bulut projesine uygular (`supabase link` sonrası) |
| `npm run db:user` | `ALLOWED_EMAIL` hesabını oluşturur (yeni kayıt kapalı; hesap yalnızca böyle açılır) |
| `npm run icons` | Uygulama simgelerini yeniden üretir |

Faz ekran görüntüleri: PowerShell'de `$env:SHERPA_SHOTS = "c0"; npm run test:e2e` → `docs/ekran-goruntuleri/c0/`.

Yerelde giriş kodu e-postası gönderilmez; Mailpit'e düşer: `http://127.0.0.1:54324`.

## Mimari kurallar

- **Çekirdek modülleri tanımaz.** `src/core/` içinde hiçbir dosya `src/modules/*` içe aktarmaz. Modüller çekirdeğe yalnızca `docs/06-modul-sozlesmesi.md` içindeki sözleşmeyle bağlanır ve `src/modules/registry.ts` üzerinden kaydolur.
- **Planlayıcı saf fonksiyondur.** `src/core/planner/` veritabanına, saate ya da ağa dokunmaz; girdisi veri, çıktısı plandır. Şimdiki zaman parametre olarak verilir. Her kural için test yazılır.
- **Her tabloda `user_id` ve RLS vardır.** Uygulama tek kullanıcılı olsa da RLS'siz tablo açılmaz.
- **Şema değişikliği yalnızca migration ile yapılır.** Migration'dan sonra TypeScript tipleri yeniden üretilir.
- **Yapay zeka önerir, motor uygular.** Yapay zeka süreyi, önceliği ve günün planını önerip veriye yazar; kısıtları ve "şimdi" seçimini motor yapar. API anahtarı yokken, çağrı başarısız olduğunda ya da aylık bütçe dolduğunda her özellik çalışmaya devam etmelidir (bkz. `docs/10-yapay-zeka.md`).
- **Yapay zeka çağrıları tek geçitten geçer.** `src/core/ai/` dışında hiçbir yerden API çağrılmaz; anahtar istemciye gitmez; her çağrı `ai_calls` tablosuna kaydedilir.
- **İyimser arayüz.** Dokunuşlar anında yansır, yazma arkada yapılır, hata olursa geri alınır.

## Ürün kuralları (pazarlık dışı)

1. Her giriş en fazla 2 dokunuş ya da tek cümledir.
2. Seri sayacı, kırmızı "gecikti" yığını, suçluluk üreten hiçbir öğe yoktur. Kaçan iş sessizce yeniden planlanır.
3. Sistem hiçbir ritüele bağımlı değildir: kullanıcı hiçbir şey girmese de Bugün ekranı doğru işi gösterir.
4. Günün bir bitiş çizgisi vardır: planlanan işler bitince ekran "Bugün tamam" der.
5. Sabit haftalık program üretilmez. Takvimde yalnızca sabit bloklar durur; geri kalan her şey esnek havuzdadır.
6. Ölçülemeyen durum takip edilmez (çamaşır, bulaşık); ona ayrılan zaman takip edilir.

## Çalışma şekli

- İki hat vardır: çekirdek (Ç0–Ç5) ve modüller. Çekirdek fazları `docs/07-yol-haritasi.md` içindeki sırayla ilerler; bir fazın kabul ölçütleri sağlanmadan sonrakine geçme.
- Çekirdek fazlarında hiçbir gerçek modül kurulmaz; sınama `deneme` modülü ve örnek veriyle yapılır.
- Fazın kapsamı dışında özellik ekleme. Aklına gelen iyileştirmeyi `docs/09-kararlar.md` altındaki "Fikirler" listesine yaz.
- Tasarımı henüz onaylanmamış modülleri kurma (`docs/moduller/` içinde "taslak" ya da "bekliyor" yazanlar).
- Her fazın sonunda: testler geçer, `CLAUDE.md` komutları günceldir, `docs/ILERLEME.md` güncellenir.
- Her çekirdek fazı ayrı bir oturumda yapılır; bir oturumda tek faz. Kurallar `prompts/BASLA.md` içindedir: ne zaman durulur, duraklarda ne yapılır, ilerleme nasıl kaydedilir.

## Dil

- Arayüz metinleri Türkçe. Kod, tablo ve sütun adları, commit mesajları İngilizce.
- Arayüz metinleri kısa ve düz olur; ünlem, emoji, övgü yok.
