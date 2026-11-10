# Modül: Okul

Durum: **taslak.** Ayrı bir tasarım oturumunda ayrıntılanıp onaylanacak; o zamana kadar kodlanmaz. Kurulum adımları ve taslak kabul ölçütleri dokümanın sonundadır.

## 1. Kimlik

- **Tür:** Dönemlik. Her dönem ayrı bir dönem kaydıdır; modül aynı kalır.
- **Amaç:** Dönemin bütün sınav, teslim, proje ve devam bilgisini tek ekranda göstermek ve hazırlık işlerini zamanında günün planına sokmak.
- **Başarı ölçütü:** Hiçbir sınav ya da teslim sürpriz olmaz; kullanıcı Notion'daki dönem sayfasını açmaz.

### Bu modülün yapmadığı

Ders içeriği, çalışma dokümanı ve proje çalışması Sherpa'da yapılmaz. Kullanıcı her ders için bir Claude projesi kullanır: dersin yerel klasörü projeye bağlıdır, hazırlık dokümanları ve proje çalışmaları o projedeki sohbetlerde üretilir. Bu yapı aynen korunur. Sherpa yalnızca **ne zaman ne yapılacağını** bilir ve doğru projeye tek dokunuşla götürür.

## 2. Yaşam döngüsü

- Dönem başında: dönem kaydı, dersler, haftalık ders programı ve bilinen değerlendirmeler girilir (ya da aktarılır).
- Dönem içinde: tarihler netleşir, notlar girilir, devam işaretlenir.
- Dönem sonunda: dönem arşivlenir (açık işler `dropped`, blok serileri kapanır). Veriler durur; yeni dönem boş başlar.
- Dönem haftası: `W1` dönemin başladığı haftadır ve tarihten hesaplanır. 26-27 Güz için W1 = 28 Eylül 2026 haftası, W8 ara tatil.

## 3. Veri modeli

Notion'daki dört veritabanının karşılığıdır (eşleme: `docs/08-notion-aktarim.md`).

### school_terms
```
name text                     -- '26-27 Güz'
starts_on date                -- W1'in pazartesisi
ends_on date
break_weeks int[]             -- [8]
status enum(active, archived)
```

### school_courses
```
term_id -> school_terms
code text                     -- 'BBF301E'
name text
color text
weekday smallint null, start_time time null, end_time time null
schedule_text text null       -- saat ayrıştırılamazsa ham metin
location enum(campus, online) default campus
claude_project_url text null  -- dersin Claude projesi
local_folder text null        -- dersin yerel klasör yolu
notion_page_url text null     -- ders içerik sayfası (Notion'da kalır)
grading_note text null        -- notlandırma açıklaması
vf_conditions text null       -- VF şartları (metin)
absence_limit int null        -- izin verilen devamsızlık sayısı
last_checked_at timestamptz null   -- Ninova'da en son ne zaman kontrol edildi
```

### school_assessments
Her quiz, ödev, sınav, sunum, proje ve proje adımı. Tarih ve ağırlığın tek kaynağıdır.
```
course_id -> school_courses
parent_id uuid null -> school_assessments   -- proje adımı → proje
title text
kind enum(quiz, midterm, final, homework, project, project_step, presentation)
date date null, time time null
date_status enum(exact, estimated, unknown)
time_note text null           -- 'öğleden sonra (ders 14:30)'
weight numeric null           -- yüzde
score numeric null            -- 100 üzerinden
excluded boolean default false   -- hesaba katılmaz
scope text null               -- kapsam
source text null              -- bilginin kaynağı
vf_condition text null
prep_outputs text[] default '{}' -- 'topic_pdf', 'practice_pdf', 'summary_pdf'
status enum(todo, preparing, done) default todo
notes text null
external_id text null unique  -- Notion sayfa adresi (aktarım için)
```

### school_sessions
Her ders oturumu.
```
course_id -> school_courses
date date
course_week text null         -- dersin kendi hafta numarası
topic text null
kind enum(lecture, exam, presentation, holiday)
attendance enum(attended, missed) null   -- null = işaretlenmedi
notes text null
external_id text null unique
```

