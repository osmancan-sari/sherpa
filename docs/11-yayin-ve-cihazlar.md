# Yayın, cihazlar ve eşitleme

Sherpa buluta kurulu, yalnızca kullanıcıya açık tek bir uygulamadır. Aynı adres telefonda uygulama gibi, masaüstündeki ikinci ekranda sürekli açık bir pano gibi çalışır; ikisi her an aynı veriyi gösterir.

## Ne nerede çalışır

| Parça | Nerede | Bilgisayar kapalıyken |
| --- | --- | --- |
| Uygulama (arayüz, API rotaları, giriş ucu, zamanlanmış işler) | Vercel | Çalışır |
| Veritabanı, kimlik, canlı eşitleme, zamanlayıcı (`pg_cron`) | Supabase | Çalışır |
| Telefonun otomasyonu (uyanış, yatış, konum) | Telefon (Kestirmeler) | Telefonda çalışır; giriş ucuna yazar |
| Yapay zeka çağrıları | Vercel → Anthropic API | Çalışır |
| Claude köprüsü (MCP) | Vercel (`/api/mcp`) | Çalışır; telefondaki Claude sohbetinden de |
| Ninova toplayıcısı | Kullanıcının bilgisayarı | Bekler; bilgisayar açılınca kaçırdığını okur |
| Hazırlık dokümanı otomasyonu | Kullanıcının bilgisayarı | Bekler |

Kural: kullanıcının üniversite şifresi ve ders klasörleri yereldir; onlara dokunan her şey yerelde çalışır ve sonucu buluta yazar. Geri kalan her şey buluttadır, bu yüzden telefon ve ikinci ekran bilgisayardan bağımsız çalışır.

Yerel parçaların veritabanına yazma yolu: Supabase gizli anahtarı bilgisayara ve telefona konmaz. Toplayıcı da telefonun otomasyonu da uygulamanın giriş ucuna kendi cihaz anahtarıyla yazar (Ç3d): `POST /api/ingest/<kaynak>/<tür>`, `Authorization: Bearer <anahtar>`, JSON gövde, yinelenebilecek istekte `Idempotency-Key`. Anahtar Ayarlar → Bağlantılar'da üretilir, yalnızca bir kez gösterilir, yalnızca seçilen uçlara yazar, hiçbir şey okuyamaz ve iptal edilebilir. Ayrıntı `docs/02-mimari.md`, "Cihaz anahtarları ve giriş ucu".

## Yalnızca kullanıcıya özel

Uygulama internetten erişilebilir bir adrestedir; gizliliği adres değil kimlik sağlar. Katmanlar:

