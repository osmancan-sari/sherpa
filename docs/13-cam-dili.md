# Cam dili: çekirdek ekranlarının görünüşü

**Durum: tasarım tamamlandı ve onaylandı; kurulmadı** (`prompts/cekirdek-cam-tasarim-oturumu.md`, 14–15 Kas 2026). On grubun hepsi kullanıcı tarafından onaylandı (15 Kas 2026). Kurulum ayrı bir Claude Code fazında yapılır; istemini ilerleme sohbeti yazar.

**Tuval:** https://claude.ai/artifact/YDd1zPn8g5xJyxViNF2KeG ("Sherpa · Çekirdek ekranları"). Sayfalar: "Gökyüzü", "Ortak parçalar", "Kararlar (onaylananlar)", "1 · Bugün", "2 · Zaman çizelgesi", "3 · Takvim", "4 · Gelen kutusu", "5 · Giriş ve düzenleme", "6 · Akşam kapanışı", "7 · Modüller, modül ve alan sayfası, sahne", "8 · Ayarlar", "9 · Giriş ekranları", "10 · Boş ve hata durumları". Rutin'in sahnesi ve modül sayfası ayrı tuvaldedir (`docs/moduller/ORTAK.md`). Kareler masaüstü tarayıcıda çizilip bakıldı; gerçek telefonda ve panoda denenmedi.

Oturum görünüş için açıldı; kullanıcı ekranları görünce içeriği de sadeleştirdi. **Bu yüzden bu dosya `docs/05-arayuz.md`'den ayrıldığı yerlerde geçerlidir;** ayrılıklar bölüm 6'da toplu durur ve her biri `docs/09-kararlar.md`'de karar satırıdır. Ortak kurallar (`docs/moduller/ORTAK.md` bölüm 2 ve 4) geçerlidir.

## 1. Kararlar

| # | Konu | Karar (kullanıcı, 14 Kas 2026) |
| --- | --- | --- |
| 1 | Tema | Tek renk sistemi: her saatte koyu cam ve açık metin. Açık / koyu / sistem seçeneği kalkar. Ayarlar → Görünüm'de yerine "Saydamlığı azalt" ve "Hareketi azalt" durur (cihazın kendi tercihini de izler). |
| 1b | Gökyüzü | Zemin yalnızca **günün saatine** bağlıdır: güneşin yüksekliği cihazda tarih, saat ve sabit koordinattan hesaplanır (varsayılan İstanbul). Hava durumu, konum izni ve dış servis yoktur. Hava durumuna göre zemin konuşuldu ve ertelendi (`docs/09-kararlar.md` "Fikirler"). |
| 2 | Gökyüzü hangi ekranlarda | Tam manzara (güneş, ay, yıldız, tepeler): Bugün, sahne, giriş ekranı. Öbür bütün ekranlar **sakin zemin**: Bugün'deki gökyüzünün o anki genel rengi; güneş, ay ve manzara yok. Uzun sayfada zemin sabit durur, içerik üstünden kayar. Sonuç: Rutin'in modül sayfası sakin zemine geçer. |
| 3 | Pano gün boyu açık | Gerçek bulanıklık yalnızca altından içerik geçen yerde (pencere, yan panel, alt menü, şerit); durağan zeminin üstündeki panelde aynı görünüş bulanıklıksız kurulur. Panoda sürekli hareket yok (bulut kaymaz, yıldız titreşmez); gökyüzü dakikada bir güncellenir. Gece durumunda ekran karartılır (%38 örtü) ve uyumasına izin verilir. "Saydamlığı azalt": paneller düz ve opak (`#141b38`). "Hareketi azalt": geçişler anlık. |
| 4 | Modüle özel zemin | Modül zemin verirse hem modül sayfasında hem sahnesinde kullanılır (Spor: siyah-yeşil); vermezse sakin zemin. Modüller listesinden girerken zemin çapraz solar. Çekirdek ekranlarında (Bugün, Hafta) modülün işi yalnızca renk noktasıyla görünür. |
| 5 | Yoğun ekranlar | Liste, tablo ve form sakin zeminde, daha dolu camda (%50). Telefonda başlık 16 px, ikincil yazı en az 14 px, satır en az 56 px; ayırıcı %14; sayılar hizalı rakam. Panoda ikincil 15, birincil 17–18, "Şimdi" başlığı 44 px ve üstü. |
| 6 | Bugün'ün üst satırı | Yalnızca "Bugün" ve tarih (panoda saatle). İlerleme (n/3), bitiş saati, uyanış ve yatış satırı, hayat modu ve bağlam seçici yok. Hayat modu ve bağlam seçimi uygulamadan kalkar (`docs/09-kararlar.md`); saatle belirlenen bitiş de kalkar: Günaydın özetinde ve zaman çizelgesinde bitiş gösterilmez. Panoda güneşin "Sıradakiler" panelinin arkasında kalması kabul. |
| 7 | Sıradakiler | "Vakit kalırsa" bölümü yok; "Sıradakiler" günün kalan planıdır. "Bugün tamam" kartında düğme yok; liste boşken "Sırada başka iş yok." |
| 8 | Günün 3 işi | Yok. Günaydın kartında "Günün işleri" satırı çizilmez; geri dönüş kartı sıradaki tek işi ve "Başla"yı gösterir. Bugün'deki yedek Günaydın kartı (uyanış alarmdan gelmediğinde görünür) bunun dışında olduğu gibi kalır. |

Kapsam kararları: **alan sayfası (Sağlık) çizilir** (kullanıcı: alanların sayfası kesinlikle olacak; üye modüllerin verisinden oluşan genel durum sayfası). `deneme` modülünün hiçbir ekranı çizilmez. Kullanıcı Bugün'ün ayrıntılarını bütün çizimler bitince, akışların tamamını görerek inceleyecek.

## 2. Gökyüzü

Çizim: "Gökyüzü" sayfası; üst sıra Bugün'de tam manzara, alt sıra aynı saatte sakin zemin (dörder kare: `Hava_safak`, `Hava_acik`, `Hava_batim`, `Hava_gece` ve `HavaSakin_*`).

- **Durumlar:** şafak, gündüz, gün batımı, gece. Aralar güneşin yüksekliğine göre yumuşak geçer; dört kare bu geçişin örnek anlarıdır.
- **Renk:** metin her saatte açık kalır, paneller koyu camdır. Sakin zemin, o saatin gökyüzünün üst renklerinin ekran boyuna yayılmış halidir.
- **Durumla saat:** kartın durumu gökyüzünü değiştirmez. "Günaydın" şafakta, "Akşam" gecede çizildi çünkü o saatlerde görünürler; aynı kart başka saatte o saatin gökyüzüyle durur.

