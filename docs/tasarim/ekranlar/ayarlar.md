# Ayarlar

Kaynak: `docs/13-cam-dili.md` bölüm 4.8 (15 Kas 2026, onaylı); kurulduğu faz Ç4b. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Ayarlar ("8 · Ayarlar" sayfası; görünüş onaylandı, 15 Kas 2026)

Kullanıcının notu: ayar sayısı fazla geliyor; içerik sonra sadeleştirilecek (Fikirler). Şimdilik tasarım böyle kalır.

Sakin zemin, yoğun cam. Alanlar ve metinler koddaki gibidir (`src/app/(app)/ayarlar/`, `src/core/ui/settings/`); farklar aşağıda.

**Yerleşim (değişti).** Kodda tek uzun sayfa olan Ayarlar, telefonda bölüm listesine ve her bölümün kendi sayfasına ayrılır (başlıkta geri oku); panoda solda bölüm listesi (seçili bölüm opak açık), sağda seçili bölüm durur. "Dışa aktarım" ve "Hesap" kısa oldukları için listenin altında açık kalır. Bölümler: Görünüm, Günün çerçevesi, Uyanış ve yatış kayıtları, Sesli anlatım (bu cihaz), Modüller, Sabit bloklar, Yapay zeka, Bağlantılar. `/ayarlar#kayitlar` gibi bağlantılar ilgili bölümü açar.

**Kararlardan gelen içerik farkları.**

- **Görünüm:** tema seçimi yok (karar 1). İki anahtar: "Saydamlığı azalt" ("Paneller düz ve opak olur.") ve "Hareketi azalt" ("Geçişler anlık olur; gökyüzü kıpırdamaz."); altında "Cihazın kendi erişilebilirlik tercihi açıksa bunlar kendiliğinden açılır." Metinler yenidir.
- **Modül ayarları:** "Hayat modlarında" bölümü yok (karar: hayat modu kalktı).
- **Renkler:** "Bu renk açık ya da koyu temada zor seçilir." uyarısı tek temayla "koyu zeminde zor seçilir" anlamına iner; çizilmedi, metni kurulumda yazılır.
- Günün çerçevesindeki gün tipleri (Ev, Ofis, Kampüs günü) ve Bağlantılar'daki "Bağlam" ucu durur: bunlar elle bağlam seçimi değildir.

**Ortak kalıplar.** Anahtarlı satır (yazı solda, anahtar sağda, en az `spacing-row`). Saat aralığı iki küçük kutu ve aradaki çizgi; geçersizse kutular mercan kenarlı, altında tek cümle ve "Kaydet" soluk. Satır eylemleri sessiz yazı ("Düzenle", "Bitir", "İptal et", "Değiştir"); bölümün ana eylemi ikincil düğme, kaydetme birincil. Açıklamalar panelin başında, `text-note`.

