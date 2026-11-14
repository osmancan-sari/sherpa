# Rutin

Sabahın ve akşamın bakım adımları: üç ritim (Sabah, Duş ve hazırlık, Akşam kapanışı), adım adım yürüyen sahne, kendiliğinden tutulan kayıt. Tasarımın kendisi `docs/moduller/rutin.md`; ortak kurallar `docs/moduller/ORTAK.md`; çizimlerden alınan değerler `docs/moduller/rutin-cizimler/degerler.md`.

| Dosya | Ne |
| --- | --- |
| `module.ts` | Tanım: bölümler (Sabah, Akşam), sekmeler, sahne |
| `scene.ts` | Sahnenin ne zaman geldiği (sunucuda da okunur) |
| `queries.ts` | Dört tablo: `rutin_routines`, `rutin_steps`, `rutin_runs`, `rutin_run_steps` |
| `rules.ts` | Başlangıç listesi (ilk etkinleştirmede), üç ritmin teklifi, oturumla açılıp kapanan yapılış |
| `server/flow.ts` | Saf kurallar: günün adımları, `every_days`, yapılışın günü, süreler |
| `server/start-list.json` | Başlangıç listesi (8.1); yalnızca ilk etkinleştirmede yazılır |
| `sky.ts`, `brief.ts` | Saf: güneşin yüksekliği ve gökyüzü; günün özetinin metni |
| `components/` | Sahne (adım ekranı, Günaydın, "İyi günler", "İyi geceler"), sekmeler, adım düzenleme |

Adım, ürün ve alt adım adları kodda yazmaz; liste veridir ve modül sayfasından değişir.
