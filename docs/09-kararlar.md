# Kararlar ve açık sorular

## Alınan kararlar

| Tarih | Karar | Gerekçe |
| --- | --- | --- |
| 10 Kas 2026 | Özel bir uygulama yazılacak; Notion ya da hazır araç değil | Tek ekran, etkileşim ve modül modeline tam uyum |
| 10 Kas 2026 | Birincil ekran masaüstündeki ikinci monitör; telefon ikinci ekran | Duvar tableti fikri şimdilik bırakıldı |
| 10 Kas 2026 | Geliştirme VS Code'da Claude Code ile yapılacak | |
| 10 Kas 2026 | İlk 7 modül: Okul, Beslenme, Sabah rutini ve hareket, Ev, İş, Yüksek lisans, Hayat idaresi | Okul ve Beslenme kritik |
| 10 Kas 2026 | Okul verisi Sherpa'ya aktarılacak; Sherpa kaynak olacak | Notion'da veri iyi tutuluyor; daha iyi bir arayüzle iş kolaylaşır |
| 10 Kas 2026 | Ders başına Claude projesi yapısı aynen korunacak | Hazırlık dokümanları ve proje çalışması orada üretiliyor; Sherpa yalnızca takip eder ve projeye götürür |
| 10 Kas 2026 | Korunan zaman ayrı modül değil | Bir sabit blok türü |
| 10 Kas 2026 | Spor şimdilik Sabah rutini modülünde | Salon üyeliği alınınca ayrı modül olur |
| 10 Kas 2026 | Ev işlerinde durum değil zaman takibi | Çamaşır ve bulaşığın durumu pratikte ölçülemiyor |
| 10 Kas 2026 | İş modülü iş görevlerini tutmaz | Yalnızca çalışma saatleri ve özel hazırlıklar |
| 10 Kas 2026 | Her modül ortak sözleşme ve şablonla tasarlanır; modül modül ilerlenir | |
| 10 Kas 2026 | Uygulamanın adı Sherpa (önceki çalışma adı: Hayat Kokpiti) | Tek kelime, İngilizce; yolu bilen ve yükü taşıyan rehber |
| 10 Kas 2026 | Arkada yapay zeka çalışır (Anthropic API): süre ve öncelik tahmini, yönlendirme, günlük plan önerisi | Her işin süresini elle girmek sürtünme; modüller arası denge yargı ister. Maliyet düşük tutulur |
| 10 Kas 2026 | Ninova'dan veri çekilecek (yerel toplayıcı) | Denendi, mümkün; tarihsiz kalem sorununun asıl çözümü |
| 10 Kas 2026 | Bütün modüller işlerini ortak bir iş zarfıyla teklif eder; yargı alanlarını yapay zeka doldurur | Planlama için her modülden gelen iş aynı yapıda olmalı |
| 10 Kas 2026 | Plan dönem, ay, hafta, gün ufuklarında yapılır; yapay zeka her ufukta önerir | Uzak işler kaba, yakın işler ayrıntılı planlanır |
| 10 Kas 2026 | Hazırlık eforu dokümanın kendi çalışma planından gelir; ders projelerinin talimatına ortak bir blok eklenir | Plan gerçek malzemeye dayanır |

## Tasarım ve teknik kararlar (öneri; itiraz yoksa geçerli)

