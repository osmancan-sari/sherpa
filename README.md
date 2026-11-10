# Sherpa

Bütün hayat alanlarındaki işleri tek havuzda toplayan ve her an sıradaki doğru işi gösteren kişisel, modüler planlama uygulaması. Masaüstünde ikinci ekranda açık durur, telefondan da kullanılır.

Depo tasarım dokümanlarını ve Claude Code ile faz faz yazılan kodu içerir. Hangi fazın bittiği ve sırada ne olduğu `docs/ILERLEME.md` içindedir; komutlar `CLAUDE.md` içindedir.

## Başlarken

**Ön koşullar (bir kez):** Node.js, git, Docker (yerel veritabanı için), VS Code ve Claude Code eklentisi.

1. Bu klasörü VS Code'da aç ve `git init` yap (depo özel olsun).
2. Claude Code'u başlat ve izin modunu **Auto** yap (istem kutusunun altındaki mod göstergesinden). Böylece her komut için tek tek onay istemez.
3. Şunu yaz: **`prompts/BASLA.md` dosyasını oku ve sıradaki fazı tamamla.**
4. Claude Code sıradaki fazı (ilk seferde Ç0) baştan sona kurar, ilerlemesini `docs/ILERLEME.md` dosyasına yazar ve faz bitince durur. Senin elinle yapılacak işler (bulut projeleri, API anahtarı, telefon kurulumu, görsel onay) o dosyadaki "Senden bekleyenler" listesinde birikir; onları beklemeden ilerler.
5. Faz bitince raporu oku, **yeni bir sohbet aç** ve aynı cümleyi yaz. Ç0'dan Ç5'e altı faz, altı sohbet. Bir faz yarıda kesilirse de yeni sohbette aynı cümle yeterlidir; kaldığı yerden devam eder.

Bir fazda plan onayı vererek adım adım ilerlemek istersen o fazın `prompts/c0-…` – `c5-…` istemini kullan.

## İki hat

- **Çekirdek (Ç0–Ç5):** Modüllerden bağımsızdır, tasarımı tamamdır. İstemler `prompts/c0-…` ile `prompts/c5-…` arasındadır.
- **Modüller:** Her biri Sherpa Claude projesinde ayrı bir sohbette tasarlanır (`prompts/claude-projesi-talimati.md`, `prompts/modul-tasarim-oturumu.md`), onaylanınca kurulur. Şu an hiçbiri onaylı değildir; `docs/moduller/` altındakiler taslaktır.

## İçindekiler

| Dosya | İçerik |
| --- | --- |
| `CLAUDE.md` | Claude Code için proje hafızası: yığın, kurallar, çalışma şekli |
| `docs/01-urun.md` | Sorun, çözüm, ilkeler, kavramlar, kapsam |
| `docs/02-mimari.md` | Yığın, klasör yapısı, kimlik, canlı güncelleme, yapay zeka bağlantıları |
| `docs/03-veri-modeli.md` | Çekirdek tablolar |
| `docs/04-planlayici.md` | Gün planı algoritması, skor, koruma kuralları, testler |
| `docs/05-arayuz.md` | Ekranlar, bileşenler, klavye, tasarım yönü |
| `docs/06-modul-sozlesmesi.md` | Modül tanımı ve tasarım şablonu |
| `docs/07-yol-haritasi.md` | Fazlar ve kabul ölçütleri |
| `docs/08-notion-aktarim.md` | Notion veritabanlarının Sherpa tablolarına eşlemesi |
| `docs/09-kararlar.md` | Kararlar, açık sorular, fikirler |
| `docs/10-yapay-zeka.md` | Yapay zeka katmanı: iş bölümü, çağrılar, kurallar, maliyet |
| `docs/11-yayin-ve-cihazlar.md` | Yayın, gizlilik, telefon ve ikinci ekran, cihazlar arası eşitleme |
| `docs/moduller/okul.md` | Okul modülünün tasarımı |
| `docs/moduller/okul-ninova.md` | Ninova bağlantısı: deneme bulguları ve tasarım |
| `docs/moduller/README.md` | Modül kataloğu ve diğer modüllerin taslakları |
| `prompts/BASLA.md` | Çekirdek fazlarının ortak istemi: her yeni sohbette sıradaki fazı kurdurur |
| `docs/ILERLEME.md` | Claude Code'un tuttuğu ilerleme kaydı |
| `prompts/c0-…` – `c5-…` | Aynı fazları plan onayıyla, adım adım yaptırmak için istemler |
| `prompts/modul-tasarim-oturumu.md` | Yeni bir modülü tasarlamak için Claude sohbetine verilecek istem |
| `prompts/claude-projesi-talimati.md` | Tasarım ve takip için açılacak Claude projesinin talimatı |

## Durum

- Çekirdek tasarımı tamam; açık sorular `docs/09-kararlar.md` içinde (hiçbiri Ç0 ve Ç1'i engellemez).
- Modüller taslak; Okul modülü ayrıntılı taslak (Ninova ve hazırlık dokümanları dahil), bekleyen kararlar `docs/moduller/okul-ninova.md` içinde.
- Kod: çekirdek hattı sürüyor; güncel durum `docs/ILERLEME.md` içinde.
