import { describe, expect, it } from "vitest";
import { enrichOutput } from "./calls/enrich";
import { type EvalSuite, scoreCase, summarize } from "./eval";
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
});
