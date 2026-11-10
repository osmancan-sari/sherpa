# Çekirdek: her faz için aynı istem

Her faz ayrı bir Claude Code sohbetinde yapılır. Yeni bir sohbet aç ve her seferinde yalnızca şunu yaz:

> `prompts/BASLA.md` dosyasını oku ve sıradaki fazı tamamla.

Hangi fazın sırada olduğunu `docs/ILERLEME.md` söyler; istem hep aynıdır. Bir faz yarıda kalırsa (oturum kesildi, kullanım sınırı doldu) yeni sohbette yine aynı cümleyi yaz; kaldığı yerden devam eder.

Fazları başında durmadan art arda çalıştırmak için (örneğin gece): PowerShell'de `powershell -ExecutionPolicy Bypass -File scripts\run-phases.ps1`. Betik her faz için yeni bir oturum açar; ayrıntı aşağıda "Gözetimsiz çalışma" bölümünde.

---

## Görev

Bu depodaki Sherpa uygulamasının çekirdek hattı (Ç0–Ç5) faz faz kuruluyor. **Bu oturumda yalnızca bir faz yapacaksın:** `docs/ILERLEME.md` içindeki "Durum" ve "Sıradaki adım" bölümlerine bak; yarıda kalmış bir faz varsa onu bitir, yoksa sıradaki fazı baştan sona tamamla. Faz bitince dur; sonraki faza başlama.

Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde.

Modül hattına girme. `_sablon` ve `deneme` dışında hiçbir modül kurma; `docs/moduller/` altındaki dosyalar taslaktır ve ayrı oturumlarda tasarlanacak.

## Önce oku

Her oturumda: `CLAUDE.md`, `docs/ILERLEME.md`, `docs/07-yol-haritasi.md` (ilgili fazın bölümü). Sonra faza göre:

| Faz | Okunacak dokümanlar |
| --- | --- |
| Ç0. İskelet | `docs/01-urun.md`, `docs/02-mimari.md`, `docs/11-yayin-ve-cihazlar.md` |
| Ç1. Çekirdek ve modül temeli | `docs/03-veri-modeli.md`, `docs/06-modul-sozlesmesi.md`, `docs/05-arayuz.md`, `docs/02-mimari.md` |
| Ç2. Yapay zeka geçidi | `docs/10-yapay-zeka.md`, `docs/06-modul-sozlesmesi.md`, `docs/03-veri-modeli.md` |
| Ç3. Planlayıcı | `docs/04-planlayici.md`, `docs/05-arayuz.md`, `docs/10-yapay-zeka.md`, `docs/03-veri-modeli.md` |
| Ç4. Pano ve telefon cilası | `docs/05-arayuz.md`, `docs/11-yayin-ve-cihazlar.md` |
| Ç5. Claude köprüsü | `docs/02-mimari.md`, `docs/06-modul-sozlesmesi.md` |

Dokümanlar tek kaynaktır; onlarla çelişen bir şey yapma. Önceki fazlarda yazılmış kodu da oku; üzerine kuracaksın.

## Nasıl çalışacaksın

