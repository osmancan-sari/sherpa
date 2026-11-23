# Okul çekirdek A: modül sayfası, sahne sayacı ve yerleşimleri

Claude Code'a yalnızca şunu yaz:

> `prompts/okul-cekirdek-a.md` dosyasını oku ve uygula.

Ön koşul: `c4c-tamam` etiketi ve sabah açılışının yayında olması (`66f31c0` ya da sonrası).

---

## Görev

Okul modülünün tasarımı çekirdekten on dört şey istedi; hepsi karara bağlandı ve üç pakete bölündü (`docs/moduller/okul-cekirdek-notlari.md`, "Kararlar"). Bu oturum **paket A**'yı kurar: Okul'un 1. kurulum adımının dayandığı altı yetenek (madde 4, 5, 7, 9, 10, 11) ve bir doküman temizliği (madde 3). Bu oturumda yalnızca bu yapılır; Okul modülünün kendisi kurulmaz, paket B ve C'ye girilmez. Bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı **Okul çekirdek A**, etiket `okul-cekirdek-a-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/okul-cekirdek-a/`.

İlk iş:
1. Bu fazı `docs/07-yol-haritasi.md` ve `docs/ILERLEME.md`'ye yaz. Sıra artık: Okul çekirdek A → Okul Adım 1 → Okul çekirdek B → Okul Adım 2 → Okul çekirdek C → Okul Adım 3; Rutin 2 ve Ç4d'nin kalanları Okul Adım 1'den sonra araya alınır (kullanıcının 23 Kas kararı: önce Okul).
2. Çalışma ağacındaki commit edilmemiş dosyaları ilk commit'e kat: Okul tasarım oturumunun çıktıları (`docs/moduller/okul*.md`, `docs/tasarim/kareler/okul/`, `docs/tasarim/ekranlar/okul-*.md`, tasarım dizinleri), ilerleme sohbetinin doküman değişiklikleri (`docs/01`, `docs/07`, `docs/09`, `prompts/`) ve bu istem. İçeriklerine dokunma; yalnızca commit'le.

