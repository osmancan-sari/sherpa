# Ç3b: Zaman kısıtları

Claude Code'a yalnızca şunu yaz:

> `prompts/c3b-zaman-kisitlari.md` dosyasını oku ve uygula.

---

## Görev

İş zarfına `timing` bölümünü ekle ve planlayıcıyı bu kısıtlara uydur: kesin saat penceresi, tercih edilen ve kaçınılan saatler, yol süresi, tekrarlar arası dinlenme günü. Bu oturumda yalnızca Ç3b yapılır; bitince dur, Ç4'e başlama.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir: "Nasıl çalışacaksın", "Doğrulama düzeni" (her adımda `npm run check`, riskli adımlardan sonra ve fazın sonunda bağımsız denetçi, etiketten önce `npm run check:full`) ve, başında kimse yoksa, "Gözetimsiz çalışma". Faz adı Ç3b, etiket `c3b-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c3b/`.

Neden şimdi: zarfı modüller yazılmadan değiştirmek ucuz, sonra pahalı. Karar ve gerekçesi `docs/09-kararlar.md` içinde (12 Kas 2026).

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md` (Durum, Ç3 raporu, Bilinen sorunlar)
- `docs/07-yol-haritasi.md`: "Ç3b" (kapsam ve kabul ölçütleri)
- `docs/03-veri-modeli.md`: "Zaman kısıtları" ve üç tablonun yeni sütunu
- `docs/04-planlayici.md`: tamamı; özellikle "Zaman kısıtları (Ç3b)", "Uygulama notları (Ç3)" ve test listesinin Ç3b bölümü
- `docs/05-arayuz.md`: "Zaman kısıtları (Ç3b)"
- `docs/06-modul-sozlesmesi.md`: `Timing` tipi ve zarf kuralı
- `docs/10-yapay-zeka.md`: tasarım kuralı 12

## İlk iş

Çalışma ağacında commit edilmemiş doküman değişiklikleri ve bu dosya var; hepsi bu adımın tasarımıdır. Kod yazmadan önce onları tek commit'te kaydet. `.git/objects` altında yarım kalmış bir commit denemesinden `tmp_obj_*` dosyaları kalmış olabilir; `git prune` temizler.

## Önerilen sıra

Planını `docs/ILERLEME.md`'ye yaz; sırayı değiştirebilirsin.

1. **Şema ve zarf.** Migration (üç tabloya `timing`, yalnızca ekleme), tipler, `timing` şeması ve doğrulaması, biçime göre izinli alanlar, alt alan başına `provenance`, sabit zaman biçiminde `travel` → bloğun yol sütunları, formdan gelen değerin aynı şemadan geçmesi. Veritabanı ve zarf testleri. Denetçi (adım kipi).
2. **Planlayıcı motoru.** Önce `docs/04-planlayici.md` içindeki Ç3b test listesinin tamamını yaz, sonra kodu. Motor saf kalır. Denetçi (adım kipi).
3. **Hafta yükü ve uyarılar.** `loadByWeek`, iki yeni uyarı, uyarı önceliği.
4. **Yapay zeka.** `enrich` çıktı şeması ve istemi (yalnızca açıkça yazılanı doldurur), planlama çağrılarının girdisinde kısıt özeti, sahte sağlayıcının kuralları, `ai:eval` örnekleri (açık pencere, açık kaçınma, açık yol; kısıt olmayan iki satırda boş kalma: biri son tarih bildiren, biri yalnızca gün içi bir kelime geçen). Denetçi (adım kipi).
5. **Arayüz.** Formlarda "Zaman" bölümü, zaman çizelgesinde yol, kartta ve Sıradakiler'de yol, uyarılar. `deneme` modülünde `timing`'in her alanını kullanan kayıt türü; örnek veride (`db:seed`) kısıtlı birkaç iş.
6. **Kapanış.** Uçtan uca testler, ekran görüntüleri, `check:full`, faz denetimi, faz raporu, `c3b-tamam`.
7. **Yayın.** Migration önce `sherpa-dev`, sonra `sherpa-prod`; kod ondan sonra gönderilir (sütunlar boş geçilebilir olduğu için migration'ın koddan önce gitmesi güvenlidir). Başındaysam izin sorularını onaylarım. Gözetimsiz oturumdaysan `prod`'a ve `git push`'a dokunma; adımları "Senden bekleyenler"e yaz (D4'teki gibi).

## Bu adıma özel kurallar

- **Ç3'ün testlerine dokunma.** `timing` taşımayan girdide plan birebir aynı kalmalıdır; bu, adımın birinci kabul ölçütüdür. Bir Ç3 testi kırılıyorsa hata yeni koddadır. Bir testi gerçekten değiştirmen gerekiyorsa bu bir tasarım çelişkisidir: gerekçesini "Verdiğim kararlar"a yaz ve faz raporunda ayrıca belirt.
- **Dokümandaki adlar ve koddaki adlar.** Mevcut kod bir kavram için dokümandan farklı bir ad kullanıyorsa koddaki adı koru. Yeni alan adları (`timing`, `windows`, `prefer`, `avoid`, `travel`, `rest_days`) dokümandaki gibi kalır.
- **Doküman uygulanamıyorsa** (örneğin mevcut yuva kodu boş aralığı tutmuyorsa ve ayak izinin taşması başka bir yapı gerektiriyorsa) en doğru yorumu seç ve ilgili dokümanı aynı commit'te güncelle. Davranış kuralı değişiyorsa (kimin öne geçtiği, neyin kesin olduğu) "görüşün gerek" diye işaretle.
- **Zaman.** Aralıklar İstanbul saatidir; mevcut zaman yardımcılarını kullan, yenisini yazma. Motorun içinde saat okuma yok; şimdiki zaman parametredir.
- **Kesin ile esnek karışmasın.** `windows`, `travel` ve `rest_days` hiçbir durumda çiğnenmez; `prefer` ve `avoid` yalnızca sırayı etkiler. Testlerde bu ayrım açıkça sınansın.
- **Görüşün gerek** diye işaretlenecekler: zaman çarpanları ve "yarısı" eşiği; formdaki bölümün yerleşimi ve özet satırı; zaman çizelgesinde yolun görünüşü; uyarı metinleri.

## Kapsam dışı

- Bitiş çizgisinden sonraya iş yerleştirmek (açık soru, `docs/09-kararlar.md`)
- Zincirleme yol (ardışık işler arasında yer hesabı), nereden gelindiğine göre değişen yol
- Anlık veri (trafik, doluluk), konumdan bağlam seçimi ("Fikirler"de)
- Tarihe göreli zamanlama ("sınavdan iki gün önce")
- Gerçek modüller; yalnızca `deneme`

## Fazın sonunda

`prompts/BASLA.md` içindeki faz raporuna ek olarak:

- Dokümanın uygulamada tutmadığı yerler ve yerine ne yaptığın
- Motorun en kırılgan bulduğun yeri (ayak izinin taşması, bekletme kuralı gibi) ve hangi testlerin onu tuttuğu
- Modül tasarım oturumları için not: bir modül `timing`'i yazarken nelere dikkat etmeli
