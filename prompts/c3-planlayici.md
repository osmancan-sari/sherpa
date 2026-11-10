# Ç3: Planlayıcı

Aşağıdaki metni Claude Code'a olduğu gibi ver.

---

Ç1 ve Ç2 tamamlandı. Önce şu dosyaları oku: `CLAUDE.md`, `docs/04-planlayici.md`, `docs/05-arayuz.md`, `docs/10-yapay-zeka.md` ve `docs/07-yol-haritasi.md`.

Görevin Ç3 fazını tamamlamak. Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde, "Ç3: Planlayıcı" başlığı altında.

Önce saf fonksiyonları ve testlerini yaz (`buildPlan`, `pickForMinutes`, `loadByWeek`, `commitWeek`); arayüze ve yapay zeka çağrılarına testler geçtikten sonra geç. Planlayıcı veritabanına, saate ve ağa dokunmayacak. Yapay zeka önerisi yokken de her ufukta geçerli bir plan çıkmalı; öneri hiçbir koruma kuralını aşamamalı.

Öğrenme kısmını (tahmin ve kapasite çarpanları) fazın sonuna bırak.

Çalışma şekli:

1. Başlamadan önce kısa bir plan yaz: yapacağın işlerin sırası, açacağın migration'lar, benden isteyeceğin bilgiler. Planı onaylamamı bekle.
2. Paket sürümlerini ve API biçimlerini ezberden yazma; emin olmadığın yerde resmi dokümana bak.
3. Fazın kapsamı dışına çıkma. Aklına gelen iyileştirmeyi `docs/09-kararlar.md` altındaki "Fikirler" listesine ekle.
4. Dokümanla çelişen bir şey yapman gerekiyorsa dur ve sor.
5. Bittiğinde: kabul ölçütlerini tek tek doğrula, `CLAUDE.md` içindeki komutları güncel tut, yaptıklarının kısa bir özetini ver. Sağlayamadığın ölçüt varsa nedenini söyle.
