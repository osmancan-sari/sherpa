# İlerleme

Bu dosyayı Claude Code günceller. Yeni bir oturum yalnızca bu dosyayı ve `prompts/BASLA.md` dosyasını okuyarak kaldığı yerden devam edebilmelidir.

## Durum

- Faz: Ç0 (İskelet), sürüyor
- Adım: 8 / 8 (kabul ölçütleri, denetim, faz raporu). 1–7 bitti: kod, yerel Supabase, kimlik, kabuk, PWA, birim ve uçtan uca testler yeşil
- Kalan: kimlik adımının bağımsız denetimi, ekran görüntüleri, faz denetimi, faz raporu, `c0-tamam` etiketi
- Son commit: kapı komutları (`check`, `check:full`) ve uçtan uca testler

### Ç0 planı

1. Next.js + TypeScript strict + Tailwind + shadcn/ui; ESLint (çekirdek → modül içe aktarım yasağı dahil) ve Prettier
2. Klasör yapısı (`docs/02-mimari.md`), `src/modules/registry.ts` boş kayıt
3. Yerel Supabase (`supabase init`, `config.toml`: yeni kayıt kapalı, e-posta kodu şablonu), boş migration, tip üretimi
4. Kimlik: `/giris` (e-posta → kod), `ALLOWED_EMAIL` denetimi, `proxy` ile sayfa ve API koruması, uzun ömürlü oturum
5. Uygulama kabuğu: gezinme (Bugün, Hafta, Modüller, Gelen kutusu, Ayarlar), açık ve koyu tema, boş sayfalar
6. PWA manifesti ve simgeler, `noindex`
7. Vitest (örnek test + lint kuralı testi), Playwright (giriş, koruma, ekran görüntüleri)
8. Kabul ölçütleri, `CLAUDE.md` komutları, faz raporu, `c0-tamam` etiketi

Migration: yalnızca boş bir başlangıç migration'ı (çekirdek tablolar Ç1'de).
Senden istenecekler: D1 (Supabase `dev` ve `prod`, izinli e-posta, Vercel, kalıcı adres) ve D2 (telefon); ayrıntı aşağıda.

## Biten fazlar

Henüz yok.

## Sıradaki adım

Ç0: İskelet.

## Senden bekleyenler

Henüz yok.

## Verdiğim kararlar

| Tarih | Karar | Gerekçe | Etkilediği dosyalar |
| --- | --- | --- | --- |

## Bilinen sorunlar

Henüz yok.
