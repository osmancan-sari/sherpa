# Ç4a: Sadeleşen çekirdek (planlayıcı ve veri)

Claude Code'a yalnızca şunu yaz:

> `prompts/c4a-sade-cekirdek.md` dosyasını oku ve uygula.

Ön koşul: `c3g-tamam` etiketi.

---

## Görev

Çekirdek ekranlarının tasarım oturumunda (14–15 Kas 2026) kullanıcı çekirdeğin içeriğini sadeleştirdi. Bu faz o kararların **planlayıcı, veri, sözleşme ve yapay zeka** tarafını kurar; ekranların yeni görünüşü sonraki iki fazın işidir (Ç4b cam temeli, Ç4c Bugün, Takvim ve kapanış). Bu oturumda yalnızca Ç4a yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı Ç4a, etiket `c4a-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c4a/`.

Kaynaklar: `docs/13-cam-dili.md` (bölüm 1 kararlar 6–8, bölüm 4.1–4.3 ve 4.6, **bölüm 6 toplu tablo**), `docs/09-kararlar.md` (14–15 Kas satırları), `prompts/cam-tasarim-devir.md` (bölüm B, C, D). Kullanıcının kararları yeniden tartışılmaz.

## İlk iş

1. Çalışma ağacındaki commit edilmemiş dosyaları tek commit'te kaydet (`docs/13`, `docs/09`, `docs/05`, `docs/moduller/ORTAK.md`, `docs/moduller/rutin-cizimler/degerler.md`, `prompts/` altındaki yeni dosyalar; varsa `docs/tasarim/kareler/`).
2. `docs/07-yol-haritasi.md`: Ç4 dörde bölünür. **Ç4a** sadeleşen çekirdek (bu faz), **Ç4b** cam temeli ve içeriği değişmeyen ekranlar (`prompts/c4b-cam-temeli.md`), **Ç4c** Bugün, Takvim, kapanış ve alan sayfası (`prompts/c4c-bugun-takvim-kapanis.md`), **Ç4d** eski Ç4'ün teknik cilası (pano gün boyu açık, klavye, bağlantısız kullanım, bildirim denemesi; bağlam seçiciyle ilgili ölçütü çıkar). Sıra: Ç4a → Ç4b → Ç4c → Ç4d → Ç5. Rutin 2 araya alınabilir; Rutin 3'ün görünüş kısmı Ç4b'ye, "Yarının listesi" adımı Ç4c'ye taşındı.
3. `docs/ILERLEME.md`: tasarım oturumunu, bu sırayı ve aşağıdaki kararları işle.

## Kararlar

Kullanıcının kararları (K) ve onların açık bıraktığı çekirdek sorularına ilerleme sohbetinin verdiği cevaplar (İ; kullanıcının "teknik kararlarda Claude'un önerisi" kuralıyla, 15 Kas 2026). Hepsini `docs/09`'a ve ilgili dokümana (01, 03, 04, 06, 10, 12, `rutin.md`) aynı commit'lerde işle.

