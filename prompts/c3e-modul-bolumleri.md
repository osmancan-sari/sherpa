# Ç3e: Modülün bölümleri

Claude Code'a yalnızca şunu yaz:

> `prompts/c3e-modul-bolumleri.md` dosyasını oku ve uygula.

Ön koşul: `c3d-tamam` etiketi. Yoksa önce Ç3d bitirilir.

---

## Görev

Bir modülün kendini **bölümlere** ayırabilmesini sağla: aynı veri ve sayfa, ana ekranda ayrı renk ve sahne. Modülün ve bölümlerin rengini kullanıcıya aç. Tasarım: `docs/12-sahne-ve-otomasyon.md`, bölüm F. Bu oturumda yalnızca Ç3e yapılır; bitince dur.

`prompts/BASLA.md` içindeki kurallar aynen geçerlidir ("Nasıl çalışacaksın", "Doğrulama düzeni", başında kimse yoksa "Gözetimsiz çalışma"). Faz adı Ç3e, etiket `c3e-tamam`, ekran görüntüleri `docs/ekran-goruntuleri/c3e/`.

Neden: kullanıcı rutin modülünde sabah için güneşli, akşam için gece temalı bir sahne ve zaman çizelgesinde ayrı renkler istiyor; ilk gerçek modül bu olacak. Kavram geneldir (Okul'da dersler, Beslenme'de prep ve alışveriş); hiçbir şey bir modüle özel kurulmaz, örnekleri `deneme` modülündedir.

## Önce oku

- `CLAUDE.md`, `docs/ILERLEME.md`
- `docs/12-sahne-ve-otomasyon.md`: bölüm A (sahne) ve F (bölümler), Ç3e kabul ölçütleri
- `docs/06-modul-sozlesmesi.md`: tamamı
- `docs/03-veri-modeli.md`: iş zarfı, `modules`, `work_items`, `tasks`, `rhythms`, `blocks`
- `docs/05-arayuz.md`: Bugün, sahne, Hafta, Ayarlar, düzenleme formları

## İlk iş: tasarımı numaralı dokümanlara işle

Bölüm F'yi ilgili dokümanlara işle ve tek commit'te kaydet: `docs/06` (`facets`, `ModuleFacet`, `ui.scenes`, `SceneProps.facet`, olay yüklerinde `facet`), `docs/03` (zarfta `facet`, dört tabloda sütun, `modules.facet_colors`, `modules.color`'ın artık kullanıcıya ait olması), `docs/05` (renk çözümleyicinin kullanıldığı yerler, Ayarlar'daki renk seçici, formda bölüm seçimi), `docs/12` (durum satırı). Çalışma ağacında commit edilmemiş doküman değişikliği varsa (kullanıcının ya da tasarım sohbetinin) onları da bu commit'e kat.

## Önerilen sıra

1. **Veri ve zarf.** Migration (dört tabloya `facet`, `modules.facet_colors`), zarf doğrulaması (bölüm listesine karşı; bilinmeyen anahtar adıyla reddedilir), oturum işinin kalemin bölümünü devralması, olgu alanı ve kullanıcı sahipliği. Denetçi (adım kipi).
2. **Sözleşme.** `facets`, `ui.scenes`, kayıtta doğrulama (yinelenen bölüm anahtarı, olmayan sahneye başvuru), bölüm listesinin modülün bağlamıyla hesaplanıp veri değişince tazelenmesi. Denetçi (adım kipi).
3. **Renk ve sahne.** Tek renk çözümleyici; çekirdeğin iş gösterdiği bütün yerlerde kullanılması (`row.color` doğrudan okunan her yeri bul; modül düzeyinde kalacak yerler `docs/12` F kural 4'te). Bölüme göre sahne ve ton; `SceneProps.facet`.
4. **Ayarlar ve form.** Modül ve bölüm renkleri, hazır palet ve özel renk, "varsayılana dön"; düzenleme formunda bölüm seçimi.
5. **`deneme` modülü.** İki sabit bölüm (ayrı renk, ayrı sahne ve ton) ve verisinden üretilen dinamik bölümler; örnek veride bölümlü işler.
6. **Kapanış.** Uçtan uca testler, ekran görüntüleri (iki bölümün sahnesi, zaman çizelgesi, renk ayarı), `check:full`, faz denetimi, rapor, `c3e-tamam`, yayın (Ç3b'deki sırayla; gözetimsizsen `prod`'a ve `git push`'a dokunma).

## Bu adıma özel kurallar

- **Geriye uyum.** Bölümü olmayan modülde hiçbir şey değişmez; önceki fazların testleri değiştirilmeden geçmeli. Planlayıcının çıktısı bölümden bağımsızdır; bunu bir testle tut.
- **Renk tek yerden.** Renk çözümleyici dışında `row.color` okuyan bileşen kalmamalı (modül düzeyindeki yerler hariç). Bunu bir test ya da lint kuralıyla tut.
- **Okunurluk.** Hazır palet açık ve koyu temada metinle birlikte okunur kalmalı; ekran görüntüleriyle iki temada göster. Kullanıcının özel rengi için zorlama yok, yalnızca okunurluğu düşükse tek satırlık uyarı.
- **Modül sınırı.** `src/core/` hiçbir modülü içe aktarmaz; bölümler yalnızca sözleşmeden geçer.
- **Görüşün gerek:** palet, renk seçicinin yerleşimi, modül düzeyinde kalan yerler, formdaki bölüm seçiminin yeri.

## Kapsam dışı

- Bölüm başına planlama ağırlığı, taban ya da kapasite
- Yapay zekanın bölüm seçmesi
- Gerçek modüller (rutin dahil); görsel cila (Ç4)

## Fazın sonunda

Faz raporuna ek: bölüm sözleşmesinde ilk gerçek modül (rutin) için eksik ya da zor bulduğun yerler.
