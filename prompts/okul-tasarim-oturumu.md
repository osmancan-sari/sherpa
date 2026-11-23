# Okul modülü tasarım oturumu: başlangıç notu (16 Kas 2026)

Bu not, Okul'un tasarım sohbetini başlatır. Yöntem `prompts/modul-tasarim-oturumu.md` içindeki yedi adımdır; bu dosya o oturumun girdisidir: kullanıcının istekleri, ilerleme sohbetinin gördüğü düğümler ve oturumdan beklenen çıktı.

## Önce oku

`CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md`, `docs/01-urun.md`, `docs/06-modul-sozlesmesi.md`, `docs/08-notion-aktarim.md`, `docs/moduller/ORTAK.md`, `docs/moduller/okul.md`, `docs/moduller/okul-ninova.md` (özellikle "Denenmeyenler" ve "Bekleyen kararlar"), örnek olarak `docs/moduller/rutin.md`, tasarım için `docs/tasarim/` (README, ilkeler, parcalar). Kullanıcının Notion'daki okul veritabanını Notion bağlantısıyla oku (yalnızca okuma).

Mevcut `okul.md` taslağı çekirdek değişmeden önce yazıldı. Ç3e–Ç4c sonrası hale göre güncellenecek: bölümler (dersler), sahne, çapalı diziler, günün çerçevesi, sade Bugün, Takvim, alan sayfası, cam dili.

## Kullanıcının istekleri (16 Kas, kendi anlatımından)

1. **Başlangıç verisi Notion'dan.** Notion'da ayrıntılı bir okul veritabanı var. Yapısı modüle geçerken değişebilir; içindeki bilgi temel alınır, sonra tek seferlik Ninova ile doğrulanır.
2. **Okul'un kendi tabloları olur.** Kurulduktan sonra Ninova'dan otomatik güncellenir.
3. **Dosyalar.** Ninova'da her dersin sınıf dosyaları, ders dosyaları ve ödev dosyaları var. Sherpa hepsini otomatik alıp kendi içinde saklar.
4. **Yapay zekayla klasörleme.** Hocalar dağınık yüklüyor (eski yılların slaytları vb.). Sherpa dosyaları inceleyip ders başına düzenli bir yapı kurar. Örnek: `YZV406E/` altında syllabus, ders slaytları, ödevler, proje ve gerekirse alt klasörler.
5. **Aynı yapı iki yerde güncel durur:** Sherpa'da ve kullanıcının bilgisayarının masaüstünde. Her güncellemede yenilenir.
6. **Dersin bütün sorumlulukları.** O derse ait bütün veriden (ödevler, duyurular, syllabus, dosyalar) çıkan tek liste: ödevler, vizeler, final, projeler ve projenin kendi küçük adımları.
7. **Hazırlık dokümanları.** Kullanıcı vize ve quizlere hazırlanırken doküman oluşturtuyor (konu anlatımı, soru seti, sınav öncesi özet). Bunun modüldeki yeri de bu yapıyla birlikte değerlendirilecek.
8. **Oturumdan beklediği:** hepsini ayrıntılı değerlendiren, yapıyı sunan, gerektiğinde alternatif yapılar gösteren bir çalışma. Kullanıcı seçer, geri bildirimle olgunlaştırır; sonunda kodlamaya hazır hale gelir.

## İlerleme sohbetinin gördüğü düğümler (oturumda karara bağlanacak)

Bunlar öneri ve soru; karar oturumda, kullanıcının onayıyla.