### Çekirdeğe bağlantı

| Okul kaydı | Çekirdek kaydı |
| --- | --- |
| Dersin haftalık saati | `block_series` (kind `class`), `source_type = 'okul.course'` |
| Ders oturumu | `blocks` içindeki somut blok; `school_sessions` ile aynı güne bağlı |
| Değerlendirme (sınav, quiz) | Hazırlık iş kalemi (zarf); sınavın kendisi oturum bloğudur |
| Değerlendirme (ödev, sunum, proje adımı) | Son tarihli iş kalemi (zarf) |
| Proje | Üst iş kalemi; adımları alt kalemler |

Okul zarflarında `meta`:
```json
{ "course_code": "BBF301E", "item_type": "prep | submit | material | follow_up",
  "assessment_kind": "midterm", "weight": 30, "scope": "Hafta 1–6",
  "prep_outputs": ["topic_pdf", "summary_pdf"], "claude_command": "..." }
```

### school_prep_docs
Hazırlık dokümanları ve çalışma planları.
```
assessment_id -> school_assessments
output text                   -- topic_pdf, practice_pdf, summary_pdf
status enum(planned, generating, ready, studied)
file_path text null           -- yerel klasördeki dosya
parts jsonb null              -- [{ title, kind: read|practice|review, minutes }]
total_minutes int null
generated_by enum(manual, auto) null
generated_at timestamptz null
unique (assessment_id, output)
```

### Türetilen değerler

- **Ağırlıklı puan:** `score × weight ÷ 100` (`excluded` olanlar hariç)
- **Anlık toplam:** Dersin ağırlıklı puanlarının toplamı
- **Açıklanan ağırlık:** Notu girilmiş değerlendirmelerin ağırlık toplamı; kalan ağırlık = 100 − açıklanan
- **Devam:** Yapılan oturum (bugüne kadarki `lecture`), katıldığım, kaçırdığım, işaretlenmemiş; kalan devamsızlık = `absence_limit − kaçırdığım`
- **Dönem haftası:** Tarihten

## 4. Veri kaynakları ve otomasyon

| Veri | Kaynak | Seviye |
| --- | --- | --- |
| Mevcut dönemin bütün verisi | Notion'dan tek seferlik aktarım | Otomatik (betik) |
| Ders programı | Dönem başında ders kaydına girilir; bloklar kendiliğinden üretilir | Otomatik |
| Yeni değerlendirme, tarih ve ağırlık değişikliği | Ninova duyurusu → hızlı giriş ya da ders sayfası | Elle; köprüden (Ç5) sonra ders projesindeki Claude sohbetinden de yazılabilir |
| Devam | Ders bloğu bitince tek soru | Elle, tek dokunuş |
| Teslim durumu | Son tarih geçince tek soru | Elle, tek dokunuş |
| Not | Açıklanınca sayı girişi | Elle |
| Hazırlık işleri | Değerlendirmeden kurallarla üretilir | Otomatik |
| Ders dosyaları | Kullanıcı Ninova'dan yerel klasöre indirir | Sherpa dışında; haftalık kontrol ritmi hatırlatır |

Adım 1'de Ninova bağlantısı yoktur; modülün en zayıf noktası tarihsiz kalemlerdir ve "Tarih bekleyen" görünümü ile haftalık kontrol ritmi bunun içindir. Okul adım 2'de Ninova toplayıcısı eklenir: ödevler ve teslim durumu otomatik gelir, duyurulardan tarih önerileri çıkar, yeni dosyalar yerel klasöre iner (bkz. `okul-ninova.md`).

## 5. Kurallar

Değerler modül ayarlarından değişir; aşağıdakiler varsayılandır.

