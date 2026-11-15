# Modüller, modül sayfası, alan sayfası, sahne kabuğu

Kaynak: `docs/13-cam-dili.md` bölüm 4.7 (15 Kas 2026, onaylı); kurulduğu faz Ç4b (alan sayfası Ç4c). Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Modüller, modül sayfası, alan sayfası, sahne kabuğu ("7 · Modüller, modül ve alan sayfası, sahne" sayfası; onaylandı, 15 Kas 2026)

Sakin zemin. Çekirdeğin sağladığı kabuklar çizildi; içini modül doldurur. Örnek olarak Okul kullanıldı (`deneme` çizilmedi); örnek veriler uydurmadır. Rutin'in kendi sayfası Rutin tuvalindedir ve bu iskelete uyar.

**Modüller.** Alanı olan modüller alan panelinde toplanır: başlıkta alanın adı, üyeleri ve "Alan sayfası" (ikincil); altında modül satırları. Alansız modüller tek panelde. Satır: renk noktası, ad, modülün durum metni, sağda ok; duraklatılan modül soluk ve "duraklatıldı" etiketiyle. Altta "Modülleri aç, duraklat ya da arşivle". Panoda paneller iki sütun, menünün yanındaki genişliğin tamamında (modül sayfası gibi); tek kalan panel iki sütunu kaplar. Karede (`MP1`) iki 480 px'lik sütun ve sağda boşluk vardı; 1920 px'lik panoda içerik sola yığılıp dar kaldığı için kullanıcının notuyla (15 Kas 2026) genişledi. Tek kalan panel de iki sütunu kaplar, tam genişlikte durur (kullanıcının kararı, 15 Kas 2026; karede çizilmedi).

**Modül sayfası: beş bölge.**

1. **Başlık ve durum.** Telefonda geri oku, renk noktası, ad, sağda modülün ana ekleme düğmesi; altında alan adı (bağlantı; varsa), durum metni ve sağlık ("dikkat", "geride": renk, simge ve yazıyla; "yolunda" yazılmaz). Altında "Bu hafta" sayıları tek panelde.
2. **Yaklaşanlar.** Yoğun panel; satırda renk noktası, ad, alt satır (bölüm, süre ya da işlenen / efor, tarih), sağda üç simge düğmesi (`IconButton`): Başla, Yapıldı, Düzenle. Bekleyen iş soluk, yalnızca Düzenle. Boşken "Bu modülde sırada iş yok."
3. **Bölümler ve gövde.** Bölüm sekmeleri cam hapta (seçili opak açık); sığmazsa yana kayar. Aynı satırın sağında geçmiş düğmesi (grafik simgesi ve ad; `ORTAK.md` bölüm 4). Gövde modülündür (kesik çizgili yer tutucu). Görünümü yoksa "Bu modülün kendi görünümü yok."
4. **Geçmiş.** Modül kendi görünümünü vermezse son 8 haftada harcanan süre: sekiz sütun, üstünde saat, altında haftanın başladığı gün ve ay; bu hafta tam renkte. Boşken "Son 8 haftada kayıtlı oturum yok." Bölümü olan modülde geçmiş düğmesiyle açılır (sekmelerin hiçbiri seçili görünmez); bölümü olmayan modülde sayfada açık durur, düğme yoktur.
5. **Giriş ve ayarlar.** "İş ekle", modülün giriş türleri, "Ritim ekle" (ikincil düğmeler) ve "Modül ayarları" bağlantısı.

Telefonda sıra: 1, 2, 3, 5 (4, düğmeyle). Panoda başlık, sayılar ve sekme satırı tam genişlikte; altında iki sütun (5:4): solda gövde ve giriş, sağda yaklaşanlar ve geçmiş.

**Alan sayfası (Sağlık).** Başlıkta alanın adı ve üyeleri. Her üye modül bir panel: renk noktası, ad, durum metni, haftanın sayıları; dokununca modüle gider. Altında üyelerden seçilmiş görünümler, her birinin sağ üstünde kaynağı ("Rutin"). **İçerik örnektir:** sayfanın metrikleri en az iki modül iki hafta kullanıldıktan sonra tasarlanır (13 Kas 2026 kararı); burada çizilen yalnızca kabuktur. Tek "puan" yoktur.

