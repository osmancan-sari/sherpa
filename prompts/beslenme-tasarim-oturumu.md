# Beslenme modülü tasarım oturumu: başlangıç notu (23 Kas 2026)

Bu not Beslenme'nin tasarım sohbetini başlatır. Yöntem `prompts/modul-tasarim-oturumu.md` içindeki yedi adımdır. Kullanıcının beslenme araştırması hazır (23 Kas); oturum onunla başlar. Spor henüz tasarlanmadı: Beslenme'nin Spor'dan beklediği şeyler (planlanan ve gerçekleşen antrenman, türü ve süresi) bu oturumda bir arayüz olarak yazılır (`spor.workout_planned`, `spor.workout_done` ve taşıdıkları alanlar); Spor oturumu o arayüze uyar. Araştırma antrenman gününe bağlı bir fark istemiyorsa bu bağ yalnızca harcama tahmini içindir.

**İlk iş:** kullanıcının paylaştığı araştırma dokümanını `docs/moduller/beslenme-arastirma.md` olarak depoya yaz (içeriği değiştirmeden; başına tarih ve kaynağını ekle) ve modülün her hesabında, sınırında ve varsayılanında bu dokümanın ilgili bölümüne atıf yap. Araştırma şu iki soruyu kapsamıyor olabilir (sonradan eklendi): öğün sayısının günden güne değişmesinin etkisi ve sınırları; meal prep'e uygun yemek yapıları ve saklamaya dayanıklılık. Kapsamıyorsa kullanıcıya söyle; ek araştırmayı kullanıcı yapar ya da oturumda web'den bakılır ve kaynağı yazılır.

## Önce oku

`CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md`, `docs/01-urun.md`, `docs/06-modul-sozlesmesi.md`, `docs/moduller/ORTAK.md`, `docs/moduller/README.md` ("Beslenme (taslak)", "Sağlık alanı sayfası"), `docs/moduller/spor.md` (varsa), örnek olarak `docs/moduller/rutin.md` ve `okul.md`, `docs/moduller/okul-cekirdek-notlari.md` (çekirdeğe giren yetenekler), tasarım için `docs/tasarim/`. Kullanıcının Notion'ında Mart 2025'te kurulmuş karbonhidrat döngüsü planları ve meal prep matrisleri var; Notion bağlantısıyla yalnızca okuyarak bak.

## Kullanıcının istekleri (23 Kas, kendi anlatımından)

1. Eskiden MacroFactor kullanıyordu, bıraktı. **MacroFactor'a ihtiyaç kalmadan** her şeyi Sherpa yapsın.
2. Kapsam: bütün makro takibi, kilo takibi, **meal prep planı ve yemek planını her parametreye göre hazırlama** ve takip.
3. **Öğün sayısı haftanın yoğunluğuna göre belirlenebilmeli** (23 Kas): sabit işler (okul, iş) yoğun olan günde ve haftada öğün sayısı ve yapısı buna göre değişir. Sabit bir "günde N öğün" kuralı istemiyor.
4. **Yemekler meal prep'e uygun olmalı** (23 Kas).
5. **Sherpa her şeyi adım adım, çok iyi planlayarak işini çok kolaylaştırmalı** (23 Kas): ne zaman alışveriş, ne alınacak, ne zaman prep, prep'te hangi sırayla ne yapılacak, hangi gün hangi kap yenecek. Kullanıcı düşünmek ve hesaplamak zorunda kalmamalı.
6. Önceki taslak (depoda, `README.md`): amaç "en az eforla sürdürülebilir düzen"; veri stratejisi önerisi "plan = kayıt"; alışveriş modu ve prep koç modu; `spor.workout_done` dinlenir.

Kullanıcı hakkında bilinenler (oturumda doğrulanmalı): karbonhidrat döngüsü kullanıyor (antrenman günü yüksek, diğer gün düşük karbonhidrat); günde 2 öğün düzenine geçmiş; meal prep yapıyor; PrepEasy adlı kendi meal prep uygulaması projesinde besin veritabanı (USDA, Open Food Facts, bulanık arama) üzerine çalışmış. Güncel hedefler, ölçüler ve kısıtlar oturumun başında sorulur; bu dosyaya sayı yazılmadı.

## Beslenme yaklaşımı henüz seçilmedi (23 Kas 2026)

