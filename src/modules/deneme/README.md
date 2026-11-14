# Deneme modülü

Çekirdeğin, gerçek modüller gelene kadar sınandığı küçük modül. Sözleşmenin (`docs/06-modul-sozlesmesi.md`) her bağlantı noktasını en basit haliyle bir kez kullanır; yeni modül yazarken çalışan örnek olarak bakılır.

Yalnızca `NEXT_PUBLIC_SHERPA_DEMO_MODULE=1` verilen ortamlarda kaydolur (`src/modules/registry.ts`); üretimde kaydolmaz.

| Bağlantı noktası | Nerede |
| --- | --- |
| Kendi tablosu (`deneme_items`) ve sorguları | `queries.ts`, `supabase/migrations/*_deneme_items.sql` |
| İş teklifi: son tarih, tekrar ve sabit zaman biçimleri; geri çekme | `rules.ts` (`proposalFor`, `addItem`, `changeItem`, `removeItem`) |
| Zaman kısıtları (`timing`): pencere, tercih, kaçınma, yol, dinlenme günü | `rules.ts` (`antrenman` türü, `WORKOUT_TIMING`) |
| Sonuç bildirimi ve olay sorusu | `rules.ts` (`onOutcome`, `listeners`) |
| Olay yayını ve dinleme | `rules.ts` (`EVENTS`, `listeners`) |
| Çip, şimdi kartı içeriği, uyarı, giriş türü, yapılı blok, mod davranışı, haftalık rapor, yaşam döngüsü | `module.ts` |
| Sekmeler, alt sayfa, tam ekran görünüm, hızlı eylemler, ayar formu, geçmiş görünümü | `module.ts` içinde `ui`; bileşenler `components/` altında |
| Çapalı dizi (Ç3f): uyanışa ya da yatışa bağlı günlük rutin, dizide sırası (`timing.anchor`, `timing.order`); diziyi çizen sahne, sahneden kapanış ve "Yatıyorum" | `rules.ts` (`rutin` türü, `chain_order`), `components/Scenes.tsx` (`ChainList`, gece sahnesi); örnek veri `scripts/demo-chains.ts` |

Davranışı uçtan uca `tests/e2e/deneme-module.spec.ts` sınar.
