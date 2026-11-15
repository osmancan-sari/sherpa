# Giriş ekranları

Kaynak: `docs/13-cam-dili.md` bölüm 4.9 (15 Kas 2026, onaylı); kurulduğu faz Ç4b. Değerler `src/core/ui/tokens.css`'te, parçalar `parcalar.md`'de; bu dosya düzeni, durumları ve başvuru karelerini anlatır.

## Giriş ekranları ("9 · Giriş ekranları" sayfası; onaylandı, 15 Kas 2026)

Tam manzara (karar 2); zemin günün saatine göre. Menü yok. Ortada tek ana panel (telefonda `spacing-login`, panoda `spacing-login-board`): "Sherpa", "E-postana tek kullanımlık bir kod gönderilir." Akış ve metinler koddaki gibidir (`src/app/giris/`).

- **E-posta adımı:** "E-posta" alanı (odakta), "Kod gönder" (birincil, tam genişlik).
- **Kod adımı:** "Giriş kodu" alanı (iri, ortalı, tek aralıklı, aralıklı rakamlar), altında "… adresine gelen kodu yaz."; "Giriş yap" (birincil); altında iki sessiz eylem: "Kodu yeniden gönder", "Başka e-posta".
- **Hata** alanın altında mercan renkte, simgeyle tek cümle; alan mercan kenar alır. **Bilgi** ("Yeni kod gönderildi.") açık renkte, onay simgesiyle.

| Kare | İçerik |
| --- | --- |
| `LT1` | Telefon, e-posta |
| `LT2` | "Bu e-posta ile giriş yapılamıyor." |
| `LT3` | "Kod gönderilemedi. Yeniden dene." |
| `LT4` | Kod |
| `LT5` | "Kod geçersiz ya da süresi dolmuş." |
| `LT6` | "Yeni kod gönderildi." |
| `LT7` | "Çok sık denendi. Biraz sonra yeniden dene." |
| `LT8` | Gece zemininde e-posta adımı |
| `LP1`–`LP3` | Pano: e-posta, kod, kod geçersiz |

Oturum düşünce bu ekrana sessizce dönülür; ayrı kare yoktur.

## Kurulum (Ç4b)

`src/app/giris/page.tsx`, `login-form.tsx`: tam manzara (`Backdrop kind=full`), tek ana panel (`glass-main`, `w-login` / `w-login-board`), kod alanı iri ve aralıklı (`tracking-code`), hata mercan renkte simgeyle, bilgi onay simgesiyle.
