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
| `/m/[slug]` | Modül sayfası |
| `/a/[slug]` | Alan sayfası |
| `/gelen` | Gelen kutusu |
| `/kapanis` | Akşam kapanışı |
| `/ayarlar` | Ayarlar, modüller, sabit bloklar, dışa aktarım |

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

1. **Yapılı:** Yazarken altta modül çipleri ve tür seçenekleri çıkar. `Tab` ile modül, ardından tarih ve süre seçilir. Tarihler doğal kısaltmalarla yazılabilir: `yarın`, `cuma`, `15.11`, `+3g`.
2. **Serbest:** Hiçbir şey seçmeden `Enter`: metin gelen kutusuna düşer.

Yapay zeka açıkken serbest metin gelen kutusunda beklemez: iş hemen varsayılanlarla görünür, birkaç saniye içinde modül, süre ve önem yerinde dolar. Yapay zekanın koyduğu değerler küçük bir işaretle ayırt edilir; üzerine gelince gerekçesi görünür, tıklayınca değiştirilir. Emin olmadığı girişler gelen kutusuna onay kartı olarak düşer.

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

Alan sayfası (`/a/[slug]`) aynı iskeleti kullanır ve üye modüllerin durum şeritlerini ve seçilmiş görünümlerini birleştirir.

## Akşam kapanışı

`/kapanis`, 4 adımlı tek akış; her adım tek ekran, klavyeyle geçilir. İçerik `docs/04-planlayici.md` içinde. İstenirse hiç yapılmaz.

## Boş ve hata durumları

- Hiç iş yoksa: "Bugün için planlanan bir şey yok" ve hızlı giriş.
- Bağlantı koptuysa: TopBar'da küçük bir işaret; son bilinen plan ekranda kalır.
- Oturum düştüyse: sessizce giriş sayfası.