1. **Tek faz, baştan sona.** Faz içinde benden onay bekleme; faz bitince dur.
2. **Ortam.** Geliştirme makinesi Windows; komutları PowerShell'e uygun yaz. Satır sonları LF (`.gitattributes` hazır). Docker Desktop kurulu ve çalışıyor.
3. **Yerelde geliştir.** Veritabanı için Supabase'in yerel geliştirme ortamını kullan; bulut projeleri ve yayın bir duraktır (aşağıda). Böylece benden bir şey beklemeden ilerleyebilirsin.
4. **Fazın döngüsü:** kısa plan (`docs/ILERLEME.md`'ye yaz) → uygula → test et → kabul ölçütlerini tek tek doğrula → `docs/ILERLEME.md`'yi güncelle → commit at ve fazı etiketle (`c0-tamam`, `c1-tamam`…). Faz boyunca anlamlı adımlarda ara commit at ve `docs/ILERLEME.md`'yi güncel tut; oturum her an kesilebilir.
5. **Doğrulama.** Ayrıntısı aşağıda "Doğrulama düzeni" bölümünde; faz boyunca kesintisiz uygulanır, fazın sonuna bırakılmaz. Özeti: her adımda `npm run check`, riskli adımlardan sonra ve fazın sonunda bağımsız denetçi alt ajanı, etiketten önce `npm run check:full`.
6. **Kararları sen ver; beni bekleme.** Bu proje benim müdahalem olmadan ilerlemeli.
   - **Teknik kararlar senindir.** Mimari ayrıntı, kütüphane seçimi, veri modeli ve sözleşme ayrıntısı, hata çözümü, test yaklaşımı, araç ve ortam sorunları: en doğru bulduğun yolu seç, uygula ve `docs/ILERLEME.md` içindeki "Verdiğim kararlar" listesine gerekçesiyle yaz. Sorma, onay bekleme.
   - **Dokümanlar çelişiyorsa ya da bir doküman olduğu gibi uygulanamıyorsa** en doğru bulduğun yorumu seç; ilgili dokümanı ve `docs/09-kararlar.md` dosyasını aynı commit'te güncelle ki dokümanlar tek kaynak olarak kalsın.
   - **Tasarımsal kararlar** (görünüm, yerleşim, metin, akış, varsayılan değer gibi zevkime ya da kullanım alışkanlığıma bağlı olanlar): en iyi yorumunla ilerle ve satırı "görüşün gerek" diye işaretle. Fazın sonunda bakarım; değiştirmek istediğim olursa sonraki oturumda düzeltilir. Bunun için de bekleme.
   - **Bir sorun üç farklı denemede çözülmediyse** başka bir yaklaşıma geç ya da o parçayı çalışan en küçük haliyle bırak; durumu "Bilinen sorunlar"a yaz ve fazın geri kalanına devam et.
   - **Ücretli ya da geri alınamaz işlemi yapma** (para harcayan bir şey, depo dışında veri silme, buluttaki veriyi bozabilecek bir işlem, git geçmişini zorla yeniden yazma). Onu atla, "Senden bekleyenler" listesine yaz ve geri kalanla devam et.
   - **Durmak son çaredir.** Yalnızca faz hiçbir yönden ilerleyemiyorsa ve kendi başına düzeltemiyorsan dur (örneğin Docker çalışmıyor, disk dolu, Claude Code girişi düşmüş). O zaman ne olduğunu ve benden tam olarak ne gerektiğini yaz.
7. **Duraklarda bekleme.** Aşağıdaki duraklar benim elimle yapılacak işlerdir. Durağa gelince ne gerektiğini "Senden bekleyenler" listesine adım adım yaz, yerel ya da sahte karşılığıyla devam et. Oturumun başında bu listeye bak: tamamladığımı söylediğim bir durak varsa önce onu bağla ve doğrula.

   Durakta bana düşen işi en aza indir. Komut satırından yapılabilen her şeyi (Supabase CLI ile proje bağlama ve şema aktarımı, Vercel CLI ile yayın ve ortam değişkenleri gibi) kendin yap; benden yalnızca senin yapamayacağın adımları iste: hesap açma, tarayıcıda giriş onayı, anahtar girme, telefonda deneme. Anahtarları sohbete yazmamı isteme; hangi dosyaya hangi adla gireceğimi söyle.
8. **Kurallar.** `CLAUDE.md` içindeki mimari ve ürün kuralları. Paket sürümlerini ve API biçimlerini ezberden yazma; kurarken güncel resmi dokümana bak (Next.js, Supabase, Anthropic SDK, MCP). Sırları depoya koyma; `.env.example` tut. Fazın kapsamı dışında özellik ekleme; aklına geleni `docs/09-kararlar.md` altındaki "Fikirler" listesine yaz.
9. **Modül arayüzleri için zemin.** Her modülün kendine özel arayüzü olacak (`docs/06-modul-sozlesmesi.md`, "Modül arayüzü"). Çekirdeği buna göre kur: modül kendi sayfasını, sekmelerini, alt sayfalarını ve tam ekran görünümlerini çekirdeğe dokunmadan ekleyebilmeli. `deneme` modülünde bunların her birinden bir örnek bulunsun.
10. **Fazın sonunda** `docs/ILERLEME.md`'ye faz raporunu yaz ve bana kısa bir özet ver:
    - Kabul ölçütleri: otomatik doğrulananlar, benim elle doğrulamam gerekenler, sağlanamayanlar ve nedeni
    - Bekleyen duraklar ve her biri için yapmam gerekenler
    - Bu fazda verdiğin kararlar
    - Sonraki faz için notlar: dikkat edilmesi gereken yerler, bilinen sorunlar
    - Ç5'in sonunda ayrıca: çekirdekte gördüğün zayıflıklar ve modül tasarım oturumları için notlar (sözleşmede eksik ya da zor bulduğun yerler)

## Doğrulama düzeni

Üç katman vardır. Hiçbiri atlanmaz; "sonra bakarım" yoktur.

**Kapı komutları.** `package.json` içinde iki komut bulunur; yoksa oturumun ilk işi olarak kur ve `CLAUDE.md`'deki komut listesine ekle:

- `npm run check`: tip denetimi, lint, biçim denetimi, birim testleri. Hızlıdır.
- `npm run check:full`: `check` + üretim derlemesi + uçtan uca testler.

**1. Her adımda.**

- Yeni davranışın testi aynı adımda yazılır. Planlayıcıda önce test, sonra kod; `docs/04-planlayici.md` içindeki test listesinin tamamı zorunludur.
- Commit'ten önce `npm run check` çalışır. Kırmızıyken commit atılmaz, sonraki adıma geçilmez.
- Önceki fazların testleri de geçmeye devam eder.
- Testi yeşile getirmek için test silinmez, atlanmaz (`skip`, `only`), eşik gevşetilmez. Bir testi gerçekten değiştirmen gerekiyorsa gerekçesini "Verdiğim kararlar"a yaz.

**Denetçi.** Kodu yazan oturumdan ayrı çalışan bir alt ajandır. Çağırmak için genel amaçlı bir alt ajan başlat ve ona yalnızca şunu söyle: "`prompts/denetci.md` dosyasını oku ve uygula. Kip: adım ya da faz. Kapsam: faz adı ya da commit aralığı." Ne yaptığını, neyi neden öyle yaptığını anlatma; denetçi depoya bakarak kendi sonucuna varmalı. Ön planda çalıştır ve raporunu bekle; rapor gelmeden ilerleme.

**2. Riskli adımlardan sonra: bağımsız denetim.** Şu alanlara dokunan bir adım bitince denetçiyi "adım" kipinde çağır: veritabanı şeması ve migration, RLS ve kimlik, planlayıcı motoru, yapay zeka geçidi, iş zarfı ve modül sözleşmesi, cihazlar arası eşitleme. Engelleyici bulguyu sonraki adıma geçmeden düzelt.

**3. Fazın sonunda.**

1. Kabul ölçütlerini mümkün olan her yerde uçtan uca testle doğrula (iki tarayıcı bağlamıyla eşitleme, giriş koruması, oturumlar vb.).
2. Ana ekranların ekran görüntülerini pano genişliğinde ve telefon genişliğinde alıp `docs/ekran-goruntuleri/<faz>/` altına koy; görüntülere kendin de bak, bozuk ya da boş ekranı düzelt.
3. `npm run check:full` yeşil olmalı.
4. Denetçiyi "faz" kipinde çağır.
5. "Engelleyici" ve "önemli" bulguları düzelt, 3. ve 4. adımı yinele. En çok üç tur. Üçüncü turdan sonra hâlâ engelleyici bulgu varsa etiketi atma: bulguları ve denediklerini `docs/ILERLEME.md`'ye yaz, commit at ve oturumu bitir. Sonraki oturum taze bağlamla aynı fazı sürdürür.
6. Faz raporuna "Denetim" başlığı ekle: kaç tur sürdü, hangi bulgular çıktı, hangileri düzeltildi, hangileri neden açık kaldı.

**Etiket koşulu.** `c0-tamam`… etiketi yalnızca `npm run check:full` yeşilse ve son denetçi raporunda engelleyici bulgu yoksa atılır.

**Dürüstlük.** Otomatik doğrulayamadığın ölçütü "elle doğrulanacak" olarak işaretle; doğrulanmış gibi yazma. Denetçinin bir bulgusuna katılmıyorsan gerekçeni rapora yaz; sessizce geçme.

**Önceki fazın denetimi.** Oturumun başında bir önceki fazın raporuna bak: "Denetim" başlığı yoksa (o faz bu düzenden önce bittiyse) yeni faza başlamadan önce o fazı "faz" kipinde denetlet ve bulguları düzelt.

## Gözetimsiz çalışma

`scripts/run-phases.ps1` fazları art arda, her birini yeni bir oturumda çalıştırır. Bu oturumlarda istem "unattended run" der; o zaman başında kimse yoktur ve şunlar geçerlidir:

- Soru sorma, yanıt bekleme. Kararları "Kararları sen ver" maddesine göre kendin ver.
- `docs/BEKLIYOR.md` yalnızca o maddedeki son çare içindir: faz hiçbir yönden ilerleyemiyorsa ne olduğunu, benden tam olarak ne gerektiğini ve hangi adımda kaldığını bu dosyaya yaz, `docs/ILERLEME.md`'yi güncelle, commit at ve oturumu bitir. Betik bu dosyayı görünce durur. Teknik ya da tasarımsal bir karar için bu dosyayı yazma.
- Oturumun başında `docs/BEKLIYOR.md` varsa: sorun artık geçerli değilse (ortam düzelmiş, ben yanıt yazmışım) dosyayı sil ve devam et; hâlâ geçerliyse hiçbir şey yapmadan oturumu bitir.
- Bir izin reddedilirse aynı işlemi yeniden deneme; başka bir yol bul, bulamazsan "Bilinen sorunlar"a yaz ve devam et.
- Aynı klasörde başka bir oturumun çalıştığını görürsen (dosyalar sen dokunmadan değişiyor, commit'ler geliyor) hiçbir şeye dokunmadan oturumu bitir; `docs/BEKLIYOR.md` yazma. Betik artık aynı anda tek kopya çalışır.
- Betik bir fazın bittiğini yalnızca etiketten (`c0-tamam`…) anlar. Etiketi "Etiket koşulu" sağlandıktan ve faz raporu yazıldıktan sonra at; daha önce atma. Etiket yoksa betik aynı fazı yeni oturumda sürdürür.
- Betik etiketi görünce `npm run check:full` komutunu kendisi de çalıştırır. Kırmızıysa etiketi siler ve çıktının yazıldığı günlük dosyasını yeni oturuma bildirir; o oturumun ilk işi bunu düzeltmektir.
- Arka planda açık süreç bırakma (geliştirme sunucusu, izleyici); oturum bitmeden kapat. Yerel Supabase kapsayıcıları açık kalabilir.

## Duraklar

| Durak | Ne zaman | Benden gereken | O zamana kadar |
| --- | --- | --- | --- |
| D1. Bulut ve yayın | Ç0'ın kodu hazır olunca | Supabase `dev` ve `prod` projeleri ve anahtarları, izinli e-posta, Vercel bağlantısı, kalıcı adres | Yerel Supabase ile devam et |
| D2. Telefon | D1'den sonra | Ana ekrana ekleme ve kodla giriş denemesi | — |
| D3. Yapay zeka anahtarı | Ç2'nin başında | `ANTHROPIC_API_KEY` | Sağlayıcıyı bir arayüzün arkasına koy; kayıtlı örnek yanıtlar veren sahte sağlayıcıyla geliştir ve test et. Gerçek çağrı gerektiren testleri ayrı işaretle |
| D4. Görsel onay | Ç4'te | Ekran görüntülerine bakıp onay ya da düzeltme | `docs/05-arayuz.md` içindeki tasarım yönüne göre en iyi yorumunla ilerle |
| D5. Köprü bağlantısı | Ç5'in sonunda | Köprüyü Claude hesabıma bağlayıcı olarak ekleme | Yerel bir MCP istemcisiyle sına |

## `docs/ILERLEME.md` biçimi

Dosya depoda hazır; başlıklarını koru:

- **Durum:** hangi faz, hangi adım, son commit
- **Biten fazlar:** her biri için faz raporu ve kabul ölçütleri tablosu
- **Sıradaki adım:** tek cümle
- **Senden bekleyenler:** duraklar ve her biri için adım adım yapılacaklar
- **Verdiğim kararlar:** tarih, karar, gerekçe, etkilediği dosyalar
- **Bilinen sorunlar**
