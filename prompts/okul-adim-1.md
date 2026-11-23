# Okul, 1. adım: Temel

Claude Code'a yalnızca şunu yaz:

> `prompts/okul-adim-1.md` dosyasını oku ve uygula.

Ön koşul: `okul-cekirdek-a-tamam` etiketi ve Okul çekirdek A'nın yayında olması (`docs/ILERLEME.md`). Notion dışa aktarımı 23 Kas 2026'da üretildi ve `data/notion-export/` altındadır (dört dosya ve `README.md`; depoya girmez). Klasör yoksa durma: her şeyi kur, uydurma veriyle sına, gerçek aktarımı "Senden bekleyenler"e yaz.

---

## Görev

Okul modülünün 1. kurulum adımını kur. Tasarım `docs/moduller/okul.md` (onaylı, 23 Kas 2026); kareler `docs/tasarim/kareler/okul/`, ekran dokümanları `docs/tasarim/ekranlar/okul-sahneler.md` ve `okul-sayfalar.md`. Bu oturumda yalnızca Adım 1 yapılır; paket B ve C'ye, Adım 2 ve 3'e girme, bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Tek fark: bu bir modül oturumudur; BASLA'daki "Modül hattına girme" cümlesi burada geçerli değildir, yalnızca Okul kurulur. Adımın adı **Okul 1**, etiket `okul-1-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/okul-1/`.

