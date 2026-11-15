# Akşam kapanışı

Kaynak: `docs/13-cam-dili.md` bölüm 4.6 (15 Kas 2026, onaylı); kurulduğu faz Ç4c. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Akşam kapanışı ("6 · Akşam kapanışı" sayfası; görünüş onaylandı, 15 Kas 2026)

**Karar (kullanıcı, 15 Kas 2026): kapanış Rutin'in akşam sahnesinin içindedir.** Ayrı sayfa olarak çizilmez; ayrı sayfa kareleri tuvalden kaldırıldı. Bugün'deki iki "Günü kapat" düğmesi (alt satır ve akşam kartı) da kalktı: akşam kartındaki "Başla" akşam sahnesini açar, kapanış onun bir adımıdır (Yüz ile Telefonu bırak arasında; `docs/moduller/rutin.md`, "Yarının listesi").

Adımlar ve metinler koddaki gibidir (`src/core/ui/closing/ClosingScreen.tsx`, sahne içi hali). İçerik farkları "günün 3 işi" kararından gelir: yarının taslağında işaret kutusu ve "Günün üç işi işaretli…" cümlesi yoktur, alt başlık "İstemediğini çıkar."dır; "vakit kalırsa" etiketi yoktur; onay adımı yarının ilk işlerini sırayla gösterir.

- **Zemin ve şerit:** akşam sahnesinin gece gökyüzü ve şeridi ("22:24 · Akşam kapanışı · 4 dk", sağda "Çık"); Rutin tuvalindeki sahneyle aynı.
- **Başlık ve adımlar:** "Kapanış"; altında beş ince çizgi ve adlarıyla adımlar ("1. Sorular" … "5. Onay"). Gelinen adımlar açık, şimdiki adımın adı kalın.
- **Adım paneli:** yoğun cam, telefonda ve panoda en az yarım ekran.
  1. Sorular: "Modül · soru" ve cevap düğmeleri (ikincil). Boşken "Cevap bekleyen soru yok."
  2. Bugün: "Bugün başka ne yaptın?"; satırlar "Modül · iş" ve "Yaptım". Boşken "Bugün için açık kalan bir şey yok."
  3. Yarın: "Yarının taslağı"; satırda renk noktası, ad, "Modül · süre", varsa yapay zekanın gerekçesi, sağda "Çıkar" (sessiz). Boşken "Yarın için planlanan bir şey yok."
  4. Boşalt: "Aklında kalanlar"; çok satırlı kutu.
  5. Onay: "Yarın" ve liste. Boşken "Yarın için seçilen iş yok; yarın sabah plan kendiliğinden kurulur."
- **Düğmeler** panelin altında: "Geri" (ikincil), "İleri" (birincil), son adımda "Onayla" (birincil); her adımda "Vazgeç" (sessiz; kapanışı atlar, sahne sürer). "Onayla ve yat" yoktur: sahnenin sonunda "Yatıyorum" vardır. Panoda altında "Enter ile ilerle, Escape ile geri dön."
- "Onayla"dan sonra sahne sıradaki adıma ("Telefonu bırak") geçer; sahne bitince Bugün'ün gece durumu gelir (`BT26`, `BP24`).

| Kare | İçerik |
| --- | --- |
| `KS1`–`KS5` | Telefon, beş adım |
| `KS6`–`KS9` | Telefon, boş haller: soru yok, açık kalan yok, yarın için plan yok, onayda yarın boş |
| `KSP1`–`KSP5` | Pano, beş adım (sahne sayfanın içinde, yan menüyle) |

Çizilmeyen: panoda boş haller (panelin içi telefondakiyle aynı metinler).

**Açık (çekirdek ve Rutin):** Rutin kapalıyken ya da akşam sahnesi hiç açılmadan kapanışa nasıl ulaşılacağı; kapanış adımı Rutin'de 2. kurulum adımına yazılı (`kind: closing`), bu kararla öne gelmesi gerekebilir.
