# İlerleme

Bu dosyayı Claude Code günceller. Yeni bir oturum yalnızca bu dosyayı ve `prompts/BASLA.md` dosyasını okuyarak kaldığı yerden devam edebilmelidir.

## Durum

- Faz: Ç0 (İskelet), sürüyor
- Adım: 8 / 8 (faz denetimi ve etiket). 1–7 bitti: kod, yerel Supabase, kimlik, kabuk, PWA, birim ve uçtan uca testler
- Kalan: faz kipinde denetim, bulguların düzeltilmesi, faz raporunun "Biten fazlar"a taşınması, `c0-tamam` etiketi
- Son commit: kimlik adımı denetiminin düzeltmeleri (oturum testleri, 8 haneli ve 10 dakikalık giriş kodu) ve Ç0 ekran görüntüleri

### Ç0 planı

1. Next.js + TypeScript strict + Tailwind + shadcn/ui; ESLint (çekirdek → modül içe aktarım yasağı dahil) ve Prettier
2. Klasör yapısı (`docs/02-mimari.md`), `src/modules/registry.ts` boş kayıt
3. Yerel Supabase (`supabase init`, `config.toml`: yeni kayıt kapalı, e-posta kodu şablonu), boş migration, tip üretimi
4. Kimlik: `/giris` (e-posta → kod), `ALLOWED_EMAIL` denetimi, `proxy` ile sayfa ve API koruması, uzun ömürlü oturum
5. Uygulama kabuğu: gezinme (Bugün, Hafta, Modüller, Gelen kutusu, Ayarlar), açık ve koyu tema, boş sayfalar
6. PWA manifesti ve simgeler, `noindex`
7. Vitest (örnek test + lint kuralı testi), Playwright (giriş, koruma, oturum, ekran görüntüleri)
8. Kabul ölçütleri, `CLAUDE.md` komutları, faz raporu, `c0-tamam` etiketi

Migration: yalnızca boş bir başlangıç migration'ı (çekirdek tablolar Ç1'de).

### Ç0 kabul ölçütleri (şu anki durum)

| Ölçüt | Durum | Kanıt |
| --- | --- | --- |
| Üretim adresinde izinli e-postayla giriş yapılıyor; başka e-posta reddediliyor | Yerelde otomatik doğrulandı; üretimde **elle doğrulanacak** (D1 bekliyor) | `tests/e2e/login.spec.ts`, `tests/e2e/session.spec.ts` (üretim derlemesi + yerel Supabase). Üretim adresi henüz yok |
| Telefonda ana ekrana eklenince tam ekran açılıyor ve giriş uygulamanın içinde kodla yapılabiliyor | **Elle doğrulanacak** (D2 bekliyor) | Hazırlık otomatik sınanıyor: manifest (`display: standalone`), simgeler, `apple-touch-icon`, kodun uygulama içinde yazıldığı giriş akışı, telefon genişliğinde kabuk (`guard.spec.ts`, `shell.spec.ts`). Gerçek telefonda denenmedi |
| Giriş yapılmadan hiçbir sayfa ve API rotası veri döndürmüyor | Otomatik doğrulandı (yerelde) | `tests/e2e/guard.spec.ts` (sayfalar 307 → `/giris`, API 401, uydurma çerez), `tests/e2e/session.spec.ts` (başka hesabın gerçek oturumu, yenilenemeyen oturum) |
| `lint`, `test`, `build` komutları geçiyor ve `CLAUDE.md`'de yazılı | Otomatik doğrulandı | `npm run check:full` yeşil; `CLAUDE.md` "Komutlar" |
| Boş bir migration `dev`'e uygulanıp tipler üretilebiliyor | Yerel veritabanında doğrulandı; bulut `dev` projesinde **elle doğrulanacak** (D1 bekliyor) | `supabase/migrations/20261110184021_init.sql`; `npm run db:migrate` ve `npm run db:types` yerelde çalışıyor, üretilen tipler depodakiyle aynı. Bulut `dev` projesi henüz yok |

## Biten fazlar

Henüz yok.

## Sıradaki adım

Ç0'ı faz kipinde denetlet, bulguları düzelt, faz raporunu yaz ve `c0-tamam` etiketini at.

## Senden bekleyenler

### D1. Bulut ve yayın (Ç0'ın kodu hazır; sıra sende)

