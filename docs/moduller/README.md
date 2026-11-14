# Modüller

Bir modül ancak tasarımı "onaylandı" olduktan sonra kodlanır. Tasarım, her modül için ayrı bir oturumda (`prompts/modul-tasarim-oturumu.md`), `docs/06-modul-sozlesmesi.md` içindeki 11 başlıklı şablonla bu klasörde yazılır. Şu an hiçbir modül onaylı değildir; çekirdek hattı modüllerden bağımsız ilerler.

## Katalog

| Sıra | Modül | Tür | Alan | Öncelik | Tasarım durumu | Dosya |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Okul | Dönemlik | — | Kritik | Taslak (ayrıntılı) | `okul.md`, `okul-ninova.md` |
| 2 | Beslenme | Ömürlük | Sağlık | Kritik | Taslak | aşağıda |
| 3 | Rutin (sabah ve akşam) | Ömürlük | Sağlık | Yüksek | Taslak (tasarım oturumu sürüyor) | `rutin.md` |
| 4 | Spor | Ömürlük | Sağlık | Yüksek | Bekliyor | aşağıda |
| 5 | Ev | Ömürlük | — | Orta | Taslak | aşağıda |
| 6 | İş | Ömürlük | — | Orta | Taslak | aşağıda |
| 7 | Yüksek lisans | Hedefe kadar | — | Yüksek | Bekliyor | — |
| 8 | Hayat idaresi | Ömürlük | — | Orta | Bekliyor | — |

Modül olmayanlar (çekirdekte çözülür): korunan zaman (bir sabit blok türü), fikir havuzu ve yan projeler (gelen kutusu + etiket), keyif işleri (takip edilmez).

Aşağıdaki özetler tasarım değil, tasarıma girdidir. Her biri kendi dosyasında 11 başlıkla yazılıp onaylanacak.

## Beslenme (taslak)

- **Amaç:** Doğru makrolarla sürdürülebilir bir yemek düzenini en az eforla yürütmek; planı kullanıcının kendi verisiyle güncel tutmak; düzenli alışveriş listesi çıkarmak.
- **Veri stratejisi (karar bekliyor):** Öneri "plan = kayıt". Kullanıcı meal prep yaptığı için planlanan öğün yenen öğündür; yalnızca sapmalar ve haftada 2–3 tartı girilir. Hedefler trend kilodan uyarlanır ve her değişiklik kullanıcı onayına sunulur. Alternatifler: bir kalori takip uygulamasına dönmek ya da yalnızca kilo ve protein takibi.
- **Tablolar (öngörü):** besinler, tarifler, gün tipleri, haftalık plan, prep oturumları, alışveriş listesi, öğün kayıtları, ölçümler ve hedef geçmişi.
- **Çekirdeğe verdikleri:** prep oturumu işleri, alışveriş işi (prep'ten 1 gün önce), tartı ritmi, öğün uyumu sorusu.
- **Olaylar:** dinler `spor.workout_done`, `is.office_day`; yayınlar `beslenme.prep_done`.
- **Özel ekranlar:** telefonda alışveriş modu (reyonlara göre işaretlenen liste), prep koç modu (adım adım, zamanlayıcılı).
- **Açık sorular:** veri stratejisi; karbonhidrat döngüsü sürecek mi; akşam yemekleri kaç kişilik; prep günleri; güvenlik sınırları (haftalık değişim hızı, kalori tabanı).

## Rutin (sabah ve akşam)

Tasarımı `rutin.md` içinde. Günün açılışı ve kapanışı: bakım adımları, günün özeti, uyku görünümü. Hareket bu modülde değildir (13 Kas 2026 kararı).

## Spor (bekliyor)

- **Amaç:** Bütün hareketi tek yerde yürütmek. İlk programı kullanıcının boyun ve sırt (duruş) çalışmasıdır; salon üyeliği alınınca antrenmanlar aynı modüle ikinci program olarak eklenir.
- **Rutin'den bağımsızdır:** yapılamadığı gün Rutin tam görünür. Sabah yapılması bir zaman kısıtıdır, modül üyeliği değil.
- **Özel ekran:** koç sahnesi: hareket adı, form ipucu, tekrar sayacı, tutuşlar için geri sayım.
- **Olaylar (öngörü):** yayınlar `spor.workout_done` (Beslenme dinler).
- **Araştırmadan girdi (13 Kas 2026; `rutin.md` içindeki dayanak):** boyun asgarisi her gün, yaklaşık 5 dk (01 nefes, 04 çene içe, 05 duvar kaydırma), sabaha bağlı; tam set (01–12) haftada 3, sabit gün olmadan ve arada dinlenme günüyle; adaylar: çıkarken ışık yürüyüşü, yemek sonrası yürüyüş, adım sayısı (telefondan veri bağlantısı ister; denenmedi). Spor günü duşun spordan sonraya gelmesi Rutin'in Duş ritmiyle bağlanacak.
- **Açık sorular:** programların bölüm olarak gösterimi; hareket listesinin ayrıntısı (kullanıcının mevcut dokümanından).

## Sağlık alanı sayfası

Rutin, Spor ve Beslenme'yi tek sayfada gösterir. Metrikleri şimdi tasarlanmaz: en az iki modül iki hafta kullanıldıktan sonra, gerçek veriyle belirlenir. Kural: yalnızca kullanıcının zaten yaptığı dokunuşlardan türeyen metrik girer (uyku: "Uyandım" ve "Yatıyorum"; rutin: sahnedeki adımlar; antrenman: koç sahnesi; kilo: tartı girişi). Önceki öngörü girdi olarak durur: kilo gidişatı, haftalık ızgara (öğün uyumu, rutin, antrenman; boş gün gri kalır).

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