| Karar | Gerekçe | Değişirse etkisi |
| --- | --- | --- |
| Sabit blokların kaynağı Sherpa'dır | Dış takvime bağımlılık olmasın | Çekirdek veri modeli |
| Akşam kapanışı isteğe bağlıdır ve uygulamanın içinde yapılır | Sistem ritüele bağımlı olmamalı | Ç3 |
| Next.js + Supabase + Vercel | Kullanıcının başka projesinde kullandığı yığın; Realtime ve kimlik hazır | Ç0 baştan |
| Planlayıcı istemcide, saf TypeScript | Anında yanıt, test edilebilirlik; yapay zeka yokken de çalışır | Ç3 |
| Yapay zeka önerir, motor uygular; "şimdi" seçimi ve kısıtlar kodda | Anında yanıt, öngörülebilirlik; dil modelleri saat aritmetiğinde güvenilir değil | Ç3 |
| Hızlı model girişler, planlama modeli günlük plan için; aylık 5 $ sınır | Maliyetin çoğu planlamada; günde bir çağrı yeter | Yalnızca ayar |
| Notion aktarımı JSON dosyalarından | Uygulamada Notion API anahtarı gerekmez | Yalnızca aktarım betiği |
| İki Supabase projesi (dev, prod) | Migration'ları güvenle denemek için | — |
| Zarfın `key` değeri üç hedef tabloda da saklanır; `rhythms` ve `blocks` da `provenance` taşır (Ç1) | `key` ile tekrar edilebilirlik ve "kullanıcının değiştirdiği ezilmez" kuralı ritim ve blok teklifleri için de geçerli | Veri modeli, iş zarfı |
| Seri bloklarında tekillik `(series_id, occurrence_on)` (Ç1; önceki tasarım `(series_id, starts_at)`) | Saati elle değiştirilen blok için eski saat yeniden üretilmesin | Veri modeli |
| `provenance` dördüncü değeri: `default` (Ç1) | Yapay zeka yokken yazılan sınırın ortası, sonradan yapay zeka ya da modül tarafından ezilebilmeli | İş zarfı, Ç2 `size` |
| Tablolar arası başvurular `(id, user_id)` çiftiyle (Ç1) | Düz yabancı anahtar RLS'siz denetlenir; bir hesabın satırı başka hesabın satırına bağlanamasın | Veri modeli |
| Modül arşivlenince gelecek blokları silinmez, `cancelled` olur (Ç1) | "Verisi silinmez" kuralı | Modül sözleşmesi |
| Modül sözleşmesine eklenenler (Ç1): `ctx.ask`, `ctx.work`, `ctx.saveSettings`, `ctx.module`, `blocks` (yapılı blok kancası), `tables`, `ui.history`, `ModuleUiContext`; `area` nesne oldu; `nowCard` içeriği `detail` ve `links` | Sözleşme dokümanı bu noktaları "…" ile bırakmıştı; çekirdeğin veri katmanı ve `deneme` modülü için gerekli | Bütün modüller |
| Olaylar yayınlandıkları yerde dağıtılır (ayrı tüketici yok); duraklatılmış modül olay almaz (Ç1) | Tek kullanıcı, tek yazan; kuyruk ve imleç gereksiz karmaşıklık | Modül sözleşmesi |
| Planlayıcı gelene kadar kalemin oturum işi "Başla" anında üretilir (Ç1) | Kalemler oturumlara haftalık planda bölünür (Ç3); o zamana kadar kalem Bugün listesinden başlatılabilmeli, uzak kalemler de önceden bölünmemeli | Ç3 |
| `deneme` modülü yalnızca `NEXT_PUBLIC_SHERPA_DEMO_MODULE=1` iken kaydolur (Ç1) | Sınama modülü üretim verisiyle hiç karşılaşmasın; yerel geliştirme ve testlerde açık | Yayın ortam değişkenleri (D1) |
| Tam ekran görünümler ayrı bir rota grubunda (`(tam)`), uygulama kabuğu olmadan çizilir (Ç1) | Kabuğu koşulla gizlemek yerine hiç çizmemek; aynı veri ve oturum sağlayıcıları | Modül arayüzü |
| Modül sayfasının "Yaklaşanlar" bölgesi elle düzenlemenin yeridir: iş, kalem ve ritim burada düzenlenir, bırakılır, durdurulur; elle ritim buradan eklenir (Ç1) | Bugün ekranı seyrek kalsın; düzenleme modülün bütün resminin durduğu yerde yapılsın | Arayüz |
| Bir günün blokları o güne değen bütün bloklardır; gece yarısını aşan blok iki güne de aittir (Ç1) | Gece vardiyası ertesi sabahın şeridinde de görünmeli | Bugün ekranı, Ç3 yuva hesabı |
| Oturum işi kalemin `source_type` ve `source_id` değerlerini taşır (Ç1) | Modül kendi işini şimdi kartında tanıyıp içerik verebilsin (`nowCard`) | Modül sözleşmesi |
| Gelen kutusunda 90 dakikayı aşan giriş iş kalemi olarak kaydedilir (Ç1) | Hızlı girişteki kuralın aynısı: uzun iş tek oturuma sığmaz | Gelen kutusu |
| Arşiv, modülün teklif ettiği kayıtlara geri çekme işaretini bırakır; yeniden etkinleştirilen modül aynı `key` ile teklif edince kayıt geri gelir (Ç1) | Modülü yeniden açan kullanıcı açık kayıtlarının işlerini geri ister; elle eklenen ve kullanıcının kendi kapattığı işler geri gelmez | Modül sözleşmesi, `archive_module` |
| Modül sayfasında açık oturum işi olan kalem tek satırdır: kalem görünür, oturum işi ayrıca listelenmez (Ç1) | Kalemin düzenleme, bitirme ve bırakma eylemleri her zaman erişilebilir olsun; "Başla" açık oturum işini sürdürür | Arayüz |
| Başarısız okuma istemcide ikinci kez yeniden denenmez (Ç1) | Supabase istemcisi okumayı kendisi 3 kez dener (1, 2, 4 sn); üstüne deneme "Veri okunamadı" bildirimini 15 saniyeye geciktiriyordu | İstemci verisi |
| `deneme_items` tablosu üretim veritabanında da açılır; `deneme` kodu pakette bulunur ama `NEXT_PUBLIC_SHERPA_DEMO_MODULE` verilmediği için kaydolmaz (Ç1) | Migration zinciri ortamlar arasında aynı kalsın; boş bir tablo zararsız. İstenirse modül hattı başlarken ayrı bir karar ile kaldırılır | D1 |
| Seri bitirilince gelecek blokları silinir (elle değiştirilmiş ve iptal edilmiş olanlar dahil); modül arşivinde ise `cancelled` olur (Ç1) | Seri kullanıcının kendi kaldırdığı bir kuraldır, blokları onun türevidir; arşivde ise "verisi silinmez" geçerli | Veri modeli |
| Modülün çekirdekten içe aktarabileceği yollar kapalı bir listedir ve testle denetlenir (`tests/unit/modules.test.ts`); `@/lib/supabase/database.types` listeye eklendi (Ç1) | Listede olmayan bir çekirdek dosyası (ör. `@/core/data/*`) modüle çekirdek tablolara zarfsız yazma yolu açardı | Modül sözleşmesi |
| Şablonun yalnızca adı değiştirilmiş bir kopyası (`sablon-kopya`) `deneme` ile aynı anahtarın arkasında kaydolur (Ç1) | "Şablondan kopyalanan modül çalışır" ölçütü kalıcı bir uçtan uca testle sınansın; üretimde kaydolmaz | Yerel geliştirmede modül listesinde "Şablon kopyası" görünür |
| Ç1'in Bugün ekranında geçici olarak "Durdur", "Bugün bitenler" ve "Geri al" vardır (Ç1) | Ertele ve Takıldım Ç3'te geliyor; o zamana kadar yanlışlıkla başlatılan ya da bitirilen iş geri alınabilmeli | `docs/05-arayuz.md` "Ç1 ara hali"; Ç3'te yeniden bakılır |
| Açık oturum işi kalemin adını, son tarihini, önemini, enerji ve bağlamını, doluysa oturum süresini izler; veritabanı tetikleyicisi günceller (Ç1) | Durdurulmuş oturum işi listede kalemin yerine geçiyor; kalem değişince eski ad ve tarihle sıralanıyordu. Tek yerde ve aynı işlemde çözülsün; Ç3'te oturum işleri kendi adını taşıyacaksa yeniden bakılır | Veri modeli, Ç3 |
| Zarf tanımadığı alanı reddeder (iç nesneler dahil); örnekteki `module` alanı kaldırıldı (Ç1) | Yanlış yazılmış alan sessizce atılınca iş son tarihsiz ya da eforsuz açılıyordu; yapılı bloklar ve Ç5 köprüsü tip denetiminden geçmeyen girdi verir | İş zarfı, Ç2 ve Ç5 |
| `ai_calls` ve `ai_feedback` yalnızca eklenir ve okunur (Ç2) | Ayın harcaması kayıt değiştirilerek küçültülemesin | Yapay zeka geçidi |
| `ai_calls` çağrının girdi özetini (`fingerprint`) ve doğrulanmış çıktısını (`output`) saklar; aynı girdi yeniden sorulmaz, önceki çıktı kullanılır (Ç2) | Kural 10 (istikrar) ayrı bir önbellek tablosu olmadan sağlansın | Yapay zeka geçidi |
| `work_items` modülün önerdiği efor sınırını saklar (`effort_min_minutes`, `effort_max_minutes`) (Ç2) | `size` sunucuda, teklif yazıldıktan sonra çalışır; tahminini sınırın içinde tutmak için sınırı veriden okur | Veri modeli, iş zarfı |
| Aylık bütçe 0 ya da daha büyüktür; 0 o ay yapay zekayı kapatır (Ç2) | Bütçe sınırı kapatma düğmesi olarak da çalışsın | Ayarlar |
| Yapay zekanın yapılı çıktısı araç şemasıyla değil API'nin yapılı çıktı biçimiyle (`output_config.format`) alınır; geçit aynı Zod şemasıyla yeniden doğrular (Ç2) | Güncel modellerde zorunlu araç seçimi desteklenmiyor; doğrulama tek yerde | Yapay zeka geçidi |
| Fiyat tablosunda olmayan model çağrılmaz (Ç2) | Maliyeti sayılamayan çağrı bütçeyi delerdi | Model değişikliği `pricing.ts`'e satır ister |
| Planlama çağrılarında zaman aşımı 30 saniye (Ç2; hızlı çağrılar 8) | Doküman yalnızca hızlı çağrının süresini veriyordu | Yapay zeka geçidi |
| Serbest giriş önce gelen kutusuna yazılır; `enrich` emin olunca onu işe ya da iş kalemine çevirir. Önceki tasarımdaki "iş hemen varsayılanlarla görünür" uygulanmadı (Ç2) | `tasks.module_id` zorunlu ve modülü yapay zeka seçiyor; modülsüz iş açılamaz. Yapay zeka yokken giriş gelen kutusunda kalır (kabul ölçütü) | `docs/05-arayuz.md`, `docs/10-yapay-zeka.md` |
| Satır sonuna yazılan gün ve süre kullanıcınındır; başlık kullanıcının kendi sözcükleridir, modelin önerdiği başlık yalnızca satır boşsa kullanılır (Ç2) | Kural 4: kullanıcının değeri yapay zekaca ezilmez | `enrich` |
| Yapay zekanın bölme önerileri `proposed` alt kalemler olarak yazılır; açık alt kalemi olan kalem Bugün'de görünmez (Ç2) | Öneri tek dokunuşla kabul ya da reddedilsin; kabul edilen bölme işi iki kez göstermesin | Veri modeli, Ç3 planlayıcı |
| `size` çağrısını tarayıcı başlatır (çekirdeğin teklif dinleyicisi); hangi alanın boş olduğuna sunucu karar verir. Yapay zekanın kendi tahmini yalnızca kapsam (başlık, `meta`, sınırlar) değişince yeniden sorulur (Ç2) | Modüller teklifi tarayıcıda yapar; kural 10 ve "Efor istikrarı" | Modül sözleşmesi |
| Modül sözleşmesine `extractors` eklendi; `extract` rotası hiçbir şey yazmaz, önerileri modüle döndürür (Ç2) | Çekirdek modülün verisini tanımaz; önerinin ne olacağına modül karar verir | Modül sözleşmesi |
| Planlayıcının dokümanın açık bıraktığı yerlerdeki yorumları `docs/04-planlayici.md` içinde "Uygulama notları (Ç3)" başlığında: geçmiş son tarih zorunlu değil, Yoğun modda taban en az yarısıyla kalır, gece 05:00'te biter, hafta planı varken yalnızca taahhüt edilen kalemler önerilir (Ç3) | Doküman bu durumları tanımlamıyordu; kural 2 ve 3 | Planlayıcı, Bugün ekranı |

