# Devir: çekirdek ekranlarının cam tasarımı oturumu (14–15 Kas 2026)

Bu metin, tasarım sohbetinden projeyi ilerleten ana sohbete bilgilendirmedir. Tasarım sohbeti `prompts/cekirdek-cam-tasarim-oturumu.md` ile açıldı; kod yazılmadı, Claude Code istemi üretilmedi. İstemleri sen yazacaksın.

## Önce oku

1. `docs/13-cam-dili.md`: bu oturumun tek kaynağı. Kararlar (bölüm 1), gökyüzü (2), ortak parçalar (3), on ekran grubunun kuralları ve kare adları (4), gerçek cihazda bakılacaklar (5), **içeriği değişenlerin toplu tablosu (6)**, dışarıda bırakılanlar (7).
2. `docs/09-kararlar.md`: 14 ve 15 Kas 2026 satırları ve "Fikirler"in son iki maddesi.
3. `docs/moduller/ORTAK.md`: bölüm 2 ve 4'e eklenenler.
4. Tuval: https://claude.ai/artifact/YDd1zPn8g5xJyxViNF2KeG ("Sherpa · Çekirdek ekranları"; 13 sayfa, yaklaşık 200 kare, telefon 390×844 ve pano 1440×900).

## Durum

- On grubun hepsi çizildi ve kullanıcı hepsini onayladı. Ayarlar'ın onayı "şimdilik"tir: kullanıcıya ayar sayısı fazla geliyor, içeriği sonra sadeleşecek (Fikirler).
- Hiçbiri kurulmadı. Kod her konuda eski halindedir.
- Kareler masaüstü tarayıcıda çizilip bakıldı; gerçek telefonda ve panoda denenmedi.
- Depoda commit edilmemiş değişiklikler var: `docs/13-cam-dili.md` (yeni), `docs/09-kararlar.md`, `docs/05-arayuz.md`, `docs/moduller/ORTAK.md`, bu dosya. `docs/moduller/rutin-cizimler/degerler.md` üzerindeki değişiklik ve `prompts/cekirdek-cam-tasarim-oturumu.md` bu oturuma ait değildir.
- `docs/05-arayuz.md` kurulu olan hali anlatmaya devam ediyor; yalnızca ilgili bölümlerin başına "kararı, kurulmadı" notu kondu. `docs/13` ondan ayrıldığı yerde geçerlidir. 01, 03, 04, 07, 10 ve `rutin.md` güncellenmedi.

## Önemli: oturum görünüşle başladı, içerik de değişti

İstem "içerik ve davranış aynı kalır" diyordu. Kullanıcı ekranları görünce çekirdeğin içeriğini de sadeleştirdi. Aşağıdaki kararlar kullanıcınındır; yeniden tartışma, uygula.

### A. Görünüş kararları

- **Tek renk sistemi.** Her saatte koyu cam ve açık metin; açık / koyu / sistem tema seçimi kalkar. Ayarlar → Görünüm'de "Saydamlığı azalt" ve "Hareketi azalt".
- **Gökyüzü yalnızca saate bağlı.** Güneşin yüksekliği cihazda tarih, saat ve sabit koordinattan hesaplanır. Hava durumu konuşuldu ve ertelendi (Fikirler).
- **Tam manzara yalnızca Bugün, sahne ve giriş ekranında.** Öbür bütün ekranlar sakin zemin (o saatin gökyüzünün genel rengi; güneş, ay, tepe yok). Rutin'in modül sayfası da sakin zemine geçer.
- **Pano gün boyu açık:** gerçek bulanıklık yalnızca altından içerik geçen yerde; sürekli hareket yok; gece durumu karartılır.
- **Modüle özel zemin** modülün hem sayfasında hem sahnesinde; çekirdek ekranlarında modül yalnızca renk noktası.
- **Yoğun ekran ölçüleri** ve **ortak parçalar** (panel türleri, liste satırı, düğme türleri, alan, anahtar, hap, durum renkleri, bildirim, pencere, alttan sayfa ve yan panel): `docs/13` bölüm 1 ve 3. Kartta en çok bir birincil düğme; kesik kenar yapay zekanın koyduğu değer.
- **Formlar** telefonda alttan açılan sayfa, panoda sağdan 440 px yan panel.
- Menüde "Hafta" yerine "Takvim".

