# Okul modülü: çekirdekten istenenler

Okul'un tasarımı (`docs/moduller/okul.md`, 16 Kasım 2026) çekirdekte olmayan on dört şeye dayanıyor. Bu dosya onları karar için sıralar. Modül oturumu çekirdeği değiştirmez; kararlar ilerleme sohbetinde alınır, `docs/09-kararlar.md` ve ilgili çekirdek dokümanına işlenir, ardından Claude Code istemi yazılır.

Her maddede: ne isteniyor, Okul'un hangi özelliği buna dayanıyor, önerilen en küçük hali, hangi kurulum adımından önce gerektiği. "Bugünkü durum" satırı yalnızca bu oturumda çekirdek dokümanından okunarak doğrulanan yerlerde kesin yazıldı; diğerleri "doğrulanmadı" diye işaretli ve karar verilirken ilgili dokümanla karşılaştırılmalı.

Okul'un kurulum adımları: **Adım 1** temel, **Adım 2** veri bağlantıları, **Adım 3** hazırlık zinciri ve otomasyon.

## Özet

| # | Konu | Hangi adımdan önce | Reddedilirse Okul'da ne olur |
| --- | --- | --- | --- |
| 3 | Hayat modunun kalıntıları | Adım 1 | Yalnızca doküman temizliği; kod etkisi yok |
| 4 | Modül sayfasının iskeleti | Adım 1 | Ana sayfa ve ders seçimi çizildiği gibi kurulamaz |
| 5 | Sayfa başı | Adım 1 | Sayfa başında istenmeyen durum cümlesi kalır |
| 7 | Sahnede sayaç ve aşamalar | Adım 1 | Şerit "geçen / ayrılan" gösteremez; mola süreye sayılır |
| 9 | Süre tahmini ve gerekçesi | Adım 1 | Yer tutucu süre olmaz; aylık plan sınav yükünü görmez |
| 10 | Sahne türleri | Adım 1 (dördü), Adım 3 (ikisi) | Her tür modülde baştan çizilir; derste sahnesi açılamaz |
| 11 | Sahneden çıkarken not | Adım 1 | "Kaldığın yer" notu sorulamaz |
| 1 | Dosya saklama | Adım 2 | Dosyalar ve dokümanlar telefonda açılmaz |
| 2 | Toplayıcının giriş ucu | Adım 2 | Dosya gövdesi gönderilemez; okuma kaçınca fark edilmez |
| 6 | Tahmini tarih | Adım 2 | Tarihsiz işler plana giremez |
| 8 | Telefon bildirimi | Adım 2 | Beş olay yalnızca uygulama açılınca görülür |
| 12 | Oturum uzunluğu | Adım 3 | Sınav oturumları en çok 90 dk olur |
| 13 | Karışık oturum | Adım 3 | Oturumun bölümleri sahneye taşınamaz |
| 14 | Bütün oturumların önceden görünmesi | Adım 3 | Sınav ayrıntısında yalnızca bu haftanın oturumları görünür |

Karar sırası için öneri: önce Adım 1'i tutan yedi madde (3, 4, 5, 7, 9, 10, 11), sonra Adım 2'nin dördü, en son planlayıcıya dokunan üçü (12, 13, 14). Son üçü birbirine bağlıdır ve birlikte kararlaştırılmalıdır.

---

## 1. Dosya saklama

- **Ne isteniyor:** modülün dosya saklayabilmesi ve telefonda açabilmesi.
- **Bugünkü durum:** sunucu bağlamının `db`'si yalnızca `from` ve `rpc` açar; `storage` yoktur (`docs/06-modul-sozlesmesi.md`).
- **Okul'da neye dayanıyor:** güncel dönemin ders dosyaları ve hazırlık dokümanları bulutta da durur; sahnedeki "Aç" dokümanın buluttaki kopyasını o sayfada açar; Dosyalar sayfası (bölüm 4.2, 8.2, 8.5).
- **En küçük hali:** özel (herkese kapalı) tek bir kova; modül bağlamına üç işlem: dosya koy, süreli bağlantı al, sil. Yol `<kullanıcı>/<modül>/<anahtar>`. Önizleme, sürümleme ve arama yok; PDF tarayıcının kendi görüntüleyicisinde açılır. Boyut sınırı toplam boyut ölçülünce konur.
- **Hangi adımdan önce:** Adım 2.

## 2. Bilgisayarda çalışan toplayıcının giriş ucu

