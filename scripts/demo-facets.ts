import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { activateModule } from "@/core/data/module-rows";
import { updateWorkItem } from "@/core/data/work";
import { type Db, unwrap } from "@/core/types";
import { dayKey, shiftDay } from "@/lib/date";
import { deneme, topicFacet } from "@/modules/deneme/module";
import { addItem } from "@/modules/deneme/rules";

// Ç3e: sample work in facets. The sample modules of scripts/demo-data.ts have no code, so no
// facets; the "deneme" module has (two fixed ones and one per topic). This switches it on and
// adds records through the module's own rules, the way the user would: a morning habit, an
// evening goal, a topic and a goal the user put in that topic from the form. Only where the
// module is registered (NEXT_PUBLIC_SHERPA_DEMO_MODULE=1), and only on the local stack.

export async function seedFacets(db: Db, now: Date): Promise<{ deneme_items: number }> {
  const registry = createRegistry([deneme]);
  const row = await activateModule(db, registry, deneme);
  const ctx = createModuleContext({ db, registry, module: row, now: () => now });
  const today = dayKey(now);

  await addItem(ctx, { title: "Sabah esnemesi", kind: "aliskanlik", minutes: 15, facet: "sabah" });
  await addItem(ctx, {
    title: "Günlük yaz",
    kind: "hedef",
    minutes: 20,
    due_on: today,
    facet: "aksam",
  });
  const topic = await addItem(ctx, { title: "İstatistik", kind: "konu" });
  await addItem(ctx, {
    title: "İstatistik ödevi",
    kind: "hedef",
    minutes: 60,
    due_on: shiftDay(today, 2),
  });
  // The user puts the homework in its topic from the form: the facet is the user's.
  const homework = unwrap(
    await db.from("work_items").select("id").eq("title", "İstatistik ödevi").single(),
  );
  await updateWorkItem(db, homework.id, { facet: topicFacet(topic.id) });

  const items = unwrap(await db.from("deneme_items").select("id"));
  return { deneme_items: items.length };
}