### B. İçerik kararları (çekirdeğe dokunur)

| Konu | Karar | Kullanıcının gerekçesi |
| --- | --- | --- |
| Bugün'ün üst satırı | Yalnızca "Bugün" ve tarih (panoda saatle). İlerleme (n/3), bitiş, uyanış ve yatış, mod, bağlam kalkar | Kalabalık ve boğucu; önündeki işleri görmek istiyor |
| Hayat modu | Tamamen kalkar; hiçbir ekranda seçilmez ve gösterilmez | Böyle bir seçenek istemiyor; yükü motor çıkarmalı |
| Bağlam (nerede olduğum) | Elle seçilmez; planlayıcı tahmin eder, konum takibi gelince ondan okur | Yer seçmek istemiyor |
| Saatle belirlenen gün bitişi | Kalkar: ne ayarda ne ekranda. Çalışma penceresi akşam rutinine kadar uzanır. "Bugün tamam" kalır | Akşam rutini ve yatış aralığı günün sonunu zaten veriyor |
| "Vakit kalırsa" | Kalkar. "Sıradakiler" günün kalan planıdır; sığmayan iş ekranda birikmez | Böyle bir ayrım hiç istemedi; planı motor günceller |
| Günün 3 işi | Kalkar: planlayıcıda, yapay zeka önerisinde, Günaydın özetinde, geri dönüş kartında, kapanışta | Aynı gerekçe |
| Bugün'deki Günaydın kartı | Yedek olarak kalır (uyanış alarmdan gelmediğinde); yalnızca "Günün işleri" satırı çıkar | Olağan sabah Rutin'in sahnesinden geçer |
| Zaman çizelgesi | Bütün günü gösteren saatli yatay şerit: saat etiketleri üstte; panoda iş adları içinde, telefonda dokununca balon | Eski şeritte saatler okunmuyordu |
| Sıradakiler | Açılır liste: kapalıyken sıradaki işler (telefon 2, pano 3), "Hepsini göster" ile günün kalanındaki her şey (işler, mola, sabit blok), "Küçült" ile geri | Kullanıcının kendi tarifi |
| Hafta → Takvim | Baştan tasarlandı: üstte dokunulabilir yedi gün (açılışta seçili değil); altında bu haftanın işleri **teslim tarihine göre**; güne dokununca o gün (geçmişte yalnızca yapılanlar, teslim ve sınav, sabit; gelecekte planlananlar); hafta seçici; küçük "önümüzdeki haftalar" çubukları. Ayrı kapasite paneli, "Modül payları" satırı ve uyku ortalaması kalkar | Kullanıcının kendi tarifi; ayrıntıları "en mantıklı önerinle" diye bıraktı ve onayladı |
| Akşam kapanışı | Yalnızca Rutin'in akşam sahnesinin içinde bir adım. Ayrı sayfa ve Bugün'deki iki "Günü kapat" düğmesi kalkar; sahnede "Onayla ve yat" yok, "Vazgeç" kapanışı atlar | Kapanışı akşam rutininin parçası olarak yapmak istiyor |
| Ayarlar | Tek uzun sayfa yerine bölüm listesi ve bölüm sayfaları; Görünüm'de tema yerine iki anahtar; modül ayarlarında "Hayat modlarında" yok | Görünüş "şimdilik" onaylı |

Kapsam: Sağlık alan sayfası kesinlikle olacak (kabuğu çizildi; metrikleri 13 Kas kararı gereği sonra). `deneme` modülünden hiçbir şey çizilmedi.

