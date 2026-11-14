# Modüller için ortak kararlar

Rutin modülünün tasarım oturumunda (13–14 Kas 2026) alınan ve öbür modüller için de geçerli olan kararlar. Yeni bir modül tasarlanırken önce bu dosya okunur; buradaki konular yeniden tartışılmaz, yalnızca modüle uygulanır. Bir modül buradan ayrılacaksa gerekçesi o modülün dokümanına yazılır.

Çizimlerin tamamı: https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k (Rutin tuvali; "Sabah · uçtan uca", "Akşam · uçtan uca", "Modül sayfası" sayfaları güncel olanlardır, "Yapı", "Görsel yönler" ve "Cam dili" sayfaları geçmiş turlardır). Ayrıntı ve gerekçe: `docs/moduller/rutin.md`, `docs/09-kararlar.md`.

## 1. Sınırlar: alan, modül, bölüm

- **Amaç alanı belirler, veri ve ekran modülü.** Sağlık bir alandır; üyeleri Rutin, Spor, Beslenme. Bir şeyin günün hangi saatinde yapıldığı modül sınırı değildir, zaman kısıtıdır (çapa); görünüş farkı bölümdür (`facets`).
- **Bir modülün işi başka modülün akışında görünebilir.** Sabahın dizisinde Spor'un hareketleri Rutin'in adımları arasında durur; o adıma gelince Spor'un kendi sahnesi açılır, bitince diziye dönülür (Ç3f, `docs/12-sahne-ve-otomasyon.md` bölüm G).
- **Çapalı işlerin sırası modüller arasında ortaktır** ve araya yer bırakılır. Uyanış: Rutin Sabah 10, Spor hareketler 20, Rutin Duş ve hazırlık 30. Yatış: Rutin Akşam kapanışı 10. Yeni modül boş bir sayı seçer.
- **Bir modülün satırı başka modülün sayfasında düzenlenmez.** Orada anahtarı olmayan bir satır olarak görünür ve dokununca sahibine gider.
- **Alanın bütün trendleri alan sayfasındadır** (`/a/<slug>`). Modülün kendi sayfası yalnızca kendi verisini gösterir. Alan sayfasına Modüller ekranındaki alan başlığından ve modül sayfasının başlığındaki alan adından girilir; alt menüye ve Bugün ekranına alan girişi konmaz. Tek bir "puan" hesaplanmaz; ayrı trendler ve türetilmiş birkaç metrik gösterilir.

## 2. Görsel dil

- **Cam ortaktır, zemin modüle göre değişir.** Paneller, şerit, düğmeler, liste satırları ve geçiş kuralları her ekranda aynı camdır (bulanık, yarı saydam koyu dolgu, ince açık kenar, üstte ışık çizgisi). Zemin varsayılan olarak günün saatine göre gökyüzüdür; modül isterse kendi zeminini verir (Spor: siyah-yeşil).
- **Gökyüzü ilerlemeye değil saate bakar.** Güneşin yüksekliği tarih, saat ve ayardaki sabit koordinattan (varsayılan İstanbul) cihazda hesaplanır; konum izni, dış servis ve hava durumu yoktur. Hiçbir modül "adım ilerledikçe değişen zemin" kurmaz. İlerleme küçük bir çizgi dizisiyle gösterilir.
- **Metin tonu:** gökyüzü zemininde her saatte açık metin ve koyu cam (gündüz kareleri de böyle çizildi; 14 Kas 2026). Zemin metni okutmayacak kadar parlarsa cam koyulaşır (en az 4,5:1). Kendi zeminini veren modül (aydınlık bir zemin) tonunu kendisi seçer.
- **Renk tek başına anlam taşımaz;** modülün ve bölümün rengi nokta, vurgu ve ilerleme çizgisinde kullanılır.
- **Geçişler kesintisizdir.** Zemin aynıysa yalnızca paneller yer değiştirir; zemin değişiyorsa çapraz geçer. Sıçrama, parlama, konfeti yok.
- **Telefonun alt menüsü:** seçili sayfa öbürlerinden geniş, opak açık hap (koyu ikon ve yazı); hızlı giriş düğmesi (+) menüyle aynı koyu camdan. Ekranda tek opak açık öğe seçili sayfadır.
- **Denenmemiş olanlar** (her modülün ilk kurulum adımında gerçek telefonda bakılır): cam bulanıklığının iPhone'daki görünüşü ve hızı, her zaman açık panoda bulanıklığın yükü, iki tonda kontrast.

## 3. Sahne (iş çalışırken tam ekran)

- **Düzen:** üstte cam şerit (saat, bölümün rengi ve adı, geçen süre, "Çık"); başlık ve varsa büyük sayaç; "Bu adımda" paneli; küçük "Sıradaki" paneli; altta ana düğme, "Atla", "Hepsini yaptım".
- **"Bu adımda" paneli** adımın alt adımlarını numaralı gösterir, en çok üç satır; alt adım bittikçe liste yukarı kayar.
- **Küçük panel** sıradaki adımı, "bu sabah 3 / 7" gibi sayıyı ve çizgileri gösterir; son adımda günün sıradaki işini ("Sonra: 10:30 …").
- **Son adımda ana düğme "Bitti"dir.**
- **Süreli alt adım** süresi bitince kendiliğinden sıradakine geçer ve adını söyler. "Süre dolmadan geçme" açıksa (varsayılan) ana düğme süre boyunca soluk "Erken geç · basılı tut" olur. Süresiz alt adım dokunuş bekler.
- **Açılış ve kapanış tek yazıdır:** "Günaydın" → "Kalktım"; bitince "İyi günler"; akşam "İyi geceler". Sayı, süre, övgü yazılmaz; yazı solarken sonraki ekran belirir.
- **Sahne her cihazda aynıdır;** pano ve telefon düzeni ayrı çizilir.

