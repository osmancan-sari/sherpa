# Beslenme

> **Durum: taslak (tasarım oturumu sürüyor, 23 Kas 2026).** Bu dosya henüz 10 başlıklı modül dokümanı değildir; oturumda alınan kararların kaydıdır. Oturum bitince şablona göre yeniden yazılır ve durumu "onaylandı" olur. Taslakken kurulmaz.
>
> Dayanaklar: `beslenme-arastirma.md` (kanıt ve hesaplar), `beslenme-tercihler.md` (mutfak, ev halkı, yiyecek anketi), `prompts/beslenme-tarif-arastirmasi.md` (tarif kataloğu için derin araştırma istemi; çıktısı `beslenme-tarif-katalogu.md` olacak).

## Alınan kararlar

### Veri

| Konu | Karar | Dayanak |
| --- | --- | --- |
| Besin verisi | Büyük veritabanı yok. Küçük malzeme listesi: tarif yeni malzeme isteyince yapay zeka 100 g çiğ ağırlık başına değerleri USDA ya da paket etiketine dayanarak doldurur, kaynağını yazar; kullanıcı düzeltebilir. Barkod ve büyük veritabanı sonraya | Kullanıcının kararı |
| Tarif ekleme | (a) Bağlantı ya da metin yapıştırılır, yapay zeka yapıya çevirir, kullanıcı bir kez bakıp onaylar (YouTube dökümünü sunucudan okuma: denenmedi). (b) Planda boşluk olunca Sherpa kısıtlara uyan tarif önerir. Elle ekleme her zaman açık | Kullanıcının kararı |
| Başlangıç kataloğu | Tek seferlik derin araştırma, yaklaşık 28–32 bileşen; makrolar kaynaktan alınmaz, malzeme listesinden hesaplanır; süreler tahmin girer, prep sahnesinde ölçüldükçe düzelir | Kullanıcının kararı |
| Kayıt | Karma: plan temel, öğün tek dokunuşla "Yedim". Gün içinde karttan; işaretlenmeyenler akşam kapanışında tek satırda ("hepsi plana göre" ya da düzelt). "Farklı yedim": yarısını yedim, yemedim, başka bir şey yedim (tek cümle ya da fotoğraf; yapay zeka tahmini, "tahmini" işaretli). Plan dışı atıştırma hızlı girişten tek cümle | Araştırma Soru 8 |
| İşaretlenmeyen gün | Ekranda plana göre görünür ama harcama hesabına girmez. 14 günün 10'undan azı onaylıysa yalnızca tartı eğilimi kuralı | Araştırma 6.3, 6.5 |

### Tarif yapısı

- Katalog bütün öğünlerden değil, ayrı pişen **bileşenlerden** oluşur (protein, karbonhidrat, sebze, sos, tek tencere, kahvaltı, ara öğün); öğün bileşenlerin birleşimidir.
- Makroya uydurma iki katmanlıdır: (1) porsiyon: kaba her bileşenden kaç gram girdiği (asıl ayar, tarifi bozmaz); (2) tarif içi: malzeme davranışı *ayarlanır* (alt ve üst sınır), *bağlı* (başka malzemeyle aynı oranda), *sabit*. Hedef aralıkların içinde tutmuyorsa tarif o öğüne seçilmez.
- Bileşende tutulanlar: rol; malzemeler (çiğ gram, davranış, aralık); adımlar (elle süre, bekleme süresi, ekipman, öncül); parti kapasitesi; pişme verimi; saklama (buzdolabı gün, en çok 4; dondurulabilirlik); soğuk yenebilirlik, ısıtma, taşınabilirlik; hazırlık biçimi (toplu prep, o gün taze, pişirmesiz); çeşitlilik etiketleri; "pahalı".
- Kaplara bölme: prep sahnesi kap kap pişmiş gramı söyler, kullanıcı tartarak koyar (iki kişilik partide porsiyonlar farklı olduğu için "eşit böl" yetmez).

### Ev halkı

- Ortak öğün varsayılandır, sabit değildir: hafta içi yalnızca akşam yemeği iki kişilik, hafta sonu bütün ana öğünler; ara öğün kişisel. Bir günün öğünü tek dokunuşla tek ya da iki kişilik yapılır.
- Ortak öğün iki kişinin de yemediklerini içermez ve acısız pişer.
- İkinci kişinin kendi öğünleri için istekleri uygulamaya girmez.
- **Açık:** ikinci kişinin porsiyonu nasıl hesaplanır.

### Hedef ve hesap