1. **Hazırlık kalemi.** `prep_outputs` listesi dolu her değerlendirme için tek bir iş zarfı teklif edilir (`key = assessment:<id>:prep`).
   - Modülün doldurdukları: başlık, son tarih (sınav anı, kesin), önem (ağırlık %20 ve üzeri → 4, %10–19 → 3, altı → 2), enerji `deep`, bağlam `desk`, `meta` (ders, tür, ağırlık, kapsam, istenen çıktılar).
   - Efor boş bırakılır; yapay zeka tahmin eder. Sınırlar (ayarlanabilir): quiz 30–180 dk, midterm ve final 180–900 dk.
   - `sizingHints`: "Efor kapsamdaki ders haftası sayısıyla ve ağırlıkla artar. Aynı dersin önceki hazırlıklarının gerçek süresine bak. Quiz için tek oturum yetebilir."
   - Kalemin iki alt adımı vardır: önce her çıktı için "dokümanı üret" (10 dk, hafif), sonra "çalış" oturumları (`depends_on` ile dokümana bağlı).
   - Efor iki aşamalıdır: önce yapay zekanın kaba tahmini; doküman üretilince dokümanın kendi çalışma planı onun yerini alır (aşağıda).
2. **Teslim kalemi.** Ödev, sunum ve proje adımı için son tarihli bir iş zarfı teklif edilir; eforu yapay zeka tahmin eder. Proje türü üst kalemdir; adımları alt kalemlerdir.
3. **Tarih değişirse** türetilen işlerin tarihleri yeniden hesaplanır; kullanıcının elle değiştirdiği iş ezilmez.
4. **Tarih durumu.** `exact`: normal planlanır. `estimated`: planlanır ama "tahmini" etiketi taşır. `unknown`: planlanmaz, "Tarih bekleyen" listesinde durur.
5. **Devam sorusu.** Ders bloğu bitince: "Derse girdin mi?" (Girdim / Girmedim / Yapılmadı). "Yapılmadı" oturumu `holiday` yapar.
6. **Teslim sorusu.** Son tarih geçince: "Teslim ettin mi?" ya da sınav için "Girdin mi?". Evet → `status = done`.
7. **Not sorusu.** Tamamlanan değerlendirmenin notu 7 gün sonra hâlâ boşsa haftalık bakışta sorulur; gün içinde sorulmaz.
8. **Ninova kontrolü.** Haftalık ritim, 10 dk. İş açılınca derslerin listesi ve her birinin "son kontrol" tarihi görünür; her ders tek dokunuşla "kontrol edildi" işaretlenir.
9. **Yoğun hafta sinyali.** Aynı hafta içinde toplam ağırlığı %40'ı geçen değerlendirme varsa `okul.heavy_week` olayı yayınlanır; Hafta ekranı Yoğun modu önerir.

### Hazırlık dokümanı ve çalışma planı

Dokümanlar ders Claude projelerinde üretilir. Her doküman kendi çalışma planını taşır: bölümler ve her bölümün tahmini süresi. Sherpa hazırlık eforunu buradan alır; böylece plan, soyut bir tahmine değil çalışılacak gerçek malzemeye dayanır.

**Ders projelerinin talimatına eklenecek metin** (bütün derslerde aynı):

~~~
Ürettiğin her hazırlık dokümanından sonra, sohbette şu bloğu ver:

```sherpa
{ "course": "<ders kodu>", "assessment": "<kalem adı>",
  "output": "topic_pdf | practice_pdf | summary_pdf",
  "parts": [ { "title": "<bölüm başlığı>", "kind": "read | practice | review", "minutes": <tahmini dakika> } ],
  "total_minutes": <toplam> }
```

Süreleri bu dokümanı ilk kez çalışan biri için tahmin et: okuma bölümlerinde uzunluğa
ve zorluğa, alıştırma bölümlerinde soru sayısına ve türüne göre. 60 dakikayı geçen
bölümü ikiye böl.
~~~

**Plan Sherpa'ya üç yoldan ulaşır:**

| Yol | Nasıl | Ne zaman |
| --- | --- | --- |
| Yapıştır | Blok hızlı girişe yapıştırılır. Çekirdek `sherpa` bloğunu doğrudan tanır; yapay zeka çağrısı gerekmez | Adım 1 |
| Köprü | Ders sohbeti, doküman bitince Sherpa'nın `set_study_plan` aracını kendisi çağırır | Ç5'ten sonra |
| Otomatik üretim | Zamanlanmış bir Claude görevi dokümanı kendisi üretir ve planı yazar | Adım 3 |