## Açık sorular

Çekirdek:
- [ ] Günün bitiş çizgisi saat kaç olsun?
- [ ] Ev, ofis ve kampüs günlerinde akşam ne kadar çalışılabiliyor? (Kapasite çarpanlarının başlangıç değeri; şimdilik 0,7 / 0,4 / 0,5 varsayıldı.)
- [ ] Kampüse ve ofise yol süresi ne kadar?
- [ ] Saatli randevular için bildirim nasıl olsun: web push denensin mi, telefonun takvimine ayrıca mı yazılsın?
- [ ] Akşam kapanışı için hatırlatma istenir mi?

Okul: `docs/moduller/okul.md` 11. bölüm.

Beslenme: veri stratejisi ve diğerleri, `docs/moduller/README.md`.

## Fikirler

Kapsam dışı ama unutulmasın diye. Bir faza alınmadan kodlanmaz.

- Zarfa "en erken başlama" yerine "ideal aralık" alanı (ör. sınavdan 2 gün önce tekrar)
- Hedef not hesabı ("CB için finalden kaç gerekir")
- Dönem geçişi sihirbazı

- Ders klasörüne yeni dosya gelince Sherpa'ya sinyal
- Haftalık özetin Cumartesi sabahı e-posta ya da bildirim olarak gelmesi
- Alışveriş listesinin paylaşılması
- Güvenlik başlıkları: `Content-Security-Policy`, `frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options` (Ç0 faz denetiminin notu; dokümanlarda istenmiyor)
- Giriş ekranının açık temada görüntüsü ve geçiş anahtarıyla (passkey) giriş