O zamana kadar her şey yerel Supabase ile çalışıyor. Aşağıdakileri yapınca yeni oturumda geri kalanını (projeleri açma, şema ve kimlik ayarlarını aktarma, hesabı oluşturma, Vercel ortam değişkenleri, yayın, üretimde giriş ve koruma denemesi) ben komut satırından yaparım.

1. **Supabase.** Hesabın yoksa aç (ücretsiz plan yeter; iki proje hakkı gerekiyor: `sherpa-dev` ve `sherpa-prod`). İki adımlı doğrulamayı aç. Sonra depo klasöründe PowerShell'de `npx supabase login` yaz ve tarayıcıda onayla.
2. **Vercel.** Hesabın yoksa aç (Hobby planı yeter), iki adımlı doğrulamayı aç. PowerShell'de `npx vercel login` yaz ve tarayıcıda onayla.
3. **GitHub.** Özel (private) ve boş bir `sherpa` deposu aç; adresini aşağıdaki dosyaya yaz. Depoyu Vercel'e bağlamak için Vercel'in GitHub uygulamasına bu depo için izin vermen istenecek (tarayıcıda bir onay).
4. **Bilgiler.** Depo kökünde `.env.d1` adında bir dosya aç (`.env*` deseni sayesinde depoya girmez) ve şunları yaz:
   ```
   ALLOWED_EMAIL=giriş yapacağın e-posta
   SHERPA_ADDRESS=kalıcı adres (örnek: sherpa-xxxx.vercel.app ya da kendi alan adın)
   GITHUB_REPO=https://github.com/<kullanıcı>/sherpa
   ```
   - `ALLOWED_EMAIL` Supabase hesabının e-postasıyla aynı olursa en kolayı: bildiğim kadarıyla Supabase'in hazır e-posta göndericisi yalnızca kuruluş üyelerinin adreslerine gönderir ve saatte birkaç e-postayla sınırlıdır (kurulumda güncel dokümandan doğrulayacağım). Başka bir adres istersen ayrıca bir SMTP hizmeti gerekir; adımlarını o zaman yazarım.
   - Kalıcı adres telefona kurulumdan önce kesinleşmeli; sonradan değişirse telefondaki uygulama yeniden kurulur.
5. Bu maddenin başlığına "tamamlandı" yaz.

Benim yapacaklarım (D1 tamamlanınca): iki Supabase projesini açmak (bölge: Frankfurt), migration'ı önce `dev`'e sonra `prod`'a uygulamak, kimlik ayarlarını aktarmak (yeni kayıt kapalı, 8 haneli ve 10 dakikalık kod, kod şablonu), `ALLOWED_EMAIL` hesabını oluşturmak, dalı `main` yapıp GitHub'a göndermek, Vercel projesini bağlamak ve ortam değişkenlerini girmek, yayınlamak, önizleme dağıtımlarının korumasını doğrulamak, üretim adresinde giriş ve koruma sınamalarını yinelemek. Bu işlemlerin ücretsiz katmanda kalması bekleniyor; ücret çıkaran bir adım görürsem durup sorarım.

### D2. Telefon (D1'den sonra)

1. iPhone'da Safari ile kalıcı adresi aç → Paylaş → Ana Ekrana Ekle.
2. Ana ekrandaki Sherpa simgesinden aç: adres çubuğu olmadan, tam ekran açılmalı.
3. E-postanı yaz, gelen 8 haneli kodu uygulamanın içinde yaz, giriş yap.
4. Uygulamayı kapatıp yeniden aç: giriş istememeli.
5. Sonucu (çalıştı ya da nerede takıldı) buraya yaz.

## Verdiğim kararlar

"Görüşün gerek" yazanlar zevkine ya da alışkanlığına bağlı; fazın sonunda bakman yeter.

