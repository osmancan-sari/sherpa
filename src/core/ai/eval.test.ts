import { describe, expect, it } from "vitest";
import { enrichOutput } from "./calls/enrich";
import { type EvalSuite, scoreCase, summarize, toneMisses, userTexts } from "./eval";
import { fakeProvider } from "./fake";

// The quality check's scoring (scripts/ai-eval/): what counts as right, and the summary.

const suite: EvalSuite = {
  today: "2026-11-11",
  weekday: "çarşamba",
  modules: [
    { slug: "okul", name: "Okul", area: null, intake: [] },
    { slug: "ev", name: "Ev", area: null, intake: [] },
  ],
  cases: [
    {
      text: "Okul sunum slaytları cuma",
      expect: { module: "okul", target: "task", minutes: 60, due: "2026-11-13" },
    },
    {
      text: "YZV406E ödev 2",
      expect: { module: "okul", target: "work_item", minutes: 180, due: null },
    },
  ],
};

describe("ai-eval", () => {
  it("scores routing, the kind of work, the deadline and the duration error", async () => {
    const answers = await Promise.all(
      suite.cases.map(async (item) => {
        const input = { ...suite, text: item.text, similar: [], corrections: [] };
        const response = await fakeProvider().complete({
          kind: "enrich",
          model: "fake-fast",
          tier: "fast",
          system: "",
          user: JSON.stringify(input),
          schema: enrichOutput,
          maxTokens: 100,
          signal: new AbortController().signal,
        });
        return enrichOutput.parse(JSON.parse(response.text));
      }),
    );
    const report = summarize(
      "fake-fast",
      suite.cases.map((item, index) => scoreCase(item, answers[index])),
      0.01,
    );
    expect(report).toMatchObject({ total: 2, answered: 2, routing: 0.5, due: 1, target: 0.5 });
    // 45 against 60 and 45 against 180: errors 0.25 and 0.75, median 0.5.
    expect(report.minutesMedianError).toBe(0.5);
    // "ödev" does not name the module "Ev".
    expect(report.rows[1].output?.module.value).toBeNull();
  });

  it("counts a failed answer as wrong on every score", () => {
    const row = scoreCase(suite.cases[0], null, "timeout");
    expect(row).toMatchObject({ module: false, target: false, due: false, minutesError: null });
    expect(summarize("m", [row], 0)).toMatchObject({
      answered: 0,
      routing: 0,
      minutesMedianError: null,
    });
  });

  it("scores the duration size gave when enrich gave none", async () => {
    const input = {
      ...suite,
      text: "Okul sunum slaytları cuma [ai:nominutes]",
      similar: [],
      corrections: [],
    };
    const response = await fakeProvider().complete({
      kind: "enrich",
      model: "fake-fast",
      tier: "fast",
      system: "",
      user: JSON.stringify(input),
      schema: enrichOutput,
      maxTokens: 100,
      signal: new AbortController().signal,
    });
    const output = enrichOutput.parse(JSON.parse(response.text));
    expect(output.est_minutes.value).toBeNull();
    const row = scoreCase(suite.cases[0], output, null, 45);
    expect(row).toMatchObject({ sized: true, minutesError: 0.25 });
    expect(summarize("m", [row], 0).sized).toBe(1);
    expect(scoreCase(suite.cases[0], output).minutesError).toBeNull();
  });
});

describe("ai-eval: time constraints (Ç3b)", () => {
  const ask = async (text: string) => {
    const input = { ...suite, text, similar: [], corrections: [] };
    const response = await fakeProvider().complete({
      kind: "enrich",
      model: "fake-fast",
      tier: "fast",
      system: "",
      user: JSON.stringify(input),
      schema: enrichOutput,
      maxTokens: 100,
      signal: new AbortController().signal,
    });
    return enrichOutput.parse(JSON.parse(response.text));
  };
  const base = { module: "okul", target: "task" as const, minutes: 60, due: null };

  it("a stated constraint must be read as written; a line without one must leave it empty", async () => {
    const window = {
      text: "Okul salonu akşam 8'den sonra",
      expect: { ...base, timing: { windows: [{ from: "20:00", to: "24:00" }] } },
    };
    expect(scoreCase(window, await ask(window.text)).timing).toBe(true);
    const wrong = {
      ...window,
      expect: { ...base, timing: { windows: [{ from: "19:00", to: "24:00" }] } },
    };
    expect(scoreCase(wrong, await ask(window.text)).timing).toBe(false);
    const none = { text: "Okul akşam yemeği", expect: { ...base, timing: null } };
    expect(scoreCase(none, await ask(none.text)).timing).toBe(true);
    // A case that does not check timing scores nothing for it.
    const unchecked = { text: "Okul ödev", expect: base };
    const rows = [
      scoreCase(window, await ask(window.text)),
      scoreCase(wrong, await ask(window.text)),
      scoreCase(unchecked, await ask(unchecked.text)),
    ];
    expect(rows[2].timing).toBeNull();
    expect(summarize("m", rows, 0).timing).toEqual({ checked: 2, right: 1 });
  });
});

describe("ai-eval: tone (rule 2)", () => {
  it("finds what counts the past or blames, and lets plain facts through", () => {
    expect(
      toneMisses([
        "Dün planlanan 2 işten hiçbiri bitmedi.",
        "Yine ertelendi, bugün yapılmalı.",
        "Teslimi kaçırdın.",
      ]).map((miss) => miss.word),
    ).toEqual(["dün", "bitmedi", "hiçbiri", "ertelendi", "yine", "kaçırdın"]);
    expect(
      toneMisses([
        "Cuma teslim, bugün 45 dk yeter.",
        "Teslimi pazartesi, bekleyebilir.",
        "Kısa bir iş, yine de bugün sığar.",
        "Dünya tarihi okuması 30 dk.",
      ]),
    ).toEqual([]);
  });

  it("reads every sentence the user would see", () => {
    expect(
      userTexts("plan", {
        top3: [{ id: "a", reason: "r1" }],
        prefer: [{ id: "b", reason: "r2" }],
        defer: [],
        estimates: [{ id: "c", minutes: 30, reason: "r3" }],
        warnings: ["w"],
      }),
    ).toEqual(["r1", "r2", "r3", "w"]);
    expect(
      userTexts("review", {
        summary: "s",
        suggestions: ["x"],
        mode: { mode: "busy", reason: "m" },
      }),
    ).toEqual(["s", "x", "m"]);
    expect(userTexts("month", { proposals: [{ text: "t" }] })).toEqual(["t"]);
    expect(userTexts("week", { committed: [{ id: "a", reason: "c" }], drop: [] })).toEqual(["c"]);
  });
});
