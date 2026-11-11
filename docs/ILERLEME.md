# İlerleme

Bu dosyayı Claude Code günceller. Yeni bir oturum yalnızca bu dosyayı ve `prompts/BASLA.md` dosyasını okuyarak kaldığı yerden devam edebilmelidir.

## Durum

- Faz: **Ç1 (Çekirdek ve modül temeli) bitti (`c1-tamam`, 11 Kas 2026).** Sıradaki faz Ç2 (Yapay zeka geçidi). Ç0 da bitti (`c0-tamam`); yayın ve telefon D1 ve D2'yi bekliyor
- Adım: Ç1'in 8 adımı da bitti; Ç2 başlamadı
- Son commit: Ç1 faz raporu; son adım denetiminin düzeltmeleri (oturum işi kalemin oturum süresini de izler)

### Ç1 planı

Her adımın sonunda `npm run check` ve commit; şema, RLS, iş zarfı ve eşitleme adımlarından sonra denetçi (adım kipi).

| # | Adım | Durum |
| --- | --- | --- |
| 1 | Kapılar: Playwright projeleri dosya adına bağlı kalmasın, Vitest `*.test.tsx`, veritabanı testleri için ayrı komut (`npm run test:db`) | bitti |
| 2 | Migration: `docs/03-veri-modeli.md` çekirdek tabloları, RLS, oturum ve arşiv fonksiyonları, Realtime yayını; tipler; veritabanı testleri (RLS, kısıtlar) | bitti; denetim (adım kipi): 2 engelleyici ve 5 önemli bulgu düzeltildi |
| 3 | Çekirdek veri katmanı (`src/core/data`), iş zarfı (`propose`, `withdraw`, `provenance`, `onOutcome`), olaylar, modül sözleşmesi tipleri ve kayıt, blok serisi üretimi | bitti (arayüz yok); denetim (adım kipi): engelleyici yok, 8 önemli bulgu düzeltildi |
| 4 | İstemci altyapısı: TanStack Query, Realtime, modül kaydı bağlamı. Bugün ekranı, hızlı giriş, gelen kutusu, oturumlar | bitti (63 uçtan uca test; iki cihaz eşitlemesi dahil) |
| 5 | Modül arayüzü zemini: `ModulePageShell`, sekmeler, alt sayfalar, tam ekran, hızlı eylemler, modül ayarları, bileşen takımı. `_sablon` ve `deneme` | bitti (`deneme-module.spec.ts` 13 test, `module-page.both.spec.ts` iki genişlikte 2 test) |
| 6 | Ayarlar: modüller, sabit bloklar, dışa aktarım | bitti (`settings.spec.ts`, `tests/db/blocks.test.ts` içinde dışa aktarım) |
| 7 | `scripts/seed-demo.ts`, elle düzenleme arayüzü (iş, kalem, ritim, blok, seri), ekran görüntüleri | bitti; 5–7. adımların denetimi (adım kipi, `cac1403..a4281f3`): engelleyici yok, 7 önemli bulgu; ayrıntı faz raporunda |
| 8 | `check:full`, faz denetimi, düzeltmeler, faz raporu, etiket | bitti; faz denetimi üç tur (üçü de GEÇTİ, engelleyici yok), ardından 3. tur düzeltmelerinin adım denetimi (GEÇTİ) |

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

### Ç1: Çekirdek ve modül temeli (11 Kas 2026)

Her şey yerel Supabase ve üretim derlemesine karşı doğrulandı; bulut ve gerçek telefon D1 ve D2'ye bağlı (Ç0 ile aynı durum).

#### Kabul ölçütleri

