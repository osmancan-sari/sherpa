# Rutin (sabah ve akşam)

**Durum: Taslak.** Tasarım oturumu sürüyor (`prompts/modul-tasarim-oturumu.md`): 1–3. adımlar yazıldı (taslak, veri bağlantıları, iş teklifleri); 4. adımın çizimleri hazır ve kullanıcının görüşünü bekliyor; 5. (simülasyon), 6. (kurulum adımları ve kabul ölçütleri) ve 7. (onay) yapılmadı. Bu dosya onaylanana kadar modül kurulmaz.

Kapsam kararı (13 Kas 2026, `docs/09-kararlar.md`): Rutin günün açılışı ve kapanışıdır. Hareket (boyun ve sırt çalışması dahil) Spor modülündedir. Kullanıcının ölçütü: modül kullanırken yormamalı; günlük kullanımda sahnedeki dokunuşlardan başka giriş olmamalı.

**Dayanak:** kullanıcının araştırması "Bilimsel Kanıtlı Sabah & Akşam Rutinleri", sekme "Konsolide rapor · Sherpa v2" (https://claude.ai/artifact/DNTUt4gabkqUcdBLxZ74KR). Adım kimlikleri (S1, A6…) o rapordandır. Okunan: konsolide rapor (tamamı) ve özet sekmesi; dokuz inceleme sekmesi ve bilgi formu okunmadı.

## 1. Kimlik

- **Ad:** Rutin. **Slug:** `rutin`. **Tür:** ömürlük. **Alan:** Sağlık.
- **Amaç:** Uyanıştan sonraki ve yatıştan önceki bakım adımlarını sırayla yürütmek ve kaydını kendiliğinden tutmak.
- **Bölümler:** Sabah (`sabah`), Akşam (`aksam`). Her birinin kendi rengi ve sahnesi vardır; modül sayfasında birer sekmedir.
- **Başarı ölçütü:** iki hafta sonunda sabah ve akşam adımları Sherpa'nın sahnesinden yapılıyor ve ayrıca hiçbir giriş yapılmıyor.
- **"Tamam" kuralı (araştırmadan):** bir yapılışta temel adımların hepsi yapıldıysa o rutin o gün tamamdır; öbür adımlar fazladan sayılır.

## 2. Yaşam döngüsü

Etkinleştirilince üç ritim teklif eder (Sabah, Hazırlık, Akşam); arşivlenince ritimler pasifleşir, veri silinmez. Dönem geçişi yok.

## 3. Veri modeli

Dört tablo; hepsi `user_id` ve RLS taşır.

```
rutin_routines                -- üç satır: sabah, hazirlik, aksam (ritimlerin kaynağı)
  key text                    -- 'sabah' | 'hazirlik' | 'aksam'
  title text
  active boolean default true

rutin_steps
  routine_id -> rutin_routines
  position int
  title text                  -- 'Diş', 'Dercos, köpüğü 3–5 dk beklet'
  kind text                   -- 'timed' | 'tap' | 'closing' (çekirdeğin kapanışına geçiş)
  seconds int null            -- süreli adımda sayaç; plan süresi için dokunuşla adımda da tahmini süre
  hint text null              -- ekranda yazan ipucu
  parts jsonb null            -- alt adımlar: [{ title, note?, seconds? }]; `seconds` taşıyan sayaçla ilerler; ayrı ayrı kaydedilmez
  cue text null               -- tetikleyici: 'Fırçayı bırakınca'
  minimum boolean             -- temel adım mı
  active boolean              -- açık mı (aşamalı açılış)
  phase smallint null         -- araştırmadaki faz (bilgi)
  every_days int null         -- boş: her yapılışta; dolu: son yapılıştan bu kadar gün geçince
  evidence text null          -- kanıt notu (bilgi)
  ref text null               -- araştırmadaki kimlik: 'S1', 'A6'

rutin_runs
  routine_id -> rutin_routines
  day date
  session_id uuid null        -- çekirdeğin oturumu
  step_position int           -- kaldığı adım (iki cihazda aynı)
  part_position int default 0 -- adımın içinde kaldığı alt adım
  minimum_done boolean        -- temel adımların hepsi yapıldı mı
  finished_at timestamptz null

rutin_run_steps
  run_id -> rutin_runs
  step_id -> rutin_steps
  result text                 -- 'done' | 'skipped'
  seconds int null              -- adımda geçen süre; süre önerisi için
```

Uyanış, yatış ve uyku modülde saklanmaz; `ctx.days` ile çekirdekten okunur. Adımlar kodda değil veridedir: kullanıcı ekler, çıkarır, sıralar, süresini ve sıklığını değiştirir, açıp kapatır. İlk liste kurulumda 8. bölümdeki tablolardan yazılır.

## 4. Veri kaynakları ve otomasyon

| Veri | Kaynak | Seviye | Denendi mi |
| --- | --- | --- | --- |
| Adım listesi | Kurulumda araştırma tablosundan; sonra modül sayfasından | Elle (bir kez), düzenlenebilir | — |
| Yapılış, adım sonuçları | Sahnedeki dokunuşlar; `core.session_started` ve `core.session_ended` | Otomatik | Olaylar çekirdekte testli (Ç3c) |
| Uyanış, yatış, planlanan saatler | `ctx.days` | Otomatik | Çekirdekte testli (Ç3c) |
| Günün özeti | Sahnenin `today` verisi | Otomatik | Çekirdekte testli (Ç3c) |
| Dokunuşsuz uyanış | iPhone Kestirmeler → `core/wake` | Otomatik (2. kurulum adımı) | Uç çekirdekte testli (Ç3d); gerçek telefonda denenmedi |
| Kestirmeler'in Sherpa'yı açması | iPhone Kestirmeler | Otomatik (2. kurulum adımı) | Denenmedi |

Modülün kendi `ingest` türü ve zamanlanmış işi yoktur: dışarıdan gelen tek veri uyanıştır ve o çekirdeğin ucudur. Modül dışarıya hiçbir şey göndermez.

## 5. Kurallar (öngörü)

- `core.session_started` ile yapılış açılır, `core.session_ended` ile kapanır.
- **Sıklıklı adım.** `every_days` taşıyan adım, son yapılışından o kadar gün geçtiyse o günün listesine girer; kaçırılırsa ertesi gün yine görünür. Sabit hafta günü yoktur (ürün ilkesi).
- **Aşamalı açılış.** Araştırmadaki üç faz, adımların "etkin" anahtarıyla uygulanır: kurulumda yalnızca 1. faz adımları etkindir. Modül sayfası bir sonraki fazın adımlarının yanında "temel adımlar son 7 günün 5'inde yapıldı" bilgisini gösterir; açma kararı kullanıcınındır.
- **Kaçan gün.** Ekranda seri, sayaç ya da "kaçırdın" uyarısı yoktur. Dün yapılmayan rutin için ek bir şey yapılmaz: ritim zaten her gün önerilir.
- **Akşam hatırlatması.** Planlanan yatıştan 3 saat önce tek satırlık modül uyarısı (`alerts`): "Işıkları kıs; son büyük öğün." (A1, A2). Takip edilmez.
- Yayınlayacağı olay: belirlenmedi (dinleyeni yok).

## 6. Teklif ettiği işler

Üç ritim; üçü de tekrar biçimindedir ve bütün alanlarını modül doldurur. Yapay zekaya bırakılan alan yoktur; `sizingHints` yoktur (`size` çağrısı yapılmaz).

| Alan | `rutin:sabah` | `rutin:hazirlik` | `rutin:aksam` |
| --- | --- | --- | --- |
| `source` | `{ type: 'routine', id: <sabah satırı> }` | `{ type: 'routine', id: <hazirlik satırı> }` | `{ type: 'routine', id: <aksam satırı> }` |
| `title` | Sabah | Duş ve hazırlık | Akşam kapanışı |
| `when.recurrence` | günde 1, taban 1 | günde 1, taban 1 | günde 1, taban 1 |
| `effort.session_minutes` | etkin adımların süresi | etkin adımların süresi | etkin adımların süresi |
| `fit` | `light`, `home` | `physical`, `home` | `light`, `home` |
| `timing` | `anchor: 'wake'`, `order: 10` | `anchor: 'wake'`, `order: 30` | `anchor: 'bed'`, `order: 10` |
| `facet` | `sabah` | `sabah` | `aksam` |
| `meta` | `{ routine: 'sabah' }` | `{ routine: 'hazirlik' }` | `{ routine: 'aksam' }` |

- **Sabahın dizisi (kullanıcının kararı, 13 Kas 2026: duş sabah, hareketlerden sonra).** Uyanış → Sabah (diş bakımı, su, günün planı) → hareketler (Spor modülü, kurulunca; sıra 20) → Duş ve hazırlık (duş, SPF, giyinme, yürüyüş). Sıra numaraları arada yer bırakır. Spor kurulana kadar iki Rutin bloğu art arda gelir.
- **Süre.** Adım listesi değişince modül aynı `key` ile yeniden teklif eder. Giyinme ve yürüyüş adım oldukları için süreleri hazırlık bloğunun süresindedir; çekirdek günün başını "uyanış + uyanışa bağlı işlerin süresi" olarak hesapladığından çalışma penceresi yürüyüşten sonra başlar.
- **Salon günü (ileride).** Kullanıcının kuralı: günde tek duş; plana salon antrenmanı girdiği gün duş kendiliğinden antrenmanın hemen ardına gelir, sabahki duş adımı o gün görünmez; antrenman kayarsa duş da kayar. Kullanıcı duşu elle taşımaz. Bu bağ bugünkü zaman kısıtlarıyla kurulamaz (çekirdek notu 10). Salon üyeliği ve Spor modülünün salon programı olmadığı sürece duş her gün sabahtadır; ilk kurulum adımı bu bağa ihtiyaç duymaz.
- **Bölümler (`facets`).** Sabah (`sabah`, sıcak sarı, sahne `sabah`, ton `energy`), Akşam (`aksam`, lacivert, sahne `aksam`, ton `calm`). Renkler Ayarlar'dan değişir.
- **Sahne koşulu.** Çalışan iş bu modülün ritmiyse sahne gelir: `sabah` ve `hazirlik` güneşli sahneyi, `aksam` gece sahnesini kullanır.
- **Geri çekme.** Bir rutin kapatılırsa (`rutin_routines.active = false`) ritmi `withdraw` edilir.

## 7. Veri girişi

Günlük giriş yok. Adım düzenleme modül sayfasında yapılır.

## 8. Arayüz

**Çizimler (13 Kas 2026; kullanıcının görüşünü bekliyor):** https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k. Sekiz ekran: telefonda Günaydın, diş ve günün planı, duş ve hazırlık, akşam diş, "Yatıyorum"; panoda sabah sahnesi, Bugün ekranında Rutin (zaman çizelgesi renkleri, çip, Sıradakiler), modül sayfası (Sabah, Akşam, Düzenlilik sekmeleri). Çizimlerdeki görevler ve sayılar örnektir. Görünüş çekirdeğin Ç3e ekran görüntülerindeki dile göre çizildi (koyu zemin, Geist, sahne şeridi).

### Sabah (güneşli tema)

| Sıra | Adım | Tür | Temel | Başlangıçta etkin | Araştırma |
| --- | --- | --- | --- | --- | --- |
| 1 | Diş bakımı. Alt adımlar: su jeti (kullanıcı ekledi, 14 Kas) · fırçala, 2 dk (sayaç) · dil, 20–30 sn · tükür, suyla çalkalama | süreli (2 dk) | evet | evet | S1 |
| 2 | Bir bardak su; günün özeti ekranda | dokunuşla | hayır | evet | S2 |

**Sabahın tamamı tek görünümde (kullanıcının isteği, 13 Kas 2026).** Sabah sahnesi yalnızca kendi iki adımını değil, sabahın bütün dizisini gösterir: diş, su, boyun hareketleri (Spor), duş, SPF, giyinme ve yürüyüş. Kullanıcı sabahı tek bir akış olarak görür; hepsi bitince derse ya da işe geçilir. Hareket adımına gelince ekran Spor modülünün sahnesine geçer (setler, tekrarlar, süreler, yönlendirmeler; Spor'un kendi tasarımı) ve bitince sabah görünümüne döner. Veri ayrı kalır: hareketin kaydı Spor'da, bakım adımlarınınki Rutin'dedir. Bunu çekirdeğin Ç3f adımı sağlar (dizi sahneye verilir, sıradaki iş kendiliğinden başlar). Listenin başlığı "BU SABAH"tır. Spor kurulana kadar dizide Rutin'in iki bloğu vardır; hareket satırı Spor kurulunca kendiliğinden eklenir.

**Sabahın akışı (kullanıcının isteği, 13 Kas 2026).** Alarm kapanır → Sherpa açılır → "Günaydın" der → kullanıcının yataktan çıkmasını bekler → diş adımını gösterirken günün planını okur.

1. **Açılış ekranı.** Sabah sahnesi "Günaydın" ekranıyla açılır: saat, tek büyük düğme "Kalktım". Yardımcı cümle ve başka içerik yoktur; selamın ve tarihin altı boştur (kullanıcının kararı, 14 Kas 2026). Günün sözü fikri şimdilik bırakıldı. Sahne burada bekler; süre saymaz, hiçbir şey okumaz. Bu ekran adım değildir, kaydedilmez.
2. **"Kalktım".** Dokunuş telefonda sesin kilidini açar; 1. adım (diş, 2 dk sayaç) görünür ve günün planı sesli anlatılmaya başlar (eller dolu, kulak boş).
3. **Özetin yazılı hali** 2. adımda ekranda durur; "Tekrar anlat" düğmesi vardır. Ses kapalıysa yalnızca yazılı görünür.

Özet metni çekirdeğin `today` verisinden kalıpla kurulur, ayrıca yapay zeka çağrısı yapılmaz: ilk sabit blok ve saati, günün 3 işi (varsa nedeniyle), bitiş çizgisi, bu gecenin yatışı. Örnek: "Günaydın. 10:30'da dersin var. Bugünün üç işi: … Gün 19:00'da bitiyor."

**Alarm bağlantısı (2. kurulum adımı; hiçbiri gerçek telefonda denenmedi).** iPhone Kestirmeler'de "Alarm durdurulduğunda, hemen çalıştır" otomasyonu sırayla: uyanışı kaydeder (`core/wake`; adımları `docs/ILERLEME.md` "Senden bekleyenler" → Ç3d, 3), telefonun kendi sesiyle "Günaydın" der (Kestirmeler'in seslendirme eylemi; Sherpa'nın sesi değil), Sherpa'yı açar. Bağlantı kurulmadan önce akış "Uyandım" dokunuşuyla başlar; sahne aynıdır.

Kapanış ekranı (takip edilmez): "Sırada: hareketler." (Spor kurulana kadar: "Sırada: duş.")

### Duş ve hazırlık (güneşli tema)

Araştırma duşu akşama koymuştu (uykuya dalmayı hızlandırdığı için); kullanıcı uykuya dalmakta sorun yaşamadığı için duşu sabaha, hareketlerden sonraya aldı (13 Kas 2026).

| Sıra | Adım | Tür | Temel | Başlangıçta etkin | Araştırma |
| --- | --- | --- | --- | --- | --- |
| 1 | Duş: ılık, 5–10 dk; parmak aralarını kurula | dokunuşla | evet | evet | A3 |
| — | ek: Dercos, köpüğü 3–5 dk beklet | 1. adımın içinde; `every_days` 3 | hayır | evet | A3 |
| 2 | Nasır: üreli krem | dokunuşla; `every_days` 2 | hayır | hayır (faz 2) | A5 |
| 3 | SPF. Alt adımlar: yarım çay kaşığı kadar al · yüz, boyun ve kulaklara yay | dokunuşla | evet | evet | S4 |
| 4 | Giyin | dokunuşla; planda 15 dk | hayır | evet | S7 |
| 5 | Yürüyüş: çıkarken, arabaya binmeden tempolu 10–15 dk | dokunuşla; planda 12 dk | hayır | evet | S8 |

Duş adımının ekranı o günün ekini söyler ("Bugün Dercos: 3–5 dk beklet"); telefon duşta olmadığı için duş tek dokunuşla ("Çıktım") geçilir. Yüzü suyla yıkama (S3) duşun içinde kaldığı için ayrı adım değildir.

Sabahın son adımı yürüyüştür, SPF değil (kullanıcının düzeltmesi, 14 Kas 2026): giyinme ve yürüyüş gerçek adımlardır, "Bu sabah" sayısına girerler ve "Bitti" yürüyüşte basılır (telefon cepte; arabaya binerken). Son adımın küçük paneli "Sıradaki" yerine günün ilk işini gösterir ("Sonra: 10:30 …"). Evden çıkılmayan gün yürüyüş atlanır ya da ayrıca çıkılır. Spor modülü ileride yürüyüşü ve adım sayısını üstlenirse bu adım oraya taşınır. Ayrı bir "giyinme payı" ayarı yoktur; süre Giyin adımının kendi süresidir.

### Akşam kapanışı (gece teması)

Duş sabaha alındığı için günün güneş kremi, teri ve kiri yüzden akşam lavaboda temizlenir (3. adım).

| Sıra | Adım | Tür | Temel | Başlangıçta etkin | Araştırma |
| --- | --- | --- | --- | --- | --- |
| 1 | Antiperspirant, kuru cilde | dokunuşla | evet | evet | A4 |
| 2 | Diş bakımı. Alt adımlar: ara fırça ya da ağız duşu · fırçala, 2 dk (sayaç) · dil · tükür, çalkalama; sonrasında yalnızca su | süreli (2 dk) | evet | evet | A6 |
| 3 | Yüz: nazik temizleyiciyle yıka → nemlendirici (faz 2'den sonra araya azelaik asit; `every_days` 2, iki hafta sonra kullanıcı 1 yapar) | dokunuşla | hayır | evet | A3, A7 |
| 4 | Yarının listesi | çekirdeğin kapanışına geçiş | evet | hayır (faz 2) | A8 |
| 5 | Telefonu salona bırak. Alt adımlar: şarja tak · çalar saati kontrol et. Küçük panel "Sıradaki" yerine "Yarın"ı gösterir (uyanış, uyku) | dokunuşla; düğme "Yatıyorum" | evet | evet | A9 |

Kapanış ekranı (takip edilmez): "Yatakta: gece plağını tak. Işık kapalı." (A10, A11). Telefon yatak odasına girmediği için bu iki adım dokunuşla kaydedilemez.

**Akşamın akışı (çizimler: tuvalde "Akşam · uçtan uca", altı kare).** 22:05 Bugün ekranı: günün işleri bitmişse liste yerine tek satır ("Bugünün işleri bitti"), "Şimdi" kartında Akşam kapanışı ve "Başla". Sonra dört adım: Antiperspirant → Diş bakımı (sayaç, dört alt adım) → Yüz (temizleyici, nemlendirici) → Telefonu salona bırak (şarja tak, çalar saati kontrol et). Son adımda küçük panel "Yarın"ı gösterir ve düğme "Yatıyorum"dur. "Yatıyorum"dan sonra kısa bir kapanış ekranı gelir: "İyi geceler", yatak hatırlatması, yarının uyanış saati; ekran birkaç saniye sonra kararır (süre kurulumda ayarlanır) ve gün kapanır. Yarının listesi adımı faz 2'de açılınca Yüz ile Telefon arasına girer.

**Yatış kaydı.** "Yatıyorum" telefon bırakılırken basılır; çekirdekteki yatış saati bu yüzden araştırmadaki Y−30'a denk gelir (ışığın kapanmasından yaklaşık 30 dk önce). Önerilen çerçeve ayarı buna göredir: uyanış 06:00–08:00, yatış 21:30–23:30, uyku hedefi 8,5 saat (araştırmadaki ev ayarı U 07:00, ışık kapalı 23:00). 12 günlük saat kaydırma ayrı bir yapı kurulmadan, aralıklar üç günde bir elle kaydırılarak yapılır.

### Görsel katman: yaşayan gökyüzü (kullanıcının seçimi, 13 Kas 2026)

Çizimler tuvalin "Görsel yönler" sayfasında, "A2" ile başlayan dört ekran (tasarımcı gözüyle ikinci tur; kullanıcının görüşünü bekliyor). Görsel, sahnenin mantığından ayrı tek bir arka plan bileşenidir ve 0–1 arası bir ilerleme değeriyle sürülür (yapılan adım ÷ o günün adım sayısı; sabahta bütün dizinin adımları). (14 Kas 2026 güncellemesi: sabahta bu ilerleme değeri kaldırıldı, yerine saat geçti; aşağıdaki "Sabah" maddesi geçerlidir. Güncel çizimler tuvalin "Sabah · uçtan uca" sayfasındadır: alarmdan Bugün ekranına on bir kare.)

- **Tek manzara.** Gökyüzü gerçek bir ufukta biter (yüksekliğin yaklaşık %73'ü); altında uzaktan yakına üç tepe katmanı ve aralarında sis. En yakın sırt her zaman koyudur; alttaki düğmeler onun üzerinde durur ve hiçbir ilerleme değerinde değişmez.
- **Sabah: zemin saate bakar, adıma değil (kullanıcının kararı, 14 Kas 2026).** Sabah sahnesinin gökyüzü Bugün ekranındakiyle aynı bileşendir ve yalnızca o anki saate göre çizilir; adım ilerledikçe güneş yükselmez. Güneşin yüksekliği tarih, saat ve ayarda duran sabit koordinattan (varsayılan İstanbul) cihazda hesaplanır; ağ, dış servis ve konum izni yoktur, birkaç dakikalık sapma kabul edilir, hava durumu gösterilmez (kullanıcının isteği, 14 Kas 2026: "o an dışarısı nasılsa"). Bu hesap ve gökyüzü bileşeni çekirdeğe aittir (Bugün ekranı da kullanır); Rutin yalnızca kullanır. (İstanbul; Kasım ortasında doğuş yaklaşık 07:45, yani 07:00'de kalkılan sabahın çoğu şafak öncesidir ve güneş ancak yürüyüşte ufukta görünür; yazın aynı saatte güneş yukarıdadır). Adım ilerlemesini yalnızca küçük paneldeki yedi çizgi gösterir. Sonuç: sabah bitince Bugün ekranına geçerken zemin değişmez; yalnızca cam paneller yer değiştirir. Spor adımında zemin Spor'un kendi zeminine çapraz geçer, adım bitince gökyüzüne döner.
- **Metin tonu.** Metin tonu da saate bağlıdır: gökyüzünün üst yarısı aydınlandığında (gündüz) metin koyuya, paneller açık cama döner; şafakta ve gecede açık metin, koyu cam. Eşik cihazda ayarlanır.
- **Akşam: zemin yine saate bakar (14 Kas 2026; sabahla aynı kural, kullanıcının onayını bekliyor).** Akşam kapanışı yatıştan önce çalıştığı için gökyüzü zaten gecedir: yıldızlar baştan görünür, adımla artmaz. Ay ufka yakın, sağda durur (başlıkla çakışmasın diye); ayın yeri ve evresi hesaplanmaz, süstür. Dalda küçük baykuş silüeti durur; adımla değişmez, yalnızca "Yatıyorum"dan sonraki ekranda gözleri kapalıdır. Akşamın rengi mor-mavi (`#aab6ff`), sabahınki sarıdır.
- **Hareket.** Boştayken neredeyse durağan (bulut çok yavaş kayar, yıldızların küçük bir kısmı hafifçe titreşir). Adım değişince ilerleme yaklaşık 2 saniyede yumuşakça yeni değerine gelir; sıçrama, parlama, konfeti, ses yok. Hareket azaltma tercihinde hiçbir sürekli hareket olmaz; adım değişimi iki durağan durum arasında kısa bir solmadır.
- **Liste satırları.** Yapılan: yumuşak diskte onay işareti; şimdiki: dolu nokta, renkli satır ve "şimdi"; sıradaki: içi boş halka; takip edilmeyen son satır: küçük nokta.
- **Okunurluk.** Gökyüzünün üzerine doğrudan yazı yalnızca üst bölgede durur; öbür her yazı yarı saydam panelin içindedir. Karşıtlık değerleri hesapla bulundu, ekranda ölçülmedi; kurulumda iki temada ve gerçek cihazda denetlenecek.
- **Cam paneller (kullanıcının isteği, 14 Kas 2026).** Şerit, liste paneli ve düğmeler gökyüzünün üzerinde cam gibi durur: arkayı bulanıklaştıran yarı saydam yüzey, ince parlak kenar, hap biçimli düğmeler. Camın altında okunurluk için hafif koyu (gündüz sahnesinde açık) bir ton vardır. Buzlu cam katmanı her cihazda çalışır; kenarda kırılma yalnızca destekleyen tarayıcıda ek ciladır (iPhone'da çalışıp çalışmadığı denenmedi). Sistemde saydamlığı azaltma tercihi açıksa paneller düz yüzeye döner. Çizimler tuvalin "Cam dili" sayfasında.
- Renkler, güneşin ve ayın konumları, yıldız ve baykuş ölçüleri çizim dosyalarındadır; kurulumda oradan alınır.

### Ortak

- **Adım ekranının düzeni (kullanıcının yorumu, 14 Kas 2026).** Başlığın ve sayacın altında iki panel durur. Büyük panel "Bu adımda": adımın alt adımları sırayla, numaralı. Panel sabit yüksekliktedir ve en çok üç satır gösterir: şimdiki alt adım (vurgulu, altında tek satırlık notu) ve sıradaki iki tanesi (yalnızca adları, tek satır, sığmayan metin kesilir). Bir alt adım bitince yukarı kayarak panelden çıkar, alttan sıradaki gelir; başlıkta "2 / 4" yazar. Böylece alt adım sayısı kaç olursa olsun panel taşmaz. "Sonraki" önce alt adımlar arasında, son alt adımdan sonra bir sonraki adıma geçirir; süreli alt adım sayacı bitince kendiliğinden ilerler. Alt adımlar tek tek kaydedilmez; kayıt adımın kendisi içindir. Hareket azaltma tercihinde kayma yerine anlık değişim olur. Küçük panel "Sıradaki": bir sonraki adımın adı, sabahın (ya da akşamın) kaçıncı adımında olunduğu ve ince bir ilerleme şeridi, altında kalan adımlar tek satırda. Dizinin tam listesi telefonda ayrı bir panel olarak durmaz; panoda yer olduğu için görünür kalır. Alt adımı olmayan adımda büyük panel ipucunu gösterir.

- **Cihazlar.** Sahne hangi cihaz açıksa onda görünür; hangi adımda olunduğu modülün tablosundadır ve iki cihazda canlı olarak aynıdır (bir cihazda "Sonraki" öbüründe de ilerler). Yerleşim cihaza göre ayrıdır: telefon elde tutulan birincil ekrandır (büyük tek düğme, tek adım); pano uzaktan okunan görünümdür (adım listesi, büyük sayaç, günün özeti yanda). Konuşan cihaz çekirdeğin kuralıyla dokunulan cihazdır.
- **Uzakta cihaz.** Her sahnede "Hepsini yaptım" vardır: cihaz yanında değilken adımlar tek dokunuşla kapatılır; atlanan adım özet satırından işaret kaldırılarak düzeltilir.
- **Son adımın düğmesi.** Sabahın ve akşamın son adımında "Sonraki" yerine "Bitti" yazar (akşamda "Yatıyorum"); son adımda "Hepsini yaptım" görünmez.
- **Adım ekleme.** Kullanıcı modül sayfasından yeni adım ve alt adım ekler, var olanı düzenler ya da kapatır; sahne ve süre hesabı listede ne varsa onu kullanır.
- **Ses.** Günün özeti ve adım adları sesli söylenir; ipuçları yalnızca ekranda yazar. Süreli adımda süre bitince kısa bir sözle haber verilir.
- **Çip:** günün rutinlerinin durumu.
- **Kullanıcının kararları (14 Kas 2026, tasarımın son turu).**
  - *Sözcük:* arayüzde "asgari" geçmez; "temel adım" denir (etiket "temel", anahtar "Temel adım"). Veride sütun adı `minimum` kalır. Başlangıç listesi: Sabah Diş bakımı; Duş ve hazırlık Duş, SPF; Akşam Antiperspirant, Diş bakımı, Telefon. Kullanıcı sonradan değiştirir.
  - *Düzenlilikte iki satır:* Sabah ve Akşam. "Hazırlık" ayrı satır olmaz; sabahın iki bloğu (Sabah, Duş ve hazırlık) kullanıcı için tek sabahtır ve kare ikisinin temel adımlarının hepsi yapıldıysa dolar. Durum satırındaki "sabah 6/7" de aynı hesaptır. Hareketleri Spor modülü izler; burada sayılmaz. Karelerin altında "Dolu: o günün temel adımları yapıldı." yazar.
  - *Süreli alt adım:* süre bitince kendiliğinden sıradaki alt adıma geçer ve adını söyler (eller ıslakken dokunmak gerekmez); kullanıcı sayaca dokunarak durdurabilir. "Süre dolmadan geçme" açıksa (varsayılan açık) süre dolana kadar ana düğme "Sonraki" yerine soluk "Erken geç · basılı tut" olur; yanlışlıkla ya da aceleyle geçilmez, isteyen basılı tutarak geçer. Süresi olmayan alt adım dokunuş bekler; el değmeden akması istenen alt adıma süre verilir. "Bitince kendiliğinden geç" diye ayrı bir anahtar yoktur.
  - *Telefon:* duşta banyoda kenarda, giyinirken yanında durur; kullanıcı çıkarken "Sonraki"ye basar. Bu adımlar için özel düzenek yoktur.
  - *Sabahın bitişi:* "Bitti"den sonra sahne tek bir yazı gösterir: "İyi günler" (Günaydın'ın karşılığı; sayı, süre, övgü yok). Yazı solarken Bugün ekranı belirir; gökyüzü aynı kaldığı için geçiş kesintisizdir (yaklaşık 0,6 sn, cihazda ayarlanır). "Bu sabah tamam" yazısı kaldırıldı.
  - *Akşamın başlaması:* kendiliğinden açılmaz. Günün işleri bitince ya da saati gelince "Şimdi" kartına gelir; kullanıcı "Başla"ya basar.
  - *"İyi geceler" ekranı:* kalır. "Yarın" kutusu iki satırdır: Uyanış (saat), Uyku (yaklaşık süre).
  - *Sıralama:* adımlar listede kendi grubunun içinde sürüklenerek sıralanır.
  - *Sürelerin öğrenilmesi (kullanıcının kararı, 14 Kas 2026: onay düğmesi yok, kendiliğinden).* İki katman vardır. (1) Çekirdek zaten öğrenir: `docs/04-planlayici.md` "Öğrenme" bölümündeki tahmin çarpanı (`(modül, iş türü)` başına son 20 oturumun gerçek ÷ tahmin ortancası, en az 5 örnek) planlayıcının girdisini kendiliğinden düzeltir; günlük ve haftalık plan Rutin'in gerçek süresine böyle uyar. (2) Modül adım sürelerini kendisi günceller ki listede yazan süre de doğru olsun: her adımda geçen süre kaydedilir (`rutin_run_steps.seconds`; adım ekrana geldiği andan "Sonraki"ye kadar), en az 7 geçerli kayıt olunca adımın plandaki süresi son 14 kaydın ortancasına çekilir (dakikaya yuvarlanır; haftada bir, haftanın kurulmasından önce). Arka arkaya birkaç saniyede geçilen (toplu basılan) adımlar ve atlananlar hesaba girmez. Değişiklik onay istemez; Düzenlilik'te "Son değişenler" altında tek satır bilgi olarak görünür ("Duş artık planda 14 dk (10 dk idi)"). Kullanıcı bir süreyi elle değiştirirse o adım kullanıcınındır: otomatik güncelleme o adımda durur (düzenleme sayfasında "Süre · otomatik" yerine "Süre · elle" ve "Otomatiğe dön"). Yapay zeka çağrısı yoktur. Süresiz alt adımlar (Su jeti, Tükür) dokunuşla geçilir; onların süresi adımın toplamından öğrenilir.
- **Modül sayfası (cam dili; çizimler tuvalde "Modül sayfası", dört kare; 14 Kas 2026, kullanıcının görüşünü bekliyor).** Çekirdeğin beş bölgeli iskeletini kullanır; zemin günün saatine göre gökyüzüdür.
  - *Başlık ve durum:* modülün rengi, ad, alan (Sağlık), "Adım ekle". Durum satırı: son 7 günde sabahın ve akşamın tamam olduğu gün sayısı; panoda ayrıca ortalama uyanış, yatış ve uyku.
  - *Sekmeler:* Sabah, Akşam, Düzenlilik (cam hap; telefonda tam genişlik).
  - *Sabah sekmesi:* sabahın tamamı tek listede, üç grup halinde ve sahnedeki sırayla numaralı: Sabah (Diş bakımı, Bir bardak su), Hareketler (Spor'dan gelen satır; anahtarı yoktur, dokununca Spor modülüne gider), Duş ve hazırlık (Duş, SPF, Giyin, Yürüyüş). Ekler (Dercos) ve kapalı faz adımları (Nasır kremi) numarasız, girintili durur. Her satırda ad, tek satır özet (tür, alt adım sayısı, sıklık), varsa "temel" etiketi ve açık/kapalı anahtarı. Akşam sekmesi aynı düzendedir.
  - *Adımı düzenle (kullanıcının yorumu, 14 Kas 2026: her şey ayarlanabilir olmalı):* satıra dokununca alttan cam sayfa açılır: ad, plandaki süre (− / +), sıklık (her gün / N günde bir), temel adım, açık, "Adımı sil". Altında alt adımlar: her biri sürüklenerek sıralanır, adına dokununca yeniden adlandırılır, süre hapına dokununca süresi ve sayaç olup olmadığı ayarlanır ("süre ekle" boş haptır), çarpıyla çıkarılır; "Alt adım ekle" yeni satır açar. "Kaydet". "Adım ekle" aynı sayfayı boş açar. Listede her adımın süresi satırında yazar; grup başlığındaki süre ("toplam 4 dk") elle girilmez, açık adımların sürelerinin toplamıdır ve planlayıcıya giden süre de budur.
  - *Düzenlilik sekmesi:* son 14 günün uyanış ve yatış saatleri nokta olarak, hedef aralıklar açık şerit; ortalama uyanış, yatış, uyku. Altında temel adımların 14 günlük karesi (Sabah, Hazırlık, Akşam) ve haftalık rapordaki tek öneri ("en çok atlanan adım: küçült ya da tetikleyicisini değiştir"). Boş gün gri kalır; seri, puan, rozet yok.
  - *Yaklaşanlar (panoda sağ sütun, telefonda sekmelerin altında kaydırınca):* çekirdeğin doldurduğu liste; sıradaki ritimler.
  - *Çizilen ekranların tamamı (tuvalde "Modül sayfası", on üç kare; 14 Kas 2026).* Telefon: 1 Sabah sekmesi, 2 aynı sekme aşağı kaydırınca (Yaklaşanlar, "Bu hafta" satırı), 3 Akşam sekmesi (altında "Yatakta · kaydedilmez" notu), 4 Düzenlilik, 5 Adımı düzenle, 6 Alt adımın süresi (süre, sayaç göster, bitince kendiliğinden geç, not, "Süreyi kaldır"), 7 Kapalı faz adımı ve "N günde bir" (faz notu, "Şunun eki", "Kaç günde bir"), 8 Adım ekle ("Nereye": Sabah / Hazırlık / Akşam, "Sırası"), 9 Adımı sil onayı ("Kapat" seçeneğiyle). Pano: 10 Sabah, 11 Akşam, 12 Düzenlilik (öneri kartında "Adımı düzenle"), 13 Adımı düzenle (sağdan açılan yan panel). Modüle özel ayrı bir ayar ekranı yoktur; renkler çekirdeğin Ayarlar'ındadır.

## 9. Mod davranışı

Dört modda da aynı: ağırlık çarpanı 1, taban çarpanı 1 (rutinler her modda günde 1 kalır). Ayrı bir "kısa gün" düğmesi yoktur (kullanıcının yorumu üzerine kaldırıldı, 14 Kas 2026): duş sabaha alınıp hareket Spor'a ayrıldıktan sonra Rutin'in asgari olmayan adımları yalnızca su, Dercos ve nasır kremidir; düğme birkaç dakikadan fazlasını kazandırmıyordu. Dar sabahta tek tek "Atla" yeter. Sabahı asıl kısaltan şey hareketin uzunluğudur; o karar Spor modülünün tasarımına aittir.

## 10. Haftalık rapor ve öğrenme

Araştırmadaki haftalık gözden geçirmenin yerini tutar; ayrı bir iş açılmaz. Metrikler: rutinlerin tamam olduğu gün sayısı, ortalama süre. Öneri (en fazla 2): iki kereden fazla atlanan adım için "küçült ya da tetikleyicisini değiştir".

## 11. Açık sorular

1. ~~Antiperspirant adımı (A4) ürünün alüminyum içermesine bağlı; etiket kontrol edilecek.~~ Kapandı (14 Kas 2026): kurulumu etkilemez. Soru yalnızca adımın notu içindi (alüminyumlu antiperspirant gece sürülünce daha iyi tutar; ürün yalnızca deodorantsa saatin önemi yoktur). Adım sıradan bir adımdır; kullanıcı isterse kapatır ya da sabaha taşır.
2. Gece plağı henüz yok; diş hekiminden sonra kapanış ekranındaki cümle geçerli olur.

### Kapsam dışı bırakılanlar (13 Kas 2026)

- **Gün içi adımlar.** El yıkama (G6), 30 dakikada bir kalkma (G2), kafein saati (G5), SPF yenileme (G4) ölçülemez; takip edilmez. Yemek sonrası yürüyüş (G1) ve adım sayısı (G3) Spor modülü tasarlanırken ele alınır; sabah yürüyüşü (S8) Rutin'in adımıdır.
- **Boyun asgarisi ve tam set (S5, S6):** Spor modülü. Rutin'in "tamam"ı bunlara bağlı değildir.
- **Periyodik görevler** (sakal 14 gün, fırça başlığı ve saç fotoğrafı 90 gün, diş hekimi 180 gün) ve **tek seferlikler** (randevular, alışveriş): Rutin'in ilk sürümünde yok. Tek seferlikler hızlı girişten iş olarak girilebilir; periyodikler Hayat idaresi modülüne adaydır.

## Çekirdek için notlar

Tasarım sırasında görülen eksikler. 2, 7 ve 11 numaralılar Ç3f adımına alındı (13 Kas 2026; `docs/12-sahne-ve-otomasyon.md` bölüm G, `prompts/c3f-capali-diziler.md`); Rutin'in ilk kurulum adımı Ç3f'den sonra yapılır. 1 numara Ç3f'te sıra kuralı olarak yazıldı. Ötekiler açık.

1. **Modüller arası çapa sırası.** Rutin ve Spor ayrı modüller olarak uyanışa bağlı iş teklif eder. `timing.order` modülün kendi verdiği sayıdır; iki ayrı modülün işlerinin birbirine göre sırasını kimin belirlediği sözleşmede açık değil.
2. **Sahneden akşam kapanışına geçiş.** Kapanış çekirdeğin ayrı ekranıdır (`/kapanis`); bir modül sahnesinin adımı olarak nasıl açılıp sahneye nasıl dönüleceği tanımlı değil (akşam 4. adım).
3. **Alan sayfasının çekirdek verisini okuması.** Sağlık sayfasında uyku gösterilecek; uyku kaydı çekirdektedir. Alan sayfasının veriyi nasıl topladığı Sağlık sayfası tasarlanırken netleşmeli.
4. **Yatışın ileri saatle kaydı.** Telefon yatak odasına girmediği için "Yatıyorum" gerçek yatıştan yaklaşık 30 dk önce basılır. Çekirdek yatışı basıldığı an olarak yazar; "30 dk sonra yatıyorum" gibi bir kayıt yok. Şimdilik ayarla karşılanıyor (uyku hedefi 8,5 saat).
5. **Geç yatılan gecede uyanış.** Çekirdek gerçek yatıştan sonra beklenen uyanışı `yatış + uyku hedefi`ne kaydırır; araştırma kalkışın en çok 1 saat ertelenmesini önerir. Uyanış aralığı 06:00–08:00 olunca olağan durumda sonuç aynıdır; aralık geniş tutulursa ayrışır.
6. **Uzun aralıklı tekrar.** Tekrar biçimi gün, hafta ve ay tanır; 90 ve 180 günde bir yapılan iş doğrudan ifade edilemiyor (Hayat idaresi için gerekecek).
7. **Dışarıdan kaydedilen uyanıştan sonra rutinin başlaması.** "Uyandım'dan sonra ilk rutin kendiliğinden başlasın" ayarı ekrandaki dokunuş için tanımlı. Uyanış alarm otomasyonundan (`core/wake`) gelince, uygulama açıldığında uyanışa bağlı ilk işin kendiliğinden başlayıp başlamadığı belirsiz; başlamıyorsa kullanıcı önce "Başla"ya, sonra "Kalktım"a basar (iki dokunuş).
8. **Ana ekrandaki uygulamayı Kestirmeler'den açmak.** iOS'ta ana ekrana eklenen web uygulaması kendi adres şemasını kaydetmez; Kestirmeler'in onu doğrudan açıp açamadığı denenmedi. Açamıyorsa adres Safari'de açılır (oturum ayrı olabilir).
9. **Dokunuşsuz anlatım.** iPhone'da web uygulaması dokunuş olmadan konuşamaz. Planın alarm kapanır kapanmaz, dokunmadan okunması istenirse Kestirmeler'in özet metnini Sherpa'dan alması gerekir; cihaz anahtarları bugün yalnızca yazabilir, okuma ucu yok.
10. **"Şundan hemen sonra" kısıtı.** Kullanıcının isteği: plana salon antrenmanı girdiği gün duş kendiliğinden onun ardına gelsin; antrenman yoksa sabah dizisindeki yerinde kalsın. Bugünkü `timing` yalnızca saate, uyanışa ve yatışa bağlar; başka bir işe (hele başka modülün işine) bağlayamaz. `depends_on` yalnızca kalemler arasında ve "bitmeden başlamaz" anlamındadır. Gereken genel yapı: bir iş "şu işareti taşıyan iş o gün plandaysa onun hemen ardına" diyebilmeli (işaret, öbür işin kendi beyanı; modüller birbirini tanımaz), yoksa kendi öbür kısıtlarına dönmeli; ayak izi ve çapalı diziler buna göre hesaplanmalı. Spor modülü kurulmadan önce çekirdek kararı olarak ele alınmalı. Sabah hareketleri için bu kısıt gerekmez: duş uyanış dizisinde hareketlerden sonraki sıradadır.
11. **Çapalı dizinin tek akış olması.** Kullanıcının isteği: uyanışa bağlı işler (Rutin'in Sabah bloğu, Spor'un hareketleri, Rutin'in Duş ve hazırlık bloğu) ekranda tek bir sabah olarak görünsün ve aralarında "Başla"ya basmak gerekmesin. İki eksik: (a) sahne, parçası olduğu dizinin öbür işlerini bilmiyor (`today` yalnızca günün 3 işini ve blokları taşır; başka modülün çapalı işi gelmez); (b) bir çapalı iş bitince sıradaki kendiliğinden başlamıyor (`start_on_wake` yalnızca ilkini başlatır). Gereken genel yapı: çekirdek sahneye diziyi versin (her işin adı, modülü, süresi, durumu) ya da diziyi kendi şeridinde göstersin, ve dizideki sıradaki işi kendiliğinden başlatsın (ayarla). Yatışa bağlı dizi için de aynısı geçerli. Spor modülü kurulmadan önce çekirdek kararı olarak ele alınmalı.
12. **Sağlık alanı sayfasına veri (kullanıcının sorusu, 14 Kas 2026).** Kullanıcı sağlıkla ilgili bütün trendleri tek yerde görmek istiyor: uyku (çekirdeğin uyanış ve yatış kaydı), Rutin'in düzenliliği, Spor'un ve Beslenme'nin sayıları, ayrıca bunlardan türetilen metrikler (uyku düzenliliği, uyku açığı, modüller arası ilişkiler). Yeri alan sayfasıdır (`/a/saglik`). Denetlenecek: sözleşmede bir modülün alan sayfasına zaman serisi ve seçilmiş görünüm vermesinin karşılığı var mı; modüller arası türetilmiş metrik nerede hesaplanır (çekirdek mi, alan mı). Tek bir "sağlık puanı" önerilmedi (keyfi olur, suçluluk üretir). Sağlık sayfası Spor tasarlandıktan sonra ayrı bir oturumda çizilir. Rutin'in vereceği: Düzenlilik sekmesindeki uyku grafiği ve temel adım kareleri. **Erişim (öneri, 14 Kas 2026; çizim tuvalde "Modül sayfası" sayfası, 5. kare).** Alan sayfasına iki yerden girilir, yeni menü öğesi açılmaz: (a) Modüller ekranı modülleri alanlarına göre gruplar; her grubun başlığı alanın tek satırlık özetini ve "Alan sayfası ›" düğmesini taşır; (b) modül sayfasının başlığındaki alan adı ("Sağlık ›") bağlantıdır. Bugün ekranına alan girişi konmaz (tek odak). `docs/ILERLEME.md` alan sayfasının hiçbir fazda olmadığını ve kodda bulunmadığını yazıyor; hangi faza gireceği açık.
