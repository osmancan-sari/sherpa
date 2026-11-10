# İlerleme

Bu dosyayı Claude Code günceller. Yeni bir oturum yalnızca bu dosyayı ve `prompts/BASLA.md` dosyasını okuyarak kaldığı yerden devam edebilmelidir.

## Durum

- Faz: **Ç1 (Çekirdek ve modül temeli) sürüyor.** Ç0 bitti (`c0-tamam`); yayın ve telefon D1 ve D2'yi bekliyor
- Adım: 5 / 8 (aşağıdaki plan); 1–4 bitti
- Son commit: istemci altyapısı, Bugün ekranı, hızlı giriş, gelen kutusu

### Ç1 planı

Her adımın sonunda `npm run check` ve commit; şema, RLS, iş zarfı ve eşitleme adımlarından sonra denetçi (adım kipi).

| # | Adım | Durum |
| --- | --- | --- |
| 1 | Kapılar: Playwright projeleri dosya adına bağlı kalmasın, Vitest `*.test.tsx`, veritabanı testleri için ayrı komut (`npm run test:db`) | bitti |
| 2 | Migration: `docs/03-veri-modeli.md` çekirdek tabloları, RLS, oturum ve arşiv fonksiyonları, Realtime yayını; tipler; veritabanı testleri (RLS, kısıtlar) | bitti; denetim (adım kipi): 2 engelleyici ve 5 önemli bulgu düzeltildi |
| 3 | Çekirdek veri katmanı (`src/core/data`), iş zarfı (`propose`, `withdraw`, `provenance`, `onOutcome`), olaylar, modül sözleşmesi tipleri ve kayıt, blok serisi üretimi | bitti (arayüz yok); denetim (adım kipi): engelleyici yok, 8 önemli bulgu düzeltildi |
| 4 | İstemci altyapısı: TanStack Query, Realtime, modül kaydı bağlamı. Bugün ekranı, hızlı giriş, gelen kutusu, oturumlar | bitti (63 uçtan uca test; iki cihaz eşitlemesi dahil) |
| 5 | Modül arayüzü zemini: `ModulePageShell`, sekmeler, alt sayfalar, tam ekran, hızlı eylemler, modül ayarları, bileşen takımı. `_sablon` ve `deneme` | sırada |
| 6 | Ayarlar: modüller, sabit bloklar, dışa aktarım | |
| 7 | `scripts/seed-demo.ts`, uçtan uca testler (iki cihaz eşitlemesi dahil), ekran görüntüleri | |
| 8 | `check:full`, faz denetimi, düzeltmeler, faz raporu, etiket | |

## Biten fazlar

### Ç0: İskelet (10 Kas 2026)

**`c0-tamam` etiketinin anlamı: kod hazır ve yerelde doğrulandı; D1 ve D2 açık.** Beş kabul ölçütünden ikisi tam sağlandı; üçünün yerel karşılığı sağlandı, gerçeği (üretim adresi, telefon, bulut `dev` projesi) senin elinle yapılacak duraklara bağlı. `docs/07-yol-haritasi.md` içindeki kutuları bu yüzden işaretlemedim.

**Görüşün gerek: etiketi bu durumda atmam doğru muydu?** `CLAUDE.md` ve yol haritası "kabul ölçütleri sağlanmadan sonrakine geçme" diyor; `prompts/BASLA.md` ise durakları beklemeden yerel karşılığıyla devam etmeyi ve doğrulanamayanı "elle doğrulanacak" diye işaretlemeyi söylüyor. BASLA'yı izledim: etiket koşulu orada yazılı (`npm run check:full` yeşil, son denetçi raporunda engelleyici yok) ve ikisi de sağlandı. Denetçiler bu noktada ayrıştı: 1. tur aynı ölçütleri engelleyici saydı, 2. ve 3. tur saymadı; 3. tur bu okumanın senin kararın olduğunu yazdı. Katılmıyorsan `git tag -d c0-tamam` yeter. Aynı durum D3 yüzünden Ç2'de yinelenecek; kuralı `prompts/denetci.md` içinde netleştirmeni öneririm (ör. "durağa bağlı ölçüt engelleyici değil, 'durak bekliyor' diye yazılır").

#### Kabul ölçütleri

