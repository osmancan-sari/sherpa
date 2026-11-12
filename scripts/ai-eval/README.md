# Yapay zeka kalite denetimi

`enrich` çağrısının hızlı girişi ne kadar doğru okuduğunu ölçer ve planlama çağrılarının tonunu denetler (`docs/10-yapay-zeka.md`, "Kalite denetimi").

- `cases.json`: 30 örnek satır ve beklenen sonuçları (modül, iş ya da iş kalemi, süre, son tarih). Satırlar 11 Kasım 2026 çarşamba gününe göre okunur. Kullanıcının gerçek girişleri birikince bu örnekler onlarla değiştirilmeli.
- `tone-cases.json`: suçlamaya davet eden 4 planlama çağrısı (`plan`, `replan`, `week`, `review`); yanıtlarda kullanıcının okuyacağı her cümle yasaklı kalıplara (ürün kuralı 2: geçmişi sayan, suçlayan sözcükler) karşı taranır.
- `npm run ai:eval`: gerçek modele sorar (`.env.local` içinde `ANTHROPIC_API_KEY`, `AI_MODEL_FAST` ve `AI_MODEL_PLAN`); birkaç sent tutar. Çağrılar uygulamanın geçidinden yerel hesapla (`ALLOWED_EMAIL`, yerel Supabase) yapılır; her biri `ai_calls` tablosuna maliyetiyle yazılır ve ayın bütçesine sayılır. İstem ve model değişmediyse önceki yanıtlar yeniden kullanılır (kural 10); yeniden sormak için istemin `version` değeri değişir.
- `npm run ai:eval -- --fake`: betiği sahte sağlayıcıyla dener (anahtar gerekmez, sonuçlar anlamsızdır). İkisi de yerel Supabase ve `npm run db:user` ile açılmış hesap ister.

Rapor: yönlendirme doğruluğu, iş / iş kalemi ayrımı, son tarih doğruluğu, süre tahmininin ortanca bağıl sapması (`enrich` süre vermediyse `size`'ın tahminiyle, uygulamadaki gibi), yanlış okunan satırlar; ton örneklerinden kaçının temiz olduğu ve bulunan yasaklı sözcükler.

Ne zaman çalıştırılır: istemler (`src/core/ai/calls/enrich.ts`, `size.ts`, `planning.ts`) ya da modeller değişince. Sonucu `docs/ILERLEME.md` içine tarih ve modelle not et.