Neden genel: bu yetenekleri Okul istedi ama Spor, Beslenme ve Rutin de kullanacak. Hiçbir şey Okul'a özel kurulmaz; örnekleri `deneme` modülündedir; `src/core/` hiçbir modülü içe aktarmaz.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md` (16 Kas satırları)
- `docs/moduller/okul-cekirdek-notlari.md`: maddeler 3, 4, 5, 7, 9, 10, 11; "Kararlar" tablosu; sondaki "Okul tasarım sohbetinden notlar" (paket A'nın kare adları orada)
- `docs/moduller/okul.md`: 8.1–8.5 ve 8.8, kural 9–12 ve 18, "Kurulum adımları" → Adım 1. Okul'u kurmayacaksın; çekirdeğin ne taşıması gerektiğini buradan anla
- `docs/tasarim/README.md`, `ilkeler.md`, `parcalar.md`; `docs/tasarim/ekranlar/sahne.md`, `moduller.md`, `okul-sahneler.md`, `okul-sayfalar.md`; `docs/tasarim/kareler/okul/DIZIN.md` ve aşağıda adı geçen kareler
- `docs/06-modul-sozlesmesi.md` ("Sahne", "Bölümler", modül sayfası, zarf, `size`), `docs/03-veri-modeli.md`, `docs/05-arayuz.md` ("Durum şeridi", modül sayfası), `docs/10-yapay-zeka.md` (`size`)
- `src/core/ui/today/Scene.tsx`, `src/core/ui/module/ModuleScreens.tsx`, `src/core/ui/kit/` (özellikle `StepRunner`), `src/modules/rutin/`, `src/modules/deneme/`

## Yapılacaklar

Her madde için: sözleşmeyi (`docs/06`, gerekiyorsa `docs/03`, `docs/05`, `docs/tasarim/`) aynı commit'te güncelle, testini yaz, `deneme`'ye örneğini koy. Adları ben öneriyorum; mevcut adlandırmaya daha iyi uyan bir ad varsa onu kullan ve raporda yaz, çünkü Okul Adım 1'in istemi senin koyduğun adlara dayanacak.

### 1. Modül sayfasının iskeleti (madde 4)

- Modül, sayfasının ilk girişini kendisi tanımlayabilir: bölüm (`facet`) olmayan bir "Ana sayfa" girişi (öneri: `ui.home`). Tanımlamayan modülde bugünkü davranış aynen kalır.
- İskeletin "Yaklaşanlar" ve "Geçmiş" parçaları modül başına kapatılabilir; varsayılan açık.
- Bölüm seçimi: panoda sekmeler, telefonda açılır seçici. Açılır seçici kit parçası olur (galeri, `parcalar.md`). Kareler: Okul'un ana sayfası ve ders seçimi (`DIZIN.md`'de 69, 70, 81 numaralı kareler).
- Bölümü çok olan modülde (Okul'da altı ders) seçici ve sekmeler taşmamalı; telefonda 375 px'te sınanır.

### 2. Sayfa başı (madde 5)

- Modül sayfasının başındaki durum şeridi (durum cümlesi, "dikkat / geride" etiketi **ve haftalık raporun sayıları**) modül başına kapatılabilir; kapatan modülde sayfa başı yalnızca ad ve modülün verdiği kısa alt başlıktır (Okul'da dönem). Varsayılan bugünkü gibi açık; Rutin'de bir şey değişmez.
- Bugün'deki modül hapı ve alan sayfasındaki panel bu ayardan etkilenmez.

### 3. Sahnede şerit, sayılan dakika ve arka plan (madde 7)

- **Şerit** bütün modüllerde "geçen / ayrılan" gösterir ("26 dk / 2 sa"); ayrılan süre yoksa yalnızca geçen. Rutin'in şeridi de buna geçer; Rutin'in onaylı görüntüleri bilerek yenilenir ve raporda söylenir.
- **Sayılan dakika:** sahne oturumu kapatırken çekirdeğe sayılan dakikayı bildirebilir (`controls.finish` ve `controls.stop` için isteğe bağlı değer). Kural: 0 ile geçen süre arasında olmalı, dışındaysa yok sayılır ve geçen süre kullanılır; bildirilmezse bugünkü davranış. Öğrenme (süre tahmini) ve kalan efor sayılan dakikayı kullanır; oturumun saat aralığı (başlangıç, bitiş) değişmez. Şeritteki "geçen" duvar saatiyle geçen süredir.
- **Arka plan:** `ui.backdrop` bölümün çözülmüş rengini alır (renk çözümleyiciden; Ayarlar'dan değişen renk anında yansır).
- Tur, mola ve duraklatma sahnenin iç işidir; çekirdek bilmez. Ama oturumun iç durumu (hangi tur, ne kadar odak sayıldı) cihazlar arasında tutarlı olmalıdır: yerleşimlerin durumu oturuma bağlı, modülün saklayabileceği biçimde tasarlanır (aşağıda 5).

### 4. Yer tutucu süre ve gerekçesi (madde 9)

- Zarfa iki alan: `effort_provisional boolean` (varsayılan false) ve `effort_basis text` (tek cümle, en çok 200 karakter). Migration yalnızca ekleme yapar.
- "Neden?" gerekçeyi gösterir. Bugün, Takvim ve modül sayfası yer tutucu süreyi "yaklaşık" olarak işaretler (biçimi `docs/tasarim/`'a yaz; karesi yoksa en sade haliyle kur ve "görüşün gerek" de).
- Modül süreyi sonradan güncelleyince alanın kaynağı `module` olur ve işaret kalkar; kullanıcının elle verdiği süre (`user`) hiçbir zaman ezilmez (mevcut `provenance` kuralı).
- `size` çağrısının ipuçlarına modülün verdiği "önceki gerçekleşenler" eklenir (istem sürümü artar; `ai:eval` örneği eklenir). Hafta ve ay yükü yer tutucu süreyi gerçek süre gibi sayar.

### 5. Sahne yerleşimleri (madde 10a)

Kit'e üç yerleşim girer; her biri galeride, `parcalar.md`'de ve `docs/moduller/ORTAK.md`'de yer alır. Yalnızca onaylı karesi olan kurulur; **soru sayacı ve tek blok bu pakette kurulmaz** (paket C).

- **Pomodoro:** halka, geçen süre, ODAK / KISA MOLA etiketi, tur toplamı; Duraklat, Turu atla; molada Molayı bitir, +5 dk. Kareler `K1T2`–`K1T4`, `K4T2`–`K4T4`.
- **Akış:** ileri sayan saat, "AKIŞ", planlanan sürede biten çubuk; Mola ver (mola ileri sayar, süreye sayılmaz), Bitir. Kareler `K3T2`–`K3T4`, `SahneAkisProje`.
- **Kontrol listesi:** sayaç yok; işaretlenen adımlar, adımın kendi düğmesi. Kareler `K4T6`, `SahneDokuman`, `SahneToplanti`.
- **Ortak parçalar:** "Süre doldu." kartı (Bitti, +5 dk; isteğe bağlı üçüncü eylem) `K1T5`, `K3T5`, `K4T5`; oturum başındaki "Kaldığın yer" kutusu `SahneKaldiginYerOdev`; "Bu oturumda" bölümler kutusu ve o anki adımda "Aç"; oturum sonu tek yazı ("Oturum bitti."). Pano karşılıkları aynı adın `P` hali ya da `Pano…`.
- Yerleşim bir bileşendir, sahne değil: modül kendi sahnesinde yerleşimi seçer, metinleri ve eylemleri verir. Süreler ve yöntem yerleşimin girdisidir; sahnede değiştirilmez.
- Sayaçlar oturumun saklanan başlangıcından ve modülün sakladığı durumdan hesaplanır; sayfa yenilenince ya da öbür cihazda açılınca aynı yerde olur. Arka plandaki sekmede zamanlayıcı kaysa da görünen süre doğrudur.
- **Rutin'in `StepRunner`'ı:** kontrol listesiyle birleştirilebiliyorsa birleştir, ikinci kopya kalmasın. Rutin'in görünüşü ve davranışı değişmeden kalamıyorsa birleştirme; nedenini raporda yaz.
- Sesli anlatım, "Hareketi azalt", "Saydamlığı azalt" ve güvenli alan kuralları yerleşimlerde de geçerlidir. Tur ve mola geçişinde ses çalınıp çalınmayacağı Okul'un tasarımında yazıyorsa ona uy; yazmıyorsa sessiz kur.

### 6. Sabit blok görünümü (madde 10b)

- Modülün teklif ettiği sabit bloğun (hedefi `block` olan teklif) kartına Bugün'de, günün akışında ve Takvim'de dokununca modülün verdiği görünüm açılır (öneri: `ui.blockView`). Oturum açmaz, süre saymaz, şeritte sayaç yoktur; "Çık" Bugün'e döner.
- Modülün teklif etmediği (kullanıcının elle eklediği) blokta bir şey değişmez.
- Blok o an sürüyorsa Şimdi kartı görünümü açan tek bir eylem taşır. Kareler `SahneDers`, `SahneSinav`, `PanoDersSahne`.
- Görünümün içinden modül kendi verisini yazabilir (Okul'da tek cümlelik ders notu, devam cevabı); çekirdek saklamaz.

### 7. Sahneden çıkarken not (madde 11)

- Sahne çıkışı bir adım bekletebilir (öneri: `ModuleScene.beforeExit`): tek metin alanı, başlığı modül verir ("Nerede kaldın?"), atlanabilir, tek dokunuşla geçilir. Kare `K3T6`.
- Kabuğun "Çık"ı, sahnenin kendi "Oturumu bitir"i ve klavye kısayolu aynı adımdan geçer. "Takıldım" ve "Yatıyorum" geçmez.
- Bağlantı yokken, modülün işleyicisi hata verince ya da 10 saniyede cevap gelmezse çıkış engellenmez; not sorulmadan ya da kaydedilmeden çıkılır ve hata sessizce kayda düşer.
- Notu modül kendi tablosunda tutar; çekirdek saklamaz.

### 8. Doküman temizliği (madde 3)

Hayat modunun kalıntıları: `docs/` ve `prompts/` altında modül şablonunda ya da oturum yönteminde "Mod davranışı" başlığı ya da moda dayanan hüküm kalmışsa kaldır. `okul.md` bölüm 9'daki tek cümleye dokunma. Kod değişikliği beklenmiyor; bulursan raporda yaz.

## `deneme` modülünde örnekler

- "Ana sayfa" girişi tanımlı ve durum şeridi kapalı bir kip (ayarla açılır; varsayılan `deneme` görünüşü değişmesin diye).
- Üç yerleşimi kullanan üç sahne; biri sayılan dakikayı bildirir (molalı), biri `beforeExit` kullanır.
- Yer tutucu süreli ve gerekçeli bir iş; sonradan süreyi güncelleyen bir eylem.
- `blockView`'u olan bir sabit blok.
- Bölümün rengini alan arka plan.

## Testler

Önceki fazların testleri beklenti gevşetilmeden geçer. Yeni testler en az şunları sınar:

- **Sayılan dakika:** molalı oturumda öğrenme ve kalan efor sayılan dakikayı kullanır; aralık dışı değer yok sayılır; bildirmeyen sahne bugünkü gibi (veritabanı ve birim).
- **Yer tutucu:** işaret ve gerekçe saklanır; modül güncelleyince kalkar; kullanıcının süresi ezilmez; hafta yükü sayar (veritabanı, zarf).
- **Yerleşimler:** sabit saatli uçtan uca; pomodoroda tur ve mola geçişi, +5 dk, Turu atla; akışta mola süreye sayılmaz; kontrol listesinde adımlar; "Süre doldu" kartı; sayfa yenilenince ve ikinci cihazda aynı durum.
- **`beforeExit`:** not yazılır, atlanır, bağlantısız çıkılır, işleyici hata verince çıkılır.
- **`blockView`:** Bugün, akış ve Takvim'den açılır; oturum açılmadığı veritabanından doğrulanır; elle eklenen blokta açılmaz.
- **Modül sayfası:** ana sayfa girişi, kapalı durum şeridi, kapalı "Yaklaşanlar" ve "Geçmiş", telefonda seçici; tanımlamayan modülde değişiklik yok.
- **Görsel test:** üç yerleşimin, "Süre doldu" kartının, çıkış notunun, blok görünümünün ve yeni modül sayfası hallerinin telefon ve pano onaylı görüntüleri; galeri güncel. Karelerle karşılaştırma tablosu rapora girer.
- Değerler `tokens.css`'ten, parçalar kit'ten; sabit renk ve piksel denetimi geçer.

## Bu faza özel kurallar

- **Geriye uyum.** Yeni alanları kullanmayan modül ve sahnede hiçbir şey değişmez. Bilerek değişen tek görünüş şeridin "geçen / ayrılan" biçimidir.
- **Modül sınırı.** Modül çekirdeğin tablolarını okumaz; her şey sözleşmeden gelir. Çekirdekte "okul" kelimesi geçmez.
- **Planlayıcı.** Bu pakette oturum uzunluğu (90 dk), oturumların bölünmesi ve `meta`'nın taşınması değişmez (paket C). Planlayıcıya dokunan tek şey yer tutucu sürenin yük hesabında sayılmasıdır; önce test, sonra kod.
- **Denetçi:** veri ve sözleşme değişen adımlardan sonra adım kipinde, sonunda faz kipinde.
- **Görüşün gerek:** karesi olmayan her görünüş (yer tutucu sürenin "yaklaşık" işareti, şeridin Rutin'deki yeni hali, `deneme` örnekleri hariç kullanıcının göreceği her yeni davranış).

## Yayın

Sıra: migration önce `sherpa-dev`, sonra `sherpa-prod`, sonra `git push origin main` ve etiket. Kullanıcı başındaysa izni bu sohbette iste; gözetimsizsen `prod`'a ve `git push`'a dokunma.

## Sonunda

Rapor (`BASLA.md` madde 10) ve ek olarak **"Okul Adım 1 için sözleşme özeti"**: bu pakette sözleşmeye giren her adın (alan, işlev, bileşen, girdi) kesin hali, birer satır kullanım örneğiyle. Okul tasarım sohbeti Adım 1'in istemini bu özetten yazacak. `okul-cekirdek-notlari.md`'de paket A'nın maddelerini "kuruldu" diye işaretle. "Sıradaki adım": Okul Adım 1 (`prompts/okul-adim-1.md`, Okul tasarım sohbeti yazacak).
