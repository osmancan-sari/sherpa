# Beslenme: mutfak, yeme düzeni ve yiyecek tercihleri

> **Tarih:** 23 Kas 2026
> **Kaynak:** Beslenme tasarım oturumunda kullanıcının verdiği cevaplar ve iki kişilik yiyecek anketi. Modülün kurulumunda başlangıç verisi olur (tercihler, ekipman, ev halkı); sonradan uygulamadan değişir. Tarif kataloğu araştırmasının istemi (`prompts/beslenme-tarif-arastirmasi.md`) bu dosyaya dayanır.

## Ev halkı

- İki kişi: kullanıcı ve birlikte yaşadığı kız arkadaşı.
- Ortak öğün sabit değildir, varsayılandır: hafta içi yalnızca akşam yemeği iki kişilik, hafta sonu bütün ana öğünler iki kişilik. Ara öğün kişiseldir. Bir günün öğünü tek dokunuşla "tek kişilik" ya da "iki kişilik" yapılır.
- İkinci kişinin porsiyonunun nasıl hesaplanacağı (hedefe göre mi, sabit porsiyon mu) açık; öğün yapısı adımında karara bağlanacak.

## Mutfak

| Konu | Durum |
| --- | --- |
| Pişirme | Fırın, airfryer, düdüklü tencere, mikrodalga, 4 gözlü ocak |
| Blender | Küçük, güçsüz ("bullet" tipi). Katalog güçlü blender gerektirmez |
| Terazi | Hassas mutfak terazisi var |
| Kaplar | IKEA 365+ cam, 1 litre, 6 adet; artırılabilir (sayı öğün yapısından sonra belirlenecek) |
| Dondurucu | 3 çekmece; bu kaplardan yaklaşık 10–12 tane sığıyor |

## Dışarıda geçen günler

- Kap taşınabilir.
- Ofis: buzdolabı var, mikrodalga yok.
- Okul: mikrodalga yok; hava soğukken kap öğleye kadar arabada durabiliyor (sıcak aylar için ayrıca düşünülmeli).
- Sonuç: ofis ve okul günlerinin kabı soğuk yenebilen tariflerden seçilir.

## Prep

- Tek oturumun süresinden çok haftanın yoğunluğu belirleyici. Tercih: haftayı kapatan tek bir 2–3 saatlik oturum; haftada 2–3 oturum da olur.
- Kullanıcının önerisi: bir tarif ayda 6–8 kez yetecek kadar yapılır, bir kısmı o haftaya, kalanı buzluğa gider; buzlukta hazır ne olduğu tutulur. Karar: stok elle sayılmaz, prep'te üretilen porsiyon ve "yedim" kayıtlarından türetilir.

## Alışveriş

- Online: Migros.
- Yakındaki marketler: Migros, BİM, A101, Şok, File, Özkuruşlar, Kim.
- Bütçe sınırı yok; öncelik sağlık. Antrikot ve somon gibi pahalı malzemeler her gün olmaz ("pahalı" etiketi, plana seyrek girer).

## Yiyecek anketi (23 Kas 2026)

İşaretlenmeyen her şey "olur".

### Kullanıcı

- **Sever:** tavuk göğsü, dana kıyma, dana kuşbaşı, köfte, hindi füme, somon, ton balığı konservesi, yumurta, süzme yoğurt, yoğurt, kefir, ayran, süt, kaşar, labne, hellim, tereyağı, protein tozu, kırmızı mercimek, yeşil mercimek, nohut, kuru fasulye, bezelye, bulgur, makarna, tam buğday makarna, patates, tatlı patates, tam buğday ekmek, lavaş, mısır, yeşil biber, zeytinyağı.
- **Yemez:** sucuk, lor, beyaz peynir, çökelek, yulaf, kinoa, karnabahar, pırasa, lahana, bamya, kereviz, hurma, zeytin, çiğ soğan, çiğ sarımsak.
- **Domates:** pişmiş domates, domates sosu ve salça olur. Çiğ domatesi azaltmaya çalışıyor: kahvaltıda yemez, öbür öğünlerde (ör. soğuk salatada) az miktarda olur.
- **Genel:** acı sever; kahvaltı tuzlu ya da tatlı fark etmez; aynı yemek üst üste en çok 3 gün; soğuk yenen öğle yemeği olur.

### Kız arkadaşı

- **Sever:** tavuk göğsü, dana kıyma, dana kuşbaşı, somon, yumurta, süzme yoğurt, yoğurt, kefir, ayran, süt, kaşar, labne, hellim, tereyağı, protein tozu, kırmızı mercimek, nohut, kuru fasulye, bulgur, makarna, tam buğday makarna, patates, tatlı patates, lavaş, zeytinyağı.
- **Yemez:** tavuk but, sucuk, hindi füme, ciğer, ton balığı konservesi, çökelek, mısır, yeşil biber, kapya biber, karnabahar, ıspanak, pırasa, lahana, bamya, kereviz, maydanoz ve dereotu, tahin, hardal, acı sos, çiğ soğan, çiğ sarımsak.
- **Genel:** acı sevmez; kahvaltı fark etmez; aynı yemek üst üste en çok 3 gün; soğuk yenen öğle yemeği olur.

### Ortak öğünlerde ikisinin de yemedikleri (birleşim)

Sucuk, lor, beyaz peynir, çökelek, yulaf, kinoa, karnabahar, pırasa, lahana, bamya, kereviz, hurma, zeytin, tavuk but, hindi füme, ciğer, ton balığı konservesi, mısır, yeşil biber, kapya biber, ıspanak, maydanoz ve dereotu, tahin, hardal, acı sos, çiğ soğan, çiğ sarımsak.

Ortak öğün acısız pişer; acı tabağa sonradan eklenir.
