# Rutin, 1. adım: Temel

Claude Code'a yalnızca şunu yaz:

> `prompts/rutin-1-temel.md` dosyasını oku ve uygula.

Ön koşul: `c3f-tamam` etiketi ve Ç3f yayını (`docs/ILERLEME.md`).

---

## Görev

Rutin modülünün 1. kurulum adımını kur. Tasarım `docs/moduller/rutin.md` (onaylı, 14 Kas 2026); kapsam ve kabul ölçütleri aynı dosyada, "Kurulum adımları ve kabul ölçütleri" → "Adım 1 · Temel". Bu oturumda yalnızca bu adım yapılır; 2. ve 3. adıma girme, bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Tek fark: bu bir modül oturumudur; BASLA'daki "Modül hattına girme" cümlesi burada geçerli değildir, yalnızca Rutin kurulur. Adımın adı "Rutin 1", etiket `rutin-1-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/rutin-1/`.

Rutin üretimde açılacak ilk gerçek modüldür: kullanıcı onu her sabah ve akşam telefonunda kullanacak.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md` (Rutin ve Ç3f satırları)
- `docs/moduller/rutin.md` (tamamı; bağlayıcı tasarım) ve `docs/moduller/ORTAK.md`
- `docs/06-modul-sozlesmesi.md` (tamamı: kayıt, iş zarfı, `timing`, bölümler, sahne, `controls`, diziler, `ctx.days`, olaylar)
- `docs/12-sahne-ve-otomasyon.md`: bölüm A, C, D, F, G
- `docs/04-planlayici.md`: "Günün çerçevesi", "Öğrenme"
- `docs/05-arayuz.md`: Bugün, sahne, modül sayfası, Ayarlar → Modüller
- `src/modules/_sablon/` ve `src/modules/deneme/` (sözleşmenin çalışan örnekleri; Ç3f'in dizi, kapanış ve yatış örnekleri `deneme`'dedir)
- Çizimler: `docs/moduller/rutin-cizimler/degerler.md` (tamamı). Tasarım tuvalinin güncel üç sayfasındaki bütün karelerden birebir alınmış değerler ve içerik: gökyüzünün saate göre durakları, tepe eğrileri, güneş, ay, yıldızlar, baykuş, sahnenin telefondaki ve panodaki camı ve düzeni, sabah ve akşamın kare kare içeriği, "İyi günler" ve "İyi geceler", modül sayfasının alanları ve metinleri. Sahneyi ve akışları bu dosyadaki değerlerle kur; dosyanın başında hangi bölümün hangi kurulum adımına ait olduğu yazar. Tuvalin claude.ai bağlantısını açmaya çalışma; giriş ister. Dosyada olmayan bir değer gerekirse en yakın kareden türet ve "görüşün gerek" diye işaretle.

## İlk iş

1. `docs/ILERLEME.md`'de Durum'u "Rutin 1. adım sürüyor" yap ve kısa planı yaz.
2. Çalışma ağacında commit edilmemiş tasarım dokümanı ya da çizim varsa (`docs/07`, `docs/09`, `docs/moduller/`, `prompts/`) ilk commit'e kat.
3. Modülü `_sablon`'u kopyalayarak `src/modules/rutin/` altında aç ve kayıt defterine ekle.

## Çekirdek sınırı

Modül çekirdeğe yalnızca sözleşme üzerinden bağlanır; `src/core/` modülü içe aktarmaz, Rutin başka modülü tanımaz. Çekirdeğe yalnızca aşağıdaki ilk maddede dokunulur. Başka bir çekirdek eksiği çıkarsa kendin çözme: modülde çalışan en küçük haliyle bırak, `rutin.md` "Çekirdek için notlar"a ekle, raporda say ve devam et; durma.

- **Yatışın geri alınması (çekirdek notu 15).** 14 Kas'ta bakıldı: `SceneProps.controls` içinde yalnızca `bed()` var, yatışı geri alan yol yok. Kabul ölçütü 5'teki "durur ve sorar" yerine şu karar geçerlidir (teknik karar; kullanıcının "teknik kararlarda Claude'un önerisi" kuralıyla Sherpa projesinin sohbetinde verildi, 14 Kas 2026): sözleşmeye yatışı geri alan genel bir yol ekle.
  - Yalnızca aynı oturumun `bed()` ile yazdığı yatışı ve yalnızca kısa bir süre içinde geri alır (10 dakika; kullanıcı onayladı, 14 Kas 2026). Süre geçtiyse ya da gün başka yoldan kapandıysa hiçbir şey değiştirmez ve bunu bildirir.
  - Geri alınınca yatış hiç yazılmamış gibi olur: yatışa bağlı her şey (uyku planı, ertesi günün beklenen uyanışı, yatışın tetiklediği plan yenilemesi) yeniden hesaplanır.
  - Ritim yeniden çalışır hale gelir ve sahne son adımda açılır; bunun yolunu (oturumu yeniden açmak ya da yenisini başlatmak) sen seç.
  - İki cihaz aynı anda geri alırsa tek sonuç olur.
  - `docs/06`, gerekiyorsa `docs/03`, ve `docs/09` aynı commit'te güncellenir; veritabanı testi yazılır; denetçi (adım kipi) çağrılır; `deneme`'nin gece sahnesine bir örnek konur.
- **Cam ve gökyüzü (çekirdek notu 14):** modülün içinde kalır; çekirdeğe ortak bileşen olarak taşınmaz (o iş Ç4'te ve Rutin 3. adımda).
- **Yapılmayan sabahın gün içinde düşmesi (çekirdek notu 13, simülasyon B2):** ölçüt 11'deki gibi yalnızca dene ve sonucu yaz; modülde çözme.

## Önerilen sıra

1. **Veri.** Dört tablo, RLS, kayıt (`rutin_runs`, `rutin_run_steps`, geçen süre dahil); modül etkinleştirilince yazılan başlangıç listesi (8.1); önce veritabanı testleri (ölçüt 7 dahil). Denetçi (adım kipi).
2. **Teklifler.** Üç ritim, bölümler (Sabah, Akşam), çapa ve dizi sırası; `every_days` (ölçüt 6: saf fonksiyon, şimdiki zaman parametre). Ölçüt 1.
3. **Sahne.** Adım ekranı, alt adımlar, süreli alt adım (ölçüt 3: basılı tutma, yenilemede doğru yerden süren sayaç), Günaydın, "İyi günler", cam ve gökyüzü, hareket ve saydamlık azaltma, ölçülen karşıtlık (ölçüt 10). Ölçüt 2 ve 4.
4. **Akşam ve yatış.** "Yatıyorum", "İyi geceler", geri alma (yukarıdaki çekirdek maddesi). Ölçüt 5. Denetçi (adım kipi).
5. **İki cihaz ve ses.** Eşzamanlı ilerleme (ölçüt 9); günün özetinin sesli ve yazılı hali, yalnızca dokunulan cihazda okunur.
6. **Modül sayfası.** Sabah ve Akşam sekmeleri; adım düzenleme, ekleme, sıralama, kapatma, silme; her değişiklikten sonra ritmin süresinin yeniden teklifi (ölçüt 8).
7. **Kapanış.** Ölçüt 11 denemesi, uçtan uca testler, ekran görüntüleri (şafak, gündüz, gece; pano ve telefon), `check:full`, faz denetimi, rapor, `rutin-1-tamam`, yayın.

## Bu adıma özel kurallar

- **Adımlar veridir.** Adım, ürün ve alt adım adları kodda yazılı olmaz; başlangıç listesi yalnızca ilk etkinleştirmede yazılır, kullanıcının sonradan yaptığı değişikliğin üzerine yazılmaz.
- **Ürün ilkeleri** (`docs/01-urun.md`): seri, puan, rozet yok; her giriş en fazla iki dokunuş.
- **`deneme` ile birlikte.** Geliştirmede `deneme` açık kalır ve ölçüt 2'deki gibi onunla birlikte denenir; Rutin tek başınayken de her şey çalışır. Üretimde `deneme` kapalıdır.
- **Önceki fazların testleri** değiştirilmeden geçer.
- **Saat.** Uçtan uca testler İstanbul saatiyle 22:30–24:00 arasında başlamaz (Ç4'te düzelecek); kapanışı buna göre planla.
- **Görüşün gerek:** tasarımda yazmayan metin, görünüş ve varsayılanlar.

## Yayın

Önceki fazlardaki sıra: migration'lar önce `sherpa-dev`, sonra `sherpa-prod`, sonra `git push origin main` ve etiket. Kullanıcı başındaysa izni bu sohbette iste; gözetimsizsen `prod`'a ve `git push`'a dokunma, "Senden bekleyenler"e yaz. Yayından sonra "Senden bekleyenler"e şunları adım adım yaz: üretimde Ayarlar → Modüller'den Rutin'i açmak, teklif edilen üç ritmi kabul etmek, ölçüt 12'nin gerçek telefon denemeleri.

## Kapsam dışı

- 2. adım: Kestirmeler bağlantısı, Düzenlilik, sürelerin öğrenilmesi, akşam hatırlatması
- 3. adım: çekirdeğin cam diline bağlanma, faz 2, "Yarının listesi"
- Spor modülü ve boyun hareketleri (dizide başka modülün işi yalnızca `deneme` ile denenir)

## Sonunda

Rapor (`BASLA.md` madde 10) ve ek olarak: sözleşmede eksik ya da zor bulduğun yerler, `rutin.md` "Çekirdek için notlar"ın güncel hali. "Sıradaki adım": Ç4 (`prompts/BASLA.md`); Rutin 2. adım tasarıma göre iki hafta beklemeden de kurulabilir, sırasını kullanıcı belirler.
