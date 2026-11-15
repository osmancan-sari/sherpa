# Bugün (zaman çizelgesi ve Sıradakiler dahil)

Kaynak: `docs/13-cam-dili.md` bölüm 4.1 (15 Kas 2026, onaylı); kurulduğu faz Ç4c. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Bugün'ün durumları ("1 · Bugün" sayfası; onaylandı, 15 Kas 2026)

Metinler koddaki metinlerdir (`src/core/ui/today/`); örnek işler uydurmadır. Yeni metinler: "Hepsini göster", "Küçült", "GÜNÜN AKIŞI".

**Yerleşim, telefon (390×844).** Üstte tek satır: "Bugün" ve tarih. Hemen altında ana panelde "Şimdi" kartı, yoğun panelde açılır "Sıradakiler" (bölüm 4.2), altında günün akışı. Aşağı kaydırınca: uyarılar, sabit bloklar, modül hapları, alt satır ("X dk'm var", "Yeniden planla"), "Bugün bitenler".

**Yerleşim, pano (1440×900).** Her şey tek ekranda, kaydırma yok. Üstte tek satır: "Bugün", tarih ve saat. Altında iki sütun (5:3): solda "Şimdi" kartı (en az ekranın üçte biri; başlık `text-now`), sağda "Sıradakiler". Altında tam genişlikte zaman çizelgesi, yan yana iki uyarı, en altta modül hapları (sol) ve eylemler (sağ: "X dk'm var", "Yeniden planla", "+ Yeni giriş"). Sakin durumlarda (akşam, geri dönüş, boş gün) yalnızca kart durur; gecede yalnızca saat.

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
- Geçmiş parçalar soluk. Şimdiki an beyaz çizgi ve altında "şimdi 14:10" hapı.
- Panoda iş adları parçanın içinde yazar (`spacing-touch`'tan dar parçada yazmaz). Telefonda ad sığmaz: parçaya dokununca üstünde "15:55–16:55 · İstatistik ödevi" balonu çıkar, parça beyaz çerçeve alır; yolda "yol 35 dk". Panoda aynı balon imleç üstüne gelince.
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

## Ara kurulum (Ç4b faz denetimi, 15 Kas 2026)

Bugün'ün yerleşimi Ç4c'de karelere göre kurulur. O zamana kadar: alt kısımlar (günün akışı ve sabit bloklar; modül hapları, alt satır ve bütçe satırı) ikincil camda, telefonda "Sıradakiler" de; cam tam manzarada gerektiği kadar koyulaşır (4,5:1, `sky.test.ts`). "Veri okunamadı" hali `XP1` gibi: başlık, tarih ve saat; kartın yerinde, okuma genişliğinde panel. Bütçe satırı sayfanın sonunda (`XT6`, `XP3`). **Görüşün gerek** (karelerde alt satır panelsiz, koyu gökte).