Adım 1 bittiğinde kullanıcı şunları yapabilmelidir: dönemin bütün sınav, ödev ve projelerini tek listede ve ders ders görmek; derslerini günün akışında görmek, derste tek cümle not almak ve devamını işaretlemek; ödev ve proje alt işlerini Bugün'den başlatıp sahnede yürütmek, kaldığı yeri not etmek, teslimi kontrol listesiyle kapatmak; sınavların yükünü planda yer tutucu süreyle görmek; dokümanını kendisi hazırladığı sınavı tek dokunuşla işaretleyip hazırlık oturumlarını başlatmak. Ninova, Kepler, dosyalar, bildirim ve tahmini tarih Adım 2'dedir; hazırlık dokümanlarının üretimi ve bölümlü sınav oturumları Adım 3'tedir; bu adımda sınava yalnızca "Dokümanım hazır" işaretiyle, bölümsüz oturumlarla çalışılır.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md` (özellikle **"Okul Adım 1 için sözleşme özeti"**, "Okul çekirdek A" raporu ve "Bilinen sorunlar"daki Okul çekirdek A satırları), `docs/09-kararlar.md` (16–23 Kas)
- `docs/moduller/okul.md` (tamamı; bağlayıcı tasarım), `docs/moduller/ORTAK.md`, `docs/moduller/okul-cekirdek-notlari.md` ("Kararlar" ve paket A'nın "kuruldu" işaretleri)
- `docs/06-modul-sozlesmesi.md` (tamamı; özellikle "Modül sayfası", "Sabit blok görünümü", "Sahne", "Sahne yerleşimleri", "Bölümler", "İş zarfı ve `propose`", "Sunucu zemini")
- `docs/08-notion-aktarim.md`, `docs/03-veri-modeli.md` (zarf, bloklar), `docs/04-planlayici.md` (oturumlara bölme), `docs/10-yapay-zeka.md` (`size`)
- `docs/tasarim/README.md`, `ilkeler.md`, `parcalar.md`; `docs/tasarim/ekranlar/okul-sahneler.md`, `okul-sayfalar.md`, `sahne.md`, `moduller.md`, `bugun.md`; `docs/tasarim/kareler/okul/DIZIN.md` ve aşağıda adı geçen kareler
- `src/modules/_sablon/`, `src/modules/deneme/` (paket A'nın çalışan örnekleri: `components/LayoutScenes.tsx`, ana sayfalı sayfa kipi, `blockView`, `beforeExit`, yer tutucu süre), `src/modules/rutin/`

## Sözleşmedeki adlar

Kesin adlar `docs/ILERLEME.md`'deki özet tablosunda ve `docs/06`'dadır; bu istemdeki ad onlarla çelişirse onlar geçerlidir. Tasarım dokümanlarındaki eski önerilerden farklı olan üç şey:

- Sayfa ayarları tek nesnededir: `ui.page` (`home`, `facetView`, `pickLabel`, `status`, `subtitle`, `upcoming`, `history`, `entries`). `ui.home` yoktur.
- Önceki gerçekleşenler zarfta değil, tanımdadır: `ModuleDefinition.sizingActuals(item, ctx)`.
- `StepRunner` yoktur; kontrol listesi yerleşimi `Checklist`'tir (süreli adım dahil).

Okul'un kullanacağı parçalar: `ui.page`, `ModuleFacet.detail`, `SceneStrip.allotted` ve `detail`, `controls.finish(counted)` ve `controls.stop(counted)`, `effort.provisional` ve `effort.basis`, `sizingActuals`, `PomodoroLayout`, `FlowLayout`, `Checklist`, `TimeUpCard`, `ResumeNote`, `SessionFile`, `SessionEnd`, `useSessionEnd`, `ModuleScene.beforeExit`, `ui.blockView`, `ui.backdrop`, `ctx.ask`, `jobs`.

## İlk iş

1. `docs/ILERLEME.md`'de Durum'u "Okul 1. adım sürüyor" yap ve kısa planı yaz.
2. Çalışma ağacındaki commit edilmemiş doküman ve istemleri (bu istem, `docs/moduller/okul*.md`, öbür tasarım sohbetlerinin dosyaları) ilk commit'e kat; içeriklerine dokunma. Commit edilmemiş **kod**, onaylı görüntü ya da ekran görüntüsü varsa (23 Kas akşamı `src/core/ui/module/ModulePageShell.tsx` ve birkaç görüntü öyleydi) kimin işi olduğunu `docs/ILERLEME.md`'den anla: paket A'nın kapanmamış düzeltmesiyse `npm run check` yeşilken ayrı bir commit'le ve raporda yaz; anlaşılmıyorsa dokunma, kullanıcıya sor.
3. Modülü `_sablon`'u kopyalayarak `src/modules/okul/` altında aç (`slug: "okul"`, `kind: "term"`) ve kayıt defterine ekle.

## Bu istemde verilen kararlar

Tasarımın açık bıraktığı ya da paket A'nın sınırından doğan teknik kararlar (kullanıcının "teknik kararlarda Claude'un önerisi" kuralıyla, Okul tasarım sohbeti, 23 Kas 2026). `docs/09-kararlar.md`'ye işle.

1. **Tablo adları `okul_` ile başlar** (sözleşme: modülün tabloları `<slug>_`). `okul.md` bölüm 3 ve `docs/08` `school_` yazıyor; ikisini de `okul_` olarak düzelt. Bu adımda yalnızca kullanılan tablolar açılır: `okul_terms`, `okul_courses`, `okul_assessments`, `okul_sessions`, `okul_class_notes`. `okul_prep_docs` da açılır (karar 2); dosya, kural ve okuma tabloları sonraki adımlarındır. Yerleşim durumu ve "kaldığın yer" notu için gereken alanları sen yerleştir (değerlendirmede sütun ya da ayrı küçük tablo) ve `okul.md` bölüm 3'e yaz.
2. **Sınav hazırlığı: yük ve "Dokümanım hazır".** Her quiz, midterm ve final için bir hazırlık kalemi teklif edilir: efor yer tutucudur (`effort.provisional`), süreyi `size` kestirir (ipuçları `meta`, `sizingHints` ve `sizingActuals`'tan; modül sabit sınır vermez, kural 9), `when.due` sınavın anı. Sözleşme yer tutucuyu eforsuz kabul etmiyorsa çalışan en yakın biçimi kur ve raporda yaz.
   - **İşaretsizken yalnızca yüktür:** `when.earliest` doküman günüdür (quiz −7 gün, midterm ve final −14 gün); o gün gelmiş kalemin `earliest`'i modülün günlük işiyle (`jobs`) ertesi güne itilir, oturum açılmaz.
   - **"Dokümanım hazır"** (kullanıcının kararı, 23 Kas 2026; `okul.md` kural 7 ve 10, giriş `docs_ready`): sınav ayrıntısında tek dokunuşluk anahtar. Açılınca `okul_prep_docs`'ta sınavın iki çıktısı `ready`, `produced_by = manual` olur (dosya ve bölüm yok), `earliest` o an olur ve hazırlık çekirdeğin böldüğü oturumlarla açılır (en çok 90 dk; efor yer tutucu kalır). Kapatılınca açık oturum işleri geri çekilir, çalışan oturum durdurulur, biten oturumlar ve ilerleme durur, kalem işaretsiz haline döner. Önerilen yol: `withdraw` ve hemen ardından aynı `key` ile yeniden teklif (sözleşme: geri çekilen `key` yeniden teklif edilince aynı kayıt geri gelir); testle doğrula, olmuyorsa çekirdek notu yaz.
   - Bu, Adım 3'teki elle üretim yolunun ilk halidir; geçici ayrı bir mekanizma kurma. Tablo ve durumlar `okul.md` bölüm 3'teki `prep_docs` ile aynıdır (bu adımda kullanılmayan sütunları da aç: `file_path`, `version`, `parts`, `missing`, `due_on`); Adım 3 aynı kayda dosyayı ve bölümleri bağlayacak.
   - Sahnesi `PomodoroLayout`'tur (yöntem ayarında "Konu okuma"): başlık "… hazırlığı", alt başlık sınavın günü ve saati, ilerleme satırı ("Bu quizin hazırlığı 2 sa / yaklaşık 8 sa"); "Bu oturumda" kutusu, "Aç" ve "Kaldığın yer" yoktur (bölüm ve dosya yok); çıkarken not sorulmaz. "Süre doldu" kartı ve son oturumda "Bugünlük yeter" öbür işlerdeki gibidir. Bugün kartında tek satır yalnızca süredir. En yakın kareler `K1T1`, `K1T2`–`K1T5`, `K1T7` (bölüm kutusu olmadan). Anahtarın ve bölümsüz sahnenin karesi yok: **görüşün gerek**.
3. **Sınavın kendisi sabit bloktur** (tarihi, saati ve süresi biliniyorsa `when.fixed`); plan o saati dolu görür. Sınav günü görünümü Adım 3'tedir: bu adımda `blockView.when` yalnızca ders ve recitation bloklarını seçer.
4. **Dersler sabit blok olarak teklif edilir:** dönemin kalan her ders oturumu bir blok (`source.type` ders oturumu, `facet` ders, yer derslik). Tatil ve "yapılmadı" oturumları teklif edilmez; oturum silinince ya da tatile dönünce blok geri çekilir. Blok sayısı sorun çıkarırsa kayan pencereye (önümüzdeki dört hafta, günlük işle) geç ve raporda yaz.
5. **Teslim ayrı küçük kalemdir** (10 dk, son tarihi teslim saati, ödevin ya da alt işin kalemine bağlı). Ödevin ya da alt işin son oturumunda "Bitti" denince teslim listesi aynı dokunuşla açılır (kare `K4T5` → `K4T6`; şeridin adı "… teslimi", ayrıntısı "2 / 4"). Sözleşme sahnenin başka bir işi başlatmasına izin vermiyorsa aynı oturumda `strip` ile ad ve ayrıntıyı değiştirerek listeyi göster, çekirdek notu yaz. "Sonra yap" listeyi kapatır, kalem açık kalır. "Yükledim" `submitted_at`'i yazar (kaynak `user`) ve kalemi kapatır. Dördüncü adım ("Yüklendiği görülsün") bu adımda "Adım 2'de Ninova'dan doğrulanacak" durumundadır: satır görünür, kendiliğinden kapanmaz, listeyi bitirmeyi engellemez.
6. **Takım toplantısı** (`okul.md` bölüm 6; kare `SahneToplanti`) bu adımdadır: kullanıcı projeye toplantı ekler, sahnesi kontrol listesidir; projenin açık alt işleri sahibiyle listelenir, sahibi ve durumu oradan değişir, tek cümleyle yeni alt iş eklenir.
7. **Notion'daki Haftalık Görevler:** Hazırlık ve Teslim türündeki görevler aktarılmaz (yerlerini modülün kendi kalemleri alır; `docs/08`'deki "hazırlık görevleri kalemin altına oturum işi olur" hükmü "doküman olmadan oturum açılmaz" kuralıyla çelişiyor ve kalkar). Açık ve arşivsiz Takip ve Materyal görevleri bağımsız iş olarak aktarılır. Sınav ve Veri Girişi türleri zaten aktarılmıyor; türü boş olan görev de aktarılmaz (okul işi değil). `docs/08`'i buna göre güncelle; kuru çalıştırma aktarılmayanların sayısını türüne göre yazar.
8. **Ayarlar:** Okul ayarlarında yalnızca kurulan başlık görünür: "Çalışma" (yöntemler, pomodoro süreleri, akışta mola hatırlatması). Yöntem sayfasında yalnızca bu adımda var olan iş türleri vardır (konu okuma, yazılı ödev ve rapor, kodlama ödevi ve proje kodu) ve seçenekleri pomodoro ile akıştır. Kaynaklar, Bildirimler, Hazırlık dokümanları ve Klasör başlıkları Adım 2 ve 3'te eklenir; boş başlık çizilmez.
9. **Sahne dışından kapanan molalı oturum** çekirdekte duvar saatiyle sayılır (bilinen sınır). Okul kendi "gerçekleşen" hesabında (`sizingActuals`, ilerleme satırı) `core.session_ended`'ın `counted` değerini, yoksa sakladığı yerleşim durumundan hesapladığı odak dakikasını, o da yoksa `minutes`'ı kullanır.
10. **Çip:** metin sıradaki sınav ya da teslimdir ("Midterm · Sal"); sağlık yalnızca teslimine 24 saatten az kalmış ve yüklenmemiş iş varsa `attention`, yoksa `ok`. (**Görüşün gerek.**)
11. **Haftalık rapor** (`okul.md` bölüm 10): bu adımda birinci sayı (önümüzdeki 14 günün sınav ve teslimleri) ve devamsızlık önerisi kurulur; öbür sayılar ve öneriler verisi geldiği adımda eklenir. Sayfa başında görünmez (`status: false`).

## Yapılacaklar

### 1. Veri ve aktarım

- Tablolar (karar 1), RLS, Realtime, "Tümünü dışa aktar" listesi (`tables`). Migration yalnızca ekleme yapar.
- Türetilen değerler saf fonksiyon olarak: ağırlıklı puan, anlık toplam, açıklanan ağırlık, kalan devamsızlık, hazırlığın ilerlemesi, doküman günü (`okul.md` bölüm 3).
- `import:notion` (`docs/08`; karar 7): `--dry-run`, `external_id` ile upsert, ikinci çalıştırmada kopya yok, sonunda tablo başına sayı ve ders başına anlık toplam. Tarihsiz değerlendirme `date_status = unknown` ile girer ve plana girmez ("Tahmin edilemeyen").
- Örnek veri: `scripts/demo-okul.ts` (uydurma; karelerdeki örnek dönemi kurar: altı ders, karelerdeki işler). Ekran görüntüleri ve görsel testler bu veriyle alınır.

### 2. Bölümler, teklifler ve kurallar

- `facets`: etkin dönemin dersleri; rengi dersin rengi; `detail` "kod · sıradaki: iş · gün". Bölüm listesi tek sorguyla.
- Teklifler (`rules.ts`; `okul.md` bölüm 6, yukarıdaki kararlar): sınav hazırlığı (karar 2), sınav bloğu (karar 3), ders blokları (karar 4), ödev (tek kalem, adım yok; süreyi `size` kestirir; `earliest` açıldığı gün; kod ise akış, yazılı ise pomodoro: `output_kind`), proje alt işleri (her biri kendi kalemi, bir öncekine bağlı; yalnızca sahibi kullanıcı olanlar teklif edilir; önerilen ve bilinmeyen alt iş `effort.provisional`), teslim (karar 5), toplantı (karar 6). Oturum uzunluğu 90 dakikayı aşmaz (120 dakika paket C'dedir).
- `sizingHints` ve `sizingActuals` (aynı dersin biten ödev ve alt işlerinin gerçekleşen süreleri; karar 9).
- `onOutcome`: iş bitince ya da bırakılınca değerlendirmenin durumu güncellenir.
- Kaynak kayıt değişince teklif yenilenir; silinince geri çekilir. Kullanıcının elle değiştirdiği tarih hiçbir teklifte ezilmez (kural 1).

### 3. Girişler (`okul.md` bölüm 7)

`attendance`, `class_note`, `assessment` (tek cümle ya da kısa form; yalnızca ders sayfasında düğmesi var), `date_update`, `grade`, `submitted`, `step_edit`, çıkarken not (`resume_note`). `rule` Adım 3'tedir. Her giriş en fazla iki dokunuş ya da tek cümledir.

### 4. Modül sayfaları

`ui.page`: `home` "Ana sayfa", `facetView` ders sayfası, `pickLabel` "Ders seç", `status: false`, `subtitle` dönemin adı, `upcoming`, `history` ve `entries` kapalı. Zemin Okul'un zeminidir (`ui.backdrop`: koyu lacivert-petrol, üstte dersin renginde ışıma); renkleri karelerden `tokens.css`'e ekle.

| Ekran | Kareler | Bu adımda olmayan parçaları |
| --- | --- | --- |
| Ana sayfa | `AnaSayfa`, `PanoAna`, `DersSecici` | "n değişiklik · Ninova · Kepler" satırı, "tahmini" ve "duyurudan" işaretleri, doküman durumu satırı |
| Ders sayfası | `Ders`, `PanoDers` | "Dosyalar" girişi, Tahmin kuralları kutusu, "Not ve yoklama Kepler'den" satırı |
| Devam | `Devam` | Kepler sütunu, "ayrışıyor" durumu ve iki düğmesi |
| İş ayrıntısı | `SorumlulukAyrinti` | duyuru alıntısı |
| Sınav ayrıntısı | `SinavAyrinti`, `PanoSinavAyrinti` | doküman satırları (dosya, sürüm, "Aç", "Yeniden ürettir", `eski`), oturumların bölümleri. Dokümanlar kutusunda yalnızca "Dokümanım hazır" anahtarı (karar 2); oturumlar listesinde çekirdeğin açtığı oturum işleri (gün, süre, durum) ve kalan yer tutucu süre ("yaklaşık") |
| Ayarlar | `OkulAyarlar`, `SahneYontem`, `SahneSureler` | karar 8 |

Olmayan parça çizilmez, yeri boş bırakılmaz. Ödev ve proje için ayrıntı sayfası ve alt işi düzenleme çizilmedi: `SorumlulukAyrinti`'den türet (ödevde metin bağlantısı yok, teslim saati, oturumlar, "kaldığın yer", teslim durumu; projede alt işler sahibiyle, önerilenler "öneri" işaretli) ve "görüşün gerek" de. `Dosyalar`, `DosyaAyrinti` ve `Bildirimler` Adım 2'dedir.

### 5. Bugün ve sahneler

- **Kart** (`nowCard`): başlık ve tek satır (ne yapılacak, süre); oturum sırası, tarih, ağırlık, ilerleme yok. Kareler `K3T1`, `K3P1`, `K4T1`, `K4P1`.
- **Ödev, kod** (akış): `FlowLayout`; kareler `K3T2`–`K3T4`, `SahneAkisProje` (aynı oturuma iki alt iş düşerse ikisi listelenir). Kutular: ödev metni yoksa dosya kutusu çizilmez (dosyalar Adım 2), ilerleme satırı ("Bu ödevde 1 sa 30 dk / 3 sa", "oturum 1 / 2 · bugün 90 dk planlı").
- **Yazılı ödev, rapor, proje alt işi** (pomodoro): `PomodoroLayout`; kareler `K4T2`–`K4T4`. Alt işin içinde adım yoktur.
- **Süre dolunca:** `TimeUpCard`; "Bitti", "+5 dk" (sınırsız); işin son oturumunda üçüncü seçenek "Bugünlük yeter" (kalan, yeni oturum olarak plana döner). Kareler `K3T5`, `K4T5`.
- **Çıkarken not:** `beforeExit` (ödev ve alt işte): "Nerede kaldın?"; not Okul'un tablosunda. Sonraki oturumun başından itibaren `ResumeNote` ile görünür (telefonda dar kutu, panoda sağ sütunun başında). Kareler `K3T6`, `SahneKaldiginYerOdev`, `PanoKaldiginYerOdev`, `K4T2`.
- **Teslim ve toplantı:** `Checklist` (karar 5 ve 6); kareler `K4T6`, `K4P6`, `SahneToplanti`. Adımın durumu ve başlangıcı Okul'da saklanır; ikinci cihazda aynı adımda açılır.
- **Oturumun sonu:** `SessionEnd`, tek yazı. Sayılan dakika `controls.finish(counted)` ile bildirilir.
- **Yöntem ve süreler** ayarlardan gelir; sahnede değiştirilmez. Ses çalınmaz.
- Yerleşim durumu oturuma bağlı saklanır (`PomodoroState.session`, `FlowState.session`); aynı işin ikinci oturumu eskisinden sürmez.

### 6. Ders: blok görünümü ve devam

- `ui.blockView` (`when`: ders ve recitation blokları; `label` "Dersi aç"). Kareler `SahneDers` (ders sürerken), `PanoDersSahne` (ders bitince). Şeritte `detail`: "derste", "ders bitti".
- Ders sürerken: saat çizgisi ve "Bitişe …"; "Derste söylenen" (tek cümle not: `class_note`; her notta "Tarihe çevir" → değerlendirme formu o dersle açılır, kaydedilince not çevrilmiş sayılır); "Not al", "Sınav ya da teslim ekle"; "Derste değilim" oturumu "girmedim" işaretler ve görünümden çıkar (**görüşün gerek**). "Bu hafta" dosya kutusu Adım 2'dedir.
- Ders bitince: "Derse girdin mi?" (Girdim, Girmedim, Yapılmadı), derste yazılanlar, sıradaki iş. Soru **yalnızca devam şartı olan derste** çıkar; Kepler cümlesi bu adımda yazılmaz. Aynı soru görünüm açılmadıysa Bugün'de olay sorusu olarak sorulur (`ctx.ask`); biri cevaplanınca öbürü kapanır. Telefonda "ders bitti" hali çizilmedi: pano karesinden türet, "görüşün gerek".
- "Yapılmadı" oturumu `holiday` yapmaz; devam hesabında paydadan düşer.

## Bu adımda yapılmayanlar

Ninova ve Kepler okuması, toplayıcı, dosyalar ve klasör, duyurudan tarih, tahmini tarih (`due_estimated`), bildirim, teslimin kendiliğinden doğrulanması (Adım 2 ve paket B); hazırlık dokümanlarının üretimi ve dosyası, bölümlü sınav oturumları, soru sayacı ve tek blok, "Kaldığın yer"in hazırlık hali, sınav günü görünümü, tahmin kuralları, ders çarpanı (Adım 3 ve paket C). Bunların tablosu, ayarı ve boş ekranı da açılmaz.

## Çekirdek sınırı

Modül çekirdeğe yalnızca sözleşmeyle bağlanır; `src/core/` modülü içe aktarmaz, Okul başka modülü tanımaz. Çekirdek eksiği çıkarsa kendin çözme: modülde çalışan en küçük haliyle bırak, `docs/moduller/okul-cekirdek-notlari.md`'nin sonuna "Adım 1'de çıkanlar" başlığıyla yaz, raporda say ve devam et; durma. İstisna: aşağıdaki iki testin ortaya çıkardığı çekirdek hatası düzeltilir (paket A'nın kapsamıdır) ve raporda ayrı yazılır.

## Testler

Önceki fazların testleri beklenti gevşetilmeden geçer. Yeni testler en az şunları sınar:

- **Paket A'dan devreden iki test (Okul ikisini de kullanıyor):**
  1. **Blok görünümü telefonda:** telefon projesinde dersin bloğuna günün akışından ve Takvim'in gün ayrıntısından dokununca Derste görünümü açılır; oturum açılmadığı veritabanından doğrulanır; "Çık" Bugün'e döner. (Paket A'da `okul-cekirdek.spec.ts` yalnızca pano projesinde koşuyordu.)
  2. **Kontrol listesi ikinci cihazda:** teslim listesinde bir cihazda ilerlenen adım öbür cihazda yenilemeden aynı adımda görünür; süreli bir adımda iki cihaz aynı süreyi gösterir (`deneme`'nin süreli adımıyla ya da Okul'un listesiyle).
- **Aktarım:** uydurma dışa aktarımla kuru çalıştırma hiçbir şey yazmaz; aktarım sayıları tutar; ikinci çalıştırma kopya üretmez; tarihsiz değerlendirme plana girmez; karar 7'deki türler aktarılmaz.
- **Türetilenler** (birim): ağırlıklı puan ve anlık toplam (`excluded` hariç), kalan devamsızlık ("Yapılmadı" paydadan düşer), doküman günü.
- **Teklifler** (veritabanı): sınav hazırlığı yer tutucu ve `earliest` ile açılır, oturum işi açılmaz, günlük iş `earliest`'i iter; "Dokümanım hazır" açılınca oturum işleri açılır, kapatılınca açık olanlar geri çekilir, biten oturum ve harcanan süre durur, yeniden açılınca kaldığı yerden sürer; ödev tek kalemdir; yalnızca kullanıcının alt işleri teklif edilir; alt işler sırayla bağlıdır; kullanıcının değiştirdiği tarih ezilmez; kaynak silinince geri çekilir; ders blokları tatilde teklif edilmez.
- **Sahneler** (sabit saatli uçtan uca, iki cihaz): `okul.md` "Simülasyon" 3 ve 4 baştan sona: ödevin iki oturumu (akış, "Süre doldu", çıkarken not, ikinci oturumda "Kaldığın yer", teslim listesi, "Yükledim"); proje alt işinin son oturumu (pomodoro, üç seçenek, "Bugünlük yeter" yeni oturum ekler, "Bitti" teslim listesini açar); işaretli bir quizin hazırlık oturumu (Bugün kartı, bölümsüz pomodoro, "Süre doldu", sınav ayrıntısında ilerleme). Sayılan dakika veritabanında molasızdır.
- **Devam:** soru yalnızca devam şartı olan derste; görünümden ve Bugün'den cevap aynı kaydı yazar, öbür soru kapanır.
- **Modül sayfası** (iki cihaz, 375 px): ana sayfa, seçici, altı dersin sayfası, kapalı durum şeridi; "Sınav ya da teslim ekle" yalnızca ders sayfasında.
- **Görsel test:** örnek veriyle ana sayfa, ders sayfası, devam, iş ve sınav ayrıntısı, ayarlar, ödev ve proje sahneleri, teslim listesi, Derste görünümü (telefon ve pano). Karelerle karşılaştırma tablosu rapora girer; bu adımda olmayan parçalar tabloda "Adım 2" ya da "Adım 3" diye yazar.
- RLS (yeni tablolar), dışa aktarım listesi, değer denetimi (`tokens.css`, kit).

## Kabul ölçütleri

`okul.md` "Kurulum adımları" → Adım 1'deki altı ölçüt ve şunlar:

7. Dersler günün akışında ve Takvim'de blok olarak görünür; telefonda ve panoda dokununca Derste görünümü açılır; derste yazılan cümle "Tarihe çevir" ile değerlendirmeye dönüşür.
8. Teslim listesi iki cihazda aynı adımdadır; "Yükledim"den sonra iş ana sayfada ve ders sayfasında teslim edilmiş görünür.
9. Sınavın kendisi planda sabit bloktur; hazırlığının süresi her ekranda "yaklaşık" yazar. "Dokümanım hazır" tek dokunuşla açılır ve kapanır; açıkken hazırlık Bugün'e bölümsüz pomodoro oturumu olarak gelir.
10. Gerçek aktarım (dışa aktarım varsa): 6 ders, 59 değerlendirme (21'i tarihsiz), 86 oturum; 47 görevden yalnızca karar 7'ye uyanlar. Dışa aktarımda hiç not yok (Notion'a girilmemiş): anlık toplamlar sıfırdır, notlar Adım 2'de Kepler'den gelir. Tarihler yalnız gündür; saat "Zaman Notu" metnindeyse (ör. "23:59") ayrıştır, ayrıştıramadığını raporla. Sayılar farklıysa farkı raporda yaz, veriyi düzeltmeye çalışma (Notion 10 Kas'tan beri güncellenmedi).

## Bu adıma özel kurallar

- **Kişisel veri depoya girmez.** Gerçek notlar, devam kayıtları, ders notları ve `data/notion-export/` içeriği teste, örnek veriye, ekran görüntüsüne, commit iletisine ve rapora yazılmaz; raporda yalnızca sayılar olur. Örnek veri uydurmadır.
- **Geriye uyum.** Okul etkin değilken hiçbir ekranda değişiklik olmaz. Örnek verideki kodsuz "Okul" satırı varsa çakışmayı çöz ve raporda yaz.
- **Tasarım.** Değerler `tokens.css`'ten, parçalar kit'ten; kit'te olmayan parça önce kit'e ve galeriye. Kare dokümanla çelişirse doküman geçerlidir; fark rapora yazılır.
- **Görüşün gerek:** karesi olmayan her görünüş (`okul-sahneler.md` ve `okul-sayfalar.md`'nin "Çizilmeyenler" listeleri ve bu istemde öyle işaretlenenler).
- **Denetçi:** veri ve tekliflerden sonra, sahnelerden sonra adım kipinde; sonunda faz kipinde.
- **Gerçek model çağrısı yok.** Paket A'da PowerShell `npm run ai:eval -- --fake` komutundaki bayrağı düşürdü ve gerçek model 48 kez çağrıldı. `ai:eval` ve yapay zekaya dokunan her komutta sahte kipin açık olduğunu çıktıdan doğrula (gerekirse bayrak yerine ortam değişkeni kullan); gerçek modelle koşu yalnızca kullanıcı isterse.

## Yayın

Sıra: migration önce `sherpa-dev`, sonra `sherpa-prod`, sonra `git push origin main` ve etiket. Kullanıcı başındaysa izni bu sohbette iste; gözetimsizsen `prod`'a ve `git push`'a dokunma. Okul üretimde kullanıcı etkinleştirince açılır. Gerçek aktarımın üretimde çalıştırılması ayrı bir adımdır ve kullanıcının iznini ister: önce `--dry-run`, sayılar onaylanınca aktarım.

## Sonunda

Rapor (`BASLA.md` madde 10) ve ek olarak:

- **Kabul ölçütleri tablosu** (10 ölçüt; kanıtıyla).
- **"Okul çekirdek B için notlar":** bu adımda Adım 2'ye bırakılan her bağlantı noktası (Ninova ve Kepler alanları, dosya kutularının yeri, bildirim olaylarının doğduğu yerler, `due_estimated`'ın yazılacağı teklifler) ve Adım 1'de çıkan çekirdek notları.
- **"Senden bekleyenler":** yayın; gerçek aktarım (dışa aktarım yoksa: Okul tasarım sohbeti üretecek); "görüşün gerek" listesi; gerçek telefonda Derste görünümü ve bir ödev oturumu.
- `docs/moduller/README.md` ve `docs/07-yol-haritasi.md`'de Okul'un durumunu "Adım 1 kuruldu" yap. "Sıradaki adım": Okul çekirdek B (`prompts/okul-cekirdek-b.md`, ilerleme sohbeti yazacak).
