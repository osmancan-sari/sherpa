# Modül şablonu

Yeni bir modül bu klasör kopyalanarak başlar. Sözleşmenin kendisi `docs/06-modul-sozlesmesi.md` içindedir; modülün tasarımı önce `docs/moduller/<slug>.md` olarak yazılıp onaylanır.

Aşağıdaki adımlarla boş bir modül yaklaşık 15 dakikada sayfasıyla birlikte ayağa kalkar. Örnek olarak `ev` modülü kuruluyor.

## Adımlar

1. **Kopyala.** `src/modules/_sablon` klasörünü `src/modules/ev` olarak kopyala.
   ```powershell
   Copy-Item -Recurse src/modules/_sablon src/modules/ev
   ```
2. **Adlandır.** `src/modules/ev/module.ts` içinde:
   - `export const sablon` → `export const ev`
   - `slug: "sablon"` → `slug: "ev"` (küçük harf, rakam, tire; klasör adıyla aynı)
   - `name`, `kind`, `color` değerlerini yaz
3. **Kaydet.** `src/modules/registry.ts` içinde tanımı içe aktar ve listeye ekle:
   ```ts
   import { ev } from "./ev/module";
   const definitions: ModuleDefinition[] = [ev, ...(DEMO_MODULE_ENABLED ? [deneme] : [])];
   ```
4. **Denetle.** `npm run check`. Sözleşmeye uymayan tanım (geçersiz `slug`, yinelenen sekme anahtarı, başka adla başlayan olay ya da tablo) burada hata verir ve neyin yanlış olduğunu söyler.
5. **Aç.** `npm run dev` → Ayarlar → Modüller → "Etkinleştir". Modül çipi Bugün ekranında, sayfası `/m/ev` adresinde görünür; hızlı girişte modül olarak seçilebilir.

Buraya kadar çekirdekte tek satır değişmez; değişen dosyalar yalnızca `src/modules/ev/*` ve `src/modules/registry.ts`.

## Sonra

| Ne | Nerede |
| --- | --- |
| Modülün kendi tablosu | `npm run db:new -- ev_<ad>` ile migration; her tabloda `user_id` ve RLS; tablo adı `ev_` ile başlar. Sonra `npm run db:migrate` ve `npm run db:types`. Tabloyu `module.ts` içinde `tables` listesine ekle (dışa aktarım) |
| Sorgular | `queries.ts`: kendi tabloların `ctx.db` ile; çekirdekteki işlerin `ctx.work` ile |
| İş teklifi | `rules.ts`: `ctx.propose(zarf)`; kaynak kayıt silinince `ctx.withdraw(key)` |
| Giriş türü | `module.ts` → `intake`: alanlar ve `handle`; hızlı girişte kendiliğinden görünür |
| Olay | `emits` içinde bildir, `ctx.emit` ile yayınla; dinlemek için `rules.ts` → `listeners` |
| Sekme, alt sayfa, tam ekran, hızlı eylem, ayar formu | `module.ts` → `ui`; bileşenler `components/` altında, `useModule()` ile bağlama ulaşır |
| Çekirdekten içe aktarılabilenler | `docs/06-modul-sozlesmesi.md`, "Modül çekirdekten neyi içe aktarabilir": `useModule()`, `useModuleQuery`, `useRefreshAll`, `useNotify`. Bağlam üzerinden yazdıktan sonra `refreshAll()` çağır |
| Ortak bileşenler | `@/core/ui/kit`: tablo, grafikler, ızgara, zaman çizelgesi, adımlayıcı, çipler, zamanlayıcı, boş ve hata durumları |

Her bağlantı noktasının çalışan bir örneği `src/modules/deneme` içindedir.

## Kurallar

- Çekirdek tablolara doğrudan yazma; iş üretmenin tek yolu `ctx.propose`. Tek istisna olay soruları: `ctx.ask`.
- Başka bir modülü içe aktarma; modüller yalnızca olaylarla haberleşir.
- Arayüz çekirdeğin tasarım dilini kullanır ve pano ile telefon yerleşiminin ikisinde de çalışır.
