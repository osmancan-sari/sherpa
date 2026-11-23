# Okul: modül sayfaları

Kaynak: Okul tuvali; kareler `../kareler/okul/` (dizin: `../kareler/okul/DIZIN.md`), onaylı 16–17 Kas 2026. Kurallar `docs/moduller/okul.md` bölüm 5 ve 8.4–8.7'dedir. Modül sayfasının iskeleti çekirdeğindir (`moduller.md`); Okul'un ondan ayrıldığı yerler çekirdek kararı 4 ve 5 ile açılır: ilk giriş bölüm olmayan "Ana sayfa"dır, "Yaklaşanlar" ve "Geçmiş" kapalıdır, sayfa başında durum cümlesi ve etiket yoktur.

Zemin sahneyle aynıdır: koyu lacivert-petrol, üstte hafif ışıma. Her derste dersin rengi nokta olarak kullanılır.

## Sayfa başı ve gezinme

- **Başlık:** "Okul". Sağında, yalnızca ders sayfasında, "Sınav ya da teslim ekle".
- **Telefon:** başlığın altında iki giriş: "Ana sayfa" ve açılır ders seçici ("Ders seç" ya da seçili dersin adı). Seçici açılınca altı ders renk noktasıyla listelenir (`DersSecici`).
- **Pano:** sekmeler: "Ana sayfa" ve altı ders (`PanoAna`, `PanoDers`).
- Ders sayfasında dersin adı, kodu ve saati; altında üç alt giriş: Sorumluluklar, Dosyalar, Devam.

## Ana sayfa (`AnaSayfa`, `PanoAna`)

- **Değişiklik satırı:** "4 değişiklik · Ninova 13:05 · Kepler 12:40" ve "Gör". Son okumadan beri değişenler ve kaynakların son okuma saati.
- **Dönemin işleri:** bütün derslerin işleri tarih sırasıyla, hafta başlıkları altında. Hafta başlığında aralık, iş sayısı ve haftanın ağırlığı ("%40 + tahmini %5"). Geçmiş haftalar "Geçenler" satırında katlanır.
- **İş satırı:** solda gün ve ay; ad; varsa "tahmini" ya da "duyurudan" işareti; ders, tür ve ağırlık; hazırlık ya da çalışma ilerlemesi ("hazırlık 4 sa / 8 sa"); sınavda dokümanların durumu ("dokümanlar hazır", "dokümanlar: 1 Ara"). Günü belli olmayan tahmini iş gün yerine "≈ hafta içi" ile haftasında durur.
- Listenin sonunda tarihi tahmin edilemeyen işler: gün yerine "– tarih yok".
- **Haftanın ağırlığı:** hafta başına not yüzdesi çubukları; kesin ve tahmini ayrı tonda, en ağır haftalar "yoğun" işaretli; final dönemi ayrı.
- **Dersler:** ders başına kazanılan / açıklanan puan ve sıradaki iş.
- **Pano:** üstte dört özet kutusu (önümüzdeki 7 gün, kalan iş, tahmini tarihli, tahmin edilemeyen); liste tablo olarak (tarih, ders, iş, ağırlık, hazırlık), tahmini satırda tahminin dayanağı da yazar; haftanın ağırlığı ve dersler aynı sayfada.

## Ders sayfası (`Ders`, `PanoDers`)

Yukarıdan aşağı:

1. **Özet satırı:** anlık toplam ("7,4 / 9,7"), kalan devamsızlık, sıradaki ("Midterm · 9 gün"); altında "Açıklanan %9,7 · kalan %90,3" ve kaynağın notu.
2. **Tüm işler:** "Sırada" ve "Bitenler". Sıradaki satır ana sayfadaki gibidir; proje alt işleri projenin altında girintili durur, yapay zekanın önerdiği alt iş "öneri" işaretli ve sahibiyle ("sen", "2. kişi"). Biten satırda tarih, ağırlık, not ve puana katkısı, kaynağı.
3. **VF şartları:** başlıkta özet ("1 sağlandı · 2 yolunda · 2 bekliyor"); her şartta metin, dayanağı ve durumu.
4. **Notlandırma:** kalemler ve ağırlıkları, toplam; altında hocanın notu.
5. **Tahmin kuralları:** kullanıcının yazdığı kural ("sen yazdın · bir kez tuttu"); Sherpa'nın önerisi kendi kutusunda, dayanağı ve "Kural olsun" ile "Hayır"; altta "Kural yaz · tek cümle".

## Devam (`Devam`)

