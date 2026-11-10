# Notion'dan aktarım

Okul verisi bugün Notion'da dört veritabanında duruyor. Okul modülünün 1. adımında bunlar bir kez Sherpa'ya aktarılır ve o andan sonra kaynak Sherpa olur. Notion'da hiçbir şey silinmez; ders içerik sayfaları Notion'da kalır ve ders kartından bağlantıyla açılır.

## Akış

1. **Dışa aktarım.** Notion verisi JSON dosyaları olarak `data/notion-export/` altına konur (bunu Claude sohbeti Notion bağlayıcısıyla üretir; uygulamada Notion API anahtarı gerekmez). Aktarım günü güncel dışa aktarım alınır.
2. **Kuru çalıştırma.** `import:notion --dry-run` kayıt sayılarını ve sorunlu satırları (eşleşmeyen ders kodu, ayrıştırılamayan saat, bilinmeyen seçenek) listeler; veritabanına yazmaz.
3. **Aktarım.** Betik `external_id` (Notion sayfa adresi) üzerinden upsert yapar; ikinci kez çalışınca kopya üretmez.
4. **Doğrulama.** Betik sonunda tablo başına sayı ve ders başına anlık toplam yazdırır; bunlar Notion'daki değerlerle karşılaştırılır.
5. **Geçiş.** İki hafta boyunca Notion yedek olarak durur ama güncellenmez.

## Dosyalar

```
data/notion-export/
  courses.json        Dersler
  assessments.json    Teslimler & Sınavlar
  sessions.json       Ders Oturumları
  tasks.json          Haftalık Görevler
```
Her dosya, Notion özellik adlarını anahtar olarak kullanan nesnelerin dizisidir; her nesnede sayfanın `url` alanı bulunur. Tarihler `date:<ad>:start` biçiminde gelebilir.

## Dönem kaydı

Sabit değerlerle oluşturulur: ad `26-27 Güz`, `starts_on = 2026-09-28` (W1'in pazartesisi), `break_weeks = [8]`.

## Eşleme

### Dersler → `school_courses`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Kod | `code` | |
| Ders Adı | `name` | |
| Ders Günü | `weekday` | Pazartesi = 1 |
| Saat | `start_time`, `end_time` | Metin; ayrıştırılamazsa `schedule_text`'e yazılır ve raporlanır |
| Claude Projesi | `claude_project_url` | |
| Lokal Klasör | `local_folder` | |
| Ders Sayfası | `notion_page_url` | |
| Notlandırma Notu | `grading_note` | |
| VF Şartları | `vf_conditions` | |
| Devamsızlık Hakkı (formül) | `absence_limit` | Dışa aktarımda yoksa boş kalır, elle girilir |
| Anlık Toplam, Katıldığım, Kaçırdığım... | — | Türetilir; aktarılmaz, doğrulamada karşılaştırılır |

Aktarımdan sonra her ders için bir `block_series` üretilir (gün ve saat varsa).

### Teslimler & Sınavlar → `school_assessments`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Kalem | `title` | |
| Ders Kodu / Ders | `course_id` | Kod ile eşlenir |
| Tür | `kind` | Quiz→quiz, Midterm→midterm, Final→final, Ödev→homework, Proje→project, Proje Adımı→project_step, Sunum→presentation |
| Tarih | `date`, `time` | Saat içeriyorsa `time` da dolar |
| Tarih Durumu | `date_status` | Kesin→exact, Tahmini→estimated, Belirsiz→unknown; tarih boşsa unknown |
| Zaman Notu | `time_note` | |
| Ağırlık | `weight` | |
| Not | `score` | |
| Hesaba Katılmaz | `excluded` | |
| Kapsam | `scope` | |
| Kaynak | `source` | |
| VF Şartı | `vf_condition` | |
| Hazırlık | `prep_outputs` | Konu PDF→topic_pdf, Pratik PDF→practice_pdf, Özet PDF→summary_pdf |
| Durum | `status` | Yapılacak→todo, Hazırlanıyor→preparing, Tamamlandı→done |
| Notlar | `notes` | |
| url | `external_id` | |

Proje adımlarının hangi projeye ait olduğu Notion'da tutulmuyor; `parent_id` boş gelir ve Projeler sekmesinde elle bağlanır.

### Ders Oturumları → `school_sessions`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Konu | `topic` | |
| Ders Kodu / Ders | `course_id` | |
| Tarih | `date` | |
| Ders Haftası | `course_week` | |
| Tür | `kind` | Ders→lecture, Sınav→exam, Sunum→presentation, Tatil→holiday |
| Devam | `attendance` | Katıldım→attended, Katılmadım→missed, boş→null |
| Notlar | `notes` | |
| url | `external_id` | |

### Haftalık Görevler → çekirdek `tasks`

| Notion | Sherpa | Not |
| --- | --- | --- |
| Name | `title` | |
| Ders Kodu | `meta.course_code` | "Genel" ise boş |
| Tür | `kind`, `meta.task_type` | Hazırlık→prep, Teslim→deadline/submit, Takip→task/follow_up, Materyal→task/material |
| Tür = Sınav | — | Aktarılmaz; sınavın kendisi değerlendirme ve oturumdur |
| Tür = Veri Girişi | — | Aktarılmaz; yerini olay soruları alır |
| Son Tarih | `due_at` | |
| Status | `status` | Backlog→todo, Planned→todo, In progress→todo, On Hold→waiting, Done→done |
| Priority | `importance` | Low→1, Medium→2, High→3, Critical→4 |
| Hazırlık Çıktısı | `meta.prep_output` | |
| Claude Komutu | `meta.claude_command` | |
| Kaynak | `meta.source` | |
| Teslim (ilişki) | `source_type = 'okul.assessment'`, `source_id` | |
| Arşiv = evet | — | Aktarılmaz |
| url | `meta.external_id` | |

Aktarılan hazırlık görevleri, ilgili değerlendirmenin hazırlık kaleminin (`key = assessment:<id>:prep`) altına oturum işi olarak bağlanır; kalem yoksa aktarım sırasında oluşturulur. Dersi ya da değerlendirmesi olmayan görevler bağımsız iş olarak kalır.

## Kopya önleme

Okul modülü her değerlendirme için bir hazırlık kalemi teklif eder. Teklif `key` ile tekrar edilebilir olduğu için aktarımda oluşturulan kalemle çakışmaz: aynı `key` yeni kayıt açmaz, mevcut kalemi günceller.
