# Rutin çizimlerinden alınan değerler

Kaynak: Rutin tuvali (`docs/moduller/rutin.md` başındaki bağlantı), 14 Kas 2026 sürümü. Tuvalin güncel üç sayfasındaki bütün kareler okundu: "Sabah · uçtan uca" (12 telefon karesi ve sahnenin pano karesi), "Akşam · uçtan uca" (6 telefon karesi ve sahnenin pano karesi), "Modül sayfası" (15 kare ve alt menü panosu). Son okuma: 14 Kas 2026, pano sahneleri eklendikten ve Düzenlilik kareleri güncellendikten sonra. Değerler karelerden birebir kopyalandı. "Yapı", "Görsel yönler" ve "Cam dili" sayfaları geçmiş turlardır; okunmadı ve kullanılmaz ("Cam dili" sayfasındaki eski pano karesi de geçersizdir).

Bütün ölçüler 390 × 844 telefon karesine göredir (`viewBox="0 0 390 844"`); başka boyutta oranla ölçekle. Yazı tipi çizimlerde Geist; uygulamada çekirdeğin yazı tipi kullanılır. Karelerdeki sayılar (6/7, 07:12, "toplam 9 dk" gibi) örnek veridir; gerçek değer veriden gelir. Uyanış ve yatış aralıkları ile uyku hedefi örnek değil, önerilen çerçeve ayarıdır (kullanıcının kararı, 14 Kas 2026; `rutin.md` "Yatış kaydı"): uyanış 06:00–08:00, yatış 22:00–24:00, uyku hedefi 8 saat. Uygulama bunları yine çekirdeğin ayarından okur.

Hangi kurulum adımında ne kullanılır:

- **1. adım:** bölüm 1–7 (gökyüzü, telefon ve pano sahnesi, akışlar) ve bölüm 8'in içeriği (alanlar, metinler, davranış). Modül sayfası 1. adımda çekirdeğin iskeletiyle kurulur; bölüm 8'deki cam görünüş 3. adımın işidir.
- **2. adım:** bölüm 9 (Düzenlilik).
- **3. adım ve Ç4:** bölüm 8'in cam görünüşü, bölüm 10 (Bugün, alt menü, Modüller; çekirdek ekranları).

## 1. Gökyüzü

Zemin yukarıdan aşağı doğrusal geçiştir; ufuk yüksekliğin yaklaşık %73–74'ündedir ve son renk oradan aşağı düz devam eder. Gökyüzü saate göre **sürekli** değişir: sabah akışının her karesi biraz farklıdır. Aşağıdaki kareler ölçü noktalarıdır; aradaki saatler güneşin yüksekliğine göre geçişle bulunur (`ORTAK.md` bölüm 2). Adım ilerledi diye zemin değişmez.

| Saat (13 Kas) | Geçiş |
| --- | --- |
| 07:00 Günaydın | `#060a1c 0%, #0c1230 22%, #171a45 42%, #292359 55%, #45305f 63%, #6f405f 68.5%, #a05a5b 72%, #c97d58 74.5%` |
| 07:02 Diş | `#060a1d 0%, #0c1231 21.8%, #181a46 41.5%, #2a245a 54.5%, #473160 62.6%, #714160 68.2%, #a35d5c 71.9%, #cb805a 74.5%` |
| 07:06 Su | `#070b1f 0%, #0d1332 21.3%, #191b48 40.6%, #2c245c 53.5%, #4a3262 61.7%, #754262 67.5%, #a9625d 71.8%, #cf865f 74.4%` |
| 07:20 Duş | `#090e25 0%, #101538 19.7%, #1d1e4f 37.4%, #342861 50%, #553669 58.8%, #834869 65.2%, #c07562 71.2%, #dc9d6f 74.1%` |
| 07:33 SPF | `#0a102b 0%, #12183d 18.2%, #212056 34.4%, #3b2b67 46.8%, #603a6f 56%, #904d70 63.1%, #d48766 70.7%, #e9b17f 73.9%` |
| 07:36 Giyin | `#0b112c 0%, #13183f 17.8%, #222158 33.7%, #3c2c68 46%, #623b70 55.4%, #934f71 62.6%, #d98b67 70.6%, #ecb682 73.8%` |
| 07:52–08:05 Yürüyüş, İyi günler, Bugün | `#0d1433 0%, #161b45 16%, #272460 30%, #45306f 42%, #6f4078 52%, #a35579 60%, #f2a16c 70%, #fbcf95 73.5%` |
| Gündüz (modül sayfası kareleri) | `#0c1636 0%, #16285a 24%, #27427a 46%, #46669a 60%, #7f95b4 69%, #c2b3a6 73.5%` |
| Gece (22:05–22:30) | `#03050f 0%, #060a1f 22%, #0a1030 44%, #0f1840 60%, #16224f 70%, #1c2a5a 74%` |

Aynı karelerde saatle birlikte değişen öbür değerler:

| Saat | Ufuk parıltısı α | Sis orta opaklığı | Uzak tepe | Orta tepe | Yakın tepenin üst rengi | Yıldız çarpanı |
| --- | --- | --- | --- | --- | --- | --- |
| 07:00 | 0.30 | 0.20 | `#5c3a5e` | `#2e2148` | `#17112c` | 1.00 |
| 07:02 | 0.31 | 0.20 | `#5e3b5f` | `#2f2249` | `#17112c` | 0.96 |
| 07:06 | 0.33 | 0.21 | `#623d61` | `#31234b` | `#18122d` | 0.88 |
| 07:20 | 0.42 | 0.25 | `#724569` | `#392651` | `#1c1431` | 0.62 |
| 07:33 | 0.49 | 0.28 | `#804c70` | `#402a57` | `#1f1634` | 0.37 |
| 07:36 | 0.51 | 0.28 | `#834d71` | `#422b59` | `#1f1734` | 0.31 |
| 07:52 ve sonrası | 0.60 | 0.32 | `#94567a` | `#4b2f60` | `#231938` | 0 (yıldız yok) |
| Gündüz | yok | yok | `#62789c` | `#2d3f66` | `#121a33` (alt `#060914`) | 0 |
| Gece | aşağıda | 0.14 | `#111a40` | `#0a102a` | `#070a1b` (alt `#020309`) | gece yıldızları |

Yakın tepenin alt rengi şafak karelerinde hep `#0a0814`.

Ufuk parıltısı (şafak; iki bulanık elips, α tablodan):

- `left 30, top 548, 440 × 140`, `rgba(255,170,110,α)`, `blur(44px)`
- `left 190, top 598, 190 × 44`, `rgba(255,210,155,α)`, `blur(22px)`