## 3. Ortak parçalar

Çizim: "Ortak parçalar" sayfası, iki kare (`Parca1`, `Parca2`). Kullanıcı onayladı (14 Kas 2026).

| Parça | Tanım |
| --- | --- |
| Ana panel | Tam manzaranın üstünde; dolgu `rgba(14,18,44,0.42)`, köşe 28, 1 px açık kenar (%24), üstte ışık çizgisi. |
| Yoğun panel | Liste, tablo, form; dolgu %50, köşe 24. |
| İkincil panel | Not, özet, küçük kutu; dolgu %34, köşe 22. |
| Liste satırı | En az 56 px (panoda 52); başlık 16 px 600, alt satır 14 px; ayırıcı %14; seçili satır %12 açık dolgu; bekleyen soluk (%55). Satır eylemleri 44 px yuvarlak simge düğmesi. |
| Düğmeler | Birincil: opak açık (`rgba(246,247,255,0.92)`), koyu yazı; ekranda en çok bir tane. İkincil: saydam cam. Sessiz: yalnızca yazı. Tehlikeli: mercan kenar. Pasif: soluk. Boylar 54 / 48 / 38; dokunma alanı en az 44. |
| Alan | Yükseklik 50, köşe 16, yazı 16 px; odakta beyaz kenar ve halka; hatada mercan kenar ve altında tek cümle. Saat alanı "SS:dd". |
| Anahtar, parçalı seçim, hap | Açık anahtar ve seçili parça opak açık. Modül hapı renk noktasıyla. Kesik kenarlı hap yapay zekanın koyduğu değerdir. |
| Durum | Yolunda `#6fe3b0`, dikkat `#ffcc66`, geride `#ff9f8a`; her biri simge ve yazıyla. Kırmızı ve "gecikti" yok. |
| Sekme ve geçmiş düğmesi | `ORTAK.md` bölüm 4. |
| İlerleme | Süre çubuğu işin rengiyle (8 px); adım çizgileri bölümün rengiyle (4 px). |
| Uyarı satırı | İkincil panel, simge, tek cümle, tek eylem; en çok iki satır. |
| Bildirim | Altta ortada hap; 4 saniye; geri alınabilen işte "Geri al". |
| Pencere | Arkası %45 kararır; köşe 28; birincil düğme sağda, "Vazgeç" her zaman var; panoda en çok 440 px. |
| Alttan açılan sayfa / yan panel | Telefonda form ve düzenleme alttan açılır (tutamaç, başlık, "Kapat"); panoda aynı içerik sağdan 440 px yan panel. |

## 4. Ekranlar

On grup, tuvaldeki sayfa sırasıyla. Her bölümün sonunda o grupta çizilmeyenler yazar.

### 4.1 Bugün'ün durumları ("1 · Bugün" sayfası; onaylandı, 15 Kas 2026)

Metinler koddaki metinlerdir (`src/core/ui/today/`); örnek işler uydurmadır. Yeni metinler: "Hepsini göster", "Küçült", "GÜNÜN AKIŞI".

**Yerleşim, telefon (390×844).** Üstte tek satır: "Bugün" ve tarih. Hemen altında ana panelde "Şimdi" kartı, yoğun panelde açılır "Sıradakiler" (bölüm 4.2), altında günün akışı. Aşağı kaydırınca: uyarılar, sabit bloklar, modül hapları, alt satır ("X dk'm var", "Yeniden planla"), "Bugün bitenler".

**Yerleşim, pano (1440×900).** Her şey tek ekranda, kaydırma yok. Üstte tek satır: "Bugün", tarih ve saat. Altında iki sütun (5:3): solda "Şimdi" kartı (en az 300 px; başlık 46 px), sağda "Sıradakiler". Altında tam genişlikte zaman çizelgesi, yan yana iki uyarı, en altta modül hapları (sol) ve eylemler (sağ: "X dk'm var", "Yeniden planla", "+ Yeni giriş"). Sakin durumlarda (akşam, geri dönüş, boş gün) yalnızca kart durur; gecede yalnızca saat.

**Kartın kuralları.** Kartta en çok bir birincil düğme (Başla, Bitti, Uyandım, Kaydet); öbürleri ikincil cam, "Başka bir şey yapıyorum" / "Durdur" / "Sonra" sessiz yazı. Telefonda dört düğme iki satıra bölünür, panoda tek satırdır. Süre çubuğu işin rengiyle. Dizi satırı hap olarak başlığın üstünde. Akşam kartında birincil düğme yalnızca sıradaki iş geldiğinde vardır ("Başla"); "Yatıyorum" ikincildir; "Günü kapat" yoktur (bölüm 4.6).

| Durum | Telefon | Pano |
| --- | --- | --- |
| Öneri | `BT01` | `BP01` |
| Öneri, "Neden?" açık | `BT02` | `BP02` |
| Öneri, yol süreli iş | `BT03` | `BP03` |
| Öneri, dizideki iş | `BT04` | `BP04` |
| Çalışan iş | `BT05` | `BP05` |
| "Devam ediyor musun?" | `BT06` | `BP06` |
| Sahneden çıkıldı ("Sahneye dön") | `BT07` | `BP07` |
| Sahne açılamadı | `BT08` | `BP08` |
| Takıldım | `BT09` | `BP09` |
| Takıldım → Adımı küçült | `BT10` | `BP10` |
| Takıldım → Birini bekliyorum | `BT11` | `BP28` |
| Başka bir şey yapıyorum | `BT12` | `BP11` |
| Sabit blok | `BT13` | `BP12` |
| Soru | `BT14` | `BP13` |
| Takip günü gelen bekleyen iş | `BT15` | `BP14` |
| Kalemin süresi doldu ("Bitti mi?") | `BT16` | `BP15` |
| Bugün tamam | `BT17` | `BP16` |
| Geri dönüş | `BT18` | `BP17` |
| Boş gün | `BT19` | `BP18` |
| Günaydın | `BT20` | `BP19` |
| Günaydın, "Biraz önce" açık | `BT21` | `BP20` |
| Akşam, sıradaki iş geldi | `BT22` | `BP21` |
| Akşam, iş henüz sırada | `BT23` | `BP22` |
| Akşam, "Bu gece geç yatacağım" | `BT24` | `BP23` |
| Akşam, uyku hedefin altında | `BT25` | `BP29` |
| Gece | `BT26` | `BP24` |
| Erken "Yatıyorum" onayı | `BT27` | `BP25` |
| "X dk'm var" | `BT28` | `BP26` |
| "X dk'm var", uyan iş yok | `BT29` | `BP30` |
| Ekranın alt yarısı | `BT31`, `BT32` (aşağı kaydırınca) | `BP01` (hepsi tek ekranda); `BP27` (sağ sütunda "Bugün bitenler") |

