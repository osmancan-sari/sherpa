# Okul: Bugün kartı, sahneler ve blok görünümü

Kaynak: Okul tuvali; kareler `../kareler/okul/` (dizin: `../kareler/okul/DIZIN.md`), onaylı 16–17 Kas 2026. Kurallar `docs/moduller/okul.md` bölüm 5 ve 8.1–8.3'tedir; bu dosya düzeni ve durumları anlatır, kuralı tekrar etmez. Sahnenin kabuğu ve ortak düzeni çekirdeğindir (`sahne.md`); buradaki yerleşimler çekirdek kararı 10 ile kit parçası olur (`docs/moduller/okul-cekirdek-notlari.md`).

Kare adlarında `T` telefon (390×844), `P` pano (1440×900). Değerler karelerde satır içidir; kurulurken `tokens.css`'ten alınır.

## Bugün'de Okul

Çekirdeğin Bugün ekranı (`bugun.md`); Okul yalnızca kartın içeriğini verir.

- **Kart:** modül ve ders ("Okul · Robotics"), başlık ("Quiz 3 hazırlığı"), tek satır: ne yapılacak ve süre ("Jacobian, hız kinematiği · 2 sa"), "Başla" ve "Neden?". Oturum sırası, sınav tarihi, ağırlık, ilerleme ve doküman bağlantısı kartta yoktur.
- **Sıradakiler:** satırda oturum sırası yazmaz. Bekleyen satırda düğme yoktur.
- **Günün akışı:** oturumun parçası süresi kadar yer tutar (2 saatlik oturum tek parça).
- Kareler: `K1T1`, `K1P1` (quiz), `K2T1`, `K2P1` (midterm), `K3T1`, `K3P1` (ödev), `K4T1`, `K4P1` (proje); oturumdan dönüş `K1T8`, `K2T7`, `K3T7`, `K4T7` ve pano karşılıkları. Hepsi `ZT1` ve `ZP1`'den türetildi.

## Sahnenin düzeni

**Telefon**, yukarıdan aşağı: şerit · başlık ve alt başlık · ortadaki sayaç · sayacın altındaki tek satır (tur noktaları ya da soru noktaları) · varsa "Kaldığın yer" · "Bu oturumda" kutusu · alt düğmeler (ana, ikincil) ve altında sessiz "Oturumu bitir".

**Pano**, iki sütun: solda başlık, sayaç, tek satır ve düğmeler; sağda sırayla "Kaldığın yer", "Bu oturumda", "Dosyalar" ve ilerleme kutusu. Yan menüde Bugün seçili kalır.

| Parça | Ne gösterir |
| --- | --- |
| Şerit | saat · ders rengi nokta · işin adı · **geçen / ayrılan** ("26 dk / 2 sa") · "Çık" |
| Başlık | o anki bölümün adı (hazırlıkta) ya da işin adı (ödev, proje) |
| Alt başlık | ders · sınavın günü ve saati ya da teslim saati |
| "Bu oturumda" | oturumun bölümleri sırayla; her satırda numara, ad, sağda ölçü ("2 tur", "4 soru"); o anki satır vurgulu ve sağında "Aç" |
| "Dosyalar" (pano) | işin dosyaları, her birinde "Aç" |
| İlerleme (pano) | "Bu quizin hazırlığı 2 sa / 8 sa" ve "Oturum 2 / 4 · bugün 2 sa planlı" |
| Zemin | koyu lacivert-petrol, üstte dersin renginde ışıma; molada kum tonuna döner |

Ödev ve projede "Bu oturumda" kutusu yoktur (adım yok): telefonda yerine ödev metni ve ilerleme satırı gelir (`K3T2`); aynı oturuma iki alt iş düşerse ikisi listelenir (`SahneAkisProje`).

## Yerleşimler