Kullanıcı, karbonhidrat döngüsünün gerekli olup olmadığından emin değil ve kendi özelliklerine en uygun beslenme planını ayrı bir araştırmayla belirlemek istiyor (Rutin'de yaptığı gibi: önce kanıta dayalı araştırma dokümanı, sonra modül o dokümana göre tasarlanır). Bu yüzden:

- **Oturum, araştırma dokümanı hazır olunca başlar.** Kullanıcı dokümanı paylaşır; modülün hesapları ve varsayılanları ona dayanır.
- **Hiçbir yaklaşım modüle gömülmez.** Karbonhidrat döngüsü, öğün sayısı, öğün zamanlaması, refeed gibi seçimler veridir, kod değildir: "gün tipi" bir tane de olabilir, birkaç tane de; kullanıcı yaklaşımını değiştirdiğinde modül yeniden yazılmaz. Aşağıdaki düğümlerde karbonhidrat döngüsü geçen yerler "araştırma öyle derse" diye okunmalı.
- Modülün araştırmadan bağımsız kısmı (kilo eğilimi, harcama tahmini, plan = kayıt, prep ve alışveriş akışı, besin verisi) her yaklaşımda aynıdır.

## İlerleme sohbetinin gördüğü düğümler (oturumda karara bağlanacak)

1. **Önce örnek uygulamaya bak.** MacroFactor'ın güncel özelliklerini web'den araştır (harcama tahmini, haftalık hedef ayarı, besin kaydı yolları, kilo eğilimi) ve kullanıcıya kapsam tablosu sun: alınır / alınmaz / sonra. "İhtiyaç kalmadan" ölçütü bu tabloyla somutlaşır.
2. **Veri stratejisi (en büyük karar).** Ürün kuralı: her giriş en fazla iki dokunuş ya da tek cümle. Tam besin kaydı (her öğünde besin ara, gram gir) bu kuralın en çok zorlandığı yerdir ve kullanıcı MacroFactor'ı aylardır açmıyor. Seçenekler: (a) plan = kayıt: planlanan öğün tek dokunuşla "yedim" olur, yalnızca sapma girilir; (b) tam kayıt: besin veritabanı, barkod, arama; (c) karma: plan temel, sapma tek cümle ya da fotoğrafla ve yapay zeka makroyu tahmin edip "tahmini" işaretler. Her birinin harcama hesabının doğruluğuna etkisi yazılmalı.
3. **Besin veritabanı.** Kaynak: USDA, Open Food Facts, Türkiye'ye özgü kaynaklar (lisans ve kapsam denenmeli; "denenmedi"). Kullanıcının PrepEasy çalışmasından yeniden kullanılabilecek olan (şema, arama, takma adlar) sorulur. Barkod: web uygulamasında iPhone kamerasıyla barkod okuma denenmedi. Türkiye'deki paketli ürünlerin açık veride kapsamı belirsiz.
4. **Harcama ve hedef hesabı.** Kilo eğilimi ve alınan enerjiden harcamayı tahmin edip haftalık hedefi ayarlayan hesap saf bir işlev olarak kurulabilir. Kararlar: eğilim nasıl düzleştirilir, hedef ne sıklıkla ve en çok ne kadar değişir, eksik veri günlerinde ne olur, değişiklik kendiliğinden mi uygulanır yoksa onayla mı (kullanıcı genel olarak onay düğmesi istemiyor, ama burada güvenlik sınırı var). Güvenlik sınırları yazılmalı: haftalık değişim hızı, enerji tabanı, protein tabanı. Tıbbi öneri verilmez; sınırlar kullanıcının seçtiği hedefe göre, bilinen kaynaklara dayanarak konur ve kaynağı yazılır.
5. **Kilo girişi.** Elle (haftada birkaç kez, tek alan) ya da tartı → iPhone Sağlık → Kestirmeler → giriş ucu (denenmedi). Kilo tek yerde, Beslenme'de durur; Spor ve Sağlık alan sayfası oradan okur.
6. **Gün tipleri ve Spor.** Karbonhidrat döngüsü antrenman gününe bağlı. Gün tipi Spor'un planlanan antrenmanından mı (yarın için prep ve plan gerekir) yoksa gerçekleşenden mi (`spor.workout_done`) belirlenir? Antrenman kayarsa günün makroları ve hazır yemek ne olur?
7. **Yemek planı ve meal prep planı.** "Her parametreye göre": parametre listesi oturumda çıkarılmalı (gün tipi makroları, öğün sayısı, prep günleri ve süresi, kaç kişilik, bütçe, sevilen ve sevilmeyenler, ekipman, saklama süresi, çeşitlilik). Planı kim kurar: yapay zeka önerir, bir denetleyici makroları doğrular. Tarifler nereden: Notion'daki mevcut matrisler başlangıç verisi olabilir. Plan haftalık mı; sabit haftalık program olmadan nasıl yaşar (prep günü planlayıcının yerleştirdiği bir iştir)?
7a. **Öğün sayısının yoğunluğa bağlanması.** Girdi çekirdekten gelir: o günün sabit blokları, yol süreleri, uyanış ve yatış aralığı, evde mi dışarıda mı olunacağı. Modül bunları nasıl okur (sözleşmede günün ve haftanın sabit bloklarını modüle veren bir yol var mı; yoksa çekirdek notu)? Kararlar: öğün sayısı gün gün mü haftalık mı belirlenir; günlük makro hedefi sabitken öğün sayısı değişince porsiyonlar nasıl yeniden bölünür; dışarıda geçen günde taşınabilir öğün (kap) şartı; plan hafta ortasında değişirse (yeni sabit blok, iptal olan ders) hazır kaplar ne olur. Araştırma dokümanı öğün sayısının sonuca etkisini söyleyecek; modül ona göre alt ve üst sınır koyar.
7b. **Meal prep'e uygunluk bir tarif özelliğidir.** Tarifte tutulacak alanlar: saklama süresi (buzdolabı, dondurucu), yeniden ısıtmaya uygunluk, taşınabilirlik, toplu pişirmeye uygunluk, etkin süre ve bekleme süresi, ekipman. Plan yalnızca bu şartları sağlayan tarifleri seçer; saklama süresi prep gününden yenme gününe kadar olan süreyi aşamaz.
7c. **"Düşünmek zorunda kalmasın" ölçütü.** Haftanın zinciri uçtan uca çizilmeli ve simüle edilmeli: yoğunluk okunur → öğün yapısı → tarifler → alışveriş listesi (miktarlar toplanmış, reyona göre) → alışveriş işi → prep işi (adımlar paralel işleri gözeterek sıralı: fırın çalışırken doğrama gibi) → kaplar ve etiketler → her gün "bugün şu kap". Kullanıcının verdiği karar sayısı sayılmalı; hedef haftada bir onay ya da hiç.
8. **Prep ve alışveriş akışı.** Prep oturumu çekirdeğe iş olarak gider; sahnesi koç modudur (adımlar, zamanlayıcılar; paket A'nın kontrol listesi ve sayaçları yetiyor mu, paralel zamanlayıcı gerekiyor mu). Alışveriş: telefonda reyonlara göre işaretlenen liste; prep'ten bir gün önce iş olarak çıkar. Kiler takibi "durum takibi"dir ve ölçülemez; alınmaması önerilir.
9. **Plan dışı yemek.** Dışarıda yemek, atıştırma, alkol: tek cümle ya da fotoğrafla, yapay zeka tahmini "tahmini" işaretiyle. Yapay zekaya giden veri ve maliyet yazılmalı.
10. **Kapsam sınırı.** Mikro besinler, su, takviyeler, kafein: alınır mı? Her biri ek giriş yüküdür.
11. **Bildirim.** Öğün hatırlatması ürün ilkesine göre yok (teşvik bildirimi yapılmaz). Bildirim gerektiren gerçek olay var mı (ör. prep günü için alışveriş)?
12. **Ekranlar.** Bugün'de öğün kartı (en sade hali), modül ana sayfası (bugünün makroları, haftanın planı), kilo ve harcama eğilimi, plan ve tarif sayfaları, alışveriş modu, prep sahnesi. Telefon ve pano ayrı çizilir.
13. **Sağlık alan sayfası.** "İki hafta kullanımdan sonra" şartı kalktı (16 Kas kararı). Rutin, Spor ve Beslenme'nin alan sayfasına verdiği görünümler ve ortak metrikler bu oturumun sonunda ya da ayrı kısa bir oturumda tasarlanır. Kural duruyor: yalnızca kullanıcının zaten yaptığı girişlerden türeyen metrik girer.
14. **PrepEasy ile ilişki.** Ayrı bir ürün; Beslenme onun kodunu ya da verisini kullanacak mı, yoksa yalnızca öğrenilenleri mi? Kullanıcıya sorulur.
15. **Kurulum adımları.** Modül baştan tam tasarlanır ve tam kurulur; adımlar teknik bağımlılık içindir.

## Oturumdan beklenen çıktı

- Önce: güncel durum (sorularla), MacroFactor kapsam tablosu, Notion'daki mevcut plan ve matrislerin okunan yapısı.
- Düğümler için seçenekler ve öneri; kullanıcı seçer.
- Onaylı `docs/moduller/beslenme.md`: veri modeli, hesaplar (harcama, hedef, eğilim; formülleri ve sınırlarıyla), kurallar, teklif ettiği işler, sahneler, sayfalar, bir haftalık simülasyon, kurulum adımları ve kabul ölçütleri.
- Kareler `docs/tasarim/kareler/beslenme/`, ekran dokümanları `docs/tasarim/ekranlar/beslenme-*.md`.
- Çekirdekten istenenler: `docs/moduller/beslenme-cekirdek-notlari.md`.
- `README.md` ve yol haritasının güncellenmesi.

## Kurallar

Doküman yaz, kod yazma. Çekirdeği değiştirme. Varsayımla boşluk doldurma; denenmeyene "denenmedi" de. Oyunlaştırma ve teşvik bildirimi yok. Depoda commit atma. Türkçe yaz; kod, tablo ve sütun adları İngilizce. Sağlıkla ilgili sayılarda kaynağı yaz; tıbbi öneri verme, hedefi kullanıcı belirler.
