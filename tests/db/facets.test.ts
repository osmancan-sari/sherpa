import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProposalError } from "@/core/contract/envelope";
import { FacetError } from "@/core/contract/facets";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition, ModuleFacet, WorkProposal } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { endSessionTold, startSessionTold } from "@/core/data/session-events";
import { startSession } from "@/core/data/sessions";
import { updateRhythm, updateTask, updateWorkItem } from "@/core/data/work";
import type { AppEvent, ModuleRow } from "@/core/types";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// A module's facets in the data (docs/06-modul-sozlesmesi.md, "Bölümler"; docs/03; Ç3e): the
// envelope checks the key against the module's list as it is now, the facet is a fact the user
// can own, a sitting has its item's facet, the session events carry it, and the database checks
// the spelling of keys and colours.

const db = ownerDb();
beforeEach(wipe);
afterAll(wipe);

const SOURCE = { type: "bolumlu.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" };

function definition(facets: () => ModuleFacet[] | null, heard: AppEvent[] = []): ModuleDefinition {
  const view = () => null;
  return {
    slug: "bolumlu",
    name: "Bölümlü",
    kind: "lifelong",
    color: "#2563eb",
    ...(facets() === null ? {} : { facets: async () => facets()! }),
    chip: async () => ({ text: "", health: "ok" }),
    intake: [],
    emits: [],
    on: {
      "core.session_started": async (event) => void heard.push(event),
      "core.session_ended": async (event) => void heard.push(event),
    },
    modeBehavior: {
      normal: { weightMultiplier: 1, floorMultiplier: 1 },
      busy: { weightMultiplier: 1, floorMultiplier: 1 },
      minimum: { weightMultiplier: 1, floorMultiplier: 1 },
      holiday: { weightMultiplier: 1, floorMultiplier: 1 },
    },
    weeklyReport: async () => ({ metrics: [], suggestions: [] }),
    ui: { tabs: [{ key: "genel", label: "Genel", component: view }] },
  };
}

const SABAH: ModuleFacet = { key: "sabah", name: "Sabah", color: "#d97706" };
const AKSAM: ModuleFacet = { key: "aksam", name: "Akşam", color: "#4361d8" };

/** A module whose facet list the test can change between proposals (the data changed). */
async function setup(list: ModuleFacet[] | null = [SABAH, AKSAM]) {
  let facets = list;
  const heard: AppEvent[] = [];
  const def = definition(() => facets, heard);
  const registry = createRegistry([def]);
  const row: ModuleRow = await makeModule(db, "bolumlu", "Bölümlü");
  const ctx = createModuleContext({ db, registry, module: row });
  return {
    ctx,
    row,
    heard,
    told: { db, registry },
    setFacets: (next: ModuleFacet[] | null) => void (facets = next),
  };
}

const item = (extra: Partial<WorkProposal> = {}): WorkProposal => ({
  schema: 1,
  key: "kayit:1",
  source: SOURCE,
  title: "Sabah esnemesi",
  when: { due: null },
  effort: { total_minutes: 60, session_minutes: 30 },
  ...extra,
});

