# Notion'dan aktarım

Okul verisi bugün Notion'da dört veritabanında duruyor. Okul modülünün 1. adımında bunlar bir kez Sherpa'ya aktarılır ve o andan sonra kaynak Sherpa olur. Notion'da hiçbir şey silinmez; ders içerik sayfaları Notion'da kalır ve ders kartından bağlantıyla açılır.

Kuruldu: Okul Adım 1 (23 Kas 2026). Kod: `src/modules/okul/server/notion.ts` (okuma ve eşleme, saf), `src/modules/okul/server/importer.ts` (yazma), `scripts/import-notion.ts` (komut). Test: `tests/db/okul-import.test.ts` (uydurma dışa aktarım `tests/fixtures/notion-export/`).

## Akış

1. **Dışa aktarım.** Notion verisi JSON dosyaları olarak `data/notion-export/` altına konur (bunu Claude sohbeti Notion bağlayıcısıyla üretir; uygulamada Notion API anahtarı gerekmez). Klasör depoya girmez; içeriği kişisel veridir.
2. **Kuru çalıştırma.** `npm run import:notion` tablo başına yeni ve var olan kayıt sayısını, tarihsiz değerlendirme sayısını, aktarılmayan görevleri türüne göre, okunamayan satırları (eşleşmeyen ders kodu, okunamayan saat, bilinmeyen tür) ve saatsiz zaman notlarının sayısını yazar; veritabanına yazmaz. Okul etkin değilken de çalışır. Komut bayraksız hep kuru çalışır; yazmak açık bir `--write` ister (PowerShell `--`'yu yutup bayrağı npm'e bırakırsa da betik `npm_config_write`'ı okur; bayrak hiç ulaşmazsa yine kuru çalışır, yazmaz).
3. **Aktarım.** `npm run import:notion -- --write` Okul etkin olan hesaba (`ALLOWED_EMAIL`) yazar: önce dönem, sonra dersler, değerlendirmeler, oturumlar ve görevler; her biri `external_id` (Notion sayfa adresi) üzerinden upsert. İkinci çalıştırma kopya üretmez. Sonunda modülün bütün teklifleri gönderilir (`syncAll`).
4. **Doğrulama.** Betik sonunda tablo başına sayı ve ders başına anlık toplam yazar; bunlar Notion'daki değerlerle karşılaştırılır. Çıktıda içerik yoktur, yalnızca sayı ve ders kodu.
5. **Geçiş.** İki hafta boyunca Notion yedek olarak durur ama güncellenmez.

Betik yalnızca yerel Supabase'e yazar; başka bir projeye yalnızca `--write --remote --env <dosya>` ile (üretimde aktarım ayrı bir adımdır ve kullanıcının izniyle yapılır: önce kuru çalıştırma, sayılar onaylanınca aktarım). Seçenekler: `--dir <klasör>` (varsayılan `data/notion-export`), `--env <dosya>` (varsayılan `.env.local`).

**Kullanıcının sonradan değiştirdiği korunur:** elle verilen tarih (`date_source = user`), elle girilen not, işaretlenen devam (`attendance_at` dolu), dersin rengi ve devam şartı, "Yapılacak"tan ilerlemiş durum. Aktarım bunların üzerine yazmaz.

## Dosyalar

```
data/notion-export/
  courses.json        Dersler
  assessments.json    Teslimler & Sınavlar
  sessions.json       Ders Oturumları
  tasks.json          Haftalık Görevler
```
Her dosya, Notion özellik adlarını anahtar olarak kullanan nesnelerin dizisidir; her nesnede sayfanın `url` alanı bulunur. Tarihler `date:<ad>:start` alanındadır ve yalnız gündür; saat varsa "Zaman Notu" metnindedir. Onay kutuları `"__YES__"` / `"__NO__"`.

## Dönem kaydı

Sabit değerlerle oluşturulur (yoksa): ad `26-27 Güz`, `starts_on = 2026-09-28` (W1'in pazartesisi), `ends_on = 2026-12-31`, final dönemi 2–17 Ocak 2027, `break_weeks = [8]`.

## Eşleme

### Dersler → `okul_courses`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Kod | `code` | Boşluklar atılır, büyük harf ("YZV 406E" → "YZV406E") |
| Ders Adı | `name` | |
| Ders Günü | `weekday` | Pazartesi = 1 |
| Saat | `start_time`, `end_time` | "09:30" ya da "09:30-12:20"; okunamazsa `schedule_text`'e yazılır ve raporlanır. Notion'da yalnızca başlangıç var: bitiş yokken ders bloğu 3 saat sürer (Ninova Adım 2'de verir) |
| VF Şartları | `vf_conditions` | `[{ text }]` |
| Notlandırma Notu | `grading_note` | |
| Claude Projesi | `claude_project_url` | |
| Lokal Klasör | `local_folder` | |
| Ders Sayfası | `notion_page_url` | |
| — | `color` | Altı rengin sırasıyla (`COURSE_PALETTE`); kullanıcı değiştirebilir |
| — | `absence_limit`, `attendance_min_pct` | Devam şartı; Notion'da yok, ders sayfasından girilir |
| Anlık Toplam, Katıldığım, Kaçırdığım… | — | Formül alanları dışa aktarılamadı; türetilir |

### Teslimler & Sınavlar → `okul_assessments`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Kalem | `title` | |
| Ders Kodu | `course_id` | Kod ile eşlenir; eşleşmeyen satır aktarılmaz ve raporlanır |
| Tür | `kind` | Quiz→quiz, Midterm→midterm, Final→final, Ödev→homework, Proje→project, Proje Adımı→project_step, Sunum→presentation |
| Tarih | `date` | |
| Zaman Notu | `time_note`, `time` | Metindeki saat ("23:59", "ders 14:30") `time`'a; saatsiz not metin olarak kalır ve sayısı raporlanır |
| Tarih Durumu | `date_status` | Tarih yoksa `unknown` ("Tahmin edilemeyen"; plana girmez); Kesin→exact; Tahmini ve tarihli Belirsiz→estimated |
| — | `date_source` | `notion` |
| Ağırlık | `weight` | |
| Not | `score`, `score_source = user` | Dışa aktarımda hiç not yok |
| Hesaba Katılmaz | `excluded` | |
| Kapsam | `scope_text` | |
| Kaynak | `source_text` | |
| VF Şartı | `vf_condition` | |
| Hazırlık | — | Boş; dokümanlar Adım 3 |
| Durum | `status` | Yapılacak→todo, Hazırlanıyor→preparing, Tamamlandı→done |
| Notlar | `notes` | |
| url | `external_id` | |

Ödev, proje ve proje adımı `submits = true` (teslimle biter), `output_kind = written` (kod olduğu Adım 2'de Ninova'dan anlaşılır). Proje adımının sahibi `me`.

Proje adımlarının hangi projeye ait olduğu Notion'da tutulmuyor: tek projesi olan derste adımlar o projeye bağlanır, öbürlerinde `parent_id` boş kalır.

### Ders Oturumları → `okul_sessions`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Konu | `topic` | |
| Ders Kodu | `course_id` | |
| Tarih | `date` | |
| Ders Haftası | `course_week` | "W3" → 3 |
| Tür | `kind` | Ders→lecture, Sınav→exam, Sunum→presentation, Tatil→holiday |
| Devam | `attendance` | Katıldım→attended, Katılmadım→missed, boş→null |
| Notlar | `notes` | |
| url | `external_id` | |

### Haftalık Görevler → `okul_tasks` (Okul Adım 1, karar 7)

Yalnızca **açık ve arşivsiz Takip ve Materyal** görevleri aktarılır; her biri modülün bağımsız işi olur (`okul.task`). Aktarılmayanlar türüne göre sayılır.

| Notion | Sherpa | Not |
| --- | --- | --- |
| Name | `title` | |
| Ders Kodu | `course_id` | "Genel" ya da eşleşmeyen kod boş kalır |
| Tür | `kind` | Takip→follow_up, Materyal→material |
| Son Tarih | `due_on` | |
| Priority | `importance` | Low→1, Medium→2, High→3, Critical→4 |
| url | `external_id` | |
| Tür = Hazırlık, Teslim | — | Aktarılmaz: yerlerini modülün kendi kalemleri alır (sınav hazırlığı, teslim). Eski "hazırlık görevleri kalemin altına oturum işi olur" hükmü kalktı: "doküman olmadan oturum açılmaz" kuralıyla çelişiyordu |
| Tür = Sınav | — | Aktarılmaz; sınavın kendisi değerlendirme ve bloktur |
| Tür = Veri Girişi | — | Aktarılmaz; yerini girişler ve olay soruları alır |
| Tür boş | — | Aktarılmaz (okul işi değil) |
| Arşiv = evet, Status = Done | — | Aktarılmaz |

## Kopya önleme

Her kayıt Notion adresiyle tekildir (`unique (user_id, external_id)`); aktarım önce var olanları okur, yenileri ekler, var olanları günceller. Modülün teklifleri `key` ile tekrar edilebilir (`prep:<id>`, `hw:<id>`, `lesson:<id>`…): aynı `key` yeni kayıt açmaz, var olan kalemi günceller.

## İlk gerçek kuru çalıştırma (23 Kas 2026, yerel)

6 ders, 59 değerlendirme (21'i tarihsiz), 86 oturum; 47 görevden 1'i aktarılır (46'sı türüne göre aktarılmaz: Hazırlık 5, Teslim 6, Sınav 8, Veri Girişi 8, türsüz 2, arşivli Takip 9, arşivli Materyal 8). 13 zaman notunda saat yok; 9 proje adımından 7'si dersin tek projesine bağlanır. Anlık toplamlar sıfır (Notion'a not girilmemiş). Okunamayan satır yok. Yerel veritabanında bir kez aktarılıp ikincisinde kopya üretmediği görüldü, sonra silindi.
