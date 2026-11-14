# Yol haritası

Geliştirme iki hatta ilerler:

- **Çekirdek hattı (Ç0–Ç5):** Hiçbir modüle bağlı değildir. Tasarımı tamamdır; hemen başlanır.
- **Modül hattı (M):** Her modül kendi adımlarından geçer. Bir modüle, tasarımı ayrı bir oturumda ayrıntılanıp onaylanmadan başlanmaz.

Her faz tek başına kullanılabilir bir şey bırakır. Bir fazın kabul ölçütleri sağlanmadan sonrakine geçilmez. Her çekirdek fazının başlangıç istemi `prompts/` klasöründedir.

## Çekirdek hattı

| Faz | Sonunda elde ne var | Bağımlılık |
| --- | --- | --- |
| Ç0. İskelet | Yayında, giriş yapılan boş uygulama; telefonda kurulu | — |
| Ç1. Çekirdek ve modül temeli | Elle kullanılabilen iş havuzu, basit Bugün ekranı, modül sistemi | Ç0 |
| Ç2. Yapay zeka geçidi | Girişten ve modül tekliflerinden süre ve öncelik tahmini | Ç1 |
| Ç3. Planlayıcı | Plan ufukları, yuvalı gün planı, bitiş çizgisi, akşam kapanışı, Hafta ekranı | Ç1 (yapay zeka önerileri için Ç2) |
| Ç3b. Zaman kısıtları | İşlerin saat penceresi, kaçınılan saatleri, yol süresi ve dinlenme günü; planlayıcı bunlara uyar | Ç3 |
| Ç3c. Sahne ve günün çerçevesi | Modülün işi çalışırken Bugün ekranını devralan sahne, oturum ve gün olayları, sesli anlatım; uyanış, yatış, uyku planı, çapalı işler, akşam | Ç3b |
| Ç3d. Sunucu zemini | Uygulama kapalıyken çalışan taraf: cihaz anahtarları, giriş ucu, zamanlanmış işler, sunucuda modül bağlamı | Ç3c |
| Ç3e. Modülün bölümleri | Bir modülün içinde ayrı renk ve sahne taşıyan bölümler (rutinde Sabah ve Akşam, Okul'da dersler); renklerin Ayarlar'dan değişmesi | Ç3c |
| Ç3f. Çapalı diziler | Uyanışa ve yatışa bağlı işlerin tek akış olması: sahnenin diziyi görmesi (başka modülün adımları dahil), sıradaki işin kendiliğinden başlaması, dışarıdan gelen uyanıştan sonra başlama, sahneden akşam kapanışı | Ç3e |
| Ç4. Pano ve telefon cilası | Gün boyu açık duracak kalitede pano; uygulama gibi çalışan telefon | Ç3 |
| Ç5. Claude köprüsü | Claude sohbetleri Sherpa'yı okuyup yazar | Ç1 |

Ç5, Ç3 ve Ç4'ten bağımsızdır; ihtiyaç olursa öne alınır.

### Ç0: İskelet

**Kapsam**
- Next.js + TypeScript + Tailwind + shadcn/ui kurulumu; lint ve format
- Supabase `dev` projesi, migration akışı, tip üretimi
- Kimlik: e-postaya tek kullanımlık kod (ya da geçiş anahtarı), yeni kayıt kapalı, izinli e-posta, uzun ömürlü oturum
- Kalıcı adresin belirlenmesi (telefona kurulumdan önce)
- Uygulama kabuğu: gezinme (Bugün, Hafta, Modüller, Gelen kutusu, Ayarlar), açık ve koyu tema, boş sayfalar
- PWA manifesti ve simgeler
- Vitest kurulumu, örnek test
- Vercel'e yayın; önizleme dağıtımlarının korunması

**Kabul ölçütleri**
- [ ] Üretim adresinde izinli e-postayla giriş yapılıyor; başka e-posta reddediliyor
- [ ] Telefonda ana ekrana eklenince tam ekran açılıyor ve giriş uygulamanın içinde kodla yapılabiliyor
- [ ] Giriş yapılmadan hiçbir sayfa ve API rotası veri döndürmüyor
- [ ] `lint`, `test`, `build` komutları geçiyor ve `CLAUDE.md`'de yazılı
- [ ] Boş bir migration `dev`'e uygulanıp tipler üretilebiliyor

### Ç1: Çekirdek ve modül temeli

**Kapsam**
- `docs/03-veri-modeli.md` içindeki çekirdek tablolar, RLS ile (yapay zeka tabloları Ç2'de)
- İş kalemi, iş, ritim, sabit blok ve blok serisi için oluşturma, düzenleme, durum değiştirme
- Modül sistemi: `ModuleDefinition`, `registry.ts`, `ModulePageShell`, `_sablon` modülü
- Modül arayüzü zemini: sekmeler, alt sayfalar, tam ekran görünüm, hızlı eylemler, modül ayarları ve ortak bileşen takımı (`docs/06-modul-sozlesmesi.md`, "Modül arayüzü")
- İş zarfı: `propose` ve `withdraw`, `key` ile tekrar edilebilirlik, alan kaynağı (`provenance`), `onOutcome`. Efor boş gelirse bu fazda sınırın ortası yazılır
- Hızlı giriş (yapılı), gelen kutusu (serbest metin elle yönlendirilir), `sherpa` bloğu gibi yapılı blokların tanınması için kanca
- Oturumlar: Başla, Bitti, plansız iş
- Bugün ekranının ilk hali: planlayıcı yok; işler son tarihe ve öneme göre sıralı liste, günün sabit blokları, basit "şimdi" kartı
- Realtime: iki cihaz arasında anında güncelleme
- Ayarlar: modüller, sabit bloklar, dışa aktarım (JSON)
- **Deneme modülü ve örnek veri:** sözleşmenin her bağlantı noktasını kullanan küçük bir `deneme` modülü ve `scripts/seed-demo.ts` (birkaç sahte modülden gerçekçi kalemler, ritimler, bloklar). Gerçek modüller gelene kadar çekirdek bununla sınanır; üretim verisine yazılmaz

**Kabul ölçütleri**
- [ ] Telefonda eklenen iş, masaüstündeki Bugün ekranında yenilemeden görünüyor
- [x] 90 dakikadan uzun iş kaydedilemiyor; arayüz iş kalemine çevirmeyi öneriyor
- [x] Başla → Bitti bir oturum kaydı üretiyor; aynı anda iki açık oturum olamıyor
- [x] Haftalık bir blok serisi gelecek haftaların bloklarını üretiyor; tek bir blok iptal edilebiliyor
- [x] Aynı `key` ile iki kez teklif edilen zarf tek kayıt üretiyor; kullanıcının değiştirdiği alan ikinci teklifte ezilmiyor
- [x] `deneme` modülü çipini, sayfasını, girişini ve tekliflerini yalnızca sözleşme üzerinden veriyor; `src/core/` içinde `src/modules/` içe aktarımı yok (lint kuralıyla denetleniyor)
- [x] `deneme` modülü kendi sekmesini, alt sayfasını, tam ekran görünümünü, hızlı eylemini ve ayar formunu çekirdeğe dokunmadan ekliyor
- [ ] `_sablon` kopyalanarak yeni bir boş modül 15 dakikada ayağa kalkıyor (adımlar modül README'sinde yazılı)
- [x] Bütün veri JSON olarak dışa aktarılabiliyor

### Ç2: Yapay zeka geçidi

Tasarım: `docs/10-yapay-zeka.md`.

**Kapsam**
- `src/core/ai/`: tek geçit, istemler, çıktı şemaları ve doğrulama, zaman aşımı, yedek davranış
- `ai_calls` kaydı, aylık bütçe sınırı, `ai_feedback` (kullanıcı düzeltmeleri) ve bunların örnek olarak kullanımı
- `enrich`: hızlı girişteki serbest metni işe çevirme; emin olunmayan girişler için gelen kutusunda onay kartı
- `size`: modül tekliflerinde boş yargı alanlarının doldurulması (`sizingHints` ile)
- `decompose`: hedefi ya da büyük kalemi alt kalemlere bölme (öneri olarak)
- `extract`: yapıştırılan serbest metinden yapılı öneri çıkarma için genel altyapı (modüller kendi şemalarını verir)
- Arayüz: yapay zekanın koyduğu değerlerin işareti ve gerekçesi; ayarlarda kullanım ve maliyet görünümü
- `scripts/ai-eval/`: örnek girişlerle kalite denetimi

**Kabul ölçütleri**
- [ ] "Sunum slaytları cuma" yazınca iş birkaç saniye içinde modül, süre, önem ve son tarihle doluyor; değerler yapay zeka işaretini taşıyor
- [ ] Eforu boş teklif edilen zarf yapay zekanın tahminiyle doluyor; gerekçesi görünüyor
- [ ] Kullanıcının düzelttiği alan sonraki tekliflerde ve çağrılarda ezilmiyor; düzeltme `ai_feedback`'e düşüyor
- [ ] API anahtarı kaldırılınca serbest giriş gelen kutusuna düşüyor, zarflar sınırın ortasıyla doluyor ve uygulama hatasız çalışıyor
- [ ] Bütçe sınırı 0 yapılınca çağrı yapılmıyor; her çağrı `ai_calls` tablosunda maliyetiyle görünüyor
- [ ] Şemaya uymayan model çıktısı veriye yazılmıyor (testle)

### Ç3: Planlayıcı

Tasarım: `docs/04-planlayici.md`.

**Kapsam**
- `buildPlan`, `pickForMinutes`, `loadByWeek`, `commitWeek`; test kapsamıyla
- Plan ufukları: haftalık taahhüt, kalemlerin oturumlara bölünmesi, ay ufku için yük görünümü
- Bugün ekranının `plan.now` durumlarına göre yeniden kurulması; DayStrip, UpNext, AlertBar, "neden?"
- Bitiş çizgisi, "Bugün tamam", gece durumu, geri dönüş durumu
- "X dk'm var", "Yeniden planla", "Ertele", "Takıldım"
- Akşam kapanışı akışı
- Hafta ekranı: kapasite çubuğu, haftanın kalemleri ve modül payları, hayat modu, 6–8 haftalık yük
- Yapay zeka: günlük `plan` (kapanışta ya da günün ilk açılışında; sunucuda zamanlanmış iş yok), haftalık `week` ve `review`, aylık `month`, istek üzerine `replan`
- İkinci yarı: öğrenme (tahmin ve kapasite çarpanları)

**Kabul ölçütleri**
- [ ] `docs/04-planlayici.md` içindeki test listesinin tamamı yazılmış ve geçiyor
- [ ] Akşam kapanışı yapılmadan da sabah Bugün ekranı dolu geliyor
- [ ] Günün işleri bitince ekran "Bugün tamam"a geçiyor
- [ ] Bir sabit blok eklenince plan anında yeniden kuruluyor
- [ ] Yoğun modda örnek verideki ömürlük modülün tabanı korunuyor (testle)
- [ ] 3 gün kullanılmadıktan sonra geri dönüş ekranı açılıyor ve gecikmiş iş yığını göstermiyor
- [ ] Uzak bir kalem haftası gelene kadar oturumlara bölünmüyor; haftası gelince yalnızca o haftanın eforu bölünüyor
- [ ] Sabah planı yapay zekanın önerisini ve gerekçelerini taşıyor; yapay zeka kapatılınca plan yine geliyor
- [ ] Yapay zekanın zorunlu bir işi erteleme önerisi motor tarafından reddediliyor (testle)
- [ ] Hafta içinde tetikleyici yokken haftalık taahhüt değişmiyor

### Ç3b: Zaman kısıtları

Tasarım: `docs/03-veri-modeli.md` ("Zaman kısıtları"), `docs/04-planlayici.md` ("Zaman kısıtları"), `docs/05-arayuz.md` ("Zaman kısıtları"), `docs/06-modul-sozlesmesi.md`, `docs/10-yapay-zeka.md` (kural 12). Karar: `docs/09-kararlar.md`, 12 Kas 2026.

Ç3'ten sonra, modüller tasarlanmadan önce eklenen küçük bir çekirdek adımıdır: iş zarfına `timing` bölümü gelir, planlayıcı bu kısıtlara uyar.

**Kapsam**
- Migration: `work_items`, `tasks`, `rhythms` tablolarına `timing` sütunu (yalnızca ekleme)
- Zarf: `timing` şeması, doğrulaması, biçime göre izinli alanlar, alt alan başına kaynak; sabit zaman biçiminde `travel` → bloğun yol sütunları
- Planlayıcı: zaman süzgeci, ayak izi ve yol, bağlam ve yol kuralı, tercih ve kaçınma çarpanı, bekletme, dinlenme günü, aciliyet ve taban hesabı, hafta yükü ve uyarılar
- Yapay zeka: `enrich` açıkça yazılan kısıtı doldurur; planlama çağrılarının girdisinde kısıt özeti; `ai:eval` örnekleri
- Arayüz: formlarda "Zaman" bölümü, zaman çizelgesinde yol, kartta ve Sıradakiler'de yol, iki yeni uyarı
- `deneme` modülü: `timing`'in her alanını kullanan en az bir kayıt türü; örnek veride kısıtlı işler

**Kabul ölçütleri**
- [ ] `timing` taşımayan veride plan değişmiyor: Ç3'ün birim, veritabanı ve uçtan uca testleri hiçbiri değiştirilmeden geçiyor
- [ ] Zarf `timing`'i üç biçimde kabul ediyor, geçersizini adını söyleyerek reddediyor; kullanıcının değiştirdiği alt alanı modülün sonraki teklifi ezmiyor
- [ ] Penceresi 16:00–18:00 olan iş sabah yuvalarına konmuyor; saat gelince öneriliyor
- [ ] Kaçınılan saatte başka uygun yuva varken iş oraya konmuyor; yokken konuyor
- [ ] 60 dakikalık iş, 20 + 20 dakika yolla zaman çizelgesinde 100 dakika yer kaplıyor, yol ayrı görünüyor; oturum yalnızca çalışmayı ölçüyor
- [ ] Yol süreli iş ikinci ekranda da öneriliyor; telefonda işin bağlamı seçiliyken yol sayılmıyor
- [ ] Dinlenme günü olan ritim yapıldığı günün ertesinde önerilmiyor; taban tehlikesi kalan uygun günlere göre hesaplanıyor
- [ ] Bugün teslim olan işin uygun saati kalmadıysa iş pencere dışına konmuyor ve uyarı çıkıyor; haftada uygun saat yoksa Hafta ekranı söylüyor
- [ ] Kullanıcı pencere dışında bir işi elle başlatabiliyor
- [ ] Formdaki "Zaman" bölümünden girilen kısıt kaydediliyor, geçersizi kaydedilmiyor; özet satırı doğru
- [ ] Serbest girişte açıkça yazılan saat kısıtı işe işleniyor (sahte sağlayıcıyla uçtan uca; gerçek modelle `ai:eval`: açık pencere, açık kaçınma, açık yol, ve kısıt olmayan iki satırda boş kalma)
- [ ] `docs/04-planlayici.md` içindeki "Zaman kısıtları (Ç3b)" test listesinin tamamı yazılı ve geçiyor
- [ ] Migration önce `dev`, sonra `prod` projesinde; kod ondan sonra yayında

### Ç3c: Sahne ve günün çerçevesi

Tasarım: `docs/12-sahne-ve-otomasyon.md` (bölüm A–D); kurulduğu haliyle `docs/03-veri-modeli.md` (`days`, `settings.day_frame`, `timing.anchor`, `timing.order`, `timing.after_finish`), `docs/04-planlayici.md` ("Günün çerçevesi"), `docs/05-arayuz.md` ("Sahne", "Günün çerçevesi"), `docs/06-modul-sozlesmesi.md` ("Sahne", "Sesli anlatım", "Olaylar"). Karar: `docs/09-kararlar.md`, 12 Kas 2026.

Modüller tek tek tasarlanmadan önce altyapının üç katmana hazır olması için (kullanıcının kararı, 12 Kas 2026). Hiçbir şey bir modüle özel kurulmaz; her bağlantı noktasının örneği `deneme` modülündedir.

**Kapsam**
- Migration: `days` uyanış ve yatış sütunları, `settings.day_frame`; kalemin oturum işini açmayı kalem satırını kilitleyerek yapan veritabanı fonksiyonları (Ç3b'den kalan yarış)
- Zarf: `timing.anchor`, `timing.order`, `timing.after_finish`; doğrulama ve biçime göre izin
- Planlayıcı: günün başının uyanışa bağlanması, uyku planı, çapalı işler, akşam, `morning` ve `evening` durumları, haftanın günlük kapasitesinde uyanış
- Uyanış ve yatış kaydı, tahmini uyanış, "geç yatacağım" ve "erken kalkacağım", ayarlar
- Oturum ve gün olayları (`core.session_started`, `core.session_ended`, `core.day_started`, `core.day_closed`)
- Sahne (`ui.scene`), çekirdeğin şeridi, çıkış ve dönüş, hata sınırı, `StepRunner`; `deneme`'de serbest ve adımlı iki sahne
- Sesli anlatım (`src/core/voice/`), cihaz başına ayarlar, `say` ve `today`
- Ekranlar: Günaydın, akşam, üst şerit, zaman çizelgesinin bölümleri, Hafta'da tek satır

**Kabul ölçütleri**
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
- [ ] Kalemden Başla ile hafta bekçisinin oturum işi yazması aynı anda olunca kalemin tek açık oturum işi kalıyor (veritabanı testi)
- [ ] Migration önce `dev`, sonra `prod` projesinde; kod ondan sonra yayında

### Ç3d: Sunucu zemini

Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm E. İstem `prompts/c3d-sunucu-zemini.md`.

**Kapsam**
- Cihaz anahtarları (`device_tokens`): üretme, kapsam, son kullanım, iptal; Ayarlar → Bağlantılar
- Giriş ucu `POST /api/ingest/<kaynak>/<tür>`: anahtar ve kapsam denetimi, şema doğrulaması, yinelenen istek, hız sınırı; çekirdeğin türleri `core/wake`, `core/bed`, `core/context`
- Modülün `ingest` ve `jobs` alanları; tek zamanlayıcı ucu ve `job_runs`; çekirdeğin kendi işleri aynı düzenle
- Sunucuda modül bağlamı (yalnızca anahtarın sahibinin verisi); modül sunucu kodunun tarayıcıya özgü bir şey içe aktarmaması (lint)

**Kabul ölçütleri**
- [ ] Ayarlar → Bağlantılar'da anahtar üretiliyor (bir kez gösteriliyor), kapsamı seçiliyor, iptal ediliyor; iptal edilen anahtar reddediliyor
- [ ] Anahtar yalnızca kapsamındaki uca yazabiliyor; okuma yapamıyor; yanlış ya da eksik anahtar 401, kapsam dışı 403
- [ ] `core/wake` ve `core/bed` uçları uyanışı ve yatışı kaydediyor; açık ekranlar canlı güncelleniyor
- [ ] `deneme` modülünün bir `ingest` türü: geçerli gövde işleniyor, geçersiz gövde adıyla reddediliyor, yinelenen istek ikinci kez işlenmiyor
- [ ] `deneme` modülünün bir zamanlanmış işi uygulama kapalıyken çalışıyor; `job_runs` kaydı düşüyor; aynı iş iki kez tetiklenince veri bozulmuyor
- [ ] Sunucuda çalışan işleyici yalnızca anahtarın sahibinin verisine erişiyor (başka hesabın verisine erişemediği testle)
- [ ] Modülün sunucu kodu tarayıcıya özgü bir şey içe aktarınca lint hata veriyor
- [ ] iPhone Kestirmeler ile `core/wake` gerçek telefonda denendi (elle doğrulanacak; adımları `docs/ILERLEME.md` içinde)

### Ç3e: Modülün bölümleri

Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm F. İstem `prompts/c3e-modul-bolumleri.md`. Kullanıcının isteğiyle eklendi (12 Kas 2026).

**Kapsam**
- Modül tanımında `facets` (sabit ya da veriden), `ui.scenes`; zarfta ve dört tabloda `facet`
- Renk çözümleyici tek yardımcıda; çekirdeğin iş gösteren her yerinde kullanılması
- Bölüme göre sahne ve ton
- Ayarlar'da modül ve bölüm renkleri (`modules.color`, `modules.facet_colors`), düzenleme formunda bölüm seçimi
- Oturum olaylarında `facet`; dışa aktarım

**Kabul ölçütleri:** `docs/12-sahne-ve-otomasyon.md`, "Kabul ölçütleri" → Ç3e.

### Ç3f: Çapalı diziler

Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm G. İstem `prompts/c3f-capali-diziler.md`. Rutin modülünün tasarım oturumunda çıkan çekirdek eksiklerinden (13 Kas 2026; `docs/moduller/rutin.md`, "Çekirdek için notlar" 2, 7, 11).

**Kapsam**
- Dizinin plandan ve bugünün kayıtlarından türetilmesi (`chainOf`); `SceneProps.chain`
- Kendiliğinden devam (`day_frame.chain_auto`), iki çapa için
- `core/wake` ile gelen uyanıştan sonra dizinin başlaması
- `controls.closing()` ve `today.closed`
- Standart kartta dizi satırı; `deneme` modülünde örnekler

**Kabul ölçütleri:** `docs/12-sahne-ve-otomasyon.md`, "Kabul ölçütleri" → Ç3f.

### Ç4: Pano ve telefon cilası

Tasarım: `docs/05-arayuz.md`, `docs/11-yayin-ve-cihazlar.md`.

**Kapsam**
- Pano yerleşiminin son hali: tipografi, yoğunluk, koyu tema, gece parlaklığı; ayrı pencere olarak kurulum
- Klavye kısayolları; odak görünümü
- Ekranın uyanık kalması seçeneği, uykudan dönüşte yenileme, oturum düşünce son planın ekranda kalması
- Telefon: güvenli alanlar, uygulama kabuğunun önbelleği, bağlam seçici, bağlantısızken son plan ve üç işlemin kuyruğu
- Web push denemesi (çalışırsa: saatli randevu hatırlatması)

**Kabul ölçütleri**
- [ ] Pano 3 gün boyunca açık kalıp yeniden giriş istemiyor
- [ ] Bütün ana eylemler klavyeyle yapılabiliyor
- [ ] Şimdi kartı masadan bir bakışta okunuyor (kullanıcı onayı)
- [ ] Telefonda bağlam "kampüs" seçilince yalnızca oraya uyan işler öneriliyor
- [ ] `docs/11-yayin-ve-cihazlar.md` sonundaki eşitleme ve bağlantısız kullanım ölçütleri sağlanıyor

### Ç5: Claude köprüsü

**Kapsam**
- `/api/mcp` altında uzak MCP sunucusu; kimlik doğrulama (kurulurken güncel MCP ve Claude bağlayıcı dokümanına bakılır)
- Çekirdek araçlar: günün ve haftanın planını oku, kalem ve iş listele, iş ekle ve tamamla, zarf teklif et, gelen kutusunu listele ve yönlendir
- Modül araçları için kayıt noktası: her modül kendi araçlarını sözleşme üzerinden ekler

**Kabul ölçütleri**
- [ ] Bir Claude sohbetinden eklenen iş Bugün ekranında anında görünüyor
- [ ] Sohbetten "bugün ne var" sorusu Sherpa'daki planla cevaplanıyor
- [ ] Yetkisiz istek reddediliyor
- [ ] `deneme` modülü köprüye kendi aracını çekirdeğe dokunmadan ekleyebiliyor

## Modül hattı

Her modül en fazla üç adımdan geçer; her adımdan sonra modül kullanılır ve sonraki adıma ihtiyaç varsa geçilir.

| Adım | İçerik | Çekirdek bağımlılığı |
| --- | --- | --- |
| 1. Temel | Tabloları, iş teklifleri, sayfası, elle girişleri | Ç1; tahminler için Ç2 |
| 2. Veri bağlantıları | Dış kaynaklardan otomatik akış | Ç3d (giriş ucu, cihaz anahtarları); metinden okuma için Ç2 (`extract`) |
| 3. Otomasyon | Modülün kendi başına iş yapması | Ç3d (zamanlanmış işler, sunucuda modül bağlamı); Claude sohbetlerinden yazma için Ç5 |

Bir modülün süreci: tasarım oturumu (bkz. `prompts/modul-tasarim-oturumu.md`) → `docs/moduller/<slug>.md` onaylanır → `_sablon`'dan kopyalanır → adım 1 kurulur → 2 hafta kullanılır → gerekiyorsa adım 2 ve 3.

| Modül | Adımlar | Tasarım durumu |
| --- | --- | --- |
| Okul | 1: dönem takibi ve Notion aktarımı · 2: Ninova · 3: hazırlık dokümanı otomasyonu | Taslak hazır; ayrı oturumda ayrıntılanacak |
| Beslenme | 1: plan, prep, alışveriş · 2 ve 3: belirlenecek | Taslak |
| Rutin (sabah ve akşam) | 1: tablolar, üç ritim, iki sahne, modül sayfası, kayıt (Ç3f'den sonra) · 2: Kestirmeler bağlantısı, Düzenlilik, sürelerin öğrenilmesi · 3: çekirdeğin cam diline bağlanma ve faz 2 (Ç4'ten sonra) | Onaylandı (14 Kas 2026; `docs/moduller/rutin.md`); kurulmadı |
| Spor | 1: duruş programı ve koç sahnesi | Bekliyor |
| Ev | 1: ritimler | Taslak |
| İş | 1: çalışma blokları | Taslak |
| Yüksek lisans | Belirlenecek | Bekliyor |
| Hayat idaresi | Belirlenecek | Bekliyor |

Okul modülünün adımları için taslak kapsam ve kabul ölçütleri `docs/moduller/okul.md` ve `docs/moduller/okul-ninova.md` içindedir; tasarım oturumunda kesinleşir.

Önerilen sıra: Ç0 → Ç1 → Ç2 → Ç3 → Ç3b → Ç3c → Ç3d → Ç3e → Ç3f → Ç4 (Ç3c–Ç3f kullanıcının kararıyla Ç4'ten önce, 12–13 Kas 2026); ilk modül (rutin) Ç3f'den sonra, tasarımı onaylanınca kurulabilir, Ç4'ü beklemez; Okul adım 1 tasarımı onaylanınca, Ç5 ve Okul adım 2 ihtiyaca göre araya girer. (Ç3, Okul adım 1'den önce bitti; Ç3b modüller tasarlanmadan önce yapılır, çünkü iş zarfını değiştirir.)
