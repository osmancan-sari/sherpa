# Okul: Ninova bağlantısı

Durum: **mümkün olduğu doğrulandı; tasarım taslak.** Okul modülünün 2. adımıdır. Okul tasarım oturumunda, aşağıdaki "Bekleyen kararlar" ile birlikte kesinleşir.

## Deneme (10 Kasım 2026)

Kullanıcının kendi oturumuyla, yalnızca okuyarak denendi. Ninova'nın belgelenmiş bir API'si bulunamadı; ama sayfalar sunucuda üretilen düz HTML ve oturum çerezi olan sıradan GET istekleriyle okunuyor. Adresler düzenli:

| Sayfa | Adres | Gelen veri | Kalite |
| --- | --- | --- | --- |
| Kampüs | `/Kampus` | Kayıtlı sınıfların listesi ve adresleri | Temiz |
| Bütün ödevler | `/Kampus?1/Odevler` | Başlık, ders, sınıf, teslim başlangıcı ve bitişi (tarih + saat), istenen ve yüklenen dosya sayısı | Temiz, yapılı |
| Bütün duyurular | `/Kampus?1/Duyurular` | Başlık, ders, metin (kısaltılmış), tarih ve saat, yazan | Temiz; içerik serbest metin |
| Duyuru | `/Sinif/{id}/Duyuru/{duyuruId}` | Tam metin | — |
| Ödev | `/Sinif/{id}/Odev/{odevId}` | Ödev ayrıntısı | Denenmedi |
| Sınıf bilgileri | `/Sinif/{id}/SinifBilgileri` | Dönem başlangıç ve bitişi, haftalık gün, saat ve derslik, eğitmenler | Temiz |
| Sınıf dosyaları | `/Sinif/{id}/SinifDosyalari` | Klasör ağacı: ad, boyut, tarih; her öğenin kimliği (`?g…`) | Temiz |
| Ders dosyaları | `/Sinif/{id}/DersDosyalari` | Aynı yapı | Temiz |
| Notlar | `/Sinif/{id}/Notlar` | Not tablosu ve ağırlıklı ortalama | Bakılan derste boştu; hocaya bağlı |
| Yoklama | `/Sinif/{id}/Yoklama` | Haftalık tablo | Güvenilmez: sayfa, hocaların Kepler'i de kullanabildiğini söylüyor |

`{id}` iki parçalıdır (`31387.123526` gibi): ders ve sınıf kimliği.

### Denenmeyenler

- Otomatik giriş: İTÜ tek oturum sayfası (`girisv3.itu.edu.tr`) üzerinden. Ek doğrulama adımı olup olmadığı bilinmiyor.
- Oturumun ne kadar açık kaldığı
- Dosya indirme
- Dolu bir not tablosunun yapısı
- Üniversitenin otomatik erişimle ilgili kuralı

## Deneme 2 (17 Kasım 2026)

Kullanıcı girişi kendisi yaptı; yalnızca okundu (GET). Hiçbir form gönderilmedi, dosya indirilmedi. Sayfalar hem tarayıcıda açılarak hem sayfanın içinden aynı oturumla istenerek okundu; ikisi de 200 döndü.

