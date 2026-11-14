# Arayüz

## Tasarım yönü

- **Sakin ve net.** Ekran gün boyu göz ucunda durur; dikkat çekmek için değil, bakıldığında cevap vermek için vardır. Hareketli öğe, rozet, bildirim balonu yok.
- **Tek odak.** Bugün ekranında en büyük öğe her zaman "şimdi" kartıdır. Geri kalan her şey ikincildir.
- **Yoğun ama okunur.** Modül sayfaları veri yoğundur (tablolar, zaman çizelgesi); Bugün ekranı seyrektir.
- **Açık ve koyu tema.** İkinci ekranda koyu tema varsayılan; gece durumunda parlaklık daha da düşer.
- **Renk anlam taşır.** Her modülün bir rengi vardır; bölümü olan modülde her bölümün (Okul içinde her dersin, rutinde sabahın ve akşamın) kendi rengi. Renkleri kullanıcı Ayarlar'dan değiştirir (Ç3e, aşağıda "Renkler ve bölümler"). Durum renkleri yalnızca üç anlam için kullanılır: yolunda, dikkat, geride. Kırmızı "gecikti" etiketi yoktur.
- **Tipografi.** Şimdi kartının başlığı ekranın en büyük yazısıdır ve masadan bir bakışta okunur.

## Rotalar

| Rota | Ekran |
| --- | --- |
| `/` | Bugün |
| `/hafta` | Haftalık kapasite |
| `/m` | Modüller: etkin ve duraklatılmış modüllerin çipleri |
| `/m/[slug]` | Modül sayfası; `/m/[slug]/<sekme>` sekmeyi, `/m/[slug]/…` modülün alt sayfalarını açar |
| `/m/[slug]/tam/[key]` | Modülün tam ekran görünümü (kabuk yok) |
| `/a/[slug]` | Alan sayfası |
| `/gelen` | Gelen kutusu |
| `/kapanis` | Akşam kapanışı |
| `/ayarlar` | Ayarlar: tema, günün çerçevesi, sesli anlatım (bu cihaz), yapay zeka, bağlantılar (Ç3d), dışa aktarım, hesap |
| `/ayarlar/moduller` | Modülleri etkinleştir, duraklat, arşivle; `/ayarlar/moduller/[slug]` modülün renkleri (Ç3e) ve kendi ayarları |
| `/ayarlar/bloklar` | Haftalık seriler, tek seferlik bloklar, önümüzdeki 4 haftanın blokları |

## Bugün (ikinci ekran yerleşimi)

