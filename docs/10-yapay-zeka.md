# Yapay zeka katmanı

Sherpa'nın arkasında, bütün işleri gören ve zamanı planlayan bir yapay zeka çalışır. Temel kural: **yapay zeka karar önerir ve veriye yazar; planlayıcı motoru o veriyle günü yürütür ve kısıtları denetler.** Yapay zekaya ulaşılamadığında ya da aylık bütçe dolduğunda uygulama motorla çalışmaya devam eder.

## İş bölümü

| İş | Kim | Neden |
| --- | --- | --- |
| Girişi işe çevirmek: modül, süre, enerji, bağlam, önem | Yapay zeka | Kullanıcı bunları elle girmek zorunda kalmasın |
| Modülden gelen iş zarfının boş yargı alanları: toplam efor, oturum uzunluğu | Yapay zeka | Modül olguyu bilir, süreyi bilmez; tahmin kullanıcının geçmişine dayanmalı |
| Hedefi kilometre taşlarına bölmek | Yapay zeka | Yargı gerektirir |
| Haftanın kalemleri ve modül payları; ay ufkunda sıkışma önerileri | Yapay zeka önerir, motor denetler | Bütüne bakış yargı ister; kapasite hesabı kod ister |
| Büyük işi adımlara bölmek | Yapay zeka | Yargı gerektirir |
| Serbest metni yönlendirmek (gelen kutusu, Ninova duyurusu) | Yapay zeka | Yapısız metin |
| Yarının planı: günün 3 işi, sıra, neyin erteleneceği | Yapay zeka önerir, motor denetler | Modüller arası denge yargı ister; saat hesabı kod ister |
| Haftalık denge, yetişmeyecek işler, mod önerisi | Yapay zeka | Bütüne bakış |
| "Gün dağıldı, yeniden planla" | Yapay zeka önerir, motor denetler | İstisna durumu |
| Yuvaların üretimi, kapasite, kısıt denetimi | Motor | Aritmetik; kesin ve test edilebilir olmalı |
| "Şimdi ne yapıyorum" seçimi | Motor | Her dakika ve her dokunuşta; anında ve ücretsiz olmalı |
| Oturum takibi, ritim borcu, tabanlar | Motor | Kural |

## Çağrılar

| Çağrı | Ne zaman | Model | Girdi | Çıktı |
| --- | --- | --- | --- | --- |
| `enrich` | Her hızlı girişte | hızlı | Metin, modüllerin `intake` kataloğu, benzer 5 geçmiş işin gerçek süresi, bugünün tarihi | Modül, tür, başlık, süre, enerji, bağlam, önem, son tarih; gerekiyorsa adımlar; her alan için güven |
| `size` | Bir modül, yargı alanları boş bir iş zarfı teklif ettiğinde; kalemin kapsamı değişince | hızlı | Zarf (`meta` dahil), modülün `sizingHints` metni, aynı modülün benzer bitmiş kalemlerinin gerçek süreleri | Toplam efor, oturum uzunluğu, gerekiyorsa önem ve enerji; güven ve gerekçe |
| `decompose` | Kullanıcı bir hedef ya da büyük bir kalem eklediğinde | planlama | Hedef, son tarih, modül bağlamı | Alt kalemler, sıra ve bağımlılıklar, her birinin kaba eforu |
| `extract` | Ninova duyurusu ya da yapıştırılan metin geldiğinde | hızlı | Metin, yayın tarihi, dersin açık değerlendirmeleri | Değerlendirme önerisi: hangi kalem, tarih, saat, yer, kapsam |
| `plan` | Her gece bir kez; akşam kapanışı açılırsa o an | planlama | Motorun taban planı, aday işler (özet), sabit bloklar, kapasite, dünün sonucu, kapanış notu | Günün 3 işi, sıra tercihleri, ertelenecekler, süre düzeltmeleri, uyarılar; her biri gerekçeli |
| `week` | Cumartesi; hafta içinde yeniden kurma tetiklenince | planlama | `loadByWeek` çıktısı, aday kalemler, tabanlar, geçen haftanın sonucu | Haftanın kalemleri, modül başına saat payı, bırakılacaklar; gerekçeli |
| `month` | Ayda bir; büyük bir kalem eklenince | planlama | Önümüzdeki 6–8 haftanın yük tablosu, kalem özetleri | Sıkışan haftalar için öneriler: öne çekme, bırakma, mod |
| `replan` | Kullanıcı isteyince | planlama | `plan` ile aynı + günün şu ana kadarki durumu + kullanıcının notu | Günün kalanı için aynı yapı |
| `review` | Cumartesi sabahı | planlama | Modül raporları, haftanın oturumları, önümüzdeki 4 haftanın yükü | Özet, en fazla 3 öneri, mod önerisi |

