# Rutin (sabah ve akşam)

**Durum: Onaylandı (14 Kas 2026).** Tasarım oturumunun (`prompts/modul-tasarim-oturumu.md`) yedi adımı tamam; kullanıcı tasarımı onayladı. Kurulum sonundaki üç adımla yapılır; 1. adım Ç3f yayınlandıktan sonra başlar. Bu dosya 14 Kas 2026'da baştan sona yeniden yazıldı; önceki turların geçersiz kalan cümleleri çıkarıldı.

Kapsam kararı (13 Kas 2026, `docs/09-kararlar.md`): Rutin günün açılışı ve kapanışıdır. Hareket (boyun ve sırt çalışması dahil) Spor modülündedir. Kullanıcının ölçütü: modül kullanırken yormamalı; günlük kullanımda sahnedeki dokunuşlardan başka giriş olmamalı.

**Dayanak:** kullanıcının araştırması "Bilimsel Kanıtlı Sabah & Akşam Rutinleri", sekme "Konsolide rapor · Sherpa v2" (https://claude.ai/artifact/DNTUt4gabkqUcdBLxZ74KR). Adım kimlikleri (S1, A6…) o rapordandır. Okunan: konsolide rapor (tamamı) ve özet sekmesi; dokuz inceleme sekmesi ve bilgi formu okunmadı.

**Çizimler:** https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k. Geçerli sayfalar: "Sabah · uçtan uca" (12 telefon karesi ve alt sırada sahnenin pano karesi), "Akşam · uçtan uca" (6 telefon karesi ve alt sırada sahnenin pano karesi), "Modül sayfası" (15 kare ve alt menü panosu). Sahnenin pano düzeni bu iki pano karesinden alınır (14 Kas 2026'da eklendi; "Cam dili" sayfasındaki eski pano karesi geçersizdir). "Yapı", "Görsel yönler" ve "Cam dili" sayfaları önceki turlardır; bu dosyayla çelişirlerse bu dosya geçerlidir. Çizimlerdeki görevler, saatler ve sayılar örnektir. Kareler masaüstü tarayıcıda çizilip bakıldı; gerçek telefonda denenmedi.

**Ortak kararlar:** görsel dil, sahne ve modül sayfası düzeni, öğrenme ve dil kuralları `docs/moduller/ORTAK.md` içindedir; burada yalnızca Rutin'e özel olan yazılır.

## 1. Kimlik

- **Ad:** Rutin. **Slug:** `rutin`. **Tür:** ömürlük. **Alan:** Sağlık.
- **Amaç:** Uyanıştan sonraki ve yatıştan önceki bakım adımlarını sırayla yürütmek ve kaydını kendiliğinden tutmak.
- **Bölümler:** Sabah (`sabah`, sıcak sarı `#ffd58a`), Akşam (`aksam`, mor-mavi `#aab6ff`). Her birinin kendi rengi ve sahnesi vardır; modül sayfasında birer sekmedir. Renkler Ayarlar'dan değişir.
- **Başarı ölçütü:** iki hafta sonunda sabah ve akşam adımları Sherpa'nın sahnesinden yapılıyor ve ayrıca hiçbir giriş yapılmıyor.
- **"Tamam" kuralı:** bir günde bir bölümün açık temel adımlarının hepsi yapıldıysa o bölüm o gün tamamdır; öbür adımlar fazladan sayılır. Sabah için hesap iki bloğu birlikte kapsar (Sabah ile Duş ve hazırlık).
- **Adımlar veridir.** Kullanıcı araştırdıkça adım, ürün ve alt adım ekleyip değiştirecek; bunların hiçbiri kod değişikliği istemez.

## 2. Yaşam döngüsü

Etkinleştirilince üç ritim teklif eder (Sabah, Duş ve hazırlık, Akşam kapanışı); arşivlenince ritimler pasifleşir, veri silinmez. Dönem geçişi yok.

## 3. Veri modeli

Dört tablo; hepsi `user_id` ve RLS taşır.

```
rutin_routines                -- üç satır: sabah, hazirlik, aksam (ritimlerin kaynağı)
  key text                    -- 'sabah' | 'hazirlik' | 'aksam'
  title text
  active boolean default true

rutin_steps
  routine_id -> rutin_routines
  parent_id -> rutin_steps null -- dolu: bu adım, bağlı olduğu adımın ekidir (Dercos -> Duş); kendi ekranı yoktur
  position int
  title text
  kind text                   -- 'tap' | 'closing' (çekirdeğin kapanışına geçiş; faz 2)
  seconds int                 -- plandaki süre
  seconds_auto boolean default true -- false: kullanıcı süreyi elle girdi, kendiliğinden güncellenmez
  hint text null              -- alt adımı olmayan adımda ekranda yazan ipucu
  parts jsonb null            -- alt adımlar: [{ title, note?, seconds?, timer?, hold? }]
                              --   seconds: süreli alt adım; timer: sayaç gösterilir; hold: süre dolmadan geçilmez (varsayılan true)
  minimum boolean             -- temel adım mı (arayüzde "temel")
  active boolean              -- açık mı
  phase smallint null         -- araştırmadaki faz (bilgi; kapalı faz adımının "açılabilir" notu için)
  every_days int null         -- boş: her yapılışta; dolu: son yapılıştan bu kadar gün geçince
  evidence text null          -- kanıt notu (bilgi)
  ref text null               -- araştırmadaki kimlik: 'S1', 'A6'

rutin_runs
  routine_id -> rutin_routines
  day date                    -- çekirdeğin gün kaydından (gece yarısından sonraki yatış önceki günün gecesidir)
  session_id uuid null        -- çekirdeğin oturumu
  step_position int           -- kaldığı adım (iki cihazda aynı)
  part_position int default 0 -- adımın içinde kaldığı alt adım
  step_started_at timestamptz null -- adımın ekrana geldiği an (adımda geçen süre buradan sayılır; 1. adımda eklendi)
  part_started_at timestamptz null -- süreli alt adımın başladığı an (sayaç saat damgasından hesaplanır)
  part_paused_at timestamptz null  -- sayaca dokunularak durdurulduğu an (boş: işliyor; 1. adımda eklendi)
  minimum_done boolean        -- o yapılışta açık temel adımların hepsi yapıldı mı
  finished_at timestamptz null
  -- (routine_id, day) tekil: rutin günde bir yapılır; yeniden başlatılan yapılış aynı satırda sürer

rutin_run_steps
  run_id -> rutin_runs
  step_id -> rutin_steps
  result text                 -- 'done' | 'skipped'
  seconds int null            -- adımda geçen süre (ekrana geldiği andan "Sonraki"ye kadar); öğrenme için
  bulk boolean default false  -- arka arkaya birkaç saniyede ya da "Hepsini yaptım" ile kapatıldı; öğrenmeye girmez
```

Uyanış, yatış ve uyku modülde saklanmaz; `ctx.days` ile çekirdekten okunur. Yapılışın günü (B3): akşamın 12:00'den önce başlayan yapılışı önceki günün gecesidir; sabahınki, o takvim gününün uyanışı kayıtlıysa ve yapılıştan önceyse o gündür, uyanış yokken 05:00'ten önce önceki gündür (`server/flow.ts`, `runDay`). Alt adımlar tek tek kaydedilmez; kayıt adımın kendisi içindir. İlk liste kurulumda 8. bölümdeki tablolardan yazılır.

## 4. Veri kaynakları ve otomasyon

| Veri | Kaynak | Seviye | Denendi mi |
| --- | --- | --- | --- |
| Adım listesi | Kurulumda 8. bölümdeki tablolardan; sonra modül sayfasından | Elle, düzenlenebilir | — |
| Yapılış, adım sonuçları, adım süreleri | Sahnedeki dokunuşlar; `core.session_started` ve `core.session_ended` | Otomatik | Olaylar çekirdekte testli (Ç3c) |
| Uyanış, yatış, planlanan saatler | `ctx.days` | Otomatik | Çekirdekte testli (Ç3c) |
| Günün özeti | Sahnenin `today` verisi | Otomatik | Çekirdekte testli (Ç3c) |
| Sabahın dizisi (başka modülün adımları dahil) | Sahnenin `chain` verisi | Otomatik | Ç3f ile geldi; Rutin'le birlikte denenmedi |
| Dokunuşsuz uyanış | iPhone Kestirmeler → `core/wake` | Otomatik (2. kurulum adımı) | Uç çekirdekte testli (Ç3d); gerçek telefonda denenmedi |
| Kestirmeler'in Sherpa'yı açması | iPhone Kestirmeler | Otomatik (2. kurulum adımı) | Denenmedi |

Modülün kendi `ingest` türü ve zamanlanmış işi yoktur: dışarıdan gelen tek veri uyanıştır ve o çekirdeğin ucudur. Modül dışarıya hiçbir şey göndermez. Yapay zeka çağrısı yoktur.

## 5. Kurallar

- `core.session_started` ile yapılış açılır, `core.session_ended` ile kapanır.
- **Sıklıklı adım.** `every_days` taşıyan adım, son yapılışından o kadar gün geçtiyse o günün listesine girer; kaçırılırsa ertesi gün yine görünür. Sayaç son yapıldığı günden işler, takvimden değil; uzun bir aradan sonra bir kez gelir, kaçan günler için tekrar etmez. Sabit hafta günü yoktur.
- **Ek.** `parent_id` taşıyan adım (Dercos) bağlı olduğu adımın ekranında, vadesi geldiği gün ek bir satır olarak görünür; ayrı adım sayılmaz ve "bu sabah" sayısına girmez.
- **Aşamalı açılış.** Araştırmadaki fazlar adımların "Açık" anahtarıyla uygulanır: kurulumda yalnızca 1. faz adımları açıktır. Temel adımlar son 7 günün en az 5'inde yapıldıysa bir sonraki fazın kapalı adımı "açılabilir" olur ve Düzenlilik'teki "Değişenler" kutusunda tek cümle ve "Aç" düğmesiyle görünür. Açma kararı kullanıcınındır.
- **Kaçan gün.** Seri, sayaç, "kaçırdın" uyarısı yoktur. Dün yapılmayan rutin için ek bir şey yapılmaz; ritim her gün önerilir, birikmez.
- **Akşam hatırlatması.** Planlanan yatıştan 3 saat önce tek satırlık modül uyarısı (`alerts`): "Işıkları kıs; son büyük öğün." (A1, A2). Takip edilmez.
- **Sürelerin öğrenilmesi (onay istemez).** İki katman: (1) çekirdeğin tahmin çarpanı (`docs/04-planlayici.md`, "Öğrenme") planı Rutin'in gerçek süresine kendiliğinden uydurur; (2) modül, listede yazan adım sürelerini de günceller: `seconds_auto` olan adımın en az 7 geçerli kaydı varsa süresi son 14 kaydın ortancasına çekilir (dakikaya yuvarlanır; haftada bir, hafta kurulmadan önce). Atlanan ve `bulk` kayıtlar hesaba girmez. Değişiklik "Değişenler" kutusunda bilgi olarak görünür. Kullanıcı bir süreyi elle değiştirince `seconds_auto` kapanır; "Otomatiğe dön" yeniden açar. Süresiz alt adımların süresi adımın toplamından öğrenilir.
- **Sayım.** "En az yapılanlar" ve "tamam" sayıları yalnızca bloğun çalıştığı günler üzerinden hesaplanır; çalışmadığı gün "atlandı" sayılmaz.
- Yayınlayacağı olay: yok (dinleyeni yok).

## 6. Teklif ettiği işler

Üç ritim; üçü de tekrar biçimindedir ve bütün alanlarını modül doldurur. Yapay zekaya bırakılan alan yoktur; `sizingHints` yoktur (`size` çağrısı yapılmaz).

| Alan | `rutin:sabah` | `rutin:hazirlik` | `rutin:aksam` |
| --- | --- | --- | --- |
| `source` | `{ type: 'rutin.routine', id: <sabah satırı> }` | `{ type: 'rutin.routine', id: <hazirlik satırı> }` | `{ type: 'rutin.routine', id: <aksam satırı> }` |
| `title` | Sabah | Duş ve hazırlık | Akşam kapanışı |
| `when.recurrence` | günde 1, taban 1 | günde 1, taban 1 | günde 1, taban 1 |
| `effort.session_minutes` | açık adımların sürelerinin toplamı | açık adımların sürelerinin toplamı | açık adımların sürelerinin toplamı |
| `fit` | `light`, `home` | `physical`, `home` | `light`, `home` |
| `timing` | `anchor: 'wake'`, `order: 10` | `anchor: 'wake'`, `order: 30` | `anchor: 'bed'`, `order: 10` |
| `facet` | `sabah` | `sabah` | `aksam` |
| `meta` | `{ routine: 'sabah' }` | `{ routine: 'hazirlik' }` | `{ routine: 'aksam' }` |

- **Sabahın dizisi.** Uyanış → Sabah (diş bakımı, su, günün planı) → hareketler (Spor modülü, kurulunca; sıra 20) → Duş ve hazırlık (duş, SPF, giyinme, yürüyüş). Spor kurulana kadar iki Rutin bloğu art arda gelir. Ekrandaki "bu sabah n / m" sayısı diziden hesaplanır, sabit yazılmaz (Spor yokken 6, varken 7).
- **Süre.** Adım listesi ya da bir adımın süresi değişince modül aynı `key` ile yeniden teklif eder. Giyinme ve yürüyüş adım oldukları için süreleri hazırlık bloğundadır; çalışma penceresi yürüyüşten sonra başlar.
- **Salon günü (ileride, kapsam dışı).** Kullanıcının kuralı: günde tek duş; plana salon antrenmanı girdiği gün duş kendiliğinden antrenmanın ardına gelir, sabahki duş adımı o gün görünmez. Bu bağ bugünkü zaman kısıtlarıyla kurulamaz (çekirdek notu 10). Salon programı olmadığı sürece duş her gün sabahtadır.
- **Sahne koşulu.** Çalışan iş bu modülün ritmiyse sahne gelir: `sabah` ve `hazirlik` sabah sahnesini, `aksam` akşam sahnesini kullanır.
- **Geri çekme.** Bir rutin kapatılırsa (`rutin_routines.active = false`) ritmi `withdraw` edilir.

## 7. Veri girişi

Günlük giriş yok. Adım düzenleme modül sayfasında yapılır. Hızlı giriş düğmesi (+) Rutin'e adım eklemez.

## 8. Arayüz

### 8.1 Adımların başlangıç listesi

Süreler başlangıç değeridir; kendiliğinden öğrenilir. "Temel" ve "Açık" sütunları anahtarların ilk halidir.

**Sabah** (uyanışta)

| Sıra | Adım | Alt adımlar | Süre | Temel | Açık | Araştırma |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Diş bakımı | Su jeti (süresiz) · Fırçala, 2 dk sayaç, süre dolmadan geçilmez · Dil, 25 sn · Tükür, suyla çalkalama (süresiz) | 3 dk | evet | evet | S1 |
| 2 | Bir bardak su | — (günün özeti ekranda ve sesli) | 1 dk | hayır | evet | S2 |

**Duş ve hazırlık** (hareketlerden sonra)

Araştırma duşu akşama koymuştu; kullanıcı uykuya dalmakta sorun yaşamadığı için sabaha, hareketlerden sonraya aldı (13 Kas 2026).

| Sıra | Adım | Alt adımlar / not | Süre | Temel | Açık | Araştırma |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Duş | ılık; parmak aralarını kurula | 10 dk | evet | evet | A3 |
| ek | Dercos şampuan (Duş'un eki) | köpüğü 3–5 dk beklet; `every_days` 3 | — | hayır | evet | A3 |
| ek | Nasır kremi (Duş'un eki) | üreli krem; `every_days` 2 | 1 dk | hayır | hayır (faz 2) | A5 |
| 2 | SPF | Yarım çay kaşığı kadar al · Yüz, boyun ve kulaklara yay | 3 dk | evet | evet | S4 |
| 3 | Giyin | — | 15 dk | hayır | evet | S7 |
| 4 | Yürüyüş | çıkarken, arabaya binmeden tempolu 10–15 dk | 12 dk | hayır | evet | S8 |

Yüzü suyla yıkama (S3) duşun içinde kaldığı için ayrı adım değildir. Evden çıkılmayan gün yürüyüş "Atla" ile geçilir. Spor modülü ileride yürüyüşü ve adım sayısını üstlenirse bu adım oraya taşınır.

**Akşam kapanışı** (yatıştan önce)

Duş sabaha alındığı için günün güneş kremi ve teri yüzden akşam lavaboda temizlenir (3. adım).

| Sıra | Adım | Alt adımlar / not | Süre | Temel | Açık | Araştırma |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Antiperspirant | kuru cilde | 1 dk | evet | evet | A4 |
| 2 | Diş bakımı | Ara fırça ya da ağız duşu (süresiz) · Fırçala, 2 dk sayaç, süre dolmadan geçilmez · Dil · Tükür, çalkalama; sonra yalnızca su | 3 dk | evet | evet | A6 |
| 3 | Yüz | Nazik temizleyiciyle yıka · Nemlendirici | 3 dk | hayır | evet | A3, A7 |
| ek | Azelaik asit (Yüz'ün eki) | `every_days` 2 | — | hayır | hayır (faz 2) | A7 |
| — | Yarının listesi | çekirdeğin kapanışına geçiş (`kind: closing`); açılınca Yüz ile Telefon arasına girer | — | evet | hayır (faz 2) | A8 |
| 4 | Telefonu salona bırak | Şarja tak · Çalar saati kontrol et; düğme "Yatıyorum" | 2 dk | evet | evet | A9 |

### 8.2 Sahne: adım ekranı

Düzen sabahta ve akşamda aynıdır (ortak kurallar: `ORTAK.md` bölüm 3).

- **Üst şerit (cam):** saat, bölümün rengi ve adı, başlangıçtan beri geçen süre, "Çık".
- **Başlık:** adımın adı; süreli alt adım çalışırken altında büyük sayaç; yoksa tek satır ipucu.
- **"Bu adımda" paneli:** alt adımlar numaralı, en çok üç satır: şimdiki (vurgulu, altında notu) ve sıradaki ikisi. Biten alt adım yukarı kayarak çıkar; başlıkta "2 / 4" yazar. Alt adımı olmayan adımda tek satır ve ipucu. Vadesi gelen ek (Dercos) burada ek satırdır.
- **Küçük panel "Sıradaki":** bir sonraki adımın adı, "bu sabah 3 / 7" (akşamda "bu akşam 2 / 4"), adım başına bir çizgi, altında kalan adımlar tek satırda. Son adımda "Sonra" (günün sıradaki işi ve saati), akşamın son adımında "Yarın" (uyanış, uyku) gösterir.
- **Düğmeler:** "Sonraki" (son adımda "Bitti", akşamda "Yatıyorum"), "Atla", "Hepsini yaptım" (son adımda görünmez).
- **"Sonraki"** önce alt adımlar arasında, son alt adımdan sonra bir sonraki adıma geçirir.
- **Süreli alt adım:** süre bitince kendiliğinden sıradaki alt adıma geçer ve adını söyler; kullanıcı sayaca dokunarak durdurur. `hold` açıkken süre dolana kadar ana düğme soluk "Erken geç · basılı tut" olur. Süresiz alt adım dokunuş bekler. Sayaç `part_started_at` saat damgasından hesaplanır; ekran kapanıp açılınca doğru yerdedir. Süreli alt adım boyunca ekran açık tutulur.
- **Cihazlar.** Hangi adımda olunduğu modülün tablosundadır ve iki cihazda canlı olarak aynıdır. Telefon elde tutulan birincil ekrandır; pano uzaktan okunan görünümdür: solda başlık, büyük sayaç ve "Bu adımda" paneli; sağda üstte günün planı (akşamda "Yarın": uyanış, uyku, ilk sabit iş), altında dizinin tamamı ("Bu sabah" / "Bu akşam": yapılan işaretli, şimdiki vurgulu, başka modülün adımında modül etiketi); altta aynı üç düğme. Panoda yan menü görünür kalır. Telefon duşta banyoda kenarda, giyinirken yanında durur; bu adımlar için özel düzenek yoktur.
- **Ses.** Günün özeti ve geçilen alt adımın adı söylenir; ipuçları yalnızca ekranda yazar. Yalnızca dokunulan cihaz konuşur.
- **Hareket azaltma tercihi:** kayma ve solma yerine anlık değişim.

### 8.3 Sabahın akışı

Çizim: "Sabah · uçtan uca".

1. **Alarm.** Kullanıcıyı iPhone'un alarmı uyandırır; telefon gece salonda durduğu için alarmı durdurmaya kalkıp gider (kullanıcının cevabı, 14 Kas 2026). Alarm durdurulunca Kestirmeler uyanışı yazar ve Sherpa'yı açar (2. kurulum adımı). İki saat ayrı tutulur: uyanış alarmın durduğu an, rutinin başlangıcı "Kalktım" dokunuşudur.
2. **Günaydın.** Selam ve tarih; başka içerik yok. Tek düğme "Kalktım". Sahne burada bekler; süre saymaz, konuşmaz. Bu ekran adım değildir. **Yalnızca uyanış dışarıdan (alarmdan) geldiğinde görünür.** Kullanıcı uygulamayı kendisi açıp Bugün'deki "Uyandım"a bastıysa (alarmsız gün ya da bağlantı kurulmadan önce) Günaydın ekranı atlanır: o dokunuş sesin kilidini zaten açmıştır, doğrudan 3. adımdaki gibi Diş bakımı ve günün planı gelir. İki yolda da tek dokunuş vardır.
3. **"Kalktım".** Dokunuş telefonda sesin kilidini açar; Diş bakımı görünür ve günün planı sesli anlatılmaya başlar. Anlatım adım değişse de bitene kadar sürer.
4. **Bir bardak su.** Özetin yazılı hali ekrandadır; "Tekrar anlat" vardır. Ses kapalıysa yalnızca yazılı görünür.
5. **Hareketler.** Sıra Spor'un işine gelince Spor'un kendi sahnesi açılır (kendi zemini); bitince sabah sahnesine dönülür (Ç3f). Kaydı Spor'dadır.
6. **Duş, SPF, Giyin, Yürüyüş.** Yürüyüşte düğme "Bitti"dir; telefon cepte, arabaya binerken basılır.
7. **"İyi günler".** "Bitti"den sonra ekranda yalnızca bu yazı durur; sayı, süre, övgü yok. Yazı solarken Bugün ekranı belirir (yaklaşık 0,6 sn; cihazda ayarlanır).

Özet metni çekirdeğin `today` verisinden kalıpla kurulur: ilk sabit blok ve saati, günün 3 işi, bitiş çizgisi, bu gecenin yatışı. Örnek: "Günaydın. 10:30'da dersin var. Bugünün üç işi: … Gün 19:00'da bitiyor."

### 8.4 Akşamın akışı

Çizim: "Akşam · uçtan uca".

1. **Başlangıç.** Kendiliğinden açılmaz. Günün işleri bitince ya da saati gelince "Şimdi" kartına gelir; kullanıcı "Başla"ya basar.
2. **Dört adım:** Antiperspirant → Diş bakımı → Yüz → Telefonu salona bırak.
3. **"Yatıyorum".** Telefon salona bırakılıp yatağa girmeden hemen önce basılır; yatış o an kaydedilir.
4. **"İyi geceler".** Altında "Işık kapalı." ve "Yarın" kutusu (iki satır: Uyanış saati, Uyku yaklaşık süresi); en altta küçük "Geri al". Ekran birkaç saniye sonra kararır (süre cihazda ayarlanır) ve gün kapanır. "Geri al" yatış kaydını siler ve akşam sahnesini son adımda yeniden açar (uyuyamayıp telefona dönülen gece için); ekran karardıktan sonra uygulama yeniden açılırsa "İyi geceler" ekranı ve "Geri al" yine görünür.

**Yatış kaydı (kullanıcının kararı, 14 Kas 2026).** "Yatıyorum" gerçek yatışta basılır; yarım saatlik pay yoktur ve uyku süresi düzeltilmez. Önerilen çerçeve ayarı: uyanış 06:00–08:00, yatış 22:00–24:00, uyku hedefi 8 saat (araştırmadaki ev ayarı: uyanış 07:00, ışık kapalı 23:00).

### 8.5 Görünüş

Ortak kurallar `ORTAK.md` bölüm 2'dedir. Rutin'e özel olanlar:

- **Zemin:** günün saatine göre gökyüzü; adım ilerledikçe değişmez. Kasım ortasında 07:00'de kalkılan sabahın çoğu şafak öncesidir, güneş yürüyüşte ufukta belirir; yazın aynı saatte yukarıdadır. Bugün ekranıyla aynı zemin olduğu için sabah bitince zemin değişmez.
- **Manzara:** gökyüzü ufukta biter (yüksekliğin yaklaşık %73'ü); altında üç tepe katmanı ve sis. En yakın sırt her zaman koyudur; alttaki düğmeler onun üzerinde durur.
- **Akşam:** gece gökyüzü; yıldızlar baştan görünür. Ay ufka yakın, sağda durur; yeri ve evresi hesaplanmaz. Dalda küçük baykuş silüeti durur; yalnızca "İyi geceler" ekranında gözleri kapalıdır.
- **Metin:** şafakta ve gecede açık metin, koyu cam; gündüz gökyüzünde koyu metin, açık cam. Eşik cihazda ayarlanır.
- **Hareket:** neredeyse durağan (bulut çok yavaş kayar, birkaç yıldız hafifçe titreşir). Hareket azaltma tercihinde sürekli hareket olmaz.
- Renkler, tepe eğrileri, baykuş ve yıldız ölçüleri çizim dosyalarındadır; kurulumda oradan alınır.

### 8.6 Modül sayfası

Çekirdeğin beş bölgeli iskeleti; çizim: "Modül sayfası".

- **Başlık:** modülün rengi, ad, "Sağlık ›" (alan sayfasına bağlantı), "Adım ekle".
- **Durum şeridi:** son 7 günde sabahın ve akşamın tamam olduğu gün sayısı; panoda ayrıca ortalama uyanış, yatış, uyku. Rutin durum şeridine öneri vermez.
- **Sekmeler:** Sabah, Akşam. **Düzenlilik** aynı satırda ayrı düğmedir (bölüm değil, iki bölümün geçmiş görünümü).
- **Sabah sekmesi:** sabahın tamamı tek listede, sahnedeki sırayla numaralı, üç grup: Sabah, Hareketler (Spor'dan gelen satır; anahtarı yok, dokununca Spor'a gider), Duş ve hazırlık. Grup başlığında bağlamı ve "toplam n dk" (hesaplanır, girilmez). Satırda ad, özet (süre, alt adım sayısı, sıklık), varsa "temel" etiketi, açık/kapalı anahtarı. Ekler girintili ve numarasız; kapalı adımlar soluk. Adımlar kendi grubunda sürüklenerek sıralanır.
- **Akşam sekmesi:** aynı düzen; altında "Yatakta · kaydedilmez: Işık kapalı." notu.
- **Adımı düzenle** (telefonda alttan cam sayfa, panoda sağdan yan panel): ad; "Süre · otomatik" (− / +; elle değişince "Süre · elle" ve "Otomatiğe dön"); sıklık (Her gün / N günde bir, seçilince "Kaç günde bir"); "Temel adım"; "Açık"; ekse "Şunun eki"; "Adımı sil". Alt adımlar: sürükleyerek sırala, ada dokunarak yeniden adlandır, süre hapına dokunarak ayarla, çarpıyla çıkar, "Alt adım ekle". "Kaydet".
- **Alt adımın süresi:** süre (− / +), "Sayaç göster", "Süre dolmadan geçme", not, "Süreyi kaldır".
- **Adım ekle:** aynı sayfa boş; ek olarak "Nereye" (Sabah / Hazırlık / Akşam) ve "Sırası".
- **Adımı sil onayı:** "Sil", "Kapat" (silmek yerine kapatır), "Vazgeç". Geçmiş kayıtlar kalır.
- **Düzenlilik:** son 14 günün uyanış ve yatış saatleri nokta olarak, hedef aralıklar açık şerit; ortalama uyanış, yatış, uyku. "Temel adımlar · 14 gün": iki satır kare (Sabah, Akşam), altında "Dolu: o günün temel adımları yapıldı." Boş gün gri kalır. "En az yapılanlar · 14 gün": en çok üç adım, yalnızca sayı ("Yürüyüş · 10 sabahın 3'ü"); dokununca adımın düzenleme sayfası. "Değişenler": kendiliğinden yapılan süre değişiklikleri (bilgi) ve açılabilir faz adımı ("Aç").
- **Yaklaşanlar:** çekirdeğin doldurduğu liste (panoda sağ sütun, telefonda listenin altında).
- **Çip:** günün rutinlerinin durumu.
- Modüle özel ayrı bir ayar ekranı yoktur.

## 9. Mod davranışı

Dört modda da aynı: ağırlık çarpanı 1, taban çarpanı 1 (rutinler her modda günde 1 kalır). Ayrı bir "kısa gün" düğmesi yoktur; dar sabahta tek tek "Atla" yeter.

## 10. Haftalık rapor ve öğrenme

Ayrı bir iş açılmaz. Rapora giden sayılar: sabahın ve akşamın tamam olduğu gün sayısı, ortalama süre, en az yapılan adımlar. Öneri cümlesi üretilmez. Öğrenme 5. bölümdedir.

## 11. Açık sorular

Yok. Kapananlar: antiperspirant etiketi (kurulumu etkilemez; adım sıradan bir adımdır), gece plağı (cümle "Işık kapalı." oldu; plak alınınca kullanıcı ekler), günün sözü (bırakıldı).

### Kapsam dışı bırakılanlar

- **Gün içi adımlar.** El yıkama (G6), 30 dakikada bir kalkma (G2), kafein saati (G5), SPF yenileme (G4) ölçülemez; takip edilmez. Yemek sonrası yürüyüş (G1) ve adım sayısı (G3) Spor modülü tasarlanırken ele alınır.
- **Boyun hareketleri ve tam set (S5, S6):** Spor modülü. Rutin'in "tamam"ı bunlara bağlı değildir.
- **Periyodik görevler** (sakal 14 gün, fırça başlığı 90 gün, diş hekimi 180 gün) ve **tek seferlikler**: ilk sürümde yok. Tek seferlikler hızlı girişten iş olarak girilebilir; periyodikler Hayat idaresi modülüne adaydır.
- **Salon günü duşu** (çekirdek notu 10) ve **araştırma sohbetinden adım listesi almak**: iki hafta kullanımdan sonra değerlendirilir.

## Simülasyon (5. adım, 14 Kas 2026)

Modül kâğıt üzerinde on bir durumdan geçirildi. "Bulgu" tasarımda değişiklik ya da açık kural gerektiren yerdir; her bulgunun çözümü yanında yazılıdır.

| # | Durum | Ne olur | Bulgu |
| --- | --- | --- | --- |
| 1 | Sıradan gün (Cuma, 10:30 ders) | 07:00 alarm durur, Sherpa açılır, "Kalktım"; 7 adım; 07:55 "İyi günler", Bugün. 22:05 işler biter, kapanış "Şimdi"de; 22:30 "Yatıyorum". | Yok |
| 2 | Geç kalkış (08:40, 10:30 ders) | Dizi yine sırayla gelir; 55 dk sığmaz. Kullanıcı hareketleri ve yürüyüşü "Atla" ile geçer; temel adımlar yapılır, kare dolar. | Ayrı "kısa gün" düzeneği yok; "Atla" yeterli. Atlanan adım öğrenmeye girmez. |
| 3 | Alarm otomasyonu çalışmadı | Kullanıcı uygulamayı kendisi açar; Bugün ekranındaki "Uyandım" uyanışı yazar ve dizi başlar (Ç3f). | Yok; Kestirmeler yalnızca kolaylıktır, bağımlılık değildir. |
| 4 | Evden çıkılmayan gün | Yürüyüş "Atla" ile geçilir; "Bitti" yerine son adım Giyin olmaz, yürüyüş atlanınca sabah biter. | B1 |
| 5 | Sabah yarıda kaldı (dişten sonra telefon bırakıldı) | Yapılan adımlar kayıtlıdır; "Duş ve hazırlık" hiç başlamadıysa o blok yapılmamış sayılır, kare boş kalır. Uyarı, yığın yok. | B2 |
| 6 | Akşam hiç yapılmadı (kanepede uyuyakalma) | "Yatıyorum" yok; çekirdek yatışı tahmin eder, ertesi sabah Günaydın olağan çalışır. Akşam karesi boş. | Yok (ürün kuralı 3). |
| 7 | Gece yarısından sonra yatış (00:40) | Kapanış önceki günün gecesine aittir. | B3 |
| 8 | Kötü hafta (3 gün hiç açılmadı) | Birikme olmaz: ritimler günlüktür, kaçan gün yeniden planlanmaz. Kareler gri, uyarı yok. Dönüşte Dercos gibi "N günde bir" adımlar vadesi geçtiği için ilk gün gelir. | B4 |
| 9 | İki cihaz açık (pano ve telefon) | Adım iki ekranda birlikte ilerler. | B5 |
| 10 | Diş sayacı sırasında ekran kilitlendi | Sayaç saat damgasıyla işler; açınca doğru yerdedir. | B6 |
| 11 | Spor modülü henüz yok | Dizi Sabah → Duş ve hazırlık; "bu sabah" 6 adım sayar. Spor kurulunca 7 olur. | Yok; sayı diziden hesaplanır, sabit yazılmaz. |

**Bulgular ve çözümleri**

- **B1 · Atlanan adımın gürültüsü.** Evde geçen günlerde yürüyüş hep atlanır; "şunu küçült" türü bir öneri her hafta çıkardı. Çözüm: öneri tümüyle kaldırıldı; "En az yapılanlar" yalnızca sayı gösterir ve sayım bloğun çalıştığı günler üzerinden yapılır.
- **B2 · Yarım kalan sabahın ne zaman düştüğü.** Uyanışa bağlı iş günün "tamam"ını bekletmez (`docs/04-planlayici.md`), ama öğleden sonra hâlâ "Şimdi"de ya da sırada görünüp görünmediği denenmedi. Beklenen: sabah blokları öğleden sonra sessizce düşer. Kurulumun 1. adımında denenir; düşmüyorsa çekirdek notu 13.
- **B3 · Günün hangi güne yazıldığı.** `rutin_runs.day` takvim gününden değil, çekirdeğin gününden alınır: akşamın 12:00'den önce başlayan yapılışı önceki günün gecesidir (çekirdeğin yatış kuralı); sabahınki, o takvim gününün uyanışı kayıtlıysa (`ctx.days`) ve yapılıştan önceyse o gündür, uyanış yokken 05:00'ten önce önceki gündür. Çekirdeğin gecesi "05:00 ya da uyanış aralığının başı, hangisi erkense" biter; modül çerçeve ayarını okuyamadığı için yalnızca 05:00'i kullanır (uyanış aralığı 05:00'ten erken başlarsa ve uyanış kaydı yoksa ayrışır; çekirdek notu 16). Kabul ölçütü 7.
- **B4 · Aradan sonra "N günde bir".** Vadesi geçen ek, dönüşün ilk gününde bir kez gelir; kaçan günler için tekrar etmez. Sayaç son yapıldığı günden işler, takvimden değil.
- **B5 · İki cihazda ses.** Günün planı iki cihazda birden okunmamalı. Beklenen: yalnızca "Kalktım"a basılan cihaz okur. Çekirdeğin `say` davranışı bu durumda denenmedi; kabul ölçütüne girer.
- **B6 · Kilitli ekranda kendiliğinden geçiş.** Süre bitince sıradaki alt adımın adı söylenir; iOS'ta ana ekrandaki web uygulaması ekran kilitliyken ses çıkaramaz. Çözüm: süreli alt adım boyunca ekran açık tutulur (Screen Wake Lock). iPhone'da ana ekran uygulamasında çalışıp çalışmadığı denenmedi; kabul ölçütüne girer. Çalışmazsa sayaç yine doğru işler, yalnızca sesli geçiş olmaz.

**Rutinin zamanla değişmesi (kullanıcının notu, 14 Kas 2026).** Adımlar sabit değildir: kullanıcı araştırma sohbetinde öğrendikçe yeni adım, ürün ve alt adım ekleyecek, var olanı düzeltecek. Tasarım buna hazırdır (adımlar veridir; ekleme, düzenleme, sıralama, kapatma modül sayfasından). Araştırma sohbetinden adım listesini doğrudan içeri almak (ör. `/api/ingest` ile) şimdilik kurulmaz; iki hafta kullanımdan sonra, elle eklemek yük oluyorsa değerlendirilir ("Fikirler").

## Kurulum adımları ve kabul ölçütleri (6. adım)

Üç adım. Her adımın sonunda `npm run check:full` geçer, `CLAUDE.md` komutları ve `docs/ILERLEME.md` günceldir. "Gerçek telefonda" yazan ölçütleri kullanıcı dener; sonucu `docs/ILERLEME.md`'ye yazılır. Çekirdeğe dokunmak gerekirse Claude Code durur ve sorar.

### Adım 1 · Temel (Ç3f yayınlandıktan sonra)

Kapsam: dört tablo ve RLS; başlangıç adım listesi; üç ritim teklifi; sabah ve akşam sahnesi (adım ekranı, alt adımlar, süreli alt adım düzeneği, Günaydın, "İyi günler", "İyi geceler"); sahnenin camı ve gökyüzü modülün içinde (çekirdek notu 14); iki cihazda eşzamanlı ilerleme; günün özetinin sesli ve yazılı hali; modül sayfasında Sabah ve Akşam sekmeleri, adım düzenleme, ekleme, sıralama, silme; kayıt (`rutin_runs`, `rutin_run_steps`, geçen süre dahil).

Kabul ölçütleri:

1. Modül etkinleştirilince üç ritim teklif edilir; uyanış kaydından sonra Bugün ekranında sabah dizisi sırayla görünür (Sabah, sonra Duş ve hazırlık) ve Sabah bitince Duş ve hazırlık kendiliğinden başlar.
2. Sahne 8.2'deki düzendedir; "bu sabah n / m" diziden hesaplanır (yalnızca Rutin varken m = 6; `deneme` modülü araya uyanışa bağlı bir iş koyunca artar ve o işin sahnesine geçilip dönülür).
3. Diş bakımında "Fırçala" sayacı bitince kendiliğinden "Dil"e geçilir; süre dolmadan ana düğme "Erken geç · basılı tut"tur ve kısa dokunuş geçirmez, basılı tutmak geçirir. Sayaç sırasında sayfa yenilenince sayaç doğru yerden sürer.
4. "Atla" adımı `skipped`, "Sonraki" `done` yazar; "Hepsini yaptım" kalanları `done` ve `bulk` yazar. Temel adımların hepsi yapıldıysa `minimum_done` doğrudur.
5. Son adımda düğme "Bitti"dir; ardından "İyi günler" görünür ve Bugün ekranına dönülür. Akşamda "Yatıyorum" yatışı çekirdeğe yazar, "İyi geceler" görünür; "Geri al" yatış kaydını siler ve sahneyi son adımda yeniden açar (çekirdek yatış kaydını geri almaya izin vermiyorsa Claude Code durur ve sorar; çekirdek notu 15). Uyanış ekrandaki "Uyandım" dokunuşuyla yazıldıysa Günaydın ekranı atlanır ve Diş bakımı doğrudan gelir; uyanış `core/wake` ucundan geldiyse Günaydın ekranı görünür.
6. `every_days` 3 olan ek, son yapılışından 3 gün sonra Duş ekranında görünür; 5 gün ara verilince bir kez görünür. (Birim testi; şimdiki zaman parametre.)
7. Gece yarısından sonra basılan "Yatıyorum" önceki günün yapılışına yazılır. (Veritabanı testi.)
8. Modül sayfasında bir adımın adı, süresi, sıklığı, temel ve açık anahtarı, alt adımları değiştirilir; yeni adım eklenir; adım kapatılır ve silinir. Her değişiklikten sonra ritmin süresi yeniden teklif edilir ve sahne yeni listeyi kullanır.
9. Bir cihazda "Sonraki"ye basılınca öbür cihazdaki sahne bir saniye içinde aynı adıma gelir. (Uçtan uca test, iki bağlam.)
10. Sahnede sistemin hareket azaltma ve saydamlığı azaltma tercihleri uygulanır; metin ile zemin arasındaki karşıtlık şafak, gündüz ve gece zeminlerinde en az 4,5:1'dir (ölçümle).
11. Yapılmayan sabah bloğunun öğleden sonra Bugün ekranında nasıl göründüğü denenir ve sonucu yazılır (simülasyon B2; düşmüyorsa çekirdek notu 13 açılır, modülde çözülmez).
12. Gerçek telefonda (kullanıcı): cam panellerin görünüşü ve kaydırma akıcılığı; süreli alt adımda ekranın açık kalması ve "Dil" sözünün duyulması; pano ve telefon birlikte açıkken günün planının yalnızca dokunulan cihazda okunması.

### Adım 2 · Veri bağlantıları ve öğrenme (iki hafta kullanımdan önce de kurulabilir)

Kapsam: iPhone Kestirmeler bağlantısı (alarm durunca uyanışın yazılması ve Sherpa'nın açılması) için kurulum yönergesi; Düzenlilik görünümü (uyanış ve yatış grafiği, temel adım kareleri, "En az yapılanlar", "Değişenler"); adım sürelerinin kendiliğinden güncellenmesi; aşamalı açılışın "açılabilir" kuralı; akşam hatırlatması (`alerts`); haftalık rapora giden sayılar.

Kabul ölçütleri:

1. Düzenlilik düğmesi sekmelerden ayrı durur; açıkken hiçbir sekme seçili görünmez. Grafik `ctx.days` verisinden çizilir; kayıt olmayan gün boş kalır.
2. Sabah karesi yalnızca iki bloğun açık temel adımlarının hepsi yapıldıysa dolar; bloğun çalışmadığı gün gri kalır ve "En az yapılanlar"da paydaya girmez. (Birim testi.)
3. Bir adımın 7 geçerli kaydı olunca süresi ortancaya çekilir; `bulk` ve atlanan kayıtlar hesaba girmez; elle değiştirilmiş süre değişmez; değişiklik "Değişenler"de görünür. (Birim testi; saf fonksiyon.)
4. Temel adımlar son 7 günün 5'inde yapıldıysa kapalı faz adımı "Değişenler"de "Aç" düğmesiyle görünür; düğme adımı açar.
5. Planlanan yatıştan 3 saat önce akşam hatırlatması bir kez görünür.
6. Gerçek telefonda (kullanıcı): alarm durdurulunca uyanış kaydı düşer; Kestirmeler ana ekrandaki Sherpa'yı açar (açamıyorsa ne olduğu yazılır; çekirdek notu 8); uygulama açılınca Günaydın ekranı kendiliğinden gelir.

### Adım 3 · Çekirdeğin cam diline bağlanma ve faz 2 (Ç4'ten sonra)

Kapsam: sahnenin kendi cam ve gökyüzü kopyasının çekirdeğin bileşenleriyle değiştirilmesi; modül sayfasının cam diline geçmesi ("Modül sayfası" çizimleri); "Yarının listesi" adımı (`controls.closing()` ile çekirdeğin kapanışına gidip sahneye dönmek).

Kabul ölçütleri:

1. Sahne ve Bugün ekranı aynı gökyüzü bileşenini kullanır; sabah bitince zemin değişmeden Bugün ekranına geçilir.
2. Modül sayfası "Modül sayfası" çizimlerindeki düzendedir (telefon ve pano); modülün içinde cam ve gökyüzü kopyası kalmaz.
3. "Yarının listesi" adımı açılınca akşam sahnesinden çekirdeğin kapanışına geçilir ve bitince "Telefonu salona bırak" adımına dönülür.

## Çekirdek için notlar

Tasarım sırasında görülen eksikler. 2, 7 ve 11 numaralılar Ç3f adımına alındı (13 Kas 2026; `docs/12-sahne-ve-otomasyon.md` bölüm G, `prompts/c3f-capali-diziler.md`); Rutin'in ilk kurulum adımı Ç3f'den sonra yapılır. 1 numara Ç3f'te sıra kuralı olarak yazıldı. Ötekiler açık. 14 numara bu dosyanın son halinde eklendi.

1. **Modüller arası çapa sırası.** Rutin ve Spor ayrı modüller olarak uyanışa bağlı iş teklif eder. `timing.order` modülün kendi verdiği sayıdır; iki ayrı modülün işlerinin birbirine göre sırasını kimin belirlediği sözleşmede açık değil.
2. **Sahneden akşam kapanışına geçiş.** Kapanış çekirdeğin ayrı ekranıdır (`/kapanis`); bir modül sahnesinin adımı olarak nasıl açılıp sahneye nasıl dönüleceği tanımlı değil (akşam 4. adım).
3. **Alan sayfasının çekirdek verisini okuması.** Sağlık sayfasında uyku gösterilecek; uyku kaydı çekirdektedir. Alan sayfasının veriyi nasıl topladığı Sağlık sayfası tasarlanırken netleşmeli.
4. ~~**Yatışın ileri saatle kaydı.**~~ Kapandı (14 Kas 2026): kullanıcı "Yatıyorum"a yatağa girmeden hemen önce basacak; pay ve düzeltme gerekmiyor.
5. **Geç yatılan gecede uyanış.** Çekirdek gerçek yatıştan sonra beklenen uyanışı `yatış + uyku hedefi`ne kaydırır; araştırma kalkışın en çok 1 saat ertelenmesini önerir. Uyanış aralığı 06:00–08:00 olunca olağan durumda sonuç aynıdır; aralık geniş tutulursa ayrışır.
6. **Uzun aralıklı tekrar.** Tekrar biçimi gün, hafta ve ay tanır; 90 ve 180 günde bir yapılan iş doğrudan ifade edilemiyor (Hayat idaresi için gerekecek).
7. **Dışarıdan kaydedilen uyanıştan sonra rutinin başlaması.** "Uyandım'dan sonra ilk rutin kendiliğinden başlasın" ayarı ekrandaki dokunuş için tanımlı. Uyanış alarm otomasyonundan (`core/wake`) gelince, uygulama açıldığında uyanışa bağlı ilk işin kendiliğinden başlayıp başlamadığı belirsiz; başlamıyorsa kullanıcı önce "Başla"ya, sonra "Kalktım"a basar (iki dokunuş).
8. **Ana ekrandaki uygulamayı Kestirmeler'den açmak.** iOS'ta ana ekrana eklenen web uygulaması kendi adres şemasını kaydetmez; Kestirmeler'in onu doğrudan açıp açamadığı denenmedi. Açamıyorsa adres Safari'de açılır (oturum ayrı olabilir).
9. **Dokunuşsuz anlatım.** iPhone'da web uygulaması dokunuş olmadan konuşamaz. Planın alarm kapanır kapanmaz, dokunmadan okunması istenirse Kestirmeler'in özet metnini Sherpa'dan alması gerekir; cihaz anahtarları bugün yalnızca yazabilir, okuma ucu yok.
10. **"Şundan hemen sonra" kısıtı.** Kullanıcının isteği: plana salon antrenmanı girdiği gün duş kendiliğinden onun ardına gelsin; antrenman yoksa sabah dizisindeki yerinde kalsın. Bugünkü `timing` yalnızca saate, uyanışa ve yatışa bağlar; başka bir işe (hele başka modülün işine) bağlayamaz. `depends_on` yalnızca kalemler arasında ve "bitmeden başlamaz" anlamındadır. Gereken genel yapı: bir iş "şu işareti taşıyan iş o gün plandaysa onun hemen ardına" diyebilmeli (işaret, öbür işin kendi beyanı; modüller birbirini tanımaz), yoksa kendi öbür kısıtlarına dönmeli; ayak izi ve çapalı diziler buna göre hesaplanmalı. Spor modülü kurulmadan önce çekirdek kararı olarak ele alınmalı. Sabah hareketleri için bu kısıt gerekmez: duş uyanış dizisinde hareketlerden sonraki sıradadır.
11. **Çapalı dizinin tek akış olması.** Kullanıcının isteği: uyanışa bağlı işler (Rutin'in Sabah bloğu, Spor'un hareketleri, Rutin'in Duş ve hazırlık bloğu) ekranda tek bir sabah olarak görünsün ve aralarında "Başla"ya basmak gerekmesin. İki eksik: (a) sahne, parçası olduğu dizinin öbür işlerini bilmiyor (`today` yalnızca günün 3 işini ve blokları taşır; başka modülün çapalı işi gelmez); (b) bir çapalı iş bitince sıradaki kendiliğinden başlamıyor (`start_on_wake` yalnızca ilkini başlatır). Gereken genel yapı: çekirdek sahneye diziyi versin (her işin adı, modülü, süresi, durumu) ya da diziyi kendi şeridinde göstersin, ve dizideki sıradaki işi kendiliğinden başlatsın (ayarla). Yatışa bağlı dizi için de aynısı geçerli. Spor modülü kurulmadan önce çekirdek kararı olarak ele alınmalı.
12. **Sağlık alanı sayfasına veri (kullanıcının sorusu, 14 Kas 2026).** Kullanıcı sağlıkla ilgili bütün trendleri tek yerde görmek istiyor: uyku (çekirdeğin uyanış ve yatış kaydı), Rutin'in düzenliliği, Spor'un ve Beslenme'nin sayıları, ayrıca bunlardan türetilen metrikler (uyku düzenliliği, uyku açığı, modüller arası ilişkiler). Yeri alan sayfasıdır (`/a/saglik`). Denetlenecek: sözleşmede bir modülün alan sayfasına zaman serisi ve seçilmiş görünüm vermesinin karşılığı var mı; modüller arası türetilmiş metrik nerede hesaplanır (çekirdek mi, alan mı). Tek bir "sağlık puanı" önerilmedi (keyfi olur, suçluluk üretir). Sağlık sayfası Spor tasarlandıktan sonra ayrı bir oturumda çizilir. Rutin'in vereceği: Düzenlilik sekmesindeki uyku grafiği ve temel adım kareleri. **Erişim (öneri, 14 Kas 2026; çizim tuvalde "Modül sayfası" sayfası, 5. kare).** Alan sayfasına iki yerden girilir, yeni menü öğesi açılmaz: (a) Modüller ekranı modülleri alanlarına göre gruplar; her grubun başlığı alanın tek satırlık özetini ve "Alan sayfası ›" düğmesini taşır; (b) modül sayfasının başlığındaki alan adı ("Sağlık ›") bağlantıdır. Bugün ekranına alan girişi konmaz (tek odak). `docs/ILERLEME.md` alan sayfasının hiçbir fazda olmadığını ve kodda bulunmadığını yazıyor; hangi faza gireceği açık.
13. **Yapılmayan çapalı işin gün içinde düşmesi (simülasyon B2).** Uyanışa bağlı bir iş sabah yapılmadıysa öğleden sonra "Şimdi"de ya da sırada kalmamalı; denenmedi. Kalıyorsa çapalı işe bir son saat gerekir (ör. uyanıştan birkaç saat sonra o gün için düşer).
14. **Cam dili ve gökyüzü bileşeni çekirdekte yok.** Cam paneller, günün saatine göre gökyüzü (güneş yüksekliği hesabıyla), telefonun alt menüsü ve geçiş kuralları çekirdek ekranları için `docs/09-kararlar.md` "Fikirler"de duruyor ve Ç4'e aday. Rutin Ç4'ten önce kurulursa sahnenin camını ve gökyüzünü kendi içinde taşır (1. kurulum adımı); çekirdek bunları sağlayınca modül kendi kopyasını bırakıp çekirdeğinkini kullanır (3. kurulum adımı). Güneş yüksekliği hesabı saf fonksiyondur; taşınırken testleriyle birlikte taşınır.

15. **Yatış kaydının geri alınması.** "İyi geceler" ekranındaki "Geri al" yatış kaydını silip günü yeniden açmalı. Çekirdeğin bunu bir sahneden yapmaya izin verip vermediği denetlenmedi (`controls` ve gün kaydı); 1. kurulum adımında bakılır.
16. **Sahneye ve olaylara çekirdeğin günü gelmiyor (Rutin 1. adımda görüldü).** Modül bir yapılışın hangi güne ait olduğunu bilmek zorunda (B3), ama `SceneProps`, `TodayBrief` ve `core.session_started` yükü planlama gününü taşımıyor ve modül `settings.day_frame`'i okuyamıyor. Rutin çekirdeğin kuralını kendi içinde kopyalıyor (`server/flow.ts`, `runDay`: akşamda 12:00, sabahta uyanış kaydı ya da 05:00). Gereken: `TodayBrief.date` (planlama günü) ya da oturum olaylarında `day`; çekirdek değişince modül kopyasını bırakır.