- **Ne isteniyor:** toplayıcının dosya gövdesi gönderebilmesi ve beklenen okumanın gelmediğinin fark edilmesi.
- **Bugünkü durum:** giriş ucu (`/api/ingest/[source]/[kind]`) ve cihaz anahtarı var (Ç3d). Dosya gövdesi gönderme ve "okuma gelmedi" denetimi için hüküm doğrulanmadı.
- **Okul'da neye dayanıyor:** Ninova ve Kepler okumaları (günde dört kez), dosyaların buluta kopyası, okunamayınca bir kez bildirim ve iki gün sonra kalkan işi (bölüm 4.1, kural 17).
- **En küçük hali:** (a) giriş ucundan süreli yükleme bağlantısı istenir, gövde doğrudan saklamaya gider (madde 1'e bağlı); (b) her gönderim kaynağın kimliğiyle yinelenebilir (aynı kimlik ikinci kez yazılmaz); (c) kaynak başına "son başarılı okuma" zamanı ve modülün zamanlanmış işinin bunu okuyabilmesi. Toplayıcının kendisi Okul'un parçasıdır, çekirdeğin değil.
- **Hangi adımdan önce:** Adım 2.

## 3. Hayat modunun kalıntıları

- **Ne isteniyor:** Okul'un eski taslağına dayanan mod ifadelerinin çekirdek dokümanlarından temizlenmesi.
- **Bugünkü durum:** hayat modu kalktı (karar 14 Kas 2026; kuruldu Ç4a).
- **Okul'da neye dayanıyor:** hiçbir şeye; Okul mod önermez (bölüm 9). Eski taslaktaki "Mod davranışı" bölümü ve `okul.heavy_week` → mod önerisi geçersizdir.
- **En küçük hali:** kod değişikliği yok. `docs/` altında `heavy_week` arandı: yalnızca Okul'un iki dosyasında, kalktığını söyleyen cümlelerde geçiyor. Modül şablonunda ve oturum yönteminde (`prompts/modul-tasarim-oturumu.md`, başlık 9 "Mod davranışı") mod bölümü hâlâ isteniyorsa oradan kaldırılır; Okul'da o başlık tek cümleyle duruyor.
- **Hangi adımdan önce:** Adım 1 (yalnızca temizlik).

## 4. Modül sayfasının iskeleti

- **Ne isteniyor:** modül sayfasında bölümlerden (derslerden) bağımsız bir "Ana sayfa" girişi; "Yaklaşanlar" bölümünün modülün kendi listesiyle birleşebilmesi; geçmiş düğmesinin olmaması.
- **Bugünkü durum:** bölümler (`facets`) var (Ç3e); modül sayfasının ortak iskeletinin bu üç noktadaki hükmü bu oturumda doğrulanmadı.
- **Okul'da neye dayanıyor:** ana sayfa dönemin bütün işlerini tarih sırasıyla tek listede gösterir; telefonda açılır ders seçimi ve ayrı "Ana sayfa", panoda sekmeler (bölüm 8.4; kareler 69, 70, 81).
- **En küçük hali:** modül, sayfasının ilk girişini kendisi tanımlayabilir (bölüm olmayan bir giriş); iskeletin "Yaklaşanlar" ve geçmiş parçaları modül başına kapatılabilir. Telefondaki açılır seçici ortak bileşen olur.
- **Hangi adımdan önce:** Adım 1.

## 5. Sayfa başı

- **Ne isteniyor:** modül sayfasının başındaki durum cümlesinin ve sağlık ("dikkat") etiketinin kaldırılabilmesi.
- **Bugünkü durum:** doğrulanmadı.
- **Okul'da neye dayanıyor:** kullanıcı sayfa başında durum metni ve uyarı etiketi istemedi (kural 18; bölüm 8.4).
- **En küçük hali:** sayfa başı yalnızca ad ve dönem; durum cümlesi ve etiket modül başına isteğe bağlı. Kullanıcı bunu genel istiyorsa bütün modüllerde kaldırılır (ilerleme sohbetinde sorulmalı).
- **Hangi adımdan önce:** Adım 1.

## 6. Tahmini tarih

- **Ne isteniyor:** bir işin son tarihinin "tahmini" olarak işaretlenebilmesi ve hafta düzeyinde verilebilmesi.
- **Bugünkü durum:** zarfta `due_at` var; kesinlik bilgisi yok (doğrulanmadı: `docs/03-veri-modeli.md` ile karşılaştırılmalı).
- **Okul'da neye dayanıyor:** tarihi açıklanmamış sınav ve ödevlerin plana tahmini haftayla girmesi; her ekranda "tahmini" işareti; kesin tarih gelince planın yeniden kurulması (kural 2, 3). Notion'daki 59 değerlendirmenin 21'i tarihsiz.
- **En küçük hali:** zarfa tek alan: `due_estimated boolean`. Hafta düzeyindeki tahmin, o haftanın dersin gününe (yoksa haftanın son gününe) yazılır. Bugün, Hafta ve Takvim tarihin yanında "tahmini" gösterir; planlayıcı tahmini tarihe kesin tarih gibi davranır. Akademik takvim (final dönemi, ara tatil) Okul'un kendi tablosunda durur; çekirdekten bir şey istemez.
- **Hangi adımdan önce:** Adım 2.

## 7. Sahnede sayaç ve aşamalar

- **Ne isteniyor:** sahnenin, oturumun içinde aşamalar (odak, mola) yürütebilmesi; molanın işin süresine sayılmaması; şeritte "geçen / ayrılan"; modülün arka planı bölümün rengiyle verebilmesi.
- **Bugünkü durum:** kabuk şeridi saat, nokta, ad, "· n dk" ve "Çık" gösterir; `ui.backdrop` var. Odak ve mola ayrımının çekirdeğe bildirilmesi doğrulanmadı.
- **Okul'da neye dayanıyor:** pomodoro ve akış sahneleri; "yalnızca odak süresi sayılır, plandaki blok molaları içerir" (kural 10); şerit "26 dk / 2 sa" (bölüm 8.2); dersin renginde ışıyan koyu zemin.
- **En küçük hali:** (a) şerit biçimi "geçen / ayrılan" olur (bütün modüllerde); (b) oturum kapanırken sahne çekirdeğe "sayılan dakika"yı bildirebilir, bildirmezse bugünkü gibi geçen süre sayılır; (c) arka plan bölümün rengini alabilir. Aşamaların kendisi (tur, mola) sahnenin iç işidir, çekirdek bilmez.
- **Hangi adımdan önce:** Adım 1.

## 8. Telefon bildirimi

- **Ne isteniyor:** modülün telefona bildirim gönderebilmesi.
- **Bugünkü durum:** bildirim v1'de yok; web push denemesi Ç4d'de (`docs/02-mimari.md`, `docs/07-yol-haritasi.md`).
- **Okul'da neye dayanıyor:** beş olay (kural 17): tarih açıklandı ya da değişti, yeni ödev, not açıklandı, teslime 3 saat kala yükleme yok, Ninova ya da Kepler okunamadı.
- **En küçük hali:** modül bağlamına tek işlem: başlık, tek satır metin, açılacak sayfa ve yinelenmeyi önleyen anahtar. Kanal web push. Ç4d denemesi başarısız olursa yedek: aynı olaylar Bugün'ün üstünde tek satır olarak görünür ve Okul bildirimsiz yaşar; en çok etkilenen "teslime 3 saat" uyarısıdır.
- **Hangi adımdan önce:** Adım 2.

## 9. Yapay zekanın süre tahmini ve gerekçesi

- **Ne isteniyor:** bir işin süresinin "yer tutucu" olarak işaretlenebilmesi, gerekçesinin saklanıp "Neden?"de gösterilmesi, sonradan modülün verdiği süreyle değişebilmesi.
- **Bugünkü durum:** `size` çağrısı ve alan kaynağı (`module`, `ai`, `user`, `default`) var. Gerekçenin saklanması ve yer tutucu işareti doğrulanmadı.
- **Okul'da neye dayanıyor:** sınav öğrenildiği anda hazırlığın yer tutucu süreyle plana girmesi; dokümanın planı gelince sürenin değişmesi; ders çarpanı (kural 9). Aylık ve dönemlik planın doğru yükü görmesi buna bağlı.
- **En küçük hali:** zarfa iki alan: `effort_provisional boolean` ve `effort_basis text` (tek cümle). `size` ipuçlarına modülün verdiği "önceki gerçekleşenler" eklenir. Modül süreyi sonradan güncelleyince kaynak `module` olur ve işaret kalkar. Yer tutucu işte oturum açılmaz (bunu `earliest_at` zaten sağlar).
- **Hangi adımdan önce:** Adım 1.

## 10. Sahne türleri

- **Ne isteniyor:** ortak sahne düzeninde beş yerleşim (pomodoro, soru sayacı, tek blok, akış, kontrol listesi) ve oturum açmayan bir "sabit blok" sahnesi.
- **Bugünkü durum:** modül sahnesinin ortak düzeni var (`docs/tasarim/ekranlar/sahne.md`); beş yerleşimin ayrı ayrı tanımı ve sabit bloğa bağlı sahne doğrulanmadı.
- **Okul'da neye dayanıyor:** bölüm 8.3'teki tablonun tamamı. Derste ve sınav günü sahneleri "Başla" ile değil, bloğun kartına dokununca açılır ve süre saymaz.
- **En küçük hali:** (a) beş yerleşim ortak bileşen olarak çizilir ve `ORTAK.md`'ye girer, böylece Spor ve Sağlık da kullanır; (b) sabit bloğun kartına dokununca modülün verdiği bir sayfa açılır (oturum açmaz, şeritte sayaç yoktur). Adım 1 için pomodoro, akış, kontrol listesi ve sabit blok yeter; soru sayacı ve tek blok Adım 3'te gerekir.
- **Hangi adımdan önce:** Adım 1 (dördü), Adım 3 (kalan ikisi).

## 11. Sahneden çıkarken not

- **Ne isteniyor:** "Çık" ya da "Oturumu bitir" tamamlanmadan önce sahnenin tek alanlık bir soru gösterebilmesi.
- **Bugünkü durum:** doğrulanmadı.
- **Okul'da neye dayanıyor:** ödev ve proje oturumundan çıkarken "Nerede kaldın?" (kural 12; kareler 37, 44); not sonraki oturumun başında görünür.
- **En küçük hali:** sahne, çıkışı bir adım bekletebilir (tek metin alanı, atlanabilir, tek dokunuşla geçilir). Notu Okul kendi tablosunda tutar; çekirdek saklamaz.
- **Hangi adımdan önce:** Adım 1.

## 12. Oturum uzunluğu

- **Ne isteniyor:** 90 dakikadan uzun oturum.
- **Bugünkü durum:** oturum işi en fazla 90 dk (şema kısıtı); derin yuva en fazla 90 dk, daha uzun aralık 15 dakikalık molalarla bölünür (`docs/04-planlayici.md`).
- **Okul'da neye dayanıyor:** sınav hazırlığında 2 saatlik oturumlar (kullanıcının örnekleri: quiz 8 saat, midterm 16 saat, oturum 2 saat). Blok molaları içerir; odak süresi 75–100 dk kalır.
- **En küçük hali:** oturum işine "molaları içinde" işareti: bu işaretli iş 120 dakikaya kadar olabilir ve planlayıcı ona araya mola yuvası koymadan tek parça yer verir. İşaretsiz işlerde 90 dk sınırı aynen kalır. Üst sınır 120 dk; daha uzunu istenmiyor.
- **Hangi adımdan önce:** Adım 3. (Adım 1'deki ödev ve proje oturumları 90 dk ve altıdır.)

## 13. Karışık oturum

- **Ne isteniyor:** bir oturum işinin, türü belli bölümler taşıyabilmesi.
- **Bugünkü durum:** oturum işleri kalemin eforundan eşit uzunlukta bölünür; bölüm bilgisi taşımaz (doğrulanmadı: zarfta modüle ait serbest alan var mı).
- **Okul'da neye dayanıyor:** bir oturumun adımları dokümanın bölümleridir ve türleri farklıdır (okuma → pomodoro, soru → soru sayacı, son bölüm → tek blok); sahnedeki bölümler kutusu ve "Aç" (kural 10; bölüm 8.2, 8.3).
- **En küçük hali:** oturum işinde modüle ait, çekirdeğin okumadığı bir veri alanı (`payload jsonb`); sahne onu alır. Bölümlerin oturumlara dağıtımını modül yapar (madde 14).
- **Hangi adımdan önce:** Adım 3.

## 14. Bütün oturumların önceden görünmesi

- **Ne isteniyor:** bir kalemin bütün oturumlarının, içinde bulunulan haftadan sonrakiler dahil, önceden bilinmesi.
- **Bugünkü durum:** kalem haftaya girerken yalnızca o haftaya düşen eforu oturumlara bölünür; sonraki haftaların eforu toplam olarak durur. Motor bugünü ve kapanışta yarını planlar (`docs/04-planlayici.md`; `docs/09-kararlar.md`, 15 Kas açık maddesi).
- **Okul'da neye dayanıyor:** sınav ayrıntısında bütün oturumların bölümleri, dakikası, günü ve durumuyla görünmesi (bölüm 8.5; kareler 76, 83); takılınan soruların son oturuma taşınması; güncellemede yeni bölümlerin eklenmesi.
- **En küçük hali:** modül kalemi **kendi böldüğü oturum listesiyle** verebilir (`sessions: [{ minutes, payload }]`, sıralı). Çekirdek haftası gelince bu listeden iş açar, kendisi bölmez; hafta yükünü hesaplarken listedeki dakikaları kullanır. Sınav ayrıntısında oturumlar sırası, bölümleri ve dakikasıyla baştan görünür; **gün** yalnızca planlanmış oturumlarda (bugün, yarın) kesin yazar, diğerlerinde hafta düzeyinde gösterilir. Gün gün öngörü, 15 Kas'taki açık planlayıcı işine (haftanın işlerini günlere dağıtma) bırakılır; o iş yapılınca burası kendiliğinden dolar.
- **Hangi adımdan önce:** Adım 3.

---

## Bu dosyada olmayanlar

Okul'un kendi içinde çözdüğü ve çekirdekten bir şey istemeyenler: toplayıcının kendisi, klasör yapısı ve etiketler, kapsam kuralı, doküman üretimi, tahmin kuralları, devam, notlar. Bunlar `okul.md` içindedir.

Denemelere bağlı olup çekirdek kararını etkileyebilecekler: Ninova'daki toplam dosya boyutu (madde 1'in sınırı), web push denemesi (madde 8), okumanın buluta alınıp alınamayacağı (madde 2'yi küçültür).

---

## Kararlar (ilerleme sohbeti, 16 Kas 2026)

On dört maddenin hepsi kabul edildi; bazıları küçültülerek. Teknik kararlar ilerleme sohbetinin önerisiyle alındı (kullanıcının kalıcı talimatı); tasarım sorusu olan tek madde 5'tir ve kullanıcıya soruldu. Denemelerden (Ninova, Kepler, web push) sonra 1, 2 ve 8 yeniden gözden geçirilir.

Çekirdek işi üç pakete bölünür; her paket Okul'un bir adımından hemen önce kurulur.

| Paket | Maddeler | Okul'un adımı |
| --- | --- | --- |
| Okul çekirdek A | 3, 4, 5, 7, 9, 10 (dört yerleşim ve sabit blok), 11 | Adım 1'den önce |
| Okul çekirdek B | 1, 2, 6, 8 | Adım 2'den önce |
| Okul çekirdek C | 12, 13, 14, 10'un kalan iki yerleşimi | Adım 3'ten önce |

| # | Karar | Ayrıntı ve sınır |
| --- | --- | --- |
| 1 | Kabul | Özel tek kova; modül bağlamına `files.put`, `files.url` (süreli bağlantı), `files.remove`. Yol `<kullanıcı>/<modül>/<anahtar>`; erişim kuralı yolun ilk parçasına göre. Önizleme, sürüm, arama yok. Kota: dönemin toplam boyutu denemede ölçülür; sınır ve "yalnızca güncel dönem bulutta" kuralı o sayıya göre yazılır. Tek dosya sınırı Supabase planının sınırıdır; aşan dosya yalnızca bilgisayarda kalır ve listede öyle işaretlenir |
| 2 | Kabul | (a) Giriş ucundan süreli yükleme bağlantısı; gövde doğrudan kovaya. (b) Yineleme Ç3d'deki `Idempotency-Key` ile; yeni mekanizma yok, anahtar kaynağın kimliğinden türetilir. (c) Kaynak başına "son başarılı okuma": `ingest_requests` kaydından okunan tek yardımcı, modülün zamanlanmış işine açık. Toplayıcı Okul'un parçasıdır |
| 3 | Kabul | Yalnızca doküman temizliği: modül şablonundan ve oturum yönteminden "Mod davranışı" başlığı kalkar. Kod yok |
| 4 | Kabul | Modül sayfasının ilk girişini modül tanımlayabilir (bölüm olmayan "Ana sayfa"). "Yaklaşanlar" ve "Geçmiş" modül başına kapatılabilir; varsayılan bugünkü gibi açık. Telefondaki açılır bölüm seçici kit parçası olur |
| 5 | Kabul (modül başına) | Durum cümlesi ve "dikkat/geride" etiketi sayfa başında modül başına isteğe bağlı olur; Okul kapatır. Bugün'deki modül hapı değişmez. Bütün modüllerde kaldırılması kullanıcıya soruldu; cevaba göre varsayılan değişir |
| 6 | Kabul | Zarfa `due_estimated boolean` (varsayılan false). Bugün, Takvim ve modül sayfası tarihin yanında "tahmini" gösterir. Planlayıcı kesin tarih gibi davranır; kesin tarih gelince alan false olur ve plan yeniden kurulur. Tahmini tarihe "son tarih geçti" uyarısı verilmez |
| 7 | Kabul | (a) Şerit bütün modüllerde "geçen / ayrılan" olur. (b) Sahne oturum kapanırken "sayılan dakika" bildirebilir; 0 ile geçen süre arasında olmalı, bildirilmezse geçen süre sayılır; öğrenme sayılan dakikayı kullanır. (c) `ui.backdrop` bölümün çözülmüş rengini alır. Tur ve mola sahnenin iç işidir |
| 8 | Kabul, deneme öne alınır | Modül bağlamına `notify({ title, body, href, key })`; `key` yinelenmeyi önler. Kanal web push (iPhone'da ana ekrana eklenmiş uygulamada). Web push denemesi Ç4d'den alınıp paket B'nin ilk adımı yapılır. Çalışmazsa yedek: aynı olaylar Bugün'ün üstünde tek satır. Ayarlar'da modül başına aç/kapa. Bildirim yalnızca modülün tasarımında sayılan olaylar için; hatırlatma ya da teşvik bildirimi yok |
| 9 | Kabul | Zarfa `effort_provisional boolean` ve `effort_basis text` (tek cümle). "Neden?" gerekçeyi gösterir. `size` ipuçlarına modülün verdiği önceki gerçekleşenler eklenir. Modül süreyi güncelleyince kaynak `module` olur, işaret kalkar |
| 10 | Kabul | (a) Yerleşimler kit parçası olur ve `docs/tasarim/parcalar.md` ile `ORTAK.md`'ye girer; yalnızca onaylı karesi olan yerleşim kurulur. Paket A: pomodoro, akış, kontrol listesi. Paket C: soru sayacı, tek blok. Rutin'in `StepRunner`'ı kontrol listesiyle birleştirilebiliyorsa birleştirilir, ikinci kopya kalmaz. (b) Modülün teklif ettiği sabit bloğun kartına dokununca modülün verdiği görünüm açılır (`ui.blockView`); oturum açmaz, süre saymaz |
| 11 | Kabul | Sahne çıkışı bir adım bekletebilir (`ModuleScene.beforeExit`): tek metin alanı, atlanabilir. Kabuğun "Çık"ı da bu adımdan geçer. Not modülün tablosunda durur. Bağlantı yokken ya da hata olursa çıkış engellenmez |
| 12 | Kabul | Oturum işine "molaları içinde" işareti; işaretli iş 120 dakikaya kadar olabilir ve tek parça yerleşir. İşaretsizlerde 90 dk aynen kalır. Şema kısıtları buna göre değişir (migration) |
| 13 | Kabul, yeni alan yok | Zarfta `meta` zaten var. Karar: `meta` oturum işine ve sahnenin konusuna (`SceneSubject`) taşınır; çekirdek okumaz. Ayrı `payload` alanı açılmaz |
| 14 | Kabul (en küçük hali) | Modül kalemi kendi böldüğü sıralı oturum listesiyle verebilir (`sessions: [{ minutes, meta }]`). Çekirdek haftası gelince listeden iş açar, kendisi bölmez; hafta yükü listedeki dakikalardan hesaplanır. Gün yalnızca planlanmış oturumlarda kesin; ötekiler hafta düzeyinde. Gün gün öngörü 15 Kas'taki açık planlayıcı işine bırakılır. Planlayıcıda önce test, sonra kod |

### Sıra

Rutin 2 → Okul çekirdek A → Okul Adım 1 → Okul çekirdek B (web push denemesiyle başlar) → Okul Adım 2 → Okul çekirdek C → Okul Adım 3. Ç4d'nin kalan maddeleri (bağlantısız kullanım, klavye, pano dayanıklılığı) Okul Adım 1'den sonra araya alınır; Ç5 (köprü) Okul Adım 3'ün neye ihtiyaç duyduğuna göre ondan önce ya da sonra.

### İstemler

Paket A'nın istemini ilerleme sohbeti yazar (`prompts/okul-cekirdek-a.md`), şu ikisinden sonra: Okul'un kareleri depoda (10. madde yerleşimleri onaylı karelere dayanır) ve `okul.md` onaylı. Okul'un kendi adım istemlerini Okul tasarım sohbeti yazar; ilerleme sohbeti çekirdekle tutarlılığına bakar.

## Okul tasarım sohbetinden notlar (kararlardan sonra)

İlerleme sohbeti için; karar değil, bilgi.

- **23 Kas 2026 · `okul.md` onaylandı, kareler depoda.** Paket A'nın isteminin iki koşulu da sağlandı: 90 kare `docs/tasarim/kareler/okul/` altında (dizin `DIZIN.md`; ekranlar `docs/tasarim/ekranlar/okul-sahneler.md`, `okul-sayfalar.md`), `okul.md` onaylı. Paket A'nın yerleşim kareleri: pomodoro `K1T2`–`K1T4`, `K4T2`–`K4T4`; akış `K3T2`–`K3T4`, `SahneAkisProje`; kontrol listesi `K4T6`, `SahneDokuman`, `SahneToplanti`; blok görünümü `SahneDers`, `SahneSinav`, `PanoDersSahne`; süre doldu `K1T5`, `K3T5`, `K4T5`; çıkarken not `K3T6`; "Kaldığın yer" `SahneKaldiginYerOdev` (pano karşılıkları aynı adın `P` hali ya da `Pano…`).
- **Karar 5'te açık kalan:** Okul sayfa başında durum cümlesini ve etiketi kapatıyor. Aynı şeritte haftalık raporun sayıları da gösteriliyor (`docs/05-arayuz.md`, "Durum şeridi"); Okul'da onların da görünmemesi gerekir (kullanıcı sayfa başında durum bilgisi istemedi). "Kapat" ayarının sayıları da kapsaması önerilir.
- **Karar 1 için sayı (17 Kas denemesi):** Ninova'daki altı dersin dosyaları toplam ~266 MB (dönemin 8. haftası; 64 MB'ı eski yıl klasörü); dönem sonu için kaba öngörü iki katı. Görülen en büyük tek dosya 9 MB.
- **Karar 2 için bulgu:** Ninova düz HTML, Kepler JSON uçları (`obs.itu.edu.tr/api/ogrenci/...`); ikisi aynı İTÜ hesabıyla, ek doğrulama adımı olmadan açılıyor (kullanıcının söylediği). Kepler'in yoklaması ve notları Ninova'da da görünüyor. Ayrıntı: `okul-ninova.md`, `okul-kepler.md`.
- **Karar 8 için:** bildirim yedeğinin (Bugün'ün üstünde tek satır) karesi çizilmedi; çekirdeğin karesidir.


## İlerleme sohbetinden ekler (23 Kas 2026)

- **Sıra değişti (kullanıcının kararı: önce Okul).** Okul çekirdek A → Okul Adım 1 → çekirdek B → Adım 2 → çekirdek C → Adım 3. Rutin 2 ve Ç4d'nin kalanları Okul Adım 1'den sonra araya alınır. Paket A'nın istemi: `prompts/okul-cekirdek-a.md`.
- **Karar 5 tamamlandı.** "Kapat" ayarı durum şeridinin tamamını kapsar: durum cümlesi, etiket ve haftalık raporun sayıları. Modül başına; varsayılan açık kalır. Bütün modüllerde kaldırma sorusu kullanıcıdan cevap gelmediği için açık; varsayılan değişmedi.
- **Karar 1'in sınırı (paket B'de kurulur).** Ölçüm: ~266 MB (8. hafta), dönem sonu öngörüsü ~530 MB. Bulutta yalnızca güncel dönem durur; "eski yıl" etiketli dosyalar buluta kopyalanmaz (yalnızca bilgisayarda, listede öyle işaretli). Modül başına yumuşak sınır 800 MB: aşılınca yeni dosya buluta gitmez, bilgisayarda kalır ve modül sayfasında tek satır uyarı çıkar. Dönem kapanınca bulut kopyaları silinir, bilgisayardaki klasör kalır. Supabase planının depolama sınırı paket B'nin ilk adımında panelden doğrulanır; sınır 800 MB'ın altındaysa sayı ona göre düşürülür.
- **Karar 2:** ek doğrulama adımı olmadığı kullanıcının beyanıdır; toplayıcının kendi girişi hâlâ "denenmedi" (`okul.md` bölüm 11). Paket B'nin giriş ucu buna bağlı değildir.
- **Karar 8:** bildirim yedeğinin (Bugün'ün üstünde tek satır) karesi yok; paket B'de mevcut uyarı satırının diliyle kurulur ve "görüşün gerek" olarak işaretlenir.

## Paket A kuruldu (Okul çekirdek A, 23 Kas 2026)

Maddeler **3, 4, 5, 7, 9, 10 (pomodoro, akış, kontrol listesi ve `ui.blockView`) ve 11 kuruldu**; soru sayacı ve tek blok paket C'de. Kesin adlar ve kullanım örnekleri `docs/ILERLEME.md`, "Okul çekirdek A" → "Okul Adım 1 için sözleşme özeti"; sözleşme `docs/06-modul-sozlesmesi.md` ("Modül sayfası", "Sahne" kural 2, 3b, 3c, "Sahne yerleşimleri", "Sabit blok görünümü", "İş zarfı"). Önerilen adlardan ayrılanlar: `ui.home` yerine `ui.page.home` (biçimin bütünü `ui.page`'de: `facetView`, `pickLabel`, `status`, `subtitle`, `upcoming`, `history`, `entries`); önceki gerçekleşenler zarfta değil tanımda (`sizingActuals`).

| # | Durum |
| --- | --- |
| 3 | kuruldu (doküman) |
| 4 | kuruldu |
| 5 | kuruldu |
| 7 | kuruldu |
| 9 | kuruldu |
| 10 | pomodoro, akış, kontrol listesi, sabit blok görünümü kuruldu; soru sayacı ve tek blok paket C |
| 11 | kuruldu |

## Adım 1'de çıkanlar (Okul 1, 23 Kas 2026)

Okul Adım 1 kurulurken sözleşmede bulunmayan ya da yetmeyen yerler. Hiçbiri çekirdekte çözülmedi (istemin "Çekirdek sınırı"); her biri modülde çalışan en küçük haliyle duruyor. Okul çekirdek B ya da sonraki bir çekirdek işinde karar verilir.

| # | Ne eksik | Okul'da bugün ne yapılıyor | Önerilen en küçük hal |
| --- | --- | --- | --- |
| A1 | Modül kendi kalemini "bitti" olarak kapatamıyor (`ctx.withdraw` `dropped` yapar; son oturum bitince kalem "Bitti mi?" diye sorar) | Teslim edilen ödevin ve teslim kaleminin işi, "Yükledim" ya da "Sonra yap"tan sonra modülün geri çekmesiyle kapanır (`dropped`); modül kendi kaydında `done` tutar | `ctx.complete(key)`: kalemi `done` yapar, açık oturum işlerini bırakır, `onOutcome` çağırmaz |
| A2 | Olay sorusu geri alınamıyor (`ctx.ask` var, geri çekmesi yok) | "Derse girdin mi?" Bugün'e yalnızca Derste görünümü açılmadıysa sorulur (saatlik iş, ders bittikten sonra). Görünüm soru sorulduktan sonra açılıp cevaplanırsa Bugün'deki soru kalır; cevaplanınca modül ilk cevabı korur | `ctx.unask({ kind, subject })`: bekleyen soruyu `expired` yapar |
| A3 | Sahne başka bir işi başlatamıyor | Ödevin ya da alt işin son oturumunda "Bitti" teslim listesini aynı oturumda açar; şerit `strip({ title: "… teslimi", detail: "n / 4" })` ile değişir; ayrı teslim kalemi açık kalırsa Bugün'den de başlatılır (aynı liste) | Gerek kalmayabilir: aynı oturum yolu iki cihazda doğru çalışıyor. Sözleşmeye "sahne aynı oturumda başka bir işin görünümünü gösterebilir" diye yazılabilir |
| A4 | Kit'in saf sayacı (`sessionTimers`) `@/core/ui` altında; modülün sunucu kodu okuyamıyor | Karar 9'un ikinci basamağı (yerleşim durumundan odak dakikası) yalnızca sahnede: sahne sayılan dakikayı `controls.finish/stop(counted)` ile verir; sahne dışından kapanan oturumda modül duvar saatini sayar | `sessionTimers.ts`'i `src/core/contract/` altına taşımak (saf, React'siz) |
| A5 | Haftanın taahhüdü `earliest`'i bu hafta içinde kalan yer tutucu kalemi de oturum işlerine böler | "Dokümanım hazır" işaretlenmemiş hazırlığın `earliest`'i her gece ertesi güne itilir: oturum işleri açılsa da hiçbiri Bugün'e gelmez; gelecek günlerin tahmini onları "yarın" gösterebilir | Kalemde "yalnızca yük" işareti (`work_items.load_only`): haftanın yükünü sayar, oturum işi açmaz |
| A6 | `ModuleScene` bir işin iki alt işini aynı oturumda tanımıyor (`SahneAkisProje`) | Her alt iş kendi kalemi ve kendi oturumu; aynı oturuma iki alt iş düşmez | Paket C'nin modülün böldüğü oturum listesiyle (madde 14) birlikte düşünülür |
| A7 | Modül sayfasının bileşenleri (sayfa, sahne, blok görünümü) bağlamı farklı yollardan alıyor (`useModule()` yalnızca modül sayfasında) | Okul kendi bağlamını bir React bağlamıyla (`OkulContext`) sahne ve blok görünümündeki formlara taşır | `useModule()`'ün sahne ve blok görünümünde de sağlanması |