| Konu | Karar | Dayanak |
| --- | --- | --- |
| Başlangıç | 118 kg; hız haftada %0,55; ≈2.400 kcal, 190 g protein, ≥75 g yağ, ≈240 g karbonhidrat, lif 35–40 g | Araştırma Soru 1–3, bölüm 4 |
| Hedef ekranı | Amaç (kilo ver, koru, al), hız (%0,25–1,0/hafta), isteğe bağlı hedef kilo ve tarih; kullanıcı istediği an elle değiştirir. Tarih %1/haftadan hızlı kayıp gerektiriyorsa izin verilen en erken tarih gösterilir | Kullanıcının kararı; araştırma Soru 1 |
| 14 günlük ayar | **Öneri olarak** gelir ("Uygula" / "Şimdilik kalsın"); cevapsız kalırsa hedef değişmez. Haftanın planıyla aynı anda sorulur. Sınırlar: tek seferde ±200 kcal, ayda ±300 kcal; taban max(1.200, Katch-McArdle dinlenme metabolizması) | Kullanıcının kararı; araştırma 6.4, bölüm 5 |
| Sert sınır | Haftada 1,5 kg'dan hızlı kayıpta öneri Bugün'de uyarı olarak görünür | Araştırma Soru 1 |
| Yürürlük | Hedef ve hız değişikliği her zaman yapılabilir; sıradaki prep'ten itibaren geçerli olur ve tarihi yazar. Buzluktaki porsiyonlar kayıtlı makrolarıyla kalır; farkı taze kısım ve ara öğün dengeler | Kullanıcının kararı |
| Gün tipi | Tek tip (her gün aynı hedef). Gün tipi veridir; hafif fark ya da eski döngü ayarlardan açılabilir | Araştırma Soru 3 |
| Spor bağı | Yalnızca proteinli ara öğünün antrenmana yakın konması için (`spor.workout_planned`: gün, saat, tür, süre). Antrenman ya da adım için kalori eklenmez | Araştırma bölüm 4 |

### Ölçümler

- **Kilo:** elle (akıllı tartı yok). Sabah akışının ilk adımı, sudan ve dişten önce; tek sayı alanı, son değer dolu gelir. Her sabah görünür; "Geç" denirse hiçbir şey olmaz. Akış dışında modül sayfasından ya da hızlı girişten ("kilo 117,6").
- **Bel çevresi:** 14 günde bir, plan günü sabahı, aynı akışta ek adım. Planı değiştirmez; ilerlemenin ikinci işaretidir.

### Stok

- **Hazır yemek stoğu** (buzdolabı ve buzluk): prep'te çıkan porsiyon eksi "Yedim". Kesin.
- **Malzeme stoğu:** alışverişte işaretlenen paketler eksi prep'te kullanılan gram. Tahmini.
- Liste paketle konuşur (450 g gerekiyorsa "1 paket, 1 kg"; kalan stokta kalır).
- Kendiliğinden düşme (ömür) yok. Düzeltme **alışveriş günü stok kontrolünde** yapılır: yalnızca o dönemin planının kullanacağı ve stokta var görünen malzemeler çıkar; her satır "var" gelir, kullanıcı "yok" der, miktarı düzeltir ya da fazlayı ekler; liste anında güncellenir. Kilerin tamamı Stok sayfasında.
- Başlangıç: stok boş; kurulumda dayanıklı malzemeler için bir kez "var / yok" listesi.

### Zincir

Plan günü sabahı (tartı, iki haftada bir bel) → plan kurulur (kalori önerisi burada) → stok kontrolü ve alışveriş → prep. Plan günü sabit bir hafta günü değildir.

### Kapsam

MacroFactor'dan alınanlar ve alınmayanlar: oturumun ilk mesajındaki tablo (alınır: haftalık ayar mantığı, hedef tarihi, kilo eğilimi, harcama tahmini, fotoğraf ya da tek cümleyle plan dışı kayıt; alınmaz: tam mikro besin takibi, seri sayacı, kopyala-yapıştır; sonra: barkod, adım). Lif tariften hesaplanır. Su, kafein ve mikro besin takibi yok.

## Araştırmanın kapsamadığı iki konu (oturumda web'den bakıldı)

- **Öğün sayısının günden güne değişmesi:** doğrudan kanıt küçük çapraz çalışmalardan (Farshchi ve ark. 2004, 2005; Alhussain ve ark. 2016, 2022; günde 6 öğün ile 3–9 arası değişen düzen, 14'er gün, yalnızca kadınlar, kilo verme yok). Bu kullanıcıya uzak ve zayıf. Çıkarım (oturumun yorumu): aralık dar tutulur, günlük toplam ve ≥3 protein alımı her gün korunur.
- **Saklama:** USDA FSIS: pişmiş yemek buzdolabında 3–4 gün, dondurucuda 3–4 ay (dondurucudaki süre kalite içindir). Tek prep en çok 4 günü besler; sonrası için ikinci prep ya da dondurucu.

## Açık (sıradaki adımlar)

1. Öğün yapısı ve yoğunluğa bağlanması; ikinci kişinin porsiyonu; kap sayısı.
2. Haftanın zinciri: plan kurucu, alışveriş, prep sahnesi, buzluk partileri.
3. Plan dışı yemekte yapay zekaya giden veri ve maliyet; bildirim.
4. Ekranlar (telefon ve pano), kareler.
5. Simülasyon, kurulum adımları, kabul ölçütleri; Sağlık alan sayfasına verilen görünümler; PrepEasy ile ilişki.

## Çekirdek için notlar (birikiyor)

1. Modül bağlamı günün ve haftanın sabit bloklarını vermiyor (`ctx.days` yalnızca uyanış ve yatış). Öğün yapısını yoğunluğa bağlamak için gerekir.
2. Uyanış dizisinde Rutin'in Sabah adımından (sıra 10) önce yer: tartı için sıra 5 önerilir (`ORTAK.md` bölüm 1).
3. Akşam kapanışında modülün tek satırlık sorusu ("işaretlenmeyen öğünler") için bir yer gerekip gerekmediği bakılacak (`controls.closing()` Rutin'in sahnesinde).
