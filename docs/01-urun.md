# Ürün

## Sorun

Kullanıcı tam zamanlı çalışıyor, üniversitede 6 ders alıyor ve bunların yanında sağlık, ev, yüksek lisans hazırlığı gibi alanları yürütüyor. Her alan ayrı bir araçta takip ediliyor (Notion, takvim, anımsatıcılar, uygulamalar) ve bir yerden kopuyor. Ortak kaynak zaman olduğu halde bütün işleri aynı anda görüp planlamak mümkün olmuyor.

## Çözüm

Lisedeki alışkanlığın gelişmiş hali: yatmadan önce yarının işlerini bir deftere yazmak ve sabah ona bakmak. Sherpa bunu bütün hayata yayar:

- Bütün alanlardaki işler tek havuzdadır.
- Bugün ekranı her an tek bir "şimdi" işi gösterir.
- Her alanın (modülün) kendi sayfası vardır ve o alanın bütün resmini gösterir.
- Modüller zamanla eklenir, molaya alınır, arşivlenir.

## Ad

Uygulamanın adı **Sherpa**: dağda yolu bilen ve yükü taşıyan rehber. Zirveye kullanıcı çıkar; yolu ve yükü Sherpa taşır. Depo, alan adı ve telefondaki uygulama etiketi `sherpa` adını kullanır.

## Kullanım biçimi

- **Masaüstü, ikinci ekran:** Uygulama çalışma masasındaki ikinci monitörde gün boyu açık durur. Birincil kullanım budur; Bugün ekranı buna göre tasarlanır.
- **Telefon:** Ofiste, kampüste ve dışarıda aynı uygulama PWA olarak kullanılır. Giriş, işaretleme ve alışveriş gibi kısa etkileşimler öne çıkar.
- Tek kullanıcı vardır. Paylaşım, ekip, rol yok.

## İlkeler

1. **Tek kaynak, tek giriş, tek ekran.** Her veri türünün tek bir kaynağı vardır, bir kez girilir, her şey aynı ekranda görünür.
2. **Durum değil zaman.** Ölçülemeyen durum (çamaşır, bulaşık) takip edilmez; ona ayrılan zaman takip edilir.
3. **Sabit program yok.** Takvimde yalnızca gerçekten sabit olanlar durur. Rutinler sıklık hedefidir, işler esnek havuzda bekler.
4. **Sürtünmesiz giriş.** Her giriş en fazla 2 dokunuş ya da tek cümle. Eksik veri cezalandırılmaz; sistem tahminle devam eder ve tahmin olduğunu gösterir.
5. **Affedici.** Kaçan iş yeniden yerine konur. Borç bir dönemden fazla birikmez, seri sayacı yoktur.
6. **Ritüele bağımlı değil.** Akşam kapanışı planı iyileştirir ama şart değildir.
7. **Günün bitiş çizgisi var.** Planlanan işler bitince ekran "Bugün tamam" der.
8. **Modüler.** Her modül çekirdeğe aynı sözleşmeyle bağlanır, içi serbesttir.
9. **Önce kullan, sonra büyüt.** Her modül tasarlanır, kurulur, 2 hafta kullanılır, sonra geliştirilir.

## Kavramlar

| Kavram | Anlamı |
| --- | --- |
| Modül | Bir hayat alanı: Okul, Beslenme, Ev. Türü ömürlük, dönemlik ya da hedefe kadar olabilir |
| Alan | Birden fazla modülü tek sayfada birleştiren grup. İlk alan Sağlık: Rutin + Spor + Beslenme |
| İş zarfı | Modüllerin çekirdeğe iş teklif ederken kullandığı ortak yapı. Temel alanlar her modülde aynıdır; modüle özel ayrıntı `meta` içindedir |
| İş kalemi | Sonucu olan iş: "Midterm hazırlığı", "TUM başvurusu". Toplam eforu vardır; uzaktayken kaba durur, haftası gelince oturumlara bölünür |
| İş (oturum işi) | Tek oturumda biten şey, en fazla 90 dakika. Çoğu bir iş kaleminin parçasıdır |
| Ritim | Tekrarlanan hedef: "haftada 2 süpürme", "her gün sabah rutini". Belirli güne bağlı değildir |
| Sabit blok | Zamanı belli olan şey: ders, iş saatleri, randevu, korunan zaman |
| Yuva | Sabit bloklar arasındaki boşluk. Türü vardır: derin, hafif, mola |
| Oturum | Bir işe harcanan gerçek zaman (Başla ve Bitti arası) |
| Hayat modu | Normal, Yoğun, Minimum, Tatil. Bütün modüllerin davranışını birlikte değiştirir |
| Plan ufku | Dönem, ay, hafta, gün, şimdi. Uzak ufuk kaba, yakın ufuk ayrıntılı planlanır |
| Bitiş çizgisi | Günün planlanan işlerinin bittiği nokta |
| Gelen kutusu | Henüz bir modüle yönlendirilmemiş ham girişler |

## Kapsam

### v1 (çekirdek hattı Ç0–Ç4 ve Okul modülünün 1. adımı)

- Çekirdek: işler, projeler, ritimler, sabit bloklar, oturumlar, gün planı, gelen kutusu
- Planlayıcı motoru: yuvalar, süzgeçler, skor, koruma kuralları, bitiş çizgisi, otomatik plan
- Bugün ekranı (ikinci ekran ve telefon), Hafta görünümü, akşam kapanışı
- Okul modülü: dönemin tamamı, Notion'dan aktarım
- Yapay zeka katmanı: girişten süre ve öncelik tahmini, günlük plan önerisi, haftalık denge
- Modül iskeleti: yeni modül eklemek için sözleşme ve sayfa şablonu

### Sonra (tasarımı onaylandıkça)

- Sağlık alanı: Rutin (sabah ve akşam), Spor, Beslenme
- Ev, İş, Yüksek lisans, Hayat idaresi modülleri
- Ninova bağlantısı: ödev, duyuru ve dosyaların kendiliğinden gelmesi
- Claude köprüsü: Claude sohbetlerinin ve ders projelerinin Sherpa'yı okuyup yazması (MCP)

### Kapsam dışı

- Çok kullanıcı, paylaşım
- İş (şirket) görevlerinin takibi: kullanıcı bunları iş yerinde takip ediyor; Sherpa yalnızca çalışma saatlerini ve özel hazırlıkları bilir
- Ders içeriği ve çalışma materyali üretimi: bunlar Claude ders projelerinde yapılır (bkz. `docs/moduller/okul.md`)
- Oyunlaştırma: puan, rozet, seri
- Tam çevrimdışı çalışma (yalnızca son planı görme ve üç işlemi kuyruğa alma var)

## Başarı ölçütü

İki hafta kullanımdan sonra kullanıcı Notion'daki dönem sayfasını ve anımsatıcı uygulamasını açma ihtiyacı duymuyorsa ve Bugün ekranına günde en az bir kez bakıyorsa v1 başarılıdır.