1. **Hayat modu kalkar (K).** Hiçbir yerde seçilmez, gösterilmez, okunmaz: planlayıcının girdisi, ayarlar, modül ayarlarındaki "Hayat modlarında", sözleşmedeki mod davranışı, yapay zeka çağrılarının girdisi ve notları. Yükü motor kapasiteden ve takvimden çıkarır.
2. **Bağlam elle seçilmez (K); tahmin edilir (İ).** Pano eskisi gibi `desk`'tir. Telefonda sırayla: (a) `core/context` ucundan son 3 saat içinde yazılmış değer (ileride konum otomasyonu buraya yazar); (b) şu an içinde olunan ya da 30 dakika içinde başlayacak, yeri olan sabit bloğun yeri; (c) günün gün tipi (Ev, Ofis, Kampüs günü); (d) hiçbiri yoksa süzgeç kapalı: her iş adaydır. Yol kuralları değişmez. Telefondaki bağlam seçici kalkar; `core/context` ucu ve gün tipleri durur.
3. **Saatle belirlenen gün bitişi kalkar (K).** Ayarda, gün tiplerinde ve ekranda bitiş saati yok. Çalışma penceresi uyanıştan (ya da şimdiden) yatışa bağlı dizinin başına, o yoksa beklenen yatışa uzanır (İ); çerçeve kapalıysa yatış aralığının varsayılan başına. `after_finish` ayrımı ve "akşam" bölümü anlamını yitirir (İ): alan zarfta kabul edilir ama okunmaz; formdaki seçeneği ve "bitiş çizgisinden sonra" uyarısı kalkar. Uyku korunmaya devam eder: planlayıcı uykuyu iş yüküne feda etmez.
4. **"Vakit kalırsa" kalkar (K).** "Sıradakiler" günün kalan planıdır; sığmayan iş ekranda birikmez. "X dk'm var" plan dışındaki adaylardan seçmeye devam eder.
5. **Günün 3 işi kalkar (K).** Planlayıcının çıktısında, `plan` çağrısında, Günaydın özetinde, geri dönüş kartında (sıradaki tek iş ve "Başla"), kapanışın taslağında (işaret kutusu yok; "İstemediğini çıkar.") ve Rutin'in sesli özetinde. Rutin'in yeni kalıbı: ilk sabit blok ve saati, bugün planlı iş sayısı ve ilk iş, bu gecenin yatışı ("Günaydın. 10:30'da dersin var. Bugün dört iş var; ilki proje önerisi. Yatış 23:00."); **görüşün gerek**.
6. **"Bugün tamam" (İ).** Bugünün planında yapılacak çapasız iş kalmadığında (hepsi bitti, ertelendi ya da düştü) ve kalan pencereye sığan planlı iş yokken görünür. Uyanışa ve yatışa bağlı işler bu koşula girmez; akşam kartı kendi saatinde ayrıca gelir.
7. **Gelecek günlerin planı (İ).** Takvim'in "Planlananlar"ı için saf bir tahmin: motor seçili haftanın kalan günlerini sırayla, aynı kurallarla ve önceki günlere koyduğunu düşerek dizer. Kaydedilmez, her okunuşta yeniden hesaplanır, o günün sabahında gerçek plan onun yerini alır ("Plan tahminidir; o sabah yeniden kurulur."). Aynı girdi aynı tahmini verir; bugünün planını değiştirmez (testle tut). Bu fazda yalnızca hesap ve veriye ulaşan yol kurulur; ekranı Ç4c'dedir. Haftanın işlerinin teslim tarihine göre listesi ve hafta başına iş ile vakit toplamı (sekiz hafta ileri) için de veriyi hazırla.
8. **Kapanış (bu fazda değişmez).** Kapanışın yalnızca akşam sahnesinde yaşaması ve "Günü kapat" düğmelerinin kalkması Ç4c'dedir; bu fazda kapanış ekranı erişilebilir kalır. Yalnızca 5. maddedeki içerik farkı uygulanır.

## Kurallar

- **Önce testler.** Planlayıcıda her değişiklik için önce test; `docs/04`'ün test listesi yeni kurallara göre güncellenir. Kalkan kuralların testleri silinir, gerekçesi "Verdiğim kararlar"a yazılır; başka hiçbir test gevşetilmez.
- **Veri.** Üretimde kullanıcının gerçek verisi var. Sütun ve tablo silme: kalkan alanlar okunmaz ve yazılmaz, `docs/03`'te "kullanılmıyor (Ç4a)" diye işaretlenir; temizliği Ç4d'ye not et. Migration yalnızca ekleme yapar.
- **Sözleşme ve modüller.** `deneme`, şablon kopyası ve Rutin yeni sözleşmeye bağlanır (mod davranışı, `after_finish`, özet). Geriye uyum: eski alanı gönderen modül kırılmaz.
- **Ekranlar bu fazda yeniden çizilmez.** Yalnızca kalkan şeyler kaldırılır (mod ve bağlam seçici, bitiş saati, ilerleme n/3, "Vakit kalırsa", günün işleri satırı, ayarlardaki karşılıkları); yerleşim Ç4b ve Ç4c'de gelir. Kaldırınca bozulan ekranı toparla, ama yeni tasarım kurma.
- **Denetçi:** planlayıcı, sözleşme ve yapay zeka adımlarından sonra adım kipinde; sonunda faz kipinde.
- **Görüşün gerek:** kullanıcının göreceği her yeni metin ve varsayılan.

## Yayın

Önceki fazlardaki sıra: migration'lar önce `sherpa-dev`, sonra `sherpa-prod`, sonra `git push origin main` ve etiket. Kullanıcı başındaysa izni bu sohbette iste; gözetimsizsen `prod`'a ve `git push`'a dokunma.

## Sonunda

Rapor (`BASLA.md` madde 10) ve ek olarak: Ç4b ve Ç4c için notlar (ekranlarda geçici bıraktığın yerler, tahminin sınırları). "Sıradaki adım": Ç4b (`prompts/c4b-cam-temeli.md`).