| Ölçüt | Durum | Kanıt |
| --- | --- | --- |
| Üretim adresinde izinli e-postayla giriş yapılıyor; başka e-posta reddediliyor | **Açık (D1).** Yerel karşılığı otomatik doğrulandı; üretimde elle doğrulanacak | `tests/e2e/login.spec.ts`, `tests/e2e/session.spec.ts` (üretim derlemesi + yerel Supabase), `src/app/giris/actions.test.ts`. Üretim adresi yok |
| Telefonda ana ekrana eklenince tam ekran açılıyor ve giriş uygulamanın içinde kodla yapılabiliyor | **Açık (D2).** Yalnızca hazırlık sınandı; gerçek telefonda elle doğrulanacak | Manifest (`display: standalone`), simgeler, `apple-touch-icon`, iki `web-app-capable` etiketi, kod adımının yeniden yüklemeye dayanması, telefon genişliğinde kabuk (`guard.spec.ts`, `shell.spec.ts`, `login.spec.ts`) |
| Giriş yapılmadan hiçbir sayfa ve API rotası veri döndürmüyor | Sağlandı (yerelde, üretim derlemesine karşı); üretimde D1'de yinelenecek | `tests/e2e/guard.spec.ts` (sayfalar 307 → `/giris`, API 401, uydurma çerez, benzer görünen yollar, görsel iyileştirici), `tests/e2e/session.spec.ts` (başka hesabın gerçek oturumu, yenilenemeyen oturum). Üç denetçi turu ayrıca onlarca ham yol denedi; veri dönen çıkmadı |
| `lint`, `test`, `build` komutları geçiyor ve `CLAUDE.md`'de yazılı | Sağlandı | `npm run check:full` yeşil (32 birim testi, 39 uçtan uca test; ekran görüntüleriyle 45); `CLAUDE.md` "Komutlar" |
| Boş bir migration `dev`'e uygulanıp tipler üretilebiliyor | Yerel veritabanında sağlandı; **bulut `dev` projesi açık (D1)** | `supabase/migrations/20261110184021_init.sql`; `npm run db:migrate` ve `npm run db:types` yerelde çalışıyor, üretilen tipler depodakiyle aynı. Bunu sınayan otomatik test yok |

Kapsamdan yapılmayanlar (hepsi D1): Supabase `dev` projesi, kalıcı adres, Vercel'e yayın ve önizleme dağıtımlarının korunması. Geçiş anahtarı kurulmadı (doküman "kod ya da geçiş anahtarı" diyor).

#### Ne kuruldu

1. Next.js 16 (App Router) + TypeScript strict + Tailwind 4 + shadcn/ui; ESLint ve Prettier
2. Klasörler: `src/app`, `src/core/ui`, `src/components`, `src/lib`, `src/modules/registry.ts` (boş kayıt), `src/proxy.ts`. `src/core/` altındaki `data`, `events`, `intake` (Ç1), `ai` (Ç2) ve `planner` (Ç3) kendi fazlarında açılır; boş klasör tutulmadı (`src/core/README.md`)
3. Yerel Supabase: yeni kayıt kapalı, 8 haneli ve 10 dakikalık e-posta kodu, kod şablonu; boş migration; tip üretimi
4. Kimlik: `/giris` (e-posta → kod), `ALLOWED_EMAIL` denetimi üç katmanda, `proxy` ile sayfa ve API koruması, kendini yenileyen uzun ömürlü oturum
5. Kabuk: gezinme (Bugün, Hafta, Modüller, Gelen kutusu, Ayarlar), açık ve koyu tema, boş sayfalar
6. PWA manifesti ve simgeler; `noindex` (başlık, meta, `robots.txt`)
7. Testler: Vitest (tarih, izinli e-posta, oturum denetimi, giriş eylemi, lint kuralları), Playwright (koruma, giriş, oturum, kabuk; pano ve telefon genişliği)
8. Kapılar: `npm run check`, `npm run check:full`; çekirdek → modül yasağı ve "test atlanmaz" kuralı lint'te

Ekran görüntüleri: `docs/ekran-goruntuleri/c0/` (26 dosya; pano 1920×1080 ve telefon 390×844; beş ekran koyu ve açık, giriş ekranının üç adımı koyu). Boş ya da bozuk ekran yok (kendim ve 3. tur denetçisi baktı).

#### Denetim

