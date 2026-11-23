# Modül: Okul

Durum: **onaylandı (23 Kasım 2026).** Tasarım oturumu 16 Kasım 2026'da yapıldı ve bu doküman o oturumun kararlarından baştan yazıldı. Çekirdek kararları aynı gün alındı ve bu dokümana işlendi (`okul-cekirdek-notlari.md`, "Kararlar"). Ninova ve Kepler 17 Kasım'da salt okuyarak denendi (`okul-ninova.md`, `okul-kepler.md`; sonuçlar bölüm 4'te). Kareler 17 Kasım'da onaylandı ve depoya kopyalandı (bölüm 8). Haftalık rapor 23 Kasım'da kararlaştırıldı (bölüm 10). Kurulum sırası: çekirdek paket A, ardından Adım 1 ("Kurulum adımları"). Bölüm 11'deki açık sorular Adım 1'i tutmaz; her biri ilgili adımdan önce kapanır.

- Çekirdekten istenenler ve alınan kararlar: `docs/moduller/okul-cekirdek-notlari.md` (çekirdek paketleri A, B, C)
- Ninova denemeleri (10 ve 17 Kasım) ve toplayıcının eski taslağı: `docs/moduller/okul-ninova.md` (taslak bölümü bu dokümana göre güncellenecek; çelişkide bu doküman geçerlidir)
- Kepler denemesi (17 Kasım): `docs/moduller/okul-kepler.md`
- Notion eşlemesi: `docs/08-notion-aktarim.md`
- Kareler (onaylı, depoda `docs/tasarim/kareler/okul/`); tuval: "Sherpa · Okul modülü (taslak mockuplar)", https://claude.ai/artifact/4DE2PDQUQq6vF3j3rqAHvm (90 kare; dizini bölüm 8.9'da)

## 1. Kimlik

- **Tür:** Dönemlik. Her dönem ayrı bir dönem kaydıdır; modül aynı kalır.
- **Amaç:** Dönemin bütün sınav, teslim, proje ve devam bilgisini tek yerde tutmak; ders dosyalarını kendiliğinden toplayıp düzenlemek; her sınav için hazırlık dokümanlarını zamanında hazır etmek; hazırlık ve ödev işlerini günün planına sokmak ve çalışma oturumunu sahnede yürütmek.
- **Başarı ölçütü:** Hiçbir sınav ya da teslim sürpriz olmaz. Kullanıcı Ninova'yı ve Kepler'i takip için açmaz, Notion'daki dönem sayfasını hiç açmaz. Bir sınavın çalışma oturumu açıldığında dokümanı hazırdır.

### Bu modülün yapmadığı

- Ders içeriği Sherpa'da üretilmez. Hazırlık dokümanları dersin Claude projesinin yöntemiyle (kullanıcının kendi talimatıyla) üretilir; Sherpa neyin, ne zaman ve hangi dosyalardan üretileceğini belirler, üretimi tetikler ve sonucu plana bağlar.
- Ödev ve proje çalışmasının kendisi Sherpa'da yapılmaz; Sherpa süreyi, sırayı ve teslimi yönetir.
- Çalışma istatistiği tutulmaz (tur sayısı, oturum özeti, çalışılan toplam süre gösterilmez). Yalnızca işin ilerlemesi görünür ("4 sa / 8 sa").

## 2. Yaşam döngüsü

- **Dönem başında:** dönem kaydı açılır; dersler, ders programı ve bilinen değerlendirmeler Ninova'dan, Kepler'den ve syllabus'tan gelir (ilk dönem için Notion'dan tek seferlik aktarım, ardından Ninova ile bir kez doğrulama). Bilgisayarda `Ders/<dönem>/<ders kodu>` ağacı kurulur.
- **Dönem içinde:** toplayıcı günde dört kez okur; dosyalar klasöre iner, tarihler ve kapsamlar netleşir, notlar ve yoklama Kepler'den gelir, dokümanlar üretilir, oturumlar planlanır.
- **Dönem sonunda:** dönem arşivlenir (açık işler `dropped`, blok serileri kapanır). Veriler ve klasör durur; yeni dönem kökün altında kendi adıyla yeni bir ağaç olur. Eski dönem klasörlerine dokunulmaz.
- **Dönem haftası:** `W1` dönemin başladığı haftadır, tarihten hesaplanır. 26-27 Güz için W1 = 28 Eylül 2026 haftası, W8 ara tatil; dersler 31 Aralık 2026'da biter, finaller 2–17 Ocak 2027 (akademik takvim; 16 Kas'ta arama sonucundan okundu, sayfanın kendisi açılmadı).
- **İlk sürümde yok:** bütünleme ve mazeret sınavları, dersi bırakma, dönem geçişi sihirbazı; elle yapılır.

## 3. Veri modeli

Notion'daki dört veritabanının karşılığı ve dosya, doküman, kural tabloları. Sütun adları öneridir; Claude Code çekirdeğin kurallarına göre kesinleştirir.

### school_terms
```
name text                     -- '26-27 Güz'
starts_on date, ends_on date  -- derslerin ilk ve son günü
finals_from date null, finals_to date null   -- akademik takvimden
break_weeks int[]             -- [8]
folder_root text null         -- bilgisayardaki kök: '<...>/Ders/26-27 Güz'
status enum(active, archived)
```

### school_courses
```
term_id -> school_terms
code text, name text, color text
weekday smallint null, start_time time null, end_time time null, room text null
location enum(campus, online) default campus
ninova_path text null         -- '/Sinif/31387.123526'
kepler_ref text null          -- Kepler'deki karşılığı (denemeden sonra)
claude_project_url text null  -- dersin Claude projesi (yedek yol için)
folder text null              -- kökün altındaki klasör adı (ders kodu)
grading_note text null
vf_conditions jsonb null      -- [{ text, kind, threshold }]; devam şartı varsa attendance sorusu sorulur
syllabus_weeks jsonb null     -- [{ week, topic }]; syllabus'tan bir kez okunur, kullanıcı düzeltebilir
```

### school_assessments
Her quiz, ödev, sınav, sunum, proje ve proje alt işi. Tarih, ağırlık ve kapsamın tek kaynağıdır.
```
course_id -> school_courses
parent_id uuid null -> school_assessments   -- proje alt işi → proje
title text
kind enum(quiz, midterm, final, homework, project, project_step, presentation)
output_kind enum(code, written, report, slides) null   -- ödev ve alt işte: sahnenin yöntemini belirler
date date null, time time null, room text null, duration_min int null
date_status enum(exact, estimated, unknown)
date_source enum(syllabus, announcement, ninova, kepler, calendar, rule, guess, user)
date_basis text null          -- tahminin dayanağı ya da duyurunun cümlesi
weight numeric null, score numeric null, score_source enum(kepler, user) null
excluded boolean default false
scope_from_week int null, scope_to_week int null, scope_text text null
scope_source enum(rule, announcement, user) default rule
owner enum(me, other, none) null, owner_name text null   -- grup projesinde alt işin sahibi
proposed boolean default false   -- alt işi yapay zeka önerdi
ninova_id text null           -- Ninova ödev kimliği
submitted_at timestamptz null, submit_source enum(ninova, user) null
status enum(todo, preparing, done, cancelled) default todo
notes text null, external_id text null unique   -- Notion sayfası (aktarım)
```

### school_sessions
Her ders oturumu.
```
course_id -> school_courses
date date, course_week int null, topic text null
kind enum(lecture, recitation, exam, presentation, holiday)
attendance enum(attended, missed) null          -- kullanıcının işareti
kepler_attendance enum(present, absent) null    -- Kepler'in kaydı
external_id text null unique
```

### school_class_notes
Derste tek cümleyle yazılan not; sonradan tarihe ya da işe çevrilir.
```
session_id -> school_sessions
text text, created_at timestamptz
converted_to uuid null -> school_assessments
```

### school_files
Toplayıcının gördüğü ve kullanıcının klasöre koyduğu her dosya. Dosya bir kez saklanır; düzenli yol bu kaydın alanıdır.
```
course_id -> school_courses
origin enum(ninova, user)
ninova_id text null unique, ninova_path text null, original_name text
folder text, tidy_name text   -- ders klasörünün altındaki yer ve ad
kind enum(slide, note, recitation, sample_question, solution, homework, past_exam, syllabus, project, other)
week int null, topic text null
confident boolean default true   -- false: "emin değil" işareti
old_year boolean default false
user_moved boolean default false -- true: yeri ve adı bir daha değişmez
size_bytes bigint, posted_at timestamptz null
in_cloud boolean                 -- güncel dönem malzemesi: telefonda açılır
replaces uuid null -> school_files   -- Ninova'da değişen dosyanın eskisi
```

