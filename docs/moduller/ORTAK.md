# Modüller için ortak kararlar

Rutin modülünün tasarım oturumunda (13–14 Kas 2026) alınan ve öbür modüller için de geçerli olan kararlar. Yeni bir modül tasarlanırken önce bu dosya okunur; buradaki konular yeniden tartışılmaz, yalnızca modüle uygulanır. Bir modül buradan ayrılacaksa gerekçesi o modülün dokümanına yazılır.

Görünüşün tek kaynağı `docs/tasarim/` (Ç4b): ilkeler, ortak parçalar, ekranlar ve onaylı kareler; değerler `src/core/ui/tokens.css`'te.

Çizimlerin tamamı: https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k (Rutin tuvali; "Sabah · uçtan uca", "Akşam · uçtan uca", "Modül sayfası" sayfaları güncel olanlardır, "Yapı", "Görsel yönler" ve "Cam dili" sayfaları geçmiş turlardır). Ayrıntı ve gerekçe: `docs/moduller/rutin.md`, `docs/09-kararlar.md`.

## 1. Sınırlar: alan, modül, bölüm

- **Amaç alanı belirler, veri ve ekran modülü.** Sağlık bir alandır; üyeleri Rutin, Spor, Beslenme. Bir şeyin günün hangi saatinde yapıldığı modül sınırı değildir, zaman kısıtıdır (çapa); görünüş farkı bölümdür (`facets`).
- **Bir modülün işi başka modülün akışında görünebilir.** Sabahın dizisinde Spor'un hareketleri Rutin'in adımları arasında durur; o adıma gelince Spor'un kendi sahnesi açılır, bitince diziye dönülür (Ç3f, `docs/12-sahne-ve-otomasyon.md` bölüm G).
- **Çapalı işlerin sırası modüller arasında ortaktır** ve araya yer bırakılır. Uyanış: Rutin Sabah 10, Spor hareketler 20, Rutin Duş ve hazırlık 30. Yatış: Rutin Akşam kapanışı 10. Yeni modül boş bir sayı seçer.
- **Bir modülün satırı başka modülün sayfasında düzenlenmez.** Orada anahtarı olmayan bir satır olarak görünür ve dokununca sahibine gider.
- **Alanın bütün trendleri alan sayfasındadır** (`/a/<slug>`). Modülün kendi sayfası yalnızca kendi verisini gösterir. Alan sayfasına Modüller ekranındaki alan başlığından ve modül sayfasının başlığındaki alan adından girilir; alt menüye ve Bugün ekranına alan girişi konmaz. Tek bir "puan" hesaplanmaz; ayrı trendler ve türetilmiş birkaç metrik gösterilir.

## 2. Görsel dil

Taşındı (Ç4b, 15 Kas 2026): `docs/tasarim/ilkeler.md` (görsel dil ve kararlar) ve `docs/tasarim/parcalar.md` (ortak parçalar). Modül oradaki kit'i ve token'ları kullanır; yalnızca kendi zeminini verebilir.

## 3. Sahne (iş çalışırken tam ekran)

Taşındı (Ç4b): `docs/tasarim/ekranlar/sahne.md` ("Modül sahnesinin ortak düzeni"); Rutin'in sahnesi `docs/tasarim/ekranlar/rutin.md`.

## 4. Modül sayfası

Taşındı (Ç4b): `docs/tasarim/ekranlar/moduller.md` ("Modül sayfasının kuralları"); Rutin'in sayfası `docs/tasarim/ekranlar/rutin.md`.

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
