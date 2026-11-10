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