### school_prep_docs
Sınav başına iki doküman: konu anlatımı ve örnek sorular.
```
assessment_id -> school_assessments
output enum(topic, practice)
status enum(waiting, queued, generating, ready, failed)
file_path text null           -- 'Hazırlık/Quiz 3/Konu anlatımı.pdf'
version int default 1         -- güncellemede artar; eskisi 'eski/' içine alınır
produced_by enum(auto, manual) null, produced_at timestamptz null, updated_at timestamptz null
due_on date                   -- üretim günü (kural 6)
parts jsonb null              -- [{ title, kind: read|practice, minutes, questions, page, week, status, changed }]
missing jsonb null            -- dosyası olmadığı için yazılmayan konular: [{ week, topic }]
unique (assessment_id, output)
```
`produced_by = manual` ve `file_path` boşsa kayıt "Dokümanım hazır" işaretidir (kural 7): dosya ve `parts` yoktur, oturumlar bölümsüz açılır.

### school_rules
Dersin tahmin kuralları.
```
course_id -> school_courses
text text                     -- 'Örnek sorulu ödev açılınca ertesi hafta quiz olur'
origin enum(user, sherpa), status enum(active, proposed, rejected)
hits int default 0
```

### school_sync_runs
```
source enum(ninova, kepler, calendar), started_at, finished_at, ok boolean, changes jsonb, error text null
```

### Çekirdeğe bağlantı

| Okul kaydı | Çekirdek kaydı |
| --- | --- |
| Dersin haftalık saati | `block_series` (kind `class`), `source_type = 'okul.course'` |
| Ders oturumu, sınavın kendisi | `blocks` içinde sabit blok |
| Sınav (quiz, midterm, final) | Hazırlık iş kalemi; oturumları dokümanın bölümlerinden |
| Ödev | Tek iş kalemi; adımı yok |
| Proje | Üst iş kalemi; alt işleri alt kalemler |
| Teslim yükleme, doküman ürettirme, bekleyen | İş (`tasks`) |

### Türetilen değerler

- **Ağırlıklı puan:** `score × weight ÷ 100` (`excluded` hariç). **Anlık toplam:** dersin ağırlıklı puanlarının toplamı. **Açıklanan ağırlık:** notu gelmiş değerlendirmelerin ağırlığı.
- **Devam:** Kepler'in kaydı varsa o, yoksa kullanıcının işareti sayılır. İkisi ayrışırsa oturum "ayrışıyor" görünür. Kalan devamsızlık VF şartından hesaplanır.
- **Hazırlığın ilerlemesi:** biten bölümlerin dakikası ÷ toplam (ör. "10 sa / 16 sa").
- **Doküman günü:** sınav tarihi − 7 gün (quiz) ya da − 14 gün (midterm, final).

## 4. Veri kaynakları ve otomasyon

| Veri | Kaynak | Seviye | Denenme durumu |
| --- | --- | --- | --- |
| Mevcut dönemin verisi | Notion'dan tek seferlik aktarım; sonra Notion salt arşiv | Otomatik (betik) | Notion 23 Kas'ta dışa aktarıldı (`data/notion-export/`, depoya girmez): 6 ders, 59 değerlendirme (21'i tarihsiz), 86 oturum, 47 görev (27'si arşivli); hiç not girilmemiş. Veri 10 Kas'tan beri güncel değil; eksik not, tarih ve devamı Adım 2'de Ninova ve Kepler tamamlar |
| Ders programı, derslik, dönem tarihleri | Ninova "Sınıf bilgileri"; aynısı Kepler'in kayıtlı sınıflar ucunda | Otomatik | Okundu (17 Kas): gün, **başlangıç ve bitiş saati**, derslik, dönem tarihleri. Derslik üç derste Ninova ile Kepler arasında farklı (açık soru) |
| Ödevler, teslim saati, teslim durumu | Ninova: bütün dersler tek sayfada (`/Kampus?1/Odevler`); ayrıntı ödevin sayfasında | Otomatik | Okundu (17 Kas): liste, ayrıntı (kaynak ve istenen dosyalar), yüklenen dosya sayısı |
| Duyurular (tarih, saat, yer, kapsam) | Ninova: bütün dersler tek sayfada (`/Kampus?1/Duyurular`); metni yapay zeka okur (`extract`) | Otomatik, hemen uygulanır | Okundu (10 ve 17 Kas) |
| Ders dosyaları | Ninova sınıf ve ders dosyaları | Otomatik: indir, etiketle, klasöre koy | Liste ve tek dosyanın indirilmesi denendi (17 Kas): gerçek ad ve tür yanıtın başlığında. Toplam ~266 MB (8. hafta). Art arda çok dosya denenmedi |
| Syllabus ve haftalık konu sırası | Ninova'daki syllabus dosyası | Otomatik, bir kez okunur | Dört derste kökte bulundu, ikisinde (YZV 411E, YZV 448E) kökte yok. Denenen PDF'in metin katmanı var; **konu sırasının çıkarılması denenmedi** |
| Notlar | Kepler'in dönem içi not ucu (sıra, ortalama, standart sapma ile); aynı not Ninova'da da görünür; yoksa elle | Otomatik | Okundu (17 Kas), ikisi de |
| Yoklama | Kepler'in yoklama ucu (ders saati başına katıldı ya da katılmadı); Ninova'nın yoklama sayfası da aynı kaydı gösterir | Otomatik | Okundu (17 Kas). Beş derste kayıt var, YZV 411E'de yok. "Katılmadı"nın "yoklama alınmadı"dan ayrılamadığı görüldü (açık soru) |
| Final takvimi | Kepler | Otomatik | Sayfa görüldü; bu dönem için henüz boş. Yapısı açıklanınca görülecek |
| Dönem ve final dönemi tarihleri | Derslerin başı ve sonu Ninova'dan (28 Eylül – 31 Aralık 2026, okundu); final dönemi İTÜ akademik takviminden | Dönem başında | Final dönemi arama sonucundan okundu, sayfa açılmadı. Kepler'in akademik takvimi bu dönem için boş |
| Hocanın Ninova dışında paylaştığı dosya | Kullanıcı ders klasörüne koyar | Elle; etiket otomatik | — |
| Devam işareti | Ders bitince tek soru | Tek dokunuş | — |
| Derste sözlü söylenen | Derste görünümünde tek cümle | Tek cümle | — |

Denemeler: `okul-ninova.md` (10 ve 17 Kasım) ve `okul-kepler.md` (17 Kasım). Ninova ile Kepler aynı İTÜ hesabıyla, yalnızca kullanıcı adı ve şifreyle açılıyor. Kepler veriyi JSON uçlarından veriyor; Ninova düz HTML. Hâlâ denenmeyenler bölüm 11'de.

### 4.1 Toplayıcı

- Kullanıcının bilgisayarında çalışır; bilgisayar uykudaysa zamanlanmış görev uyandırır (denenmedi), gece uyandırmaz. İTÜ şifresi buluta gitmez.
- **Okuma zamanları:** günde dört kez (sabah, öğle, akşamüstü, akşam), bilgisayar açılınca ve her teslim saatinden 3 saat önce bir kez.
- Yalnızca okur: hiçbir formu göndermez, ödev yüklemez. Okuduklarını çekirdeğin giriş ucuna cihaz anahtarıyla gönderir.
- Kepler'de yalnızca dört şeyi okur: kayıtlı sınıflar, dönem içi notlar, yoklama ve (açıklanınca) final takvimi. Kişisel bilgi sayfalarını ve uçlarını hiç istemez; yanıtları olduğu gibi saklamaz, yalnızca gereken alanları alır.
- Ninova ile Kepler'deki ders CRN ile eşlenir (ders kodu ikisinde farklı olabiliyor).
- Okuma kodu taşınabilir yazılır; okumanın buluta alınması denemelerden sonra yeniden değerlendirilir.
- **Okunamazsa:** bulut tarafı beklenen okumanın gelmediğini fark eder ve ilk kaçan okumada bir kez bildirim gönderir; okuma düzelene kadar yinelemez. İki gün okunamazsa haftalık "Ninova kontrolü" işi (kalkan) geri gelir. Kaçan okuma, çekirdeğin kaynak başına "son başarılı okuma" yardımcısından anlaşılır (karar 2). Toplayıcının gönderimleri Ç3d'deki `Idempotency-Key` ile yinelenebilir; anahtar kaynağın kimliğinden türetilir. Dosya gövdesi giriş ucundan alınan süreli yükleme bağlantısıyla doğrudan saklamaya gider.

### 4.2 Klasör yapısı

```
Ders/                              yeni kök; yeri kullanıcıdan bekleniyor
  26-27 Güz/                       bugünkü dönem klasörü buraya taşınır
    YZV303E/                       ders başına klasör, ders koduyla
      <yapay zekanın kurduğu klasörler>   örnek: Syllabus, Slaytlar, Recitation, Ödevler, Proje, Örnek sorular ve çözümler, Eski yıllar
      Hazırlık/                    her derste aynı; doküman üretimi yazar
        Quiz 3/                    sınav başına klasör
          Konu anlatımı.pdf
          Örnek sorular.pdf
          eski/                    güncellemeden önceki sürümler
      SHERPA-TALIMAT.md            her derste aynı; dokümanların nasıl yazılacağı (kullanıcı yazar)
  25-26 Bahar ve öncesi/           eski dönemler; dokunulmaz
```