**Bu grupta çizilmeyenler.** Hızlı giriş ve düzenleme pencereleri (5. grup). Bildirimler ("Gün yeniden planlandı.") ve "Veri okunamadı…" satırı, yapay zeka bütçesi satırı (10. grup). Sahne ve şeridi (Rutin tuvalinde çizili; standart hali 7. grup).

### 4.2 Zaman çizelgesi ve Sıradakiler ("2 · Zaman çizelgesi" sayfası; onaylandı, 15 Kas 2026)

Kullanıcının seçimi (15 Kas 2026): bütün günü gösteren saatli yatay şerit ve aşağı doğru açılıp kapanan "Sıradakiler". Öbür iki seçenek (yakın plan şerit, saatli liste) tuvalden kaldırıldı.

**Günün akışı (şerit).** Yoğun panelde; başlıkta solda "GÜNÜN AKIŞI", sağda "07:02 uyanış · 23:00 yatış" (uyanış ve yatış ekranda yalnızca burada yazar). Şerit uyanıştan beklenen yatışa uzanır.

- Saat etiketleri şeridin üstünde: telefonda üç saatte bir, panoda her saat; her etiketin altında ince dikey çizgi.
- İşler işin rengiyle, koyu yazıyla; sabit bloklar gri ve şeridin tam boyunda; yol taralı; mola boşluk. Uyanışa ve yatışa bağlı bölümlerin zemini bir ton açık.
- Geçmiş parçalar soluk (%45). Şimdiki an beyaz çizgi ve altında "şimdi 14:10" hapı.
- Panoda iş adları parçanın içinde yazar (44 px'den dar parçada yazmaz). Telefonda ad sığmaz: parçaya dokununca üstünde "15:55–16:55 · İstatistik ödevi" balonu çıkar, parça beyaz çerçeve alır; yolda "yol 35 dk". Panoda aynı balon imleç üstüne gelince.
- Bitiş çizgisi ve "akşam" bölümü yoktur (karar: saatle belirlenen bitiş kalktı).

**Sıradakiler (açılır liste).** Kapalıyken sıradaki işler: telefonda 2, panoda 3 satır; altında tam genişlikte "Hepsini göster" satırı. Dokununca liste aşağı doğru açılır ve günün kalanındaki her şeyi sırayla gösterir: işler, mola ("mola · 15 dk", ince satır), sabit blok (kare işaret, "18:30–19:15 · sabit", düğmesiz). Altındaki satır "Küçült" olur. Telefonda açılan liste şeridi aşağı iter ve sayfa kayar; panoda da şeridi ve uyarıları aşağı iter (liste ekrana sığmayacak kadar uzarsa kendi içinde kayar; bu hal çizilmedi). Liste boşken "Sırada başka iş yok." ve düğme yok.

| Kare | İçerik |
| --- | --- |
| `ZT1` | Telefon, olağan: iki iş, "Hepsini göster", günün akışı |
| `ZT2` | Telefon, liste açık |
| `ZT3` | Telefon, liste açıkken aşağı kaydırınca: listenin sonu, "Küçült", günün akışı, uyarılar |
| `ZT4` | Telefon, şeritte işe dokununca balon |
| `ZT5` | Telefon, şeritte yola dokununca balon |
| `ZP1` | Pano, olağan: üç iş, "Hepsini göster", günün akışı (adlar içinde) |
| `ZP2` | Pano, liste açık |
| `ZP3` | Pano, imleç yolun üstünde |

1. grubun kareleri bu liste ve şeritle yeniden çizildi (yer tutucu kalmadı). Örnek gün her karede aynıdır; kartın saati değişse de şeritteki işler değişmez (örnek veri).

### 4.3 Takvim (eski adı Hafta; "3 · Takvim" sayfası; onaylandı, 15 Kas 2026)

Kullanıcı sayfanın baştan tasarlanmasını istedi (15 Kas 2026): menüdeki adı "Takvim", günler dokunulabilir, haftanın işleri teslim tarihine göre. Bu bölüm yalnızca görünüş değildir; içeriği ve davranışı da değiştirir (`docs/09-kararlar.md`). İlk Hafta çizimleri (`HT*`, `HP*`) tuvalden kaldırıldı. Sakin zemin, yoğun cam; örnek veriler uydurmadır.

**Üst satır.** "Takvim" ve hafta seçici: önceki hafta, "9–15 Kasım", sonraki hafta (44 px sessiz düğmeler).

**Gün kutuları.** Yedi gün yan yana, telefonda da ekrana sığar (kaydırma yok). Telefonda gün adı, tarih ve o gün teslim ya da sınav varsa işin rengiyle küçük nokta; panoda ayrıca kalan vakit ("4 sa 10 dk vakit") ve teslimin adı. Bugün beyaz kenarlı, geçen günler soluk. Sayfa hiçbir gün seçili olmadan açılır. Güne dokununca kutu opak açık olur (seçili) ve altta o günün ayrıntısı açılır; aynı kutuya ya da ayrıntıdaki kapat düğmesine dokununca haftaya dönülür.

**Bu hafta (gün seçili değilken).** Tek yoğun panel.

- Başlık: "BU HAFTA", sağda "11 sa 10 dk iş · 17 sa 40 dk vakit"; altında modül renkleriyle ince yük çubuğu (8 px) ve vaktin beyaz çizgisi. İş vakti aşınca dikkat rengi ve simgeyle "İstenen süre bu haftanın vaktini aşıyor.", altında "Yetişmeyebilir: …".
- İşler **teslim tarihine göre** sıralı. Satır: renk noktası, ad, sağda küçük modül adı; altında teslim ("Teslim Pazar, 15 Kas"); altında işin rengiyle ilerleme çubuğu (6 px); çubuğun altında solda yapay zekanın tek satır notu (simgeyle; yapay zeka kapalıysa boş), sağda işlenen ve pay ("1 sa 30 dk / 3 sa").
- Boşken: "Bu hafta için taahhüt edilen iş yok."
- "Modül payları" satırı ve ayrı kapasite paneli yoktur (aynı bilgi yük çubuğunda ve satırlardaki modül adında).

**Gün ayrıntısı (gün seçiliyken).** Başlıkta günün adı ve tek satır özet, sağda kapat düğmesi. Bölümler güne göre:

| Gün | Özet | Bölümler |
| --- | --- | --- |
| Geçmiş | "4 iş · 3 sa 40 dk" | Teslim ve sınav; Yapılanlar; Sabit. Yapılmayan iş gösterilmez (ürün kuralı 2). |
| Bugün | "3 iş bitti · 4 sa 10 dk vakit" | Sıradakiler; Sabit; Yapılanlar; "Bugün'e git". |
| Gelecek | "6 sa vakit" | Teslim ve sınav; Planlananlar; Sabit; altında "Plan tahminidir; o sabah yeniden kurulur." |

Satır: işaret (iş için renk noktası, sabit için gri kare), ad, altında süre ya da saat, sağda küçük modül adı.

**Önümüzdeki haftalar.** Sekiz küçük dikey çubuk; her çubuk o haftanın işi, beyaz çizgi vakti. Altında haftanın başladığı gün, ay değişince ayın kısaltması. Vakti aşan hafta dikkat renginde ve simgeyle; altında tek satır açıklaması ("30 Kasım haftası: 34 sa iş, 30 sa vakit · 3 teslim"). Çubuğa dokununca o haftaya gidilir.

**Yapay zekanın notları** ikincil panelde, kısa. **"Haftayı yeniden kur"** sayfanın sonunda sessiz bağlantıdır; ardından "Hafta yeniden kuruldu." bildirimi. Uyku ortalaması satırı bu sayfada yoktur (Rutin → Düzenlilik'te durur).

**Pano.** Üst satır ve gün kutuları tam genişlikte; altında iki sütun (5:4). Solda her zaman "Bu hafta". Sağda gün seçili değilken önümüzdeki haftalar, notlar ve "Haftayı yeniden kur"; gün seçiliyken o günün ayrıntısı.

| Kare | İçerik |
| --- | --- |
| `TT1` | Telefon, açılış: gün seçili değil, bu haftanın işleri |
| `TT2` | Telefon, aşağı kaydırınca: önümüzdeki haftalar, notlar, "Haftayı yeniden kur" |
| `TT3` | Telefon, geçmiş gün seçili |
| `TT4` | Telefon, bugün seçili |
| `TT5` | Telefon, gelecek gün seçili |
| `TT6` | Telefon, iş vakti aşıyor; uygun saat uyarısı |
| `TT7` | Telefon, bu hafta iş yok; bildirim |
| `TP1` | Pano, açılış |
| `TP2` | Pano, gelecek gün seçili |
| `TP3` | Pano, bugün seçili |
| `TP4` | Pano, geçmiş gün seçili |
| `TP5` | Pano, iş vakti aşıyor; uygun saat uyarısı |

Çizilmeyen: başka bir haftaya gidildiğindeki görünüş (geçmiş ve gelecek hafta); kurallar bu haftayla aynıdır, geçmiş haftada işlerin yerinde yapılanlar durur.

**Menü.** Alt menüde ve yan menüde "Hafta" yerine "Takvim"; Bugün'deki uyarının eylemi "Takvime bak". Bütün kareler bu adla yeniden üretildi.

### 4.4 Gelen kutusu ("4 · Gelen kutusu" sayfası; onaylandı, 15 Kas 2026)

Sakin zemin. İçerik ve metinler koddaki gibidir (`src/core/ui/inbox/InboxScreen.tsx`); yalnızca görünüş değişti. Örnek girişler uydurmadır.

- **Giriş kartı:** yoğun panel; üstte girişin metni (telefonda 16, panoda 18 px). Altında eylemler: "İşe çevir" ve "Bloğa çevir" ikincil düğme, "Sil" sessiz yazı.
- **Yapay zekanın önerisi:** kartın içinde kesik kenarlı kutu (kesik kenar: yapay zekanın koyduğu değer). Simgeyle "Öneri: iş kalemi · 2 sa · Pazar · yüksek önem", altında gerekçe; modül hapları (önerilen seçili, opak açık); "Onayla" birincil düğme. Listede birincil düğme kart başına en çok birdir.
- **"İşe çevir":** eylemlerin yerinde form açılır: modül hapları, "Tarih", "Süre (dk)", "Kaydet" (birincil) ve "Vazgeç". Süre 90 dakikayı aşınca düğme "İş kalemi olarak kaydet" olur ve altında açıklaması çıkar.
- **"Bloğa çevir":** "Gün", "Başlangıç", "Bitiş", "Kaydet", "Vazgeç".
- **Sonuç:** kart listeden hemen gider; bildirim "İş eklendi." ya da "İş kalemi eklendi."
- **Boş:** "Gelen kutusu boş."
- **Pano:** kartlar tek sütunda, en çok 760 px genişlikte; başlığın sağında "+ Yeni giriş".

| Kare | İçerik |
| --- | --- |
| `GT1` | Telefon, liste: önerili giriş ve iki düz giriş |
| `GT2` | Telefon, "İşe çevir" açık |
| `GT3` | Telefon, süre 90 dakikadan uzun |
| `GT4` | Telefon, "Bloğa çevir" açık |
| `GT5` | Telefon, "Onayla"dan sonra bildirim |
| `GT6` | Telefon, boş |
| `GP1` | Pano, liste |
| `GP2` | Pano, "İşe çevir" açık, süre 90 dakikadan uzun |
| `GP3` | Pano, "Bloğa çevir" açık ve bildirim |
| `GP4` | Pano, boş |

Bu grupta çizilmeyenler: hiç modül yokken çıkan "İşin bir modülü olmalı. Modüller Ayarlar'dan açılır." satırı ve liste okunamadığındaki hata (10. grup).

### 4.5 Hızlı giriş ve düzenleme ("5 · Giriş ve düzenleme" sayfası; onaylandı, 15 Kas 2026)

Alanlar ve metinler koddaki gibidir (`src/core/ui/QuickAdd.tsx`, `EditDialog.tsx`, `work/EditWork.tsx`, `work/TimingSection.tsx`). Değişen kabuktur: kodda ortadaki pencere olan form, telefonda **alttan açılan sayfa**, panoda **sağdan 440 px yan panel** olur (ortak parçalar). Arkası %45 kararır.

**Kabuk.** Telefonda tutamaç, başlık ve sağda kapat düğmesi; içerik kayar; alt satır sabittir (çizgiyle ayrılır). Alt satırda solda varsa ek eylem ("Bırak", "Durdur"; ikincil), sağda "Vazgeç" (ikincil) ve "Kaydet" (birincil). Geçersiz formda "Kaydet" soluktur. Telefonda alt satıra sığmayan ek eylem ("Adımlara böl") formun sonuna iner.

**Hızlı giriş ("Yeni giriş").** Tek satırlık giriş kutusu odakta açılır (yer tutucu "Sunum slaytları cuma 45dk"); altında modül hapları. Modül seçilince tür hapları ("İş" ve modülün kendi türleri), "Tarih" ve "Süre (dk)" çıkar; düğme modül yokken "Gelen kutusuna ekle", varken "Ekle". Süre 90 dakikayı aşınca kutu: açıklama, "İş kalemi olarak kaydet" (birincil) ve "Süreyi 90 dk yap". Panoda alanların altında kısayol satırı.

**Düzenleme.** "İşi düzenle": Ad, Bölüm (modülün bölümü varsa), Son tarih ve Süre yan yana, Önem ve Durum yan yana, "Neyi bekliyor (isteğe bağlı)", Zaman. "İş kalemini düzenle": Ad, Bölüm, Son tarih, Toplam efor ve Oturum, Önem, Zaman, "Adımlara böl". "Ritmi düzenle": Ad; Hedef, Dönem ve Süre tek satırda; Zaman (dinlenme ile); "Durdur".

**Zaman bölümü.** Kapalıyken tek satır: ok, "Zaman" ve varsa özeti. Açıkken: kaynağı söyleyen tek cümle; "Yalnızca şu saatlerde", "Tercih edilen saatler", "Kaçınılan saatler" (her aralık: gün seçimi, başlangıç, bitiş, kaldır; altında "+ aralık ekle"); "Yol" (gidiş, dönüş); ritimde "Dinlenme". Geçersiz aralıkta iki saat kutusu mercan kenar alır, altında simgeyle tek cümle. "Bitiş çizgisinden sonra" uyarısı çizilmedi (karar: saatle belirlenen bitiş kalktı).

**Yapay zekanın koyduğu değer.** Alanın kenarı kesiklidir; altında simgeyle gerekçesi yazar. Kullanıcı alanı değiştirince kenar düz olur ve gerekçe kalkar.

| Kare | İçerik |
| --- | --- |
| `QT1` | Telefon, hızlı giriş açılınca |
| `QT2` | Telefon, yazarken: modül, tür, tarih, süre |
| `QT3` | Telefon, süre 90 dakikadan uzun |
| `ET1` | Telefon, "İşi düzenle", Zaman kapalı |
| `ET2` | Telefon, Zaman açık |
| `ET3` | Telefon, geçersiz aralık |
| `ET4` | Telefon, yapay zekanın koyduğu değerler |
| `ET5` | Telefon, "İş kalemini düzenle" |
| `ET6` | Telefon, "Ritmi düzenle" |
| `QP1` | Pano, hızlı giriş |
| `QP2` | Pano, hızlı giriş, süre 90 dakikadan uzun |
| `EP1` | Pano, "İşi düzenle", Zaman açık |
| `EP2` | Pano, yapay zekanın koyduğu değerler |

Bu grupta çizilmeyenler: modülün kendi giriş türlerinin alanları ("Sınav/teslim", "Not"; modül tasarımında çizilir); "Yeni ritim" (alanları "Ritmi düzenle" ile aynı, düğmesi "Ekle"); etkin modül yokken hızlı giriş (10. grup); panoda iş kalemi ve ritim formları (kabuk ve alanlar `EP1` ile aynı kuralda).

### 4.6 Akşam kapanışı ("6 · Akşam kapanışı" sayfası; görünüş onaylandı, 15 Kas 2026)

**Karar (kullanıcı, 15 Kas 2026): kapanış Rutin'in akşam sahnesinin içindedir.** Ayrı sayfa olarak çizilmez; ayrı sayfa kareleri tuvalden kaldırıldı. Bugün'deki iki "Günü kapat" düğmesi (alt satır ve akşam kartı) da kalktı: akşam kartındaki "Başla" akşam sahnesini açar, kapanış onun bir adımıdır (Yüz ile Telefonu bırak arasında; `docs/moduller/rutin.md`, "Yarının listesi").

Adımlar ve metinler koddaki gibidir (`src/core/ui/closing/ClosingScreen.tsx`, sahne içi hali). İçerik farkları "günün 3 işi" kararından gelir: yarının taslağında işaret kutusu ve "Günün üç işi işaretli…" cümlesi yoktur, alt başlık "İstemediğini çıkar."dır; "vakit kalırsa" etiketi yoktur; onay adımı yarının ilk işlerini sırayla gösterir.

- **Zemin ve şerit:** akşam sahnesinin gece gökyüzü ve şeridi ("22:24 · Akşam kapanışı · 4 dk", sağda "Çık"); Rutin tuvalindeki sahneyle aynı.
- **Başlık ve adımlar:** "Kapanış"; altında beş ince çizgi ve adlarıyla adımlar ("1. Sorular" … "5. Onay"). Gelinen adımlar açık, şimdiki adımın adı kalın.
- **Adım paneli:** yoğun cam, en az 240 px (panoda 320).
  1. Sorular: "Modül · soru" ve cevap düğmeleri (ikincil). Boşken "Cevap bekleyen soru yok."
  2. Bugün: "Bugün başka ne yaptın?"; satırlar "Modül · iş" ve "Yaptım". Boşken "Bugün için açık kalan bir şey yok."
  3. Yarın: "Yarının taslağı"; satırda renk noktası, ad, "Modül · süre", varsa yapay zekanın gerekçesi, sağda "Çıkar" (sessiz). Boşken "Yarın için planlanan bir şey yok."
  4. Boşalt: "Aklında kalanlar"; çok satırlı kutu.
  5. Onay: "Yarın" ve liste. Boşken "Yarın için seçilen iş yok; yarın sabah plan kendiliğinden kurulur."
- **Düğmeler** panelin altında: "Geri" (ikincil), "İleri" (birincil), son adımda "Onayla" (birincil); her adımda "Vazgeç" (sessiz; kapanışı atlar, sahne sürer). "Onayla ve yat" yoktur: sahnenin sonunda "Yatıyorum" vardır. Panoda altında "Enter ile ilerle, Escape ile geri dön."
- "Onayla"dan sonra sahne sıradaki adıma ("Telefonu bırak") geçer; sahne bitince Bugün'ün gece durumu gelir (`BT26`, `BP24`).

| Kare | İçerik |
| --- | --- |
| `KS1`–`KS5` | Telefon, beş adım |
| `KS6`–`KS9` | Telefon, boş haller: soru yok, açık kalan yok, yarın için plan yok, onayda yarın boş |
| `KSP1`–`KSP5` | Pano, beş adım (sahne sayfanın içinde, yan menüyle) |

Çizilmeyen: panoda boş haller (panelin içi telefondakiyle aynı metinler).

**Açık (çekirdek ve Rutin):** Rutin kapalıyken ya da akşam sahnesi hiç açılmadan kapanışa nasıl ulaşılacağı; kapanış adımı Rutin'de 2. kurulum adımına yazılı (`kind: closing`), bu kararla öne gelmesi gerekebilir.

### 4.7 Modüller, modül sayfası, alan sayfası, sahne kabuğu ("7 · Modüller, modül ve alan sayfası, sahne" sayfası; onaylandı, 15 Kas 2026)

Sakin zemin. Çekirdeğin sağladığı kabuklar çizildi; içini modül doldurur. Örnek olarak Okul kullanıldı (`deneme` çizilmedi); örnek veriler uydurmadır. Rutin'in kendi sayfası Rutin tuvalindedir ve bu iskelete uyar.

**Modüller.** Alanı olan modüller alan panelinde toplanır: başlıkta alanın adı, üyeleri ve "Alan sayfası" (ikincil); altında modül satırları. Alansız modüller tek panelde. Satır: renk noktası, ad, modülün durum metni, sağda ok; duraklatılan modül soluk ve "duraklatıldı" etiketiyle. Altta "Modülleri aç, duraklat ya da arşivle". Panoda paneller iki sütun.

**Modül sayfası: beş bölge.**

1. **Başlık ve durum.** Telefonda geri oku, renk noktası, ad, sağda modülün ana ekleme düğmesi; altında alan adı (bağlantı; varsa), durum metni ve sağlık ("dikkat", "geride": renk, simge ve yazıyla; "yolunda" yazılmaz). Altında "Bu hafta" sayıları tek panelde.
2. **Yaklaşanlar.** Yoğun panel; satırda renk noktası, ad, alt satır (bölüm, süre ya da işlenen / efor, tarih), sağda 44 px üç simge düğmesi: Başla, Yapıldı, Düzenle. Bekleyen iş soluk, yalnızca Düzenle. Boşken "Bu modülde sırada iş yok."
3. **Bölümler ve gövde.** Bölüm sekmeleri cam hapta (seçili opak açık); sığmazsa yana kayar. Aynı satırın sağında geçmiş düğmesi (grafik simgesi ve ad; `ORTAK.md` bölüm 4). Gövde modülündür (kesik çizgili yer tutucu). Görünümü yoksa "Bu modülün kendi görünümü yok."
4. **Geçmiş.** Modül kendi görünümünü vermezse son 8 haftada harcanan süre: sekiz sütun, üstünde saat, altında haftanın başladığı gün ve ay; bu hafta tam renkte. Boşken "Son 8 haftada kayıtlı oturum yok." Bölümü olan modülde geçmiş düğmesiyle açılır (sekmelerin hiçbiri seçili görünmez); bölümü olmayan modülde sayfada açık durur, düğme yoktur.
5. **Giriş ve ayarlar.** "İş ekle", modülün giriş türleri, "Ritim ekle" (ikincil düğmeler) ve "Modül ayarları" bağlantısı.

Telefonda sıra: 1, 2, 3, 5 (4, düğmeyle). Panoda başlık, sayılar ve sekme satırı tam genişlikte; altında iki sütun (5:4): solda gövde ve giriş, sağda yaklaşanlar ve geçmiş.

**Alan sayfası (Sağlık).** Başlıkta alanın adı ve üyeleri. Her üye modül bir panel: renk noktası, ad, durum metni, haftanın sayıları; dokununca modüle gider. Altında üyelerden seçilmiş görünümler, her birinin sağ üstünde kaynağı ("Rutin"). **İçerik örnektir:** sayfanın metrikleri en az iki modül iki hafta kullanıldıktan sonra tasarlanır (13 Kas 2026 kararı); burada çizilen yalnızca kabuktur. Tek "puan" yoktur.

**Sahne kabuğu.** Çekirdeğin verdiği yalnızca şerit ve zemindir; içi modülündür. Şerit: saat, işin rengi, adı, geçen süre, "Çık". Telefonda sahne ekranı kaplar (alt menü yok), şerit en üstte tam genişlikte; panoda sahne sayfanın içinde, şerit hap biçiminde. Zemin modülün tonuna göre: sakin (günün gökyüzü), odak (koyu ve düz, `#0a0d1e`), enerji (modülün rengine çalan koyu geçiş). Modül kendi zeminini verirse o kullanılır (karar 4).

| Kare | İçerik |
| --- | --- |
| `MT1`, `MP1` | Modüller |
| `MT2`, `MT3` | Telefon, modül sayfası: baş ve aşağı kaydırınca |
| `MT4` | Telefon, "Geçmiş" açık |
| `MT5` | Telefon, bölümü ve görünümü olmayan, duraklatılmış modül; sırada iş yok |
| `MT6` | Telefon, sağlık "dikkat" |
| `MP2`, `MP3` | Pano, modül sayfası ve "Geçmiş" açık |
| `MT7`, `MT8`, `MP4` | Alan sayfası (Sağlık) |
| `MS1`–`MS3` | Telefon, sahne kabuğu: sakin, odak, enerji |
| `MSP1`–`MSP3` | Pano, sahne kabuğu: sakin, odak, enerji |

Bu grupta çizilmeyenler: modülün hızlı eylemleri ve tam ekran görünüm bağlantıları (modül verirse başlığın sağında ikincil düğme olur); haftalık raporun önerileri (`ORTAK.md` bölüm 5: modülün somut önerisi yoksa yer tutulmaz); "Bu modül arşivde." gibi bulunamayan modül halleri (10. grup); "Adımlara böl" önerileri.

### 4.8 Ayarlar ("8 · Ayarlar" sayfası; görünüş onaylandı, 15 Kas 2026)

Kullanıcının notu: ayar sayısı fazla geliyor; içerik sonra sadeleştirilecek (Fikirler). Şimdilik tasarım böyle kalır.

Sakin zemin, yoğun cam. Alanlar ve metinler koddaki gibidir (`src/app/(app)/ayarlar/`, `src/core/ui/settings/`); farklar aşağıda.

**Yerleşim (değişti).** Kodda tek uzun sayfa olan Ayarlar, telefonda bölüm listesine ve her bölümün kendi sayfasına ayrılır (başlıkta geri oku); panoda solda bölüm listesi (seçili bölüm opak açık), sağda seçili bölüm durur. "Dışa aktarım" ve "Hesap" kısa oldukları için listenin altında açık kalır. Bölümler: Görünüm, Günün çerçevesi, Uyanış ve yatış kayıtları, Sesli anlatım (bu cihaz), Modüller, Sabit bloklar, Yapay zeka, Bağlantılar. `/ayarlar#kayitlar` gibi bağlantılar ilgili bölümü açar.

**Kararlardan gelen içerik farkları.**

- **Görünüm:** tema seçimi yok (karar 1). İki anahtar: "Saydamlığı azalt" ("Paneller düz ve opak olur.") ve "Hareketi azalt" ("Geçişler anlık olur; gökyüzü kıpırdamaz."); altında "Cihazın kendi erişilebilirlik tercihi açıksa bunlar kendiliğinden açılır." Metinler yenidir.
- **Modül ayarları:** "Hayat modlarında" bölümü yok (karar: hayat modu kalktı).
- **Renkler:** "Bu renk açık ya da koyu temada zor seçilir." uyarısı tek temayla "koyu zeminde zor seçilir" anlamına iner; çizilmedi, metni kurulumda yazılır.
- Günün çerçevesindeki gün tipleri (Ev, Ofis, Kampüs günü) ve Bağlantılar'daki "Bağlam" ucu durur: bunlar elle bağlam seçimi değildir.

**Ortak kalıplar.** Anahtarlı satır (yazı solda, anahtar sağda, en az 56 px). Saat aralığı iki küçük kutu ve aradaki çizgi; geçersizse kutular mercan kenarlı, altında tek cümle ve "Kaydet" soluk. Satır eylemleri sessiz yazı ("Düzenle", "Bitir", "İptal et", "Değiştir"); bölümün ana eylemi ikincil düğme, kaydetme birincil. Açıklamalar panelin başında, 15 px.

| Bölüm | Çizimdeki hali |
| --- | --- |
| Günün çerçevesi | Açıklama; "Günün çerçevesi açık"; Uyanış, Yatış, Uyku hedefi; açılır "Gün tipine göre (isteğe bağlı)"; iki kendiliğinden başlatma anahtarı; "Kaydet". |
| Uyanış ve yatış kayıtları | Bugün ve dün; her kayıt: ad, saat kutusu, "Kaydet", silme (telefonda "Sil", panoda "Uyanışı sil" / "Yatışı sil"); kayıt yoksa "kayıt yok". |
| Sesli anlatım | Açıklama; "Sesli anlatım açık"; Ses; Hız (kaydırıcı); "Bu cihaz dokunuş olmadan da konuşsun (ikinci ekran için)"; "Dene". Türkçe ses yoksa dikkat renginde durum satırı. |
| Modüller | Her modül: renk noktası, ad, durum; eylemler (etkin: "Ayarlar", "Duraklat", "Arşivle"; duraklatılmış: "Sürdür", "Arşivle"; kapalı: "Etkinleştir"). Arşivleme onayı satırın altında açılır: açıklama, "Arşivle" (tehlikeli), "Vazgeç". |
| Modül ayarları | "Renkler": modül ve bölümleri; "Değiştir" ile on hazır renk (44 px daire, seçili beyaz halkalı), "Özel" renk, kod, "Kaydet", "Varsayılana dön". "Modülün ayarları" modülündür (yer tutucu). |
| Sabit bloklar | "Haftalık seriler" (ad; gün, saat, tür, yer; "Düzenle", "Bitir"), "Yeni seri", "Tek seferlik blok", "Önümüzdeki 4 hafta" (iptal edilen üstü çizili ve soluk, "Geri al"). Panoda iki sütun. |
| Yapay zeka | Durum cümlesi; "Yapay zeka açık"; "Aylık sınır ($; 0 kapatır)" ve "Kaydet"; "Bu ay: … / …" ve ince çubuk (yeni, aynı verinin çizimi); çağrı tablosu. Bütçe dolunca durum ve çubuk dikkat renginde. |
| Bağlantılar | Açıklama; anahtar listesi (ad, ipucu, uçlar, son kullanım; "İptal et"; iptal edilen soluk); yeni anahtar formu (Ad, "Yazabileceği uçlar" onay kutuları, "Anahtar üret"). Üretilince kutu: "Anahtar hazır. Bir daha gösterilmez; şimdi kopyala.", anahtar, "Kopyala" (birincil). |

| Kare | İçerik |
| --- | --- |
| `AT01` | Telefon, Ayarlar: bölümler, dışa aktarım, hesap |
| `AT02` | Görünüm |
| `AT03`–`AT05` | Günün çerçevesi: olağan, gün tipine göre açık, geçersiz aralık |
| `AT06` | Uyanış ve yatış kayıtları |
| `AT07`, `AT08` | Sesli anlatım; cihazda Türkçe ses yok |
| `AT09`, `AT10` | Modüller; arşivleme onayı |
| `AT11` | Okul ayarları: renkler |
| `AT12`, `AT13` | Sabit bloklar (iki kare) |
| `AT14`, `AT15` | Yapay zeka; bütçe doldu |
| `AT16`, `AT17` | Bağlantılar; anahtar üretildi |
| `AP1`–`AP9` | Pano: Görünüm, Günün çerçevesi, Kayıtlar, Sesli anlatım, Modüller (arşiv onayı), Okul ayarları, Sabit bloklar, Yapay zeka, Bağlantılar |

Çizilmeyenler: seri ve blok düzenleme pencereleri (5. gruptaki kabuk; alanları "Yeni seri" ve "Tek seferlik blok" ile aynı); yapay zekanın öbür durum cümleleri (anahtar yok, model yok, kapalı; aynı satırda); anahtar iptal onayı ("İptal et", "Vazgeç"; arşiv onayıyla aynı kalıp); panoda gün tipine göre açık hal. Hesap satırındaki e-posta örnektir.

### 4.9 Giriş ekranları ("9 · Giriş ekranları" sayfası; onaylandı, 15 Kas 2026)

Tam manzara (karar 2); zemin günün saatine göre. Menü yok. Ortada tek ana panel (telefonda 342, panoda 420 px): "Sherpa", "E-postana tek kullanımlık bir kod gönderilir." Akış ve metinler koddaki gibidir (`src/app/giris/`).

- **E-posta adımı:** "E-posta" alanı (odakta), "Kod gönder" (birincil, tam genişlik).
- **Kod adımı:** "Giriş kodu" alanı (60 px, ortalı, tek aralıklı, aralıklı rakamlar), altında "… adresine gelen kodu yaz."; "Giriş yap" (birincil); altında iki sessiz eylem: "Kodu yeniden gönder", "Başka e-posta".
- **Hata** alanın altında mercan renkte, simgeyle tek cümle; alan mercan kenar alır. **Bilgi** ("Yeni kod gönderildi.") açık renkte, onay simgesiyle.

| Kare | İçerik |
| --- | --- |
| `LT1` | Telefon, e-posta |
| `LT2` | "Bu e-posta ile giriş yapılamıyor." |
| `LT3` | "Kod gönderilemedi. Yeniden dene." |
| `LT4` | Kod |
| `LT5` | "Kod geçersiz ya da süresi dolmuş." |
| `LT6` | "Yeni kod gönderildi." |
| `LT7` | "Çok sık denendi. Biraz sonra yeniden dene." |
| `LT8` | Gece zemininde e-posta adımı |
| `LP1`–`LP3` | Pano: e-posta, kod, kod geçersiz |

Oturum düşünce bu ekrana sessizce dönülür; ayrı kare yoktur.

### 4.10 Boş ve hata durumları ("10 · Boş ve hata durumları" sayfası; onaylandı, 15 Kas 2026)

Metinler koddaki gibidir; tek yeni metin bağlantı işaretidir.

- **Veri okunamadı:** ekranın ana paneli yerinde "Veri okunamadı. Bağlantı gelince kendiliğinden yenilenir." ve "Yeniden dene" (ikincil). Boş gün gösterilmez. Bugün, Gelen kutusu ve kapanışta aynı panel.
- **Bağlantı koptu:** üst satırın sağında küçük hap (simge ve "bağlantı yok"); son bilinen plan ekranda kalır. `docs/05`'te tanımlı, kodda yok; hapın metni yenidir.
- **Bildirimler** (altta ortada hap, 4 saniye): "Kaydedilemedi. Değişiklik geri alındı."; geri alınabilen işte "Geri al"; "Gün yeniden planlandı."
- **Yapay zeka bütçesi doldu:** Bugün'ün sonunda bilgi simgesiyle tek satır; uyarı rengi kullanılmaz.
- **Boş gün:** "Bugün için planlanan bir şey yok." ve "Başka bir şey yapıyorum"; liste, şerit ve uyarı yok.
- **Modüller boş:** "Henüz modül yok." ve yönetim bağlantısı.
- **Bulunamayan modül:** yoğun panelde tek cümle ("Bu modül arşivde.", "Bu modül etkin değil.", "Böyle bir modül yok.", "Bu modülde böyle bir sayfa yok.") ve bir bağlantı.
- **Hızlı giriş, etkin modül yokken:** kutunun altında "Etkin modül yok; giriş gelen kutusuna düşer. Modüller Ayarlar'dan açılır."; düğme "Gelen kutusuna ekle".

| Kare | İçerik |
| --- | --- |
| `XT1`, `XP1` | Bugün: veri okunamadı |
| `XT2` | Bağlantı koptu, son plan ekranda |
| `XT3` | Kayıt başarısız bildirimi |
| `XT4` | "Geri al"lı bildirim |
| `XT5` | "Gün yeniden planlandı." |
| `XT6` | Yapay zeka bütçesi doldu |
| `XT7` | Boş gün |
| `XT8` | Gelen kutusu okunamadı |
| `XT9` | Modüller boş |
| `XT10`–`XT13` | Bulunamayan modül ve sayfa halleri |
| `XT14` | Hızlı giriş, etkin modül yok |
| `XP2` | Pano: bağlantı koptu ve kayıt başarısız bildirimi |
| `XP3` | Pano: boş gün ve bütçe satırı |
| `XP4` | Pano: modül arşivde |

Öbür ekranların kendi boş halleri kendi gruplarında çizildi: Sıradakiler boş (`BT17`), Takvim'de iş yok (`TT7`), Gelen kutusu boş (`GT6`), kapanışın boş adımları (`KS6`–`KS9`), modülde iş ve geçmiş yok (`MT5`).

## 5. Gerçek cihazda bakılacaklar

- Cam bulanıklığının iPhone'daki görünüşü ve kaydırma akıcılığı; panoda gün boyu yükü.
- Gündüz gökyüzünün açık ufkunda (ekranın alt yarısı) panelsiz yazıların okunurluğu.
- Zaman şeridinde telefonda dokunma: dar parçalara (15 dakikalık iş yaklaşık 5 px) parmakla isabet; gerekirse dokunma alanı parçadan geniş tutulur.
- Telefonda alttan açılan sayfanın klavye açıkken davranışı (hızlı girişte kutu klavyenin üstünde kalmalı); çizimde klavye yok.
- Takvim'de yedi gün kutusunun küçük telefonda (375 px ve altı) sığması.
- Gece karartmasının panoda yeterli olup olmadığı.
- "Saydamlığı azalt" açıkken bütün ekranların görünüşü: yalnızca Bugün'ün pano karesi çizildi (`K3B`).

## 6. İçeriği değişenler (kurulmayı bekleyen çekirdek işleri)

Hepsi `docs/09-kararlar.md`'de 14–15 Kas 2026 satırlarıdır; kodda eski hali durur.

| Konu | Yeni hali | Dokunduğu yer |
| --- | --- | --- |
| Tema | Tek renk sistemi; Görünüm'de iki anahtar | Ayarlar, stil |
| Bugün'ün üst satırı | Yalnızca başlık ve tarih | Bugün |
| Hayat modu | Yok | Planlayıcı, veri, Takvim, modül ayarları, yapay zeka notları |
| Bağlam seçimi | Yok; planlayıcı tahmin eder | Planlayıcı, Bugün |
| Saatle gün bitişi | Yok | Planlayıcı, Ayarlar, zaman şeridi, Zaman formu |
| "Vakit kalırsa" | Yok; Sıradakiler günün kalan planı | Bugün, kapanış |
| Günün 3 işi | Yok | Planlayıcı, yapay zeka, Günaydın, geri dönüş, kapanış, Rutin'in özeti |
| Zaman şeridi ve Sıradakiler | Saatli şerit; açılır liste | Bugün |
| Hafta | "Takvim": dokunulabilir günler, teslim sırasıyla işler, hafta seçici | Takvim, menü, planlayıcı (gelecek günlerin planı) |
| Akşam kapanışı | Yalnızca Rutin'in akşam sahnesinde; "Günü kapat" yok | Bugün, kapanış, Rutin |
| Düzenleme kabuğu | Telefonda alttan sayfa, panoda yan panel | Bütün formlar |
| Ayarlar | Bölüm listesi ve bölüm sayfaları | Ayarlar |

Açık kalan çekirdek soruları (planlayıcı işinde çözülür): konum gelene kadar bağlam tahmininin kaynağı; bitiş saati kalkınca `after_finish` ayrımı; "Bugün tamam"ın koşulu; gelecek günlerin planı (Takvim); Rutin kapalıyken kapanışa ulaşım.

## 7. Dışarıda bırakılanlar

- `deneme` modülünün ekranları.
- Modüllerin kendi gövdeleri, sahnelerinin içi, giriş türlerinin alanları ve ayarları (modül tasarımında).
- Sağlık alan sayfasının gerçek metrikleri (iki modül iki hafta kullanıldıktan sonra).
- Hava durumlu zemin (Fikirler).
- Başka haftaya gidilmiş Takvim; panoda bazı ikincil haller (her bölümün sonunda "çizilmeyenler").
- Seri ve blok düzenleme pencereleri, anahtar iptal onayı (aynı kalıplar).