| Ne denendi | Adres | Sonuç |
| --- | --- | --- |
| Ders listesi | `/Kampus1` → `/members/ogrenci.default.aspx` | Okundu. Altı güncel ders ve yolları: BBF 301E `37636.122715`, YZV 302E `27886.121813`, YZV 406E `31387.123526`, YZV 411E `31596.122445`, YZV 448E `37550.121976`, YZV 475E `37747.122884`. Listede eski dönem ve bölüm sınıfları da var (YZV 401 altında); toplayıcı dönemi `SinifBilgileri`'ndeki "Dönem" alanından ayırmalı |
| Bütün derslerin açık ödevleri | `/Kampus?1/Odevler` | Okundu: tek sayfada ders, teslim başlangıcı ve bitişi, "istenen n dosyanın m adedini yüklediniz". Altı ders için tek istek yeter |
| Bütün derslerin duyuruları | `/Kampus?1/Duyurular` | Okundu: 80 duyuru bağlantısı, her birinde ders, tarih, yazan ve metnin başı. Tam metin `/Sinif/<id>/Duyuru/<no>` |
| Ödev ayrıntısı | `/Sinif/<id>/Odev/<no>` | Okundu: teslim başlangıcı ve bitişi, açıklama, kaynak dosyalar (ad, boyut, tarih; bağlantı `?g<no>`), istenen dosyalar ve uzantıları |
| Teslim durumu | `/Sinif/<id>/Odevler` | Okundu: yüklenen dosya sayısı her ödevde yazıyor ("1 adet dosyanın 1 adedini" ya da "0 adedini"). Teslimin kendiliğinden doğrulanması buna dayanabilir |
| Dosya listesi | `/Sinif/<id>/SinifDosyalari`, `/DersDosyalari`, alt klasör `?g<no>` | Okundu. Klasör ve dosya aynı bağlantı biçiminde; ayrım satırdaki simgeden (`/images/ds/folder`, `ikon-pdf.png`). Ad çoğu zaman uzantısız ("Lecture 0" bir PDF). Kök listede klasörün toplam boyutu yazıyor. Boyut yuvarlak (KB, MB) |
| Not tablosu (dolu) | `/Sinif/<id>/Notlar` | Okundu: değerlendirme adı, not, hocanın açıklaması, "Ağırlıklı Ortalamanız". Altı dersin dördünde en az bir satır var. İki tür satır görüldü (`rpGalileoNot`, `rpNot`); farkı bilinmiyor. Yardım metnindeki yüzde, ortalama, sıralama (imleçle görünen) okunmadı |
| Yoklama | `/Sinif/<id>/Yoklama` | Okundu. Sayfada iki bölüm var: "Ninova Yoklama Bilgileri" ve **"Kepler Yoklama Bilgileri"** (hafta × ders saati, 0 ya da 1). Yani Kepler'in yoklaması Ninova'dan okunabiliyor. Beş derste Kepler tablosu var, YZV 411E'de yok. 0'ın "gelmedi" mi "yoklama alınmadı" mı olduğu sayfadan anlaşılmıyor (ara tatil haftası ve gelecek haftalar da 0) |
| Ders saati | `/Sinif/<id>/SinifBilgileri` | Okundu: gün, **başlangıç ve bitiş saati**, derslik ("Perşembe 08:30 - 11:29 · Z-20"), dönemin başlangıç ve bitiş tarihi (28 Eylül – 31 Aralık 2026), eğitmenler |
| `robots.txt` | `/robots.txt` | `User-Agent: * / Allow: /` |

### Ninova'daki dosyaların boyutu (17 Kasım, dönemin 8. haftası)

Kök listelerdeki yuvarlak boyutların toplamı, yaklaşık:

| Ders | Boyut | Not |
| --- | --- | --- |
| BBF 301E | ~10 MB | |
| YZV 302E | ~111 MB | 64 MB'ı "PreviousYear" |
| YZV 406E | ~44 MB | 38 MB'ı Ders Dosyaları (tek derste dolu) |
| YZV 411E | ~12 MB | |
| YZV 448E | ~71 MB | hafta klasörleri (W01–W07) |
| YZV 475E | ~18 MB | |
| **Toplam** | **~266 MB** | eski yıl klasörü çıkınca ~200 MB |

Dönem sonu için kaba öngörü bunun iki katına yakındır; tek dosyaların en büyüğü görülen listelerde 9 MB.

### Hocaların klasör düzeni (kök)

- BBF 301E: slaytlar kökte tek tek; `Exercise Sets`, `Recitations`, `Seating Plans`.
- YZV 302E: `Lecture Notes 2026`, `Recitation Slides`, `Study Questions`, `Code`, `ReadingMaterial`, `PreviousYear`, `Sample Proposals`, `Seating Plans`; syllabus ve takvim kökte.
- YZV 406E: slaytlar Ders Dosyaları'nda numaralı; Sınıf Dosyaları'nda `Recitations`, `ROS2 Installation`, `Seating Plans`; syllabus kökte.
- YZV 411E: `Lecture Slides`, `Recitations`, `Seating Plans`.
- YZV 448E: hafta klasörleri `W01`–`W07`.
- YZV 475E: `Slides`; syllabus kökte.

Syllabus kökte görülen dersler: YZV 302E, YZV 406E, YZV 475E, BBF 301E (`BBF301E_CourseEval.andPlan`). YZV 411E ve YZV 448E'de kökte yok; alt klasörlere bakılmadı.

### İndirme (17 Kasım, kullanıcının izniyle)

Tek dosya denendi: `2026_2027_Fall_YZV_303E_Syllabus.pdf` (YZV 302E, Sınıf Dosyaları). Sayfanın içinden GET ile istendi; dosya diske yazılmadı.

