# Arayüz

## Tasarım yönü

- **Sakin ve net.** Ekran gün boyu göz ucunda durur; dikkat çekmek için değil, bakıldığında cevap vermek için vardır. Hareketli öğe, rozet, bildirim balonu yok.
- **Tek odak.** Bugün ekranında en büyük öğe her zaman "şimdi" kartıdır. Geri kalan her şey ikincildir.
- **Yoğun ama okunur.** Modül sayfaları veri yoğundur (tablolar, zaman çizelgesi); Bugün ekranı seyrektir.
- **Açık ve koyu tema.** İkinci ekranda koyu tema varsayılan; gece durumunda parlaklık daha da düşer.
- **Renk anlam taşır.** Her modülün bir rengi vardır; Okul içinde her dersin kendi rengi. Durum renkleri yalnızca üç anlam için kullanılır: yolunda, dikkat, geride. Kırmızı "gecikti" etiketi yoktur.
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
| `/ayarlar` | Ayarlar: tema, dışa aktarım, hesap |
| `/ayarlar/moduller` | Modülleri etkinleştir, duraklat, arşivle; `/ayarlar/moduller/[slug]` modülün kendi ayarları |
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

### NowCard durumları

| `plan.now` | İçerik | Eylemler |
| --- | --- | --- |
| `suggest` | Modül, iş başlığı, tahmini süre | Başla, Ertele, Başka bir şey yapıyorum |
| `running` | İş başlığı, geçen süre ve ilerleme çubuğu | Bitti, Ertele, Takıldım |
| `block` | Bloğun adı, bitiş saati | Yalnızca hızlı giriş |
| `prompt` | Tek soru ve seçenekleri | Seçenek düğmeleri, Sonra |
| `done` | "Bugün tamam", kısa özet (kaç iş, kaç dakika) | Vakit kalırsa listesini aç |
| `night` | Saat, yarının ilk işi | Yok |
| `return` | "Kaldığın yerden devam", bugünün 3 işi | Başla |

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
- **Gece** büyük saat ve "Yarın ilk iş: …"; **geri dönüş** "Kaldığın yerden devam", günün üç işi ve Başla; sıradakiler ve uyarılar gösterilmez.
- Alt satırda **X dk'm var** (`X`) ve **Yeniden planla** (`R`); Yeniden planla günün üç işinin bitmiş olanlarını tutar, kalanını yeniden seçer (yapay zeka açıkken 7. adımda `replan`).
- **TopBar:** tarih ve saat, "Bugün n/3", bitiş çizgisi, hayat modu (Hafta'ya bağlantı), telefonda bağlam seçici (cihazda saklanır).
- **DayStrip:** günün başından bitiş çizgisine şerit; sabit bloklar gri, atanan işler modül rengiyle, şimdiki an çizgisi. Telefonda yana kayar.
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

## Telefon

Aynı bileşenler dikey sıralanır: TopBar, NowCard, UpNext, ModuleChips; DayStrip yatay kaydırılır. Altta sabit bir hızlı giriş düğmesi durur. Bağlam seçici TopBar'dadır; seçim cihazda saklanır ve gün değişince sorulur.

## Hızlı giriş

Tek kutu, iki kullanım:

1. **Yapılı:** Yazarken altta modül çipleri ve tür seçenekleri çıkar. `Tab` ile modül, ardından tarih ve süre seçilir. Tarihler doğal kısaltmalarla yazılabilir: `bugün`, `yarın`, `cuma`, `15.11`, `+3g` (gün), `+2h` (hafta). Süre de yazılabilir: `45dk`, `1s`, `1.5sa`, `1s30dk`. Bu sözcükler yalnızca satırın sonunda okunur; başlığın ortasındaki "cuma" başlıkta kalır. Haftanın günü, bir sonraki o gündür.
2. **Serbest:** Hiçbir şey seçmeden `Enter`: metin gelen kutusuna düşer.

Kutu tek satırla başlar ve yapıştırılan çok satırlı metinle büyür (`sherpa` bloğu satırlarını korur); `Enter` kaydeder, `Shift+Enter` satır ekler. Yapıştırılan yapılı bloğu tanıyan modül varsa giriş doğrudan ona işlenir.

Yapay zeka açıkken serbest metin gelen kutusunda beklemez: giriş hemen gelen kutusuna yazılır, birkaç saniye içinde yapay zeka onu modülü, süresi, önemi ve son tarihiyle bir işe (tek oturum) ya da iş kalemine (birden çok oturum) çevirir ve giriş gelen kutusundan çıkar. İş önce varsayılanlarla açılmaz, çünkü her iş bir modüle bağlıdır ve modülü yapay zeka seçer. Satırın sonuna yazılan gün ve süre kullanıcınındır; yapay zeka onları değiştirmez. Yapay zekanın koyduğu değerler küçük bir işaretle ayırt edilir; üzerine gelince gerekçesi görünür, tıklayınca değiştirilir. Emin olmadığı girişler gelen kutusunda onay kartı olarak kalır. Yapay zeka kapalıyken, yanıt vermezse ya da bütçe dolduysa giriş gelen kutusunda kalır ve kullanıcı yönlendirir.

Her modül hızlı girişe kendi türlerini ekler (sözleşmenin `intake` bölümü): Okul "sınav/teslim" ve "not", Beslenme "tartı" ve "alışveriş kalemi" gibi.

## Gelen kutusu

Yönlendirilmemiş girişlerin listesi. Her satırda: metin, önerilen modül (varsa), tek dokunuşla "işe çevir", "bloğa çevir", "sil". Yapay zeka açıksa öneriler dolu gelir; kapalıysa kullanıcı seçer.

## Hafta

- Üstte 7 günlük şerit: her gün için sabit bloklar ve kullanılabilir süre.
- Altında kapasite çubuğu: haftanın kullanılabilir süresi ile modüllerin istediği sürenin karşılaştırması, modül renkleriyle yığılmış. Talep kapasiteyi aşıyorsa hangi son tarihlerin tehlikede olduğu listelenir.
- Hayat modu seçimi burada yapılır (tarih aralığıyla).
- Önümüzdeki 4–6 haftanın yük görünümü: hafta başına son tarih sayısı ve ağırlığı.

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