**Plan gelince:**
- `school_prep_docs` kaydı `ready` olur; "dokümanı üret" adımı tamamlanır.
- Kalemin toplam eforu dokümanların `total_minutes` toplamı olur (kaynak: `document`); yapay zekanın kaba tahmini yerini bırakır.
- Bölümler oturum işlerine çevrilir: ardışık kısa bölümler `session_minutes` dolana kadar aynı oturumda birleşir; oturum başlığı bölüm adlarını taşır.
- Şimdi kartı çalışılacak bölümü ve dosyayı gösterir.

**Kalibrasyon.** Bitirilen oturumların gerçek süresi ders başına bir çarpan üretir (`okul:prep:<ders kodu>`). Sonraki dokümanların süreleri bu çarpanla düzeltilir; kullanıcı bir derste dokümanların öngördüğünden sürekli uzun çalışıyorsa plan bunu kendiliğinden hesaba katar.

**Otomatik üretim (Okul adım 3, denenmedi).**
- Tetik: "dokümanı üret" adımının günü geldi ve kapsamdaki ders dosyaları yerel klasörde (Ninova toplayıcısı indirdi).
- Yürütme: kullanıcının bilgisayarında, Claude aboneliğiyle çalışan zamanlanmış bir görev. Sherpa'dan bekleyen üretimleri okur (köprü), dersin klasörünü ve klasördeki talimat dosyasını okur, dokümanı üretip klasöre kaydeder, çalışma planını Sherpa'ya yazar.
- Ön koşul: dersin talimatı klasörde bir dosyada durur (`SHERPA-TALIMAT.md`); hem Claude projesi hem otomasyon aynı dosyayı kullanır.
- Sonuç kullanıcıya tek satırla bildirilir ("Quiz 3 konu dokümanı hazır: 4 bölüm, 95 dk"); kullanıcı gözden geçirir.
- Yedek her zaman durur: Komutu kopyala ve Projeyi aç.
- API üzerinden üretim önerilmez: ders materyali her seferinde gönderilir, maliyet aboneliğe göre yüksektir ve kullanıcının proje düzeni dışında kalır.

### Olaylar

- Yayınlar: `okul.assessment_dated`, `okul.assessment_done`, `okul.grade_entered`, `okul.attendance_marked`, `okul.heavy_week`
- Dinler: yok (v1)

## 6. Ürettiği işler

| Tür | Çekirdek kaydı | Enerji | Bağlam |
| --- | --- | --- | --- |
| Hazırlık | İş kalemi; alt adımlar: dokümanı üret, çalış | deep | desk |
| Teslim | İş kalemi | deep | desk |
| Proje adımı | Alt iş kalemi | deep | desk |
| Takip (grup arkadaşından dönüş vb.) | `tasks`, `waiting` durumu kullanılabilir | light | any |
| Ninova kontrolü | `rhythms` (haftada 1) | light | desk |
| Ders | `block_series` + `blocks` | — | campus ya da online |
| Devam, teslim, not | `prompts` | — | — |

## 7. Veri girişi (`intake`)

| Anahtar | Alanlar | Örnek |
| --- | --- | --- |
| `assessment` | ders, başlık, tür, tarih, tarih durumu, ağırlık, kapsam | "DL quiz 2 perşembe %5" |
| `date_update` | değerlendirme, yeni tarih | "Robotics quiz 3 26 Kasım'a alındı" |
| `grade` | değerlendirme, not | "BBF midterm 72" |
| `task` | ders, başlık, süre, son tarih | "MLOps sunum slaytları cuma" |
| `attendance` | oturum, katıldım/katılmadım | geçmiş bir oturumu düzeltmek için |

## 8. Gösterim

### Çip
Önümüzdeki 7 günün en yakın değerlendirmesi: "Per · BBF301E Midterm". Sağlık:
- `attention`: 3 gün içinde sınav var ve hazırlık işi açık; ya da tarihsiz kalem sayısı 5'in üzerinde
- `behind`: son tarihi bugün olan teslim açık
- aksi halde `ok`