- Dersin içi sabit kalıp değildir: yapay zeka o dersin malzemesine göre kurar, hocanın Ninova'daki düzenini destek alır (düzen iyiyse ona yaslanır, dağınıksa kendi kurar). Her derste aynı olan iki şey Hazırlık klasörü ve talimat dosyasıdır.
- Yapı oturunca yerinde kalır: yeni dosya var olan klasöre girer; yeni klasör yalnızca yeni bir tür gelince açılır.
- Her klasörün tek yazarı vardır: Ninova'dan gelenleri toplayıcı, Hazırlık'ı doküman üretimi yazar. Toplayıcı Hazırlık'a yazmaz; listeler ve buluta kopyalar.
- Tek yön (Ninova → klasör); hiçbir dosya silinmez. Kullanıcının taşıdığı dosya kullanıcınındır, yeri ve adı bir daha değişmez. Ninova'da dosya değişirse eskisi kalır, yenisi yanına iner.
- **Saklama karmadır:** dizin her zaman bulutta; dosyanın kendisi güncel dönem malzemesi ve Hazırlık için bulutta da durur (telefonda açılır). Eski yıllar ve çok büyük dosyalar yalnız bilgisayarda. Sınır, Ninova'daki toplam boyut ölçülünce konur (ölçülmedi). Buluttaki kopya çekirdeğin dosya kovasında durur (`files.put`, `files.url`, `files.remove`; karar 1). Planın tek dosya sınırını aşan dosya yalnızca bilgisayarda kalır ve listede öyle işaretlenir.
- Kullanıcının bugünkü "26-27 güz dönemi" klasöründeki dosyalara ne olacağı klasör görülünce sorulacak.

### 4.3 Dosya etiketi

Her dosya iki etiket taşır: **tür** (slayt, not, recitation, örnek soru, çözüm, ödev, geçmiş sınav, syllabus, proje) ve **hafta ya da konu**. Klasör adları derse göre değiştiği için kapsam hesabı ve doküman üretimi klasöre değil etikete bakar. Emin olunmayan dosya en olası yere konur ve "emin değil" diye işaretlenir; onay kuyruğu yoktur. Kullanıcının klasöre koyduğu dosya da etiketlenir ve "sen ekledin" diye işaretlenir.

## 5. Kurallar

**1. Tarihin kaynağı.** Bir tarihin kaynağı her zaman görünür (syllabus, duyuru, Ninova, Kepler, akademik takvim, kural, tahmin, kullanıcı). Duyurudan okunan tarih, saat, yer ve kapsam onay beklemeden uygulanır; kayıtta duyurunun cümlesi durur. Kullanıcının elle girdiği tarih hiçbir kaynakla ezilmez: çelişen bilgi gelirse Sherpa sorar.

**2. Tahmini tarih.** Tarihi açıklanmamış her değerlendirme, dayanağı varsa tahmini bir hafta ya da gün alır ve her yerde "tahmini" diye işaretlenir. Dayanaklar: syllabus'taki hafta, dersin günü, akademik takvim (final, final döneminin içine konur; kesin tarihi Kepler verir), dersin tahmin kuralları. Hiçbir dayanağı olmayan "Tahmin edilemeyen" listesinde kalır, plana girmez. Kesin tarih gelince tahmin onunla değişir ve plan yeniden kurulur. Çekirdekte zarfın `due_estimated` alanıyla taşınır (karar 6); planlayıcı tahmini tarihe kesin tarih gibi davranır, ama tahmini tarihe "son tarih geçti" uyarısı verilmez.

**3. Tahmin kuralları.** Ders başına tek cümlelik kurallar (ör. "Örnek sorulu ödev açılınca ertesi hafta quiz olur"). Kullanıcı yazar; Sherpa aynı örüntüyü en az iki kez görünce kural önerir ve öneri tek dokunuşla onaylanmadan uygulanmaz. Kuralın ürettiği tarih her zaman "tahmini"dir ve dayanağında kural yazar.

**4. Kapsam.** Duyuru kapsam söylüyorsa o geçerlidir, kuralı her zaman ezer. Duyuru yoksa:
- **Quiz:** bir önceki quizin kapsamının bittiği yerden (ilk quizde dönem başından), quizden önceki hafta işlenen konuların sonuna kadar.
- **Midterm:** tek midterm varsa dönem başından, birden çoksa bir önceki midtermden; midtermden önceki hafta işlenen konuların sonuna kadar.
- **Final:** bütün dönem; ağırlık midterm sonrasındaki konulardadır.

Syllabus kapsamı belirlemez; konuların sırasını ve hangi haftada işlendiğini verir. Kapsam, sınav ayrıntısında kaynağıyla yazar ("kural", "duyuru: …", "sen").