| Yerleşim | Ortadaki | Altındaki tek satır | Düğmeler | Kareler | Çekirdek paketi |
| --- | --- | --- | --- | --- | --- |
| Pomodoro | Halka; içinde etiket (ODAK), geçen süre, turun toplamı ("25 dk") | tur noktaları ve "tur 1 / 3 · sonra 5 dk mola" | Duraklat · Turu atla | `K1T2`, `K1T4`, `K4T2`, `K4T4` (+`P`) | A |
| Pomodoro, mola | Aynı halka kum renginde; KISA MOLA, geçen süre, "5 dk" | "1 / 3 tur bitti" | Molayı bitir · +5 dk; telefonda "Moladan sonra" kutusu | `K1T3`, `K4T3` (+`P`); bölüm arası mola `K2T4` | A |
| Akış | Halkasız: AKIŞ, ileri sayan saat, "mola vermeden"; altında planlanan süreye uzanan çubuk | — | Mola ver · Bitir | `K3T2`, `K3T3`, `SahneAkisProje` (+`K3P2`, `K3P3`) | A |
| Akış, mola | MOLA, ileri sayan saat, "çalışılan 51 dk · mola süreye sayılmaz" | — | Devam et · Bitir | `K3T4`, `K3P4` | A |
| Kontrol listesi | Sayaç yok; işaretlenen adımlar, o anki adımda kendi düğmesi | — | adımın düğmesi | `K4T6`, `K4P6`, `SahneDokuman`, `PanoDokuman`, `SahneToplanti` | A |
| Soru sayacı | "3 / 6" ve sorunun süresi | soru noktaları; açıklama satırı ilk "Takıldım"dan sonra | Çözdüm · Takıldım | `K1T6`, `K2T2`, `K2T3`, `SahneProva` (+`P`) | C |
| Tek blok | Tek geri sayım; mola yok | — | Duraklat | `SahneTekrar` | C |

Karışık oturumda yerleşim bölümden bölüme değişir; şerit, başlık ve "Bu oturumda" yerinde kalır (`K1T2` → `K1T6`, `K2T2` → `K2T5`).

## Durumlar

- **Süre doldu:** sayacın yerinde kart: "Süre doldu.", tek cümle açıklama, "Bitti" ve "+5 dk"; işin son oturumunda üçüncü seçenek "Bugünlük yeter" (telefonda sessiz yazı, panoda üçüncü düğme). Alt düğmeler görünmez. `K1T5`, `K3T5`, `K4T5` (+`P`).
- **Oturum bitti:** ekranın ortasında tek yazı, "Oturum bitti."; başka hiçbir şey yok. `K1T7`, `K2T6` (+`P`).
- **Çıkarken not** (ödev, proje): telefonda alttan açılan sayfa, panoda sayacın yerinde kart: "Nerede kaldın?", tek satırlık alan, "Kaydet ve çık" ve sessiz "Yazmadan çık". `K3T6`, `K3P6`.
- **Kaldığın yer** (oturum başından itibaren durur): hazırlıkta son bitirilen bölüm ve sayfası, sağında "Aç"; ödev ve projede yazılan cümle. Telefonda sayacın altında tek satırlık dar kutu (küçük etiket, altında metin); panoda sağ sütunun başında kutu (başlık, alt satır). `SahneKaldiginYerHazirlik`, `PanoKaldiginYerHazirlik`, `SahneKaldiginYerOdev`, `PanoKaldiginYerOdev`.
- **Takılınan soru:** noktası boş halka olur ve açıklama satırı çıkar ("çözüldü", "takıldın, sona kalır"). `K2T3`.

## Blok görünümü (ders, sınav günü)

Sahne değildir: oturum açmaz, süre saymaz. Bloğun kartına dokununca açılır (`ui.blockView`).

- **Şerit:** saat · ders · durum ("derste", "ders bitti", "bugün 09:30") · "Çık". Sayaç yok.
- **Derste** (`SahneDers`): dersin saati ve "Bitişe 1 sa 32 dk" çizgisi; "Bu hafta" (haftanın slaytı, "Aç"); "Derste söylenen" (yazılan cümleler, her birinde "Tarihe çevir"); altta "Not al", "Sınav ya da teslim ekle", sessiz "Derste değilim".
- **Ders bitti** (`PanoDersSahne`): "Derse girdin mi?" ve üç düğme (Girdim, Girmedim, Yapılmadı); derste yazılanlar, haftanın dosyası, sıradaki iş. Soru yalnızca devam şartı olan derste çıkar.
- **Sınav günü** (`SahneSinav`): "Sınava 1 sa 40 dk"; saat, süre, derslik (kaynağıyla); "Yanına al" listesi (duyurudan); kapsam; "Son tekrarı başlat" ve "Konu anlatımını aç".

## Çizilmeyenler

Onaylı karesi olmayanlar en yakın kareden türetilir ve "görüşün gerek" diye işaretlenir.

- Pano karşılığı çizilmeyenler: sunum provası, tek blok tekrar, takım toplantısı, derste (ders sürerken), sınav günü, iki alt işli akış.
- Telefonda "ders bitti" ve devam sorusu (yalnızca panoda çizildi).
- "Kaldığın yer"de yarıda bırakılan bölüm.
- Duraklatılmış sayaç; bağlantısız ve hata halleri (çekirdeğin `bos-ve-hata.md` kuralları geçerli).
- Web push çalışmazsa bildirimin yedeği: Bugün'ün üstünde tek satır (çekirdeğin karesi).