### Şimdi kartı
- **Dokümanı üret adımı:** Ders, değerlendirme, kapsam, üretilecek çıktı. İki düğme: **Komutu kopyala** (`claude_command`) ve **Projeyi aç** (`claude_project_url`). Kullanıcı dokümanı ders projesinde üretir ve `sherpa` bloğunu yapıştırır (köprü varsa bu adım kendiliğinden olur).
- **Çalışma oturumu:** Dokümanın o oturuma düşen bölümleri, toplam süre, dosyaya bağlantı.
- **Ders bloğu:** Ders adı, oturumun konusu, bitiş saati.

Komut şablonları modül ayarlarında çıktı türü başına tutulur ve yer tutucular içerir: `{ders}`, `{kalem}`, `{kapsam}`, `{tarih}`. Aktarılan işlerdeki mevcut komutlar korunur.

### Sayfa (`/m/okul`)

| Bölge | İçerik |
| --- | --- |
| Durum şeridi | "Bu hafta 2 quiz, 1 midterm, 1 sunum · 32 kalem tarih bekliyor", dönem haftası |
| Yaklaşanlar | Önümüzdeki 14 günün değerlendirmeleri: tarih, ders, başlık, ağırlık, hazırlık durumu |
| Gövde | Aşağıdaki sekmeler |
| Geçmiş ve trend | Ders başına anlık toplamın zaman içindeki gidişatı |
| Giriş ve ayarlar | Değerlendirme ekle, not gir, hazırlık kuralları, komut şablonları |

Sekmeler:

1. **Dersler.** Ders kartları: kod, ad, renk; sıradaki değerlendirme; anlık toplam çubuğu (kazanılan / açıklanan / 100); kalan devamsızlık; üç bağlantı: Claude projesi, klasör yolunu kopyala, Notion sayfası. Karta dokununca ders ayrıntısı açılır: o dersin değerlendirmeleri, oturumları, işleri, notlandırma açıklaması ve VF şartları.
2. **Dönem.** Yatay zaman çizelgesi: sütunlar dönem haftaları, satırlar dersler. Her değerlendirme ağırlığıyla orantılı bir işaret; tahmini tarihler kesikli. Altta hafta başına toplam ağırlık (yoğun haftalar bir bakışta görünür). Bugün çizgisi.
3. **Tüm işler.** Değerlendirmeler ve işler tek tabloda; ders, tür, durum, tarih aralığı süzgeçleri; satır içi düzenleme.
4. **Notlandırma.** Ders başına tablo: kalem, ağırlık, not, ağırlıklı puan, alt satırda anlık toplam ve kalan ağırlık. Not hücresine tıklayınca sayı girişi.
5. **Devam.** Ders × oturum ızgarası; her hücre tek dokunuşla değişir; ders başına kalan devamsızlık.
6. **Projeler.** Grup projeleri: adımlar, sıradaki adım, bekleyen işler (kimi bekliyor).
7. **Tarih bekleyen.** `date_status` değeri `unknown` ya da `estimated` olan kalemler; satır içinde tarih seçici ve "kesinleşti" düğmesi; derslerin "son kontrol" tarihleri.

Tasarım notu: bu sayfa Notion'daki tabloların yerini alır, o yüzden yoğun veri gösterir; ama her tablo satır içi düzenlenir ve hiçbir işlem ayrı bir forma gitmez.

## 9. Mod davranışı

| Mod | Davranış |
| --- | --- |
| Normal | Ağırlık çarpanı 1 |
| Yoğun | Ağırlık çarpanı 1,5; hazırlık işleri diğer modüllerin önüne geçer |
| Minimum | Yalnızca 3 gün içindeki son tarihler ve onların hazırlıkları |
| Tatil | İş üretilmez; ders blokları kalır |

## 10. Haftalık rapor

- Bu hafta tamamlanan ve kaçan değerlendirmeler
- Ders başına anlık toplam ve değişimi
- Önümüzdeki 2 haftanın yükü (değerlendirme sayısı, toplam ağırlık)
- Tarih bekleyen kalem sayısı; en uzun süredir kontrol edilmeyen ders
- Kalan devamsızlığı 1'e düşen dersler

