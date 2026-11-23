# Okul modülü: karelerin dizini

Tuvaldeki ("Sherpa · Okul modülü (taslak mockuplar)", https://claude.ai/artifact/4DE2PDQUQq6vF3j3rqAHvm) bütün karelerin kaynak dosyaları. 90 kare; tuvalin 17 Kas 2026 tarihli `1794933138-702d` sürümünden, içerik değiştirilmeden kopyalandı. **Donmuştur;** elle değiştirilmez.

- **Onay:** kullanıcı 1–86'yı 16 Kas 2026 tasarım oturumunda gezdi ve son taramadan sonra onayladı; 76 ve 83'ün düzeltilmiş hali ile 87–90 17 Kas 2026'da onaylandı.
- **Nasıl kontrol edildi:** kareler bir tarayıcıda, yedek yazı tipiyle görüntülenerek kontrol edildi; tuvalin kendi içinde görüntülenmedi.
- **Örnek olanlar:** notlar, saatler, tarihler, bölüm adları, soru sayıları, dosya adları, duyuru metinleri, süreler. Bunlar karede yer tutar; doğru veri Ninova ve Kepler'den gelir.
- **Değerler:** kareler satır içi stil taşır (renk, boşluk, yazı boyu). Kurulurken değerler `src/core/ui/tokens.css`'ten alınır; karedeki sayı token'la uyuşmuyorsa token geçerlidir ve fark rapora yazılır (`../../README.md`, "Çelişkide sıra").
- **Bugün kareleri** (her senaryonun 1. ve son karesi) çekirdeğin onaylı `ZT1` ve `ZP1` karelerinden türetildi; yalnızca kartın, sıradakinin ve günün akışındaki parçanın metni değişti.
- Açma kuralları üst klasördeki `DIZIN.md` ile aynıdır (`./support.js` kopyalanmadı; yazı tipi Google Fonts'tan).
- `canvas.json` tuvalin dizinidir; bu dosya ondan üretildi. Hangi karenin hangi ekranı anlattığı: `../../ekranlar/okul-sahneler.md`, `../../ekranlar/okul-sayfalar.md`.

## Kareler

| No | Kare | Başlık | Cihaz | Boyut | Grup |
| --- | --- | --- | --- | --- | --- |
| 1 | `Isler` | Okul'un verdiği işler ve sahneleri | telefon | 390×2090 | İşler |
| 2 | `K1T1` | Quiz hazırlığı · 1 Bugün: Başla · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 3 | `K1T2` | Quiz hazırlığı · 2 Odak turu 1 · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 4 | `K1T3` | Quiz hazırlığı · 3 Kısa mola · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 5 | `K1T4` | Quiz hazırlığı · 4 Odak turu 3: sıradaki bölüm · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 6 | `K1T5` | Quiz hazırlığı · 5 Süre doldu: bölüm bitmediyse +5 dk · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 7 | `K1T6` | Quiz hazırlığı · 6 Soru çözme: bölümün türü sayacı değiştirir · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 8 | `K1T7` | Quiz hazırlığı · 7 Oturum bitti: tek yazı · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 9 | `K1T8` | Quiz hazırlığı · 8 Bugün: sıradaki iş · telefon | telefon | 390×844 | Senaryo 1 · quiz |
| 10 | `K1P1` | Quiz hazırlığı · 1 Bugün: Başla · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 11 | `K1P2` | Quiz hazırlığı · 2 Odak turu 1 · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 12 | `K1P3` | Quiz hazırlığı · 3 Kısa mola · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 13 | `K1P4` | Quiz hazırlığı · 4 Odak turu 3: sıradaki bölüm · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 14 | `K1P5` | Quiz hazırlığı · 5 Süre doldu: bölüm bitmediyse +5 dk · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 15 | `K1P6` | Quiz hazırlığı · 6 Soru çözme: bölümün türü sayacı değiştirir · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 16 | `K1P7` | Quiz hazırlığı · 7 Oturum bitti: tek yazı · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 17 | `K1P8` | Quiz hazırlığı · 8 Bugün: sıradaki iş · pano | pano | 1440×900 | Senaryo 1 · quiz |
| 18 | `K2T1` | Midterm hazırlığı · 1 Bugün: Başla · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 19 | `K2T2` | Midterm hazırlığı · 2 Soru çözme başlıyor · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 20 | `K2T3` | Midterm hazırlığı · 3 Soru çözme: biri takıldı, sona kaldı · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 21 | `K2T4` | Midterm hazırlığı · 4 Bölüm arası mola · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 22 | `K2T5` | Midterm hazırlığı · 5 Okuma: yeni eklenen bölüm · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 23 | `K2T6` | Midterm hazırlığı · 6 Oturum bitti: tek yazı · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 24 | `K2T7` | Midterm hazırlığı · 7 Bugün: sıradaki iş · telefon | telefon | 390×844 | Senaryo 2 · midterm |
| 25 | `K2P1` | Midterm hazırlığı · 1 Bugün: Başla · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 26 | `K2P2` | Midterm hazırlığı · 2 Soru çözme başlıyor · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 27 | `K2P3` | Midterm hazırlığı · 3 Soru çözme: biri takıldı, sona kaldı · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 28 | `K2P4` | Midterm hazırlığı · 4 Bölüm arası mola · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 29 | `K2P5` | Midterm hazırlığı · 5 Okuma: yeni eklenen bölüm · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 30 | `K2P6` | Midterm hazırlığı · 6 Oturum bitti: tek yazı · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 31 | `K2P7` | Midterm hazırlığı · 7 Bugün: sıradaki iş · pano | pano | 1440×900 | Senaryo 2 · midterm |
| 32 | `K3T1` | Ödev · 1 Bugün: Başla · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 33 | `K3T2` | Ödev · 2 Akış başlıyor: ilk oturum, not yok · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 34 | `K3T3` | Ödev · 3 Akış sürüyor · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 35 | `K3T4` | Ödev · 4 Mola: sen verirsin, ileri sayar · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 36 | `K3T5` | Ödev · 5 Planlanan süre doldu · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 37 | `K3T6` | Ödev · 6 Çıkarken: nerede kaldın · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 38 | `K3T7` | Ödev · 7 Bugün: sıradaki iş · telefon | telefon | 390×844 | Senaryo 3 · ödev |
| 39 | `K3P1` | Ödev · 1 Bugün: Başla · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 40 | `K3P2` | Ödev · 2 Akış başlıyor: ilk oturum, not yok · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 41 | `K3P3` | Ödev · 3 Akış sürüyor · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 42 | `K3P4` | Ödev · 4 Mola: sen verirsin, ileri sayar · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 43 | `K3P5` | Ödev · 5 Planlanan süre doldu · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 44 | `K3P6` | Ödev · 6 Çıkarken: nerede kaldın · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 45 | `K3P7` | Ödev · 7 Bugün: sıradaki iş · pano | pano | 1440×900 | Senaryo 3 · ödev |
| 46 | `K4T1` | Proje alt işi · 1 Bugün: Başla · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 47 | `K4T2` | Proje alt işi · 2 Odak turu 1: alt işin içinde adım yok · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 48 | `K4T3` | Proje alt işi · 3 Kısa mola · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 49 | `K4T4` | Proje alt işi · 4 Odak turu 2: son tur · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 50 | `K4T5` | Proje alt işi · 5 Süre bitti: bitti mi? · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 51 | `K4T6` | Proje alt işi · 6 Teslim: kontrol listesi · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 52 | `K4T7` | Proje alt işi · 7 Bugün: sıradaki iş · telefon | telefon | 390×844 | Senaryo 4 · proje |
| 53 | `K4P1` | Proje alt işi · 1 Bugün: Başla · pano | pano | 1440×900 | Senaryo 4 · proje |
| 54 | `K4P2` | Proje alt işi · 2 Odak turu 1: alt işin içinde adım yok · pano | pano | 1440×900 | Senaryo 4 · proje |
| 55 | `K4P3` | Proje alt işi · 3 Kısa mola · pano | pano | 1440×900 | Senaryo 4 · proje |
| 56 | `K4P4` | Proje alt işi · 4 Odak turu 2: son tur · pano | pano | 1440×900 | Senaryo 4 · proje |
| 57 | `K4P5` | Proje alt işi · 5 Süre bitti: bitti mi? · pano | pano | 1440×900 | Senaryo 4 · proje |
| 58 | `K4P6` | Proje alt işi · 6 Teslim: kontrol listesi · pano | pano | 1440×900 | Senaryo 4 · proje |
| 59 | `K4P7` | Proje alt işi · 7 Bugün: sıradaki iş · pano | pano | 1440×900 | Senaryo 4 · proje |
| 60 | `SahneAkisProje` | Telefon · akış: proje, iki alt iş aynı oturumda | telefon | 390×844 | Öbür sahneler |
| 61 | `SahneProva` | Telefon · hedefli: sunum provası | telefon | 390×844 | Öbür sahneler |
| 62 | `SahneTekrar` | Telefon · tek blok: sınav öncesi özet tekrar | telefon | 390×844 | Öbür sahneler |
| 63 | `SahneDokuman` | Telefon · kontrol listesi: hazırlık dokümanı | telefon | 390×844 | Öbür sahneler |
| 64 | `SahneToplanti` | Telefon · kontrol listesi: takım toplantısı | telefon | 390×844 | Öbür sahneler |
| 65 | `SahneDers` | Telefon · sabit blok: derste | telefon | 390×844 | Öbür sahneler |
| 66 | `SahneSinav` | Telefon · sabit blok: sınav günü | telefon | 390×844 | Öbür sahneler |
| 67 | `PanoDokuman` | Pano · kontrol listesi: hazırlık dokümanı | pano | 1440×900 | Öbür sahneler |
| 68 | `PanoDersSahne` | Pano · sabit blok: ders bitti, devam sorusu | pano | 1440×900 | Öbür sahneler |
| 69 | `AnaSayfa` | Telefon · ana sayfa: dönemin bütün işleri | telefon | 390×4469 | Modül · telefon |
| 70 | `DersSecici` | Telefon · ders seçici açık | telefon | 390×844 | Modül · telefon |
| 71 | `Ders` | Telefon · ders sayfası: dersin bütün işleri, VF şartları, notlandırma | telefon | 390×2950 | Modül · telefon |
| 72 | `Devam` | Telefon · ders sayfası: devam, Kepler onayıyla | telefon | 390×1270 | Modül · telefon |
| 73 | `Dosyalar` | Telefon · ders sayfası: dosyalar | telefon | 390×1260 | Modül · telefon |
| 74 | `DosyaAyrinti` | Telefon · dosyaya dokununca | telefon | 390×844 | Modül · telefon |
| 75 | `SorumlulukAyrinti` | Telefon · işe dokununca (duyurudan gelen tarih) | telefon | 390×844 | Modül · telefon |
| 76 | `SinavAyrinti` | Telefon · sınava dokununca: kapsam, dokümanlar ve bölünmüş oturumlar | telefon | 390×1841 | Modül · telefon |
| 77 | `Bildirimler` | Telefon · bildirimler: beş olay | telefon | 390×960 | Modül · telefon |
| 78 | `OkulAyarlar` | Telefon · Okul ayarları: kararların tek yerde görünümü | telefon | 390×1944 | Modül · telefon |
| 79 | `SahneYontem` | Telefon · ayarlar: iş türüne göre yöntem (sahnede değil) | telefon | 390×844 | Modül · telefon |
| 80 | `SahneSureler` | Telefon · ayarlar: pomodoro süreleri (sahnede değil) | telefon | 390×844 | Modül · telefon |
| 81 | `PanoAna` | Pano · ana sayfa: dönemin bütün işleri | pano | 1440×3088 | Modül · pano |
| 82 | `PanoDers` | Pano · ders sayfası: dersin bütün işleri, VF şartları, notlandırma | pano | 1440×1806 | Modül · pano |
| 83 | `PanoSinavAyrinti` | Pano · sınava dokununca: kapsam, dokümanlar ve bölünmüş oturumlar | pano | 1440×900 | Modül · pano |
| 84 | `AkisKlasor` | Uçtan uca 1 · klasör yapısı ve kim nereye yazar | şema | 1440×1960 | Uçtan uca |
| 85 | `AkisNinova` | Uçtan uca 2 · Ninova'dan klasöre: tetik ve adımlar | şema | 1440×1157 | Uçtan uca |
| 86 | `AkisDokuman` | Uçtan uca 3 · hazırlık dokümanları: quiz, midterm, final | şema | 1440×2052 | Uçtan uca |
| 87 | `SahneKaldiginYerHazirlik` | Telefon · oturum başı: hazırlıkta kaldığın yer (kendiliğinden) | telefon | 390×844 | Kaldığın yer |
| 88 | `PanoKaldiginYerHazirlik` | Pano · oturum başı: hazırlıkta kaldığın yer (kendiliğinden) | pano | 1440×900 | Kaldığın yer |
| 89 | `SahneKaldiginYerOdev` | Telefon · oturum başı: ödevde kaldığın yer (yazdığın cümle) | telefon | 390×844 | Kaldığın yer |
| 90 | `PanoKaldiginYerOdev` | Pano · oturum başı: ödevde kaldığın yer (yazdığın cümle) | pano | 1440×900 | Kaldığın yer |

## Notlar

- Numara, tuvaldeki kare numarasıdır; `docs/moduller/okul.md` kareleri bu numarayla anar.
- 87–90 sonradan eklendi; numaralar kaymasın diye sona kondu, içerik olarak "Öbür sahneler"e aittir.
- Çekirdek kararı 10'a göre yalnızca onaylı karesi olan yerleşim kurulur. Yerleşimlerin kareleri: pomodoro `K1T2`–`K1T4`, `K4T2`–`K4T4`; akış `K3T2`–`K3T4`, `SahneAkisProje`; kontrol listesi `K4T6`, `SahneDokuman`, `SahneToplanti`; soru sayacı `K1T6`, `K2T2`, `K2T3`, `SahneProva`; tek blok `SahneTekrar`; blok görünümü `SahneDers`, `SahneSinav`, `PanoDersSahne` (pano karşılıkları aynı adın `P` hali ya da `Pano…`).
