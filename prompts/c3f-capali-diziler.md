# Ç3f: Çapalı diziler

Claude Code'a yalnızca şunu yaz:

> `prompts/c3f-capali-diziler.md` dosyasını oku ve uygula.

Ön koşul: `c3e-tamam` etiketi.

---

## Görev

Uyanışa ve yatışa bağlı işleri ekranda **tek akış** yap: sahne parçası olduğu diziyi görsün, dizide bir iş bitince sıradaki kendiliğinden başlasın, dışarıdan kaydedilen uyanıştan sonra dizi başlasın, sahne akşam kapanışını kendi içinde açabilsin. Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm G. Bu oturumda yalnızca Ç3f yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı Ç3f, etiket `c3f-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c3f/`.

Neden: ilk gerçek modül (Rutin) sabahı tek görünümde gösterecek: diş ve su (Rutin), boyun hareketleri (Spor, sonra kurulacak), duş ve hazırlık (Rutin). Hareket adımında ekran Spor'un sahnesine geçmeli, bitince sabaha dönmeli. Kavram geneldir; hiçbir şey bir modüle özel kurulmaz, örnekleri `deneme` modülünde ve şablon kopyasındadır. Modüller birbirini tanımamaya devam eder.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`
- `docs/12-sahne-ve-otomasyon.md`: bölüm A (sahne), D (günün çerçevesi), G (diziler), Ç3f kabul ölçütleri
- `docs/04-planlayici.md`: "Günün çerçevesi" ve uygulama notları (çapalı diziler, 60 dakika kuralı)
- `docs/06-modul-sozlesmesi.md`: "Sahne", "Olaylar"
- `docs/05-arayuz.md`: Bugün, sahne, günün çerçevesi, akşam kapanışı
- `docs/moduller/rutin.md`: "Sabahın tamamı tek görünümde" ve "Çekirdek için notlar" (yalnızca bağlam; Rutin bu fazda kurulmaz)

## İlk iş: tasarımı numaralı dokümanlara işle

Bölüm G'yi ilgili dokümanlara işle ve tek commit'te kaydet: `docs/06` (`SceneChain`, `SceneProps.chain`, `controls.closing`, `today.closed`, sıra kuralı), `docs/03` (`day_frame.chain_auto`), `docs/04` (dizinin türetilmesi, kendiliğinden devamın planlayıcıyı değiştirmediği), `docs/05` (standart karttaki dizi satırı, sahneden açılan kapanış, Ayarlar), `docs/12` (durum satırı). Çalışma ağacında commit edilmemiş doküman değişikliği varsa (tasarım sohbetinin: `docs/01`, `07`, `09`, `12`, `docs/moduller/`, bu dosya) onları da bu commit'e kat.

## Önerilen sıra

1. **Dizi.** `chainOf` (saf, önce testler): planın çapalı yuvaları ve bugünün kayıtlarından; durumlar; başka modülün satırında yalnızca izinli alanlar. Denetçi (adım kipi).
2. **Sahneye verme.** `SceneProps.chain`; standart kartta dizi satırı.
3. **Kendiliğinden devam.** `day_frame.chain_auto` (migration gerekmiyorsa yalnızca doğrulama ve ayar), Bitti ve Ertele'den sonra başlatma, öbür sonuçlardan sonra başlatmama, iki çapa; başlatma mevcut `start_session` yolundan. Denetçi (adım kipi).
4. **Dışarıdan uyanış.** `core/wake` kaydından sonra uygulama öne gelince dizinin başlaması; süre sınırı; iki cihazda çift başlatmanın olmaması.
5. **Sahneden kapanış.** `controls.closing()`, `today.closed`, "Onayla ve yat"ın gizlenmesi.
6. **`deneme` ve şablon kopyası.** İki modülün işleriyle bir uyanış dizisi ve bir yatış dizisi; diziyi çizen örnek sahne.
7. **Kapanış.** Uçtan uca testler, ekran görüntüleri, `check:full`, faz denetimi, rapor, `c3f-tamam`, yayın (önceki fazlardaki sırayla; gözetimsizsen `prod`'a ve `git push`'a dokunma).

## Bu adıma özel kurallar

- **Planlayıcı değişmez.** Aynı girdi aynı planı verir; bunu bir testle tut. Dizi plandan türetilir.
- **Geriye uyum.** Çapalı işi olmayan veride ve `chain` kullanmayan sahnede hiçbir şey değişmez; önceki fazların testleri değiştirilmeden geçmeli.
- **Modül sınırı.** Dizideki başka modülün satırı yalnızca ad, modül, bölüm, renk, süre ve durum taşır. `src/core/` hiçbir modülü içe aktarmaz.
- **Oturum kuralları tek yerde.** Kendiliğinden başlatma mevcut oturum yolunu kullanır; "Devam ediyor musun?" ve 30 dakika kuralı değişmez. İki cihaz aynı anda bitirirse tek oturum başlar (yarış testi).
- **Ürün kuralı 3.** Kendiliğinden devam bir kolaylıktır; kapalıyken ve hiçbir şeye dokunulmadığında her şey eskisi gibi çalışır.
- **Görüşün gerek:** kendiliğinden devamın başlangıçta açık olması, ertelemeden sonra devam, standart karttaki satırın metni.

## Kapsam dışı

- Bir işin başka bir işin hemen ardına bağlanması (salon antrenmanından sonra duş)
- Dizinin sürükleyerek sıralanması
- Gerçek modüller (Rutin dahil); görsel cila (Ç4)

## Fazın sonunda

Faz raporuna ek: `docs/moduller/rutin.md` içindeki tasarımın bu bağlantı noktalarıyla kurulmasında eksik ya da zor bulduğun yerler.
