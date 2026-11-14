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
| 12 Kas 2026 | Günün 3 işi: önce bugün teslim zorunlu işler, kalan yer planlayıcının ve yapay zekanın seçtikleriyle dolar. Ritimler normalde üçlüye girmez (zaman çizelgesinde ve Sıradakiler'de kalır); bir ritim yalnızca tabanı tehlikedeyse girer | Gerçek modelle denemede (D3) zorunlu işler ve bir ritim üçlüyü doldurdu, yapay zekanın seçtikleri hiç görünmedi |
| 12 Kas 2026 | `enrich` süreyi boş bırakırsa `size` çağrısı devreye girer (modül tekliflerindeki gibi) | Gerçek modelde iş kalemi seçilince süre çoğu zaman boş kalıyordu |
| 12 Kas 2026 | Planlama istemleri suçlayıcı ve geçmişi sayan cümleleri açıkça yasaklar (ürün kuralı 2); `ai:eval` bunu ayrı örneklerle sınar | Gerçek modelin uyarılarında "dünkü iki iş yapılmadı" gibi cümleler çıktı |
| 12 Kas 2026 | İş zarfına zaman kısıtları eklenir (`timing`): kesin saat penceresi, tercih edilen ve kaçınılan saatler, yol süresi, tekrarlar arası dinlenme günü. Ç3b adımı olarak, Ç4'ten ve modül tasarımlarından önce yapılır | Kullanıcının endişesi: işlerin kendine özgü kısıtları var (salon saatleri, kalabalık saatten kaçınma, yol) ve bunlar modülden modüle, işten işe değişir; motor bunları bilmeden doğru plan kuramaz. Zarfı modüller yazılmadan değiştirmek ucuz |
| 12 Kas 2026 | Kesin pencere her kuraldan önce gelir (bugün teslim olan iş bile pencere dışına konmaz, uyarı çıkar); pencere planlayıcıyı bağlar, kullanıcıyı değil (elle her saatte başlatılır) | Kapalı salona plan yapılmaz; ama son söz kullanıcıdadır |
| 12 Kas 2026 | Yol süresi tanımlı iş her bağlamda önerilir; kullanıcı zaten işin bağlamındaysa yol sayılmaz | Yoksa "dışarıda" bağlamlı iş ikinci ekranda hiç önerilmezdi; yol, yer değiştirmenin bedelidir |
| 12 Kas 2026 | Yapay zeka zaman kısıtını yalnızca satırda açıkça yazıyorsa doldurur; işin türünden saat tahmin etmez | Yanlış tahmin edilmiş kesin pencere işi sessizce plandan düşürür |
| 12 Kas 2026 | Modüller tasarlanmadan önce altyapı üç katmana hazır olur: Ç3c (sahne, oturum ve gün olayları, sesli anlatım, günün çerçevesi) ve Ç3d (sunucu zemini), Ç4'ten önce | Kullanıcının birinci önceliği; modül tasarım oturumları bu bağlantı noktalarına göre yapılacak (`docs/12-sahne-ve-otomasyon.md`) |
| 12 Kas 2026 | Modül, işi çalışırken Bugün ekranını bir sahneyle devralabilir; çekirdeğin şeridi ve oturumu her zaman çekirdeğindir | Rutin, pişirme, antrenman gibi işler ana ekranda kendi yüzünü ister; oturum kuralları tek yerde kalmalı |
| 12 Kas 2026 | Sesli anlatım çekirdeğin servisidir (`say`); ilk sağlayıcı cihazın kendi sesi, ücretli ses sonra aynı arayüze | Ücretsiz ve çevrimdışı başlamak; modüller sağlayıcıyı bilmez |
| 12 Kas 2026 | Gün uyanışla başlar, yatışla biter. Uyanış ve yatış aralıktır (06:00–09:00, 22:00–01:00), uyku hedefi 8 saat; planlayıcı bir uyku planı kurar, uyku iş yüküne feda edilmez, uyku borcu tutulmaz, uygulama uyandırmaz | Sabah ve akşam modülleri bunlar olmadan kurulamaz; uyku planın kendisidir, artığı değil |
| 12 Kas 2026 | Bitiş çizgisinden sonraya yalnızca `timing.after_finish` taşıyan iş konur (akşam); çizgi herkes için kalkmaz | Açık soruyu kapatır: akşam sporu gibi işler planlanabilir, gün yine bitiş çizgisinde biter |
| 12 Kas 2026 (Ç3c) | `settings.day_frame` boşsa çerçeve kapalıdır ve planlayıcı Ç3b'deki gibi çalışır; sütunun başlangıç değeri kullanıcının aralıklarıdır | Ç3 ve Ç3b'nin uçtan uca testleri günün bütün saatlerinde çalışır; çerçeveyi açık bir veride "Günaydın" ekranı bu testleri saate bağlardı. Gerçek hesapta çerçeve açıktır |
| 12 Kas 2026 (Ç3c) | Kalemin oturum işini açan iki yazma (kalemde Başla, hafta bekçisi) kalem satırını kilitleyen veritabanı fonksiyonlarında yapılır | Ç3b'de daraltılan ama kapanmayan yarış kalıcı olarak kapanır |
| 12 Kas 2026 | Modül kendini bölümlere ayırabilir (`facets`): aynı veri ve sayfa, ana ekranda ayrı renk ve sahne (rutinde Sabah ve Akşam, Okul'da dersler). Modülün ve bölümlerin rengi Ayarlar'dan değişir. Ç3e adımı, Ç3d'den sonra | Kullanıcı sabah için güneşli, akşam için gece temalı sahne ve zaman çizelgesinde ayrı renk istedi; iki ayrı modül veriyi (uyanış, yatış, düzenlilik) bölerdi. Kavram geneldir: Okul'da her ders, Beslenme'de prep ve alışveriş |
| 13 Kas 2026 | Spor baştan ayrı modüldür; boyun ve sırt (duruş) çalışması onun ilk programıdır. 10 Kasım'daki "Spor şimdilik Sabah rutini modülünde" kararının yerine geçer | Hareket, bakım adımlarından bağımsızdır: yapılamadığı gün diş ve bakım yine yapılmalı ve tam görünmeli. Verisi de farklıdır (set, tekrar, tutuş, ilerleme). Salon başlayınca taşıma gerekmez |
| 13 Kas 2026 | Rutin modülü (`rutin`) günün açılışı ve kapanışıdır: bakım adımları (diş, cilt, duş…), günün özeti, uyku görünümü. Bölümleri Sabah ve Akşam; bölümler modül sayfasında sekmedir, ayrı sayfa değil. Adımlar kodda değil veridedir; kullanıcı modül sayfasından düzenler | Kullanıcı adımları kendi araştırmasına göre belirleyecek ve zamanla değiştirecek; her değişiklik kod gerektirmemeli |
| 13 Kas 2026 | Sağlık bir alandır, modül değildir: Rutin, Spor ve Beslenme'yi tek sayfada birleştirir. Sayfanın metrikleri en az iki modül iki hafta kullanıldıktan sonra tasarlanır; yalnızca kullanıcının zaten yaptığı dokunuşlardan türeyen metrik girer | Ayrım kuralı: amaç alan olur, veri ve ekran modül olur, günün saati zaman kısıtı olur, görünüş bölüm olur. Kullanıcının endişesi: uygulama karmaşıklaşmamalı ve kullanırken yormamalı |
| 13 Kas 2026 | Çapalı işler ekranda tek akıştır (Ç3f): sahne parçası olduğu diziyi görür (başka modülün adımları yalnızca ad, renk, süre ve durumla), dizide bir iş bitince sıradaki kendiliğinden başlar, dışarıdan kaydedilen uyanıştan sonra dizi başlar, sahne akşam kapanışını kendi içinde açabilir. Ç3e'den sonra, Rutin kurulmadan önce | Kullanıcı sabahı tek görünümde istiyor: diş, su, hareketler (Spor), duş, SPF; hareket adımında ekran Spor'un sahnesine geçmeli. Veri modüllerde ayrı kalır, modüller birbirini tanımaz. Rutin'in sahnesi bu bağlantı noktalarıyla bir kez kurulsun |
| 13 Kas 2026 | "Bir işin başka bir işin hemen ardına bağlanması" (salon antrenmanından sonra duş) şimdi yapılmaz; salon antrenmanı plana girdiğinde ayrı karar | Bugün bunu kullanacak iş yok; sabah hareketleri için gerekmiyor (duş uyanış dizisinde hareketlerden sonraki sıradadır) |
| 14 Kas 2026 | Uygulamanın bütün ekranları tek görsel dildedir: cam paneller. Ortak olan camdır (paneller, şerit, düğmeler, liste satırları, geçiş kuralları); zemin modüle göre değişir. Varsayılan zemin günün saatini izleyen gökyüzüdür (Bugün ekranı ve zemin tanımlamayan modüller); modül isterse gökyüzünü kendine göre giydirir (Rutin: güneş ve ay) ya da tamamen kendi zeminini verir (Spor: siyah-yeşil). Ekranlar arası geçişler yumuşaktır: zemin çapraz solmayla değişir, kart büyüyüp sahneye dönüşür. Ayrıntısı ve kurulumu Ç4'te; Rutin'in sahneleri bu dilin ilk örneğidir | Kullanıcının kararı: gün içinde modülden modüle geçerken ekranlar uyumlu kalmalı, geçişler akıcı olmalı. Çizimler: https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k, "Cam dili" sayfası |
| 14 Kas 2026 | Rutin'in sabah sahnesinde zemin adım ilerlemesine değil saate bakar; Bugün ekranıyla aynı gökyüzü bileşenidir. Günün sözü şimdilik yok; sabahın son adımı yürüyüş (giyinme ve yürüyüş gerçek adım) | Kullanıcının kararı: her adımda yükselen güneş yerine o anki saat. Geçişte zemin değişmediği için sahne ile Bugün arası kesintisiz olur | `docs/moduller/rutin.md` |
| 14 Kas 2026 | Gökyüzü zemini güneşin gerçek yüksekliğini izler: tarih, saat ve ayardaki sabit koordinattan (varsayılan İstanbul) cihazda hesaplanır. Konum izni, dış servis ve hava durumu yok; saf fonksiyon, şimdiki zaman parametre | Kullanıcı ekranda o an dışarının halini görmek istiyor (kışın 07:00 karanlık, yazın güneş yükselmiş); yüzde yüz doğruluk gerekmiyor | `docs/moduller/rutin.md`; çekirdek ekranları için Fikirler (Ç4) |
| 14 Kas 2026 | Modüller arası ortak kararlar `docs/moduller/ORTAK.md` dosyasında tutulur; her modül tasarım oturumu oradan başlar ve sonunda oraya ekler. Süreler onaysız, kendiliğinden öğrenilir; arayüzde "asgari" yerine "temel adım" | Kullanıcının isteği: aynı kararlar her modül sohbetinde yeniden konuşulmasın; elle onay gerektiren öğrenme istemiyor | `docs/moduller/ORTAK.md`, `prompts/modul-tasarim-oturumu.md`, `docs/moduller/rutin.md` |
| 14 Kas 2026 | Rutin modülünün tasarımı onaylandı. Üç kurulum adımı: 1 temel (Ç3f'den sonra; sahne camını ve gökyüzünü kendi taşır), 2 alarm bağlantısı, Düzenlilik ve sürelerin öğrenilmesi, 3 çekirdeğin cam diline bağlanma ve faz 2 (Ç4'ten sonra). Uyandıran iPhone alarmıdır (telefon gece salonda); "Yatıyorum" gerçek yatışta basılır | Tasarım oturumunun yedi adımı tamamlandı; kullanıcı onayladı | `docs/moduller/rutin.md`, `docs/moduller/ORTAK.md` |

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
| Gün ve hafta uygulama açıkken kendiliğinden planlanır (`PlanKeeper`); günün ilk dokunuşu yalnızca kullanıcının dokunuşudur. Taahhütten sonra gelen kalem haftada yer varsa eklenir, elle eklenen her zaman (Ç3) | Kural 3: sistem ritüele bağımlı değil; ikinci ekran gece de açık | Planlayıcı, Bugün ekranı |
| Bugün listesi ve planlayıcı bir kalemin yalnızca sıradaki oturum işini aday sayar (son tarihi bugün olan kalemde hepsini); uzayan oturum 30 dakika cevapsız kalınca tahmini sürede ölçülmeden kapanır (Ç3) | Aynı başlık listede tekrar etmesin; kural 2: suçluluk üreten açık oturum kalmasın | Planlayıcı, Bugün ekranı, `close_unanswered_session` |
| Takıldım → "Adımı küçült" bugüne 15 dakikalık bir iş açar ve kalemin sıradaki adımı olur; "Birini bekliyorum" oturum işinin kalemini de bekletir (Ç3) | Takılınan yerde ilerlemenin yolu küçük bir adım; bekleyen adımı olan kalem ilerleyemez | Bugün ekranı, veri katmanı |
| Sunucu kullanıcı adına veritabanına kullanıcı olarak gider: gizli anahtar + `x-sherpa-user` başlığı, veritabanının istek öncesi fonksiyonu isteği `authenticated` role ve o kullanıcının `auth.uid()`'ine çevirir; RLS ve `auth.uid()` kullanan fonksiyonlar değişmeden geçerlidir. Sınır tek dosyada (`src/core/server/db.ts`), dönüşüm her istemcide doğrulanır (Ç3d) | Gizli anahtarla süzgeci uygulamada eklemek (her sorguya `user_id`) `auth.uid()` kullanan fonksiyonları (oturum başlatma, hafta yazma, bütçe) bozar ve bir unutulan süzgeç bütün hesapları açar; kullanıcı adına imzalı belirteç üretmek eski, paylaşılan JWT sırrını ister (yeni projelerde yok). Bu yolda sınırı veritabanı tutar | `src/core/server/`, giriş ucu, işler, Ç5 köprüsü |
| Zamanlayıcı Supabase'in `pg_cron` + `pg_net`'idir (15 dakikada bir `/api/jobs/tick`); Vercel Cron günde bir yedek (Ç3d) | Vercel'in ücretsiz katmanı günde bir çalışma ve ±59 dakika hassasiyet verir (Kasım 2026); saatlik işler için yetmez. Supabase'inki ücretsiz projede de vardır. Sır Vault'ta, kurulmamış projede zamanlayıcı hiçbir şey yapmaz | `docs/02` "Zamanlanmış işler", migration |
| Cihaz anahtarının kapsamı adresle aynı yazılır (`core/wake`, `<modül>/<tür>`); `docs/12`'deki `core.wake` biçimi yerine (Ç3d) | Kapsam ile adres arasında çeviri olmasın | `device_tokens.scopes`, Ayarlar → Bağlantılar |
| Planlama çağrılarının tetikleyicisi zamanlanmış iş değil, ekranın açılışıdır: `plan` günde bir kez (kapanışta ya da günün ilk açılışında; deneme gün kaydına yazılır, başka ekran yeniden sormaz), `week` haftanın ilk açılışında ve tetikleyicide, `month` ayın ilk açılışında ve yalnızca sıkışan hafta varsa, `review` Cumartesiden itibaren haftada bir. Yapay zeka ancak kendi tahmin ettiği süreyi düzeltebilir (Ç3) | Ücretsiz katmanda zamanlanmış iş yok; uygulama açık değilken plan da gerekmiyor. Maliyet yalnızca gerektiğinde. Kural 4: kullanıcının değeri ezilmez | Planlayıcı, `docs/10-yapay-zeka.md` |
| Vercel fonksiyonları `fra1`'de (Frankfurt) çalışır: `vercel.json` içinde `"regions": ["fra1"]` (13 Kas 2026) | Veritabanı Frankfurt'ta; varsayılan bölge Washington (`iad1`) her sorguyu Atlantik'in iki yakası arasında gidip getiriyordu | `vercel.json`, `docs/11` |
| Sahne yatışı `controls.bed()` ile kaydeder ("Yatıyorum": yatış şimdi, çalışan oturum "Bitti"); bölüm G'nin kural 6'sı bunu sahnenin son adımına bırakıyordu ama sahnenin yatış yazacak bir yolu yoktu (Ç3f, 14 Kas 2026) | Rutin'in akşam son adımı "Yatıyorum"dur; modül çekirdeğin `days` tablosuna yazamaz | `docs/06` "Sahne", "Diziler"; `docs/12` bölüm G |
| Sahnenin `controls.bed()` ile yazdığı yatış 10 dakika içinde geri alınabilir (`SceneProps.bedtime.undo`, `days.bed_session_id`, `undo_scene_bed`, `core.bed_undone`): yatış hiç yazılmamış gibi olur, oturum yeniden açılır, sahne kaldığı yerden sürer; bu sürede gece ekranı o sahnedir (şeritsiz). Süre geçtiyse ya da yatış başka yoldan yazıldıysa hiçbir şey değişmez ve bildirilir (Rutin 1, 14 Kas 2026; süreyi kullanıcı onayladı) | Rutin'in "İyi geceler" ekranındaki "Geri al" (uyuyamayıp telefona dönülen gece) için sözleşmede yol yoktu (çekirdek notu 15). Oturumu yeniden açmak, yenisini başlatmaktan iyidir: süre ve modülün yeri aynı oturumda kalır | `docs/06` "Sahne", "Diziler", "Olaylar"; `docs/03` `days` |
| Telefonda sahne ekranı kaplar: alt menü ve hızlı giriş düğmesi (+) sahne açıkken görünmez; panoda sahne sayfanın içinde kalır (Rutin 1 sonrası düzeltme, 14 Kas 2026; kullanıcının isteği) | Rutin tasarımında sahne tam ekrandır; "+" sahnenin düğmelerinin üstüne biniyor, siyah çerçeve ve alt menü gökyüzünü kesiyordu. Çekirdeğin sahne çerçevesinde genel çözüldü: bütün modüllerin sahneleri için geçerli | `src/core/ui/today/Scene.tsx`, `docs/05` "Sahne" |

## Açık sorular

Çekirdek:
- [ ] Günün bitiş çizgisi saat kaç olsun?
- [ ] Ev, ofis ve kampüs günlerinde akşam ne kadar çalışılabiliyor? (Kapasite çarpanlarının başlangıç değeri; şimdilik 0,7 / 0,4 / 0,5 varsayıldı.)
- [ ] Kampüse ve ofise yol süresi ne kadar?
- [ ] Saatli randevular için bildirim nasıl olsun: web push denensin mi, telefonun takvimine ayrıca mı yazılsın?
- [ ] Akşam kapanışı için hatırlatma istenir mi?
- [ ] Günün 3 işi yapısı kullanıcının doğrudan isteği değildi; gerçek modüllerle iki hafta kullanımdan sonra kalıp kalmayacağı yeniden değerlendirilecek.
- [x] Saat penceresi bitiş çizgisinden sonraya düşen iş (ör. akşam 21:00 spor) planlansın mı? **Kapandı (12 Kas 2026):** `timing.after_finish` taşıyan iş akşama konabilir; öbür işler için çizgi kalır (Ç3c, `docs/04-planlayici.md` "Günün çerçevesi").
- [ ] Zaman çarpanları (tercih edilen 1,25; kaçınılan 0,5) ve "yarısı" eşiği gerçek kullanımda uyuyor mu? Ç3b'de kodda sabit; gerekirse ayara taşınır.

Okul: `docs/moduller/okul.md` 11. bölüm.

Beslenme: veri stratejisi ve diğerleri, `docs/moduller/README.md`.

Rutin: `docs/moduller/rutin.md` 11. bölüm ve "Çekirdek için notlar".

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
- Yarın için `plan` çağrısının ve Cumartesi `review`'ün zamanlanmış işe taşınması (Ç3d'de zemin hazır; şimdilik ekranın açılışıyla)
- Konumdan bağlam: `core/context` olayını cihazın bağlam seçicisine bağlamak (uç Ç3d'de hazır)
- Çekirdek ekranlarında cam dili ve günün saatine göre gökyüzü: Bugün ekranı (pano ve telefon), yan menü, telefonun alt menüsü ve sahne şeridi cam paneller olarak; arka planda günün saatini izleyen sakin bir gökyüzü. Rutin modülünün tasarım oturumunda çizildi (14 Kas 2026; https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k, "Cam dili" sayfası). Çekirdeğin görünüşünü değiştirir; Ç4'te (pano ve telefon cilası) karar verilecek. Dikkat: gün boyu açık duran panoda okunurluk ve göz yorgunluğu, telefonda bulanıklığın performansı, açık tema
- Telefonun alt menüsü (kullanıcının seçimi, 14 Kas 2026): seçili sayfa "dolu cam" ile gösterilir (öbürlerinden geniş, opak açık hap; koyu ikon ve yazı). Hızlı giriş düğmesi (+) buna karşılık menüyle aynı koyu camdan, açık ikonlu olur; ekranda tek opak açık öğe seçili sayfadır. Düz açık renkli yuvarlak kullanılmaz. Çizim: Rutin tuvali, "Modül sayfası" sayfası, "Alt menü" panosu (C). Ç4 istemine girer.
- Zaman çizelgesinin yeniden tasarımı (kullanıcının eleştirisi, 14 Kas 2026: hangi saatin nerede olduğu anlaşılmıyor): üstte o günün kendi sınırlarının saatleri (uyanış, sabit blokların başı ve sonu, sıradaki işlerin başlangıcı, bitiş çizgisi, yatış; kullanıcı eşit aralıklı saatler yerine bunu istedi), çubuğun içinde etiketsiz ince saat çizgileri; sabit blok tam yükseklikte, düz kenarlı, adı ve saatiyle; işler yuvarlak köşeli, biten işler soluk; "şimdi" çizgisi saat etiketiyle; bitiş çizgisi kesikli ve etiketli; akşam bölgesi koyu; uçlarda uyanış ve yatış. Çizim aynı tuvalde, "Cam dili" sayfasındaki Bugün ekranlarında. Ç4'te
- Bağlamın konumdan kendiliğinden seçilmesi: iPhone Kestirmeler'in "Varınca" ve "Ayrılınca" otomasyonları (Ev, Kampüs, Ofis) Sherpa'ya cihaz anahtarıyla olay gönderir; koordinat gitmez, elle seçim öncelikli kalır. Yan getirisi: ofis ve kampüs saatleri İş ve Okul modüllerine veri olabilir. Ayrı bir sohbette değerlendirilecek (12 Kas 2026)
