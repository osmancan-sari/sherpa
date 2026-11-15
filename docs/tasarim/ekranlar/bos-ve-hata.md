# Boş ve hata durumları

Kaynak: `docs/13-cam-dili.md` bölüm 4.10 (15 Kas 2026, onaylı); kurulduğu faz Ç4b. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Boş ve hata durumları ("10 · Boş ve hata durumları" sayfası; onaylandı, 15 Kas 2026)

Metinler koddaki gibidir; tek yeni metin bağlantı işaretidir.

- **Veri okunamadı:** ekranın ana paneli yerinde "Veri okunamadı. Bağlantı gelince kendiliğinden yenilenir." ve "Yeniden dene" (ikincil). Boş gün gösterilmez. Bugün, Gelen kutusu ve kapanışta aynı panel.
- **Bağlantı koptu:** üst satırın sağında küçük hap (simge ve "bağlantı yok"); son bilinen plan ekranda kalır. `docs/05`'te tanımlı, kodda yok; hapın metni yenidir.
- **Bildirimler** (altta ortada hap, 4 saniye): "Kaydedilemedi. Değişiklik geri alındı."; geri alınabilen işte "Geri al"; "Gün yeniden planlandı."
- **Yapay zeka bütçesi doldu:** Bugün'ün sonunda bilgi simgesiyle tek satır; uyarı rengi kullanılmaz.
- **Boş gün:** "Bugün için planlanan bir şey yok." ve "Başka bir şey yapıyorum"; liste, şerit ve uyarı yok.
- **Modüller boş:** "Henüz modül yok." ve yönetim bağlantısı.
- **Bulunamayan modül:** yoğun panelde tek cümle ("Bu modül arşivde.", "Bu modül etkin değil.", "Böyle bir modül yok.", "Bu modülde böyle bir sayfa yok.") ve bir bağlantı.
- **Hızlı giriş, etkin modül yokken:** kutunun altında "Etkin modül yok; giriş gelen kutusuna düşer. Modüller Ayarlar'dan açılır."; düğme "Gelen kutusuna ekle".

| Kare | İçerik |
| --- | --- |
| `XT1`, `XP1` | Bugün: veri okunamadı |
| `XT2` | Bağlantı koptu, son plan ekranda |
| `XT3` | Kayıt başarısız bildirimi |
| `XT4` | "Geri al"lı bildirim |
| `XT5` | "Gün yeniden planlandı." |
| `XT6` | Yapay zeka bütçesi doldu |
| `XT7` | Boş gün |
| `XT8` | Gelen kutusu okunamadı |
| `XT9` | Modüller boş |
| `XT10`–`XT13` | Bulunamayan modül ve sayfa halleri |
| `XT14` | Hızlı giriş, etkin modül yok |
| `XP2` | Pano: bağlantı koptu ve kayıt başarısız bildirimi |
| `XP3` | Pano: boş gün ve bütçe satırı |
| `XP4` | Pano: modül arşivde |

Öbür ekranların kendi boş halleri kendi gruplarında çizildi: Sıradakiler boş (`BT17`), Takvim'de iş yok (`TT7`), Gelen kutusu boş (`GT6`), kapanışın boş adımları (`KS6`–`KS9`), modülde iş ve geçmiş yok (`MT5`).

## Kurulum (Ç4b)

"bağlantı yok": `src/core/ui/look/Connection.tsx` (`useOnline`), sayfa başlığının ve Bugün'ün üst satırının sağında. Veri okunamadı: kit'in `ReadError`'u. Bütçe satırı bilgi simgesiyle, uyarı rengi yok. Bulunamayan modül: `src/core/ui/module/ModuleScreens.tsx` (`Message`). Bugün'ün boş hali ve bildirimlerin "Geri al"ı Ç4c'de (kit'in `Toast`'u eylemi taşır).
