# Modül tasarım oturumu

Her modül ayrı bir Claude sohbetinde tasarlanır.

**Sherpa Claude projesinin içindeysen** (talimatı `prompts/claude-projesi-talimati.md`): dosya eklemene gerek yok. Projede yeni bir sohbet aç ve "<modül adı> modülünü tasarlayalım" yaz; proje talimatı bu dosyadaki adımları izletir.

**Projenin dışındaysan:** yeni bir sohbet aç, aşağıdaki dosyaları ekle ve alttaki metni ver. Oturumun çıktısı onaylı bir `docs/moduller/<slug>.md` dosyasıdır; Claude Code modülü oradan kurar.

## Sohbete eklenecek dosyalar

- `docs/01-urun.md`
- `docs/03-veri-modeli.md`
- `docs/06-modul-sozlesmesi.md`
- `docs/10-yapay-zeka.md`
- `docs/moduller/README.md`
- `docs/moduller/ORTAK.md` (önceki modül oturumlarında alınan ortak kararlar: görsel dil, sahne ve modül sayfası düzeni, öğrenme, dil; yeniden tartışılmaz)
- Modülün mevcut taslağı varsa o dosya (Okul için `okul.md` ve `okul-ninova.md`, ayrıca `docs/08-notion-aktarim.md`)

## Verilecek metin

---

Sherpa adlı kişisel planlama uygulamam için **<modül adı>** modülünü tasarlayacağız. Ekteki dosyalar çekirdeği, modül sözleşmesini ve bu modülün mevcut taslağını anlatıyor. Çekirdek tasarımı sabit; bu oturumda yalnızca modülü tasarlıyoruz. Çekirdekte bir eksik görürsen ayrıca not et, çözmeye çalışma.

Şu sırayla ilerle ve her adımda benden onay al:

1. **Taslak ve sorular.** Bildiklerinden modülün 11 başlıklı taslağını çıkar; emin olmadığın her şeyi soru olarak sor. Tahmin yürütüp boşluk doldurma.
2. **Veri bağlantıları.** Modülün her verisi için kaynağı ve otomasyon seviyesini belirle. Bir dış kaynağa erişilip erişilemediğini varsayma; deneyebiliyorsan dene, deneyemiyorsan "denenmedi" yaz.
3. **İş teklifleri.** Modülün çekirdeğe göndereceği her iş zarfını yaz: `key`, hangi alanları modül doldurur, hangilerini yapay zekaya bırakır, `sizingHints`.
4. **Ekranlar ve girişler.** Çipi, şimdi kartını, sayfanın beş bölgesini ve sekmelerini, her veri girişini tek tek tasarla; ekranları çizerek göster. Her giriş en fazla 2 dokunuş ya da tek cümle olmalı.
5. **Simülasyon.** Modülü birkaç gerçek günün ve bir kötü haftanın üzerinde yürüt; bulduğun açıkları tasarıma işle.
6. **Adımlar.** Modülü en fazla üç kurulum adımına böl (temel, veri bağlantıları, otomasyon) ve her adımın kabul ölçütlerini yaz.
7. **Çıktı.** Onayladığım tasarımı `docs/moduller/<slug>.md` dosyası olarak ver; durumunu "onaylandı" yap. Çekirdek için not ettiğin eksikleri ayrı bir liste olarak ekle.

Başlamadan önce `docs/moduller/ORTAK.md` dosyasını oku ve oradaki kararları bu modüle uygula; oturumun sonunda bu modülde alınan ve öbür modüller için de geçerli olan yeni kararları o dosyaya ekle. Ekranları çizerken bir akışın her adımını ve modül sayfasının açılan her ekranını göster.

Kurallar: sabit haftalık program önerme; ölçülemeyen durumu takip ettirme; oyunlaştırma ekleme; modülün iki hafta kullanılmadan büyütülmesini önerme.

---

## Oturumdan sonra

1. Dosyayı depoda `docs/moduller/` altına koy; `docs/moduller/README.md` ve `docs/07-yol-haritasi.md` içindeki durumunu güncelle.
2. Çekirdek için çıkan eksikler varsa önce onları Claude Code ile çöz.
3. Claude Code'a şunu ver: "`docs/moduller/<slug>.md` dosyasını ve `docs/06-modul-sozlesmesi.md` dosyasını oku. `_sablon` modülünü kopyalayarak bu modülün 1. adımını kur. Kapsam ve kabul ölçütleri modül dokümanının sonunda. Çekirdeğe dokunman gerekiyorsa dur ve sor."
