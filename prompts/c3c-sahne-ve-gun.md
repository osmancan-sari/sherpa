# Ç3c: Sahne ve günün çerçevesi

Claude Code'a yalnızca şunu yaz:

> `prompts/c3c-sahne-ve-gun.md` dosyasını oku ve uygula.

Ön koşul: `c3b-tamam` etiketi. Yoksa önce Ç3b bitirilir.

---

## Görev

Modülün işi çalışırken Bugün ekranını devralan **sahne**yi, modüllere **oturum ve gün olayları**nı, **sesli anlatım** servisini ve **günün çerçevesi**ni (uyanış, yatış, çapalı işler, akşam) kur. Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm A–D. Bu oturumda yalnızca Ç3c yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı Ç3c, etiket `c3c-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c3c/`.

Neden şimdi: kullanıcının birinci önceliği, modüller tek tek tasarlanmadan önce altyapının üç katmana hazır olması (`docs/12-sahne-ve-otomasyon.md`, "Neden"). Hiçbir şey bir modüle özel kurulmaz; her bağlantı noktasının örneği `deneme` modülündedir.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md` (Durum, Ç3 ve Ç3b raporları, Bilinen sorunlar)
- `docs/12-sahne-ve-otomasyon.md`: tamamı
- `docs/04-planlayici.md`: tamamı ("Zaman kısıtları (Ç3b)" ve "Şimdi durumu" dahil)
- `docs/05-arayuz.md`: Bugün, NowCard durumları, Telefon, Akşam kapanışı
- `docs/06-modul-sozlesmesi.md`: tamamı
- `docs/03-veri-modeli.md`: `days`, `settings`, `sessions`, `events`, "Zaman kısıtları"

## İlk iş: tasarımı numaralı dokümanlara işle

`docs/12-sahne-ve-otomasyon.md` bu adımın kaynağıdır ama dokümanların tek kaynak kuralı sürer. Kod yazmadan önce A–D bölümlerini ilgili dokümanlara işle ve tek commit'te kaydet:

- `docs/06`: `ui.scene`, `SceneProps`, `say`, `TodayBrief`, `core.*` olayları, bileşen takımında `StepRunner`
- `docs/03`: `days` ve `settings` alanları; `timing.anchor` ve `timing.after_finish` (tanım, doğrulama, biçime göre izin)
- `docs/04`: günün başı, çapa, akşam, yeni `now` durumları; "Zaman kısıtları" kural 9'daki bitiş çizgisi maddesinin yeni hali; test listesine Ç3c bölümü
- `docs/05`: sahne yerleşimi, Günaydın ve akşam ekranları, üst şerit, zaman çizelgesi
- `docs/07`: Ç3c ve Ç3d bölümleri (kapsam ve `docs/12` içindeki kabul ölçütleri), tablo ve sıra satırı
- `docs/09`: kararlar (12 Kas 2026) ve kapanan açık soru (bitiş çizgisinden sonra iş)
- `docs/12`: en üstteki durum satırını güncelle

Mevcut kod bir kavram için başka ad kullanıyorsa koddaki adı koru ve dokümanı ona göre yaz.

## Ç3b'den devralınan iş

`docs/ILERLEME.md` içindeki "Bilinen sorunlar"da yazan yarış: kalemden Başla'ya basıldığı anda hafta bekçisi de aynı kalem için oturum işi yazarsa kalemin iki açık oturum işi olabiliyor (Ç3b'de pencere daraltıldı, kapanmadı). Bu adım oturumların başlamasına ve olaylarına dokunduğu için burada kalıcı olarak çöz: oturum işini açma ve oturumu başlatma tek işlemli bir veritabanı fonksiyonunda olsun; yarışı sınayan bir veritabanı testi yaz. Sırada 4. adımdan (oturum olayları) önce yap.

## Önerilen sıra

1. **Veri ve zarf.** Migration (`days`, `settings`), `timing.anchor` ve `timing.after_finish` şeması ve doğrulaması. Denetçi (adım kipi).
2. **Planlayıcı.** Önce testler: günün başının uyanışa göre kurulması, uyku planının her kuralı (`docs/12`, bölüm D, "Uyku planı": en geç uyanış, yüke göre erkene çekme, uykunun iş yüküne feda edilmemesi, gerçek yatışın ertesi günü değiştirmesi), çapalı işlerin dizilişi, akşam bölgesi, yeni `now` durumları, günün çerçevesi yokken planın değişmemesi. Sonra kod. Motor saf kalır. Denetçi (adım kipi).
3. **Uyanış ve yatış.** Kayıt, tahmini uyanış, kaydırma, uyku planının günün kaydına yazılması, ayarlar (aralıklar, uyku hedefi).
4. **Oturum ve gün olayları.** `core.session_started`, `core.session_ended`, `core.day_started`, `core.day_closed`; yalnızca sahibine teslim. Denetçi (adım kipi; sözleşme değişiyor).
5. **Sahne.** `ui.scene`, Bugün ekranında devralma, şerit, çıkış ve dönüş, hata sınırı, `StepRunner`. `deneme` modülünde iki sahne: serbest bir sahne ve `StepRunner` kullanan adımlı bir sahne.
6. **Sesli anlatım.** `src/core/voice/` (sağlayıcı arayüzü, cihazın sesi, sıra, kesme, cümlelere bölme), cihaz başına ayarlar, `say` ve `today` bağlamda. Testlerde sahte sağlayıcı.
7. **Ekranlar.** Günaydın, akşam, üst şeritte uyanış ve yatış aralığı, zaman çizelgesinin bölümleri.
8. **Kapanış.** Uçtan uca testler, ekran görüntüleri, `check:full`, faz denetimi, rapor, `c3c-tamam`.
9. **Yayın.** Ç3b'deki gibi: migration önce `dev`, sonra `prod`; kod sonra. Gözetimsizsen `prod`'a ve `git push`'a dokunma, adımları "Senden bekleyenler"e yaz.

## Bu adıma özel kurallar

- **Geriye uyum.** Uyanış kaydı, çapa ve `after_finish` kullanılmayan veride çalışma penceresinin içindeki plan Ç3b'dekiyle aynı kalmalı. Günün başının tanımı değiştiği için bazı Ç3 testlerinin girdisi değişebilir; bir testi değiştirirsen ne değiştiğini ve neden değiştiğini "Verdiğim kararlar"a tek tek yaz. Beklentiyi gevşetme.
- **Sahne çekirdeği ele geçirmez.** Oturumun sahibi çekirdektir; sahne yalnızca `controls` ile etkiler. Şerit ve çıkış her koşulda çalışır; bunu sahne bileşeni hata verirken de sına.
- **Modül sınırı.** Sahne, olaylar ve `say` yalnızca sözleşmeden geçer; `src/core/` yine hiçbir modülü içe aktarmaz. İçe aktarma listesi (`tests/unit/modules.test.ts`) ve `docs/06` birlikte güncellenir.
- **Ses.** Tarayıcı kısıtlarını güncel dokümandan doğrula (konuşma sentezi, otomatik oynatma; iOS'ta ana ekran uygulaması ayrıca). Otomatik testler sahte sağlayıcıyla yapılır; gerçek cihaz denemesi "elle doğrulanacak" olarak "Senden bekleyenler"e adım adım yazılır. Anlatım hiçbir akışın ön koşulu olmaz.
- **Uyku verisi.** Uyanış ve yatış kullanıcının kendi verisidir; yapay zeka çağrılarına yalnızca planlama için gereken kadarı (günün başı, beklenen yatış) gider, geçmişi gitmez.
- **Görünüş.** Sahne geçişi, Günaydın ve akşam ekranları işlevsel ve derli toplu olsun; son cila Ç4'tedir.
- **Görüşün gerek** diye işaretlenecekler `docs/12` içinde her bölümün sonunda yazılı; onlara ek olarak verdiğin her görünüş ve metin kararı.

## Kapsam dışı

- Sunucu zemini (cihaz anahtarları, giriş ucu, zamanlanmış işler): Ç3d
- Gerçek modüller; sabah ve akşam rutini de dahil
- Sesle komut, ücretli ses sağlayıcısı, dış sistemlere komut

## Fazın sonunda

`prompts/BASLA.md` içindeki faz raporuna ek olarak:

- Sahne sözleşmesinde eksik ya da zor bulduğun yerler (ilk gerçek modül bunu sınayacak)
- Günün çerçevesinin planlayıcıda dokunduğu yerler ve onları tutan testler
- Sesin gerçek cihazlarda denenmesi için adımlar