1. **Ninova'da denenmeyenler her şeyin temeli.** Otomatik giriş (ek doğrulama var mı), oturumun süresi, dosya indirme, dolu not tablosu, üniversitenin otomatik erişim kuralı hâlâ "denenmedi". Tasarımın 2. ve sonraki adımları bunlara dayanıyor; oturumun başında kullanıcının kendi oturumuyla, yalnızca okuyarak denenmeli. Şifreyi kullanıcı girer; sohbete yazılmaz.
2. **Toplayıcı nerede çalışır.** Taslak: kullanıcının bilgisayarında (`scripts/ninova-sync/`), şifre yalnızca yerelde. Masaüstü klasörü isteği bununla iyi örtüşüyor (aynı betik dosyayı indirir ve klasöre yazar). Bedeli: bilgisayar kapalıyken güncelleme yok. Alternatifi (bulutta toplayıcı, şifre Vault'ta) güvenlik ve kural açısından değerlendirilmeli.
3. **Dosyalar nerede durur.** Sherpa'da saklamak = Supabase Storage (kota, boyut, yedek). Seçenekler: bütün dosyalar bulutta; yalnızca dizin ve özet bulutta, dosyalar yerelde; karma. Telefonda dosyayı açabilmek istenir mi?
4. **Klasör yapısı görünüm mü, taşıma mı.** Öneri: ham dosya değişmeden saklanır (Ninova kimliği ve özetiyle), düzenli yapı bunun üstünde bir eşlemedir. Böylece yapay zeka sınıflandırmayı değiştirince ya da kullanıcı düzeltince dosya yeniden inmez, yol kırılmaz. Kullanıcının elle taşıdığı dosya `provenance` kuralıyla kullanıcınındır; sonraki güncelleme onu ezmez.
5. **Masaüstü eşitlemesinin yönü.** Tek yön mü (Sherpa → masaüstü) yoksa iki yön mü? Kullanıcının o klasöre kendi koyduğu dosyalar (notlar, çözümler) ne olur; ayrı bir alt klasör mü?
6. **Yapay zekanın emin olmadığı sınıflandırma.** Ürün kuralı: varsayımla boşluk doldurulmaz. Düşük güvenli dosya "Sınıflandırılmamış"ta bekler ve tek dokunuşla onaylanır; eski yıl malzemesi ayrı işaretlenir, silinmez.
7. **Sorumluluk listesinin kaynakları eşit güvenilir değil.** Ninova ödevleri yapılı ve güvenilir; vize ve final tarihleri çoğu zaman syllabus ya da duyuru metninde, serbest metin. Yapay zekanın metinden çıkardığı sorumluluk onay bekler (`needs_confirm`), kaynağı gösterilir. Proje adımlarını kim böler: kullanıcı mı, yapay zeka önerir kullanıcı onaylar mı?
8. **Hazırlık dokümanları.** Taslakta 3. adım ve "Ç5'ten sonra, deneme". Ders içeriği bugün ayrı Claude projelerinde yürüyor. Seçenekler: Sherpa yalnızca düzenli klasörü ve sınav takvimini sağlar, doküman o projelerde üretilir; Sherpa üretimi tetikler ve çıktıyı dersin klasörüne koyar; tümü Sherpa içinde. Maliyet ve Ç5 köprüsüyle ilişkisi değerlendirilmeli.
9. **Çekirdek için olası notlar.** Dosya saklama ve "kullanıcının bilgisayarında çalışan toplayıcı" başka modüllere de lazım olabilir; çekirdekte genel bir yetenek olarak mı kurulmalı? Oturum çekirdeği değiştirmez, "çekirdek için notlar"da listeler.
10. **Adımlara bölme.** Yapının tamamı şimdi tasarlanır ve baştan tam kurulur; adımlar arasında kullanım için beklenmez (16 Kas 2026 kararı). Adımlar yalnızca teknik bağımlılık ve doğrulama içindir. Önerilen sıra: (1) tablolar, Notion aktarımı, sorumluluk listesi ve ekranlar; (2) Ninova'dan ödev, duyuru, not; (3) dosyalar, klasörleme ve masaüstü; (4) hazırlık dokümanları.

## Oturumdan beklenen çıktı

- Önce: taslakta bugün geçerli olan ile değişmesi gereken; Notion veritabanının okunan yapısı; Ninova'da denenenlerin sonucu.
- Düğümlerin her biri için seçenekler, bedelleri ve bir öneri; kullanıcı seçer.
- Onaylı `docs/moduller/okul.md` (ve gerekirse `okul-ninova.md`, `okul-dosyalar.md`), veri modeli, kurallar, ürettiği işler.
- Ekranlar cam dilinde çizilir; onaylı kareler `docs/tasarim/kareler/okul/`, ekran dokümanları `docs/tasarim/ekranlar/okul-*.md`.
- "Çekirdek için notlar".
- Adım başına kabul ölçütleri ve ilk adım için Claude Code istemi (`prompts/okul-1-*.md`).
- `docs/moduller/README.md` ve `docs/07-yol-haritasi.md` içindeki durumun güncellenmesi.

## Kurallar

Doküman yaz, kod yazma. Çekirdeği değiştirme. Varsayımla boşluk doldurma; denenmeyene "denenmedi" de. Ninova yalnızca okunur; İTÜ şifresi sohbete yazılmaz. Türkçe yaz; kod, tablo ve sütun adları İngilizce.