describe("the envelope's facet", () => {
  it("is written to the work item, the rhythm and the block", async () => {
    const { ctx } = await setup();
    const a = await ctx.propose(item({ facet: "sabah" }));
    const b = await ctx.propose(
      item({
        key: "r",
        facet: "aksam",
        when: { recurrence: { count: 3, period: "week" } },
        effort: { session_minutes: 15 },
      }),
    );
    const c = await ctx.propose(
      item({
        key: "b",
        facet: "sabah",
        when: {
          fixed: { starts_at: "2026-11-20T10:00:00+03:00", ends_at: "2026-11-20T11:00:00+03:00" },
        },
        effort: undefined,
      }),
    );
    expect(ok(await db.from("work_items").select("facet").eq("id", a.id).single()).facet).toBe(
      "sabah",
    );
    expect(ok(await db.from("rhythms").select("facet").eq("id", b.id).single()).facet).toBe(
      "aksam",
    );
    expect(ok(await db.from("blocks").select("facet").eq("id", c.id).single()).facet).toBe("sabah");
    expect(a.changed).toContain("facet");
  });

  it("refuses a key that is not in the module's list now, naming the field", async () => {
    const { ctx } = await setup();
    const refused = ctx.propose(item({ facet: "ogle" }));
    await expect(refused).rejects.toBeInstanceOf(ProposalError);
    await expect(refused).rejects.toThrow(/facet: "ogle" is not one of the module's facets/);
    // A badly spelled key is refused by the envelope itself.
    await expect(ctx.propose(item({ facet: "Sabah" }))).rejects.toThrow(/^.*facet: lower-case/m);
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
  });

  it("is refused from a module without facets, and never written by one", async () => {
    const { ctx } = await setup(null);
    await expect(ctx.propose(item({ facet: "sabah" }))).rejects.toThrow(
      /facet: the module has no facets/,
    );
    const result = await ctx.propose(item());
    // Nothing about facets in what changed: a module without them is as before.
    expect(result.changed).not.toContain("facet");
    const row = ok(
      await db.from("work_items").select("facet, provenance").eq("id", result.id).single(),
    );
    expect(row.facet).toBeNull();
    expect(row.provenance).not.toHaveProperty("facet");
  });

  it("is a fact: an empty facet clears it", async () => {
    const { ctx } = await setup();
    const { id } = await ctx.propose(item({ facet: "sabah" }));
    const again = await ctx.propose(item());
    expect(again.changed).toEqual(["facet"]);
    expect(ok(await db.from("work_items").select("facet").eq("id", id).single()).facet).toBeNull();
  });

  it("the user's facet is kept from the module's next proposal", async () => {
    const { ctx } = await setup();
    const { id } = await ctx.propose(item({ facet: "sabah" }));
    await updateWorkItem(db, id, { facet: "aksam" });
    const again = await ctx.propose(item({ facet: "sabah", title: "Yeni ad" }));
    expect(again.kept).toEqual(["facet"]);
    const row = ok(await db.from("work_items").select("facet, title").eq("id", id).single());
    expect(row).toEqual({ facet: "aksam", title: "Yeni ad" });

    // A rhythm too.
    const rhythm = await ctx.propose(
      item({
        key: "r",
        facet: "sabah",
        when: { recurrence: { count: 2, period: "week" } },
        effort: { session_minutes: 15 },
      }),
    );
    await updateRhythm(db, rhythm.id, { facet: null });
    expect(
      (
        await ctx.propose(
          item({
            key: "r",
            facet: "sabah",
            when: { recurrence: { count: 2, period: "week" } },
            effort: { session_minutes: 15 },
          }),
        )
      ).kept,
    ).toEqual(["facet"]);
    expect(
      ok(await db.from("rhythms").select("facet").eq("id", rhythm.id).single()).facet,
    ).toBeNull();
  });

  it("a facet that left the list keeps its key on the work, without an error", async () => {
    const { ctx, setFacets } = await setup();
    const { id } = await ctx.propose(item({ facet: "aksam" }));
    setFacets([SABAH]);
    // Another record is proposed; the old work keeps "aksam".
    await ctx.propose(item({ key: "kayit:2", facet: "sabah" }));
    expect(ok(await db.from("work_items").select("facet").eq("id", id).single()).facet).toBe(
      "aksam",
    );
    // Proposing the old one again with the gone key is refused; without it, it clears.
    await expect(ctx.propose(item({ facet: "aksam" }))).rejects.toThrow(/aksam/);
    expect((await ctx.propose(item())).changed).toEqual(["facet"]);
    expect(ok(await db.from("work_items").select("facet").eq("id", id).single()).facet).toBeNull();
  });

  it("a broken facet list refuses the proposal and says what is wrong", async () => {
    const { ctx, setFacets } = await setup();
    setFacets([SABAH, { ...AKSAM, key: "sabah" }]);
    await expect(ctx.propose(item({ facet: "sabah" }))).rejects.toBeInstanceOf(FacetError);
    setFacets([{ ...SABAH, scene: "yok" }]);
    await expect(ctx.propose(item())).rejects.toThrow(/scene "yok"/);
  });
});

describe("a sitting's facet and the session events", () => {
  it("a sitting without its own facet has its item's; the events carry it", async () => {
    const { ctx, heard, told } = await setup();
    const { id } = await ctx.propose(item({ facet: "sabah" }));
    const session = await startSessionTold(told, { workItemId: id });
    await endSessionTold(told, session.id, "stopped");
    expect(heard.map((event) => (event.payload as { facet: unknown }).facet)).toEqual([
      "sabah",
      "sabah",
    ]);
    // The sitting itself stores nothing: it follows its item.
    const sitting = ok(await db.from("tasks").select("facet").eq("work_item_id", id).single());
    expect(sitting.facet).toBeNull();
  });

  it("a sitting's own facet wins; a rhythm carries its own; no facet is null", async () => {
    const { ctx, heard, told, row } = await setup();
    const { id } = await ctx.propose(item({ facet: "sabah" }));
    const first = await startSession(db, { workItemId: id });
    const sitting = ok(await db.from("tasks").select("id").eq("work_item_id", id).single());
    await endSessionTold(told, first.id, "stopped");
    await updateTask(db, sitting.id, { facet: "aksam" });
    await endSessionTold(told, (await startSessionTold(told, { taskId: sitting.id })).id, "done");
    const rhythm = await ctx.propose(
      item({
        key: "r",
        facet: "aksam",
        when: { recurrence: { count: 2, period: "week" } },
        effort: { session_minutes: 15 },
      }),
    );
    await startSessionTold(told, { rhythmId: rhythm.id });
    const plain = ok(
      await db.from("tasks").insert({ module_id: row.id, title: "Düz iş" }).select().single(),
    );
    await startSessionTold(told, { taskId: plain.id });
    const facets = heard
      .filter((event) => event.type === "core.session_started")
      .map((event) => (event.payload as { facet: unknown }).facet);
    expect(facets).toEqual(["aksam", "aksam", null]);
  });
});

describe("the database", () => {
  it("checks the spelling of facet keys in the four tables", async () => {
    const { row } = await setup();
    const base = { module_id: row.id, title: "x" };
    const rows = (facet: string) => ({
      tasks: () => db.from("tasks").insert({ ...base, facet }),
      work_items: () => db.from("work_items").insert({ ...base, facet }),
      rhythms: () => db.from("rhythms").insert({ ...base, target_count: 1, period: "week", facet }),
      blocks: () =>
        db.from("blocks").insert({
          ...base,
          kind: "appointment",
          starts_at: "2026-11-20T10:00:00+03:00",
          ends_at: "2026-11-20T11:00:00+03:00",
          facet,
        }),
    });
    for (const facet of ["Sabah", "a".repeat(41), "-sabah", "sa bah"]) {
      for (const [table, insert] of Object.entries(rows(facet))) {
        expect((await insert()).error?.code, `${table} ${facet}`).toBe("23514");
      }
    }
    for (const [table, insert] of Object.entries(rows("yzv406e-2"))) {
      expect((await insert()).error, table).toBeNull();
    }
  });

  it("checks the module's colours: #rrggbb, facet keys", async () => {
    const { row } = await setup();
    const fine = await db
      .from("modules")
      .update({ color: "#E8A33D", facet_colors: { sabah: "#e8a33d", "ders-1": "#000000" } })
      .eq("id", row.id);
    expect(fine.error).toBeNull();
    for (const facet_colors of [
      { sabah: "sarı" },
      { Sabah: "#e8a33d" },
      { sabah: 3 },
      ["#e8a33d"],
    ]) {
      const refused = await db.from("modules").update({ facet_colors }).eq("id", row.id);
      expect(refused.error?.code, JSON.stringify(facet_colors)).toBe("23514");
    }
    const color = await db.from("modules").update({ color: "mavi" }).eq("id", row.id);
    expect(color.error?.code).toBe("23514");
    expect(ok(await db.from("modules").select("facet_colors").eq("id", row.id).single())).toEqual({
      facet_colors: { sabah: "#e8a33d", "ders-1": "#000000" },
    });
  });
});