1. **Tek hesap.** Supabase'de yeni kayıt kapalıdır; yalnızca `ALLOWED_EMAIL` giriş yapabilir.
2. **RLS.** Her tablo `user_id = auth.uid()` ile korunur. İstemcideki genel anahtar tek başına hiçbir veri okuyamaz.
3. **Sunucu sırları.** Gizli anahtar, Anthropic anahtarı ve zamanlayıcının sırrı yalnızca Vercel ortam değişkenlerinde (zamanlayıcının sırrı ayrıca Supabase Vault'ta); cihaz anahtarları veritabanında yalnızca özet olarak durur.
4. **Köprü, giriş ve zamanlayıcı uçları** kimlik doğrulaması olmadan cevap vermez; giriş ucu hiçbir veri döndürmez.
5. **Görünmezlik.** `noindex`; önizleme dağıtımları erişim korumasına alınır.
6. **Hesap güvenliği.** GitHub deposu özeldir; GitHub, Vercel, Supabase ve Anthropic hesaplarında iki adımlı doğrulama açıktır.

### Giriş yöntemi

Sihirli bağlantı **kullanılmaz**: telefonda ana ekrana eklenen uygulamanın deposu tarayıcıdan ayrıdır, e-postadaki bağlantı tarayıcıda açılır ve oturum uygulamaya geçmez. Bunun yerine:

- **E-postaya gelen tek kullanımlık kod** (uygulamanın içinde yazılır), ya da
- **Geçiş anahtarı (passkey)**: Face ID ya da Touch ID ile giriş.

Oturum uzun ömürlüdür; yenileme belirteci kendiliğinden yenilenir. Hedef: her cihazda bir kez giriş.

Kodu taşıyan e-posta şablonu (`supabase/templates/magic_link.html`) bulutta yalnızca özel bir SMTP göndericisiyle uygulanabilir: Supabase'in ücretsiz katmanı, kendi hazır göndericisiyle şablon değiştirmeye izin vermez ve hazır şablon kod yerine bağlantı gönderir. Gönderici Resend'dir (ücretsiz katman; alan adı doğrulanmadan yalnızca hesap sahibinin adresine gönderir, tek kullanıcı için yeter); anahtarı yalnızca ortam değişkenindedir ve ayar `supabase/config.toml` içindeki `[remotes.*]` bloklarından gönderilir. Yerelde kodlar Mailpit'e düşer.

## Adres

Uygulama telefona kurulmadan önce kalıcı adres belirlenir (özel alan adı ya da sabit bir `vercel.app` adresi). Adres değişirse telefondaki uygulama yeniden kurulur ve yeniden giriş yapılır.

## Telefon: uygulama gibi

PWA olarak kurulur (iPhone'da Safari → Paylaş → Ana Ekrana Ekle).

**Olması gerekenler**
- Tam ekran açılış, uygulama simgesi, açılış ekranı, durum çubuğu rengi
- Çentik ve alt çubuk için güvenli alanlar; `100dvh`
- En az 44 pt dokunma alanları; alt sabit hızlı giriş düğmesi; tek elle kullanım
- Sayfa kaydırma esnemesi ve çift dokunma yakınlaştırması kapalı; metin seçimi yalnızca gereken yerde
- İyimser güncelleme: her dokunuş anında yansır
- Uygulama kabuğu servis çalışanıyla önbellekte: açılış bağlantıdan bağımsız hızlıdır
- Son bilinen plan cihazda saklanır: bağlantı yokken ekran boş kalmaz

**Bağlantısız kullanım (Ç4)**
Metroda ve kampüste bağlantı kopabilir. Tam çevrimdışı çalışma hedef değildir; üç işlem kuyruğa alınır ve bağlantı gelince gönderilir: hızlı giriş, iş tamamlama, oturum başlatma ve bitirme. Bunlar yalnızca ekleme türü işlemlerdir, tek kullanıcı olduğu için çakışma üretmez. Zaman damgası işlemin yapıldığı andır.

**PWA'nın sınırları**
- Ana ekran araç takımı (widget) ve kilit ekranı canlı gösterimi yapılamaz.
- Bildirimler web push ile denenir (Ç4); kullanıcının izin vermesi ve uygulamanın ana ekrana kurulmuş olması gerekir. Güvenilir çıkmazsa saatli randevular için telefonun takvim alarmı yedek olur.
- Bu sınırlar ileride rahatsız ederse aynı kod bir yerel kabuk içine alınabilir (ör. Capacitor). Bu, Apple geliştirici hesabı ve mağaza dışı kurulum yükü getirir; v1 kapsamında değildir.

## İkinci ekran: sürekli açık pano

**Kurulum**
- Tarayıcının "uygulama olarak yükle" özelliğiyle ayrı bir pencere olarak kurulur: sekme ve adres çubuğu yoktur, ikinci monitöre sabitlenir, oturum açılışında kendiliğinden başlatılabilir.
- Pano görünümü geniş yatay ekran için ayrı bir yerleşimdir (`docs/05-arayuz.md`): kaydırma yok, gezinme gizli, büyük yazı. Pencere daraltılırsa telefon yerleşimine geçer; tek kod, iki yerleşim.

**Sürekli açık kalmanın gerekleri**
- **Ekranın uyumaması.** Ayarlardan açılan bir seçenekle Ekran Uyanık Kalma API'si kullanılır: pano görünürken ekran kararmaz. Bitiş çizgisinden sonra ve gece durumunda kilit bırakılır, ekran normal uyur.
- **Uykudan dönüş.** Bilgisayar uyanınca canlı bağlantı yeniden kurulur ve bütün sorgular yenilenir.
- **Saat.** "Şimdi" durumu dakikada bir ve her veri değişiminde yeniden hesaplanır; pencere arka planda kalıp öne gelince hemen yenilenir.
- **Oturum.** Belirteç yenilemesi başarısız olursa pano son bilinen planı gösterir ve köşede "yeniden giriş" işareti çıkar; boş ekran ya da giriş sayfası görünmez.
- **Gece.** Koyu tema ve düşük parlaklık; gece durumunda yalnızca saat ve yarının ilk işi.

## Eşitleme: her yerde güncel veri

Tek kaynak Supabase'dir; cihazlarda kalıcı ayrı veri yoktur.

1. **Canlı değişiklikler.** Her istemci çekirdek tabloların değişikliklerine abonedir; bir değişiklik ilgili sorguyu yeniler. Telefonda işaretlenen iş ikinci ekranda birkaç saniye içinde görünür.
2. **Güvenlik ağı.** Canlı bağlantı kopup yeniden kurulurken olay kaçabilir. Bu yüzden: bağlantı yeniden kurulunca, pencere öne gelince ve ayrıca dakikada bir, plan için gereken sorgular yenilenir.
3. **Aynı veri, aynı plan.** Planlayıcı her cihazda aynı veriden aynı sonucu üretir (saf fonksiyon). İki ekran aynı "şimdi" işini gösterir; plan ayrıca eşitlenmez.
4. **Süre sayaçları sunucu zamanına dayanır.** Açık oturumun geçen süresi `started_at` değerinden hesaplanır; cihazlar kendi sayaçlarını tutmaz. Telefonda başlatılan oturum ikinci ekranda aynı süreyle akar.
5. **Yerel parçalar aynı yoldan yazar.** Ninova toplayıcısının yazdığı kayıtlar da canlı değişiklik olarak bütün ekranlara düşer.
6. **Yazma çakışması.** Tek kullanıcı ve alan düzeyinde güncellemeler olduğu için son yazan kazanır; ayrı bir çözümleme katmanı yoktur.

## Ortamlar ve maliyet

- İki ortam: `dev` (deneme) ve `prod` (kullanıcının gerçek verisi). Şema değişiklikleri önce `dev`'de denenir.
- Supabase: `sherpa-dev` ve `sherpa-prod` (Frankfurt, ücretsiz katman). Vercel: `sherpa-private`, GitHub deposuna bağlı (`main` → üretim, öbür dallar → önizleme); üretim `https://sherpa-private.vercel.app` (`sherpa-prod`), önizlemeler `sherpa-dev`'e bağlıdır ve Vercel girişiyle korunur.
- Beklenen aylık maliyet: barındırma ve veritabanı için ücretsiz katmanlar yeterli olmalı; yapay zeka yaklaşık 2 $; alan adı isteğe bağlı.
- Kurulum sırasında güncel plan koşullarına bakılır: ücretsiz katmanda zamanlanmış iş sıklığı, kullanılmayan projenin duraklatılması, canlı bağlantı sınırları. Sherpa'nın ihtiyacı küçüktür (tek kullanıcı, günde birkaç zamanlanmış iş), ama `dev` projesi uzun süre kullanılmazsa duraklayabilir.
- Zamanlayıcı (Ç3d, Kasım 2026'daki koşullar): Vercel'in ücretsiz katmanı zamanlayıcıyı günde bir çalışmaya ve ±59 dakikalık hassasiyete sınırlar; bu yüzden asıl tetikleyici Supabase'in zamanlayıcısıdır (`pg_cron` ve `pg_net`, ücretsiz projelerde de var): 15 dakikada bir uygulamanın `/api/jobs/tick` ucunu çağırır. Vercel'in günlük zamanlayıcısı yedektir. Bir projede zamanlayıcının çalışması için Vault'a iki değer girilir (`sherpa_tick_url`, `sherpa_cron_secret`) ve aynı sır Vercel'de `CRON_SECRET` olur; adımlar `docs/ILERLEME.md`'de. Uygulama ayrıca `SUPABASE_SECRET_KEY` ister (sunucuda kullanıcı adına erişim).
- Yedek: veritabanının günlük yedeği ve ayarlardaki "Tümünü dışa aktar".

## Kabul ölçütleri (ilgili fazlara dağıtılmıştır)

- [ ] Telefonda ana ekrandan açılan uygulamada kodla giriş yapılıyor ve oturum haftalarca açık kalıyor
- [ ] Giriş yapılmadan hiçbir sayfa ve hiçbir API rotası veri döndürmüyor
- [ ] Telefonda tamamlanan iş, ikinci ekranda 3 saniye içinde güncelleniyor
- [ ] Telefonda başlatılan oturumun süresi iki ekranda aynı akıyor
- [ ] Bilgisayar uykudan dönünce pano 5 saniye içinde güncel
- [ ] Uçak modunda yapılan hızlı giriş, bağlantı gelince kaydoluyor
- [ ] Pano açıkken ekran kararmıyor; gece durumunda karartma serbest