Dört denetçi çalışması yapıldı; her biri bağımsız bir alt ajandı ve yalnızca `prompts/denetci.md` ile kip ve kapsam bilgisini aldı. Raporlar depoda saklanmadı; aşağısı benim özetim.

| Tur | Karar | Bulgular | Ne yapıldı |
| --- | --- | --- | --- |
| Adım kipi: kimlik ve migration (`c0a8d23..e8255ab`) | GEÇTİ | 5 önemli: başka hesabın geçerli oturumunun reddi sınanmıyor; "yeni kayıt kapalı" Supabase düzeyinde sınanmıyor; oturum yenilemesi sınanmıyor; ilerleme kaydı eksik; giriş kodu 6 hane ve 1 saat | Hepsi düzeltildi: `tests/e2e/session.spec.ts`, kod 8 hane ve 10 dakika, kararlar ve duraklar yazıldı. Yeni testin gerçekten yakaladığı, e-posta denetimi geçici olarak silinip testin kırmızıya düştüğü görülerek denendi |
| Faz, 1. tur (`f2e885a`) | GEÇMEDİ | 2 engelleyici: D1 ve D2'ye bağlı iki ölçüt sağlanmıyor (kodda engelleyici yok). 2 önemli: açık temadaki Ayarlar görüntüsünde e-posta yok (görüntü erken alınmış); çekirdek → modül lint kuralı dört yazımı kaçırıyor | Önemliler düzeltildi. Engelleyiciler düzeltilemez: duraklar senin elinde. Notlardan `proxy` istisnalarının tam eşleşmesi, `forbidOnly`, giriş ekranının öbür adımlarının görüntüsü yapıldı |
| Faz, 2. tur (`076578e`) | GEÇTİ | Engelleyici yok. 6 önemli: yayın ve telefon yok (D1, D2); giriş kodu adımı yeniden yüklemede kayboluyor; Vitest `.only`'ye izin veriyor; `getCurrentUser` ve giriş eylemi tek başına sınanmıyor; uçtan uca testler hedefin yerel olduğunu denetlemiyor; yarıda kalan çalışma yabancı hesabı bırakırsa testler kırmızı kalır | İlki dışında hepsi düzeltildi (`src/app/giris/pending.ts`, `actions.test.ts`, `session.test.ts`, `test-gates.test.ts`, `playwright.config.ts`). Notlardan görsel iyileştirici ve `favicon.ico` istisnası, Apple meta etiketi, görüntülerde imleç yapıldı; güvenlik başlıkları "Fikirler"e yazıldı |
| Faz, 3. tur (`126b695`) | GEÇTİ | Engelleyici yok; denetçinin çekincesi: üç ölçüt duraklara bağlı, etiketin anlamı "kod hazır, D1 ve D2 açık" olmalı. 3 önemli: kural çelişkisi ve etiketin anlamı (senin kararın); iki betik aynı anda çalışıyor (senin kararın); uçtan uca kapı dosya adlarını tek tek sayıyor, yeni adla eklenen bir test dosyası hiçbir projede çalışmaz | İlk ikisi yukarıda ve "Senden bekleyenler"de sana bırakıldı. Üçüncüsü **açık**: en çok üç tur kuralı gereği son denetimden sonra koda dokunmadım (etiketlenen kod denetlenen kodla aynı); Ç1'in ilk işi olarak aşağıda yazılı. Bugün altı test dosyasının hepsi çalışıyor, atlanan yok |

Katılmadığım bulgu: `shadcn` paketinin `devDependencies` altına alınması (gerekçesi "Verdiğim kararlar"da). 1. turdaki "engelleyici" nitelemesine neden uymadığım bu raporun başında yazılı.

Son denetimden sonraki değişiklikler yalnızca bu dosyadadır (faz raporu). `npm run check:full` etiketten hemen önce yeniden çalıştırıldı ve yeşildi.

#### Ç1 için notlar