Gece parıltısı:

- `left -70, top 486, 540 × 80`, `rgba(112,132,224,0.11)`, `blur(30px)`, `rotate(-10deg)`
- `left -40, top 590, 470 × 50`, `rgba(96,124,210,0.22)`, `blur(22px)`

Alt karartma (şafak karelerinde, düğmelerin arkası): alttan 170 px, `linear-gradient(180deg, rgba(8,6,20,0) 0%, rgba(8,6,20,0.5) 100%)`. Gece karelerinde yoktur.

### Tepeler (üç katman, her durumda aynı eğriler)

```
Uzak:  M0 644 C40 628 78 620 120 630 C160 639 190 614 236 610 C282 606 318 630 352 624 C370 621 382 616 390 614 L390 844 L0 844 Z
Orta:  M0 670 C36 656 70 648 112 658 C150 667 186 680 228 668 C270 656 300 640 340 646 C362 649 378 656 390 660 L390 844 L0 844 Z
Yakın: M0 692 C50 676 96 670 150 680 C200 689 250 698 300 684 C336 674 366 670 390 674 L390 844 L0 844 Z
```

Pano (1440 × 900, alta yaslı; zemin geçişinin durakları `0, 26, 48, 62, 72, 78%`):

```
Uzak:  M0 724 C160 694 300 684 460 704 C620 724 760 674 940 668 C1120 662 1260 704 1440 680 L1440 900 L0 900 Z
Orta:  M0 772 C140 748 280 738 440 754 C600 772 740 792 900 768 C1060 744 1200 722 1440 742 L1440 900 L0 900 Z
Yakın: M0 822 C200 797 380 790 600 806 C800 820 1000 834 1200 810 C1320 798 1400 792 1440 796 L1440 900 L0 900 Z
```

Sis: uzak sırtın üstünde `rect x0 y610 w390 h72`, orta sırtın üstünde `rect x0 y648 w390 h50` (opaklık 0.55); dikey geçiş, ortada dolu (opaklık tablodan), uçlarda saydam. Renk şafakta `#ffc79a`, gecede `#7f97e6` (yalnızca ilk şerit). Gündüz karelerinde sis yoktur.

### Güneş

- 07:52 (ufukta): merkez `286, 612`; 07:55'te `286, 602`; 08:05'te `286, 570` (yükseliyor). Hale `r 72`, dairesel geçiş `#fff3cf` 0.9 → `#ffdc9c` 0.4 (%40) → saydam; gövde `r 24`, dairesel geçiş (`cx 0.5 cy 0.4 r 0.6`) `#fffbe8 → #ffe7ad (%60) → #ffc878`.
- Gündüz (yukarıda): merkez `318, 150`; hale `r 60`, `#fff6d8` 0.7 → saydam; gövde `r 17`, `#fff8e0`. Panoda merkez `1210, 250`, hale `r 90`, gövde `r 22`.
- 07:36'ya kadarki karelerde güneş görünmez. Yeri saate göre hesaplanır; bu kareler örnektir.

### Yıldızlar

Şafak (10 tane, `#e8ecff`; opaklık = taban × tablodaki çarpan): `cx cy r taban`

```
26 86 0.8 0.40 · 64 128 0.6 0.30 · 98 74 1.0 0.45 · 142 112 0.6 0.28 · 186 82 0.8 0.35
232 148 0.6 0.25 · 262 92 0.7 0.30 · 366 96 0.7 0.30 · 44 170 0.6 0.22 · 378 232 0.6 0.20
```

Sabah yıldızı: `318, 142`; hale `r 9` (`#fff4e0` 0.5 → saydam), gövde `r 1.7` `#fff6e6`; ikisinin opaklığı tablodaki çarpandır.

Gece, `#e8ecff`:

```
22 84 0.9 0.7 · 48 132 0.7 0.5 · 70 72 1.3 0.9 · 96 168 0.8 0.55 · 118 104 0.7 0.45 · 140 66 1 0.75
182 96 0.7 0.5 · 204 186 0.9 0.6 · 226 74 0.8 0.5 · 64 208 0.6 0.4 · 128 200 0.7 0.5 · 12 150 0.6 0.45
104 78 0.5 0.4 · 190 150 0.5 0.35 · 54 100 0.5 0.35 · 168 204 0.5 0.3 · 374 72 0.7 0.4 · 10 262 0.7 0.5
382 300 0.7 0.45 · 8 340 0.6 0.4 · 36 498 0.8 0.55 · 176 540 0.8 0.5 · 214 506 1 0.7 · 256 560 0.7 0.45
372 566 0.7 0.4 · 230 592 0.6 0.3 · 162 586 0.6 0.3 · 30 548 0.6 0.35
```

Sıcak (`#ffe9c9`): `30 196 1.1 0.8 · 292 496 0.7 0.5 · 132 494 0.7 0.45`. Soğuk (`#bcd0ff`): `216 118 0.7 0.6 · 88 522 1.2 0.85 · 246 204 0.6 0.4`. Parlak yıldız: `158, 142`; hale `r 7` (`#dfe6ff` 0.45 → saydam), gövde `r 1.5` `#f4f6ff`.

### Ay (gece; yeri ve evresi hesaplanmaz)

Merkez `322, 556`. Hale `r 78`: `#b9c8ff` 0.42 → `#9fb2ff` 0.12 (%45) → saydam. Gövde `r 22`: dairesel geçiş (`cx 0.38 cy 0.34 r 0.75`) `#fdfdff → #e4e9f8 (%55) → #b4bfe2`.

### Baykuş ve dal (gecenin bütün karelerinde, Bugün dahil)