Geniş ekranda tek sayfa, kaydırma yok:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Perşembe 12 Kasım · 10:40          Bugün 1/3 · bitiş 19:00   [Normal] │
├───────────────────────────────────────────┬──────────────────────────┤
│ ŞİMDİ                                     │ SIRADAKİ                 │
│ Okul · YZV406E                            │ Çalışma odası süpürme    │
│ HW2: lokalizasyon soruları                │ Ev · 15 dk · mola        │
│ 25 dk geçti · tahmin 45 dk  ▓▓▓▓▓░░░      │ DL proposal düzeltmeleri │
│ [Bitti]  [Ertele]  [Takıldım]             │ Okul · 40 dk             │
├───────────────────────────────────────────┴──────────────────────────┤
│ Bugün  ──[Okul]──│──────[İş]────────────────[Korunan]──              │
├──────────────────────────────────────────────────────────────────────┤
│ Uyarı · Cuma iki teslim üst üste: 1 saat Perşembe akşamına alındı    │
├──────────────────────────────────────────────────────────────────────┤
│ [Okul · teslim Cuma] [Sağlık · liste hazır] [Ev · 1/2]  [+ Yeni giriş]│
└──────────────────────────────────────────────────────────────────────┘
```

### Bileşenler (`src/core/ui/`)

| Bileşen | Görev |
| --- | --- |
| `TopBar` | Tarih ve saat, günün ilerlemesi (n/3), bitiş çizgisi, hayat modu, bağlam seçici (telefonda) |
| `NowCard` | `plan.now` durumuna göre çizilir (aşağıdaki tablo). Modül kendi işleri için özel içerik verebilir |
| `UpNext` | Sıradaki 2–3 atama |
| `WhyButton` | Planın gerekçesi: "neden bu iş, neden şimdi"; yapay zekanın ve motorun notları |
| `DayStrip` | Günün zaman şeridi: sabit bloklar, yuvalar, şimdiki an çizgisi |
| `AlertBar` | En fazla 2 uyarı; her uyarıda tek eylem düğmesi |
| `ModuleChips` | Modül başına tek satır durum; dokununca modül sayfası |
| `QuickAdd` | Hızlı giriş; her ekrandan `N` ile açılır |
| `PromptCard` | Olay sonrası tek soru |
| `SceneFrame` (Ç3c) | Çalışan işin modül sahnesi: çekirdeğin şeridi, hata sınırı, geçiş |

### NowCard durumları

| `plan.now` | İçerik | Eylemler |
| --- | --- | --- |
| `suggest` | Modül, iş başlığı, tahmini süre | Başla, Ertele, Başka bir şey yapıyorum |
| `running` | İş başlığı, geçen süre ve ilerleme çubuğu | Bitti, Ertele, Takıldım |
| `block` | Bloğun adı, bitiş saati | Yalnızca hızlı giriş |
| `prompt` | Tek soru ve seçenekleri | Seçenek düğmeleri, Sonra |
| `done` | "Bugün tamam", kısa özet (kaç iş, kaç dakika) | Vakit kalırsa listesini aç |
| `night` | Saat, yarının ilk işi (çerçeve açıkken yarının uyanışı da) | Yok |
| `morning` (Ç3c) | "Günaydın", günün kısa özeti | Uyandım, Biraz önce |
| `evening` (Ç3c) | "Akşam", sıradaki akşam işi, bu gecenin yatışı, yarının uyanışı, uyku süresi | Başla, Yatıyorum, Günü kapat, geç yatacağım, erken kalkacağım |
| `return` | "Kaldığın yerden devam", bugünün 3 işi | Başla |
| `running` + sahne (Ç3c) | Modülün sahnesi, üstte çekirdeğin şeridi | Çık; sahnenin kendi düğmeleri |

- **Takıldım:** Oturumu kapatır ve üç seçenek sunar: adımı küçült (yeni bir iş yaz), birini bekliyorum (bekliyor durumuna al), bugün değil (ertele).
- **Başka bir şey yapıyorum:** Tek satırlık giriş açar; yazılan şey için plansız oturum başlar. Modül seçimi isteğe bağlı.

**Ç1 ara hali (planlayıcı gelene kadar).** Kart yalnızca `suggest`, `running`, `block` ve boş durumlarını bilir; Ertele ve Takıldım Ç3'te gelir. Onların yerine geçici olarak şunlar vardır:

- **Durdur** (çalışan kartta): oturumu işi bitirmeden kapatır; geçen süre sayılır, iş havuza döner. Yanlışlıkla başlatılan iş için.
- **Bugün bitenler:** ekranın altında bugün biten işlerin sayısı ve listesi; her satırda **Geri al** (yanlışlıkla bitirilen iş havuza döner).

Ç3'te kart `plan.now` durumlarına göre yeniden kuruldu; **Durdur** (çalışan kartta) ve **Bugün bitenler** kaldı, ikisi de yanlış dokunuşun geri alınması için. Ç3'te kartın eklentileri:

- **Devam ediyor musun?** Oturum tahminin iki katını geçince kart sorar; "Devam ediyorum" cevabı oturumda saklanır (`sessions.confirmed_at`, her ekran bilir) ve soru bir tahmin süresi sonra yeniden gelir. 30 dakika cevap gelmezse oturum tahmini sürede bitmiş sayılarak kapatılır, ölçülmez (`close_unanswered_session`).
- **Takıldım → Adımı küçült** aynı modülde (kalemin oturumuysa aynı kalemde) bugüne 15 dakikalık bir iş açar; **Birini bekliyorum** işi (oturumsa kalemiyle birlikte) bekletir, takip üç gün sonra gelir; **Bugün değil** ertelemedir.
- **Takip** günü gelen bekleyen iş kartta "… bekleniyor. Takip et." olarak çıkar: Cevap geldi, Hâlâ bekliyor.
- **Sıradakiler** sonraki üç atamadır; kalanı ve sığmayanlar "Vakit kalırsa" altında kapalı durur. Gün tamamlanınca planda kalanlar da oraya geçer.
- **Gece** büyük saat ve "Yarın ilk iş: …"; **geri dönüş** "Kaldığın yerden devam", günün üç işi ve Başla. İkisinde de ekran sakindir: sıradakiler, "vakit kalırsa", günün şeridi, sabit bloklar ve uyarılar gösterilmez.
- Alt satırda **X dk'm var** (`X`) ve **Yeniden planla** (`R`); Yeniden planla günün üç işinin bitmiş olanlarını tutar, kalanını yeniden seçer (yapay zeka açıkken 7. adımda `replan`).
- **TopBar:** tarih ve saat, "Bugün n/3", bitiş çizgisi, hayat modu (Hafta'ya bağlantı), telefonda bağlam seçici (cihazda saklanır).
- **DayStrip:** günün başından bitiş çizgisine şerit; sabit bloklar gri, atanan işler işin rengiyle (Ç3e'den beri bölümün rengi; "Renkler ve bölümler"), şimdiki an çizgisi. Telefonda yana kayar.
- **AlertBar:** en çok iki uyarı; son tarih ve taban uyarısında "Haftaya bak", öbürlerinde "Modüle git".

**Görüşün gerek:** Durdur ve Bugün bitenler'in kalması; 30 dakikalık cevap süresi; uyarı eylemlerinin bağlantı olması; bağlam seçicinin gün değişince sorulmaması (yalnızca seçilir).

### Klavye (ikinci ekran)

| Tuş | Eylem |
| --- | --- |
| `Space` | Başla / Bitti |
| `E` | Ertele |
| `N` | Hızlı giriş |
| `X` | "X dk'm var" (ardından dakika) |
| `R` | Yeniden planla |
| `G` sonra `B` / `H` / `G` | Bugün / Hafta / Gelen kutusu |
| `1`–`9` | n. modülün sayfası |

### Sahne (Ç3c)

Çalışan işin modülü bir sahne veriyorsa (`docs/06-modul-sozlesmesi.md`, "Sahne") Bugün ekranı ona bırakılır:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 08:14   Sabah rutini · 6 dk                                    Çık   │  ← çekirdeğin şeridi
├──────────────────────────────────────────────────────────────────────┤
│                        (modülün sahnesi)                             │
│        arka plan · adımlar · sayaç · modülün düğmeleri               │
└──────────────────────────────────────────────────────────────────────┘
```