- **İlk iş (3. tur, önemli, açık):** Playwright projeleri test dosyalarını adıyla sayıyor (`playwright.config.ts`); başka adla eklenen `*.spec.ts` sessizce çalışmaz. Eşleşmeyen dosya varsa kırmızı veren bir denetim ekle. Vitest `include` yalnızca `*.test.ts` alıyor; `*.test.tsx` ekle.
- Veri okuyan ya da yazan her rota ve sunucu eylemi kendi içinde `getCurrentUser()` çağırmalı ve bu, oturumsuz çağrıyla sınanmalı. `proxy` sunucu eylemlerini tek başına kapatmaz ("Bilinen sorunlar").
- Çekirdek → modül yasağı yalnızca `src/core` içindeki yol yazımına bakıyor; `src/core` → `@/lib/x` → `@/modules/…` dolaylı yolu lint'ten geçer. Modüller gelince `src/lib` ve `src/components` için de yasak ya da bağımlılık denetimi düşün.
- Migration'dan sonra tiplerin yeniden üretildiğini denetleyen kapı yok; `check:full` içine "üret ve karşılaştır" adımı eklenebilir.
- Atlama yasağı `test.fail` ve `it.fails` yazımlarını yakalamıyor; listeye eklenebilir.
- "Kodu yeniden gönder" yalnızca birim testinde sınanıyor; uçtan uca adımı yok.
- Boş sayfalar statik üretiliyor; veri taşıyan sayfaların statik kalmadığına bak (`cacheComponents` açık; oturumu okuyan her şey `connection()` bekler).
- Akışla gelen içerik (Suspense) sayfada bir an iki kez bulunur; Playwright'ta metni `getByRole("main")` ya da belirli bir bölüm içinde ara, yoksa "strict mode" hatası verir.
- Bu makinede Git Bash içinden `node -e` ile dosya düzenlemek ters eğik çizgileri, heredoc ise kesme işaretlerini bozuyor; düzenlemeleri düzenleme aracıyla yap.
- Telefonda bakılacaklar (D2): durum çubuğu rengi (`themeColor` sistem tercihine göre, uygulamanın varsayılanı koyu), güvenli alanlar, posta uygulamasından dönünce kod adımının durması.
- TanStack Query, Realtime ve `m/[slug]` Ç1'de kurulacak; Ç0'da yok.

## Sıradaki adım

Ç1'in 5. adımı: modül arayüzü zemini (`ModulePageShell`, sekmeler, alt sayfalar, tam ekran, hızlı eylemler, modül ayarları, bileşen takımı), `_sablon` ve `deneme` modülleri. Ayrıntı yukarıda "Ç1 planı" tablosunda.

## Senden bekleyenler

### Kapandı: aynı anda iki faz betiği (10 Kas 2026, 23:25)

