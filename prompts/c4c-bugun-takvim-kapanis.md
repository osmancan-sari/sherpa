# Ç4c: Bugün, Takvim, kapanış ve alan sayfası

Claude Code'a yalnızca şunu yaz:

> `prompts/c4c-bugun-takvim-kapanis.md` dosyasını oku ve uygula.

Ön koşul: `c4b-tamam` etiketi.

---

## Görev

İçeriği değişen ekranları yeni tasarımıyla kur: Bugün, zaman çizelgesi ve Sıradakiler, Takvim, akşam kapanışının Rutin'in akşam sahnesine taşınması, alan sayfası. Planlayıcı ve veri Ç4a'da, cam temeli Ç4b'de kuruldu. Bu oturumda yalnızca Ç4c yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir. Faz adı Ç4c, etiket `c4c-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c4c/`.

## Kaynaklar

- `docs/tasarim/` (Ç4b'de kuruldu; `docs/13` oraya taşındı): **bağlayıcı tasarım.** Önce `README.md`; `ilkeler.md` (kararlar 6–8, gerçek cihazda bakılacaklar), `ekranlar/bugun.md` (Bugün'ün bütün durumları, zaman çizelgesi, Sıradakiler), `ekranlar/takvim.md`, `ekranlar/kapanis.md`, `ekranlar/moduller.md` (alan sayfası), `README.md` "Geçmiş" (içeriği değişenler). Kit'i (`src/core/ui/kit/`, galeri `/tasarim`) ve token'ları (`src/core/ui/tokens.css`) kullan; `CLAUDE.md` "Tasarım".
- `docs/tasarim/kareler/`: karelerin kaynak dosyaları; değerleri ve metinleri birebir al, çizilmeyeni en yakın kareden türet ve işaretle. Klasör yoksa dur ve sor.
- Ç4a'nın raporu ("Ç4b ve Ç4c için notlar"), `docs/04` (tahmin, "Bugün tamam"), `docs/moduller/rutin.md`.

## Kapsam

Tasarımın tek kaynağı Ç4b'de kuruldu (`docs/tasarim/`, `tokens.css`, kit ve galeri, `gorsel.spec.ts`; `CLAUDE.md` "Tasarım"). Bu fazın ekranları da aynı düzenle kurulur: `ekranlar/*.md` güncellenir, yeni parça önce kit'e ve galeriye girer, onaylı görüntüler eklenir.

1. **Bugün.** Üst satır yalnızca "Bugün" ve tarih (panoda saatle). Telefon ve pano yerleşimi; "Şimdi" kartının `docs/tasarim/ekranlar/bugun.md` tablosundaki bütün durumları (kartta en çok bir birincil düğme); uyarılar, modül hapları, alt satır, "Bugün bitenler". Akşam kartında "Günü kapat" yok.
2. **Günün akışı ve Sıradakiler** (4.2): saatli yatay şerit (telefonda dokununca balon, panoda adlar içinde), açılır liste ("Hepsini göster" / "Küçült"). Dar parçada dokunma alanı parçadan geniş tutulur.
3. **Takvim** (4.3): hafta seçici, dokunulabilir yedi gün, "Bu hafta" (teslim tarihine göre, yük çubuğu), gün ayrıntısı (geçmiş, bugün, gelecek; gelecek günde Ç4a'nın tahmini ve "Plan tahminidir; o sabah yeniden kurulur."), önümüzdeki haftalar, yapay zekanın notları, "Haftayı yeniden kur". Rota ve bağlantılar "Takvim" adına geçer; eski adres yönlendirilir.
4. **Kapanış** (4.6; ilerleme sohbetinin çekirdek kararı, 15 Kas 2026): kapanış çekirdeğin yeteneği olarak kalır ve bir sahnenin içinde açılır (`controls.closing()`, Ç3f). Ayrı sayfa ve Bugün'deki iki "Günü kapat" düğmesi kalkar; sahnede "Onayla ve yat" yok, "Vazgeç" kapanışı atlar. Çekirdek modüle bağımlı olmaz: modül kapanışı barındırdığını sözleşmeyle bildirir; etkin hiçbir modül barındırmıyorsa akşam kartında ikincil "Kapanış" düğmesi görünür ve kapanış standart sahne kabuğunda açılır (**görüşün gerek**). Akşam sahnesi hiç açılmazsa kapanış atlanmış olur: sabah plan kendiliğinden kurulur, cevaplanmamış sorular ertesi güne kalır.
5. **Rutin: "Yarının listesi" adımı** (`kind: closing`) akşamda Yüz ile Telefonu bırak arasında, **açık** gelir (kullanıcının kararı: kapanış akşam rutininin parçası); mevcut kullanıcıda da açılır, modül sayfasından kapatılabilir. `rutin.md`'de faz 2 ve 3. kurulum adımından buraya taşınır.
6. **Alan sayfası** (4.7): yalnızca kabuk: alanın adı ve üyeleri, her üye modülün paneli (durum metni, haftanın sayıları, modüle bağlantı), üyelerin verdiği görünümler için yer. Metrik tasarlanmaz (13 Kas kararı); modülün alan sayfasına görünüm vermesinin sözleşmesi kurulur, Rutin bir örnek verir (**görüşün gerek**).
7. **Ayarlar'da kalanlar:** Ç4a ve Ç4b'den sonra `docs/tasarim/ekranlar/ayarlar.md` ile ayrışan ne varsa.

## Kurallar

- Ç4b'nin kuralları aynen: karelerle ekran ekran karşılaştırma, karşıtlık, tercihler, `docs/05`'in güncellenmesi, `docs/tasarim/ilkeler.md` "Gerçek cihazda bakılacaklar" "Senden bekleyenler"e.
- **Klavye (pano):** Bugün'ün kısayolları yeni yerleşimde çalışır; kapanışta "Enter ile ilerle, Escape ile geri dön."
- **Denetçi:** Bugün, Takvim ve kapanış bitince ayrı ayrı adım kipinde; sonunda faz kipinde.

## Yayın ve sonunda

Önceki fazlardaki gibi (izin bu sohbette). Rapor; `rutin.md` ve `docs/07` güncel. "Sıradaki adım": Ç4d (teknik cila; `docs/07`) ya da Rutin 2, kullanıcının seçimi.