- Şerit: saat, modülün rengi ve işin adı, geçen süre, "Çık". Telefonda da tek satır.
- Geçiş kısa bir solmadır; hareket azaltma tercihinde hiç yoktur. `look.tone` arka planın tonunu verir: `calm` sakin, `focus` koyu ve düz, `energy` modülün rengine çalan. Son hali Ç4'te.
- "Çık"tan sonra standart ekran; kartın altında "Sahneye dön". Çıkış o cihazda, o oturum için hatırlanır.
- Sahne hata verirse standart kart ve altında tek satır: "Sahne açılamadı; iş sürüyor."
- **Görüşün gerek:** sahnenin yalnızca çalışan işte gelmesi; şeridin içeriği; "Çık"tan sonra dönüş yolu; tonların karşılığı.

### Diziler (Ç3f)

Uyanışa ve yatışa bağlı işler bir dizidir (`docs/06-modul-sozlesmesi.md`, "Diziler"):

- **Standart kartta dizi satırı.** Dizideki iş çalışırken (sahnesi yoksa ya da sahneden çıkıldıysa) ya da önerilirken (akşam kartı dahil) Şimdi kartında modül satırının altında tek satır: "Sabah dizisi 2/3 · sırada Duş ve hazırlık" (yatışta "Akşam dizisi"; son işte "son iş"). Sayı yapılmış ve çalışan işlerle birlikte sıradır; geçilenler sayılmaz. **Görüşün gerek** (metin).
- **Kendiliğinden devam.** Dizideki çalışan iş Bitti ya da Ertele ile kapanınca sıradaki iş aynı cihazda hemen başlar; ekran sıradaki işin sahnesine (yoksa standart karta) aynı solmayla geçer. Son iş bitince standart ekran.
- **Sahneden kapanış.** Sahne akşam kapanışını isteyince kapanış sahnenin yerinde açılır; çekirdeğin şeridi üstte durur, oturum sürer. Onaylayınca ya da "Vazgeç"le sahneye dönülür; bu kapanışta "Onayla ve yat" yoktur.
- **Ayarlar → Günün çerçevesi:** "Dizide sıradaki iş kendiliğinden başlasın" (başlangıçta açık). **Görüşün gerek** (başlangıç değeri, ertelemeden sonra devam).