21:50'de başlatılan eski betik penceresi kapatıldı ve `docs/BEKLIYOR.md` silindi; kararı ben verdim (yeni betik kalsın). Betiğe aynı anda ikinci kez çalışmayı engelleyen bir kilit eklendi (`logs/runner.pid`). Bu konuda yapılacak bir şey yok; `c0-tamam` etiketi yerinde.

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
| 10 Kas 2026 | Çekirdek → modül yasağı yol kalıbıyla denetleniyor: `src/core` içinde, takma adla ya da göreli yazılmış ve içinde `modules` klasörü geçen her yol yasak (statik, dinamik `import()`, `require`) | Faz denetimi ilk kuralın dört yazımı kaçırdığını buldu. Bedeli: çekirdekte `modules` adında bir klasör açılamaz | `eslint.config.mjs`, `tests/unit/core-imports.test.ts` |
| 10 Kas 2026 | `proxy` istisnaları tam yol eşleşmesi (manifest, simgeler, `robots.txt`, `favicon.ico`); benzer görünen yollar kapıdan geçer | Faz denetimi istisnaların ön ek gibi çalıştığını buldu | `src/proxy.ts`, `tests/e2e/guard.spec.ts` |
| 10 Kas 2026 | Playwright'ta `.only` yerelde de yasak (`forbidOnly: true`) | Etiket kapısı yerelde çalışıyor; daraltılmış testle yeşil görünmesin | `playwright.config.ts` |
| 10 Kas 2026 | Giriş kodu adımı cihazda 10 dakikalık bir çerezle hatırlanıyor (`sherpa-login`, yalnızca `/giris` yolu, `httpOnly`); giriş yapılınca ya da "Başka e-posta" denince silinir | Faz denetimi buldu: sayfa yeniden yüklenince form e-posta adımına dönüyor ve eldeki kod yazılamıyordu. Telefonda kurulu uygulama posta uygulamasından dönünce yeniden yüklenebilir; bulutta e-posta kotası da dar | `src/app/giris/pending.ts`, `actions.ts`, `page.tsx`, `login-form.tsx` |
| 10 Kas 2026 | Test dosyalarında `only`, `skip`, `todo`, `fixme` lint hatası; Vitest'te `allowOnly: false` | BASLA: test atlanmaz, daraltılmaz. Kapı bunu kendisi yakalasın | `eslint.config.mjs`, `vitest.config.mts`, `tests/unit/test-gates.test.ts` |
| 10 Kas 2026 | Uçtan uca testler yalnızca yerel Supabase'e karşı çalışır; `.env.local` başka bir adresi gösteriyorsa başlamaz | Testler servis anahtarıyla hesap açıp siliyor ve yabancı hesapla oturum üretiyor; D1'den sonra yanlışlıkla bulut projesine karşı çalışmasın | `playwright.config.ts` |
| 10 Kas 2026 | Görsel iyileştirici (`/_next/image`) ve `favicon.ico` artık kapının arkasında | Oturumsuz hiçbir sayfa onları kullanmıyor; istisna listesi kısaldı | `src/proxy.ts`, `tests/e2e/guard.spec.ts` |
| 10 Kas 2026 | `apple-mobile-web-app-capable` meta etiketi elle eklendi | Next.js yalnızca standart `mobile-web-app-capable` etiketini yazıyor; eski iOS sürümleri Apple'ınkini arar (D2'de tam ekran açılış) | `src/app/layout.tsx` |
| 10 Kas 2026 | `shadcn` paketi `dependencies` altında kaldı (denetçi `devDependencies` önerdi) | `globals.css` derlemede `shadcn/tailwind.css` dosyasını içe aktarıyor; shadcn kurulumu paketi oraya kendisi koyuyor. Çalışma zamanına kod girmiyor | `package.json` |
| 10 Kas 2026 | Dal adı şimdilik `master`; D1'de GitHub'a gönderilirken `main` yapılacak | Doküman "`main` → üretim" diyor; uzak depo yokken yeniden adlandırmanın acelesi yok, betik yalnızca etiketlere bakıyor | — |
| 10 Kas 2026 | Ç1: veritabanı testleri ayrı komut (`npm run test:db`), `check:full` içinde; iki geçici hesapla (`db-owner`, `db-stranger`) yerel Supabase'e gerçek oturumla bağlanır | RLS, kısıt ve fonksiyonlar uygulamanın gördüğü haliyle sınansın; `check` hızlı ve Docker'sız kalsın | `vitest.db.config.mts`, `tests/db/*`, `package.json` |
| 10 Kas 2026 | Ç1: Playwright'ta `pano` projesi öbür projelerin almadığı her `*.spec.ts` dosyasını çalıştırır; iki genişlikte çalışacak dosyalar `*.both.spec.ts` adını alır. `shell.spec.ts` → `shell.both.spec.ts` (içerik aynı) | Ç0 denetiminin açık bulgusu: adıyla sayılmayan test dosyası sessizce çalışmıyordu | `playwright.config.ts`, `tests/e2e/shell.both.spec.ts` |
| 10 Kas 2026 | Ç1: tablolar arası başvurular `(id, user_id)` çiftiyle | Adım denetimi buldu: düz yabancı anahtar RLS'siz denetlendiği için başka bir hesap kendi satırını bu hesabın modülüne bağlayıp `key` tekilliğini kilitleyebiliyordu | migration, `docs/03-veri-modeli.md`, `tests/db/constraints.test.ts` |
| 10 Kas 2026 | Ç1: `events` yalnızca eklenir ve okunur, `inbox_entries` silinemez; bu, izinlerle de uygulanır | Doküman: "Yalnızca eklenir", "Hiç silinmez" | migration, `tests/db/rls.test.ts` |
| 10 Kas 2026 | Ç1: oturumlar veritabanı fonksiyonlarıyla (`start_session`, `end_session`, `complete_task`), çağıranın yetkisiyle. Yeni oturum açık olanı durdurur; biten ya da bırakılmış işte oturum açılmaz; bekleyen iş başlatılınca bekleme biter | Birkaç tabloya dokunan işlem tek adımda olsun; "aynı anda tek açık oturum" iki cihazda da tutsun | migration, `tests/db/sessions.test.ts` |
| 10 Kas 2026 | Ç1: zarfın `key` değeri `rhythms` ve `blocks` tablolarında da var; ikisi de `provenance` taşır. `work_items.depends_on_keys` eklendi. `provenance` değerlerine `default` eklendi | Doküman `key` ve `provenance` alanlarını yalnızca `work_items` için sayıyordu; ritim ve blok teklifleri de tekrar edilebilir olmalı | migration, `docs/03-veri-modeli.md`, `docs/09-kararlar.md` |
| 10 Kas 2026 | Ç1: seri bloklarında tekillik `(series_id, occurrence_on)`; doküman `(series_id, starts_at)` diyordu | Saati elle değiştirilen blok için eski saat yeniden üretilmesin | migration, `docs/03-veri-modeli.md` |
| 10 Kas 2026 | Ç1: modül arşivlenince gelecek blokları `cancelled` olur, silinmez | Adım denetimi buldu: ilk hal siliyordu; sözleşme "verisi silinmez" diyor | migration, `tests/db/sessions.test.ts` |
| 10 Kas 2026 | Ç1: Realtime yayını dokümandaki 7 tabloya ek olarak `modules`, `work_items`, `rhythms`, `block_series`, `prompts`, `settings` tablolarını da kapsar | Bunlar da ekranda görünüyor; öbür cihazda eskimesinler | migration, `docs/02-mimari.md` |
| 10 Kas 2026 | Ç1: planlayıcı yokken kalemin oturum işi "Başla" anında üretilir (uzunluk `session_minutes`, yoksa kalan eforun en çok 45 dakikası) | Kalemler Ç3'te haftalık planda bölünecek; o zamana kadar başlatılabilmeli, uzak kalemler de önceden bölünmemeli | migration (`start_session`), `docs/03-veri-modeli.md` |
| 11 Kas 2026 | Ç1: iş zarfının mantığı saf fonksiyonlarda (`src/core/contract/envelope.ts`: doğrulama, alan eşleme, birleştirme), yazma ayrı (`src/core/data/propose.ts`). Doğrulama `zod` ile | Kural (kullanıcının alanı ezilmez, varsayılan gerçek değeri ezmez) veritabanısız sınanabilsin; Ç2'nin çıktı şemaları da aynı kütüphaneyi kullanır | `src/core/contract/*`, `src/core/data/propose.ts` |
| 11 Kas 2026 | Ç1: olgu alanları her teklifte yazılır (boş gelen de), yargı alanları yalnızca dolu gelince. Teklif edilen kalem `active` açılır. Geri çekilen kalem yeniden teklif edilince geri gelir; kullanıcının kapattığı gelmez | Doküman "bilmediğini boş bırakır" diyor ama son tarihin kalkması gibi olgu değişiklikleri de yansımalı | `src/core/contract/envelope.ts`, `docs/06-modul-sozlesmesi.md` |
| 11 Kas 2026 | Ç1: çekirdeğin veri fonksiyonları Supabase istemcisini parametre alır; tarayıcıda da sunucuda da aynı kod çalışır. Modül bağlamı (`createModuleContext`) da öyle | Planlayıcı ve arayüz tarayıcıda, köprü ve zamanlanmış işler sunucuda aynı kuralları kullanacak | `src/core/data/*` |
| 11 Kas 2026 | Ç1: olaylar yayınlandıkları yerde, dinleyen etkin modüllere sırayla verilir; ayrı bir tüketici süreci yok | Tek kullanıcı; kuyruk ve imleç gereksiz. Bedeli: yayınlayan cihaz kapanırsa dinleyici çalışmaz (olay kaydı durur) | `src/core/events/bus.ts` |
| 11 Kas 2026 | Ç1: bırakılmış bir bağımlılık bağlı kalemi tutmaz | Bırakılan kalem hiç bitmez; bağlı kalem sonsuza dek gizli kalırdı | `src/core/today/select.ts` |
| 11 Kas 2026 | Ç1: hızlı girişte tarih ve süre yalnızca satırın sonundaki sözcüklerden okunur (`yarın`, `cuma`, `15.11`, `+3g`, `45dk`, `1s30dk`); haftanın günü bir sonraki o gündür. **Görüşün gerek** | Başlığın ortasındaki "cuma" başlığın parçası kalsın; kural öngörülebilir olsun | `src/core/intake/parse.ts` |
| 11 Kas 2026 | Ç1: blok serileri 56 gün (8 hafta) ileriye üretilir; uygulama açılınca eksikler tamamlanır. Gece çalışan zamanlanmış iş D1'den sonra | Zamanlanmış iş Vercel'de çalışır (yayın durağı); o zamana kadar uygulamanın açılması yeterli | `src/core/data/blocks.ts`, `src/core/data/series.ts` |
| 11 Kas 2026 | Ç1: çekirdek migration'ı (`20261110203434_core_tables.sql`) faz içinde iki kez yerinde düzenlendi (denetim düzeltmeleri) ve yerel veritabanı `db:reset` ile yeniden kuruldu. **D1'den sonra bu yasak:** bulut projesine uygulanmış migration değiştirilmez, yeni migration açılır | Henüz hiçbir bulut projesi yok; şemanın tek dosyada okunur kalması daha değerli. Faz etiketinden sonra da yeni migration açılır | `supabase/migrations/*` |
| 11 Kas 2026 | Ç1: kimin kapattığı `provenance` içinde tutulur (`status`/`active` alanının kaynağı: `user` ya da `module`); yalnızca modülün geri çektiği kayıt yeniden teklifle geri gelir | Adım denetimi buldu: kullanıcı duruma bir kez dokunduysa geri çekilen kayıt bir daha geri gelmiyordu | `src/core/data/propose.ts`, `tests/db/envelope.test.ts` |
| 11 Kas 2026 | Ç1: biçimin kullanmadığı zarf alanı reddedilir; `key` boşluk, virgül, ayraç, tırnak içeremez | Adım denetimi: sessizce yutulan alan modül yazarını yanıltır; `key` dizi süzgeçlerinin içinde taşınıyor | `src/core/contract/envelope.ts`, `docs/06-modul-sozlesmesi.md` |
| 11 Kas 2026 | Ç1: kalem kapatılırken ya da geri çekilirken üzerinde çalışan oturum durdurulur ve süresi sayılır; `onOutcome` hata verirse kalem yine kapanır | Adım denetimi: açık oturum kapanmış kaleme bağlı kalıyordu | `src/core/data/outcome.ts`, `src/core/data/propose.ts` |
| 11 Kas 2026 | Ç1: veri tarayıcıda okunur ve yazılır (Supabase istemcisi + RLS), TanStack Query ile; sayfaların sunucu kısmı yalnızca statik kabuktur. Veriye ve saate bağlı her ekran parçası yalnızca tarayıcıda çizilir (`ClientOnly`) | Planlayıcı tarayıcıda çalışacak, Realtime sorguları geçersiz kılacak (mimari dokümanı); `cacheComponents` açıkken saat ve oturum önceden üretilemez. Ç0 notundaki "veri taşıyan sayfa statik kalmasın" kaygısı böylece kalkıyor: statik kabukta veri yok | `src/core/app/*`, `src/core/ui/ClientOnly.tsx`, `src/app/(app)/providers.tsx` |
| 11 Kas 2026 | Ç1: tablo başına tek sorgu (`["core", tablo]`); Realtime o tabloyu ve modüllerin hesapladığı her şeyi (`["module", …]`) geçersiz kılar. Güvenlik ağı: pencere öne gelince, ağ dönünce, dakikada bir, bağlantı yeniden kurulunca hepsi | `docs/11-yayin-ve-cihazlar.md`, "Eşitleme" 1 ve 2. Veri küçük; ince ayarlı geçersiz kılma erken | `src/core/app/CoreProvider.tsx`, `src/core/app/hooks.ts` |
| 11 Kas 2026 | Ç1: tek saat (`useNow`): 30 saniyede bir, pencere öne gelince ve her veri değişiminde yeniden okunur; geçen süre sunucunun `started_at` değerinden hesaplanır | Doküman: "şimdi" dakikada bir ve her veri değişiminde yeniden hesaplanır; cihazlar kendi sayaçlarını tutmaz | `src/core/app/clock.ts` |
| 11 Kas 2026 | Ç1: çekirdek modül kaydını içe aktarmaz; `src/app/(app)/providers.tsx` kaydı `CoreProvider`'a verir | Mimari kural: çekirdek modülleri tanımaz | `src/app/(app)/providers.tsx`, `src/core/app/CoreProvider.tsx` |
| 11 Kas 2026 | Ç1: hızlı girişte `Tab` modüller arasında gezer (hiçbiri → birinci → … → hiçbiri), `Enter` kaydeder; alttaki alanlara ok tuşuyla ya da dokunarak inilir. Telefonda tek bir yüzen "Yeni giriş" düğmesi her ekranda durur. **Görüşün gerek** | Doküman: "`Tab` ile modül"; giriş en çok 2 dokunuş ya da tek cümle | `src/core/ui/QuickAdd.tsx`, `src/app/(app)/layout.tsx` |
| 11 Kas 2026 | Ç1: Bugün ekranının ilk hali: solda büyük "şimdi" kartı (çalışan oturum → süren sabit blok → listenin başı → boş), sağda sıradakiler, altta günün blokları ve modül çipleri. "Durdur" (bitirmeden bırak), "Bugün bitenler" ve "Geri al" eklendi. **Görüşün gerek** | Kapsam "basit şimdi kartı" diyor; yanlışlıkla başlatılan ya da bitirilen iş geri alınabilmeli. Ertele ve Takıldım Ç3'te | `src/core/ui/today/*` |
| 11 Kas 2026 | Ç1: uçtan uca testlerde her test boş hesapla başlar (`tests/e2e/fixtures.ts`); `shell.both.spec.ts` da bu `test`'i kullanır (tek değişen satır içe aktarım) | Testler aynı hesabı paylaşıyor; sıra ve önceki çalışmadan kalan veri sonucu etkilemesin | `tests/e2e/fixtures.ts`, `tests/e2e/data.ts`, `tests/e2e/shell.both.spec.ts` |

