# Çekirdek: her faz için aynı istem

Her faz ayrı bir Claude Code sohbetinde yapılır. Yeni bir sohbet aç ve her seferinde yalnızca şunu yaz:

> `prompts/BASLA.md` dosyasını oku ve sıradaki fazı tamamla.

Hangi fazın sırada olduğunu `docs/ILERLEME.md` söyler; istem hep aynıdır. Bir faz yarıda kalırsa (oturum kesildi, kullanım sınırı doldu) yeni sohbette yine aynı cümleyi yaz; kaldığı yerden devam eder.

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
5. **Doğrulama.**
   - Planlayıcı için birim testleri zorunlu; `docs/04-planlayici.md` içindeki test listesinin tamamı.
   - Kabul ölçütlerini mümkün olan her yerde uçtan uca testle doğrula (iki tarayıcı bağlamıyla eşitleme, giriş koruması, oturumlar vb.).
   - Fazın sonunda ana ekranların ekran görüntülerini pano genişliğinde ve telefon genişliğinde alıp `docs/ekran-goruntuleri/<faz>/` altına koy.
   - Otomatik doğrulayamadığın ölçütü "elle doğrulanacak" olarak işaretle; doğrulanmış gibi yazma.
   - Önceki fazların testleri de geçmeye devam etmeli.
6. **Ne zaman durup soracaksın.** Yalnızca şu durumlarda:
   - Dokümanlar birbiriyle çelişiyor ya da bir karar veri modelini, iş zarfını ya da modül sözleşmesini değiştirecek.
   - Geri alınamaz ya da ücretli bir işlem gerekiyor.
   - Aynı sorunda üç farklı deneme başarısız oldu.

   Bunların dışındaki belirsizliklerde en makul yorumu seç, `docs/ILERLEME.md` içindeki "Verdiğim kararlar" listesine gerekçesiyle yaz ve devam et.
7. **Duraklarda bekleme.** Aşağıdaki duraklar benim elimle yapılacak işlerdir. Durağa gelince ne gerektiğini "Senden bekleyenler" listesine adım adım yaz, yerel ya da sahte karşılığıyla devam et. Oturumun başında bu listeye bak: tamamladığımı söylediğim bir durak varsa önce onu bağla ve doğrula.
8. **Kurallar.** `CLAUDE.md` içindeki mimari ve ürün kuralları. Paket sürümlerini ve API biçimlerini ezberden yazma; kurarken güncel resmi dokümana bak (Next.js, Supabase, Anthropic SDK, MCP). Sırları depoya koyma; `.env.example` tut. Fazın kapsamı dışında özellik ekleme; aklına geleni `docs/09-kararlar.md` altındaki "Fikirler" listesine yaz.
9. **Modül arayüzleri için zemin.** Her modülün kendine özel arayüzü olacak (`docs/06-modul-sozlesmesi.md`, "Modül arayüzü"). Çekirdeği buna göre kur: modül kendi sayfasını, sekmelerini, alt sayfalarını ve tam ekran görünümlerini çekirdeğe dokunmadan ekleyebilmeli. `deneme` modülünde bunların her birinden bir örnek bulunsun.
10. **Fazın sonunda** `docs/ILERLEME.md`'ye faz raporunu yaz ve bana kısa bir özet ver:
    - Kabul ölçütleri: otomatik doğrulananlar, benim elle doğrulamam gerekenler, sağlanamayanlar ve nedeni
    - Bekleyen duraklar ve her biri için yapmam gerekenler
    - Bu fazda verdiğin kararlar
    - Sonraki faz için notlar: dikkat edilmesi gereken yerler, bilinen sorunlar
    - Ç5'in sonunda ayrıca: çekirdekte gördüğün zayıflıklar ve modül tasarım oturumları için notlar (sözleşmede eksik ya da zor bulduğun yerler)

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
