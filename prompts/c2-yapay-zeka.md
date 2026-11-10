# Ç2: Yapay zeka geçidi

Aşağıdaki metni Claude Code'a olduğu gibi ver.

---

Ç1 tamamlandı: çekirdek, modül sistemi ve iş zarfı çalışıyor. Önce şu dosyaları oku: `CLAUDE.md`, `docs/10-yapay-zeka.md`, `docs/06-modul-sozlesmesi.md` ve `docs/07-yol-haritasi.md`.

Görevin Ç2 fazını tamamlamak. Kapsam ve kabul ölçütleri `docs/07-yol-haritasi.md` içinde, "Ç2: Yapay zeka geçidi" başlığı altında.

Planlama çağrılarını (`plan`, `week`, `month`, `review`, `replan`) bu fazda kurma; onlar Ç3'te.

Önce Anthropic SDK'sının ve araç kullanımıyla yapılı çıktının güncel biçimine resmi dokümandan bak. Model adları ortam değişkeninden okunacak. Her çağrı tek geçitten geçecek, şemayla doğrulanacak, `ai_calls` tablosuna maliyetiyle yazılacak ve anahtar yokken ya da bütçe dolunca uygulama hatasız çalışacak. İstemleri ayrı dosyalarda tut ve her istem için `scripts/ai-eval/` altında birkaç örnek yaz.

Çalışma şekli:

1. Başlamadan önce kısa bir plan yaz: yapacağın işlerin sırası, açacağın migration'lar, benden isteyeceğin bilgiler. Planı onaylamamı bekle.
2. Paket sürümlerini ve API biçimlerini ezberden yazma; emin olmadığın yerde resmi dokümana bak.
3. Fazın kapsamı dışına çıkma. Aklına gelen iyileştirmeyi `docs/09-kararlar.md` altındaki "Fikirler" listesine ekle.
4. Dokümanla çelişen bir şey yapman gerekiyorsa dur ve sor.
5. Bittiğinde: kabul ölçütlerini tek tek doğrula, `CLAUDE.md` içindeki komutları güncel tut, yaptıklarının kısa bir özetini ver. Sağlayamadığın ölçüt varsa nedenini söyle.