```svg
<!-- dal -->
<path d="M0 604 C34 606 66 612 104 609 C122 608 136 603 148 596" stroke="#050817" stroke-width="5" stroke-linecap="round"/>
<path d="M118 608 C126 600 130 592 131 584" stroke="#050817" stroke-width="2.5" stroke-linecap="round"/>
<!-- gövde ve ay ışığı kenarı -->
<path d="M82 608 C70 608 65 594 67 582 C68 570 73 564 75 558 L80 565 C84 563 90 563 94 565 L99 558 C101 564 106 570 107 582 C109 594 104 608 92 608 Z" fill="#070b1f"/>
<path d="M99 558 C101 564 106 570 107 582 C108 592 106 601 100 606" stroke="#c8d4ff" stroke-opacity="0.4" stroke-width="1" stroke-linecap="round"/>
<!-- gözler açık -->
<circle cx="80" cy="577" r="5" fill="#d3daf5"/><circle cx="94" cy="577" r="5" fill="#d3daf5"/>
<circle cx="80" cy="578.5" r="2" fill="#070b1f"/><circle cx="94" cy="578.5" r="2" fill="#070b1f"/>
<path d="M74.5 577.5 A5.5 5.5 0 0 1 85.5 577.5 Z M88.5 577.5 A5.5 5.5 0 0 1 99.5 577.5 Z" fill="#070b1f"/>
<!-- gaga ve göğüs tüyleri -->
<path d="M85.5 582 L87 586 L88.5 582 Z" fill="#8f9bd0"/>
<path d="M80 594 q2 2 4 0 M90 594 q2 2 4 0 M85 599 q2 2 4 0" stroke="#c8d4ff" stroke-opacity="0.2" stroke-width="1" stroke-linecap="round"/>
<!-- yalnızca "İyi geceler"de: gözler kapalı (üsttekilerin üzerine çizilir) -->
<circle cx="80" cy="577" r="5.6" fill="#070b1f"/><circle cx="94" cy="577" r="5.6" fill="#070b1f"/>
<path d="M76 578 q4 3 8 0 M90 578 q4 3 8 0" stroke="#c8d4ff" stroke-opacity="0.55" stroke-width="1.2" stroke-linecap="round"/>
```

## 2. Sahnenin camı (koyu ton)

İki sütun: sabah (şafak) ve akşam (gece) kareleri.

| Parça | Sabah | Akşam |
| --- | --- | --- |
| Metin | `#f7f5ff`; ikincil `#d2cfe3`; alt satır `#ece7d8`; açıklama `#e6e2f2` | `#f4f6ff`; ikincil `#c6cde8` (şeritte `#b9c2de`); alt satır ve açıklama `#dfe4f6` |
| Üst şerit (yükseklik 52, iç boşluk `0 12 0 20`, yazı 14 px) | `rgba(10,12,34,0.34)`, `blur(22px) saturate(170%)`, alt kenar `1px rgba(255,255,255,0.16)` | `rgba(6,9,28,0.3)`, `blur(24px) saturate(170%)`, alt kenar `1px rgba(255,255,255,0.14)` |
| "Bu adımda" paneli (kenar boşluğu `0 16`, iç boşluk `12 8 8`, köşe 26, `blur(26px) saturate(170%)`) | `rgba(18,16,46,0.4)`; kenar `1px rgba(255,255,255,0.26)`; gölge `inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.08), 0 14px 36px rgba(8,6,24,0.3)` | `rgba(14,20,54,0.38)`; kenar `1px rgba(255,255,255,0.22)`; gölge `inset 0 1px 0 rgba(255,255,255,0.3), 0 14px 36px rgba(2,4,14,0.35)` |
| "Sıradaki" paneli (üst boşluk 12, iç boşluk `12 18`, köşe 22, `blur(22px) saturate(170%)`) | `rgba(18,16,46,0.32)`; kenar `rgba(255,255,255,0.2)`; gölge `inset 0 1px 0 rgba(255,255,255,0.28)` | `rgba(14,20,54,0.3)`; kenar `rgba(255,255,255,0.18)`; gölge `inset 0 1px 0 rgba(255,255,255,0.26)` |
| Vurgu (dolu çember, ilerleme çizgisi) | `#ffd58a`, içindeki rakam `#2a1c05` | `#aab6ff`, içindeki rakam `#0a1030` |
| Etkin alt adım satırı (yükseklik 60, köşe 14) | `rgba(255,213,138,0.2)`, `inset 0 1px 0 rgba(255,255,255,0.22)` | `rgba(170,182,255,0.2)`, `inset 0 1px 0 rgba(255,255,255,0.2)` |
| İlerleme çizgisinin boş parçası | `rgba(255,255,255,0.24)` | `rgba(255,255,255,0.22)` |
| Ana düğme (yükseklik 60, köşe 30, `flex:2`, 18 px 600, -0.01em) | `rgba(255,244,222,0.9)`, metin `#1a1426`, kenar `1px rgba(255,255,255,0.7)`, gölge `inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(0,0,0,0.3)` | `rgba(223,229,251,0.9)`, metin `#0a1030`, kenar `1px rgba(255,255,255,0.65)`, gölge `inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(0,0,0,0.35)` |
| Ana düğme, süre dolmadan: "Erken geç · basılı tut" (16 px 600) | `rgba(255,244,222,0.26)`, metin `#f7f5ff`, gölge `inset 0 1px 0 rgba(255,255,255,0.4)` | `rgba(223,229,251,0.24)`, metin `#f4f6ff`, aynı gölge |
| "Atla" (yükseklik 60, köşe 30, `flex:1`, 17 px 500, `blur(18px) saturate(160%)`, kenar `1px rgba(255,255,255,0.3)`) | `rgba(255,255,255,0.14)`, `inset 0 1px 0 rgba(255,255,255,0.3)` | `rgba(255,255,255,0.12)`, `inset 0 1px 0 rgba(255,255,255,0.28)` |
| "Hepsini yaptım" (yalın metin, yükseklik 44, 15 px 500) | `#e2ddef` | `#d5dbf0` |

Ortak ölçüler:

