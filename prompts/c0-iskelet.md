# Ç0: İskelet

Aşağıdaki metni Claude Code'a olduğu gibi ver.

---

Bu depoda Sherpa adlı uygulamanın tasarım dokümanları var; henüz kod yok. Önce şu dosyaları oku: `CLAUDE.md`, `docs/01-urun.md`, `docs/02-mimari.md`, `docs/11-yayin-ve-cihazlar.md` ve `docs/07-yol-haritasi.md`.

Görevin Ç0 fazını tamamlamak. Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde, "Ç0: İskelet" başlığı altında.

Çekirdek tabloları, planlayıcıyı, yapay zekayı ya da herhangi bir modülü bu fazda kurma.

Benim elle yapmam gereken adımları (Supabase ve Vercel projeleri, anahtarlar, izinli e-posta, kalıcı adres) sırasıyla ve tek tek söyle. Klasör yapısını `docs/02-mimari.md` içindeki gibi kur ve `src/core/` içinden `src/modules/` içe aktarımını yasaklayan lint kuralını şimdiden ekle. Giriş yöntemi sihirli bağlantı değil, e-postaya gelen kod olacak (nedeni `docs/11-yayin-ve-cihazlar.md` içinde).

Çalışma şekli:

1. Başlamadan önce kısa bir plan yaz: yapacağın işlerin sırası, açacağın migration'lar, benden isteyeceğin bilgiler. Planı onaylamamı bekle.
2. Paket sürümlerini ve API biçimlerini ezberden yazma; emin olmadığın yerde resmi dokümana bak.
3. Fazın kapsamı dışına çıkma. Aklına gelen iyileştirmeyi `docs/09-kararlar.md` altındaki "Fikirler" listesine ekle.
4. Dokümanla çelişen bir şey yapman gerekiyorsa dur ve sor.
5. Bittiğinde: kabul ölçütlerini tek tek doğrula, `CLAUDE.md` içindeki komutları güncel tut, yaptıklarının kısa bir özetini ver. Sağlayamadığın ölçüt varsa nedenini söyle.