| Tarih | Karar | Gerekçe | Etkilediği dosyalar |
| --- | --- | --- | --- |
| 10 Kas 2026 | Yerel Supabase, D1'e kadar `dev` projesinin yerini tutuyor | BASLA "yerelde geliştir" diyor; bulut projeleri bir durak | `supabase/config.toml`, `.env.example` |
| 10 Kas 2026 | Giriş: e-postaya gelen kod; geçiş anahtarı kurulmadı | Doküman "kod ya da geçiş anahtarı" diyor; kod her cihazda çalışıyor ve tek başına yeterli | `src/app/giris/*` |
| 10 Kas 2026 | Giriş kodu 8 hane ve 10 dakika geçerli (önceki ayar 6 hane, 1 saat). **Görüşün gerek** | Supabase'in doğrulama ucu genel anahtarla herkese açık; uygulamadaki e-posta denetimi o yolu kapatmaz. Uzun ve kısa ömürlü kod deneme yanılmayı anlamsız kılar; giriş cihaz başına bir kez yapıldığı için 2 hane fazlası yük değil | `supabase/config.toml`, `supabase/templates/magic_link.html`, `tests/e2e/helpers.ts` |
| 10 Kas 2026 | İzinli e-posta üç yerde denetleniyor: giriş formu (kod istenmeden önce), `proxy` (her istek), `getCurrentUser` (rota ve eylemin içinde). Hesap yalnızca `npm run db:user` ile açılır | Tek katmana güvenmemek için; Supabase'de yeni kayıt ayrıca kapalı | `src/lib/auth/*`, `src/lib/supabase/proxy.ts`, `scripts/create-user.mjs` |
| 10 Kas 2026 | Giriş formu izinsiz adrese "Bu e-posta ile giriş yapılamıyor." diyor | Kabul ölçütü "başka e-posta reddediliyor" diyor. Bedeli: izinli adres tahminle doğrulanabilir; adres zaten sır değil, giriş için kod gerekir | `src/app/giris/actions.ts` |
| 10 Kas 2026 | Oturum belirteci istek başına yerelde doğrulanıyor (`getClaims`, imza denetimi); Supabase'e her istekte sorulmuyor | Hız; pano gün boyu açık. Bedeli: başka cihazdan kapatılan oturum en çok 1 saat (belirteç ömrü) daha geçerli kalır; tek kullanıcı için kabul edilebilir | `src/lib/supabase/proxy.ts`, `src/lib/auth/session.ts` |
| 10 Kas 2026 | "Çıkış yap" yalnızca o cihazdaki oturumu kapatır (`scope: "local"`). **Görüşün gerek** | Telefondan çıkınca ikinci ekrandaki pano düşmesin | `src/app/(app)/ayarlar/actions.ts` |
| 10 Kas 2026 | Next.js 16: istek kapısı `src/proxy.ts` (eski adıyla middleware); `cacheComponents` ve `partialPrefetching` açık; oturumu okuyan her şey gerçek isteği bekler (`connection()`) | Next.js 16'nın güncel düzeni; boş sayfalar statik, oturuma bağlı parça akışla gelir. Oturum okuyan kodun önceden üretilmesi engellendi | `src/proxy.ts`, `next.config.ts`, `src/lib/supabase/server.ts` |
| 10 Kas 2026 | `/api/me` rotası eklendi (dokümanda yok) | "Hiçbir API rotası veri döndürmüyor" ölçütünü sınamak için gerçek bir rota gerekiyordu; sonraki rotaların izleyeceği kalıbı da gösteriyor (rotanın içinde oturum denetimi) | `src/app/api/me/route.ts` |
| 10 Kas 2026 | Modüller bağlantısı `/m` liste sayfasına gidiyor (dokümandaki klasör yapısında yalnızca `m/[slug]` var) | Ç0 gezinmesinde "Modüller" var ve bir yere gitmesi gerekiyor; `m/[slug]` Ç1'de gelir | `src/app/(app)/m/page.tsx` |
| 10 Kas 2026 | Varsayılan tema koyu; Ayarlar'dan Açık, Koyu, Sistem seçilir. **Görüşün gerek** | Uygulama gün boyu ikinci ekranda açık duruyor | `src/components/theme-provider.tsx`, `src/app/(app)/ayarlar/theme-switch.tsx` |
| 10 Kas 2026 | Arayüz metinleri, boş ekran cümleleri ve giriş e-postasının metni. **Görüşün gerek** | Kısa ve düz, ünlemsiz (CLAUDE.md "Dil") | `src/app/**`, `supabase/templates/magic_link.html` |
| 10 Kas 2026 | Uygulama simgesi: koyu zemin üzerinde sırt çizgisi. **Görüşün gerek** | Ada (dağ rehberi) uyan sade bir işaret; `npm run icons` ile yeniden üretilir | `scripts/generate-icons.mjs`, `public/icons/*`, `src/app/icon.png`, `src/app/apple-icon.png` |
| 10 Kas 2026 | Gezinme: geniş ekranda sol şerit, telefonda alt çubuk. Pano yerleşimi (gezinme gizli, kaydırma yok) Ç4'te | Ç0 kapsamı "uygulama kabuğu"; pano cilası Ç4'ün işi | `src/core/ui/AppNav.tsx`, `src/app/(app)/layout.tsx` |
| 10 Kas 2026 | shadcn/ui'nin güncel varsayılanı kullanıldı (Base UI tabanlı `base-nova` stili, `cn` paketi) | Kurulum anındaki resmi varsayılan; `cn` paketi shadcn'in kendi deposundan | `components.json`, `src/components/ui/*` |
| 10 Kas 2026 | Portlar: geliştirme 3210, uçtan uca testler 3100 | Makinedeki başka projelerle çakışmasın; testler geliştirme sunucusuyla karışmasın | `package.json`, `playwright.config.ts`, `supabase/config.toml` |
| 10 Kas 2026 | Uçtan uca testler üretim derlemesine karşı, yerel Supabase ve Mailpit ile çalışır; test sunucusu açık bir sunucuyu yeniden kullanmaz | Kullanıcının göreceği derleme sınansın; eski derlemeye karşı yeşil görünmesin | `playwright.config.ts`, `tests/e2e/*` |
| 10 Kas 2026 | `check` = tip + lint + biçim + birim testleri; `check:full` = `check` + derleme + uçtan uca. `typecheck` önce rota tiplerini üretir (`next typegen`) | BASLA "Doğrulama düzeni"; temiz bir kopyada da tip denetimi çalışsın | `package.json` |
| 10 Kas 2026 | Ekran görüntüleri yalnızca `SHERPA_SHOTS=<faz>` verilince alınır | Her test çalışması `docs/` altını değiştirmesin | `tests/e2e/screenshots.spec.ts`, `playwright.config.ts` |
| 10 Kas 2026 | Test değişikliği: "yanlış kod" testi artık gerçek kodla aynı uzunlukta, tek hanesi farklı bir kod deniyor; kod okuyan yardımcı 8 hane arıyor | Kod uzunluğu 6'dan 8'e çıktı; test gevşetilmedi, yeni uzunluğa uyduruldu | `tests/e2e/login.spec.ts`, `tests/e2e/helpers.ts` |
| 10 Kas 2026 | `shadcn` paketi `dependencies` altında kaldı (denetçi `devDependencies` önerdi) | `globals.css` derlemede `shadcn/tailwind.css` dosyasını içe aktarıyor; shadcn kurulumu paketi oraya kendisi koyuyor. Çalışma zamanına kod girmiyor | `package.json` |
| 10 Kas 2026 | Dal adı şimdilik `master`; D1'de GitHub'a gönderilirken `main` yapılacak | Doküman "`main` → üretim" diyor; uzak depo yokken yeniden adlandırmanın acelesi yok, betik yalnızca etiketlere bakıyor | — |

