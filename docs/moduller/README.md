# Modüller

Bir modül ancak tasarımı "onaylandı" olduktan sonra kodlanır. Tasarım, her modül için ayrı bir oturumda (`prompts/modul-tasarim-oturumu.md`), `docs/06-modul-sozlesmesi.md` içindeki 11 başlıklı şablonla bu klasörde yazılır. Şu an hiçbir modül onaylı değildir; çekirdek hattı modüllerden bağımsız ilerler.

## Katalog

| Sıra | Modül | Tür | Alan | Öncelik | Tasarım durumu | Dosya |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Okul | Dönemlik | — | Kritik | Taslak (ayrıntılı) | `okul.md`, `okul-ninova.md` |
| 2 | Beslenme | Ömürlük | Sağlık | Kritik | Taslak | aşağıda |
| 3 | Sabah rutini ve hareket | Ömürlük | Sağlık | Yüksek | Taslak | aşağıda |
| 4 | Ev | Ömürlük | — | Orta | Taslak | aşağıda |
| 5 | İş | Ömürlük | — | Orta | Taslak | aşağıda |
| 6 | Yüksek lisans | Hedefe kadar | — | Yüksek | Bekliyor | — |
| 7 | Hayat idaresi | Ömürlük | — | Orta | Bekliyor | — |

Modül olmayanlar (çekirdekte çözülür): korunan zaman (bir sabit blok türü), fikir havuzu ve yan projeler (gelen kutusu + etiket), keyif işleri (takip edilmez).

Aşağıdaki özetler tasarım değil, tasarıma girdidir. Her biri kendi dosyasında 11 başlıkla yazılıp onaylanacak.

## Beslenme (taslak)

- **Amaç:** Doğru makrolarla sürdürülebilir bir yemek düzenini en az eforla yürütmek; planı kullanıcının kendi verisiyle güncel tutmak; düzenli alışveriş listesi çıkarmak.
- **Veri stratejisi (karar bekliyor):** Öneri "plan = kayıt". Kullanıcı meal prep yaptığı için planlanan öğün yenen öğündür; yalnızca sapmalar ve haftada 2–3 tartı girilir. Hedefler trend kilodan uyarlanır ve her değişiklik kullanıcı onayına sunulur. Alternatifler: bir kalori takip uygulamasına dönmek ya da yalnızca kilo ve protein takibi.
- **Tablolar (öngörü):** besinler, tarifler, gün tipleri, haftalık plan, prep oturumları, alışveriş listesi, öğün kayıtları, ölçümler ve hedef geçmişi.
- **Çekirdeğe verdikleri:** prep oturumu işleri, alışveriş işi (prep'ten 1 gün önce), tartı ritmi, öğün uyumu sorusu.
- **Olaylar:** dinler `hareket.workout_done`, `is.office_day`; yayınlar `beslenme.prep_done`.
- **Özel ekranlar:** telefonda alışveriş modu (reyonlara göre işaretlenen liste), prep koç modu (adım adım, zamanlayıcılı).
- **Açık sorular:** veri stratejisi; karbonhidrat döngüsü sürecek mi; akşam yemekleri kaç kişilik; prep günleri; güvenlik sınırları (haftalık değişim hızı, kalori tabanı).

## Sabah rutini ve hareket (taslak)

- **Amaç:** Her sabah yapılan sabit rutini adım adım yürütmek ve kaydını kendiliğinden tutmak. Salon üyeliği olmadığı sürece hareket de bu modüldedir; üyelik alınınca Spor ayrı modül olur.
- **İçerik:** Kullanıcının hazır rutini 4 aşama ve 12 hareketten oluşur: omurga uyanışı, boyun ve kürek çalışması, core stabilite (6-4-2 piramidi, her tekrar 10 sn), tam gövde güç. Kısa gün seçeneği: 1. ve 3. aşama, yaklaşık 10 dk. Hareket listesi kullanıcının mevcut dokümanından aktarılacak.
- **Çekirdeğe verdikleri:** günlük ritim (`floor_count` ile kısa sürüm korunur).
- **Özel ekran:** koç modu: hareket adı, form ipucu, tekrar sayacı, tutuşlar için geri sayım. Bitince ritim kaydı kendiliğinden düşer.
- **Olaylar:** yayınlar `hareket.routine_done`, `hareket.workout_done`.

## Sağlık alanı sayfası

Beslenme ile Sabah rutini ve hareketi tek gidişatta gösterir: kilo gidişatı (tartılar, trend, hedef), haftalık ızgara (gün gün öğün uyumu ve rutin; boş gün gri kalır), sekmeler (haftalık plan, tarifler, alışveriş, rutin, hedef geçmişi).

## Ev (taslak)

Durum değil zaman takibi. Çamaşır ve bulaşığın durumu ölçülmez.

- **Ritimler:** çalışma odası ve yatak odası süpürme (haftada 1–2), salon, mutfak ve banyo temizliği (haftada 1).
- **Planlama:** 15–20 dakikalık fiziksel işler derin yuvalar arasındaki mola yuvalarına girer.
- **Giriş:** "çamaşır birikti" gibi bir cümle tek seferlik iş olur.
- **Olaylar:** dinler `beslenme.prep_done` (mutfak temizliği işi üretir).

## İş (taslak)

İş görevleri takip edilmez; kullanıcı bunları iş yerinde takip eder.

- **Sabit bloklar:** standart çalışma saatleri (Çarşamba tam gün, Perşembe ve Cuma öğleden sonra) blok serisi olarak; okul programına göre haftalık olarak değiştirilebilir.
- **"İş yoğun" anahtarı:** açıkken akşamlara ve hafta sonuna ek çalışma blokları konur; diğer modüllerin payı buna göre küçülür.
- **Özel hazırlık:** sunum gibi durumlar son tarihli iş olarak girilir.
- **Olaylar:** yayınlar `is.office_day`.

## Yüksek lisans, Hayat idaresi

Tasarım bekliyor. Öngörü: Yüksek lisans bir hedefe kadar modülüdür (başvuru takvimi, belgeler, dil sınavı; projeler ve son tarihler). Hayat idaresi ömürlüktür (faturalar, abonelikler, randevular, önemli tarihler; aylık kısa bir ritim).