| Ölçüt | Durum | Kanıt |
| --- | --- | --- |
| Telefonda eklenen iş, masaüstündeki Bugün ekranında yenilemeden görünüyor | Sağlandı (iki tarayıcı bağlamı: telefon genişliği ve pano). **Gerçek telefonla elle doğrulanacak (D2)** | `tests/e2e/sync.spec.ts`: telefondan eklenen iş 3 saniye içinde panoda; telefonda başlatılan oturum panoda yürüyor, panodaki "Bitti" telefonda kapatıyor; uygulama dışından yapılan değişiklik açık ekrana ulaşıyor. Sayfanın yeniden yüklenmediği sınanıyor |
| 90 dakikadan uzun iş kaydedilemiyor; arayüz iş kalemine çevirmeyi öneriyor | Sağlandı | Veritabanı kısıtı (`tests/db/sessions.test.ts`, "a task is one sitting"); hızlı giriş (`quick-add.spec.ts`), gelen kutusu (`inbox.spec.ts`), düzenleme penceresi (`edit-work.spec.ts`: 120 dk ile "Kaydet" kapalı; burada öneri yok, yalnızca engel) |
| Başla → Bitti bir oturum kaydı üretiyor; aynı anda iki açık oturum olamıyor | Sağlandı | `work-sessions.spec.ts`, `tests/db/sessions.test.ts` (tekil indeks ve `start_session`) |
| Haftalık bir blok serisi gelecek haftaların bloklarını üretiyor; tek bir blok iptal edilebiliyor | Sağlandı | `settings.spec.ts` (Ayarlar'dan seri → 8 hafta, tek blok iptal, yeniden açılışta geri gelmiyor), `edit-work.spec.ts` (seri düzenleme), `tests/db/blocks.test.ts` |
| Aynı `key` ile iki kez teklif edilen zarf tek kayıt üretiyor; kullanıcının değiştirdiği alan ikinci teklifte ezilmiyor | Sağlandı | `src/core/contract/envelope.test.ts`, `tests/db/envelope.test.ts`; arayüzden uçtan uca: `edit-work.spec.ts` ("what the user changes on a proposed work item survives the module's next proposal") ve `deneme-module.spec.ts` |
| `deneme` modülü çipini, sayfasını, girişini ve tekliflerini yalnızca sözleşme üzerinden veriyor; `src/core/` içinde `src/modules/` içe aktarımı yok (lint kuralıyla denetleniyor) | Sağlandı. `alerts` tanımlı ama çekirdek modül uyarılarını Ç3'te (`AlertBar`) göstermeye başlayacak | `deneme-module.spec.ts`, `tests/unit/modules.test.ts` (modül başka modülü içe aktarmıyor, çekirdek tabloya doğrudan uzanmıyor), `tests/unit/core-imports.test.ts`, `eslint.config.mjs` |
| `deneme` modülü kendi sekmesini, alt sayfasını, tam ekran görünümünü, hızlı eylemini ve ayar formunu çekirdeğe dokunmadan ekliyor | Sağlandı | `deneme-module.spec.ts`; iki genişlikte `module-page.both.spec.ts`. Hepsi `src/modules/deneme/module.ts` içindeki `ui` alanından geliyor |
| `_sablon` kopyalanarak yeni bir boş modül 15 dakikada ayağa kalkıyor (adımlar modül README'sinde yazılı) | Sağlandı: yalnızca adı değiştirilmiş bir şablon kopyası kalıcı bir uçtan uca testte etkinleştiriliyor; çipi, beş bölgeli sayfası, hızlı girişi ve ayar sayfası sınanıyor. Adımları 11 Kas'ta bir kez de kendim uyguladım (`ev` adıyla kopya, 4 satır ad değişikliği, kayıtta 2 satır; sonra kaldırıldı). **15 dakikayı sen de bir kez denemelisin (elle doğrulanacak)** | `src/modules/_sablon/README.md`, `tests/e2e/template-module.spec.ts`, `tests/unit/modules.test.ts` ("gives a working module once it is renamed") |
| Bütün veri JSON olarak dışa aktarılabiliyor | Sağlandı | `settings.spec.ts` (indirilen dosya: bütün çekirdek tablolar ve `deneme_items`), `tests/db/blocks.test.ts` "export" (her çekirdek tablo listede, başkasının satırı yok, 1000 satırdan uzun tablo tam), `guard.spec.ts` (oturumsuz 401) |

Kapsamdan eksik kalan: sabit blok ve serilerde tür (`kind`) sonradan düzenlenemiyor (oluştururken verilir); gün tipi yalnızca seri oluştururken verilir, tek seferlik blokta hiç verilemez ve sonradan değiştirilemez; yolculuk süreleri (`travel_*`) için arayüz yok (Ç3'te yuva hesabıyla birlikte anlam kazanır). İş kalemi elle yalnızca 90 dakikayı aşan girişle oluşur; doğrudan "iş kalemi ekle" ve alt kalem arayüzü yok (veri katmanı ve zarf ikisini de destekliyor). Hepsi "Bilinen sorunlar"da.

#### Ne kuruldu

1. Çekirdek tablolar, RLS, oturum ve arşiv fonksiyonları, Realtime yayını (adım 2)
2. İş zarfı (`propose`, `withdraw`, alan kaynağı, `onOutcome`), olaylar, modül sözleşmesi tipleri ve kayıt denetimi (adım 3)
3. İstemci: TanStack Query, canlı eşitleme ve güvenlik ağı, Bugün ekranı (şimdi kartı, sıradakiler, günün blokları, modül çipleri, olay sorusu), hızlı giriş, gelen kutusu, oturumlar (adım 4)
4. Modül arayüzü zemini: `/m/<slug>` altındaki bütün adresler modülün; beş bölgeli `ModulePageShell`, sekmeler, alt sayfalar, kabuksuz tam ekran görünüm, hızlı eylemler, modül ayarları; bileşen takımı (`src/core/ui/kit`: tablo, çubuk ve çizgi grafik, ızgara, zaman çizelgesi, adımlayıcı, seçim çipleri, zamanlayıcı, boş ve hata durumları) (adım 5)
5. `deneme` modülü (sözleşmenin her bağlantı noktası) ve `_sablon` (adım 5)
6. Ayarlar: modüller (etkinleştir, duraklat, arşivle), sabit bloklar (seri, tek seferlik blok, iptal, düzenleme), dışa aktarım (adım 6)
7. Elle düzenleme: iş, kalem, ritim (modül sayfasında), blok ve seri (Ayarlar'da); elle ritim ekleme (adım 7)
8. Örnek veri: `npm run db:seed` (dört sahte modül, zarfla gelen kalemler ve ritimler, seriler, geçmiş oturumlar) (adım 7)

Testler: 128 birim, 84 veritabanı, 106 uçtan uca (`npm run check:full` yeşil; ekran görüntüsü çekimiyle 6 fazlası). Ekran görüntüleri: `docs/ekran-goruntuleri/c1/` (61 dosya; pano 1920 genişlik tam sayfa, telefon 390×844 ekranın gösterdiği, uzun sayfalarda ayrıca sayfanın sonu). Örnek veri ve `deneme` modülüyle alındı; kendim baktım: boş ya da bozuk ekran yok. İlk çekimde modül sayfası veri okunmadan "sırada iş yok" diyordu; düzeltildi ve yeniden çekildi. `npm run db:seed` komutunu da elle çalıştırdım (boş hesap, dolu hesapta ret, `--reset`).

#### Denetim

Faz denetimi (her biri bağımsız bir alt ajan; yalnızca `prompts/denetci.md`, kip ve kapsam verildi):

| Tur | Karar | Bulgular | Ne yapıldı |
| --- | --- | --- | --- |
| Faz, 1. tur (`639a0cf`) | GEÇTİ | Engelleyici yok. 4 önemli: (1) telefonda Bugün ekranı uzun başlıkla yana taşıyor, alt çubuk ve hızlı girişteki "Ekle" ekran dışına kayıyor (ekran görüntülerinden ölçüldü; raporum "bozuk ekran yok" diyordu, yanlıştı); (2) bunu yakalayan test yok; (3) `_sablon` ölçütünün kalıcı kanıtı yok; (4) "modül çekirdekten neyi içe aktarabilir" kuralını denetleyen kapı yok, `deneme` listede olmayan bir yolu içe aktarıyor. 7 not: düzenleme penceresinde kaleme çevirme önerisi yok; iki eski doküman satırı; "Seriyi bitir" blokları siliyor ve yazılı değil; `deneme` 5 dakikadan kısa hedefte teklifsiz kayıt bırakıyor; yapılı blok ayrıştırıcısının birim testi yok; ekran görüntüsü verisi zarfsız yazılıyor; pano Bugün örnek veriyle kayıyor | Dört önemli bulgu düzeltildi: ızgara sütunu daralabiliyor (`TodayScreen.tsx`); `today.both.spec.ts` iki genişlikte uzun başlıklarla taşmayı, alt çubuğu ve hızlı giriş penceresini sınıyor (düzeltme geri alınınca telefonda 394 px taşmayla kırmızıya düştüğü denendi); şablonun adı değiştirilmiş kopyası kalıcı uçtan uca testte (`template-module.spec.ts`); içe aktarım izin listesi testte ve dokümanda. Notlardan: iki doküman satırı, seri kararı (doküman ve kararlar), `deneme` alt sınırı ve hızlı girişte sınır dışı sayının kaydı kapatması (Enter dahil; testiyle), `blocks.test.ts`, ekran görüntüsü verisi düzeltildi; görüntüler yeniden alındı ve telefon görüntülerine yeniden baktım. Açık kalan notlar: düzenleme penceresindeki öneri ("Bilinen sorunlar"), pano kaydırması (Ç4 kapsamı) |
| Faz, 2. tur (`c2fe453`) | GEÇTİ | Engelleyici yok. 2 önemli: (1) "modül başka modülü içe aktarmaz" testi tek `../` ile yazılan kardeş modül yolunu kaçırıyor; (2) "hata olursa geri alınır" kuralının testi yok (kod var). 10 not: ilerleme kaydında iki yanlış ayrıntı (90 dk kısıtının test dosyası; tek seferlik blokta gün tipi); blok ve seride tür ve gün tipi düzenlenemiyor, elle doğrudan iş kalemi eklenemiyor; "Durdur", "Bugün bitenler", "Geri al" dokümanda yok; dört yazma iyimser değil; telefonda yüzen düğme o an altında kalan satırın "Bitti" işaretini örtüyor; tip üretimi kapısı yok, lint `it.fails` ve `test.fail` yazımlarını kaçırıyor; `/api/export` içindeki oturum denetimi ayrı sınanmıyor; şablonda `source.type` sabit ve README söylemiyor; "süre doldu" kartında "Başka bir şey yapıyorum" yok; iptal edilip geri alınan seri bloğu serinin sonraki düzenlemelerini izlemiyor | İki önemli bulgu düzeltildi: test göreli yolu çözüp modülün kendi klasöründe kaldığına bakıyor, sekiz yazım örneğiyle kendini de sınıyor (`tests/unit/modules.test.ts`); `work-sessions.spec.ts` içinde yazma isteği kesilerek listedeki "Bitti" ve karttaki "Başla" için önce ekranın değiştiği, sonra geri alındığı, bildirimin çıktığı ve veritabanının değişmediği sınanıyor. Notlardan: iki kayıt düzeltildi; `docs/05-arayuz.md` "Ç1 ara hali"; lint `fails` ve `fail` yazımlarını da reddediyor (testiyle); `/api/export` için oturumsuz birim testi; README satırı. Açık kalan notlar "Bilinen sorunlar"da: elle iş kalemi, iyimser olmayan dört yazma, geri alınan seri bloğu, yüzen düğme (Ç4), "süre doldu" kartı (Ç3), tip üretimi kapısı |
| Faz, 3. tur (`3170917`) | GEÇTİ | Engelleyici yok. 2 önemli: (1) kalemin oturum işi açıkken (Başla → Durdur) kalemin adı, son tarihi ya da önemi değişirse Bugün listesi oturum işinin eski değerlerini gösteriyor ve onlarla sıralıyor; (2) zarf tanımadığı ya da yanlış yazılmış alanı sessizce atıyor (`when.deu` kabul edilip iş son tarihsiz açılıyor). 8 not: eşitleme testindeki iki satırın beklentisi yok; kapatılan kalemin biten oturum işi "Geri al" ile açılabiliyor; durdurulmuş oturum işi varken "süre doldu" sorusu sorulmuyor; veri modeli örneğinde zarfta olmayan `module` alanı; mimari dokümanında `src/core/app/` yok (eklendi); alan sayfası (`/a/[slug]`) hiçbir fazın kapsamında değil; `formatDue` birim testi yok; telefon genişliğinde yalnızca üç test dosyası çalışıyor | Üçüncü tur son turdu; iki önemli bulgu yine de düzeltildi ve düzeltme sonradan adım kipinde denetletildi (sonucu aşağıdaki "Adım denetimleri" tablosunun son satırında). (1) Yeni migration: açık oturum işi kalemin adını, son tarihini, önemini, enerji ve bağlamını, doluysa oturum süresini izler (`sync_open_sittings` tetikleyicisi); veritabanı testi ve uçtan uca test (`edit-work.spec.ts`, "a stopped sitting follows its item"). (2) Zarf şeması iç nesneleriyle birlikte katı; on yanlış yazım örneğiyle testi var; dokümandaki örnekten `module` çıkarıldı. Açık kalan notlar "Bilinen sorunlar"da |

Not: 1. turun düzeltmeleri sürerken oturum kullanım sınırına takıldı ve değişiklikler commit'siz kaldı; sonraki oturum denetçi raporunu oturum kaydından okuyup işi tamamladı.

Adım denetimleri:

| Denetim | Karar | Bulgular | Ne yapıldı |
| --- | --- | --- | --- |
| Adım 2: şema ve RLS | (önceki oturum) | 2 engelleyici, 5 önemli | Hepsi düzeltildi (`bca9f33`) |
| Adım 3: iş zarfı ve sözleşme | (önceki oturum) | Engelleyici yok, 8 önemli | Hepsi düzeltildi (`2cd1cd1`) |
| Adım 5–7: modül arayüzü, `deneme`, ayarlar, örnek veri, düzenleme (`cac1403..a4281f3`) | GEÇTİ | Engelleyici yok, 7 önemli: (1) 5'in katı olmayan süre tarayıcı doğrulamasına takılıyor, hızlı girişte de; (2) açık oturum işi olan kalemin eylemlerine ulaşılamıyor; (3) arşivlenip yeniden açılan modülün işleri geri gelmiyor, davranış yazılı değil; (4) bazı yeni davranışların testi yok; (5) bu dosya güncel değil; (6) sözleşme dokümanı ile kod örtüşmüyor; (7) `deneme` her bağlantı noktasını örneklemiyor | Hepsi düzeltildi: formlar kendi doğrulamasını yapıyor (12 ve 37 dk testleri); modül sayfasında kalem tek satır, oturum işi ayrıca listelenmiyor; arşiv geri çekme işareti bırakıyor, yeniden teklif geri getiriyor (veritabanı ve uçtan uca test); eksik testler yazıldı (gelen kutusunda uzun giriş, okuma hatası, "Devam et", `Shift+Enter`, iki genişlikte düzenleme); sözleşmeye "modül çekirdekten neyi içe aktarabilir" eklendi, dosya listesi düzeltildi; `deneme`'ye `onArchive` ve `ui.history` eklendi. Notlardan: grafik anahtarları, kararlar tablosundaki boşluk, iki zayıf birim testi, sayı içeren uyarı metni düzeltildi; kalanlar "Bilinen sorunlar"da |
| Faz denetimi 3. tur düzeltmeleri: oturum işi tetikleyicisi, katı zarf (`3170917..9ee52bc`) | GEÇTİ | Engelleyici yok, 2 önemli: (1) bu dosya adım denetimini, denetim çalışmadan önce "yapıldı" diye yazmıştı; (2) açık oturum işi kalemin oturum süresini izlemiyordu. 4 not: test `doing`, `waiting` ve `dropped` durumlarını sınamıyor; oturum işi kalemin kaynak değişimini izlemiyor; açık oturum işi kalemin en erken başlangıç ve bağımlılık denetimlerinden geçmiyor; tetikleyici beş alanı birlikte kopyalıyor (bugün sorun değil) | İkisi de düzeltildi: kayıt düzeltildi (bu satır); tetikleyici oturum süresini de izliyor, test `doing` ve `dropped` durumlarını ve süreyi de sınıyor. Test, ilk yazdığım ifadedeki bir hatayı yakaladı (Postgres'te `greatest` boş değeri atlıyor; süre silinince oturum işi 5 dakikaya düşüyordu) ve düzeltildi. Kalan notlar "Bilinen sorunlar"da. **Bu son düzeltme (migration'daki tek ifade ve testi) ayrıca denetlenmedi**; `npm run check:full` onunla yeşil |

Denetçinin 14. notu doğru: 5. ve 6. adımlar ile örnek veri tek commit'te (`9486fea`) geldi ve adım denetimi 7. adımdan sonra yapıldı. Önceki oturum kullanım sınırına takılıp bu adımları commit'siz bıraktığı için kurtarılan iş tek parça olarak işlendi; sonraki fazlarda adım başına commit ve denetim.

#### Ç2 için notlar

- **Canlı eşitleme testleri önce çalışır** (`esitleme` projesi). Supabase Realtime kapanan sayfanın aboneliğini yaklaşık 15 saniye tutuyor ve her değişikliği hesabın bütün aboneliklerine ayrı ayrı sayıyor; onlarca test sayfa açıp kapatınca yerel sınır (saniyede 100 ileti) aşılıyor ve iletiler düşüyor. Canlı güncellemeye dayanan yeni test `sync.spec.ts` içine yazılmalı; başka dosyada dışarıdan yapılan değişikliği ekranda bekleyen test kırılgan olur.
- **Next.js çıkılan sayfayı belgede gizli tutuyor** (`cacheComponents`). Uçtan uca testte gezinmeden hemen sonra tıklamadan önce yeni adres beklenmeli; yoksa Playwright gizlenen sayfadaki öğeye takılır. Modül bileşenleri belgede tekil olduklarını varsaymamalı.
- **Modül eylemleri tarayıcıda art arda yazar** (kendi kaydı → `propose` → `emit`). Arada sayfa kapanırsa kayıt teklifsiz kalır. `deneme` bunu yalnızca `onActivate` içinde yeniden teklif ederek kapatıyor; gerçek modüllerde sayfa açılışında "kayıtlarımın teklifleri yerinde mi" denetimi düşünülmeli (Ç2'nin `size` çağrısı da aynı zincire eklenecek). Ç5'te sunucu tarafı yazma yolu gelince zincir tek istekte yürütülebilir.
- Ç2 `size` çağrısı `default` kaynaklı eforu ezebilir, `user` kaynaklıyı ezemez; kural `mergeProposal` içinde. Düzenleme pencereleri yalnızca değişen alanı gönderir; yapay zekanın koyduğu değerin işareti ve gerekçesi için `provenance` ve `ai` sütunları hazır.
- Serbest metin şimdilik hep gelen kutusuna düşüyor; `enrich` buraya bağlanacak (`src/core/ui/QuickAdd.tsx` içinde modül seçilmeden gönderim, `src/core/intake/`).
- `IntakeType.examples` ve `sizingHints` tanımlı ama henüz hiçbir yerde okunmuyor; Ç2'de okunacak.
- Başarısız okuma: Supabase istemcisi okumayı kendisi 3 kez dener; TanStack tarafında yeniden deneme kapalı. Yapay zeka rotaları için ayrı düşün (POST yeniden denenmez).
- Kapı süresi: `check:full` yaklaşık 3 dakika. Veritabanı testleri dosya dosya, uçtan uca testler tek işçiyle çalışır (tek hesap, tek posta kutusu).
- Uçtan uca testler her testten önce yerel hesabı boşaltır; örnek veriyle bakmak için `npm run db:seed` (dolu hesapta `-- --reset`).
- **Zarf artık tanımadığı alanı reddediyor** (iç nesneler dahil). Ç2'de zarfa alan eklenecekse (ör. yapay zeka gerekçesi) önce şemaya ve sözleşme dokümanına eklenmeli; model çıktısı zarfa çevrilirken fazladan alan hata verir, sessizce atılmaz.
- **Açık oturum işi kalemini izler** (`sync_open_sittings`): `size` çağrısı kalemin önemini ya da oturum süresini değiştirince açık oturum işi de değişir. Oturum işine doğrudan yazılan değer kalemin bir sonraki değişikliğinde ezilir.
- Yeni migration her zaman yeni dosyadır; `c1-tamam` etiketinden sonra var olan migration yerinde düzenlenmez.
- Açık kalan Ç1 notları "Bilinen sorunlar"da toplu duruyor; Ç2'nin dokunduğu yerlerde (hızlı giriş, gelen kutusu, düzenleme pencereleri) fırsat olursa kapatılabilir: düzenleme penceresinde kaleme çevirme önerisi, elle iş kalemi ekleme, tip üretimi kapısı.

## Sıradaki adım

Ç2 (Yapay zeka geçidi): yeni oturumda `docs/10-yapay-zeka.md`, `docs/06-modul-sozlesmesi.md` ve `docs/03-veri-modeli.md` okunarak başlanır. D3 (`ANTHROPIC_API_KEY`) verilmediyse sahte sağlayıcıyla geliştirilir.

## Senden bekleyenler

### Kapandı: aynı anda iki faz betiği (10 Kas 2026, 23:25)

21:50'de başlatılan eski betik penceresi kapatıldı ve `docs/BEKLIYOR.md` silindi; kararı ben verdim (yeni betik kalsın). Betiğe aynı anda ikinci kez çalışmayı engelleyen bir kilit eklendi (`logs/runner.pid`). Bu konuda yapılacak bir şey yok; `c0-tamam` etiketi yerinde.

### D1. Bulut ve yayın: tamamlandı (11 Kas 2026, 08:35; benim payım bitti, sıra sende)

**Durum (11 Kas 2026, 12:45): senin payın tamam, benim payım gözetimsiz oturumda yapılamadı. Bulutta hiçbir şey açılmadı, hiçbir şey gönderilmedi.** Ç1 etiketlendikten sonra bağlantıya başladım. Girişler yerinde (Supabase CLI: `mealprep-easy` kuruluşu, içinde proje yok; Vercel CLI: giriş yapılmış; `gh` kurulu değil). İlk adımda (`supabase projects create sherpa-dev`) oturumun izin düzeni komutu reddetti: gözetimsiz çalışmada gerçek dünyada kaynak açan işlemlere izin verilmiyor. Kural gereği yeniden denemedim ve başka yoldan dolanmadım.

Ayrıca doğrulayamadığım bir şey: `mealprep-easy` kuruluşunun planı. CLI planı göstermiyor. Ücretsiz plandaysa iki proje ücretsiz; ücretli bir plandaysa her yeni proje ücret çıkarır. Aşağıdaki yollardan birini seçmeden önce Supabase panosunda kuruluşun planına bak.

Senden gereken (birini seç):

1. **Başında durduğun bir oturum (önerilen).** VS Code'da Claude Code'u aç ve "`docs/ILERLEME.md` içindeki D1'i bağla" yaz; izin sorularını tek tek onayla. Sıra aşağıdaki "Benim yapacaklarım" listesidir; yaklaşık yarım saat sürer ve sonunda üretim adresinde giriş kodunu senin yazman gerekir.
2. **Gözetimsiz devam etsin istiyorsan** `.claude/settings.json` içinde şu komutlara izin ver: `npx supabase projects create`, `npx supabase link`, `npx supabase db push`, `npx supabase config push`, `npx vercel`, `git push`. Sonra bu paragrafın başına "izin verildi" yaz; sıradaki oturum bağlantıyı yapar.

**Gözetimsiz oturumlar için not:** bu paragrafta "izin verildi" yazmıyorsa D1'i yeniden deneme; yerel Supabase ile devam et.

Supabase ve Vercel girişleri yapıldı (`npx supabase login`, `npx vercel login`), GitHub'da özel `sherpa` deposu açıldı, `.env.d1` dolduruldu. Vercel'de proje elle kurulmadı; kurulumu sen komut satırından yap. Aşağıdaki "Benim yapacaklarım" listesi artık yapılabilir.

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

### D3. Yapay zeka anahtarı (Ç2'nin başında)

Ç2 sahte sağlayıcıyla geliştirilip sınanır; gerçek çağrılar için:

1. Anthropic Console'da bir API anahtarı aç (ücretli; aylık sınır `docs/10-yapay-zeka.md` içinde 5 $ olarak tasarlandı, Console'da ayrıca harcama sınırı koyabilirsin).
2. Anahtarı sohbete yazma; depo kökündeki `.env.local` dosyasına `ANTHROPIC_API_KEY=...` satırı olarak ekle (`.env*` depoya girmez).
3. Bu başlığa "tamamlandı" yaz. Ç2 oturumu gerçek çağrı gerektiren testleri o zaman çalıştırır.

### Ç1'den sana kalanlar (elle doğrulanacak)

- Gerçek telefonda eklenen işin masaüstünde yenilemeden görünmesi (D1 ve D2'den sonra).
- `src/modules/_sablon/README.md` adımlarıyla 15 dakikada boş modül: bir kez dene, süre tutuyor mu söyle.
- "Verdiğim kararlar" ve "Bilinen sorunlar" içinde **Görüşün gerek** yazan satırlar.
- Ekran görüntüleri: `docs/ekran-goruntuleri/c1/`.

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
| 11 Kas 2026 | Ç1: çekirdek migration'ı (`20261110203434_core_tables.sql`) faz içinde dört kez yerinde düzenlendi (denetim düzeltmeleri, oturum işinin kaynağı, arşiv işareti) ve yerel veritabanı `db:reset` ile yeniden kuruldu. **D1'den sonra bu yasak:** bulut projesine uygulanmış migration değiştirilmez, yeni migration açılır | Henüz hiçbir bulut projesi yok; şemanın tek dosyada okunur kalması daha değerli. Faz etiketinden sonra da yeni migration açılır | `supabase/migrations/*` |
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
| 11 Kas 2026 | Ç1: `deneme` modülü yalnızca `NEXT_PUBLIC_SHERPA_DEMO_MODULE=1` iken kaydolur; `.env.example` yerel geliştirme için açık verir. `deneme_items` tablosu her ortamda açılır | Sınama modülü üretim verisiyle karşılaşmasın; migration zinciri ortamlar arasında aynı kalsın | `src/modules/registry.ts`, `.env.example`, `supabase/migrations/20261110213756_deneme_items.sql` |
| 11 Kas 2026 | Ç1: `/m/<slug>` altındaki her adres tek rotadan (`[[...path]]`) çözülür; tam ekran görünümler ayrı rota grubunda (`(tam)`), kabuk hiç çizilmeden. Kodu olmayan modül satırının sayfası çekirdeğin varsayılanlarıyla açılır | Modül, çekirdeğe dosya eklemeden sekme ve alt sayfa ekleyebilsin; örnek veri modülleri de gezilebilsin | `src/app/(app)/m/[slug]/[[...path]]`, `src/app/(tam)`, `src/core/ui/module/*` |
| 11 Kas 2026 | Ç1: modül sayfasının çekirdek varsayılanları: durum şeridi (çip metni, haftalık raporun sayıları, en çok 2 öneri), yaklaşanlar (bekleyen ve henüz başlamamış işler dahil), geçmiş (modül vermezse haftalık harcanan süre), giriş ve ayarlar. **Görüşün gerek** | `docs/05-arayuz.md` beş bölgeyi sayıyor, içeriğini modüle bırakıyordu; boş modül de dolu bir sayfa versin | `src/core/ui/module/ModulePageShell.tsx`, `docs/05-arayuz.md` |
| 11 Kas 2026 | Ç1: elle düzenlemenin yeri modül sayfasının "Yaklaşanlar" bölgesi (iş, kalem, ritim) ve Ayarlar → Sabit bloklar (blok, seri). Pencere yalnızca değişen alanı yazar. "Bırak", "Durdur", "Seriyi bitir" onaysız tek dokunuş. **Görüşün gerek** | Bugün ekranı seyrek kalsın; kullanıcının dokunmadığı alan "kullanıcının" sayılmasın. Onay konusu denetçinin notu; karar senin | `src/core/ui/EditDialog.tsx`, `src/core/ui/work/EditWork.tsx`, `src/core/ui/settings/BlocksSettings.tsx` |
| 11 Kas 2026 | Ç1: modül sayfasında açık oturum işi olan kalem tek satırdır; oturum işi ayrıca listelenmez. **Test değişikliği:** `select.test.ts` içindeki `moduleUpcoming` beklentisi buna göre değişti (önce oturum işi listeleniyor, kalem gizleniyordu) | Adım denetimi: kalem gizlenince düzenleme ve kapatma eylemlerine ulaşılamıyordu | `src/core/today/select.ts`, `src/core/today/select.test.ts` |
| 11 Kas 2026 | Ç1: arşiv, modülün teklif ettiği kayıtlara geri çekme işareti bırakır; modül yeniden etkinleşip aynı `key` ile teklif edince kayıt geri gelir. Elle eklenen ve kullanıcının kendi kapattığı işler geri gelmez. **Test değişikliği:** `deneme-module.spec.ts` yeniden etkinleştirmeden sonra işin `dropped` kalmasını bekliyordu; artık `active` bekliyor | Adım denetimi: `onActivate` yorumu ile test çelişiyordu ve davranış yazılı değildi. Modülü yeniden açan kullanıcı açık kayıtlarının işlerini geri ister | `supabase/migrations/20261110203434_core_tables.sql` (`archive_module`), `docs/06-modul-sozlesmesi.md`, `tests/db/envelope.test.ts` |
| 11 Kas 2026 | Ç1: bir günün blokları o güne değen bütün bloklardır (gece yarısını aşan blok iki günde de görünür); oturum işi kalemin kaynağını taşır; gelen kutusunda 90 dakikayı aşan giriş iş kalemi olur; eforu dolan kalem kendiliğinden kapanmaz, şimdi kartı sorar; veri okunamazsa boş gün yerine "Veri okunamadı" gösterilir | Önceki oturumun commit'siz kalan kararları; dokümanlara işlendi (`docs/05-arayuz.md`, `docs/09-kararlar.md`) | `src/core/today/select.ts`, `src/core/ui/today/*`, `src/core/ui/inbox/InboxScreen.tsx`, `start_session` |
| 11 Kas 2026 | Ç1: hızlı giriş kutusu çok satırlı metni korur (`Enter` kaydeder, `Shift+Enter` satır ekler); formlar tarayıcı doğrulamasını kullanmaz, kendi denetimini yapar; açılır kutular kendi adını taşır (`aria-label`) | Yapılı blok satırlarını korusun; `step` kuralı "12dk"yı reddediyordu; etiket içindeki açılır kutu adına seçili değeri de katıyordu | `src/core/ui/QuickAdd.tsx`, `src/core/ui/EditDialog.tsx`, `src/core/ui/settings/BlocksSettings.tsx` |
| 11 Kas 2026 | Ç1: başarısız okuma istemcide ikinci kez yeniden denenmez (`retry: false`) | Supabase istemcisi okumayı kendisi 3 kez deniyor (1, 2, 4 sn); üstüne deneme hata bildirimini 15 saniyeye geciktiriyordu | `src/core/app/CoreProvider.tsx` |
| 11 Kas 2026 | Ç1: bileşen takımının grafik renkleri (tek seri için bir mavi, büyüklük için açıktan koyuya tek renk; koyu temada sıra ters). Modül grafiği modülün kendi rengini kullanır. **Görüşün gerek** | Renk anlam taşısın, iki temada da okunsun | `src/app/globals.css`, `src/core/ui/kit/charts.tsx` |
| 11 Kas 2026 | Ç1: dışa aktarım sunucu rotasıdır (`/api/export`), veriyi kullanıcının kendi yetkisiyle okur; modül tablolarını kayıttaki `tables` listesinden alır | RLS "bütün veri"nin ne olduğunu belirlesin; servis anahtarı kullanılmasın | `src/app/api/export/route.ts`, `src/core/data/export.ts` |
| 11 Kas 2026 | Ç1: örnek veri yalnızca yerel Supabase'e, hesabın kendi yetkisiyle ve modül işlerini zarfla (`propose`) yazar; dolu hesaba ancak `--reset` ile. Betik `scripts/seed-demo.ts`, veri `scripts/demo-data.ts` | "Üretim verisine yazılmaz"; veri gerçek yoldan geçsin ki çekirdek onunla sınanabilsin. Ekran görüntüleri de aynı veriyi kullanır | `scripts/*`, `tests/db/seed.test.ts`, `tests/e2e/screenshots.spec.ts` |
| 11 Kas 2026 | Ç1: uçtan uca testlerde canlı eşitleme testleri ayrı projede ve en önce çalışır (`esitleme`). **Test değişikliği:** `work-sessions.spec.ts` ilk testinde "başlangıç geri alınınca kart izler" adımı artık sayfayı yeniden yükleyerek bakıyor (sunucu saatini sınıyor); yenilemeden izleme `sync.spec.ts` içinde sınanmaya devam ediyor | Realtime kapanan sayfaların aboneliklerini 15 sn tutuyor; 100 testlik koşuda her değişiklik onlarca kez sayılıp yerel sınırı (100 ileti/sn) aşıyor ve iletiler düşüyordu. Gerçek kullanım iki cihaz | `playwright.config.ts`, `tests/e2e/work-sessions.spec.ts` |
| 11 Kas 2026 | Ç1: ekran görüntüleri örnek veriyle alınır; panoda tam sayfa, telefonda ekranın gösterdiği (uzun sayfada ayrıca sonu) | Telefonda alt çubuk ekrana sabit; tam sayfa görüntüde sayfanın ortasında çıkıyordu | `tests/e2e/screenshots.spec.ts` |
| 11 Kas 2026 | Ç1: arayüz metinleri (modül sayfası, ayarlar, düzenleme pencereleri, bildirimler), önem adları (Düşük, Normal, Yüksek, Çok yüksek), "Önümüzdeki 4 hafta" listesi. **Görüşün gerek** | Kısa ve düz, ünlemsiz | `src/core/ui/**` |
| 11 Kas 2026 | Ç1: şablonun yalnızca adı değiştirilmiş kopyası (`sablon-kopya`, "Şablon kopyası") `deneme` ile aynı anahtarın arkasında kaydolur | Faz denetimi: "şablondan kopyalanan modül çalışır" ölçütünün kalıcı kanıtı yoktu. Bedeli: yerel geliştirmede Ayarlar → Modüller listesinde kapalı bir "Şablon kopyası" satırı görünür; üretimde kaydolmaz | `src/modules/registry.ts`, `tests/e2e/template-module.spec.ts`, `src/modules/_sablon/README.md` |
| 11 Kas 2026 | Ç1: modülün çekirdekten içe aktarabileceği yollar kapalı listedir; test denetler. `@/lib/supabase/database.types` listeye eklendi | Faz denetimi: `@/core/data/*` içe aktaran modül testten geçiyor ve çekirdek tabloya zarfsız ulaşabiliyordu | `tests/unit/modules.test.ts`, `docs/06-modul-sozlesmesi.md` |
| 11 Kas 2026 | Ç1: seri bitirilince gelecek blokları silinir (elle değiştirilmiş ve iptal edilmişler dahil); arşivde `cancelled` olur | Davranış vardı ama yazılı değildi (faz denetimi notu). Seri kullanıcının kaldırdığı kuraldır, bloklar türevidir | `docs/03-veri-modeli.md`, `docs/09-kararlar.md` |
| 11 Kas 2026 | Ç1: hızlı girişte modülün sayı alanı kendi sınırlarının dışındaysa kayıt kapalıdır (Enter da kaydetmez); `deneme` 5 dakikadan kısa süreyi boş sayar | Faz denetimi notu: 1–4 dk girilen hedefte kayıt yazılıyor, teklif reddedilip kayıt teklifsiz kalıyordu | `src/core/ui/QuickAdd.tsx`, `src/modules/deneme/module.ts`, `tests/e2e/deneme-module.spec.ts` |
| 11 Kas 2026 | Ç1: modül dosyalarının göreli içe aktarımları çözülür ve modülün kendi klasöründe kalmak zorundadır; `@/modules/…` ile yalnızca kendi klasörü yazılabilir. **Test değişikliği:** "imports no other module" testi sıkılaştırıldı (önce yalnızca `@/modules/<başka>` ve `../../` yakalanıyordu) | Faz denetimi (2. tur): kök dosyadan `../deneme/…` ya da `../registry` testten geçiyordu | `tests/unit/modules.test.ts` |
| 11 Kas 2026 | Ç1: test dosyalarında `it.fails` ve `test.fail` de lint hatası | "Başarısız olması beklenen test" yeşil görünen atlanmış testtir (Ç0 notu, 2. tur faz denetimi) | `eslint.config.mjs`, `tests/unit/test-gates.test.ts` |
| 11 Kas 2026 | Ç1: Bugün ekranındaki "Durdur", "Bugün bitenler" ve "Geri al" dokümana "Ç1 ara hali" olarak yazıldı; Ç3'te kart yeniden kurulurken kalıp kalmayacaklarına bakılır. **Görüşün gerek** | Faz denetimi (2. tur): kodda olup dokümanda olmayan davranış | `docs/05-arayuz.md`, `docs/09-kararlar.md` |
| 11 Kas 2026 | Ç1: açık oturum işi kalemini izler (ad, son tarih, önem, enerji, bağlam; kalemde oturum süresi doluysa süre de); bunu veritabanı tetikleyicisi yapar (`sync_open_sittings`, yeni migration; çağıranın yetkisiyle çalışır). Bitmiş ve bırakılmış oturum işleri eski değerleriyle kalır. Bu migration adım denetiminden sonra bir kez yerinde düzenlendi (oturum süresi eklendi); etiketten sonra yerinde düzenleme yok | Faz denetimi (3. tur): durdurulmuş oturum işi listede kalemin yerine geçiyor, kalem değişince eski ad ve tarihle sıralanıyordu. Tetikleyici: kalemi değiştiren iki yol (kullanıcı düzenlemesi, modül teklifi) ve ileride gelecekler tek yerde, aynı işlemde çözülsün; ekranın her okuyanı aynı değeri görsün. Ç3'te oturum işleri kendi adını taşıyacaksa (ör. "2. oturum") yeniden bakılır | `supabase/migrations/20261111092223_open_sittings_follow_item.sql`, `docs/03-veri-modeli.md`, `tests/db/sessions.test.ts`, `tests/e2e/edit-work.spec.ts` |
| 11 Kas 2026 | Ç1: zarf tanımadığı alanı reddeder (iç nesneler dahil; `meta` serbest). **Test değişikliği:** `envelope.test.ts` içindeki "dokümandaki zarf" örneğinden üst düzey `module: "okul"` alanı çıkarıldı; dokümandaki örnekten de çıkarıldı (sözleşmedeki tipte hiç yoktu, modül bağlamdan bilinir) | Faz denetimi (3. tur): yanlış yazılmış alan sessizce atılıyor, iş son tarihsiz ya da eforsuz açılıyordu. Yapılı bloklar ve Ç5 köprüsü tip denetiminden geçmeyen girdi verir | `src/core/contract/envelope.ts`, `src/core/contract/envelope.test.ts`, `docs/03-veri-modeli.md`, `docs/06-modul-sozlesmesi.md` |

## Bilinen sorunlar

- **Realtime sınırı.** Yerel Realtime saniyede 100 iletide değişiklikleri düşürüyor; kapanan sayfaların abonelikleri 15 sn kaldığı için bu yalnızca uzun test koşularında oluyor (testler buna göre sıralandı). Gerçek kullanımda iki cihaz var, ama toplu yazma (uzun bir seri, örnek veri) bulut projesinde de sınıra yaklaşabilir; o durumda öbür cihaz değişikliği güvenlik ağıyla (en geç 1 dakika, pencere öne gelince) alır. Bulut projesinin sınırlarına D1'de bakılacak.
- Modül eylemleri tarayıcıda art arda yazar (kayıt → teklif → olay); arada sayfa kapanırsa kayıt teklifsiz kalır ("Ç2 için notlar").
- Gece yarısını aşan blok düzenleme penceresinden değiştirilemez (pencere bitişi aynı güne yazar ve "bitiş başlangıçtan sonra" ister). Böyle bir blok bugün yalnızca zarfla ya da veriyle oluşabilir.
- Serinin günü değiştirilince eski gündeki elle değiştirilmiş ya da iptal edilmiş bloklar yerinde kalır; testi yok.
- "Seriyi bitir" (elle değiştirilmiş gelecek blokları da siler), "Bırak" ve "Durdur" onaysız ve arayüzden geri alınamaz; durdurulan ritim hiçbir listede görünmez. Onay ya da "Geri al" isteyip istemediğine sen karar ver.
- 90 dakikayı aşan süre düzenleme penceresinde yalnızca "Kaydet"i kapatır; hızlı giriş ve gelen kutusundaki gibi kaleme çevirme önerisi yok.
- Sabit blok ve seride tür ile gün tipi sonradan değiştirilemez; yolculuk süreleri için arayüz yok.
- `deneme` kodu üretim paketinde bulunur (kaydolmaz); `deneme_items` tablosu üretimde de açılır. Yerel geliştirmede modül listesinde ayrıca kapalı bir "Şablon kopyası" satırı görünür (şablonu sınayan testin modülü).
- Pano genişliğinde Bugün ekranı örnek veriyle bir ekrandan uzun (kaydırma var); "kaydırma yok" pano yerleşimi Ç4'ün işi.
- İş kalemi elle yalnızca hızlı girişte ya da gelen kutusunda 90 dakikayı aşan süreyle oluşur; doğrudan "iş kalemi ekle" ve alt kalem (`parent_id`) arayüzü yok. Modüller zarfla her ikisini de üretebiliyor. **Görüşün gerek:** hızlı girişe "İş kalemi" seçeneği istenir mi?
- Tek seferlik blokta gün tipi verilemiyor (form: ad, tür, tarih, başlangıç, bitiş).
- İyimser olmayan yazmalar: iş kalemi ekleme, ritim ekleme, seri ekleme ve bitirme (yanıt gelince görünür; hata olursa bildirim çıkar). Öbür yazmalar iyimser ve hata olursa geri alınır (`work-sessions.spec.ts`, "a write that fails…").
- İptal edilip geri alınan seri bloğu "kullanıcı dokundu" işaretini taşımaya devam eder; serinin saati sonradan değişirse bu blok eski saatinde kalır. Testi yok.
- Telefonda yüzen "Yeni giriş" düğmesi, listenin o an ekranın altına denk gelen satırındaki "Bitti" işaretini örter (kaydırınca erişilir); Ç4 telefon cilasında ele alınacak.
- "Ayrılan süre doldu. Bitti mi?" kartında "Başka bir şey yapıyorum" yok (yalnızca Bitti ve Devam et); Ç3'te kart yeniden kurulurken.
- Migration'dan sonra tiplerin yeniden üretildiğini denetleyen kapı hâlâ yok (Ç0 notu). Faz denetçileri elle karşılaştırdı: depodaki tipler şemayla aynı.
- Kalem "Bitti" ile kapanınca açık oturum işi de biter ve "Bugün bitenler"e düşer; oradaki "Geri al" oturum işini açar, kalem kapalı kalır (kapalı kalemin işi Bugün'e döner). Kod okumasıyla bulundu (3. tur notu), çalıştırılarak doğrulanmadı; Ç3'te "Bugün bitenler" yeniden ele alınırken düzeltilecek.
- Durdurulmuş oturum işi kalemin yerine geçtiği sürece "Ayrılan süre doldu. Bitti mi?" sorulmaz (kart kalemi değil oturum işini görür); Ç3'te kart yeniden kurulurken.
- Açık oturum işi Bugün listesinde kalemin `earliest_at`, bağımlılık ve durum denetimlerinden geçmez (bunlar yalnızca açık oturum işi olmayan kaleme uygulanır): durdurulmuş oturum işi varken kalem ileri bir başlangıç ya da yeni bir bağımlılık alırsa iş listede kalır. Oturum işi kalemin kaynağındaki (`source_type`, `source_id`) değişikliği de izlemez. İkisi de kod okumasıyla bulundu (son adım denetiminin notları); Ç3'te oturum işleri haftalık planda üretilirken ele alınacak.
- `tests/e2e/sync.spec.ts` içindeki "a change made outside the app…" testi gelen kutusu girişi ve blok da ekliyor ama yalnızca işin ekrana ulaştığını bekliyor.
- Alan sayfası (`/a/[slug]`) `docs/05-arayuz.md` ve `docs/02-mimari.md` içinde var, hiçbir fazın kapsamında yok ve kodda yok; `areas` satırları açılıyor ama hiçbir ekran okumuyor. **Görüşün gerek:** hangi faza girsin?
- `formatDue` için birim testi yok; telefon genişliğinde yalnızca kabuk, Bugün ve modül sayfası testleri çalışıyor (gelen kutusu, sabit bloklar ve hızlı girişin telefon yerleşimi ekran görüntüsüyle duruyor; Ç4).
- Tarih kutuları tarayıcının kendi biçimini gösterir (ekran görüntülerinde "13-Nov-2026"); telefonda sistemin tarih seçicisi açılır.
- Ç1'de 5. ve 6. adımlar tek commit'te geldi (`9486fea`) ve adım denetimi 7. adımdan sonra yapıldı (önceki oturum kullanım sınırında commit'siz kaldı).
- Ç1, adım 2: `b87e5fb` commit'i lint kırmızıyken atıldı (komut zincirinde çıkış kodu yutuldu); 21 saniye sonra `6439e65` ile düzeltildi. O andan beri kapı komutları `pipefail` ile çalıştırılıyor.

- **D1 bağlantısı gözetimsiz oturumda yapılamıyor** (11 Kas 2026): bulut projesi açan komut izin düzenince reddedildi; ayrıntı ve senden gereken "Senden bekleyenler" → D1 altında. O zamana kadar her şey yerel Supabase ile sürüyor.
- Bulut yok: üretim adresi, bulut `dev` ve `prod` projeleri, gerçek e-posta gönderimi ve Vercel önizleme koruması D1'e kadar sınanamıyor. Yerel `config.toml` yalnızca yerel Supabase'i yönetir; aynı kimlik ayarları D1'de bulut projelerine aktarılıp `session.spec.ts` içindeki "yeni kayıt kapalı" sınamaları orada yinelenmeli.
- Uçtan uca testlerde sunucu günlüğüne iki kez `AuthApiError: Refresh token is not valid` düşer. Beklenen bir çıktıdır ("yenilenemeyen oturum kapatılır" testi sahte yenileme belirteci gönderir); hata değildir.
- Girişten sonra tarayıcıda oturum çerezinin yanında birkaç `…-code-verifier` çerezi kalıyor (Supabase istemcisinin PKCE akışından). Kod akışında kullanılmıyorlar; birikip birikmediğine bakılmadı. Giriş cihaz başına bir kez yapıldığı için sorun beklenmiyor; Ç4'te oturum davranışı elden geçirilirken bakılacak.
- `(app)` altındaki sayfalar korumayı `proxy`'den alıyor; yerleşimde ayrıca oturum denetimi yok (Ç0'da sayfalarda veri yok). `proxy` sunucu eylemlerini tek başına kapatmaz: `/giris` oturumsuz açık olduğu için başka bir sayfaya ait eylem o yoldan çağrılabilir (bugün tek eylem "çıkış yap", zararsız). Ç1'den itibaren veri okuyan ya da yazan her rota ve sunucu eylemi kendi içinde `getCurrentUser()` çağırmalı ve bu, oturumsuz çağrıyla sınanmalı; RLS ayrıca korur.
- Boş sayfalar (`/`, `/hafta`, `/m`, `/gelen`) statik üretiliyor ve paylaşımlı önbellek başlığıyla dönüyor (`s-maxage`). Yerelde `proxy` her isteğin önünde çalışıyor; Vercel'de de önbelleğin önünde çalıştığı D1'de sınanacak. Ç1'de veri taşıyan sayfaların statik kalmadığı denetlenecek.
- Adresi bilen biri Supabase'in açık ucundan doğrudan giriş kodu isteyebilir (form denetimi bu yolu kapatmaz). Giremez (kod gerekir), ama e-posta kotasını tüketip girişi geciktirebilir. Bulut projesinde hız sınırlarına D1'de bakılacak.