Modeller ortam değişkeninden okunur, kodda sabit yazılmaz:

```
AI_MODEL_FAST=claude-haiku-5-5       # enrich, size, extract
AI_MODEL_PLAN=claude-sonnet-5-5      # plan, replan, week, month, review, decompose
```

## Tasarım kuralları

1. **Yalnızca sunucuda.** API anahtarı Vercel ortam değişkenindedir; istemciye hiçbir zaman gitmez. Bütün çağrılar `src/core/ai/` içindeki tek geçitten yapılır.
2. **Yapılı çıktı.** Her çağrı, çıktısını bir JSON şemasıyla verir (API'nin yapılı çıktı biçimi, `output_config.format`; şema Zod ile yazılır) ve geçit çıktıyı aynı şemayla yeniden doğrular. Şemaya uymayan çıktı atılır, o işlem yapay zekasız devam eder.
3. **Öneri, emir değil.** Yapay zeka son tarih değiştiremez, iş silemez, kayıt tamamlayamaz. Bunları yalnızca önerir; kullanıcı tek dokunuşla onaylar. Doğrudan yazabildikleri: yeni işin alanları, süre tahmini, önem, planlanan gün, günün 3 işi.
4. **Kaynağı belli.** Yapay zekanın koyduğu her değer işaretlidir (`tasks.ai`) ve gerekçesiyle saklanır. Kullanıcının elle değiştirdiği alanı yapay zeka bir daha değiştirmez.
5. **Motor son sözü söyler.** `plan` çıktısı motora girdi olur. Kapasiteyi aşan, bloklarla çakışan, 90 dakika sınırını ya da bitiş çizgisini çiğneyen öneri motor tarafından düzeltilir ve düzeltme uyarı olarak gösterilir.
6. **Arayüz beklemez.** Serbest giriş anında gelen kutusuna yazılır; `enrich` sonucu gelince iş ya da iş kalemi olur (aşağıda "Akışlar"). Zaman aşımı 8 saniye; aşılırsa giriş gelen kutusunda kalır.
7. **Az bağlam.** Hiçbir çağrı bütün veritabanını görmez. `plan` için motor önce adayları süzer ve en fazla 80 işin kısa özetini gönderir (kimlik, başlık, modül, süre, son tarih, önem, enerji).
8. **Düzeltmelerden öğrenme.** Kullanıcı yapay zekanın koyduğu bir değeri değiştirince kayıt düşer (`ai_feedback`). `enrich` isteklerine o modülün son 10 düzeltmesi örnek olarak eklenir. Model eğitilmez; yalnızca örnekler güncel tutulur.
9. **Bütçe sınırı.** Her çağrının belirteç sayısı ve maliyeti kaydedilir (`ai_calls`). Aylık toplam ayarlardaki sınıra ulaşınca yapay zeka o ay kapanır ve ekranda tek satırla bildirilir.
10. **İstikrar.** Efor bir kez tahmin edilir; plan her sabah baştan kurulmaz. Yeniden tahmin ve yeniden taahhüt yalnızca `docs/04-planlayici.md` içindeki tetikleyicilerle olur. Aynı girdi için önceki sonuç kullanılır (çağrı tekrarlanmaz).
11. **Gizlilik.** Gönderilen veri iş başlıkları, ders adları, tarihler ve kullanıcının yazdığı notlardır. Şifre, kimlik bilgisi ve iş yerine ait içerik gönderilmez (iş görevleri zaten Sherpa'da tutulmaz).

## Maliyet

Fiyatlar 10 Kasım 2026'da resmi fiyat sayfasından alındı (milyon belirteç başına): Haiku 5.5 girdi 0,10 $, çıktı 0,50 $; Sonnet 5.5 girdi 2 $, çıktı 10 $. Kurulumdan önce [güncel sayfaya](https://platform.claude.com/docs/en/about-claude/pricing) bakılmalı.

Aşağıdaki kullanım varsayımdır; gerçek rakam `ai_calls` tablosundan izlenir.

| Çağrı | Varsayılan kullanım | Çağrı başına belirteç (girdi / çıktı) | Aylık maliyet |
| --- | --- | --- | --- |
| `enrich` (Haiku) | Günde 15 | 1.500 / 200 | ≈ 0,11 $ |
| `size` (Haiku) | Günde 5 | 1.500 / 200 | ≈ 0,04 $ |
| `extract` (Haiku) | Günde 5 | 1.000 / 200 | ≈ 0,03 $ |
| `plan` + `replan` (Sonnet) | Günde 2 | 6.000 / 1.000 | ≈ 1,32 $ |
| `week` + `review` (Sonnet) | Haftada 2 | 15.000 / 2.000 | ≈ 0,40 $ |
| `month` + `decompose` (Sonnet) | Ayda 4 | 10.000 / 2.000 | ≈ 0,16 $ |
| **Toplam** | | | **≈ 2,1 $ / ay** |

Maliyetin neredeyse tamamı planlama çağrılarındadır. Bu yüzden:

- Varsayılan aylık sınır **5 $**; ayarlardan değişir.
- `plan` günde bir kez çalışır; her dokunuşta değil. Gün içi değişiklikleri motor karşılar.
- Planlama kalitesi yetmezse `AI_MODEL_PLAN` daha güçlü bir modele çevrilir (Opus 5.5 yaklaşık iki kat maliyet); kod değişmez.
- Toplu işlem (Batch) indirimi ve istem önbelleği bu hacimde kayda değer tasarruf getirmez ve karmaşıklık ekler; kullanılmaz. Hacim büyürse yeniden bakılır.
- API hesabının kendi panelinde de harcama sınırı ayarlanmalı; uygulamadaki sınır ikinci güvenliktir.

## Tablolar

```
ai_calls
  kind text                     -- enrich, size, decompose, extract; Ç3'ten itibaren plan, replan, week, month, review
  model text
  input_tokens int, output_tokens int
  cost_usd numeric
  ok boolean, error text null
  duration_ms int
  subject_type text null, subject_id uuid null
  fingerprint text null         -- çağrının kendi girdisinin kısa özeti (kural 10: aynı girdi yeniden sorulmaz)
  output jsonb null             -- başarılı çağrının doğrulanmış çıktısı

ai_feedback
  module_slug text
  kind text                     -- hangi çağrının çıktısı düzeltildi
  input_summary text            -- örnek olarak kullanılacak kısa girdi
  ai_value jsonb, user_value jsonb
```

İki tablo da `events` gibi yalnızca eklenir ve okunur (izinler de böyle verilir): ayın harcaması kayıt değiştirilerek küçültülemez. Sağlayıcıya ulaşan her çağrı bir satırdır; başarısız olan da (zaman aşımı, şemaya uymayan çıktı) kaydedilir. Sağlayıcıya hiç gitmeyen istek (anahtar yok, yapay zeka kapalı, bütçe dolu, aynı girdinin önceki sonucu kullanıldı) satır üretmez.

Aylık toplam veritabanında hesaplanır (`ai_spend_since`, `ai_usage_since`; çağıranın yetkisiyle): bir ayın satırları API'nin tek sayfasına sığmayabilir. Ay, İstanbul saatine göre ayın ilk günü 00:00'da başlar.

`tasks.ai` alanı (jsonb):

```json
{ "kind": "enrich", "model": "claude-haiku-5-5", "at": "2026-11-12T08:14:00Z",
  "call_id": "…",                -- değerlerin geldiği `ai_calls` satırı
  "input": "Sunum slaytları cuma", -- çağrının gördüğü kısa girdi; düzeltme örneği olarak saklanır
  "fields": { "est_minutes": { "value": 45, "confidence": 0.7, "reason": "benzer 3 hazırlık işi ortalama 50 dk sürdü" },
              "importance": { "value": 3, "confidence": 0.8, "reason": "ağırlığı %20, 4 gün kaldı", "kind": "size" } },
  "user_edited": ["est_minutes"],
  "scope": "…" }                 -- yalnızca `size`: tahminin yapıldığı kapsam (başlık, meta, sınırlar)
```

Alandaki `kind`, alanı işaretin ilk çağrısından başka bir çağrı koyduysa yazılır. İş kaleminde `provenance` `ai` olmayan alan (modül ya da kullanıcı sonradan yazdıysa) işarette dursa da yapay zekanın sayılmaz.

`settings` tablosuna: `ai_enabled boolean`, `ai_monthly_budget_usd numeric default 5`.

## Geçit (`src/core/ai/`)

- `runAiCall(deps, spec, input)` tek giriş noktasıdır; sağlayıcının SDK'sını yalnızca bu klasör içe aktarır (lint kuralı ve test).
- Sıra: sağlayıcı ve fiyatı olan model var mı → ayarlarda açık mı → aynı soru daha önce yanıtlandı mı (`fingerprint`) → ayın harcaması bütçenin altında mı → çağrı (zaman aşımıyla) → şema doğrulaması → kayıt. İlk dört adımın herhangi birinde çağrı yapılmaz ve satır yazılmaz; önceki yanıt bütçe dolmuş olsa da kullanılır.
- Fiyat tablosu `pricing.ts` içindedir; tabloda olmayan model çağrılmaz (maliyeti sayılamaz). Model değiştirmek tabloya satır eklemeyi gerektirir.
- Zaman aşımı hızlı çağrılarda 8, planlama çağrılarında 30 saniyedir (`AI_TIMEOUT_FAST_MS`, `AI_TIMEOUT_PLAN_MS` ile değişir). Sağlayıcı yeniden denemez; bekleme süresinin tamamı zaman aşımıdır.
- Kaydedilemeyen yanıt kullanılmaz: bütçe kayıttan hesaplanır.
- Sahte sağlayıcı (`fake.ts`) kayıtlı kurallarla yanıt verir; yalnızca `SHERPA_AI_FAKE=1` verilmiş ve veritabanı yerel olduğunda devreye girer (testler, anahtarsız geliştirme).

## Akışlar (Ç2)

Her çağrının bir akışı vardır (`src/core/ai/flows/`): girdiyi kurar, geçitten geçirir, sonucu veriye yazar. Tarayıcı akışı `/api/ai/<çağrı>` rotasıyla başlatır ve yanıtı beklemez; yazılan veri canlı bağlantıyla ekrana gelir. Rotalar oturumu kendileri denetler ve veritabanına kullanıcının istemcisiyle yazar.

| Akış | Tetikleyen | Ne yazar |
| --- | --- | --- |
| `enrich` | Hızlı girişte serbest satır (önce gelen kutusuna yazılır) | Emin (`module` ve `target` güveni ≥ 0,6, modül etkin): satır bir işe ya da iş kalemine çevrilir, giriş `routed` olur. Emin değil: giriş `needs_confirm` olur, öneri `suggestion` içinde saklanır; kart onaylanınca aynı yazma tarayıcıda yapılır, kullanıcı modülü değiştirdiyse bu da düzeltme olarak `ai_feedback`'e düşer. Yanıt yok: giriş `new` kalır |
| `size` | Modülün teklifi: yeni iş kalemi ya da kapsamı (başlık, `meta`, sınırlar) değişmiş olabilecek kalem | Kaynağı boş ya da `default` olan yargı alanları (toplam efor, oturum süresi, önem, enerji); efor modülün sınırına kırpılır. Yapay zekanın daha önce koyduğu değer yalnızca kapsam değişince yeniden sorulur: sunucu işaretteki `scope` ile kalemin bugünkü kapsamını karşılaştırır. Modülün ve kullanıcının değerine dokunulmaz; arada kalem düzenlendiyse tahmin yazılmaz. Girdideki benzer kalemler: aynı modülün başlığı en çok benzeyen bitmiş kalemleri |
| `decompose` | Kullanıcı "adımlara böl" der | Kalemin altına `proposed` alt kalemler (bağımlılıklarıyla). Kullanıcı kabul edince `active`, reddedince `dropped` olur. Bekleyen öneri varken yeniden sorulmaz |
| `extract` | Modül yapıştırılan metni okutur | Hiçbir şey; öneriler modüle döner, ne olacaklarına modül karar verir |

- Kullanıcının kendi yazdığı (satır sonundaki gün ve süre) alan yapay zekanın değildir; işareti yoktur.
- Alt kalemlere bölünmüş kalem, açık alt kalemi oldukça Bugün listesinde kendisi görünmez; alt kalemleri onun yerine geçer.
- `ai` işaretindeki her alan onu koyan çağrıyı da taşır (`kind`); düzeltme o çağrının adıyla kaydedilir.
- Durum rotası (`GET /api/ai/status`) geçidin sırasıyla yapay zekanın şu an çalışıp çalışmadığını (hızlı modele göre) ve ayın harcamasını verir.
- Düzeltme (`ai_feedback`) ancak kullanıcının düzenlemesi kaydedildikten sonra yazılır.

## Plan çağrısının akışı

1. Motor `buildPlan` ile taban planı kurar (yapay zekasız geçerli bir plan).
2. Sunucu taban planı, aday özetlerini ve bağlamı `plan` çağrısına gönderir.
3. Yapay zeka düzeltmeleri döndürür: `top3`, `prefer` (öne alınacaklar), `defer` (ertelenecekler ve gerekçesi), `estimates` (süre düzeltmeleri), `splits` (bölünecek işler ve adımları), `warnings`.
4. Sunucu düzeltmeleri veriye yazar (`planned_date`, `est_minutes`, yeni adım işleri) ve motoru yeniden çalıştırır.
5. Sonuç `days.plan` olur; `plan_source = ai`. Gerekçeler planla birlikte saklanır ve ekranda "neden?" ile açılır.
6. Herhangi bir adım başarısız olursa 1. adımdaki taban plan geçerlidir (`plan_source = auto`).

## Kalite denetimi

`scripts/ai-eval/`: kullanıcının gerçek girişlerinden 30 örnek ve beklenen sonuçları. İstem ya da model değişince çalıştırılır; yönlendirme doğruluğu ve süre tahmini sapması raporlanır. Maliyeti birkaç senttir.

## Uygulama notu

Anthropic SDK'sının ve araç kullanımının güncel biçimi için kurulum sırasında resmi dokümana bakılır; sürüm ve parametre adları ezberden yazılmaz.