- 200 döndü; `content-type: application/pdf`, `content-length: 79119`, `content-disposition: attachment; filename=2026_2027_Fall_YZV_303E_Syllabus.pdf`. Yani gerçek dosya adı ve türü yanıtın başlığından alınabiliyor (listede ad uzantısız olsa da).
- PDF'in metin katmanı var (taranmış görüntü değil; gömülü yazı tipleri ve Unicode eşlemesi var). Metnin düzgün çıkarılması ve haftalık konu sırasının okunması gerçek bir PDF okuyucuyla denenmedi.

### Oturum ve giriş

- Kullanıcının söylediği: Ninova ve Kepler aynı hesap; yalnızca kullanıcı adı ve şifre, ek doğrulama adımı yok.
- Girişten 45 dakika sonra (19:27) oturum hâlâ açıktı. Üst sınır ölçülmedi.

### Hâlâ denenmeyenler

1. Syllabus'tan haftalık konu sırasının çıkarılması (gerçek PDF okuyucuyla); YZV 411E ve YZV 448E'de syllabus'un yeri.
2. Oturumun en çok ne kadar açık kaldığı; toplayıcının kendi başına giriş yapması.
3. Otomatik erişim kuralı: `robots.txt` serbest; Ninova'nın Hakkında ve Yardım sayfalarında anahtar sözcük aramasında kural bulunmadı. Üniversitenin genel kullanım kuralları okunmadı.
4. Not satırındaki iki türün farkı (`rpGalileoNot`, `rpNot`). Sıra, ortalama ve standart sapma Kepler'den alınabiliyor (`okul-kepler.md`).
5. Çok sayıda dosyanın art arda indirilmesi (hız sınırı var mı).

## Tasarım

### Toplayıcı

Kullanıcının kendi bilgisayarında çalışan küçük bir betik (`scripts/ninova-sync/`). Bulutta çalışmaz: İTÜ şifresi yalnızca yerel anahtar zincirinde ya da `.env.local` içinde durur.

- Günde 2 kez çalışır (zamanlayıcıyla); elle de tetiklenir.
- Yalnızca GET yapar. Hiçbir formu göndermez, ödev yüklemez, hiçbir şeyi değiştirmez.
- Sayfalar arasında bekler; toplam istek sayısı çalıştırma başına birkaç onu geçmez.
- Okuduklarını uygulamanın `/api/ingest/ninova` rotasına cihaz belirteciyle gönderir (servis anahtarı bilgisayarda durmaz); ayrıştırma hatasında o sayfayı atlar ve çalıştırma kaydına not düşer.

### Tablolar

```
ninova_classes
  course_id -> school_courses
  ninova_path text              -- '/Sinif/31387.123526'
  label text                    -- Ninova'daki ad

ninova_items                    -- ham kayıt; kaynakla Sherpa arasındaki tampon
  class_id -> ninova_classes
  kind enum(assignment, announcement, file, grade)
  external_id text              -- Ninova kimliği
  title text, body text null
  posted_at timestamptz null, due_at timestamptz null
  raw jsonb
  content_hash text             -- değişiklik algılamak için
  status enum(new, applied, needs_confirm, ignored)
  unique (class_id, kind, external_id)

ninova_sync_runs
  started_at, finished_at, ok boolean, counts jsonb, error text null
```

### Eşleme

