# Ç3d: Sunucu zemini

Claude Code'a yalnızca şunu yaz:

> `prompts/c3d-sunucu-zemini.md` dosyasını oku ve uygula.

Ön koşul: `c3c-tamam` etiketi.

---

## Görev

Modüllerin uygulama kapalıyken de çalışabilmesi için zemini kur: cihaz anahtarları, dışarıdan veri alan giriş ucu, modüllerin zamanlanmış işleri ve sunucuda modül bağlamı. Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm E. Bu oturumda yalnızca Ç3d yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir. Faz adı Ç3d, etiket `c3d-tamam`.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`
- `docs/12-sahne-ve-otomasyon.md`: bölüm E ve Ç3d kabul ölçütleri
- `docs/02-mimari.md`: güvenlik, "Zamanlanmış işler"
- `docs/11-yayin-ve-cihazlar.md`: yerel parçaların yazma yolu, plan koşulları
- `docs/06-modul-sozlesmesi.md`: `ModuleContext`, olaylar
- `docs/07-yol-haritasi.md`: "Ç3d"

## İlk iş

Bölüm E'yi numaralı dokümanlara işle (`docs/02`, `03`, `06`, `11`; `docs/07` içindeki modül hattı tablosunda "Veri bağlantıları" ve "Otomasyon" adımlarının çekirdek bağımlılığı artık Ç3d) ve tek commit'te kaydet.

## Ç3c'den devralınanlar

Ç3c'nin faz raporundaki iki açık not bu adımın kapsamına girer:

- Dışarıdan yazılan uyanış ve yatış (`core/wake`, `core/bed`) günün "son kullanım" kaydını da güncellemeli; yoksa yalnızca telefon otomasyonuyla uyanılan günde uygulama "Kaldığın yerden devam" ekranıyla açılabilir. Giriş ucunu kurarken ele al ve testle tut.
- Gerçek yatıştan sonra haftanın yeniden kurulmasının yalnızca saf fonksiyon testi var. `core/bed` ucu aynı yolu kullanacağı için veritabanı düzeyinde bir test ekle: yatış kaydı → yarının beklenen uyanışı → kapasite 30 dakikadan çok düşerse haftanın yeniden kurulması.

## Önerilen sıra

1. **Cihaz anahtarları.** Tablo, RLS, üretme ve iptal, Ayarlar → Bağlantılar. Anahtarın kendisi saklanmaz. Denetçi (adım kipi).
2. **Sunucuda modül bağlamı.** `ModuleContext`'in sunucu sürümü; yalnızca anahtarın sahibinin satırlarına erişim; sunucuda olay teslimi; modülün sunucu kodunda tarayıcıya özgü içe aktarmayı yasaklayan lint kuralı. Denetçi (adım kipi).
3. **Giriş ucu.** `/api/ingest/<kaynak>/<tür>`: anahtar, kapsam, şema, yineleme koruması, hız sınırı. Çekirdeğin türleri: `core/wake`, `core/bed`, `core/context`. `deneme` modülünde bir tür. Denetçi (adım kipi).
4. **Zamanlanmış işler.** `jobs`, tek zamanlayıcı ucu, `job_runs`, çekirdeğin kendi gece işleri aynı düzende. Tetikleyiciyi güncel plan koşullarına bakarak seç (barındırıcının zamanlayıcısı ücretsiz katmanda seyrek olabilir; veritabanının zamanlayıcısı seçenek); gerekçesini yaz. `deneme` modülünde bir iş.
5. **Kapanış.** Testler, `check:full`, faz denetimi, rapor, `c3d-tamam`, yayın (Ç3b'deki sırayla).

## Bu adıma özel kurallar

- **Güvenlik bu adımın özüdür.** Giriş ucu oturumsuz çalışan ilk yazma yoludur. Her red durumu testle sınanır: anahtar yok, yanlış, iptal edilmiş, kapsam dışı, başka hesabın verisi, bozuk gövde, yinelenen istek, hız sınırı. Anahtar günlüğe, hata iletisine ve `events` kaydına yazılmaz.
- **Sunucu anahtarı.** Supabase gizli anahtarı yalnızca sunucuda ve yalnızca anahtarın sahibi kullanıcının satırlarıyla sınırlı sorgularda kullanılır; sınır tek bir yardımcıda kurulur ve testle tutulur.
- **Ücret.** Seçtiğin zamanlayıcı ücretsiz katmanda kalmalı; ücret çıkaracak bir seçenek gerekiyorsa yapma, "Senden bekleyenler"e yaz.
- **Telefon denemesi.** iPhone Kestirmeler ile `core/wake` çağrısının adımlarını (otomasyon türü, adres, başlık, gövde) "Senden bekleyenler"e yaz; anahtarı kullanıcı kendisi yapıştırır.

## Kapsam dışı

- Ninova toplayıcısı ve öbür gerçek veri bağlantıları (modüllerin kendi adımları)
- Dış sistemlere komut gönderme
- Claude köprüsü (Ç5)

## Fazın sonunda

Faz raporuna ek: giriş ucunun güvenlik sınırlarının özeti ve onları tutan testler; seçilen zamanlayıcı ve sınırları; modül tasarım oturumları için not (bir modül `ingest` ve `jobs` yazarken nelere dikkat etmeli).
