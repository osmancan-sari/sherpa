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
- Yapay zeka: gecelik `plan`, haftalık `week` ve `review`, aylık `month`, istek üzerine `replan`
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
| 2. Veri bağlantıları | Dış kaynaklardan otomatik akış | Ç2 (`extract`) |
| 3. Otomasyon | Modülün kendi başına iş yapması | Ç5 |

Bir modülün süreci: tasarım oturumu (bkz. `prompts/modul-tasarim-oturumu.md`) → `docs/moduller/<slug>.md` onaylanır → `_sablon`'dan kopyalanır → adım 1 kurulur → 2 hafta kullanılır → gerekiyorsa adım 2 ve 3.

| Modül | Adımlar | Tasarım durumu |
| --- | --- | --- |
| Okul | 1: dönem takibi ve Notion aktarımı · 2: Ninova · 3: hazırlık dokümanı otomasyonu | Taslak hazır; ayrı oturumda ayrıntılanacak |
| Beslenme | 1: plan, prep, alışveriş · 2 ve 3: belirlenecek | Taslak |
| Sabah rutini ve hareket | 1: rutin ve koç modu | Taslak |
| Ev | 1: ritimler | Taslak |
| İş | 1: çalışma blokları | Taslak |
| Yüksek lisans | Belirlenecek | Bekliyor |
| Hayat idaresi | Belirlenecek | Bekliyor |

Okul modülünün adımları için taslak kapsam ve kabul ölçütleri `docs/moduller/okul.md` ve `docs/moduller/okul-ninova.md` içindedir; tasarım oturumunda kesinleşir.

Önerilen sıra: Ç0 → Ç1 → Ç2 → Okul adım 1 → Ç3 → Ç4; Ç5 ve Okul adım 2, ihtiyaca göre araya girer.
