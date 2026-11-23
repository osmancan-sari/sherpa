# Spor modülü tasarım oturumu: başlangıç notu (23 Kas 2026)

Bu not Spor'un tasarım sohbetini başlatır. Yöntem `prompts/modul-tasarim-oturumu.md` içindeki yedi adımdır; bu dosya o oturumun girdisidir: kullanıcının istekleri, ilerleme sohbetinin gördüğü düğümler ve oturumdan beklenen çıktı.

## Önce oku

`CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md`, `docs/01-urun.md`, `docs/06-modul-sozlesmesi.md`, `docs/moduller/ORTAK.md`, `docs/moduller/README.md` ("Spor", "Beslenme", "Sağlık alanı sayfası"), örnek olarak `docs/moduller/rutin.md` ve `docs/moduller/okul.md` (yapı ve ayrıntı düzeyi), `docs/moduller/okul-cekirdek-notlari.md` (çekirdeğe yeni giren yetenekler: sahne yerleşimleri, sayılan dakika, `blockView`, `beforeExit`, yer tutucu süre; paket B'de dosya ve bildirim), tasarım için `docs/tasarim/` (README, ilkeler, parcalar, `ekranlar/sahne.md`).

## Kullanıcının istekleri (23 Kas, kendi anlatımından)

1. Sporu şu an hiçbir yerden takip etmiyor; **tamamen Sherpa üzerinden** takip etmek istiyor.
2. Kapsam: program, setler, tekrarlar, ağırlık gelişimi, hangi kasın ne kadar çalıştığı, **vücut haritası**.
3. Ölçüt: "en gelişmiş, en iyi spor takip uygulamalarını aratmayacak" bir sistem.
4. Önceki kararlar (depoda): Spor bağımsız bir modüldür ve Sağlık alanının üyesidir; boyun ve sırt (duruş) çalışması Spor'un ilk programıdır; arka planı kendine özeldir ("sportif siyah-yeşil, modern, yine cam"); düzenlilik Rutin'deki gibi izlenir; spor günü duş spordan sonraya gelir; planlayıcı sporun kısıtlarını bilir (salon saatleri, trafik, kalabalık saatler).

Kullanıcı hakkında bilinenler (oturumda doğrulanmalı, varsayılmamalı): hibrit antrenman, haftada 3 gün hedefi; şu an salon üyeliği yok, sabah egzersiz rutini var; başvurduğu kaynaklar arasında Jeff Nippard ve Güray Aydın var. Güncel durum (üyelik, ekipman, hedef) oturumun başında sorulur.

## İlerleme sohbetinin gördüğü düğümler (oturumda karara bağlanacak)

Bunlar öneri ve soru; karar oturumda, kullanıcının onayıyla. Her düğüm için seçenekleri, bedellerini ve bir öneri sun.

1. **Önce örnek uygulamalara bak.** "Aratmayacak" ölçütü somutlaşmalı: iyi bilinen antrenman takip uygulamalarının (ör. Hevy, Strong, Fitbod, MacroFactor'ın antrenman uygulaması) güncel özelliklerini web'den araştır, hangilerinin bu kullanıcı için gerçekten gerekli olduğunu ayıkla ve kullanıcıya bir kapsam tablosu sun (alınır / alınmaz / sonra). Oyunlaştırma olanlar (seri, rozet, sosyal akış) ürün ilkesi gereği alınmaz.
2. **Giriş yükü.** Ürün kuralı: her giriş en fazla iki dokunuş ya da tek cümle. Set başına tekrar ve ağırlık girmek bunu kolayca aşar. Öneri: her set programın hedefiyle ve son seferin değeriyle dolu gelir; hedef tuttuysa tek dokunuş, farklıysa sayaçla düzeltme; dinlenme sayacı kendiliğinden başlar. Bu kuralın sahnede nasıl tutulduğu çizilerek gösterilmeli.
3. **Program kimden gelir.** Seçenekler: kullanıcı kendi programını girer; yapay zeka hedefe, ekipmana ve haftalık gün sayısına göre önerir ve kullanıcı onaylar; hazır bir şablondan başlanır. İlerleme kuralı (ör. çift ilerleme, RIR hedefi, deload) kimin kararı? Program değişince geçmişle karşılaştırma nasıl korunur?
4. **Sabit haftalık program yok.** Ürün ilkesi sabit haftalık program istemiyor ve planlayıcı zaten günleri kendisi yerleştiriyor. Antrenman programı günlere değil sıraya bağlanmalı (A, B, C dönüşümü); planlayıcı dinlenme gününü, salon saatlerini ve yoğun günleri gözeterek yerleştirir. Kaçan antrenman ne olur: kayar mı, düşer mi?
5. **Salon yokken.** Şu an üyelik yok. Modül baştan tam kurulacak, ama ilk gün kullanılacak program evde yapılan çalışmadır. Tasarım iki durumu da çizmeli: ev (pano da kullanılabilir, ekipman az) ve salon (yalnızca telefon). Üyelik planı oturumda sorulur.
6. **Hareket kütüphanesi.** Kas eşlemesi (birincil, ikincil) olan bir hareket listesi gerekir. Kaynak seçenekleri: açık veri setleri (lisansı ve içeriği denenmeli; "denenmedi"), yapay zekayla üretilip kullanıcının düzelttiği liste, yalnızca kullanıcının programındaki hareketler. Görsel ya da video gerekli mi; lisansı?
7. **Kas hacmi ve vücut haritası.** Haftalık set sayısı kas başına (ikincil kasa kesirli sayım kuralı), ön ve arka vücut haritasında yoğunluk. Hangi kas ayrımı (kaba 12 grup mu, ince ayrım mı)? Harita yalnızca geçen haftayı mı gösterir, hedef aralığıyla mı karşılaştırır? "Ölçülemeyen durumun takibi yok" kuralı: yorgunluk, ağrı, toparlanma puanı gibi öznel alanlar alınmaz; RIR/RPE alınacaksa gerekçesiyle.
8. **Gelişim.** Hareket başına ağırlık ve tekrar geçmişi, tahmini 1RM, hacim eğilimi, rekorlar. Rekor nasıl gösterilir: oyunlaştırma olmadan, sessiz bir işaret olarak mı?
9. **Koç sahnesi.** Sahne salonda telefonda çalışır: hareket, hedef, set satırları, dinlenme sayacı, sıradaki hareket, hareket değiştirme (alet doluysa), süperset. Çekirdeğin paket A yerleşimleri (kontrol listesi, sayaçlar) yetiyor mu, yoksa yeni bir "set tablosu" yerleşimi mi gerekiyor? Yeni yerleşim gerekiyorsa çekirdek notuna yaz.
10. **Bağlantısız kullanım.** Salonlarda bağlantı zayıf olabilir. Antrenman bağlantı yokken kaydedilebilmeli ve sonra eşitlenmeli. Çekirdeğin bağlantısız kullanımı Ç4d'de; Spor buna ne kadar dayanıyor, çekirdek notu olarak yaz.
11. **Kardiyo ve hibrit.** Koşu, yürüyüş, bisiklet nasıl girilir: elle tek cümle mi, telefondan otomatik mi? iPhone'un Sağlık verisi web uygulamasından okunamaz; Kestirmeler ile giriş ucuna gönderme denenmedi. Adım sayısı ve yürüyüş alınacak mı?
12. **Vücut ölçüleri.** Kilo Beslenme'nin verisidir (tek yerde durmalı); çevre ölçüleri ve fotoğraf istenir mi? Hangi modülde durur?
13. **Öbür modüllerle bağ.** Yayınladığı olay (`spor.workout_done`: Beslenme gün tipini, Rutin duşu buna bağlar); antrenman günü bilgisinin planlanan hali de Beslenme'ye lazım (yarın antrenman var mı). Sağlık alan sayfasına verdiği görünümler.
14. **Görünüş.** Siyah-yeşil cam arka plan; sahnede ve modül sayfasında. Ses: dinlenme bitince ses ya da titreşim (web uygulamasında titreşim iPhone'da çalışmayabilir; denenmedi).
15. **Kurulum adımları.** Modül baştan tam tasarlanır ve tam kurulur (ilke 9). Adımlar yalnızca teknik bağımlılık içindir; her adımın hangi çekirdek yeteneğine dayandığı yazılır.

## Oturumdan beklenen çıktı

- Önce: kullanıcının güncel durumu (sorularla), örnek uygulamaların kapsam tablosu.
- Düğümlerin her biri için seçenekler ve öneri; kullanıcı seçer.
- Onaylı `docs/moduller/spor.md`: veri modeli, kurallar, teklif ettiği işler, sahne, modül sayfaları, bir haftalık simülasyon, kurulum adımları ve kabul ölçütleri.
- Ekranlar cam dilinde çizilir (telefon ve pano); onaylı kareler `docs/tasarim/kareler/spor/`, ekran dokümanları `docs/tasarim/ekranlar/spor-*.md`.
- Çekirdekten istenenler ayrı dosyada: `docs/moduller/spor-cekirdek-notlari.md` (Okul'daki biçimle: ne isteniyor, neye dayanıyor, en küçük hali, hangi adımdan önce). Kararları ilerleme sohbeti alır.
- `docs/moduller/README.md` ve `docs/07-yol-haritasi.md` içindeki durumun güncellenmesi.

## Kurallar

Doküman yaz, kod yazma. Çekirdeği değiştirme. Varsayımla boşluk doldurma; denenmeyene "denenmedi" de. Oyunlaştırma yok. Depoda commit atma (Claude Code aynı depoda çalışıyor). Türkçe yaz; kod, tablo ve sütun adları İngilizce. Antrenman programının içeriği (hangi hareket, kaç set) konusunda kullanıcının kaynaklarına ve kararına dayan; tıbbi öneri verme.