## 4. Modül sayfası

- Çekirdeğin beş bölgeli iskeleti; başlıkta modülün rengi, adı, alanı (bağlantı) ve modülün ana ekleme düğmesi.
- **Sekmeler yalnızca bölümlerdir** (`facets`): cam hap içinde yan yana. Modülün geçmiş ve trend görünümü (iskeletin 4. bölgesi; Rutin'de "Düzenlilik") bölüm değildir, bölümlerin verisini birleştirir; bu yüzden sekmelerin içinde durmaz, aynı satırda ayrı bir düğmedir (grafik simgesi ve ad; telefonda sekmelerin sağında, panoda satırın sağ ucunda). Her modülde aynı yerde ve aynı simgeyle durur; adını modül seçer (Rutin: Düzenlilik; Spor kendi adını seçer). Açıkken düğme opak açık olur, sekmelerin hiçbiri seçili görünmez.
- **Liste satırı:** ad, tek satır özet (süre, alt öğe sayısı, sıklık), varsa etiket, açık/kapalı anahtarı. Ekler girintili ve numarasız, kapalı olanlar soluk durur. Liste, sahnedeki sırayla numaralıdır; satırlar kendi grubunda sürüklenerek sıralanır.
- **Düzenleme** telefonda alttan açılan cam sayfada, panoda sağdan açılan yan panelde yapılır. Ekleme aynı sayfayı boş açar.
- **Her şey düzenlenebilir:** ad, süre, sıklık, alt öğeler (ekle, çıkar, sırala, süre ver). Ekranda yazan her sayı ya düzenlenir ya da düzenlenebilen sayılardan hesaplanır; hesaplanan sayı öyle etiketlenir ("toplam 4 dk").
- **Silme onayı** silmek yerine kapatmayı da sunar.
- **İçerik veridir, kod değil.** Kullanıcı öğrendikçe adım, ürün, kural ekleyip değiştirir; bunun için kod değişmez.

## 5. Öğrenme ve öneriler

- **Süreler kendiliğinden öğrenilir, onay istenmez.** Planı çekirdeğin tahmin çarpanı düzeltir (`docs/04-planlayici.md`, "Öğrenme"). Modül, ekranda gösterdiği süreleri de gerçek ölçümün ortancasına kendisi çeker; değişiklik yalnızca tek satır bilgi olarak görünür ("Son değişenler").
- **Kullanıcının elle girdiği değer kullanıcınındır;** otomatik güncelleme o alanda durur, "Otomatiğe dön" ile geri açılır.
- **Ölçüme girmeyenler:** atlanan ve arka arkaya toplu geçilen adımlar.
- **Durum tespiti öneri diye sunulmaz.** "Şu adım 10 günün 7'sinde atlandı" bir sayıdır; modülün trend sekmesinde sayı olarak durur, yanına "şunu yap" cümlesi eklenmez. Öneri, ancak tek dokunuşla uygulanabilen somut bir değişiklikse öneridir (ör. "Nasır kremi açılabilir" · "Aç"). Modülün böyle bir önerisi yoksa vermez; durum şeridinde boş yer ya da yer tutucu bırakılmaz.
- **Kendiliğinden yapılan değişiklikler** modülün trend sekmesinde "Değişenler" altında bilgi olarak görünür; onay istemez.
- **Sayım yalnızca modülün çalıştığı günler üzerinden yapılır;** çalışmadığı gün "atlandı" sayılmaz.

## 6. Dil

- "Asgari" denmez; "temel adım" denir. Kod ve sütun adları İngilizce kalır (`minimum`).
- Teknik iç adlar ekrana çıkmaz (ör. sabahın ikinci bloğunun adı "Hazırlık" düzenlilik görünümünde ayrı satır olmaz; kullanıcı için tek sabah vardır).
- Metinler kısa ve düz; ünlem, emoji, övgü yok. Gariplik hissi veren kalıplar ("Bu sabah tamam") yerine gündelik karşılığı aranır ("İyi günler").

## 7. Takip ve düzenlilik

- Seri, puan, rozet, kırmızı uyarı yok. Yapılmayan gün gri kalır; kaçan gün yeniden planlanmaz ve birikmez.
- Düzenlilik görünümü kullanıcının kendi sözcükleriyle iki üç satırdan fazla olmaz; altında neyin sayıldığı tek cümleyle yazar.
- Günün hangi güne ait olduğu çekirdeğin gün kaydından alınır (gece yarısından sonraki yatış önceki günün gecesidir).

## 8. Tasarım oturumunun işleyişi

- **Kullanıcı ekranları uçtan uca görmek ister.** Yalnızca örnek kareler yetmez: bir akışın baştan sona her adımı ve modül sayfasının dokununca açılan her ekranı çizilir (telefon ve pano).
- **Çizimler tarayıcıda çizilip bakılarak** yayınlanır; bakılmadan yayınlanan kare "denenmedi" diye belirtilir.
- **Kararlar öneriyle birlikte, tablo halinde sorulur;** kullanıcı itiraz etmediklerine "tamam" der.
- **Kullanıcı elle iş istemez.** Onay düğmesi, günlük giriş ya da "sen ayarla" gerektiren her tasarım önce "kendiliğinden olabilir mi" diye sınanır.
- **Çekirdeğe dokunan her şey** modül dokümanının "Çekirdek için notlar" bölümüne yazılır; modül oturumunda çekirdek değiştirilmez.
