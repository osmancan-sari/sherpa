# Hızlı giriş ve düzenleme

Kaynak: `docs/13-cam-dili.md` bölüm 4.5 (15 Kas 2026, onaylı); kurulduğu faz Ç4b. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Hızlı giriş ve düzenleme ("5 · Giriş ve düzenleme" sayfası; onaylandı, 15 Kas 2026)

Alanlar ve metinler koddaki gibidir (`src/core/ui/QuickAdd.tsx`, `EditDialog.tsx`, `work/EditWork.tsx`, `work/TimingSection.tsx`). Değişen kabuktur: kodda ortadaki pencere olan form, telefonda **alttan açılan sayfa**, panoda **sağdan `spacing-sheet` genişliğinde yan panel** olur (`parcalar.md`, `Sheet`). Arkası `color-scrim` ile kararır.

**Kabuk.** Telefonda tutamaç, başlık ve sağda kapat düğmesi; içerik kayar; alt satır sabittir (çizgiyle ayrılır). Alt satırda solda varsa ek eylem ("Bırak", "Durdur"; ikincil), sağda "Vazgeç" (ikincil) ve "Kaydet" (birincil). Geçersiz formda "Kaydet" soluktur. Telefonda alt satıra sığmayan ek eylem ("Adımlara böl") formun sonuna iner.

**Hızlı giriş ("Yeni giriş").** Tek satırlık giriş kutusu odakta açılır (yer tutucu "Sunum slaytları cuma 45dk"); altında modül hapları. Modül seçilince tür hapları ("İş" ve modülün kendi türleri), "Tarih" ve "Süre (dk)" çıkar; düğme modül yokken "Gelen kutusuna ekle", varken "Ekle". Süre 90 dakikayı aşınca kutu: açıklama, "İş kalemi olarak kaydet" (birincil) ve "Süreyi 90 dk yap". Panoda alanların altında kısayol satırı. "Tarih" kit'in tarih alanıdır (`DateInput`): tarih her tarayıcıda Türkçe yazılır ("20.11.2026", karedeki gibi); düzenlerken tarayıcının kendi yazısı görünür.

**Düzenleme.** "İşi düzenle": Ad, Bölüm (modülün bölümü varsa), Son tarih ve Süre yan yana, Önem ve Durum yan yana, "Neyi bekliyor (isteğe bağlı)", Zaman. "İş kalemini düzenle": Ad, Bölüm, Son tarih, Toplam efor ve Oturum, Önem, Zaman, "Adımlara böl". "Ritmi düzenle": Ad; Hedef, Dönem ve Süre tek satırda; Zaman (dinlenme ile); "Durdur".

**Zaman bölümü.** Kapalıyken tek satır: ok, "Zaman" ve varsa özeti. Açıkken: kaynağı söyleyen tek cümle; "Yalnızca şu saatlerde", "Tercih edilen saatler", "Kaçınılan saatler" (her aralık: gün seçimi, başlangıç, bitiş, kaldır; altında "+ aralık ekle"); "Yol" (gidiş, dönüş); ritimde "Dinlenme". Geçersiz aralıkta iki saat kutusu mercan kenar alır, altında simgeyle tek cümle. "Bitiş çizgisinden sonra" uyarısı çizilmedi (karar: saatle belirlenen bitiş kalktı).

**Yapay zekanın koyduğu değer.** Alanın kenarı kesiklidir; altında simgeyle gerekçesi yazar. Kullanıcı alanı değiştirince kenar düz olur ve gerekçe kalkar.

| Kare | İçerik |
| --- | --- |
| `QT1` | Telefon, hızlı giriş açılınca |
| `QT2` | Telefon, yazarken: modül, tür, tarih, süre |
| `QT3` | Telefon, süre 90 dakikadan uzun |
| `ET1` | Telefon, "İşi düzenle", Zaman kapalı |
| `ET2` | Telefon, Zaman açık |
| `ET3` | Telefon, geçersiz aralık |
| `ET4` | Telefon, yapay zekanın koyduğu değerler |
| `ET5` | Telefon, "İş kalemini düzenle" |
| `ET6` | Telefon, "Ritmi düzenle" |
| `QP1` | Pano, hızlı giriş |
| `QP2` | Pano, hızlı giriş, süre 90 dakikadan uzun |
| `EP1` | Pano, "İşi düzenle", Zaman açık |
| `EP2` | Pano, yapay zekanın koyduğu değerler |

Bu grupta çizilmeyenler: modülün kendi giriş türlerinin alanları ("Sınav/teslim", "Not"; modül tasarımında çizilir); "Yeni ritim" (alanları "Ritmi düzenle" ile aynı, düğmesi "Ekle"); etkin modül yokken hızlı giriş (10. grup); panoda iş kalemi ve ritim formları (kabuk ve alanlar `EP1` ile aynı kuralda).

## Kurulum (Ç4b)

Kabuk kit'in `Sheet`'i (`src/core/ui/kit/Overlay.tsx`; `src/core/ui/Dialog.tsx` onu sarar). `EditDialog` alanları tam genişlik; eşli alanlar `width: "half"`, ritmin üçlüsü `"third"`. Hızlı giriş: `src/core/ui/QuickAdd.tsx` (alt satırda yalnızca birincil düğme; 90 dakikayı aşınca kutu alt satırın yerini alır). Yapay zekanın koyduğu değer: `Input ai` / `Select ai` ve `AiReason`.
