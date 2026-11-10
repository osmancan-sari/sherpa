# Baştan sona çekirdek: tek istem

Claude Code'a yalnızca şunu yaz:

> `prompts/BASLA.md` dosyasını oku ve oradaki görevi uygula.

Oturum kesilirse ya da bağlam dolarsa yeni oturumda şunu yaz:

> `prompts/BASLA.md` ve `docs/ILERLEME.md` dosyalarını oku, kaldığın yerden devam et.

---

## Görev

Bu depodaki Sherpa uygulamasının **çekirdek hattını (Ç0–Ç5) baştan sona kur.** Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde.

Modül hattına girme. `_sablon` ve `deneme` dışında hiçbir modül kurma; `docs/moduller/` altındaki dosyalar taslaktır ve ayrı oturumlarda tasarlanacak. Onlara yalnızca modül sözleşmesinin neye hizmet edeceğini anlamak için bak.

## Önce oku

`CLAUDE.md`, sonra `docs/01` – `docs/11` dosyalarının tamamı. Dokümanlar tek kaynaktır; onlarla çelişen bir şey yapma.

## Nasıl çalışacaksın

1. **Sırayla ilerle:** Ç0 → Ç1 → Ç2 → Ç3 → Ç4 → Ç5. Fazlar arasında benden onay bekleme.
2. **Yerelde geliştir.** Veritabanı için Supabase'in yerel geliştirme ortamını kullan; bulut projeleri ve yayın bir duraktır (aşağıda). Böylece benden bir şey beklemeden ilerleyebilirsin.
3. **Her fazda aynı döngü:** kısa plan (`docs/ILERLEME.md`'ye yaz) → uygula → test et → kabul ölçütlerini tek tek doğrula → `docs/ILERLEME.md`'yi güncelle → commit at ve fazı etiketle (`c0-tamam`, `c1-tamam`…).
4. **Doğrulama.**
   - Planlayıcı için birim testleri zorunlu; `docs/04-planlayici.md` içindeki test listesinin tamamı.
   - Kabul ölçütlerini mümkün olan her yerde uçtan uca testle doğrula (iki tarayıcı bağlamıyla eşitleme, giriş koruması, oturumlar vb.).
   - Her fazın sonunda ana ekranların ekran görüntülerini pano genişliğinde ve telefon genişliğinde alıp `docs/ekran-goruntuleri/<faz>/` altına koy.
   - Otomatik doğrulayamadığın ölçütü "elle doğrulanacak" olarak işaretle; doğrulanmış gibi yazma.
5. **Ne zaman durup soracaksın.** Yalnızca şu durumlarda:
   - Dokümanlar birbiriyle çelişiyor ya da bir karar veri modelini, iş zarfını ya da modül sözleşmesini değiştirecek.
   - Geri alınamaz ya da ücretli bir işlem gerekiyor.
   - Aynı sorunda üç farklı deneme başarısız oldu.

   Bunların dışındaki belirsizliklerde en makul yorumu seç, `docs/ILERLEME.md` içindeki "Verdiğim kararlar" listesine gerekçesiyle yaz ve devam et.
6. **Duraklarda bekleme.** Aşağıdaki duraklar benim elimle yapılacak işlerdir. Durağa gelince ne gerektiğini "Senden bekleyenler" listesine adım adım yaz, yerel ya da sahte karşılığıyla devam et. Ben hazır olduğumda haber veririm; o zaman durağı tamamlarız.
7. **Süreklilik.** Bu iş tek oturuma sığmaz. `docs/ILERLEME.md` her an güncel olsun: hangi fazdasın, ne bitti, sıradaki adım ne, hangi testler geçiyor. Yeni oturum yalnızca bu dosyayı okuyarak devam edebilmeli.
8. **Kurallar.** `CLAUDE.md` içindeki mimari ve ürün kuralları. Paket sürümlerini ve API biçimlerini ezberden yazma; kurarken güncel resmi dokümana bak (Next.js, Supabase, Anthropic SDK, MCP). Sırları depoya koyma; `.env.example` tut. Fazın kapsamı dışında özellik ekleme; aklına geleni `docs/09-kararlar.md` altındaki "Fikirler" listesine yaz.
9. **Modül arayüzleri için zemin.** Her modülün kendine özel arayüzü olacak (`docs/06-modul-sozlesmesi.md`, "Modül arayüzü"). Çekirdeği buna göre kur: modül kendi sayfasını, sekmelerini, alt sayfalarını ve tam ekran görünümlerini çekirdeğe dokunmadan ekleyebilmeli; ortak bileşen takımı bunun için yeterli olmalı. `deneme` modülünde bunların her birinden bir örnek bulunsun.
10. **Bitiş.** Ç5'in sonunda dur ve bir kapanış raporu yaz (`docs/ILERLEME.md` sonuna):
    - Her fazın kabul ölçütleri: otomatik doğrulananlar, benim elle doğrulamam gerekenler
    - Bekleyen duraklar ve her biri için yapmam gerekenler
    - Çekirdekte gördüğün zayıflıklar ve riskler
    - Modül tasarım oturumları için notlar: sözleşmede eksik ya da zor bulduğun yerler

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
- **Biten fazlar:** her biri için kabul ölçütleri tablosu (otomatik / elle doğrulanacak / sağlanamadı ve nedeni)
- **Sıradaki adım:** tek cümle
- **Senden bekleyenler:** duraklar ve her biri için adım adım yapılacaklar
- **Verdiğim kararlar:** tarih, karar, gerekçe, etkilediği dosyalar
- **Bilinen sorunlar**