### Günün çerçevesi (Ç3c)

Çerçeve açıkken (`settings.day_frame`, `docs/04-planlayici.md` "Günün çerçevesi"):

- **Günaydın** (`morning`): kartta "Günaydın", büyük "Uyandım" düğmesi, yanında "Biraz önce" (15, 30, 60 dk önce; iki dokunuş), altında günün kısa özeti: günün 3 işi, ilk sabit blok, bitiş çizgisi. Ekranın geri kalanı (Sıradakiler, şerit) olağan haliyle durur. "Uyandım"dan sonra kart uyanışa bağlı ilk işi önerir.
- **Akşam** (`evening`): sakin kart. Üstte "Akşam"; varsa sıradaki akşam ya da yatışa bağlı iş ve Başla; "Bu gece yatış 23:30 · yarın uyanış 07:30 · uyku 8 sa" satırı (uyku hedefin altındaysa nedeniyle: "Yarın 08:30'da Ders; bu gece en çok 7 sa uyku."); "Yatıyorum", "Günü kapat" (kapanış yapılmadıysa); iki küçük düğme: "Bu gece geç yatacağım" ve "Yarın erken kalkacağım" (her biri 30, 60, 90 dk seçer; yalnızca o geceyi ve o sabahı değiştirir). Sıradakiler, uyarılar ve "vakit kalırsa" gösterilmez.
- **Gece:** büyük saat, altında "Yarın uyanış 07:30" ve "Yarın ilk iş: …" (iki satır).
- **Üst şerit:** "uyanış 07:40" (tahminiyse "~07:40"; kayıt yoksa "beklenen uyanış 08:00") ve "yatış 22:00–01:00".
- **Zaman çizelgesi** uyanıştan beklenen yatışa uzanır; uyanışa bağlı, çalışma, akşam ve yatışa bağlı bölümler zemin tonuyla ayrılır, bitiş çizgisi ince bir çizgidir.
- **Akşam kapanışının sonunda** "Onayla"nın yanında "Onayla ve yat" (kapanışı yazar ve yatışı kaydeder).
- **Hafta:** en üstte tek satır: son 7 günün ortalama uyanışı, yatışı ve uykusu (kayıt olan günlerden; yoksa satır yok). Seri, puan, rozet yok.
- **Ayarlar → Günün çerçevesi:** "Günün çerçevesi açık" (kapalıyken planlayıcı Ç3b'deki gibi), uyanış ve yatış aralığı, uyku hedefi (saat), gün tipine özel aralıklar (isteğe bağlı), "Uyandım'dan sonra ilk rutin kendiliğinden başlasın" (Ç3f: uyanış telefondan gelince uygulama açılınca da), "Dizide sıradaki iş kendiliğinden başlasın".
- **Ayarlar → Sesli anlatım (bu cihaz):** açık ya da kapalı, ses (cihazın Türkçe sesleri), hız, "Bu cihaz dokunuş olmadan da konuşsun", "Dene".

### Ayarlar → Bağlantılar (Ç3d)

Cihaz anahtarları (`docs/02-mimari.md`, "Cihaz anahtarları ve giriş ucu"). Bölüm Yapay zeka ile Dışa aktarım arasındadır.

- Tek satırlık açıklama: telefonun otomasyonu ve toplayıcılar Sherpa'ya bir anahtarla yazar; anahtar yalnızca seçilen uçlara yazar, hiçbir şey okuyamaz.
- **Yeni anahtar:** ad ve "Yazabileceği uçlar" (çekirdeğin üç türü ve etkin modüllerin türleri; her birinin yanında adresteki adı, `core/wake`), "Anahtar üret" (ad ve en az bir uç seçilince).
- **Bir kez gösterim:** üretilince form yerine anahtar, "Kopyala", isteğin biçimi ve seçilen uçların tam adresleri, "Tamam". "Tamam"dan ya da sayfadan çıkınca anahtar bir daha gösterilmez.
- **Liste:** en yeni üstte; ad, anahtarın ilk 8 karakteri, uçların adları, "Son kullanım: …" ya da "Henüz kullanılmadı"; iptal edilmiş anahtar soluk ve "İptal edildi: …". "İptal et" iki dokunuştur ("Evet, iptal et" ya da "Vazgeç"). Son kullanım canlı güncellenir.
- **Görüşün gerek:** bölümün yeri, metinler, iptaldeki onay adımı, adreslerin ekranda gösterilmesi.
- **Görüşün gerek:** Günaydın ve akşam ekranlarının içeriği ve metinleri; "Biraz önce" ve "geç yatacağım" seçenekleri; üst şeritteki gösterim; zaman çizelgesindeki bölümlerin görünüşü; Hafta'daki satır.

### Renkler ve bölümler (Ç3e)

Bir iş ekranda modülünün değil, bölümünün rengiyle görünür (`docs/06-modul-sozlesmesi.md`, "Bölümler"). Renk tek yardımcıdan gelir: kullanıcının bölüm rengi → bölümün varsayılanı → kullanıcının modül rengi → modülün varsayılanı. Bölümü olmayan modülde her şey eskisi gibidir.

- **İşin rengini (çözülmüş rengi) kullanan yerler:** zaman çizelgesi (şerit ve yol), Şimdi kartı (sahnenin şeridi dahil), Sıradakiler, "Vakit kalırsa", Günaydın ve akşam kartlarındaki iş, sahnenin çerçevesi ve `energy` tonu, Hafta'daki "Haftanın kalemleri", akşam kapanışındaki yarının taslağı, modül sayfasında Yaklaşanlar.
- **Modülün rengini kullanan yerler** (modül düzeyi): modül çipleri, Hafta'daki kapasite çubuğu ve modül payları, modül listeleri (Modüller, Ayarlar → Modüller), modül sayfasının başlığı, hızlı girişteki ve gelen kutusundaki modül seçimi.
- **Ayarlar → Modüller → <modül>:** sayfanın en üstünde "Renkler" bölümü. İlk satır modülün kendisi, altında her bölüm bir satır: renk noktası, ad, "Değiştir". "Değiştir" satırın altında seçiciyi açar: hazır paletin 12 rengi (dokununca kaydedilir), "Özel" (`#rrggbb` ya da sistemin renk seçicisi) ve renk varsayılanından farklıysa "Varsayılana dön". Hazır palet açık ve koyu temada zemine karşı en az 3:1 seçilir kalan renklerden oluşur; özel renk bunun altındaysa seçicide tek satır: "Bu renk açık ya da koyu temada zor seçilir." Kaydetmeye engel değildir. Değişiklik öbür cihaza canlı gider. Bölümü listeden çıkmış eski renkler saklanır ama gösterilmez.
- **Palet:** kehribar `#d97706`, turuncu `#ea580c`, gül `#e11d48`, pembe `#db2777`, eflatun `#c026d3`, menekşe `#7c3aed`, lacivert `#4361d8`, mavi `#2563eb`, camgöbeği `#0891b2`, deniz yeşili `#0d9488`, yeşil `#16a34a`, kurşuni `#64748b`.
- **Düzenleme formu:** bölümü olan modülün iş, kalem, oturum işi ve ritim formlarında başlığın hemen altında "Bölüm" seçimi: "Bölümsüz" ve modülün o anki bölümleri. İşin bölümü listeden çıkmışsa seçimde "<anahtar> (artık yok)" olarak durur. Oturum işinde "Bölümsüz" kalemin bölümünü devralır ("kalemin bölümü: Sabah"). Formdan seçilen bölüm kullanıcınındır; modülün sonraki teklifi ezmez.
- **Görüşün gerek:** palet ve adları; seçicinin yeri (sayfanın üstü) ve satır yerleşimi; modül düzeyinde kalan yerler; formda bölüm seçiminin yeri (başlığın altı); uyarının eşiği (3:1) ve metni.

## Telefon

Aynı bileşenler dikey sıralanır: TopBar, NowCard, UpNext, ModuleChips; DayStrip yatay kaydırılır. Altta sabit bir hızlı giriş düğmesi durur. Bağlam seçici TopBar'dadır; seçim cihazda saklanır. Gün değişince sorulması Ç4'tedir (Ç3'te yalnızca seçilir).

## Hızlı giriş

Tek kutu, iki kullanım:

1. **Yapılı:** Yazarken altta modül çipleri ve tür seçenekleri çıkar. `Tab` ile modül, ardından tarih ve süre seçilir. Tarihler doğal kısaltmalarla yazılabilir: `bugün`, `yarın`, `cuma`, `15.11`, `+3g` (gün), `+2h` (hafta). Süre de yazılabilir: `45dk`, `1s`, `1.5sa`, `1s30dk`. Bu sözcükler yalnızca satırın sonunda okunur; başlığın ortasındaki "cuma" başlıkta kalır. Haftanın günü, bir sonraki o gündür.
2. **Serbest:** Hiçbir şey seçmeden `Enter`: metin gelen kutusuna düşer.

Kutu tek satırla başlar ve yapıştırılan çok satırlı metinle büyür (`sherpa` bloğu satırlarını korur); `Enter` kaydeder, `Shift+Enter` satır ekler. Yapıştırılan yapılı bloğu tanıyan modül varsa giriş doğrudan ona işlenir.

Yapay zeka açıkken serbest metin gelen kutusunda beklemez: giriş hemen gelen kutusuna yazılır, birkaç saniye içinde yapay zeka onu modülü, süresi, önemi ve son tarihiyle bir işe (tek oturum) ya da iş kalemine (birden çok oturum) çevirir ve giriş gelen kutusundan çıkar. İş önce varsayılanlarla açılmaz, çünkü her iş bir modüle bağlıdır ve modülü yapay zeka seçer. Satırın sonuna yazılan gün ve süre kullanıcınındır; yapay zeka onları değiştirmez. Yapay zekanın koyduğu değerler küçük bir işaretle ayırt edilir; üzerine gelince gerekçesi görünür, tıklayınca değiştirilir. Emin olmadığı girişler gelen kutusunda onay kartı olarak kalır. Yapay zeka kapalıyken, yanıt vermezse ya da bütçe dolduysa giriş gelen kutusunda kalır ve kullanıcı yönlendirir.

Her modül hızlı girişe kendi türlerini ekler (sözleşmenin `intake` bölümü): Okul "sınav/teslim" ve "not", Beslenme "tartı" ve "alışveriş kalemi" gibi.

## Zaman kısıtları (Ç3b)

Kısıtların çoğunu modüller kendi ayarlarından yazar; kullanıcı bunları tek bir işte değiştirmek ya da elle eklenen bir işe koymak isteyince formda görür. Veri: `docs/03-veri-modeli.md`, "Zaman kısıtları".

**Formda "Zaman" bölümü.** İş, iş kalemi ve ritim düzenleme formlarında, öbür alanların altında kapalı gelir. Kısıt varsa kapalıyken tek satırlık özeti görünür; yoksa yalnızca başlığı. Açılınca:

```
▾ Zaman
  Yalnızca şu saatlerde    [ Her gün      ▾ ] [ 07:00 ] – [ 23:00 ]   ✕
                           + aralık ekle
  Tercih edilen saatler    + aralık ekle
  Kaçınılan saatler        [ Hafta içi    ▾ ] [ 18:00 ] – [ 20:30 ]   ✕
                           + aralık ekle
  Yol                      gidiş [ 20 ] dk   dönüş [ 20 ] dk
  Dinlenme                 iki yapılış arasında en az [ 1 ] gün        (yalnızca ritimde)
```

- Gün seçimi: Her gün, Hafta içi, Hafta sonu ya da tek tek günler.
- Kapalıyken özet: `07:00–23:00 · kaçın: hafta içi 18:00–20:30 · yol 20+20 dk · 1 gün ara`.
- Modülün ya da yapay zekanın koyduğu değer öbür alanlardaki gibi işaretlidir; kullanıcı değiştirince o alt alan kullanıcının olur.
- Geçersiz giriş (bitişi başlangıcından erken aralık, sığmayan dinlenme günü) kaydedilmez, alanın altında tek cümleyle söylenir.
- Aralıkların hepsi bitiş çizgisinden sonraya düşüyorsa bölümün altında uyarı: "Bu saatler bitiş çizgisinden (19:00) sonra; planlayıcı bu işi yerleştiremez."
- Oturum işinde bölüm boşken "kalemin saatleri geçerli" yazar.

**Zaman çizelgesi (DayStrip).** Yol süresi, işin önünde ve arkasında aynı modül renginin soluk, taralı hali olarak çizilir; üzerine gelince (telefonda dokununca) "yol 20 dk" yazar.

**Şimdi kartı ve Sıradakiler.** Yol süresi olan işte süre satırı `Modül · 60 dk · yol 20+20 dk` biçimindedir. Kart, işin çalışma aralığı değil ayak izi başladığında önerir (yola çıkma zamanı). Planın sıradaki işi pencereye ya da yola bağlıysa ve ayak izi henüz başlamadıysa kart onu saatiyle gösterir ("Yola çıkış 16:40"; yolu yoksa "Başlangıç 16:45"); kullanıcı yine de hemen başlatabilir. **Görüşün gerek.**

**Uyarılar.** "Bugün uygun saat kalmadı: …" ve "Bu hafta uygun saat yok: …" AlertBar'da ve Hafta ekranında öbür uyarılar gibi görünür; eylemi "Modüle git".

**Hızlı giriş.** Yapay zeka açıkken satırda açıkça yazılan saat kısıtı işe işlenir ("spor akşam 8'den sonra"); yapılı kullanımda ayrı bir kısaltma yoktur, kısıt formdan girilir.

## Gelen kutusu

Yönlendirilmemiş girişlerin listesi. Her satırda: metin, önerilen modül (varsa), tek dokunuşla "işe çevir", "bloğa çevir", "sil". Yapay zeka açıksa öneriler dolu gelir; kapalıysa kullanıcı seçer.

## Hafta

- Üstte 7 günlük şerit: her gün için sabit bloklar ve kullanılabilir süre.
- Altında kapasite çubuğu: haftanın kullanılabilir süresi ile modüllerin istediği sürenin karşılaştırması, modül renkleriyle yığılmış. Talep kapasiteyi aşıyorsa hangi son tarihlerin tehlikede olduğu listelenir.
- Hayat modu seçimi burada yapılır (tarih aralığıyla).
- Önümüzdeki 4–6 haftanın yük görünümü: hafta başına son tarih sayısı ve ağırlığı.

Ç3'teki hali: üstte 7 gün (blokların ilk üçü ve günün kullanılabilir süresi; geçen günler "geçti"), kapasite çubuğu (modül renkleriyle istenen süre, kapasitenin çizgisi; aşınca tehlikedeki son tarihler), "Haftanın kalemleri" (taahhüt edilen kalemler, bu haftaki payın ne kadarı işlendi) ve modül payları, hayat modu (mod, başlangıç, bitiş; çakışan dönemler kırpılır, "Normal" aralığı temizler), önümüzdeki 8 haftanın yükü (istenen / kapasite, son tarihler), "Haftayı yeniden kur" (kullanıcının isteği; taahhüt baştan kurulur). Yapay zeka açıkken: haftanın kalemlerinin altında taahhüdün gerekçesi (`week`), en altta "Yapay zekanın notları": Cumartesiden itibaren haftanın özeti ve önerileri (`review`), sıkışan haftalar için öneriler (`month`); yalnızca gösterilir. Akşam kapanışının taslağında da yapay zekanın gerekçesi her işin altında durur. **Görüşün gerek** (yerleşim, 8 hafta).

## Modül sayfası iskeleti

Her modül sayfası aynı 5 bölgeyi kullanır; çekirdek `ModulePageShell` bileşenini sağlar, modül içini doldurur.

| Bölge | İçerik |
| --- | --- |
| 1. Durum şeridi | Tek cümlelik durum, sağlık rengi, haftanın sayıları |
| 2. Yaklaşanlar | Modülün sıradaki işleri, tarih sırasıyla |
| 3. Gövde | Modüle özel görünümler; sekmelerle |
| 4. Geçmiş ve trend | Zaman içindeki gidişat |
| 5. Giriş ve ayarlar | Modülün kendi girişleri ve kuralları |

Çekirdeğin doldurdukları (modül bir şey vermese de sayfa çalışır):

- **Durum şeridi:** modülün çip metni ve sağlığı, haftalık raporunun sayıları ve en çok 2 önerisi; yanında hızlı eylemler ve tam ekran görünümlerin bağlantıları.
- **Yaklaşanlar:** modülün açık işleri, kalemleri ve ritimleri, tarih sırasıyla; bekleyen ve henüz başlamamış olanlar da burada görünür (Bugün listesi yalnızca şimdi yapılabilenleri gösterir). Her satırda Başla, Bitti ve kalemle düzenleme: ad, son tarih, süre ya da efor, önem; iş "bekliyor" durumuna alınabilir ya da bırakılabilir, ritim durdurulabilir. Kullanıcının burada değiştirdiği alan onundur; modülün sonraki teklifi o alanı ezmez.
- **Geçmiş:** modül kendi görünümünü vermezse son 8 haftada harcanan süre (hafta başına).
- **Giriş ve ayarlar:** "İş ekle", modülün giriş türleri, "Ritim ekle" (elle ritim) ve modül ayarlarının bağlantısı.

Kodu olmayan modül satırının (örnek veri, kodu kaldırılmış modül) sayfası da aynı iskeletle açılır; gövdesi boştur.

Alan sayfası (`/a/[slug]`) aynı iskeleti kullanır ve üye modüllerin durum şeritlerini ve seçilmiş görünümlerini birleştirir.

## Akşam kapanışı

`/kapanis`, tek akış; her adım tek ekran, klavyeyle geçilir (Enter ilerler, Escape geri döner; metin kutusunda Ctrl+Enter). İçerik `docs/04-planlayici.md` içinde: sorular (en çok 5), "Bugün başka ne yaptın?" (bugün için açık kalan işler ve ritimler, tek dokunuşla "Yaptım"), yarının taslağı (günün üç işi işaretli; dokunarak değişir, "Çıkar" yarının listesinden alır), aklında kalanlar (her satır gelen kutusuna), onay. Onayla yarının kaydını (`plan_source = closing`, çıkarılanlar `skipped`) ve bugünün kapanışını yazar, Bugün'e döner; ekran gece durumundadır. Bugün ekranının alt satırında "Günü kapat". İstenirse hiç yapılmaz. **Görüşün gerek** (adımlar ve metinler).

## Boş ve hata durumları

- Hiç iş yoksa: "Bugün için planlanan bir şey yok" ve hızlı giriş.
- Veri okunamadıysa: boş gün gösterilmez; "Veri okunamadı" ve "Yeniden dene".
- Kalemin ayrılan eforu dolduysa: kalem kendiliğinden kapanmaz; şimdi kartı "Bitti mi?" diye sorar (Bitti, Devam et).
- Bağlantı koptuysa: TopBar'da küçük bir işaret; son bilinen plan ekranda kalır.
- Oturum düştüyse: sessizce giriş sayfası.