- **Şerit içeriği:** saat (500, tabular), 8 px bölüm noktası, ad (600), "· n dk" (ilk karede yok), sağda "Çık" (600, en az 44 × 44). Şeritteki ad sabahın bütün karelerinde "Sabah"tır (Duş, SPF, Giyin, Yürüyüş dahil; süre uyanıştan beri sayılır: 07:20'de "· 20 dk"); akşamda "Akşam kapanışı"dır. Nokta bölümün rengidir (çizimde Sabah `#E8A33D`, Akşam `#8fa0ff`); gerçek değer `facet` renginden gelir.
- **Başlık bölgesi:** yükseklik 221, iç boşluk `26 24 0`, aralık 4. Başlık 34 px 700, -0.02em, satır 1.2. Sayaçlı adımda büyük sayaç: 84 px 500, -0.045em, tabular. Sayaçsız adımda açıklama: 19 px 500, satır 1.4. Ses satırı: 15 px `#dcd9ec`, 18 px hoparlör simgesi, üst boşluk 10.
- **Panel etiketi** ("BU ADIMDA", "SIRADAKİ", "SONRA", "YARIN"): 12 px 600, harf aralığı 0.08em, ikincil renk. "Bu adımda"nın sağında alt adım sayacı ("2 / 4", 13 px, tabular); tek alt adımda yoktur.
- **Alt adım satırı:** sıradan: yükseklik 42, 26 px çember (`1.5px rgba(255,255,255,0.5)` kenar, içinde sıra no, 14 px 600). Yapılmış: opaklık 0.5, çember `#ffffff` 0.16 dolgu, içinde onay işareti (`M8 13.4l3.2 3.2 6.4-7`, kalınlık 2). Etkin: yukarıdaki dolgu, dolu çember vurgu renginde, ad 600, altında 14 px ikinci satır. Satırlar arası 4.
- **"Sıradaki" paneli:** ilk satır: etiket, sıradaki adımın adı (15 px 600), sağda "bu sabah n / m" ya da "bu akşam n / m" (13 px). Altında ilerleme çizgisi: parça başına `flex:1`, yükseklik 4, köşe 2, aralık 6. Altında "Sonra: …" (13 px; kalan adımlar " · " ile; kalan yoksa satır yok).
- **Alt bölge:** iç boşluk `0 16 30`, düğmeler arası 10, "Hepsini yaptım" ile arası 6.

## 3. Sabahın kareleri

| # | Saat | Ekran | İçerik |
| --- | --- | --- | --- |
| 0 | 07:00 | iPhone alarmı (Sherpa değil) | "Ertele", "Durdur". Not: "Durdurunca Kestirmeler otomasyonu çalışır: uyanış saati Sherpa'ya yazılır ve Sherpa açılır." (2. adım) |
| 1 | 07:00 | Günaydın | Şerit: "07:00 ● Sabah", "Çık". Ortada, üstten 150: "Günaydın" (48 px 600, -0.03em), altında "Cuma 13 Kasım" (17 px 500, `#d6d3ea`). Altta tek düğme "Kalktım": yükseklik 64, köşe 32, ana düğmenin sabah renkleri, 19 px 600; alt boşluk 34 |
| 2 | 07:02 | Diş bakımı | Sayaç "01:24"; ses satırı "Günün planı okunuyor". Alt adımlar 2 / 4: Su jeti (yapılmış), **Fırçala · 2 dk** ("Bitince kendiliğinden Dil'e geçer"), Dil · 20–30 sn. Sıradaki: Bir bardak su, "bu sabah 1 / 7", "Sonra: Boyun hareketleri · Duş · SPF · Giyin · Yürüyüş". Ana düğme "Erken geç · basılı tut" |
| 3 | 07:06 | Bir bardak su | Açıklama "Mutfakta, bir bardak."; ses satırı "Günün planı bitti · Tekrar anlat". Alt adım: **Bir bardak su iç** ("Oda sıcaklığında"). Sıradaki: Boyun hareketleri, 2 / 7. Ana düğme "Sonraki" |
| 4 | 07:08 | Boyun hareketleri | Spor'un sahnesi, kendi zemini (bölüm 6). Rutin kurmaz; dizide başka modülün işi gelince ekran o modülün sahnesine geçer |
| 5 | 07:20 | Duş | Açıklama `Çıkarken "Sonraki".` Alt adımlar 1 / 2: **Duş** ("Yaklaşık 10 dk"), "Dercos şampuan · bugün" (N günde bir ek, sırası gelen gün görünür). Sıradaki: SPF, 4 / 7 |
| 6 | 07:33 | SPF | Açıklama "Yüz kuruyken." Alt adımlar 2 / 2: Yarım çay kaşığı kadar al (yapılmış), **Yüz, boyun ve kulaklara yay** ("Kulak arkasını unutma"). Sıradaki: Giyin, 5 / 7 |
| 7 | 07:36 | Giyin | Açıklama "Çıkışa hazırlan." Alt adım: **Giyin** ("Planda 15 dk"). Sıradaki: Yürüyüş, 6 / 7; "Sonra" satırı yok |
| 8 | 07:52 | Yürüyüş (son adım) | Açıklama "Çıkarken, arabaya binmeden." Alt adım: **Tempolu yürü · 10–15 dk** ("Sabah ışığı için dışarıda"). Alt panelin etiketi "SONRA": günün sıradaki işi ("10:30 Derin Öğrenme"), 7 / 7, çizginin hepsi dolu. Ana düğme "Bitti" |
| 9 | 07:55 | İyi günler | Şerit, panel ve düğme yok; yalnızca gökyüzü ve ortada, üstten 300: "İyi günler" (48 px 600, -0.03em) |
| 10 | 07:55 | Geçiş | "İyi günler" yazısı solar (karede opaklık 0.5), aynı anda Bugün ekranı belirir (karede 0.6); süre 0,6 sn; gökyüzü değişmez |
| 11 | 08:05 | Bugün | Aynı gökyüzü, sıradaki iş (bölüm 10) |

## 4. Akşamın kareleri

| # | Saat | Ekran | İçerik |
| --- | --- | --- | --- |
| 0 | 22:05 | Bugün (gece) | "Şimdi" kartında "Rutin · Akşam", "Akşam kapanışı", "10 dk · 22:20 · yatış 22:30", "Başla" ve "Ertele"; altında "Bugünün işleri bitti · 3 / 3 · geriye yalnızca kapanış kaldı" (bölüm 10) |
| 1 | 22:20 | Antiperspirant | Açıklama "Kuru cilde." Alt adım: **Antiperspirant sür** ("Gece sürülünce daha iyi tutar"). Sıradaki: Diş bakımı, "bu akşam 1 / 4", "Sonra: Yüz · Telefonu bırak" |
| 2 | 22:21 | Diş bakımı | Sayaç "01:40". Alt adımlar 2 / 4: Ara fırça ya da ağız duşu (yapılmış), **Fırçala · 2 dk** ("Bitince kendiliğinden Dil'e geçer"), Dil. Sıradaki: Yüz, 2 / 4. Ana düğme "Erken geç · basılı tut" |
| 3 | 22:25 | Yüz | Açıklama "Lavaboda." Alt adımlar 1 / 2: **Nazik temizleyiciyle yıka** ("Günün güneş kremi ve teri"), Nemlendirici. Sıradaki: Telefonu bırak, 3 / 4 |
| 4 | 22:28 | Telefonu salona bırak (son adım) | Alt adımlar 1 / 2: **Şarja tak** ("Yatak odasının dışında"), Çalar saati kontrol et. Alt panelin etiketi "YARIN": "07:00 · uyku 8 sa", 4 / 4. Altta "Atla" ve "Hepsini yaptım" yok: ortalı "Işık kapalı." (15 px, ikincil renk, alt boşluk 8) ve tek düğme "Yatıyorum" (yükseklik 64, köşe 32, ana düğmenin akşam renkleri, 19 px 600); alt boşluk 34 |
| 5 | 22:30 | İyi geceler | Aşağıda |

**"İyi geceler" ekranı.** Şerit yok. Ortalanmış, yan boşluk 32. Başlık üstten 250: 44 px 600, -0.03em; altında 17 px `#c6cde8` "Işık kapalı." (aralık 12). 32 px sonra "YARIN" paneli (köşe 24, akşamın "Bu adımda" camı; etiket iç boşluğu `14 20 4`): "Uyanış" satırı (16 px `#dfe4f6`, sağda 22 px 600 tabular saat, altında `1px rgba(255,255,255,0.12)` çizgi), "Uyku" satırı (sağda 16 px 600 "yaklaşık 8 saat"). Altta, alttan 36: 13 px `#9aa5c8` "Yatış 22:30 kaydedildi. Ekran birazdan kararır." ve altı çizili "Geri al" (15 px 600, `#dfe4f6`, en az 44 yüksek, çizgi `rgba(255,255,255,0.35)`, 4 px aşağıda). Baykuşun gözleri kapalı.

## 5. Pano sahnesi

İki kare: "Pano · 07:02 Sabah sahnesi" ve "Pano · 22:21 Akşam sahnesi", ikisi de 1440 × 900. Düzen `rutin.md` 8.2 "Cihazlar"dadır; değerler bu iki karedendir. Sütunlarda sabah ve akşam; tek değer ikisinde ortaktır. Metin iki karede de `#f7f5ff`; ikincil renk sabah `#d2cfe3`, akşam `#c6cde8`.

**Zemin.** Geçişin durakları telefondan farklıdır (ufuk %80'de); renkler aynı saatin renkleridir:

- Sabah 07:02: `#060a1c 0%, #0c1230 24%, #171a45 44%, #292359 58%, #45305f 67%, #6f405f 73%, #a05a5b 77%, #c97d58 80%`
- Akşam: `#03050f 0%, #060a1f 24%, #0a1030 46%, #0f1840 62%, #16224f 74%, #1c2a5a 80%`
- Ufuk parıltısı tek elips: `left 300, top 610, 1000 × 160`, `blur(60px)`; sabah `rgba(255,160,104,0.38)`, akşam `rgba(96,124,210,0.22)`.
- Tepeler: bölüm 1'deki pano eğrileri (`viewBox 0 0 1440 900`). Sabah uzak `#5c3a5e`, orta `#2e2148`, yakın `#17112c → #07060f`; akşam uzak `#111a40`, orta `#0a102a`, yakın `#070a1b → #020309`. Sis şeridi yok.
- Yıldızlar (`#e8ecff`; `cx cy r`, sabah opaklığı; akşamda opaklık 1,5 katı):

```
70 90 1 0.50 · 160 150 0.8 0.40 · 260 70 1.2 0.60 · 380 130 0.8 0.35 · 470 60 0.9 0.45
560 170 0.7 0.30 · 690 90 1 0.50 · 780 150 0.8 0.35 · 900 70 0.9 0.45 · 980 96 0.8 0.40
1080 160 0.7 0.30 · 1180 70 1.1 0.55 · 1260 200 0.7 0.30 · 1320 120 0.8 0.40 · 1400 56 0.9 0.45
220 260 0.7 0.25 · 1150 300 0.7 0.25 · 620 300 0.6 0.20 · 40 330 0.7 0.25 · 1380 340 0.7 0.25
```

- Sabah yıldızı: `1180, 150`, `r 2.2`, `#fff6e6` (hale yok). Akşamda ay: merkez `1250, 610`, hale `r 96`, gövde `r 28` (bölüm 1'deki geçişler). Baykuş ve dal: bölüm 1'deki çizim `translate(250 96)` ile (gözler açık).

**Yan menü (görünür kalır).** Genişlik 190, kenar boşluğu `16 0 16 16`, iç boşluk `18 8`, köşe 26, `rgba(14,14,40,0.4)`, `blur(28px) saturate(180%)`, kenar `rgba(255,255,255,0.22)`, gölge `inset 0 1px 0 rgba(255,255,255,0.32), 0 14px 36px rgba(4,6,20,0.28)`, yazı 14 px. "Sherpa" (700), Bugün (seçili: `rgba(255,255,255,0.2)`, beyaz, 600), Hafta, Modüller, Gelen kutusu, Ayarlar; öğe iç boşluğu `10 12`, köşe 14.

**İçerik alanı.** İç boşluk `16 32 0`, dikey sıra: şerit, iki sütun, düğmeler.

- **Şerit:** telefondaki gibi kenardan kenara değil, cam hap: yükseklik 52, köşe 26, iç boşluk `0 12 0 22`, `rgba(10,12,34,0.34)`, `blur(24px) saturate(170%)`, kenar `rgba(255,255,255,0.18)`, gölge `inset 0 1px 0 rgba(255,255,255,0.28)`, yazı 14 px, aralık 12. İçerik aynı: saat, 8 px bölüm noktası, ad, "· n dk", sağda "Çık".
- **İki sütun:** `grid-template-columns: 5fr 4fr`, aralık 48, iç boşluk `40 16 0`.
- **Sol sütun** (aralık 10): başlık 52 px 700, -0.02em, satır 1.1; büyük sayaç 168 px 500, -0.045em, tabular; 14 px sonra "Bu adımda" paneli: en çok 480 geniş, iç boşluk `12 8 8`, köşe 26, yazı 17 px, satırlar arası 4. Satırlar telefondaki ölçülerle (42 ve 60 yüksek, 26 px çember); etkin satırın ikinci satırı 15 px `#ece9f6`.
- **Sağ sütun** (aralık 18), iki panel:
  1. Üst panel (iç boşluk `22 24`, köşe 28, aralık 12). Sabah: etiket "GÜNÜN PLANI OKUNUYOR" (12 px 600, 0.08em, `#ffe2ab`), sağında "Tekrar anlat" (14 px 500, en az 44 yüksek). Altında satırlar (17 px, satır 1.4, aralık 10): solda 64 px geniş ikincil renkte sütun, sağda metin: "10:30 · Derin Öğrenme dersi", "3 iş · Proje önerisi taslağı · İstatistik ödevi · Rapor: yöntem bölümü", "19:00 · Gün biter". Akşam: etiket "YARIN" (`#dfe4ff`), düğme yok; satırlar "07:00 · Uyanış", "8 sa · Uyku, yaklaşık", "10:30 · İlk sabit iş: Derin Öğrenme dersi".
  2. Dizi paneli (iç boşluk `16 10 10`, köşe 28, yazı 17 px). Baş satırı (yükseklik 28, iç boşluk `0 14`): "BU SABAH" / "BU AKŞAM" etiketi, sağda "1 / 7" / "2 / 4" (13 px). Her iş bir satır (yükseklik 44, iç boşluk `0 14`, aralık 12):
     - şimdiki: köşe 14, vurgu rengi %20 dolgu (`rgba(255,213,138,0.2)` / `rgba(170,182,255,0.2)`), `inset 0 1px 0 rgba(255,255,255,0.22)`, 600; 10 px dolu nokta vurgu renginde; sağda "şimdi" (14 px 500; sabah `#ffe2ab`, akşam `#dfe4ff`)
     - sıradaki: 10 px boş çember (`1.5px rgba(255,255,255,0.55)`, yan boşluk 2)
     - yapılan: opaklık 0.6, 14 px onay işareti (beyaz %20 daire, işaret kalınlığı 2.4)
     - sağdaki not (14 px, ikincil renk): başka modülün işinde modül ve süre ("Spor · 12 dk"), ek günü ("Dercos günü"), akşamın son adımında "sonra: Yatıyorum"
- **Paneller:** sabah `rgba(18,16,46,0.4)`, akşam `rgba(14,20,54,0.38)`; ikisinde `blur(28px) saturate(170%)`, kenar `rgba(255,255,255,0.26)`, gölge `inset 0 1px 0 rgba(255,255,255,0.38), 0 16px 40px rgba(8,6,24,0.3)`.
- **Düğmeler:** altta, sola yaslı tek sıra (aralık 12, iç boşluk `0 16 34`), üçü de 56 yüksek:
  - ana düğme: köşe 28, yatay iç boşluk 32. Karelerde süre dolmadan hali var: "Erken geç · basılı tut", 16 px 600, kenar `rgba(255,255,255,0.5)`, sabah `rgba(255,244,222,0.26)`, akşam `rgba(223,229,251,0.24)`, gölge `inset 0 1px 0 rgba(255,255,255,0.4)`. Dolu hali ("Sonraki", "Bitti", "Yatıyorum") panoda çizilmedi: bölüm 2'deki dolu ana düğmenin renkleriyle, bu ölçüde kurulur.
  - "Atla": köşe 28, yatay iç boşluk 28, `rgba(255,255,255,0.14)`, `blur(18px) saturate(160%)`, kenar `rgba(255,255,255,0.3)`, 17 px 500 (iki karede aynı)
  - "Hepsini yaptım": yalın metin, yatay iç boşluk 16, 15 px 500, `#e2ddef` (iki karede aynı)

Panoda çizilmeyen ekranlar (Günaydın, sayaçsız adım, son adım, "İyi günler", "İyi geceler") aynı parçalarla ve telefondaki içerikle kurulur; sayaçsız adımda büyük sayacın yerinde telefondaki açıklama satırı durur. Bunlar **görüşün gerek** diye işaretlenir.

## 6. Spor sahnesi (kare 4; Rutin'in işi değil)

Bağlam için: zemin `#040706`, iki yeşil bulanık leke (`#19e68c` ve `#0fb86e`), ince çapraz çizgiler `#3df2a0`; vurgu `#3df2a0`. Şerit "07:08 ● Spor · Boyun · 8 dk". Altta küçük hap: "Bu sabah 3 / 7 · sonra Duş" (dizideki yer başka modülün sahnesinde de görünür: `SceneProps.chain`). Spor modülü tasarlanırken kullanılır; Rutin'in 1. adımında dizideki başka modülün işi `deneme` ile denenir.

## 7. Geçişler ve davranış (karelerde yazanlar)

- Süreli alt adımda sayaç bitince kendiliğinden sıradaki alt adıma geçilir ve adı söylenir; süre dolmadan ana düğme "Erken geç · basılı tut"tur.
- Son adımda ana düğme sabah "Bitti", akşam "Yatıyorum"dur; alt panel "Sıradaki" yerine sabah "Sonra" (günün sıradaki işi), akşam "Yarın" (uyanış ve uyku) gösterir.
- "Bitti"den sonra "İyi günler", ardından 0,6 sn'lik solmayla Bugün; gökyüzü aynı kalır.
- "Yatıyorum"dan sonra "İyi geceler"; ekran birazdan kararır; "Geri al" vardır.

## 8. Modül sayfası

Kareler gündüz gökyüzünde çizildi. Metin `#f6f7ff`, ikincil `#d5dcf0`.

**Baş (telefon).** Geri oku (22 px, 36 × 44), 10 px modül noktası (`#ffd58a`), "Rutin" (26 px 700, -0.02em), sağda "Adım ekle" hapı (yükseklik 38, köşe 19, `rgba(255,255,255,0.14)`, kenar `rgba(255,255,255,0.3)`, 14 px 600). Altında 14 px satır: "Sağlık ›" (altı çizili bağlantı, alan sayfasına) · "bu hafta sabah 6/7" · "akşam 5/7".

**Sekmeler.** Cam hap (köşe 23, iç boşluk 4, `rgba(14,18,44,0.34)`, `blur(22px) saturate(170%)`, kenar `rgba(255,255,255,0.2)`): "Sabah", "Akşam" (yükseklik 36, köşe 19, 15 px; seçili `rgba(255,255,255,0.22)`, beyaz, 600). Aynı satırda ayrı "Düzenlilik" düğmesi (yükseklik 44, köşe 23, grafik simgesi; seçiliyken `rgba(246,247,255,0.92)` dolgu, `#10162e` metin ve o sırada hiçbir sekme seçili görünmez).

**Adım listesi.** Panel: köşe 24, `rgba(14,18,44,0.42)`, `blur(26px) saturate(170%)`, kenar `rgba(255,255,255,0.24)`, gölge `inset 0 1px 0 rgba(255,255,255,0.34), 0 14px 36px rgba(4,6,20,0.3)`.

- Blok başlığı (iç boşluk `12 14 6`): 9 px nokta, 12 px 600 etiket (0.08em), sağda 13 px özet. Sabah sekmesinde üç blok: "SABAH" ("uyanışta · toplam 4 dk"), "HAREKETLER" (nokta `#3df2a0`; "Spor modülü · toplam 12 dk"), "DUŞ VE HAZIRLIK" ("toplam 40 dk"). Akşam sekmesinde "AKŞAM KAPANIŞI" (nokta `#aab6ff`; "yatmadan önce · toplam 9 dk").
- Satır (en az 54 yüksek, iç boşluk `0 14`, alt çizgi `rgba(255,255,255,0.1)`): sıra no (24 px geniş, 14 px 600), ad (15 px 600), alt satır (13 px), varsa "temel" etiketi, sağda aç/kapa anahtarı. Satıra dokununca düzenleme açılır.
- Alt satır örnekleri: "3 dk · 4 alt adım · her gün", "1 dk · günün planı okunur", "10 dk · her gün", "12 dk · çıkarken", "1 dk · kuru cilde · her gün", "2 dk · 2 alt adım · düğme: Yatıyorum".
- "temel" etiketi: 12 px, iç boşluk `3 9`, köşe 10. Sabah: `rgba(255,213,138,0.2)` dolgu, `rgba(255,213,138,0.45)` kenar, `#ffe6b8`. Akşam: `rgba(170,182,255,0.2)`, `rgba(170,182,255,0.5)`, `#dfe4ff`.
- Anahtar: dokunma alanı 44 × 44; 42 × 24, köşe 12; açık `rgba(246,247,255,0.92)` ve koyu topuz `#10162e` (sağda); kapalı `rgba(255,255,255,0.18)` ve topuz `#d5dcf0` (solda).
- Ek adım: sol iç boşluk 30, sıra no yerine "+": "Dercos · duşun eki · 3 günde bir · sıradaki yarın". Kapalı faz adımı %60 opak: "Nasır kremi · 2 günde bir · faz 2 · kapalı", "Azelaik asit · yüzün eki · 2 günde bir · faz 2 · kapalı", "Yarının listesi · çekirdeğin kapanışına geçer · faz 2 · kapalı".
- Başka modülün işi: "Boyun hareketleri · Spor modülünden gelir, orada düzenlenir", anahtar yok, sağda "Spor ›".
- Akşam sekmesinin altında ayrı küçük panel (köşe 22, iç boşluk `14 18`): "YATAKTA · KAYDEDİLMEZ" ve `Işık kapalı. "Yatıyorum"dan sonraki ekranda hatırlatılır.`

**Aşağı kaydırınca (sekmelerin altında).** "YAKLAŞANLAR" paneli: satır başına nokta, ad (16 px 600), alt satır ("4 adım · 9 dk", "2 adım · 4 dk", "5 adım · 40 dk · Dercos günü"), sağda zaman ("bugün 22:20", "yarın uyanışta", "yarın"). Altında "BU HAFTA" paneli: "Sabah 6 gün, akşam 5 gün tamam. Ortalama sabah 52 dk."

**Adımı düzenle (telefon: alttan açılan sayfa).** Arkası `rgba(4,6,20,0.45)`. Sayfa: `left 8, right 8, bottom 8`, köşe 34, `rgba(14,18,44,0.62)`, `blur(34px) saturate(180%)`, kenar `rgba(255,255,255,0.26)`, gölge `inset 0 1px 0 rgba(255,255,255,0.36), 0 -10px 40px rgba(0,0,0,0.4)`, iç boşluk `10 14 18`, aralık 10. Sırayla:

1. Tutamak: 40 × 5, köşe 3, `rgba(255,255,255,0.4)`.
2. Baş satırı: "SABAH · ADIM 1" (12 px etiket), sağda "Adımı sil" (15 px 500, ikincil renk) ve "Vazgeç" (15 px 600).
3. Ad alanı: yükseklik 54, köşe 18, `rgba(255,255,255,0.1)`, kenar `rgba(255,255,255,0.3)`, 20 px 600.
4. Ayar grubu (köşe 20, `rgba(255,255,255,0.07)`, kenar `rgba(255,255,255,0.14)`; satır en az 50, etiket 15 px ikincil renk):
   - "Süre · otomatik": − ve + (32 px daire, `rgba(255,255,255,0.12)`), ortada "3 dk" (16 px 600, tabular)
   - "Sıklık": iki seçenekli hap, "Her gün" / "N günde bir" (seçili `rgba(246,247,255,0.92)`, `#10162e`, 600)
   - "Kaç günde bir" (yalnızca "N günde bir" seçiliyken): − "2 gün" +
   - "Şunun eki" (yalnızca ek adımda, en üstte): "Duş ›"
   - "Temel adım": anahtar
   - "Açık": anahtar
5. "ALT ADIMLAR" grubu: satır en az 46: sürükleme tutamağı (altı nokta), ad (15 px 500), sağda süre hapı ve çıkarma düğmesi (30 px daire, çarpı). Süre hapı: süresi yoksa kesik çizgili "süre ekle" (`rgba(255,255,255,0.06)`, `1px dashed rgba(255,255,255,0.3)`); varsa "2 dk · sayaç" ya da "25 sn" (`rgba(255,255,255,0.14)`, düz kenar). Sonda "+ Alt adım ekle" (15 px 600).
6. "Kaydet": yükseklik 56, köşe 28, `rgba(246,247,255,0.92)`, `#10162e`, 17 px 600.

**Alt adımın süresi (süre hapına dokununca; ortada pencere).** Arkası `rgba(4,6,20,0.4)`. Pencere: `left 28, right 28, top 300`, köşe 28, `rgba(20,26,58,0.78)`, `blur(34px) saturate(180%)`, kenar `rgba(255,255,255,0.3)`, gölge `inset 0 1px 0 rgba(255,255,255,0.4), 0 20px 50px rgba(0,0,0,0.5)`, iç boşluk `16 14`. Ad alanı (yükseklik 48, 18 px 600: "Fırçala"); grup: "Süre" (− "2 dk" +), "Sayaç göster" (anahtar), "Süre dolmadan geçme" (anahtar), "Not" ("Yumuşak fırça, bastırmadan ›"). Açıklama (13 px): "Süre bitince kendiliğinden sıradakine geçer ve adını söyler. Erken geçmek için düğmeye basılı tutarsın." Altta iki düğme (yükseklik 50, köşe 25): "Süreyi kaldır" (ikincil), "Tamam" (dolu).

**Adım ekle.** Aynı sayfa, boş: ad alanı; grup: "Nereye" (üç seçenekli hap: Sabah / Hazırlık / Akşam), "Sırası" ("Sona ›"), "Süre · otomatik" (1 dk), "Sıklık", "Temel adım" (kapalı), "Açık" (açık); "ALT ADIMLAR" (yalnızca "+ Alt adım ekle"); düğme "Ekle".

**Adımı sil onayı.** Pencere (`top 330`, aynı cam, iç boşluk `22 18 16`): "Diş bakımı silinsin mi?" (19 px 600); "Geçmiş kayıtlar kalır. Yalnızca bir süre yapmayacaksan kapatman yeterli." (15 px); iki düğme: "Kapat" (ikincil; adımı kapatır) ve "Sil" (dolu); altında "Vazgeç" (yalın metin, yükseklik 44).

**Pano.** Solda ana menü camı (genişlik 190, köşe 26: Sherpa, Bugün, Hafta, Modüller (seçili), Gelen kutusu, Ayarlar). İçerik iç boşluğu `30 48`, aralık 20:

1. Baş: 12 px nokta, "Rutin" (26 px 700), "Sağlık · günün açılışı ve kapanışı" (16 px), sağda "Adım ekle" (yükseklik 44).
2. Özet şeridi (köşe 24, iç boşluk `18 28`, aralık 44): "Sabah (7 gün) 6 gün", "Akşam (7 gün) 5 gün", "Ort. uyanış 07:12", "Ort. yatış 22:41", "Ort. uyku 7 sa 50 dk" (etiket 13 px, değer 22 px 600).
3. Sekme hapı (sekme iç boşluğu `0 30`, yükseklik 38) solda, "Düzenlilik" (yükseklik 46) sağda.
4. İki sütun (`3fr 2fr`, aralık 20): solda adım listesi (köşe 28; satır en az 58, ad 16 px, alt satır 14 px, ek adımda sol iç boşluk 40); sağda "YAKLAŞANLAR" ve "SON 14 GÜN · TEMEL ADIMLAR" (iki satır, 14 kare; kare 19 × 19, köşe 5, aralık 6; dolu Sabah `#ffd58a`, Akşam `#aab6ff`; boş `rgba(255,255,255,0.12)`; altında "Dolu: o günün temel adımları yapıldı. Boş gün gri kalır.").
5. Adımı düzenle: sağdan açılan yan panel (`right 16, top 16, bottom 16`, genişlik 440, köşe 30, telefondaki sayfanın camı ve içeriği; tutamak yok; "Kaydet" en altta), arkası `rgba(4,6,20,0.4)`.

## 9. Düzenlilik (2. adım)

Telefon, üstten alta paneller (köşe 24, liste panelinin camı, iç boşluk 16):

1. "UYANIŞ VE YATIŞ · 14 GÜN": 326 × 190 çizim. Üstte uyanış şeridi (`x34 y21 w286 h45`, köşe 8, beyaz %9; eksen 06:00–08:00), altta yatış şeridi (`y117`; 22:00–24:00); günler 20,5 px arayla, nokta `r 4.5`: uyanış `#ffd58a`, yatış `#aab6ff`; kaydı olmayan gün boş; aralığın dışındaki nokta şeridin dışına taşar. Eksen yazıları 11 px; altta "2 hafta önce" ve "bugün". Altında üç değer: "Ort. uyanış", "Ort. yatış", "Ort. uyku" (etiket 12 px, değer 18 px 600).
2. "TEMEL ADIMLAR · 14 GÜN": Sabah ve Akşam satırı, 14 kare (14 × 14, köşe 5, aralık 3,5); "Dolu: o günün temel adımları yapıldı."
3. "EN AZ YAPILANLAR · 14 GÜN": satırlar (en az 40): "Yürüyüş · 10 sabahın 3'ü ›", "Yüz · 9 akşamın 6'sı ›", "Bir bardak su · 10 sabahın 8'i ›".
4. "DEĞİŞENLER": "Duş artık planda 14 dk (10 dk idi); senin ortalamana göre ayarlandı." ve "Nasır kremi açılabilir: temel adımlar son 7 günün 6'sında yapıldı." yanında "Aç" düğmesi (yükseklik 36, köşe 18).

Pano: solda büyük grafik (700 × 330; şeritler `x46 w648 h74`, noktalar `r 6`, noktaları birleştiren ince çizgi %35 opak; altında "Açık şeritler ayardaki aralıklar: uyanış 06:00–08:00, yatış 22:00–24:00. Uyku hedefi 8 sa."), sağda üç panel: temel adım kareleri, "En az yapılanlar", "Değişenler".

## 10. Çekirdek ekranları (Rutin'in işi değil; Ç4 ve Rutin 3. adım için)

**Bugün (cam).** Baş: "Bugün" (26 px 700), "Cuma 13 Kasım · 08:05"; altında "Bugün 0/3 · bitiş 19:00" ve sağda mod hapı ("Normal"). "ŞİMDİ" kartı (köşe 28, iç boşluk 20, liste panelinin camı): modül noktası ve "Okul · Derin Öğrenme", başlık (30 px 700), "90 dk", "Başla" (yükseklik 54, köşe 27, dolu) ve "Ertele". Sıradakiler paneli (köşe 24). Zaman çizelgesi (yükseklik 88): saat etiketleri 11 px; şerit yükseklik 40, köşe 12, cam; sabit blok beyaz %24 ve iki yanında 2 px çizgi; işler modül renginde (biten iş %40 dolgu ve kenar; biten sabah rutini `rgba(255,213,138,0.4)`); bitişten sonrası `rgba(4,6,20,0.3)`; "şimdi" çizgisi beyaz, 2 px, parlamalı, altında beyaz hap "şimdi 08:05"; "bitiş 19:00" kesik çizgi. Gece: "ŞİMDİ" kartında "Rutin · Akşam · Akşam kapanışı · 10 dk · 22:20 · yatış 22:30"; altında "Bugünün işleri bitti" paneli.

**Alt menü (telefon).** `left 16, right 16, bottom 22`: cam hap (yükseklik 62, köşe 31, `rgba(14,18,44,0.46)`, `blur(28px) saturate(180%)`, kenar `rgba(255,255,255,0.26)`), beş öğe (Bugün, Hafta, Modüller, Gelen, Ayarlar; 20 px simge, 11 px yazı) ve yanında ayrı 62 px daire "+" (aynı cam). Seçili sayfa göstergesi için üç seçenek çizildi; **C uygulandı**: seçili öğe dolu cam (`rgba(246,247,255,0.92)`, `#10162e`, köşe 25, `flex: 1.55`), "+" düğmesi cam.

**Modüller (çekirdek için öneri).** Alanlara göre gruplar: her grup bir panel; başında alanın adı (12 px etiket), özet ("uyku 7 sa 50 dk · sabah 6/7") ve "Alan sayfası ›" hapı; altında modül satırları (nokta, ad, özet, "›"); tasarlanmamış modül %55 opak ve "tasarlanacak" (Spor, Beslenme).
