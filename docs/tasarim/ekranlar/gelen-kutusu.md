# Gelen kutusu

Kaynak: `docs/13-cam-dili.md` bölüm 4.4 (15 Kas 2026, onaylı); kurulduğu faz Ç4b. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Gelen kutusu ("4 · Gelen kutusu" sayfası; onaylandı, 15 Kas 2026)

Sakin zemin. İçerik ve metinler koddaki gibidir (`src/core/ui/inbox/InboxScreen.tsx`); yalnızca görünüş değişti. Örnek girişler uydurmadır.

- **Giriş kartı:** yoğun panel; üstte girişin metni (telefonda `text-base`, panoda `text-lg`). Altında eylemler: "İşe çevir" ve "Bloğa çevir" ikincil düğme, "Sil" sessiz yazı.
- **Yapay zekanın önerisi:** kartın içinde kesik kenarlı kutu (kesik kenar: yapay zekanın koyduğu değer). Simgeyle "Öneri: iş kalemi · 2 sa · Pazar · yüksek önem", altında gerekçe; modül hapları (önerilen seçili, opak açık); "Onayla" birincil düğme. Listede birincil düğme kart başına en çok birdir.
- **"İşe çevir":** eylemlerin yerinde form açılır: modül hapları, "Tarih", "Süre (dk)", "Kaydet" (birincil) ve "Vazgeç". Süre 90 dakikayı aşınca düğme "İş kalemi olarak kaydet" olur ve altında açıklaması çıkar.
- **"Bloğa çevir":** "Gün", "Başlangıç", "Bitiş", "Kaydet", "Vazgeç".
- **Sonuç:** kart listeden hemen gider; bildirim "İş eklendi." ya da "İş kalemi eklendi."
- **Boş:** "Gelen kutusu boş."
- **Pano:** kartlar tek sütunda, en çok `spacing-read` genişlikte; başlığın sağında "+ Yeni giriş".

| Kare | İçerik |
| --- | --- |
| `GT1` | Telefon, liste: önerili giriş ve iki düz giriş |
| `GT2` | Telefon, "İşe çevir" açık |
| `GT3` | Telefon, süre 90 dakikadan uzun |
| `GT4` | Telefon, "Bloğa çevir" açık |
| `GT5` | Telefon, "Onayla"dan sonra bildirim |
| `GT6` | Telefon, boş |
| `GP1` | Pano, liste |
| `GP2` | Pano, "İşe çevir" açık, süre 90 dakikadan uzun |
| `GP3` | Pano, "Bloğa çevir" açık ve bildirim |
| `GP4` | Pano, boş |

Bu grupta çizilmeyenler: hiç modül yokken çıkan "İşin bir modülü olmalı. Modüller Ayarlar'dan açılır." satırı ve liste okunamadığındaki hata (10. grup).

## Kurulum (Ç4b)

`src/core/ui/inbox/InboxScreen.tsx`: kartlar `glass-dense`, öneri kutusu kesik kenarlı (`color-edge-suggestion`), haplar `Chip`, formlar yerinde (`Field`, `Input`); panoda tek sütun (`spacing-read`) ve başlığın sağında "+ Yeni giriş". Boşken düz cümle.
