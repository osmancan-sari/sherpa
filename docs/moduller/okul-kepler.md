# Okul modülü: Kepler denemesi

Kepler, İTÜ'nün öğrenci bilgi sistemidir (`obs.itu.edu.tr/ogrenci/`). Bu dosya 17 Kasım 2026 denemesinin kaydıdır; tasarım `okul.md` içindedir.

## Deneme (17 Kasım 2026)

Kullanıcı girişi kendisi yaptı (Öğrenci İşleri sayfasından "ÖBS Giriş"); yalnızca okundu. Sayfalarda yalnızca dönem ve ders seçicisi değiştirildi; hiçbir kayıt, form ya da ayar değiştirilmedi.

- **Giriş:** Ninova ile aynı İTÜ hesabı, aynı giriş sayfası (`girisv3.itu.edu.tr`). Kullanıcının söylediği: ikisinde de yalnızca kullanıcı adı ve şifre, ek doğrulama adımı yok.
- **Yapı:** tek sayfalık uygulama. Veriyi `obs.itu.edu.tr/api/ogrenci/...` uçlarından JSON olarak alıyor; her sayfa açılışında `/ogrenci/auth/jwt` isteniyor.

| Ne | Sayfa | Uç | Sonuç |
| --- | --- | --- | --- |
| Kayıtlı sınıflar | — | `sinif/KayitliSinifListesi/<dönem>` (26-27 Güz = 806) | Okundu: `sinifId`, CRN, ders kodu, ad, gün, başlangıç-bitiş saati, bina ve derslik |
| Dönem içi notlar | Not Bilgileri → Dönem İçi Notları | `Sinif/SinifDonemIciNotListesi/<sinifId>` | Okundu (bir derste dolu): ölçüt adı, not, açıklama, sınıf sırası, öğrenci sayısı, ortalama, standart sapma, katkı, dersin ortalaması |
| Yoklama | Not Bilgileri → Sınıf Yoklama Bilgisi | `Sinif/SinifOgrenciYoklama/<sinifId>` | Okundu (bir derste dolu): hafta → gün → ders saati, her saat için `katildiMi` (doğru, yanlış); toplam "9 / 21" ve "genel katılım" yüzdesi. Yalnızca geçmiş haftalar listeleniyor (1–7); Ninova'daki tabloda ise 14 haftanın hepsi var, gelecek haftalar 0 |
| Final takvimi | Takvim → Final Takvimi | görülmedi | Sayfa var; bu dönem için boş ("final takvimi bilginiz bulunmamaktadır"). Açıklanınca yapısına bakılacak |
| Akademik takvim | Takvim → Akademik Takvim | `Takvim/AkademikTakvimDetay/<dönem>` | 26-27 Güz için boş liste döndü. Akademik takvim buradan alınamıyor |
| Ders takvimi | Takvim → Ders Takvimi | — | Açılmadı; aynı bilgi kayıtlı sınıflar ucunda var |

### Ninova ile karşılaştırma

- **Notlar** iki yerde de aynı (Derin Öğrenme'nin tek notu ve açıklaması ikisinde de görüldü). Kepler ayrıca sıra, ortalama ve standart sapmayı veriyor.
- **Yoklama:** Ninova'nın yoklama sayfası Kepler'in kaydını da gösteriyor (0 ve 1). Kepler'in kendi ucu daha açık: yalnızca geçmiş haftalar ve `katildiMi`.
- **Derslik üç derste farklı:** Derin Öğrenme Ninova'da Z-19, Kepler'de Z-18; Robotik Z-16 ve Z-18; Veri Görselleştirme 102 ve Z-21. Hangisinin doğru olduğu kullanıcıya soruldu.
- **Ders kodu:** Derin Öğrenme Ninova'da YZV 302E, Kepler'de YZV 303E (CRN aynı: 12325). Eşleme CRN ile yapılmalı.

### Sınırlar

- Kepler'in ana sayfası ve "Kişisel Bilgiler" bölümü kimlik numarası gibi kişisel verileri gösterir. Toplayıcı bu sayfaları ve uçları hiç istemez; yalnızca yukarıdaki üç ucu (kayıtlı sınıflar, dönem içi notlar, yoklama) ve açıklanınca final takvimini okur. Okunan yanıtlar olduğu gibi saklanmaz; yalnızca gereken alanlar alınır.
- `katildiMi: yanlış` olan bir hafta "gelmedi" mi, "yoklama alınmadı" mı: ayırt edilemedi (toplam 21 saatin hepsini sayıyor). Kullanıcıya soruldu.

### Denenmeyenler

1. Final takviminin yapısı (henüz açıklanmadı).
2. Toplayıcının kendi başına giriş yapması (şifre bilgisayarda nasıl saklanır; `girisv3` girişinin betikle yapılması).
3. JWT'nin ve oturumun ne kadar geçerli kaldığı (Ninova oturumu girişten 45 dakika sonra hâlâ açıktı).
4. Otomatik erişim kuralı.
