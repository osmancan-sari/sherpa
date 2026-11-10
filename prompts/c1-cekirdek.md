# Ç1: Çekirdek ve modül temeli

Aşağıdaki metni Claude Code'a olduğu gibi ver.

---

Ç0 tamamlandı: uygulama yayında ve giriş çalışıyor. Önce şu dosyaları oku: `CLAUDE.md`, `docs/03-veri-modeli.md`, `docs/06-modul-sozlesmesi.md`, `docs/05-arayuz.md` ve `docs/07-yol-haritasi.md`.

Görevin Ç1 fazını tamamlamak. Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde, "Ç1: Çekirdek ve modül temeli" başlığı altında.

Planlayıcıyı ve yapay zeka çağrılarını bu fazda kurma; Bugün ekranı şimdilik basit bir sıralı listedir ve eforu boş gelen zarfa sınırın ortası yazılır. Gerçek modül (Okul, Beslenme vb.) kurma; yalnızca `_sablon` ve `deneme` modüllerini yaz.

Bu fazın en önemli çıktısı modül sözleşmesidir: `deneme` modülü çekirdeğe yalnızca `ModuleDefinition` ve `propose` üzerinden bağlanmalı. Sözleşmede eksik ya da belirsiz bulduğun yeri kodlamadan önce bana sor ve `docs/06-modul-sozlesmesi.md` dosyasını güncelle; sonraki bütün modüller bu sözleşmeye dayanacak.

Çalışma şekli:

1. Başlamadan önce kısa bir plan yaz: yapacağın işlerin sırası, açacağın migration'lar, benden isteyeceğin bilgiler. Planı onaylamamı bekle.
2. Paket sürümlerini ve API biçimlerini ezberden yazma; emin olmadığın yerde resmi dokümana bak.
3. Fazın kapsamı dışına çıkma. Aklına gelen iyileştirmeyi `docs/09-kararlar.md` altındaki "Fikirler" listesine ekle.
4. Dokümanla çelişen bir şey yapman gerekiyorsa dur ve sor.
5. Bittiğinde: kabul ölçütlerini tek tek doğrula, `CLAUDE.md` içindeki komutları güncel tut, yaptıklarının kısa bir özetini ver. Sağlayamadığın ölçüt varsa nedenini söyle.
