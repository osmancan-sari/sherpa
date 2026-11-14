# Ç3g: Sahnenin çekirdek eksikleri

Claude Code'a yalnızca şunu yaz:

> `prompts/c3g-sahne-eksikleri.md` dosyasını oku ve uygula.

Ön koşul: `rutin-1-tamam` etiketi.

---

## Görev

Rutin'in 1. kurulum adımında sözleşmede eksik bulunan altı noktayı çekirdekte kapat ve Rutin'i bunlara bağla. Kaynak: `docs/moduller/rutin.md`, "Çekirdek için notlar" 16–21. Bu oturumda yalnızca bu yapılır; bitince dur. Ç4'ün görsel işi (cam dili, gökyüzünün çekirdek ekranlarına taşınması) bu fazın kapsamında değildir.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı Ç3g, etiket `c3g-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c3g/`. İlk iş: bu fazı `docs/07-yol-haritasi.md` ve `docs/ILERLEME.md`'ye yaz (Ç3f ile Ç4 arasında), çalışma ağacındaki commit edilmemiş dosyaları (bu istem dahil) ilk commit'e kat.

Neden: kullanıcı Rutin'i her sabah ve akşam kullanıyor; bu eksikler yüzünden modül çekirdeğin kurallarını kopyalıyor, şerit tasarımdaki gibi kurulamıyor ve bazı bilgiler ekrana yanlış ya da hiç gelmiyor. Her şey genel kurulur: hiçbir şey Rutin'e özel olmaz, örnekleri `deneme` modülündedir; `src/core/` hiçbir modülü içe aktarmaz.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md` (Rutin 1 raporu ve "Verdiğim kararlar"ın Rutin satırları)
- `docs/moduller/rutin.md`: 8.2–8.4 ve "Çekirdek için notlar" 16–21; `docs/moduller/rutin-cizimler/degerler.md` bölüm 2–4 ve 7
- `docs/06-modul-sozlesmesi.md`: "Sahne", "Diziler", "Olaylar", `TodayBrief`, `ctx`
- `docs/12-sahne-ve-otomasyon.md`: bölüm A, B, D, G
- `src/modules/rutin/` (özellikle `server/flow.ts`, `components/RutinScene.tsx`) ve `src/modules/deneme/`

## Yapılacaklar

Her madde için: sözleşmeyi (`docs/06`, gerekiyorsa `docs/03`, `docs/05`) ve `docs/09`'u aynı commit'te güncelle, testini yaz, `deneme`'ye örneğini koy, Rutin'i yeni yola bağla ve Rutin'deki geçici çözümü kaldır.

1. **Planlama günü (not 16).** Sahneye ve oturum olaylarına çekirdeğin planlama günü gelsin (`TodayBrief.date` ve oturum olaylarının yükünde gün; adını sen seç). Rutin `runDay` içindeki kopya kuralı bırakır; gece yarısından sonraki "Yatıyorum" testi (Rutin 1, ölçüt 7) geçmeye devam eder.
2. **Şeridin içeriği ve görünürlüğü (not 17).** Sahne şeritte gösterilecek adı ve sürenin başlangıcını verebilsin, şeridi belirli ekranlarda gizleyebilsin. Vermezse şerit bugünkü gibi davranır. Rutin: sabahın bütün karelerinde "Sabah" ve uyanıştan beri geçen süre, akşamda "Akşam kapanışı" ve ilk adımdan beri geçen süre; "İyi günler" ve "İyi geceler"de şerit yok. Günaydın'da şerit vardır, süre yazmaz (`degerler.md` bölüm 3, kare 1).
3. **Tuşlar (not 18).** Sahne, çekirdeğin Bugün tuşlarını (Boşluk ve öbürleri) devraldığını sözleşmeyle bildirebilsin; bildirmezse bugünkü davranış. Rutin `window`'daki yakalamayı bırakır; Boşluk "Sonraki" olur, süre dolmadan geçirmez.
4. **Modül sayfasında dizi (not 19).** Modül sayfası o günün uyanış ve yatış dizilerini salt okunur alsın (sahnedeki `SceneChain` ile aynı alanlar; başka modülün satırında yalnızca izinli alanlar). Rutin'in Sabah sekmesi başka modülün işini kendi grubu olarak, anahtarsız ve o modülün sayfasına bağlantıyla gösterir (`degerler.md` bölüm 8: "Boyun hareketleri · Spor modülünden gelir, orada düzenlenir"). Gerçek Spor yok; `deneme` ile denenir.
5. **Yarının beklenen uyanışı (not 20).** `TodayBrief`'e yarının beklenen uyanışı ve beklenen uyku süresi gelsin: planlayıcının çerçevesindeki, gerçek yatışla kaydırılmış değer. Yoksa `null`. Rutin'in "Yarın" kutuları (son adım, "İyi geceler", pano) bunu gösterir; yatış yazılınca ve geri alınınca değer yenilenir.
6. **Uyanışın kaynağı (not 21).** Sahne uyanışın nereden geldiğini bilsin (ekrandaki dokunuş, dışarıdan `core/wake`, tahmin). Ç3f'te bu ayrım bir sütun olmadan türetiliyordu; gerekiyorsa şimdi sakla (migration yalnızca ekleme). Rutin "son 15 dakikada dokunulmadı" kuralını bırakır: Günaydın yalnızca uyanış dışarıdan geldiğinde görünür (Rutin 1, ölçüt 5'in tam hali).

## İlk gerçek kullanımda görülenler (14 Kas 2026 akşamı; bu fazın işi)

Kullanıcı Rutin'i üretimde 18:50 civarında etkinleştirdi. Bugün ekranında önce sabah rutini çıktı; ilerletip bitirdi. Sonra akşam kapanışı çıktı; onu da ilerletti ve "Yatıyorum"a bastı. Yatış aralığı 22:00–24:00'tü; "Geri al"ın süresi geçti. Ne olduğunu tam hatırlamıyor; bu yüzden önce üretim verisine **yalnızca okuyarak** bak (bugünün gün kaydı, uyanış ve yatış, oturumlar, `rutin_runs`, plan) ve gördüğünü rapora yaz. Sonra şunları kapat; hepsi genel kurulur, testleri yazılır:

1. **Akşam saatinde sabah işi önerilmemeli.** Uyanışa bağlı iş, o gün uyanış kaydı olmasa da (modül gün ortasında açıldı, kullanıcı "Uyandım"a hiç basmadı) günün ilerleyen saatinde önerilmez. Rutin 1'in 11. ölçütü "yapılmayan sabah öğleden sonra düşüyor" diyordu; bu durumda neden düşmediğini bul. Modül etkinleştirildiği gün, saati geçmiş çapalı işler o gün için teklif edilmez.
2. **Yatışa bağlı iş yatıştan saatler önce önerilmemeli.** Akşam kapanışı planlanan yatıştan kısa süre önce (işin süresi ve küçük bir pay) "Şimdi"ye gelir; 18:50'de neden öndeydi, bul ve düzelt. Kullanıcı erken başlatmak isterse listeden başlatabilir.
3. **Aralığın çok dışında "Yatıyorum".** Yatış aralığının başlangıcından epey önce basılan "Yatıyorum" (öneri: 2 saatten fazla) tek dokunuşla günü kapatmaz; kısa bir onay sorar ("Saat 18:50. Şimdi yatıyor musun?"). Aralığın içinde ve yakınında bugünkü gibi tek dokunuş. Çekirdekte, `bed()` yolunda; `docs/05`, `docs/06`. **Görüşün gerek** (eşik ve metin).
4. **Yanlış yazılmış uyanış ve yatış düzeltilebilmeli.** "Geri al"ın süresi geçtikten sonra da kullanıcı bugünün (ve dünün) uyanış ve yatış kaydını düzeltebilsin ya da silebilsin (Bugün'ün günün çerçevesi kartından ya da Ayarlar'dan; yerini sen seç). Düzeltilince ona bağlı her şey yeniden hesaplanır. Böyle bir yol zaten varsa nerede olduğunu rapora yaz ve bulunmasını kolaylaştır.

Bunlar bitince, yayından sonra ve **kullanıcının bu sohbetteki açık izniyle**: üretimde 14 Kas'ın yanlış yatış kaydını ve o akşamki deneme yapılışlarını (`rutin_runs`, `rutin_run_steps`, ilgili oturumlar ve ritim kayıtları) temizle; tercihen 4. maddedeki yolla, olmuyorsa tek seferlik bir düzeltmeyle. Neyi sildiğini satır sayılarıyla rapora yaz. Adım listesine, ayarlara ve başka günlere dokunma.

## Bu faza özel kurallar

- **Geriye uyum.** Yeni alanları kullanmayan sahne ve modül sayfasında hiçbir şey değişmez; önceki fazların ve Rutin 1'in testleri beklenti gevşetilmeden geçer.
- **Modül sınırı.** Modül çekirdeğin tablolarını okumaz; her şey sözleşmeden gelir.
- **Denetçi:** sözleşme ve veri değişen adımlardan sonra adım kipinde, sonunda faz kipinde.
- **Sesli testler.** Testler, görüntü koşuları ve açtığın tarayıcılar hoparlörden gerçek ses çıkarmasın: sahte konuşmacı ortak kurulumdan gelsin (tek tek dosyalara bırakılmasın). `say`: cihazda Türkçe ses yoksa başka dilin sesiyle okumaz, sessiz kalır; Ayarlar → Sesli anlatım'da "Bu cihazda Türkçe ses yok" yazar. (Kullanıcı 14 Kas'ta geliştirme sırasında İngilizce sesle "Günaydın … colon zero zero" duydu.)
- **Görüşün gerek:** şeritte ve tuşlarda kullanıcının göreceği her yeni davranış.

## Yayın

Önceki fazlardaki sıra: migration'lar önce `sherpa-dev`, sonra `sherpa-prod`, sonra `git push origin main` ve etiket. Kullanıcı başındaysa izni bu sohbette iste; gözetimsizsen `prod`'a ve `git push`'a dokunma.

## Sonunda

Rapor (`BASLA.md` madde 10); `rutin.md` "Çekirdek için notlar"da 16–21'i kapat. "Sıradaki adım": Ç4 (`prompts/BASLA.md`).
