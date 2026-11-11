import { describe, expect, it, vi } from "vitest";
import { MODULE_ID, workItem } from "@/core/testing/factories";
import type { EnrichOutput } from "../calls/enrich";
import type { SizeOutput } from "../calls/size";
import { sizeAfterProposal, sizeRequestFor } from "../client";
import { corrections, mergeMark, readMark } from "../marks";
import { enrichedRecord, isSure } from "./enrich-apply";
import { clampEffort, sizeColumns, sizeNeeds } from "./size";
import { splitRows } from "./split";

// The pure parts of the AI flows: what an answer becomes, what is asked, what is kept.

const NOW = new Date("2026-11-11T09:00:00Z");
const MODULES = new Map([["okul", MODULE_ID]]);

function answer(over: Partial<EnrichOutput> = {}): EnrichOutput {
  const j = <T>(value: T, confidence = 0.8) => ({ value, confidence, reason: "gerekçe" });
  return {
    title: "Sunum slaytları",
    module: j<string | null>("okul", 0.9),
    target: j<"task" | "work_item" | null>("task"),
    est_minutes: j<number | null>(45),
    energy: j<"deep" | "light" | "physical" | null>("deep"),
    context: j<"any" | "desk" | null>("desk"),
    importance: j<number | null>(3),
    due: j<string | null>("2026-11-13"),
    steps: [],
    ...over,
  } as EnrichOutput;
}

const parsedLine = (
  over: Partial<{ title: string; dueDay: string | null; minutes: number | null }> = {},
) => ({
  title: "Sunum slaytları",
  dueDay: null,
  minutes: null,
  ...over,
});

function record(output: EnrichOutput, parsed = parsedLine(), userPickedModule = false) {
  return enrichedRecord({
    output,
    parsed,
    moduleId: MODULE_ID,
    userPickedModule,
    callId: "call-1",
    model: "fake-fast",
    rawText: "Sunum slaytları cuma",
    now: NOW,
  });
}

describe("enrich: what an answer becomes", () => {
  it("is applied only for a known module chosen with confidence", () => {
    expect(isSure(answer(), MODULES)).toBe(true);
    expect(
      isSure(answer({ module: { value: "okul", confidence: 0.5, reason: "" } }), MODULES),
    ).toBe(false);
    expect(
      isSure(answer({ target: { value: "task", confidence: 0.4, reason: "" } }), MODULES),
    ).toBe(false);
    expect(isSure(answer({ module: { value: null, confidence: 0.9, reason: "" } }), MODULES)).toBe(
      false,
    );
    // A module the model made up (or one that is not active) is not a module.
    expect(
      isSure(answer({ module: { value: "spor", confidence: 0.9, reason: "" } }), MODULES),
    ).toBe(false);
  });

  it("fills a task with the AI's values, each marked with its confidence and reason", () => {
    const { target, row } = record(answer());
    expect(target).toBe("task");
    expect(row).toMatchObject({
      module_id: MODULE_ID,
      title: "Sunum slaytları",
      est_minutes: 45,
      energy: "deep",
      context: "desk",
      importance: 3,
      due_at: "2026-11-13T20:59:00.000Z",
    });
    const mark = readMark(row.ai)!;
    expect(mark).toMatchObject({ kind: "enrich", call_id: "call-1", user_edited: [] });
    expect(Object.keys(mark.fields).sort()).toEqual(
      ["context", "due_at", "energy", "est_minutes", "importance", "module_id"].sort(),
    );
    expect(mark.fields.est_minutes).toEqual({ value: 45, confidence: 0.8, reason: "gerekçe" });
  });

  it("keeps a typed day and duration as the user's: no AI mark on them", () => {
    const { row } = record(answer(), parsedLine({ dueDay: "2026-11-20", minutes: 20 }));
    expect(row).toMatchObject({ est_minutes: 20, due_at: "2026-11-20T20:59:00.000Z" });
    const mark = readMark(row.ai)!;
    expect(mark.fields.est_minutes).toBeUndefined();
    expect(mark.fields.due_at).toBeUndefined();
  });

  it("makes a work item of more than one sitting, with the sources of its fields", () => {
    const byTarget = record(
      answer({ target: { value: "work_item", confidence: 0.8, reason: "" } }),
    );
    expect(byTarget.target).toBe("work_item");
    expect(byTarget.row).toMatchObject({ effort_total_minutes: 45 });

    const byMinutes = record(answer(), parsedLine({ minutes: 240 }));
    expect(byMinutes.target).toBe("work_item");
    expect(byMinutes.row).toMatchObject({
      effort_total_minutes: 240,
      provenance: {
        effort_total_minutes: "user",
        module_id: "ai",
        importance: "ai",
        due_at: "ai",
      },
    });
  });

  it("marks the module as the user's when it was picked on the card", () => {
    const { row } = record(
      answer({ target: { value: "work_item", confidence: 0.8, reason: "" } }),
      parsedLine(),
      true,
    );
    expect(readMark(row.ai)!.fields.module_id).toBeUndefined();
    expect(row).toMatchObject({ provenance: { module_id: "user" } });
  });

  it("keeps the user's words as the title; the model's only for an empty line", () => {
    expect(record(answer(), parsedLine({ title: "" })).row.title).toBe("Sunum slaytları");
    expect(record(answer({ title: "Başka" })).row.title).toBe("Sunum slaytları");
  });
});