## Bilinen sorunlar

- Ç1, adım 2: `b87e5fb` commit'i lint kırmızıyken atıldı (komut zincirinde çıkış kodu yutuldu); 21 saniye sonra `6439e65` ile düzeltildi. O andan beri kapı komutları `pipefail` ile çalıştırılıyor.

- Bulut yok: üretim adresi, bulut `dev` ve `prod` projeleri, gerçek e-posta gönderimi ve Vercel önizleme koruması D1'e kadar sınanamıyor. Yerel `config.toml` yalnızca yerel Supabase'i yönetir; aynı kimlik ayarları D1'de bulut projelerine aktarılıp `session.spec.ts` içindeki "yeni kayıt kapalı" sınamaları orada yinelenmeli.
- Uçtan uca testlerde sunucu günlüğüne iki kez `AuthApiError: Refresh token is not valid` düşer. Beklenen bir çıktıdır ("yenilenemeyen oturum kapatılır" testi sahte yenileme belirteci gönderir); hata değildir.
- Girişten sonra tarayıcıda oturum çerezinin yanında birkaç `…-code-verifier` çerezi kalıyor (Supabase istemcisinin PKCE akışından). Kod akışında kullanılmıyorlar; birikip birikmediğine bakılmadı. Giriş cihaz başına bir kez yapıldığı için sorun beklenmiyor; Ç4'te oturum davranışı elden geçirilirken bakılacak.
- `(app)` altındaki sayfalar korumayı `proxy`'den alıyor; yerleşimde ayrıca oturum denetimi yok (Ç0'da sayfalarda veri yok). `proxy` sunucu eylemlerini tek başına kapatmaz: `/giris` oturumsuz açık olduğu için başka bir sayfaya ait eylem o yoldan çağrılabilir (bugün tek eylem "çıkış yap", zararsız). Ç1'den itibaren veri okuyan ya da yazan her rota ve sunucu eylemi kendi içinde `getCurrentUser()` çağırmalı ve bu, oturumsuz çağrıyla sınanmalı; RLS ayrıca korur.
- Boş sayfalar (`/`, `/hafta`, `/m`, `/gelen`) statik üretiliyor ve paylaşımlı önbellek başlığıyla dönüyor (`s-maxage`). Yerelde `proxy` her isteğin önünde çalışıyor; Vercel'de de önbelleğin önünde çalıştığı D1'de sınanacak. Ç1'de veri taşıyan sayfaların statik kalmadığı denetlenecek.
- Adresi bilen biri Supabase'in açık ucundan doğrudan giriş kodu isteyebilir (form denetimi bu yolu kapatmaz). Giremez (kod gerekir), ama e-posta kotasını tüketip girişi geciktirebilir. Bulut projesinde hız sınırlarına D1'de bakılacak.
