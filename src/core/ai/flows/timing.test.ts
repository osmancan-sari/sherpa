import { describe, expect, it } from "vitest";
import { timingSummary } from "@/core/contract/timing";
import { MODULE_ID } from "@/core/testing/factories";
import { type EnrichInput, type EnrichOutput, enrichOutput } from "../calls/enrich";
import { fakeProvider } from "../fake";
import { readMark } from "../marks";
import { aiTiming, enrichedRecord } from "./enrich-apply";

// Time constraints and the AI (docs/10-yapay-zeka.md, rule 12): `enrich` writes only what the
// line states; the planning calls see each candidate's constraints in short.

const NOW = new Date("2026-11-11T09:00:00Z");

function answer(timing: EnrichOutput["timing"], target: "task" | "work_item" = "task") {
  const j = <T>(value: T, confidence = 0.8) => ({ value, confidence, reason: "gerekçe" });
  return {
    title: "Salon",
    module: j<string | null>("spor", 0.9),
    target: j<"task" | "work_item" | null>(target),
    est_minutes: j<number | null>(target === "task" ? 60 : 300),
    energy: j<"deep" | "light" | "physical" | null>("physical"),
    context: j<"any" | "out" | null>("out"),
    importance: j<number | null>(2),
    due: j<string | null>(null),
    timing,
    steps: [],
  } as EnrichOutput;
}

const record = (output: EnrichOutput) =>
  enrichedRecord({
    output,
    parsed: { title: "Salon", dueDay: null, minutes: null },
    moduleId: MODULE_ID,
    userPickedModule: false,
    callId: "call-1",
    model: "fake-fast",
    rawText: "Salon akşam 8'den sonra",
    now: NOW,
  });

const evening = {
  value: {
    windows: [{ days: null, from: "20:00", to: "24:00" }],
    prefer: null,
    avoid: null,
    travel: { before: 15, after: 15 },
  },
  confidence: 0.8,
  reason: "satırda yazıyor",
};

describe("enrich and timing", () => {
  it("writes the stated constraint on the task, marked as the AI's", () => {
    const { row } = record(answer(evening));
    expect(row).toMatchObject({
      timing: { windows: [{ from: "20:00", to: "24:00" }], travel: { before: 15, after: 15 } },
    });
    expect(readMark(row.ai)!.fields.timing).toMatchObject({ confidence: 0.8 });
  });

  it("a work item keeps the source of each timing field on its own", () => {
    const { row } = record(answer(evening, "work_item"));
    expect((row as { provenance: unknown }).provenance).toMatchObject({
      "timing.windows": "ai",
      "timing.travel": "ai",
    });
    expect((row as { provenance: Record<string, unknown> }).provenance).not.toHaveProperty(
      "timing",
    );
  });

  it("no constraint, an old answer without the field, or an invalid one leaves no timing", () => {
    expect(record(answer({ value: null, confidence: 0.8, reason: "" })).row).not.toHaveProperty(
      "timing",
    );
    expect(record(answer(undefined)).row).not.toHaveProperty("timing");
    expect(
      aiTiming({
        windows: [{ days: null, from: "20:00", to: "18:00" }],
        prefer: null,
        avoid: null,
        travel: null,
      }),
    ).toBeNull();
    // Empty lists and zero travel are nothing; every day is no `days`.
    expect(
      aiTiming({
        windows: [],
        prefer: null,
        avoid: [{ days: [1, 2, 3, 4, 5, 6, 7], from: "18:00", to: "20:00" }],
        travel: { before: 0, after: 0 },
      }),
    ).toEqual({ avoid: [{ from: "18:00", to: "20:00" }] });
  });
});

describe("the fake provider reads only what is written", () => {
  const ask = async (text: string) => {
    const provider = fakeProvider();
    const input: EnrichInput = {
      text,
      today: "2026-11-11",
      weekday: "çarşamba",
      modules: [{ slug: "spor", name: "Spor", area: null, intake: [] }],
      similar: [],
      corrections: [],
    };
    const result = await provider.complete({
      kind: "enrich",
      model: "fake-fast",
      tier: "fast",
      system: "",
      user: JSON.stringify(input),
      schema: enrichOutput,
      maxTokens: 100,
      signal: new AbortController().signal,
    });
    return (JSON.parse(result.text) as EnrichOutput).timing?.value ?? null;
  };

  it("a window, an avoided range, travel; nothing for a deadline or a word of the day", async () => {
    expect(await ask("Spor salonu akşam 8'den sonra")).toMatchObject({
      windows: [{ from: "20:00", to: "24:00" }],
    });
    expect(await ask("Market alışverişi, 18-20 arası kalabalık olmasın")).toMatchObject({
      avoid: [{ from: "18:00", to: "20:00" }],
    });
    expect(await ask("Kütüphanede çalış, 15 dk yol")).toMatchObject({
      travel: { before: 15, after: 15 },
    });
    expect(await ask("Rapor yarın teslim")).toBeNull();
    expect(await ask("Akşam yemeği için alışveriş")).toBeNull();
  });
});

describe("the summary line", () => {
  it("reads like the form's closed section", () => {
    expect(
      timingSummary({
        windows: [{ from: "07:00", to: "23:00" }],
        avoid: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "20:30" }],
        travel: { before: 20, after: 20 },
        rest_days: 1,
      }),
    ).toBe("07:00–23:00 · kaçın: hafta içi 18:00–20:30 · yol 20+20 dk · 1 gün ara");
    expect(timingSummary({ prefer: [{ days: [6, 7], from: "10:00", to: "12:00" }] })).toBe(
      "tercih: hafta sonu 10:00–12:00",
    );
    expect(timingSummary({ windows: [{ days: [1, 3], from: "09:00", to: "12:00" }] })).toBe(
      "Pzt, Çar 09:00–12:00",
    );
    expect(timingSummary(null)).toBe("");
  });
});