describe("size: what is asked and what is written", () => {
  const item = (provenance: Record<string, string>, status: "active" | "done" = "active") =>
    workItem({ provenance, status, effort_min_minutes: 120, effort_max_minutes: 600 });

  it("asks only for fields nobody filled; a default counts as empty", () => {
    expect(sizeNeeds(item({ effort_total_minutes: "default" }), false)).toEqual([
      "effort_total_minutes",
      "session_minutes",
      "importance",
      "energy",
    ]);
    expect(
      sizeNeeds(
        item({
          effort_total_minutes: "module",
          session_minutes: "user",
          importance: "module",
          energy: "module",
        }),
        false,
      ),
    ).toEqual([]);
    expect(sizeNeeds(item({}, "done"), false)).toEqual([]);
  });

  it("asks again for the AI's own estimates only when the scope changed", () => {
    const sized = item({
      effort_total_minutes: "ai",
      session_minutes: "ai",
      importance: "module",
      energy: "user",
    });
    expect(sizeNeeds(sized, false)).toEqual([]);
    expect(sizeNeeds(sized, true)).toEqual(["effort_total_minutes", "session_minutes"]);
  });

  it("keeps the effort inside the module's bounds", () => {
    const bounded = item({});
    expect(clampEffort(30, bounded)).toBe(120);
    expect(clampEffort(1000, bounded)).toBe(600);
    expect(clampEffort(333, bounded)).toBe(335);
    expect(clampEffort(3, workItem({}))).toBe(5);
  });

  it("writes only the asked fields the AI could tell", () => {
    const output: SizeOutput = {
      effort_total_minutes: { value: 900, confidence: 0.7, reason: "benzer işler" },
      session_minutes: { value: 45, confidence: 0.6, reason: "odak" },
      importance: { value: 4, confidence: 0.6, reason: "yakın" },
      energy: { value: null, confidence: 0, reason: "" },
    };
    const { values, fields } = sizeColumns(item({}), ["effort_total_minutes", "energy"], output);
    expect(values).toEqual({ effort_total_minutes: 600 });
    expect(fields).toEqual({
      effort_total_minutes: { value: 600, confidence: 0.7, reason: "benzer işler" },
    });
  });

  it("is requested after a new work item or a change of scope, not after every proposal", () => {
    const result = (over: object) => ({
      target: "work_item" as const,
      id: "i",
      created: false,
      changed: [] as string[],
      kept: [] as string[],
      ...over,
    });
    expect(sizeRequestFor(result({ created: true }))).toEqual({ id: "i" });
    expect(sizeRequestFor(result({ changed: ["meta"] }))).toEqual({ id: "i" });
    expect(sizeRequestFor(result({ changed: ["due_at"] }))).toBeNull();
    expect(sizeRequestFor(result({ target: "rhythm", created: true }))).toBeNull();
  });

  it("asks the size route after a proposal, and survives the network failing", async () => {
    const fetch = vi.fn(async () => Response.json({ status: "applied", fields: [] }));
    vi.stubGlobal("fetch", fetch);
    const created = { target: "work_item" as const, id: "i", created: true, changed: [], kept: [] };
    expect(await sizeAfterProposal(created)).toEqual({ status: "applied", fields: [] });
    expect(fetch).toHaveBeenCalledWith("/api/ai/size", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "i" }),
    });
    expect(sizeAfterProposal({ ...created, created: false })).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    expect(await sizeAfterProposal(created)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("marks", () => {
  it("merges a later call's fields, keeps the user's and remembers which call set each", () => {
    const first = mergeMark(null, {
      kind: "enrich",
      model: "m",
      at: "t1",
      call_id: "c1",
      fields: { importance: { value: 2, confidence: 0.5, reason: "a" } },
      input: "satır",
    });
    const edited = { ...first, user_edited: ["session_minutes"] };
    const merged = mergeMark(edited, {
      kind: "size",
      model: "m",
      at: "t2",
      call_id: "c2",
      fields: {
        effort_total_minutes: { value: 300, confidence: 0.7, reason: "b" },
        session_minutes: { value: 45, confidence: 0.6, reason: "c" },
      },
      input: "",
    });
    expect(merged.kind).toBe("enrich");
    expect(merged.input).toBe("satır");
    expect(merged.fields.importance.kind).toBe("enrich");
    expect(merged.fields.effort_total_minutes.kind).toBe("size");
    expect(merged.fields.session_minutes).toBeUndefined();

    // A correction is filed under the call that set the value.
    expect(corrections(merged, { effort_total_minutes: 200, importance: 2 })).toEqual([
      { column: "effort_total_minutes", kind: "size", ai: 300, user: 200 },
    ]);
  });
});

describe("split", () => {
  it("writes proposed pieces under the item, never due after it", () => {
    const parent = workItem({ title: "Tez", due_at: "2026-11-20T20:59:00.000Z", importance: 4 });
    const rows = splitRows(
      parent,
      [
        { ref: "a", title: "Kapsam", minutes: 60, depends_on: [], due: "2026-11-15" },
        { ref: "b", title: "Taslak", minutes: 120, depends_on: ["a"], due: "2026-12-01" },
      ],
      { kind: "decompose", callId: "c", model: "m", reason: "sırayla", confidence: 0.6, now: NOW },
    );
    expect(rows.map(({ row }) => [row.status, row.parent_id, row.importance])).toEqual([
      ["proposed", parent.id, 4],
      ["proposed", parent.id, 4],
    ]);
    expect(rows[0].row.due_at).toBe("2026-11-15T20:59:00.000Z");
    expect(rows[1].row.due_at).toBe(parent.due_at);
    expect(rows[1].dependsOnRefs).toEqual(["a"]);
    expect(readMark(rows[0].row.ai)!.fields.effort_total_minutes.reason).toBe("sırayla");
  });
});