Öğrenilenler: hazırlık işlerinin gerçek süreleri (tahmin çarpanı planlayıcıda `okul:prep` anahtarıyla tutulur).

## 11. Açık sorular

- [ ] Hazırlık eforunun sınırları uygun mu (quiz 30–180 dk, midterm ve final 180–900 dk)?
- [ ] Hazırlık dokümanları yerel ders klasörüne kaydediliyor mu? Hangi adla ve biçimde?
- [ ] Ders projelerinin talimatları klasördeki bir dosyaya taşınabilir mi (otomatik üretim için)?
- [ ] Devamsızlık hakkı ders başına nasıl belirleniyor (sabit sayı mı, oturum sayısının yüzdesi mi)?
- [ ] Hangi dersler kampüste, hangileri çevrim içi? Kampüs günlerinde yol süresi ne kadar?
- [ ] Notion'daki "Takip" ve "Materyal" türü görevler pratikte neyi kapsıyor; ayrı tür olarak kalsın mı?

## Sonraki sürümler

- Claude köprüsü (Ç5): ders projesindeki sohbetten "bu duyuruya göre tarihleri güncelle", çalışma planını kendiliğinden yazma.
- Hazırlık dokümanlarının otomatik üretimi (Okul adım 3).
- Hedef not hesabı: "dersten CB almak için finalden kaç gerekir".
- Dönem geçişi sihirbazı: ders listesi ve programdan yeni dönemi kurar.

## Kurulum adımları ve taslak kabul ölçütleri

Tasarım oturumunda kesinleşir.

### Adım 1: Temel (Ç1 ve Ç2'den sonra)

Kapsam: bu dokümandaki tablolar, teklifler, girişler ve sayfanın 7 sekmesi; olay soruları; ders programından blok serileri; Notion aktarımı (`docs/08-notion-aktarim.md`); hazırlık kalemi ve `sherpa` bloğuyla çalışma planı.

- [ ] Aktarımdan sonra ders, değerlendirme, oturum ve iş sayıları Notion'dakiyle eşleşiyor; betik ikinci kez çalışınca kopya üretmiyor
- [ ] Bir sınavın tarihi değişince hazırlık kalemi kendiliğinden kayıyor; elle değiştirilmiş alan yerinde kalıyor
- [ ] Not girilince dersin anlık toplamı ve kalan ağırlığı güncelleniyor
- [ ] Ders bloğu bitince devam sorusu çıkıyor; cevap Devam sekmesine yansıyor
- [ ] Dönem zaman çizelgesi bütün değerlendirmeleri hafta hafta gösteriyor; yoğun haftalar ayırt ediliyor
- [ ] Tarih bekleyen sekmesinde bir kaleme tarih verilince kalem normal plana giriyor
- [ ] Hazırlık adımından dersin Claude projesi tek dokunuşla açılıyor
- [ ] Yapıştırılan `sherpa` bloğu kalemin eforunu ve oturumlarını dokümandaki bölümlere göre yeniden kuruyor

### Adım 2: Ninova

`okul-ninova.md` içinde.

### Adım 3: Hazırlık dokümanı otomasyonu (Ç5'ten sonra, deneme)

Kapsam: ders klasöründe talimat dosyası; bekleyen üretimleri okuyup dokümanı üreten ve çalışma planını yazan zamanlanmış Claude görevi; Sherpa'da üretim durumu. Önce tek bir derste denenir.

- [ ] Bir derste, günü gelen hazırlık dokümanı kullanıcı bir şey yapmadan oluşuyor ve çalışma planı Sherpa'ya yazılıyor
- [ ] Üretilen doküman, kullanıcının elle ürettiği dokümanlarla aynı kalitede (kullanıcı onayı)
- [ ] Kapsamdaki dosyalar klasörde değilken üretim başlamıyor
- [ ] Üretim başarısız olunca elle yol (Komutu kopyala) aynen çalışıyor