### C. Açık kalan çekirdek soruları

Bunlar tasarım sohbetinde cevaplanmadı; planlayıcı işinden önce kullanıcıyla karara bağlanmalı.

1. Konum takibi gelene kadar bağlam tahmini neye dayanır (sabit blokların yeri ve gün tipi mi, süzgecin tümden kapanması mı)?
2. Bitiş saati kalkınca `after_finish` ayrımı ve "akşam" bölümü ne olur?
3. Günün 3 işi kalkınca "Bugün tamam" neye bakar (günün planındaki bütün işler mi)?
4. Takvim'de gelecek günün "Planlananlar"ı: bugünkü motor yalnızca bugünü, kapanışta da yarını planlıyor. Haftanın işlerini günlere dağıtan bir ufuk gerekiyor; o yapılana kadar gelecek günde yalnızca teslim, sabit blok ve vakit gösterilebilir.
5. Rutin kapalıyken ya da akşam sahnesi hiç açılmadan kapanışa nasıl ulaşılır? Çekirdek modüle bağımlı olamaz.
6. Bağlam seçimi kalkınca Bağlantılar'daki `core/context` ucu ve günün çerçevesindeki gün tipleri durur; teyit et.

### D. Rutin modülüne etkiler

- Kapanış adımı (`kind: closing`) `rutin.md`'de 2. kurulum adımına yazılı; bu kararla öne alınması gerekebilir.
- Sesli özetin kalıbı "Bugünün üç işi…" ve "Gün 19:00'da bitiyor" diyor; ikisi de artık yok.
- Modül sayfası sakin zemine geçer; tek tema ile "açık ya da koyu temada zor seçilir" renk uyarısı anlamını yitirir.

### E. Yeni arayüz metinleri (kodda yok)

"Hepsini göster", "Küçült", "GÜNÜN AKIŞI"; Görünüm'deki iki anahtarın açıklamaları; Takvim'de "BU HAFTA", "… iş · … vakit", "İstenen süre bu haftanın vaktini aşıyor.", "Yetişmeyebilir: …", "Teslim …", "Plan tahminidir; o sabah yeniden kurulur.", "Bugün'e git", "Bu hafta için taahhüt edilen iş yok."; kapanışta "İstemediğini çıkar."; "bağlantı yok" hapı; kayıtlarda telefonda "Sil". Tam liste ve yerleri `docs/13`'te.

## Senden beklenen

1. Yukarıdaki dosyaları oku; `docs/ILERLEME.md`'ye bu oturumu ve "Senden bekleyenler"e C'deki soruları işle.
2. Doküman değişikliklerini commit ettir.
3. Kurulumu parçalara böl ve her biri için Claude Code istemi yaz. Tasarım sohbetinin önerisi (karar senin ve kullanıcının):
   - **Planlayıcı ve veri:** hayat modu, bağlam, bitiş saati, günün 3 işi, gelecek günlerin planı. C'deki sorular cevaplanmadan başlamaz; 01, 03, 04, 10 ve `rutin.md` bu işte güncellenir.
   - **Cam fazı (görünüş):** tek renk sistemi, gökyüzü ve sakin zemin, ortak parçalar, içeriği değişmeyen ekranlar (Gelen kutusu, hızlı giriş ve düzenleme, modül sayfası iskeleti, sahne kabuğu, giriş, boş ve hata). Planlayıcıdan bağımsız başlayabilir.
   - **İçeriği değişen ekranlar:** Bugün (üst satır, şerit, açılır Sıradakiler), Takvim, kapanışın sahneye taşınması, Ayarlar. Bir kısmı planlayıcı işine bağlıdır.
4. Her fazın kabul ölçütüne `docs/13` bölüm 5'teki gerçek cihaz denetimlerini koy.
5. Kurulan her parçada `docs/05-arayuz.md`'yi `docs/13`'e göre güncellet; iki doküman ayrışık kalmasın.