**Sahne kabuğu.** Çekirdeğin verdiği yalnızca şerit ve zemindir; içi modülündür. Şerit: saat, işin rengi, adı, geçen süre, "Çık". Telefonda sahne ekranı kaplar (alt menü yok), şerit en üstte tam genişlikte; panoda sahne sayfanın içinde, şerit hap biçiminde. Zemin modülün tonuna göre: sakin (günün gökyüzü), odak (koyu ve düz, `color-focus-tone`), enerji (işin renginden `color-energy-base`'e koyu geçiş). Modül kendi zeminini verirse o kullanılır (karar 4; `docs/06` "Modülün zemini"). Kurulum: `src/core/ui/today/Scene.tsx` (şerit), `src/core/ui/sky/moduleBackdrop.ts` (zeminin seçimi).

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

## Modül sayfasının kuralları

Kaynak: `docs/moduller/ORTAK.md` bölüm 4 (Rutin oturumu, 13–14 Kas 2026; iskeletin çizimi 15 Kas 2026). Kurulum Ç4b: `src/core/ui/module/ModulePageShell.tsx`. Kurulumda: modülün eylemleri başlığın sağında durur (ana ekleme düğmesi ilk eylemdir); eylemi olmayan modülde çekirdeğin "İş ekle"si. Sekme satırındaki "Geçmiş" düğmesi geçmiş paneline götürür; panel içerik değişmesin diye sayfada açık durur (**görüşün gerek**: karede düğmeyle açılıyor).

- Çekirdeğin beş bölgeli iskeleti; başlıkta modülün rengi, adı, alanı (bağlantı) ve modülün ana ekleme düğmesi.
- **İskeletin çizimi** (15 Kas 2026): `docs/13-cam-dili.md` bölüm 4.7, tuvalde "7 · Modüller, modül ve alan sayfası, sahne". Sıra: başlık ve haftanın sayıları, Yaklaşanlar, bölüm sekmeleri ve gövde, giriş ve ayarlar; geçmiş düğmeyle açılır. Bölümü olmayan modülde sekme satırı ve geçmiş düğmesi yoktur, geçmiş sayfada açık durur. Rutin'in sayfası sakin zemine geçer.
- **Yaklaşanlar satırı** çekirdeğindir: renk noktası, ad, alt satır, sağda Başla, Yapıldı, Düzenle (44 px simge düğmeleri).
- **Sahne kabuğu:** çekirdek yalnızca şeridi ve zemini verir (ton: sakin, odak, enerji); içi modülündür. Akşam kapanışı Rutin'in akşam sahnesinin içindeki bir adımdır (15 Kas 2026).
- **Sekmeler yalnızca bölümlerdir** (`facets`): cam hap içinde yan yana. Modülün geçmiş ve trend görünümü (iskeletin 4. bölgesi; Rutin'de "Düzenlilik") bölüm değildir, bölümlerin verisini birleştirir; bu yüzden sekmelerin içinde durmaz, aynı satırda ayrı bir düğmedir (grafik simgesi ve ad; telefonda sekmelerin sağında, panoda satırın sağ ucunda). Her modülde aynı yerde ve aynı simgeyle durur; adını modül seçer (Rutin: Düzenlilik; Spor kendi adını seçer). Açıkken düğme opak açık olur, sekmelerin hiçbiri seçili görünmez.
- **Liste satırı:** ad, tek satır özet (süre, alt öğe sayısı, sıklık), varsa etiket, açık/kapalı anahtarı. Ekler girintili ve numarasız, kapalı olanlar soluk durur. Liste, sahnedeki sırayla numaralıdır; satırlar kendi grubunda sürüklenerek sıralanır.
- **Düzenleme** telefonda alttan açılan cam sayfada, panoda sağdan açılan yan panelde yapılır. Ekleme aynı sayfayı boş açar.
- **Her şey düzenlenebilir:** ad, süre, sıklık, alt öğeler (ekle, çıkar, sırala, süre ver). Ekranda yazan her sayı ya düzenlenir ya da düzenlenebilen sayılardan hesaplanır; hesaplanan sayı öyle etiketlenir ("toplam 4 dk").
- **Silme onayı** silmek yerine kapatmayı da sunar.
- **İçerik veridir, kod değil.** Kullanıcı öğrendikçe adım, ürün, kural ekleyip değiştirir; bunun için kod değişmez.

Kurulumda Yaklaşanlar satırının düğmeleri işin türüne göredir: iş Başla, Bitti, Düzenle; ritim Başla, Yapıldı, Düzenle; iş kalemi Başla, Kalemi bitir, Kalemi bırak, Düzenle (kodda olduğu gibi; karede üç düğme çizildi). Bekleyen iş soluk.