| Bölüm | Çizimdeki hali |
| --- | --- |
| Günün çerçevesi | Açıklama; "Günün çerçevesi açık"; Uyanış, Yatış, Uyku hedefi (kurulumda kit'in sayacı: yarım saatlik adımlarla 4–12 saat, "8 saat"; karede kutu; kullanıcının kararı, 15 Kas 2026); açılır "Gün tipine göre (isteğe bağlı)"; iki kendiliğinden başlatma anahtarı; "Kaydet". |
| Uyanış ve yatış kayıtları | Bugün ve dün; her kayıt: ad, saat kutusu, "Kaydet", silme (telefonda "Sil", panoda "Uyanışı sil" / "Yatışı sil"); kayıt yoksa "kayıt yok". |
| Sesli anlatım | Açıklama; "Sesli anlatım açık"; Ses; Hız (kaydırıcı); "Bu cihaz dokunuş olmadan da konuşsun (ikinci ekran için)"; "Dene". Türkçe ses yoksa dikkat renginde durum satırı. |
| Modüller | Her modül: renk noktası, ad, durum; eylemler (etkin: "Ayarlar", "Duraklat", "Arşivle"; duraklatılmış: "Sürdür", "Arşivle"; kapalı: "Etkinleştir"). Arşivleme onayı satırın altında açılır: açıklama, "Arşivle" (tehlikeli), "Vazgeç". |
| Modül ayarları | "Renkler": modül ve bölümleri; "Değiştir" ile on hazır renk (`spacing-touch` daire, seçili beyaz halkalı), "Özel" renk, kod, "Kaydet", "Varsayılana dön". "Modülün ayarları" modülündür (yer tutucu). |
| Sabit bloklar | "Haftalık seriler" (ad; gün, saat, tür, yer; "Düzenle", "Bitir"), "Yeni seri", "Tek seferlik blok", "Önümüzdeki 4 hafta" (iptal edilen üstü çizili ve soluk, "Geri al"). Panoda iki sütun. |
| Yapay zeka | Durum cümlesi; "Yapay zeka açık"; "Aylık sınır ($; 0 kapatır)" ve "Kaydet"; "Bu ay: … / …" ve ince çubuk (yeni, aynı verinin çizimi); çağrı tablosu. Bütçe dolunca durum ve çubuk dikkat renginde. |
| Bağlantılar | Açıklama; anahtar listesi (ad, ipucu, uçlar, son kullanım; "İptal et"; iptal edilen soluk); yeni anahtar formu (Ad, "Yazabileceği uçlar" onay kutuları, "Anahtar üret"). Üretilince kutu: "Anahtar hazır. Bir daha gösterilmez; şimdi kopyala.", anahtar, "Kopyala" (birincil). |

| Kare | İçerik |
| --- | --- |
| `AT01` | Telefon, Ayarlar: bölümler, dışa aktarım, hesap |
| `AT02` | Görünüm |
| `AT03`–`AT05` | Günün çerçevesi: olağan, gün tipine göre açık, geçersiz aralık |
| `AT06` | Uyanış ve yatış kayıtları |
| `AT07`, `AT08` | Sesli anlatım; cihazda Türkçe ses yok |
| `AT09`, `AT10` | Modüller; arşivleme onayı |
| `AT11` | Okul ayarları: renkler |
| `AT12`, `AT13` | Sabit bloklar (iki kare) |
| `AT14`, `AT15` | Yapay zeka; bütçe doldu |
| `AT16`, `AT17` | Bağlantılar; anahtar üretildi |
| `AP1`–`AP9` | Pano: Görünüm, Günün çerçevesi, Kayıtlar, Sesli anlatım, Modüller (arşiv onayı), Okul ayarları, Sabit bloklar, Yapay zeka, Bağlantılar |

Çizilmeyenler: seri ve blok düzenleme pencereleri (5. gruptaki kabuk; alanları "Yeni seri" ve "Tek seferlik blok" ile aynı); yapay zekanın öbür durum cümleleri (anahtar yok, model yok, kapalı; aynı satırda); anahtar iptal onayı ("İptal et", "Vazgeç"; arşiv onayıyla aynı kalıp); panoda gün tipine göre açık hal. Hesap satırındaki e-posta örnektir.

## Kurulum (Ç4b)

`src/app/(app)/ayarlar/layout.tsx` ve `src/core/ui/settings/SettingsShell.tsx`: bölümler adresle açılır (`/ayarlar/gorunum`, `cerceve`, `kayitlar`, `ses`, `moduller`, `bloklar`, `yapay-zeka`, `baglantilar`); eski `/ayarlar#<bölüm>` bağlantıları bölüm sayfasına yönlenir. Panoda `/ayarlar` Görünüm'ü açık gösterir. Açık/kapalı satırları kit'in `SwitchRow`'u. Yeni metinler: Görünüm'ün iki anahtarı ve açıklamaları; "Bu renk koyu zeminde zor seçilir."

## Ç4c'de kalanlar (16 Kas 2026)

- **Günün çerçevesi** karedeki satır düzeninde (`AP2`, `AT03`): ad solda, saat kutuları (`h-12`, iki kutu ve arada çizgi) ve uyku hedefinin sayacı sağda; bölümler arasında ince çizgi; "Gün tipine göre (isteğe bağlı)" oklu açılır başlık, içinde gün tipi başına uyanış ve yatış satırı; geçersiz aralıkta o satırın kutuları mercan kenarlı ve altında simgeli tek cümle (`AT05`); "Kaydet" birincil (değişiklik yokken soluk).
- **Yapay zeka:** "Bu ay: 1,84 $ / 5,00 $" altında ince çubuk (`AT14`); bütçe dolunca satır ve çubuk dikkat renginde (`AT15`). "Kaydet" ikincil.
- Kalan küçük farklar: kayıtlarda gün başlığı uzun tarih ("Cumartesi 14 Kasım"; karede "Cum 13 Kas") ve günler arasında çizgi yok; Hesap satırında e-posta ile "Çıkış yap" genişlik yettiğinde aynı satırda (karede alt alta).