- Üstte üç sayı: Sen ("7 / 7"), Kepler ("5 / 6"), kalan devamsızlık; altında şartın cümlesi ve hesabın neye göre yapıldığı.
- Ders listesi, yeniden eskiye: tarih, konu, "sen: girdim · Kepler: var" ve durum (onaylı, bekleniyor, ayrışıyor). Ayrışan satırda iki düğme: "Kepler doğru" ve "Hocaya soracağım".
- Başta sıradaki dersin günü ve ara tatil notu.

## Dosyalar (`Dosyalar`) ve dosya ayrıntısı (`DosyaAyrinti`)

- Başta bilgisayardaki yol ve son eşitleme saati.
- Dersin klasörleri açılır satırlar olarak; sağında dosya sayısı ve yeni dosya sayısı. Dosya satırında ad, boyut ve tarih; "yeni" ve "emin değil" işaretleri. Sonda açıklama: "telefonda açılır", "yalnız bilgisayarda".
- **Dosyaya dokununca** alttan sayfa: klasör seçenekleri (başka klasöre dokununca oraya taşınır ve bir daha değişmez), emin olunmama gerekçesi, Ninova'daki yeri, etiketi (tür ve hafta), boyutu, yüklenme tarihi; "Ninova'da gör", "Vazgeç", "Aç".

## İş ayrıntısı (`SorumlulukAyrinti`)

Bir sınava ya da teslime dokununca alttan sayfa: tarih ve saat (değiştirilebilir; kaynağı altında, duyurudan geldiyse duyurunun cümlesi alıntı olarak); kapsam ve dayandığı kural; planlanan hazırlık (dokümanların günü, yaklaşık çalışma süresi); "Quizi kaldır", "Vazgeç", "Kaydet".

## Sınav ayrıntısı (`SinavAyrinti`, `PanoSinavAyrinti`)

- **Başlık kutusu:** sınavın adı, ders, günü ve saati, ağırlığı; ilerleme çubuğu ve "Hazırlık 10 sa / 16 sa · 8 oturumun 5'i bitti".
- **Kapsam:** kaynağı sağda ("kuraldan", "duyurudan"); bölümler ve tek cümle gerekçe.
- **Dokümanlar:** konu anlatımı ve örnek sorular (bölüm ya da soru sayısı, süresi, üretim ve güncelleme günü; "Aç"); tekrar satırı; `eski`; altta sessiz "Yeniden ürettir".
- **Oturumlar:** numara, içerik, bölümler ve süreleri, toplam süre, ne zaman. Biten oturum soluk ve işaretli; sıradaki oturumda "Başla". **Planlanan oturumda gün yazar, sonrakilerde hafta** ("bu hafta", "30 Kas haftası"). Altında açıklama cümlesi.
- Panoda oturumlar solda tablo ("NE ZAMAN" sütunu ve altında durum: bitti, sırada, bekliyor), sağ sütunda başlık, kapsam ve dokümanlar.

## Bildirimler (`Bildirimler`)

Telefona giden beş bildirimin örnek metinleri ve bildirim gitmeyen üç olayın (yeni dosya, dokümanlar hazır, dokümanlar güncellendi) Bugün'de satır olarak görünüşü. Not bildiriminde sayı yazmaz.

## Ayarlar (`OkulAyarlar`, `SahneYontem`, `SahneSureler`)

- **Okul ayarları:** beş başlık: Kaynaklar, Bildirimler, Hazırlık dokümanları, Çalışma, Klasör. Her satırda ad ve o anki değer.
- **Yöntemler** (alttan sayfa): iş türü başına sayaç: konu okuma, yazılı ödev ve rapor → pomodoro; kodlama ödevi ve proje kodu → akış; soru çözme → soru sayacı; sunum provası → hedef süre; sınav öncesi tekrar → tek blok. "Oturum sırasında değiştirilmez."
- **Pomodoro süreleri** (alttan sayfa): odak, kısa mola, uzun mola (25 / 5 / 15 dk).

## Şemalar (ekran değil)

`Isler` (hangi iş hangi sahneyi açar), `AkisKlasor`, `AkisNinova`, `AkisDokuman`: sistemin nasıl çalıştığını anlatır; kurulacak ekran değildir.

## Çizilmeyenler

Onaylı karesi olmayanlar en yakın kareden türetilir ve "görüşün gerek" diye işaretlenir.

- Pano karşılığı çizilmeyenler: devam, dosyalar, dosya ayrıntısı, iş ayrıntısı, bildirim listesi, ayarlar.
- Ödev ve proje için ayrı ayrıntı sayfası (çizilen iş ayrıntısı bir quizdir); proje alt işini düzenleme.
- Boş haller (dersin hiç dosyası ya da notu yokken), ilk kurulum, okuma hiç gelmemişken.
- "4 değişiklik · Gör"ün açtığı liste.
- Haftalık rapora gidenler (`okul.md` bölüm 10; öneri).