**5. Dokümanlar.** Her quiz, midterm ve final için iki doküman üretilir: **konu anlatımı** ve **örnek sorular**. Ayrı özet ya da formül dokümanı yoktur.
- Kaynak, kapsamdaki haftaların etiketli bütün dosyalarıdır: slayt, not, recitation, örnek soru ve çözümü, ödev ve çözümü, geçmiş sınav. Yalnızca slayt değil.
- Nasıl yazılacağını dersin `SHERPA-TALIMAT.md` dosyası söyler (konu sıfırdan, sade dille, yüksek not hedefiyle; hocanın paylaştığı örnek soru ve recitation'lara dayanarak).
- **Hocanın dosyası olmayan konu hiç yazılmaz.** O konu dokümanda yer almaz, sınav ayrıntısında "dosyası bekleniyor" diye görünür ve süresi yer tutucu olarak plandadır. Dosya gelince doküman güncellenir. Dosya sınava iki gün kala hâlâ yoksa konu "dosyası yok" olur ve yer tutucu süresi plandan düşer.
- **Final:** bütün konuları içeren tek bir konu anlatımı; ilk konular için midterm dokümanı kullanılabilir. Örnek sorular bütün dönemi kapsar.

**6. Doküman günü.** Quiz için sınavdan 1 hafta, midterm ve final için 2 hafta önce üretilir.
- Midtermde ilk sürüm syllabus sırasına göre yazılır; kapsam netleşince güncellenir.
- Quizde kapsam bir hafta kala belli değilse syllabus sırasından alınır.
- Tarihi tahmini olan sınavın dokümanı tahmini tarihe göre üretilir.
- **Sıkışan hafta:** doküman gününü izleyen günler dolu görünüyorsa önce başka işler öne çekilir; yetmezse üretim öne alınır (o gün var olan dosyalarla), sonra güncellenir.

**7. Üretim yolu.** İki yol da kurulur.
- **Kendiliğinden:** bilgisayarda zamanlanmış bir Claude görevi, kullanıcının aboneliğiyle, ders klasörünü ve talimat dosyasını okur, iki PDF'i `Hazırlık/<sınav>/` içine yazar. Denenmedi (zamanlanmış görevin klasörü okuyup yazabildiği ve çıktının yeterliliği).
- **Elle (yedek):** kendiliğinden yol kapalıysa ya da doküman günü üzerinden bir gün geçtiği halde doküman yoksa Bugün'e "Dokümanları ürettir" işi düşer: komutu kopyala, dersin Claude projesini aç, iki PDF'i klasöre koy.
- İki yolda da çalışma planını Sherpa dokümanın kendisinden çıkarır: bölümler, bölüm başına dakika, soru sayısı, sayfa numarası. Dokümanın sonuna plan bloğu koymak isteğe bağlıdır.
- Sınav ayrıntısında "Yeniden ürettir" vardır.
- **"Dokümanım hazır" (elle yolun ilk hali; Adım 1'de kurulur).** Sınav ayrıntısında tek dokunuş: kullanıcı dokümanını kendisi hazırladığını söyler. İki doküman da "hazır, elle" olur (dosyası ve bölümleri yok); hazırlık o andan itibaren **bölümsüz pomodoro oturumlarıyla** açılır, süresi yer tutucu kalır. İşaret kaldırılınca açık oturumlar geri çekilir, biten oturumlar ve ilerleme durur, hazırlık yeniden yalnızca yük olur. Adım 3'te aynı kayıt dosyayla dolar: PDF'ler klasöre konunca Sherpa planı dokümandan çıkarır ve kalan süre bölümlere geçer. Ayrı, geçici bir yol değildir. (23 Kas 2026)

**8. Güncelleme.** Doküman güncellenince önceki sürüm `eski/` klasörüne alınır. Çalışılmış bölümler çalışılmış kalır; yalnızca yeni ve değişen bölümler plana eklenir ve "değişti" diye işaretlenir.

**9. Süre.** Sınav öğrenildiği anda hazırlığı **yer tutucu süreyle** plana girer; böylece aylık ve dönemlik plan dokümanlar hazır olmadan da doğru yükü görür.
- Yer tutucuyu yapay zeka kestirir: ağırlık, kapsamdaki hafta ve slayt sayfası, aynı dersin önceki sınavlarında gerçekleşen süre. Sabit alt ve üst sınır yoktur. Gerekçesi "Neden?"de yazar. Zarfta `effort_provisional` ve `effort_basis` (tek cümle) ile taşınır (karar 9); dokümanın planı gelince sürenin kaynağı `module` olur ve işaret kalkar.
- Doküman hazır olunca yer tutucunun yerini dokümanın planı alır.
- Ders başına bir düzeltme çarpanı tutulur: gerçekleşen ÷ planlanan. Sonraki tahminler onunla çarpılır.
- Henüz Ninova'da açılmamış ama syllabus'ta görünen ödev de yer tutucu süreyle plandadır.

**10. Oturum.**
- **Doküman olmadan çalışma oturumu açılmaz.** Yer tutucu süre planda yer tutar ama en erken doküman gününde başlar; doküman gecikirse oturumun yerinde "doküman bekleniyor" görünür. "Dokümanım hazır" işareti (kural 7) dokümanı hazır sayar: oturumlar işaretlendiği andan itibaren açılır, bölümleri olmadığı için "Bu oturumda" kutusu ve "Aç" çizilmez.
- Bir oturum, dokümanın sıradaki bölümlerinden kurulur ve adımları farklı türde olabilir: okuma bölümleri pomodoro, soru bölümleri soru sayacı, sınavdan önceki son bölüm tek blok tekrar.
- "Takıldım" denen sorular hazırlığın son oturumuna taşınır.
- **Kaldığın yer:** hazırlık oturumu açılınca, bu hazırlıkta en son bitirilen yer görünür (bölümün adı ve dokümandaki sayfası). Kendiliğinden gelir; kullanıcı bir şey yazmaz. Bir bölüm yarıda bırakıldıysa ("Oturumu bitir", "Bugünlük yeter") o bölüm "yarıda" diye görünür ve oturum ondan başlar.
- Yalnızca odak süresi sayılır; plandaki blok molaları da içerir. Sahne, oturum kapanırken sayılan dakikayı çekirdeğe bildirir (karar 7); öğrenme o sayıyı kullanır.
- Hazırlık oturumu 2 saattir ve molaları içindedir. Çekirdekte "molaları içinde" işaretli oturum en çok 120 dakika olabilir ve tek parça yerleşir (karar 12); daha uzun oturum yoktur. Ödev ve proje oturumları 90 dakika ve altıdır. Oturum uzunluğunu değiştiren bir ayar çizilmedi.

**11. Süre dolunca.** Bölüm bitmeden süresi dolarsa sahne "Süre doldu." der ve iki seçenek sunar: **Bitti**, **+5 dk** (sınırsız kez). İşin son oturumunda üçüncü seçenek vardır: **Bugünlük yeter** (kalan, yeni bir oturum olarak plana döner). Oturum uzarsa planlayıcı günün kalanını yeniden kurar.

**12. Ödev.** Ödevin adımı yoktur; yalnızca süresi ve oturumları vardır. Metni Ninova'da açılmadan oturum açılmaz. Sahneden çıkarken tek cümlelik "kaldığın yer" notu sorulur ve bir sonraki oturumun başında gösterilir.

**13. Proje.** Proje alt işlere bölünür. Resmi teslimler (proposal, ara rapor, sunum, final teslimi) dokümanlardan gelir; ara alt işleri yapay zeka önerir, kullanıcı düzenler. Alt işler zamanla açıklanabilir; bilinmeyen alt iş yer tutucudur. Alt işin içinde adım yoktur. Aynı oturuma iki alt iş düşerse ikisi de listelenir. Grup projesinde bütün alt işler sahibiyle görünür, yalnızca kullanıcınınkiler planlanır.

**14. Teslim.** Teslim bir kontrol listesidir: dosya hazır, adlandırma doğru, Ninova'ya yüklendi. "Yüklendi" bir sonraki Ninova okumasında kendiliğinden doğrulanır; kullanıcı "Yükledim" diye elle de işaretleyebilir. Teslim, planlayıcı tarafından en geç teslim gününden önceye konur; teslime 3 saat kala yükleme görünmüyorsa bildirim gider.

**15. Devam.** "Derse girdin mi?" sorusu yalnızca devam şartı olan derslerde, ders bitince sorulur: Girdim, Girmedim, Yapılmadı. Kepler'in yoklaması gelince işaret onaylanır ya da "ayrışıyor" diye gösterilir. Devam şartı olmayan derste soru sorulmaz.

**16. Not.** Notun birincil kaynağı Kepler'dir; elle giriş her zaman açıktır ve elle girilen not Kepler'le ezilmez (ayrışırsa gösterilir).

**17. Bildirim (telefon).** Yalnızca beş olayda: tarih açıklandı ya da değişti; yeni ödev ya da teslim açıldı; not açıklandı (bildirimde sayı yazmaz); teslime 3 saat kaldı ve yükleme görünmüyor; Ninova ya da Kepler okunamadı (ilk kaçan okumada bir kez). Yeni dosya ve hazır doküman için bildirim gitmez. Kanal web push'tur (iPhone'da ana ekrana eklenmiş uygulamada; karar 8). **Yedek:** web push denemesi başarısız olursa aynı beş olay Bugün'ün üstünde tek satır olarak görünür ve Okul bildirimsiz çalışır; en çok etkilenen "teslime 3 saat" uyarısıdır. Okul hatırlatma ya da teşvik bildirimi göndermez.

**18. Gösterilmeyenler.** Çalışma istatistiği, oturum özeti, soru başına süre, övgü ya da uyarı metni yoktur. Sayfa başında durum cümlesi ve "dikkat" etiketi yoktur.

## 6. Teklif ettiği işler

Modül işi teklif eder; ne zaman yapılacağına planlayıcı karar verir. Zarfın alanlarını kimin doldurduğu yanında yazar.

| İş | Ne zaman doğar | Süre | En erken · son | Sahne |
| --- | --- | --- | --- | --- |
| Sınav hazırlığı (`okul.prep`) | Sınav öğrenilince | Önce yer tutucu (yapay zeka), sonra dokümanın planı (modül) | Doküman günü · sınav günü | Karışık: pomodoro, soru, tek blok |
| Ödev (`okul.homework`) | Ödev görülünce (açılmadıysa yer tutucu) | Yapay zeka (`size`), ders çarpanıyla | Açıldığı gün · teslim saati | Kod ise akış, yazılı ise pomodoro |
| Proje alt işi (`okul.project_step`) | Alt iş belli olunca | Yapay zeka; kullanıcı düzeltir | Bir önceki alt iş · alt işin tarihi | Kod ise akış, rapor ise pomodoro, sunum provası ise hedefli |
| Teslim (`okul.submit`) | Ödev ya da alt işin teslimi varsa | 10 dk (varsayılan) | — · teslim saati | Kontrol listesi |
| Doküman ürettirme (`okul.prep_manual`) | Kural 7'deki yedek koşulda | 15 dk (varsayılan) | Doküman günü · +1 gün | Kontrol listesi |
| Takım toplantısı (`okul.meeting`) | Kullanıcı ekler | Kullanıcı | Sabit saat | Kontrol listesi |
| Ders, recitation | Ders programından | Sabit blok | Sabit | Derste görünümü (`ui.blockView`; karta dokununca açılır, oturum açmaz, süre saymaz) |
| Sınavın kendisi | Tarih ve saat belli olunca | Sabit blok | Sabit | Sınav günü görünümü (`ui.blockView`) |
| Bekleyen (not, dosya, tarih) | — | — | — | Sahnesi ve düğmesi yok; satır olarak görünür |
| Ninova kontrolü (kalkan) | İki gün okuma gelmezse | 10 dk | Haftalık | Kontrol listesi |

- Modülün doldurduğu alanlar: başlık, tür, son tarih, en erken başlangıç, ağırlık, dokümanın planından gelen süre ve bölümler.
- Yapay zekanın doldurduğu alanlar: yer tutucu süre, ödev ve alt iş süresi; her biri gerekçesiyle.
- `sizingHints`: ağırlık, kapsamdaki hafta sayısı, dosya sayfa sayısı, türü (kod, yazılı), aynı dersteki önceki gerçekleşen süreler, ders çarpanı.
- **Oturumları modül böler (karar 14).** Sınav hazırlığı kalemi, dokümanın planından çıkan sıralı oturum listesiyle verilir: `sessions: [{ minutes, meta }]`. Çekirdek haftası gelince bu listeden iş açar, kendisi bölmez; hafta yükünü listedeki dakikalardan hesaplar. Ödev ve projede oturumları çekirdek böler (bugünkü gibi).
- **Bölümler `meta`'da taşınır (karar 13).** Bir oturumun bölümleri (başlık, tür: okuma ya da soru, dakika, soru sayısı, sayfa, doküman) zarfın var olan `meta` alanındadır; `meta` oturum işine ve sahnenin konusuna (`SceneSubject`) taşınır, çekirdek okumaz. Ayrı bir `payload` alanı yoktur.
- **Gün.** Oturumların sırası, bölümleri ve dakikası baştan bellidir. Gün yalnızca planlanmış oturumlarda (bugün, yarın) kesindir; ötekiler hafta düzeyinde görünür. Gün gün öngörü çekirdeğin açık planlayıcı işine bağlıdır (15 Kas); o iş yapılınca burası kendiliğinden dolar.

## 7. Veri girişi

Her giriş en fazla iki dokunuş ya da tek cümledir. Olağan akışta kullanıcı veri girmez; girişler istisna ve düzeltme içindir.

| Anahtar | Nerede | Nasıl | Ne olur |
| --- | --- | --- | --- |
| `attendance` | Ders bitince Bugün'de; Devam sayfasında | Tek dokunuş: Girdim, Girmedim, Yapılmadı | `school_sessions.attendance` |
| `class_note` | Derste görünümü | Tek cümle | `school_class_notes`; sonra tarihe ya da işe çevrilir |
| `assessment` | Dersin sayfası: "Sınav ya da teslim ekle" | Tek cümle ("Quiz 4 3 Aralık") ya da kısa form | `school_assessments`, kaynak `user` |
| `date_update` | Sınav ya da teslim ayrıntısı | Tarihe dokun, yeni tarihi seç | Tarih `user` olur; bir daha ezilmez |
| `grade` | Sınav ayrıntısı | Sayı | `score`, kaynak `user` |
| `rule` | Dersin sayfası: Tahmin kuralları | Tek cümle; öneriyi tek dokunuşla onayla ya da reddet | `school_rules` |
| `resume_note` | Ödev ve proje sahnesinden çıkarken | Tek cümle (atlanabilir) | Sonraki oturumun başında gösterilir |
| `submitted` | Teslim sahnesi | "Yükledim" | `submitted_at`, kaynak `user` |
| `docs_ready` | Sınav ayrıntısı | Tek dokunuş: "Dokümanım hazır" (yeniden dokununca kalkar) | `school_prep_docs`: iki çıktı `ready`, `manual`; kalkınca `waiting` |
| `step_edit` | Proje ayrıntısı | Alt işi ekle, sil, adını ve sahibini değiştir | `school_assessments` (`project_step`) |

## 8. Arayüz

Kareler onaylıdır ve depodadır: `docs/tasarim/kareler/okul/`; düzen ve durumlar `docs/tasarim/ekranlar/okul-sahneler.md` ve `okul-sayfalar.md` içindedir. Aşağıdaki numaralar tuvaldeki kare numaralarıdır (dizin 8.9); dosya adları `kareler/okul/DIZIN.md`'de. Kareler bir tarayıcıda yedek yazı tipiyle kontrol edildi; tuvalin kendisinde görülmedi.

### 8.1 Bugün'de Okul

Okul'un işi Bugün'de çekirdeğin kartıyla görünür; kartta yalnızca üç şey vardır:

```
Okul · Robotics
Quiz 3 hazırlığı
Jacobian, hız kinematiği · 2 sa
[ Başla ]                 Neden?
```

- Başlık, tek satır (ne yapılacak + süre) ve "Neden?". Oturum sırası, sınav tarihi, ağırlık, ilerleme çubuğu ve doküman bağlantısı kartta yoktur; hepsi "Neden?"de ve sınav ayrıntısındadır.
- "Sıradakiler" satırlarında oturum sırası yazmaz. Bekleyen satırlarında (not, dosya, tarih) düğme yoktur.
- Ders ve recitation günün akışında sabit bloktur; karta dokununca Derste görünümü açılır. Ders bitince, devam şartı olan derste tek soru çıkar: "Derse girdin mi?"
- Sahne Modüller'de değil, Bugün'dedir: "Başla"ya basınca ekran işin sahnesine geçer; "Çık" ya da oturumun bitmesi Bugün'e döndürür. Telefonda sahne ekranı kaplar; panoda yan menüde Bugün seçili kalır.

Kareler: 2, 10 (quiz); 18, 25 (midterm); 32, 39 (ödev); 46, 53 (proje).

### 8.2 Sahnenin ortak iskeleti

```
14:36 · ● Okul · Robotics · 26 dk / 2 sa                          Çık
───────────────────────────────────────────────────────────────────────
                  Quiz 3 hazırlığı
                  Quiz 3 · 9 Aralık 10:30

                      ( 12:48 )        ← ortadaki sayaç adımın türüne göre değişir
                        ODAK
                        25 dk

  Bu oturumda
  ● Oku: Jacobian'ın tanımı        25 dk    Aç
  ○ Oku: Hız kinematiği            50 dk
  ○ Çöz: 6 soru                    30 dk

  [ Duraklat ]   Turu atla                          Oturumu bitir
```

- **Üst şerit:** saat, modül noktası, "Okul · ders", **geçen / ayrılan** ("26 dk / 2 sa"), "Çık".
- **Arka plan:** koyu lacivert-petrol, dersin renginde ışıma. Okul'un sayfalarında da aynı arka plan kullanılır.
- **Alt başlık:** sınavın tarihi ve saati (ödevde teslim saati).
- **Odak halkası:** ortada geçen süre, altında etiket (ODAK, KISA MOLA) ve turun toplamı ("25 dk").
- **Bölümler kutusu:** oturumun adımları sırayla; o anki adımda **Aç** vardır ve dokümanın buluttaki kopyasını yeni sekmede o sayfada açar (telefonda da). Bilgisayardaki yerel dosyayı doğrudan açmak denenmedi.
- **Yöntem ve süreler sahnede değiştirilmez;** iş türüne göre modül ayarlarında durur (8.7).
- **Oturumu bitir** oturumu erken kapatır: yapılan sayılır, kalan plana döner. **Çık** ise oturumu bırakır ve Bugün'e döndürür; oturum yarıda kalmış sayılır ve sürdürülebilir.
- **Oturumun sonu** tek yazıdır: "Oturum bitti." Sayı, süre, övgü yazmaz.

### 8.3 Sahne türleri

| Tür | Hangi işte | Ortadaki | Düğmeler | Kareler |
| --- | --- | --- | --- | --- |
| Pomodoro | Konu okuma, yazılı ödev, rapor | Halka: geçen süre, ODAK / KISA MOLA, tur toplamı | Duraklat, Turu atla; molada Molayı bitir, +5 dk | 3–5, 11–13, 47–49, 54–56 |
| Soru sayacı (hedefli) | Soru çözme, sunum provası | "3 / 6" ve sorunun süresi; Çözdüm, Takıldım | Açıklama satırı ilk "Takıldım"dan sonra görünür | 7, 15, 19–20, 26–27, 61 |
| Tek blok | Sınav öncesi tekrar | Tek geri sayım, mola yok | Duraklat | 62 |
| Akış | Kodlama ödevi, proje kodu | İleri sayan saat, "AKIŞ"; çubuk planlanan sürede biter | Mola ver (ileri sayar, süreye sayılmaz), Bitir | 33–35, 40–42, 60 |
| Kontrol listesi | Doküman ürettirme, teslim, takım toplantısı | Sayaç yok; işaretlenen adımlar | Adımın kendi düğmesi (Komutu kopyala, Ninova'yı aç, Yükledim) | 51, 58, 63, 64, 67 |
| Sabit blok | Ders, recitation, sınav günü | Dersin saati, derslik; tek cümlelik not alanı | — | 65, 66, 68 |

- **Karışık oturum:** bir sınav oturumunda adımlar tür değiştirir; ortadaki sayaç adıma göre değişir (kareler 3–7 ve 19–22).
- **Yerleşimler çekirdeğin kit parçasıdır (karar 10):** `docs/tasarim/parcalar.md` ve `ORTAK.md`'ye girer; Okul kendi kopyasını çizmez. Yalnızca onaylı karesi olan yerleşim kurulur. Pomodoro, akış ve kontrol listesi çekirdek paket A ile; soru sayacı ve tek blok paket C ile gelir.
- **Sabit blok bir sahne değildir:** ders, recitation ve sınav günü, bloğun kartına dokununca açılan görünümdür (`ui.blockView`). Oturum açmaz, süre saymaz, şeritte sayaç yoktur.
- **Süre dolunca** (kural 11): "Süre doldu." kartı, "Bitti" ve "+5 dk"; son oturumda "Bugünlük yeter" (kareler 6, 14, 36, 43, 50, 57).
- **Kaldığın yer:** her oturumun başında görünür. Sınav hazırlığında kendiliğinden gelir: bu hazırlıkta en son bitirilen bölüm ve sayfası (kural 10). Ödev ve projede kullanıcının çıkarken yazdığı cümledir: "Nerede kaldın?" tek cümle, atlanabilir (kareler 37, 44). Oturum başındaki görünüş: hazırlıkta kareler 87–88, ödevde 89–90. Telefonda tek satırlık dar kutu, panoda sağ sütunun başında. Çıkıştaki soru çekirdeğin `beforeExit` adımıyla gösterilir (karar 11): kabuğun "Çık"ı da bu adımdan geçer; bağlantı yokken ya da hata olursa çıkış engellenmez, not sorulmadan çıkılır.

### 8.4 Modül sayfaları

- **Ana sayfa (69, 81):** dönemin bütün işleri tarih sırasıyla, hafta başlıkları altında; her satırda ders rengi, ad, tarih, ağırlık; tahmini olanlar "tahmini" işaretli; sınav satırında dokümanların durumu (bekliyor, hazır, güncellendi). Altta "Tahmin edilemeyen" listesi. Sayfa başında durum cümlesi ve "dikkat" etiketi yoktur.
- **Ders seçimi (70):** telefonda açılır liste ve ayrı "Ana sayfa" girişi; panoda sekmeler.
- **Ders sayfası (71, 82):** kutular: VF şartları, Notlandırma (ağırlıklar, gelen notlar, anlık toplam), Tahmin kuralları; altında Sorumluluklar (dersin sınav, ödev ve proje listesi), Dosyalar ve Devam girişleri. "Sınav ya da teslim ekle" yalnızca bu sayfadadır.

### 8.5 Ayrıntı sayfaları

- **Sınav ayrıntısı (76, 83):** tarih, saat, yer (kaynağıyla); kapsam (kaynağıyla: kural, duyuru ya da kullanıcı); iki doküman (durum, sürüm, Aç, Yeniden ürettir); "dosyası bekleniyor" konuları; **bütün oturumlar**: her birinin bölümleri, dakikası ve durumu; planlanmış oturumda gün ("Oturum 2 · Çar 2 Ara · bölüm 2–4 · 2 sa"), ötekilerde hafta ("Oturum 4 · 7 Ara haftası"); ilerleme ("4 sa / 8 sa"); not gelince not. Kareler buna göre düzeltildi (17 Kas). Dokümanlar kutusunda "Dokümanım hazır" anahtarı durur (kural 7); açıkken altında "elle işaretlendi" ve günü yazar. Anahtarın karesi çizilmedi (**görüşün gerek**).
- **Sorumluluk ayrıntısı (75):** tarihin kaynağı (ör. duyurunun cümlesi); ödevde metin dosyası, teslim saati, oturumlar, "kaldığın yer" notu, teslim durumu. Projede alt işler sahibiyle; önerilen alt işler "öneri" işaretli ve düzenlenebilir.
- **Dosyalar (73) ve dosya ayrıntısı (74):** dersin klasör ağacı; her dosyada tür ve hafta etiketi, "emin değil" ve "sen ekledin" işaretleri, bulutta olup olmadığı; ayrıntıda Ninova'daki yeri ve özgün adı.
- **Devam (72):** oturum listesi; kullanıcının işareti ve Kepler'in kaydı yan yana; ayrışan oturum işaretli; kalan devamsızlık hakkı.
- **Bildirimler (77):** beş olayın listesi ve örnek metinleri.

### 8.6 Uçtan uca akış kareleri

Sistemin kullanıcıya görünmeyen kısmı üç karede çizildi: klasör yapısı (84), Ninova'dan klasöre akış (85), doküman üretiminin tetikleyicileri ve iki yolu (86).

### 8.7 Ayarlar

**Okul ayarları (78):** kaynaklar (Ninova ve Kepler'in durumu ve son okuması, okuma sıklığı, akademik takvim, Notion salt arşiv); bildirimler (beş olay ayrı ayrı açılıp kapanır; "Yeni dosya" satırı bildirim göndermez, kural 17); hazırlık dokümanları (kendiliğinden üretim açık ya da kapalı, üretim zamanları, ders projelerinin bağlantıları); çalışma (yöntemler, pomodoro süreleri, akışta mola hatırlatması, hazırlık süresi); klasör (yer, tek yön eşitleme). Çekirdeğin Ayarlar'ında ayrıca modül başına bildirim aç/kapa vardır (karar 8); o kapalıyken Okul'un beş olayı da gitmez.

**Çalışma yöntemleri (79):** iş türü başına yöntem: konu okuma → pomodoro; soru çözme → soru sayacı; sınav öncesi tekrar → tek blok; kodlama ödevi ve proje kodu → akış; yazılı ödev ve rapor → pomodoro.

**Pomodoro süreleri (80):** odak, kısa mola ve uzun mola (varsayılan 25, 5 ve 15 dk). Akışta mola hatırlatması varsayılan 90 dakikadır (78).

### 8.8 Pano

Panoda (1440×900) aynı içerik iki sütunda durur: solda sahne ya da liste, sağda bölümler ve ayrıntı. Sahnenin pano kareleri her senaryoda telefon karelerinin altındadır; senaryo dışındaki pano kareleri 67, 68 ve 81–83'tür.

### 8.9 Kare dizini

| Kareler | İçerik |
| --- | --- |
| 1 | Okul'un verdiği işler ve hangi sahneyi açtıkları |
| 2–9 telefon, 10–17 pano | Senaryo 1 · Quiz hazırlığı: 8 saatlik işin 2 saatlik oturumu (oturum 2 / 4) |
| 18–24 telefon, 25–31 pano | Senaryo 2 · Midterm hazırlığı: 16 saatlik işin 6. oturumu |
| 32–38 telefon, 39–45 pano | Senaryo 3 · Ödev: iki oturumun birincisi (90 dk) |
| 46–52 telefon, 53–59 pano | Senaryo 4 · Proje: Proposal alt işinin 2. ve son oturumu, teslimle biter |
| 60–68 | Senaryolarda olmayan sahneler: proje akışı (iki alt iş aynı oturumda), sunum provası, tek blok tekrar, doküman ürettirme, takım toplantısı, derste, sınav günü; pano: doküman ürettirme, ders bitti ve devam sorusu |
| 69–80 | Modülün içi, telefon: ana sayfa, ders seçimi, ders, devam, dosyalar, dosya ayrıntısı, sorumluluk ayrıntısı, sınav ayrıntısı, bildirimler, ayarlar, yöntemler, süreler |
| 81–83 | Modülün içi, pano: ana sayfa, ders, sınav ayrıntısı |
| 84–86 | Uçtan uca: klasör, Ninova akışı, doküman akışı |
| 87–90 | Oturum başında "Kaldığın yer": hazırlık (telefon 87, pano 88), ödev (telefon 89, pano 90) |

Karelerdeki notlar, saatler, bölüm adları, soru sayıları, dosya adları ve duyuru metinleri örnektir.

**Karelerin durumu (17 Kas 2026): onaylı ve depoda.** Kullanıcı 1–86'yı tasarım oturumunda gezdi, düzeltmeleri işlendi ve son taramadan sonra onayladı; 76 ve 83'ün düzeltilmiş hali (gelecek oturumlarda gün yerine hafta; çekirdek kararı 14) ve yeni 87–90 ("Kaldığın yer") 17 Kas'ta onaylandı. 90 kare `docs/tasarim/kareler/okul/` altına kopyalandı (dizin: `DIZIN.md`); ekran dokümanları `docs/tasarim/ekranlar/okul-sahneler.md` ve `okul-sayfalar.md`. Çizilmeyen haller o iki dosyanın sonunda listeli. Web push çalışmazsa yedeğin görünüşü (Bugün'ün üstünde tek satır) çekirdeğin karesidir ve çizilmedi.

## 9. Mod davranışı

Çekirdekte hayat modu yoktur (Ç4a). Okul mod önermez ve moda göre davranış değiştirmez; eski taslaktaki "yoğun hafta" önerisi (`okul.heavy_week`) kalkmıştır. Yoğunluk yalnızca planlayıcının gördüğü yük olarak vardır: sınav ve teslimlerin süreleri, yer tutucular dahil, aylık ve haftalık plana girer. Bu başlık modül şablonundan ve oturum yönteminden kalkıyor (karar 3); burada numaralar kaymasın diye duruyor, onayda kaldırılır.

## 10. Haftalık rapor ve öğrenme

Çekirdek her modülden haftalık rapor ister (`weeklyReport`: sayılar ve en çok iki öneri). Raporu Hafta ekranındaki haftalık özet ve alan sayfasındaki modül paneli (ilk üç sayı) kullanır. Kullanıcının kararı (23 Kas 2026):

**Sayılar** (sırasıyla; ilk üçü alan sayfasında görünür):
1. Önümüzdeki 14 günün sınav ve teslimleri ("3 sınav · 2 teslim"; tahmini tarihliler sayıya dahil).
2. Dokümanı bekleyen sınav sayısı (doküman günü gelmiş ya da 14 gün içinde gelecek, doküman hazır değil).
3. O hafta açıklanan ya da değişen tarih sayısı.

**Öneriler** (en çok iki; yalnızca yapılacak somut bir şey varsa, yoksa hiç). Birden çok aday varsa bu sırayla seçilir:
1. Devamsızlık hakkı azalan ders ("Deep Learning: 1 hakkın kaldı"); yalnızca devam şartı olan derste ve kalan hak 1 ya da 0 iken.
2. Sıkışan hafta ("7–13 Ara sıkışık: Quiz 3 hazırlığı öne alınabilir").
3. Dosyası hâlâ gelmeyen konu ("Robotics Quiz 3: hız kinematiğinin dosyası yok").
4. Onay bekleyen tahmin kuralı.

**Rapora girmeyenler:** çalışılan toplam süre, oturum ve tur sayısı, hedefe uyum yüzdesi, övgü ya da eleştiri cümlesi. Tarih değişikliği ve teslim uyarısı zaten bildirimle gelir; rapor onları yinelemez, yalnızca sayar.

Rapor için ayrı ekran ya da kare yoktur; çekirdeğin ekranlarında görünür. Okul'un sayfa başında durum şeridi kapalıdır (çekirdek kararı 5); raporun sayılarının orada da gösterilmemesi gerekir (çekirdek kararında açık yazmıyor; `okul-cekirdek-notlari.md`'ye not düşüldü).

Öğrenme sessizdir:
- **Ders çarpanı:** biten her hazırlık ve ödevde gerçekleşen ÷ planlanan; sonraki süre tahminlerine uygulanır.
- **Tahmin kuralı önerisi:** aynı örüntü en az iki kez görülünce.

## 11. Açık sorular

### Denenecekler (bilgisayarda, kullanıcı giriş yaptıktan sonra, salt okuma)

1. Ninova'da kalanlar: syllabus'tan haftalık konu sırasının çıkarılması, art arda çok dosya indirme, oturumun en çok ne kadar açık kaldığı, otomatik erişim kuralı (`robots.txt` serbest; genel kullanım kuralları okunmadı).
2. Kepler'de kalanlar: final takviminin yapısı (henüz boş), toplayıcının kendi başına giriş yapması (şifrenin bilgisayarda saklanması dahil).
3. Syllabus'un YZV 411E ve YZV 448E'deki yeri (kökte yok).
4. Bilgisayarın zamanlanmış görevle uykudan uyanması.
5. Zamanlanmış Claude görevinin ders klasörünü okuyup `Hazırlık/` içine yazabilmesi ve iki dokümanın yeterliliği.
6. Dokümandan çalışma planının çıkarılması (bölüm, dakika, soru sayısı, sayfa).
7. Telefon bildirimi: web push denemesi çekirdek paket B'nin ilk adımıdır (karar 8); çalışmazsa yedek, Bugün'ün üstünde tek satır.
8. ~~Ninova'daki toplam dosya boyutu~~ Ölçüldü: ~266 MB (8. hafta), 64 MB'ı eski yıl klasörü; dönem sonu için kaba öngörü iki katı. Çekirdek kararı 1'in sınırı bu sayıyla yazılır.
9. Bilgisayardaki yerel dosyayı panodan doğrudan açmak.

### Kullanıcıdan beklenenler

Hiçbiri Adım 1'i tutmaz. 1, 2 ve 4 Adım 3'ten önce (doküman üretimi), 6 ve 7 Adım 2'den önce (Kepler okuması) gerekir.

1. "26-27 güz dönemi" klasörünün yolu ve içindeki dosyalara ne olacağı.
2. Altı dersin Claude projesi bağlantıları (yedek yol için).
3. ~~Derslerin bitiş saatleri~~ Ninova ve Kepler'den okunuyor.
4. Her ders için `SHERPA-TALIMAT.md` metni (dersin Claude projesindeki talimattan).
5. ~~Karelerin tuvalde onayı~~ Onaylandı (17 Kas).
6. Üç derste derslik Ninova ile Kepler'de farklı (Derin Öğrenme, Robotik, Veri Görselleştirme): hangisi doğru.
7. Yoklamada "katılmadı" görünen haftalar: gerçekten gelmedin mi, yoksa yoklama mı alınmadı (Derin Öğrenme 1–3 ve 6. hafta).

### Karar bekleyenler

1. Çekirdek kararları alındı (16 Kas). Denemelerden sonra 1, 2 ve 8 yeniden gözden geçirilir (ilerleme sohbeti). Sayfa başındaki durum cümlesinin bütün modüllerde kalkıp kalkmayacağı (karar 5) ilerleme sohbetinde açık; Okul'da kapalıdır.
2. ~~Haftalık rapora gidenler~~ Kararlaştırıldı (23 Kas; bölüm 10).
3. Bulut saklama sınırı: boyut ölçüldü (~266 MB, 8. hafta); sınırı ilerleme sohbeti yazar.

## Kapsam dışı bırakılanlar

- Bütünleme ve mazeret sınavları, dersi bırakma, dönem geçişi sihirbazı (elle).
- Kendi ders notları için klasör ve not alma.
- Ödev içinde adım; alt iş içinde adım.
- Çalışma istatistiği, oturum özeti, seri, rozet.
- Sahnede yöntem ve süre değiştirme.
- Dosya onay kuyruğu; dosya silme; klasörden Ninova'ya yazma.
- Yeni dosya ve hazır doküman için bildirim.
- Hocanın dosyası olmayan konunun dokümanı.

## Simülasyon

Karelerdeki dört senaryo ve bir kötü hafta. Dersler ve tarihler Notion'dan; süreler, saatler ve bölüm adları örnektir.

**1. Quiz (Robotics, Quiz 3).** Quiz syllabus'tan bilinir, tarihi tahminidir; yer tutucu 8 saat plana girer. Dört hafta kala kapsamın bir iki dosyası henüz Ninova'da yoktur; yer tutucu yine de yükü gösterir. Duyuru gelir: tarih ve saat kesinleşir, bildirim gider. Bir hafta kala dokümanlar üretilir; plan dört oturuma bölünür. Çarşamba 2 Aralık 14:10: Bugün kartı "Quiz 3 hazırlığı · Jacobian, hız kinematiği · 2 sa". Başla → iki okuma bölümü pomodoroyla, sonra altı soru soru sayacıyla; bir soruda "Takıldım" → soru son oturuma taşınır. Bir bölümde süre dolar → "+5 dk". "Oturum bitti." → Bugün. Sınav ayrıntısında "4 sa / 8 sa".

**2. Midterm (16 saat, 6. oturum).** İki hafta kala ilk sürüm syllabus sırasıyla üretilir. Bir hafta kala duyuru kapsamı daraltır → doküman güncellenir, eskisi `eski/` içine alınır, çalışılmış bölümler durur, iki bölüm "değişti" olur ve plana eklenir. 6. oturum karışıktır: önce sorular (biri takılır, sona kalır), bölüm arası mola, sonra güncellemeyle eklenen bölümün okuması. Son oturum tek blok tekrardır ve takılınan soruları içerir.

**3. Ödev (Algoritma, Assignment 2).** Ninova'da açılır → dosyası klasöre iner, bildirim gider, süre kestirilir (3 saat, iki oturum). Pazar 22 Kasım 14:10: akış sahnesi, ilk oturumda not yok. 90 dakika dolunca "Süre doldu." → Bitti. Çıkarken "Nerede kaldın?" → tek cümle. İkinci oturum o notla açılır; sonunda teslim kontrol listesi; "yüklendi" sonraki Ninova okumasında doğrulanır.

**4. Proje (Robotics, Proposal).** Proje alt işlere bölünmüştür; Proposal'ın iki oturumu vardır. Perşembe 3 Aralık: pomodoro, kutuda yalnızca "Proposal" (adım yok). Süre dolunca üç seçenek; "Bitti" → teslim adımları açılır → Ninova'ya yüklenir. Sonraki alt iş henüz açıklanmamıştır, yer tutucudur.

**5. Kötü hafta.** Aynı haftaya bir midterm, bir quiz ve bir teslim düşer. Yer tutucular haftalar öncesinden plandadır; planlayıcı önce başka işleri öne çeker, yetmezse quiz dokümanının üretimini öne alır. Teslim günü bilgisayar kapalıdır: okuma gelmez → bir kez bildirim. Teslime 3 saat kala yükleme görünmez → bildirim; kullanıcı yükler ve "Yükledim" der. Quiz konularından birinin dosyası hiç gelmez → iki gün kala "dosyası yok", süresi plandan düşer.

**Sınanan kenar durumlar:** kullanıcının girdiği tarihle duyuru çelişir (Sherpa sorar); tahmini tarihli quiz kesinleşince bir gün öne gelir (plan yeniden kurulur, doküman günü geçtiyse üretim hemen başlar); kendiliğinden üretim bir gün içinde olmaz (elle yol Bugün'e düşer); Kepler'in yoklaması kullanıcının işaretiyle ayrışır (Devam'da görünür, kullanıcı karar verir); hoca dosyayı Ninova'da değiştirir (eskisi kalır, doküman güncellenir).

## Kurulum adımları ve kabul ölçütleri

Modül bütün olarak tasarlandı ve tam kurulur; adımlar teknik bağımlılık ve doğrulama içindir, aralarında kullanım için beklenmez (ilke 9).

Her adım bir çekirdek paketine dayanır; paket adımdan hemen önce kurulur (`okul-cekirdek-notlari.md`, "Kararlar"). Sıra: Rutin 2 → çekirdek A → Adım 1 → çekirdek B → Adım 2 → çekirdek C → Adım 3.

| Adım | Çekirdek paketi | Paketin maddeleri |
| --- | --- | --- |
| 1 · Temel | **A** | 3 mod temizliği · 4 modül sayfası iskeleti · 5 sayfa başı · 7 şerit ve sayılan dakika · 9 yer tutucu süre · 10 pomodoro, akış, kontrol listesi yerleşimleri ve `ui.blockView` · 11 `beforeExit` |
| 2 · Veri bağlantıları | **B** | 1 dosya kovası · 2 yükleme bağlantısı ve son başarılı okuma · 6 `due_estimated` · 8 `notify` (web push denemesiyle başlar) |
| 3 · Hazırlık zinciri ve otomasyon | **C** | 12 molaları içinde 120 dk · 13 `meta`'nın oturuma ve sahneye taşınması · 14 modülün böldüğü oturum listesi · 10 soru sayacı ve tek blok yerleşimleri |

Yerleşimlerden yalnızca onaylı karesi olan kurulur (karar 10). Bu yüzden paket A'dan önce pomodoro, akış, kontrol listesi ve sabit blok karelerinin; paket C'den önce soru sayacı ve tek blok karelerinin onaylanıp depoya kopyalanmış olması gerekir.

### Adım 1 · Temel

**Dayandığı çekirdek paketi: A.**

İstem: `prompts/okul-adim-1.md` (23 Kas 2026). Kapsamın ayrıntısı ve bu adım için verilen teknik kararlar oradadır: tablo adları `okul_` önekiyle; sınav hazırlığı "Dokümanım hazır" işaretlenene kadar yalnızca yer tutucu yüktür, işaretlenince bölümsüz pomodoro oturumlarıyla açılır; sınavın kendisi ve dersler sabit bloktur; teslim ayrı küçük kalemdir; takım toplantısı bu adımdadır.

Tablolar; Notion aktarımı; ana sayfa, ders sayfası, ayrıntı sayfaları, devam; elle giriş (bölüm 7); ders blokları ve devam sorusu; Derste görünümü; sınav, ödev ve proje iş kalemleri (sınav hazırlığı yer tutucu süreyle); ödev ve proje sahneleri (akış, pomodoro), "kaldığın yer" notu, süre dolunca kartı; teslim kontrol listesi ("Yükledim" elle); Bugün kartı; ayarlar (yöntemler, süreler).

Kabul:
- Notion'daki 6 ders, 59 değerlendirme ve 86 oturum aktarılmış; sayılar tutuyor; tarihsiz 21 değerlendirme "Tahmin edilemeyen"de.
- Ana sayfa ve altı dersin sayfası karelerle aynı; sayfa başında durum cümlesi yok.
- Bir ödev Bugün'de üç öğeli kartla görünüyor; Başla akış sahnesini açıyor; şeritte "geçen / ayrılan" yazıyor; çıkarken not soruluyor ve sonraki oturumda görünüyor.
- Bir proje alt işi pomodoroyla açılıyor, kutuda adım yok; son oturumda "Bugünlük yeter" var.
- Devam sorusu yalnızca devam şartı olan derste çıkıyor.
- Sınavlar plana yer tutucu süreyle giriyor ve "Neden?"de gerekçe yazıyor; işaretlenmemiş sınavda çalışma oturumu açılmıyor.
- "Dokümanım hazır" işaretlenince hazırlık bölümsüz pomodoro oturumlarıyla açılıyor; işaret kaldırılınca açık oturumlar geri çekiliyor, biten oturumlar ve ilerleme duruyor.

### Adım 2 · Veri bağlantıları

**Dayandığı çekirdek paketi: B.**

Toplayıcı (Ninova, Kepler); dosyaların indirilmesi, etiketlenmesi, klasöre konması, bulut kopyası; duyurulardan tarih ve kapsam; syllabus; akademik takvim; tahmini tarihler; notlar ve yoklama; teslimin kendiliğinden doğrulanması; bildirimler (ya da yedeği); okuma kaçınca uyarı ve kalkan.

Kabul:
- Toplayıcı bir gün içinde dört kez okumuş; `school_sync_runs` kayıtları var; gece okuma yok.
- Ninova'ya yeni konan dosya bir sonraki okumada doğru derste, etiketli olarak klasörde; telefonda açılıyor.
- Kullanıcının taşıdığı dosya sonraki okumada yerinde kalıyor.
- Tarih içeren bir duyuru tarihi değiştiriyor, kayıtta cümlesi duruyor, bildirim gidiyor (web push çalışmıyorsa Bugün'ün üstünde tek satır çıkıyor); kullanıcının girdiği tarih ezilmiyor.
- Tarihsiz değerlendirmelerden dayanağı olanlar "tahmini" tarihle listede; final, final döneminin içinde.
- Bilgisayar kapalıyken ilk kaçan okumada bir bildirim gidiyor, ikincide gitmiyor.
- Kepler'den gelen bir not sınav ayrıntısında; bildirimde sayı yok.

### Adım 3 · Hazırlık zinciri ve otomasyon

**Dayandığı çekirdek paketi: C.**

Kapsam kuralı; doküman günü ve üretimin iki yolu; dokümandan plan çıkarma; modülün böldüğü oturum listesi; karışık oturumlar ve soru sayacı, tek blok tekrar; hazırlıkta "kaldığın yer"; sınav ayrıntısında bütün oturumlar; güncelleme ve `eski/`; dosyası olmayan konu; tahmin kuralları; sıkışan haftada öne alma; sınav günü görünümü; ders çarpanı.

Kabul:
- Bir quiz için doküman günü geldiğinde iki PDF `Hazırlık/<sınav>/` içinde; yer tutucunun yerini dokümanın planı almış; sınav ayrıntısında bütün oturumlar bölümleri ve dakikasıyla görünüyor; planlanmış oturumda gün, ötekilerde hafta yazıyor.
- Sınav oturumu 2 saat olarak tek parça yerleşiyor; ödev oturumu 90 dakikayı aşmıyor.
- Kendiliğinden yol kapalıyken Bugün'e "Dokümanları ürettir" düşüyor; PDF'ler klasöre konunca iş kendiliğinden kapanıyor.
- Adım 1'de "Dokümanım hazır" diye işaretlenmiş sınavda PDF'ler klasöre konunca kalan süre bölümlere geçiyor; biten oturumlar ve ilerleme korunuyor.
- Bir oturumda okuma bölümünden soru bölümüne geçince ortadaki sayaç değişiyor; "Takıldım" denen soru son oturumda.
- Kapsamı değişen midtermin dokümanı güncelleniyor; eski sürüm `eski/` içinde; çalışılmış bölümler çalışılmış.
- Dosyası olmayan konu dokümanda yok, ayrıntıda "dosyası bekleniyor"; iki gün kala süresi düşüyor.
- Önerilen bir tahmin kuralı onaylanmadan tarih üretmiyor.

## Çekirdek için notlar

On dört maddenin hepsi 16 Kasım 2026'da ilerleme sohbetinde kabul edildi, bazıları küçültülerek; gerekçeler ve kararlar `docs/moduller/okul-cekirdek-notlari.md` dosyasındadır. Bu doküman kararlara göre düzeltildi; çekirdeği değiştirmez. Okul'u doğrudan etkileyen sınırlar:

- Oturumun bölümleri zarfın `meta` alanında taşınır; ayrı `payload` yoktur (13).
- Yerleşimlerden yalnızca onaylı karesi olan kurulur; ders ve sınav günü oturum değil, blok görünümüdür (10).
- Bildirim web push'a bağlıdır; çalışmazsa yedek Bugün'ün üstünde tek satırdır (8).
- Oturum en çok 120 dakikadır (12).
- Gelecek oturumların günü hafta düzeyindedir (14).
- Sayfa başında durum cümlesi ve etiket Okul'da kapalıdır (5).
- Paket A'nın istemini ilerleme sohbeti yazar; Okul'un adım istemlerini bu tasarım sohbeti yazar.
