# Sabah açılışı (Ç4c sonrası ek)

Küçük bir çekirdek eki; yeni faz değil ama fazın kuralları geçerli: her adımda `npm run check`, sonunda `npm run check:full`, denetçi (adım kipi), `docs/ILERLEME.md` güncellenir. Önce `CLAUDE.md`, `docs/ILERLEME.md`, `docs/09-kararlar.md`, `docs/06` (sahne sözleşmesi), `docs/tasarim/` ve `docs/moduller/rutin.md` okunur.

## Neden

Kullanıcı 16 Kas sabahı ilk gerçek denemede şunu gördü: uygulamayı açınca Bugün geliyor, Günaydın kartında "Uyandım"a basıyor, Şimdi kartına Sabah işi geliyor, "Başla"ya basıyor, sahne ancak o zaman açılıyor. Üç dokunuş. İstenen: sabah uygulama doğrudan tam ekran sabah sahnesiyle açılsın, "Günaydın" yazsın ve tek "Başla" olsun.

## Karar (16 Kas 2026, kullanıcı istedi; `docs/09`'a ve ilgili dokümanlara işle)

1. **Koşul.** Günün çerçevesi açık, bugünün uyanış kaydı yok, saat uyanış aralığının başı ile en geç uyanıştan 2 saat sonrası arasında ve uyanışa bağlı zinciri sahneleyen etkin bir modül var.
2. **Davranış.** Bu koşulda uygulama Bugün yerine o sahnenin karşılama haliyle tam ekran açılır: "Günaydın" ve tek birincil düğme "Başla". "Başla" tek dokunuşla uyanışı kaydeder (`core.day_started`, şimdiki "Uyandım" ile aynı yol) ve zincirin ilk adımını başlatır.
3. **İkincil eylemler** (küçük, göze batmayan): "Biraz önce uyandım" (15/30/60 dk; kaydeder ve başlatır) ve "Şimdi değil" (Bugün'e götürür; o gün sahne bir daha kendiliğinden açılmaz, Günaydın kartı kalır).
4. **Uyanış zaten kayıtlıysa** (ileride alarm kısayolu `core/wake` ile) ve zincir başlamadıysa, aynı pencerede sahne doğrudan ilk adımın "Başla"sıyla açılır.
5. **Sahneleyen modül yoksa** hiçbir şey değişmez: bugünkü Günaydın kartı (`BT20`, `BT21`, `BP19`).
6. **Pano.** Aynı kural; panoda sahne `docs/moduller/rutin-cizimler` / `docs/tasarim` içindeki pano sahnesinin diliyle. Telefonda başlatılan zincir panoda da canlı görünür (mevcut davranış).
7. **Akşam için aynısı yapılmaz.**

## Sınırlar

- Çekirdek genel kalır: Rutin'e özel kod yok. Sözleşmeye gereken en küçük ek yapılır (örneğin sahnenin "karşılama" durumunu alabilmesi); `docs/06` güncellenir. Rutin kendi sabah sahnesinde karşılama halini çizer.
- Karşılama için onaylı kare yok. Rutin'in sabah sahnesinin ilk karesinin diliyle (gökyüzü, cam, baykuş, tipografi) kur; `docs/tasarim/ekranlar/` altına yaz ve raporda "görüşün gerek" olarak işaretle. Değerler `tokens.css`'ten, parçalar kit'ten.
- Güvenli alan kuralı (saat şeridi ve ada) burada da geçerli.
- Sesli anlatım açıksa karşılamada günün özeti "Başla"dan sonra okunur, öncesinde değil.

## Testler

- Sabit saatli uçtan uca: koşul sağlanınca açılışta sahne; "Başla" → uyanış kaydı + ilk adım çalışıyor; "Şimdi değil" → Bugün ve yeniden açılışta sahne gelmiyor; "Biraz önce" → doğru saatle kayıt; uyanış kayıtlıyken doğrudan ilk adım; modül kapalıyken Günaydın kartı; pencere dışında (örneğin 14:00) Bugün.
- Telefon ve pano ekran görüntüleri `docs/ekran-goruntuleri/sabah-acilisi/`; görsel teste onaylı görüntü.

## Bitiş

`check:full` yeşil ve denetçi engel bulmazsa commit; yayın kullanıcının bu sohbette verdiği izinle (migration varsa önce `sherpa-dev`, sonra `sherpa-prod`). Rapor: ne değişti, sözleşmeye ne eklendi, görüşün gerekenler, telefonda bakılacaklar.
