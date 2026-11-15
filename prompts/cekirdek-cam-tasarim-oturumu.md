# Çekirdek ekranlarının cam tasarımı (tasarım oturumu)

Sherpa Claude projesinde yeni bir sohbet aç ve yalnızca şunu yaz:

> Çekirdek ekranlarının cam tasarımını yapalım. `prompts/cekirdek-cam-tasarim-oturumu.md` dosyasını oku ve izle.

Bu bir tasarım oturumudur: kod yazılmaz. Çıktı, kullanıcının kare kare onayladığı çizimler ve `docs/13-cam-dili.md` dosyasıdır. Kurulum ondan sonra ayrı bir Claude Code fazında yapılır; istemini ilerleme sohbeti yazar.

---

## Neden

Kullanıcının kararı (14 Kas 2026, `docs/09-kararlar.md`): uygulamanın bütün ekranları tek görsel dildedir, cam paneller ve günün saatini izleyen gökyüzü. Bugün bu dil yalnızca Rutin'in sabah ve akşam sahnesinde kurulu; çekirdeğin bütün ekranları ve modül sayfaları eski görünüşte ve kullanıcı onları beğenmiyor. Rutin 1'de görüldü: çizilmemiş ekranda Claude Code yorum yapıyor ve düzeltme turu gerekiyor. Bu yüzden kurulumdan önce kalan bütün ekranlar çizilir.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md` (14 Kas satırları ve "Fikirler"deki cam dili ile zaman çizelgesi maddeleri)
- `docs/moduller/ORTAK.md` (tamamı; görsel dil, sahne, modül sayfası, dil kuralları: yeniden tartışılmaz, üzerine kurulur)
- `docs/05-arayuz.md` (tamamı: her ekranın bugünkü içeriği ve durumları; içerik ve davranış değişmez, görünüş değişir)
- `docs/01-urun.md` (ürün ilkeleri), `docs/11-yayin-ve-cihazlar.md` (pano gün boyu açık, telefon ana ekrandan)
- `docs/moduller/rutin-cizimler/degerler.md` (cam, gökyüzü, alt menü, Bugün ve modül sayfasının çizilmiş değerleri)
- Ekranların bugünkü hali: `docs/ekran-goruntuleri/c3g/` (pano ve telefon; hangi ekranların ve durumların var olduğunun dökümü buradadır)
- Tuval: https://claude.ai/artifact/MFJJaUCrnk3P6ZMSa6bH7k ("Sherpa · Rutin modülü ekranları"). Dört sayfası var; hepsi geçerlidir:
  - "Cam dili": Bugün ekranının cam hali, telefon ("Cam · Bugün (telefon)") ve pano ("Cam · Bugün (pano)"); Spor zemini konsepti. Bu sayfadaki sahne kareleri (Günaydın, Diş, son adım, Yatıyorum, pano sahnesi) ilk taslaklardır; sahnenin geçerli hali uçtan uca sayfalarındadır.
  - "Sabah · uçtan uca", "Akşam · uçtan uca": sahne (kurulu) ve aynı gökyüzünde Bugün (sabah 08:05, gece 22:05).
  - "Modül sayfası": Rutin'in modül sayfası (telefon ve pano, düzenleme pencereleri), alt menü (C seçeneği uygulandı), Modüller listesi (telefon).
  - Kullanıcı eski "Yapı" ve "Görsel yönler" sayfalarını sildi; oradaki denemeler hiçbir yerde kullanılmaz.

## Çizili olanlar (yeniden çizilmez; tutarlılık için bakılır, kullanıcı isterse düzeltilir)

Bugün telefon (sabah, gece) ve pano; alt menü ve yan menü; Modüller listesi (telefon); modül sayfası (telefon ve pano; adım düzenleme, alt adım süresi, ekleme, silme onayı, Düzenlilik); sahne (telefon ve pano).

## Çizilecekler

Her ekran telefon (390 × 844) ve pano (1440 × 900) için, `docs/05`'teki her durumuyla çizilir. Önce döküm çıkar (`docs/05` ve `c3g` ekran görüntülerinden), kullanıcıya göster, eksik ya da fazla var mı sor; sonra gruplar halinde çiz. Beklenen gruplar:

1. **Bugün'ün durumları.** Şimdi kartının bütün halleri (öneri, çalışan oturum, sahnesi olmayan iş, "Devam ediyor musun?", boş gün), Sıradakiler ve "Vakit kalırsa", dizi satırı, bölümler, mod ve bağlam seçici, "Neden?" ve yapay zeka gerekçesi, "X dakikam var", uyarılar. Günün çerçevesi kartları: Günaydın ("Uyandım", "Biraz önce"), akşam kartı ("Sırada: Akşam kapanışı", "Şimdi başla"), gece kartı, "Saat 19:30. Şimdi yatıyor musun?" sorusu. Panoda Bugün'ün güncel hali ("Cam dili" sayfasındaki kare Ç3c–Ç3g'den önce çizildi; eksiklerini tamamla).
2. **Zaman çizelgesi.** Kullanıcının eleştirisi (14 Kas, `docs/09` "Fikirler"): hangi saatin nerede olduğu anlaşılmıyor. Yeni hali burada çizilir ve onaylanır; birkaç seçenek göster.
3. **Hafta.** Günler, uyku satırı, zaman kısıtları, yapay zekanın notları.
4. **Gelen kutusu.**
5. **Giriş ve düzenleme.** Hızlı giriş, iş formu ve "Zaman" bölümü, düzenleme penceresi, yapay zekanın önerdiği düzenleme, onay pencereleri, bildirim (toast).
6. **Akşam kapanışı.** Bugün ve yarın adımları; ayrı ekran olarak ve sahnenin içinde açılan hali.
7. **Modüller ve modül sayfası iskeleti.** Modüller listesi (pano), Rutin dışındaki modüller için genel iskelet (`deneme` ve Okul örnekleriyle: sekmeler, tablo, kayıt, tam ekran görünüm), standart sahne (kendi sahnesi olmayan işin çalışırken görünüşü) ve sahne şeridi.
8. **Ayarlar.** Ana sayfa ve her bölümü: sabit bloklar, günün çerçevesi, uyanış ve yatış kayıtları, bağlantılar, modüller ve modül ayarı, renkler, sesli anlatım, yapay zeka.
9. **Giriş ekranları.** E-posta, kod, reddedildi.
10. **Boş ve hata durumları.** Bağlantı yok, yükleniyor, veri yok.

## Bu oturumda verilecek kararlar

Her biri için seçenekleri çizerek göster, kullanıcının kararını al, gerekçesiyle yaz:

- **Açık tema.** Cam dili koyu cam ve açık metindir. Bugünkü açık/koyu/sistem tema seçeneği ne olacak: kalkar mı, açık tema yalnızca gökyüzü olmayan ekranlarda mı kalır?
- **Gökyüzü hangi ekranlarda.** Bugün ve sahne dışında (Ayarlar, Hafta, formlar) zemin gökyüzü mü, sakin düz bir zemin mi? Uzun kaydırılan sayfada manzara nerede durur?
- **Pano gün boyu açık.** Bulanıklığın yükü, gece parlaklığı, hareket (bulut, yıldız) ve "saydamlığı azalt" ile "hareketi azalt" tercihlerindeki görünüş.
- **Modüle özel zemin.** Modül sayfasında zemin modülün mü (Spor: siyah-yeşil), ortak gökyüzü mü; geçiş nasıl olur?
- **Yoğun ekranlar.** Tablo, uzun liste ve form camda nasıl okunur (satır yüksekliği, ayırıcı, en az yazı boyu)? Panoda masadan okunacak yazı boyları.

## Nasıl çalışacaksın

1. **Döküm ve kararlar.** Ekran ve durum dökümünü çıkar; yukarıdaki kararları sırayla aldır. Onay almadan çizime geçme.
2. **Ortak parçalar.** Önce bir kez: panel, liste satırı, düğme türleri, alan (input), anahtar, hap, sekme, pencere, alttan açılan sayfa, bildirim; koyu ton değerleri `degerler.md`'den, eksik olanlar bu oturumda. Kullanıcı onaylar.
3. **Gruplar.** Yukarıdaki sırayla, her grup ayrı sayfa. Her grupta kullanıcının onayını al; değişiklik isterse düzelt ve yeniden göster.
4. **Akışlar.** Bir akışın her adımını ve açılan her pencereyi göster (`ORTAK.md` bölüm 8); "burada da aynısı" deyip geçme.
5. **Çizimler tarayıcıda çizilip bakılarak** yayınlanır; bakılmadan yayınlanan kare "denenmedi" diye belirtilir. Metin ile zemin arasında en az 4,5:1.
6. Çizimleri yeni bir tuvale koy ("Sherpa · Çekirdek ekranları"); Rutin tuvaline dokunma. Geçersiz kalan kareyi tuvalde bırakma: sil ya da yerine yenisini koy.

## Kurallar

- İçerik ve davranış `docs/05`'teki gibidir; yeni özellik ekleme. Aklına geleni "Fikirler"e yaz. Bir ekranın içeriğini değiştirmek gerekiyorsa (zaman çizelgesi gibi) ayrı karar olarak aldır.
- Ürün ilkeleri: sakin, tek odaklı; oyunlaştırma yok; her giriş en fazla iki dokunuş ya da tek cümle.
- Renk tek başına anlam taşımaz; dokunma alanı en az 44 px; panoda ana bilgi masadan okunur.
- Varsayımla boşluk doldurma; emin olmadığını sor. Türkçe yaz.
- Kod yazma; Claude Code'a istem de yazma (onu ilerleme sohbeti yazar).

## Çıktı

1. Onaylı tuval: her ekran ve durum, telefon ve pano.
2. `docs/13-cam-dili.md`: tuvalin bağlantısı ve geçerli sayfaları; ortak parçaların tanımı; her ekranın düzeni ve durumları (çizim adıyla); alınan kararlar; çizilmeyen ve bilerek dışarıda bırakılanlar; gerçek cihazda bakılacaklar.
3. `docs/moduller/ORTAK.md` (bölüm 2 ve 4) ve `docs/09-kararlar.md` güncel; `docs/05`'in "Tasarım yönü" bölümü yeni dile göre düzeltilmiş.
4. Kapanış: alınan kararlar, güncellenen dosyalar, açık kalan sorular. Sonra kullanıcı ilerleme sohbetine döner; değerler depoya alınır ve kurulum fazının istemi yazılır.