| Ninova | Sherpa | Nasıl |
| --- | --- | --- |
| Ödev | `school_assessments` | Otomatik upsert: başlık, teslim bitişi (`date_status = exact`), kaynak "Ninova". Tür varsayılan `homework`; başlıkta "project" geçiyorsa `project_step` önerilir |
| Ödevde yüklenen dosya sayısı | Teslim durumu | İstenen sayıya ulaştıysa `done`; teslim sorusu sorulmaz |
| Duyuru | Öneri kartı | Serbest metinden tarih, saat, derslik, kapsam ayıklanır ve kullanıcıya tek dokunuşluk onay olarak sunulur. "Yarın" gibi göreli ifadeler duyurunun tarihinden çözülür. Yapay zeka kapalıysa duyuru Okul sayfasında "Yeni duyurular" listesinde durur |
| Sınıf bilgileri | `school_courses` gün, saat, derslik; `school_terms` tarihleri | Dönem başında otomatik |
| Yeni dosya | Dersin yerel klasörü | İndirilir (`local_folder` altına, Ninova'daki klasör yapısıyla); `okul.material_added` olayı yayınlanır. Claude ders projesi bu klasöre bağlı olduğu için güncel kalır |
| Not | `school_assessments.score` | Tablo doluysa önerilir; kullanıcı onaylar |
| Yoklama | — | Kullanılmaz; devam elle işaretlenir |

### Ders eşlemesi

Ninova'daki kodlar Sherpa'dakilerle aynı olmayabilir (denemede bir ders farklı kodla göründü) ve listede eski dönemlerin sınıfları da var. Bu yüzden eşleme bir kez elle yapılır: Ayarlar'da her Sherpa dersi için Ninova sınıfı seçilir.

### Arıza durumu

- Giriş başarısızsa ya da sayfa yapısı değiştiyse çalıştırma `ok = false` olur.
- Okul sayfası her zaman "Ninova son okuma: …" bilgisini gösterir.
- Son başarılı okuma 2 günden eskiyse haftalık "Ninova kontrolü" ritmi geri gelir ve çip `attention` olur. Sistem elle girişle çalışmaya devam eder.

### Okul modülündeki etkisi

- "Ninova kontrolü" ritmi, toplayıcı sağlıklıyken pasiftir.
- "Tarih bekleyen" listesi duyurulardan gelen önerilerle beslenir.
- Hızlı girişteki elle yollar aynen kalır; Ninova'ya düşmeyen bilgi (derste sözlü duyurulan sınav) hâlâ elle girilir.

## Açık sorular

- [ ] Otomatik girişte ek doğrulama var mı? Varsa toplayıcı, kullanıcının tarayıcıdaki açık oturumunu kullanacak şekilde kurulur.
- [ ] Dosyalar yerel klasöre hangi yapıyla insin: Ninova'daki klasör yapısı mı, mevcut klasör düzeni mi?
- [ ] Üniversitenin otomatik erişim kuralı ne diyor?

## Bekleyen kararlar (10 Kasım 2026 görüşmesinden)

Bu üçü birbirine bağlıdır ve birlikte karar verilir:

1. **Toplayıcı nerede çalışsın?**
   - A. Yalnızca kullanıcının bilgisayarında: şifre yerelde; bilgisayar kapalıyken yeni veri gelmez.
   - B. Karma: bulut ödevleri ve duyuruları okur, dosya indirme yerelde kalır. İTÜ şifresi bulutta (şifreli) durur; yurt dışındaki sunucudan girişe üniversitenin nasıl davranacağı bilinmiyor.
   - C. Tamamen bulut: aşağıdaki 2. madde ile birlikte.
   - Karar ne olursa olsun okuma kısmı taşınabilir yazılır: aynı kod yerelde ve sunucuda çalışabilir.
2. **Ders klasörleri bulutta dursun mu?** Klasörler bilgisayarla eşitlenen bir bulut diskine taşınırsa (sunucudan yazılabilen bir API'si olan: Google Drive, OneDrive, Dropbox) bulut toplayıcısı dosyaları doğrudan oraya yükler; Claude projeleri eşitlenen yerel klasörü kullanmaya devam eder; telefon dosyaları disk bağlantısından açar. Bedeli: disk erişim izni de bulutta durur, klasör yolları değişir ve Claude projelerindeki klasör bağlantıları yeniden kurulur. Ders klasörlerinin şu an nerede durduğu öğrenilecek.
3. **Hazırlık dokümanları telefondan açılsın mı?** 2. madde kabul edilirse kendiliğinden çözülür; edilmezse hazırlık dokümanları ayrıca buluta yüklenir, ders dosyaları yerelde kalır.

## Taslak kabul ölçütleri

- [ ] Ninova'daki bütün açık ödevler doğru son tarihle Sherpa'da görünüyor; ikinci okumada kopya oluşmuyor
- [ ] Ninova'da değişen bir teslim tarihi sonraki okumada Sherpa'ya yansıyor
- [ ] Yeni bir duyuru Okul sayfasında öneri kartı olarak çıkıyor
- [ ] Yeni bir dosya dersin klasörüne ulaşıyor
- [ ] Toplayıcı yalnızca GET yapıyor (kodda form gönderimi yok)
- [ ] Giriş başarısız olunca uygulama çalışmaya devam ediyor ve durumu gösteriyor
- [ ] Şifre depoda yer almıyor
