import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { activateModule } from "@/core/data/module-rows";
import { createRhythm, updateRhythm } from "@/core/data/work";
import { type Db, unwrap } from "@/core/types";
import { deneme } from "@/modules/deneme/module";
import { TEMPLATE_COPY } from "@/modules/registry";
import { addItem } from "@/modules/deneme/rules";

// Ç3f: the anchored chains of two modules. The "deneme" module proposes its routines itself
// (kind "rutin", with a place in the chain); the template copy has no rules, so the user's own
// rhythms in it are bound to the waking and the bedtime from the form's "Zaman" part (here
// written the same way, through the core). On the waking: teeth (deneme, 10), the neck (the
// copy, 20), shower (deneme, 30); on the bedtime: stretching (the copy, 10), teeth (deneme, 20).
// Only where the test module is registered, and only on the local stack. After seedFacets: the
// test module is already on.

export async function seedChains(db: Db, now: Date): Promise<{ chain_work: number }> {
  const registry = createRegistry([deneme, TEMPLATE_COPY]);
  const row = await activateModule(db, registry, deneme);
  const ctx = createModuleContext({ db, registry, module: row, now: () => now });
  await addItem(ctx, {
    title: "Diş ve su",
    kind: "rutin",
    minutes: 5,
    facet: "sabah",
    chain_order: 10,
  });
  await addItem(ctx, {
    title: "Duş ve hazırlık",
    kind: "rutin",
    minutes: 20,
    facet: "sabah",
    chain_order: 30,
  });
  await addItem(ctx, {
    title: "Akşam diş",
    kind: "rutin",
    minutes: 5,
    facet: "aksam",
    chain_order: 20,
  });

  const copy = await activateModule(db, registry, TEMPLATE_COPY);
  const own = [
    { title: "Boyun hareketleri", minutes: 10, timing: { anchor: "wake" as const, order: 20 } },
    { title: "Akşam esnemesi", minutes: 10, timing: { anchor: "bed" as const, order: 10 } },
  ];
  for (const work of own) {
    const rhythm = await createRhythm(db, {
      module_id: copy.id,
      title: work.title,
      target_count: 1,
      period: "day",
      est_minutes: work.minutes,
    });
    await updateRhythm(db, rhythm.id, { timing: work.timing });
  }

  const rows = unwrap(
    await db.from("rhythms").select("id, timing").not("timing->anchor", "is", null),
  );
  return { chain_work: rows.length };
}