## Bilinen sorunlar

- Bulut yok: üretim adresi, bulut `dev` ve `prod` projeleri, gerçek e-posta gönderimi ve Vercel önizleme koruması D1'e kadar sınanamıyor. Yerel `config.toml` yalnızca yerel Supabase'i yönetir; aynı kimlik ayarları D1'de bulut projelerine aktarılıp `session.spec.ts` içindeki "yeni kayıt kapalı" sınamaları orada yinelenmeli.
- Uçtan uca testlerde sunucu günlüğüne iki kez `AuthApiError: Refresh token is not valid` düşer. Beklenen bir çıktıdır ("yenilenemeyen oturum kapatılır" testi sahte yenileme belirteci gönderir); hata değildir.
- Girişten sonra tarayıcıda oturum çerezinin yanında birkaç `…-code-verifier` çerezi kalıyor (Supabase istemcisinin PKCE akışından). Kod akışında kullanılmıyorlar; birikip birikmediğine bakılmadı. Giriş cihaz başına bir kez yapıldığı için sorun beklenmiyor; Ç4'te oturum davranışı elden geçirilirken bakılacak.
- `(app)` altındaki sayfalar korumayı `proxy`'den alıyor; yerleşimde ayrıca oturum denetimi yok (Ç0'da sayfalarda veri yok). Ç1'den itibaren veri okuyan ya da yazan her rota ve sunucu eylemi `getCurrentUser()` çağırmalı; RLS ayrıca korur.
