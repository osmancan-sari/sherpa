import { describe, expect, it } from "vitest";
import { incomingFields, mergeProposal, parseProposal, ProposalError } from "./envelope";
import { checkTiming, editTiming, mergeTiming, readTiming, TimingError } from "./timing";
import type { WorkProposal } from "./types";

// The envelope's time constraints (docs/03-veri-modeli.md, "Zaman kısıtları"; docs/04-planlayici.md,
// test list "Zarf doğrulaması").

const SOURCE = { type: "spor.workout", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" };
const DUE = { due: "2026-11-20T18:00:00+03:00" };
const WEEKLY = { recurrence: { count: 3, period: "week" as const } };
const FIXED = {
  fixed: { starts_at: "2026-11-13T10:00:00+03:00", ends_at: "2026-11-13T12:00:00+03:00" },
};

function proposal(overrides: Partial<WorkProposal> = {}): WorkProposal {
  return { schema: 1, key: "k", source: SOURCE, title: "Salon", ...overrides };
}

const issuesOf = (input: unknown) => {
  try {
    parseProposal(input);
    return [];
  } catch (error) {
    if (error instanceof ProposalError) return error.issues;
    throw error;
  }
};

describe("timing in the envelope", () => {
  const full = {
    windows: [{ from: "07:00", to: "23:00" }],
    prefer: [{ days: [6, 7], from: "10:00", to: "12:00" }],
    avoid: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "20:30" }],
    travel: { before: 20, after: 20 },
    rest_days: 1,
  };

  it("accepts every field on a recurrence, the document's example included", () => {
    const parsed = parseProposal(proposal({ when: WEEKLY, timing: full }));
    expect(parsed.timing).toEqual(full);
    expect(incomingFields(parsed).timing).toEqual(full);
  });

  it("accepts all but rest days on a deadline, and nothing but travel on a fixed time", () => {
    const { rest_days: _rest, ...deadline } = full;
    void _rest;
    expect(issuesOf(proposal({ when: DUE, timing: deadline }))).toEqual([]);
    expect(issuesOf(proposal({ when: DUE, timing: full }))).toEqual([
      "timing.rest_days: not used by a deadline",
    ]);
    expect(issuesOf(proposal({ timing: { travel: { before: 15 } } }))).toEqual([]);
    expect(
      issuesOf(proposal({ when: FIXED, timing: { travel: { before: 15, after: 5 } } })),
    ).toEqual([]);
    expect(issuesOf(proposal({ when: FIXED, timing: full })).sort()).toEqual([
      "timing.avoid: not used by a fixed time",
      "timing.prefer: not used by a fixed time",
      "timing.rest_days: not used by a fixed time",
      "timing.windows: not used by a fixed time",
    ]);
  });

  it("refuses a range that ends before it starts, and one past midnight", () => {
    expect(issuesOf(proposal({ timing: { windows: [{ from: "18:00", to: "16:00" }] } }))).toEqual([
      "timing.windows.0.to: from must be before to (a range past midnight is written as two)",
    ]);
    expect(
      issuesOf(proposal({ timing: { avoid: [{ from: "22:00", to: "02:00" }] } })),
    ).toHaveLength(1);
    expect(
      issuesOf(proposal({ timing: { windows: [{ from: "16:00", to: "16:00" }] } })),
    ).toHaveLength(1);
    // "24:00" closes a day; it never opens one.
    expect(issuesOf(proposal({ timing: { windows: [{ from: "21:00", to: "24:00" }] } }))).toEqual(
      [],
    );
    expect(
      issuesOf(proposal({ timing: { windows: [{ from: "24:00", to: "24:00" }] } })),
    ).toHaveLength(1);
    expect(
      issuesOf(proposal({ timing: { windows: [{ from: "7:00", to: "9:00" }] } })),
    ).toHaveLength(2);
  });

  it("refuses an empty list, more than 14 ranges, bad days and travel out of range", () => {
    expect(issuesOf(proposal({ timing: { windows: [] } }))).toEqual([
      "timing.windows: an empty list is not written: leave the field out",
    ]);
    const many = Array.from({ length: 15 }, () => ({ from: "08:00", to: "09:00" }));
    expect(issuesOf(proposal({ timing: { prefer: many } }))).toEqual([
      "timing.prefer: at most 14 ranges",
    ]);
    expect(issuesOf(proposal({ timing: { prefer: many.slice(0, 14) } }))).toEqual([]);
    expect(
      issuesOf(proposal({ timing: { avoid: [{ days: [], from: "08:00", to: "09:00" }] } })),
    ).toHaveLength(1);
    expect(
      issuesOf(proposal({ timing: { avoid: [{ days: [0, 8], from: "08:00", to: "09:00" }] } })),
    ).toHaveLength(2);
    expect(
      issuesOf(proposal({ timing: { avoid: [{ days: [2, 2], from: "08:00", to: "09:00" }] } })),
    ).toEqual(["timing.avoid.0.days: a day twice"]);
    expect(issuesOf(proposal({ timing: { travel: { before: 181 } } }))).toEqual([
      "timing.travel.before: at most 180 minutes",
    ]);
    expect(issuesOf(proposal({ timing: { travel: { after: -1 } } }))).toHaveLength(1);
    expect(issuesOf(proposal({ timing: { travel: { before: 0, after: 180 } } }))).toEqual([]);
    expect(
      issuesOf({ ...proposal(), timing: { windows: [{ from: "08:00", to: "09:00", x: 1 }] } }),
    ).toHaveLength(1);
  });

  it("refuses rest days that do not fit the period, and rest days on a daily rhythm", () => {
    // Three times a week with a day between: Monday, Wednesday, Friday fits (5 ≤ 7).
    expect(issuesOf(proposal({ when: WEEKLY, timing: { rest_days: 1 } }))).toEqual([]);
    // With two days between: 1 + 3 + 3 = 7 days. Fits exactly.
    expect(issuesOf(proposal({ when: WEEKLY, timing: { rest_days: 2 } }))).toEqual([]);
    // Four times with two days between: 10 days. Does not fit a week.
    expect(
      issuesOf(
        proposal({ when: { recurrence: { count: 4, period: "week" } }, timing: { rest_days: 2 } }),
      ),
    ).toEqual(["timing.rest_days: 4 times with 2 rest days between them do not fit in 7 days"]);
    // A month counts 28 days: 8 times with 3 between is 29.
    expect(
      issuesOf(
        proposal({ when: { recurrence: { count: 8, period: "month" } }, timing: { rest_days: 3 } }),
      ),
    ).toHaveLength(1);
    expect(
      issuesOf(
        proposal({ when: { recurrence: { count: 7, period: "month" } }, timing: { rest_days: 3 } }),
      ),
    ).toEqual([]);
    expect(
      issuesOf(
        proposal({ when: { recurrence: { count: 1, period: "day" } }, timing: { rest_days: 1 } }),
      ),
    ).toEqual(["timing.rest_days: not used by a daily recurrence"]);
    expect(issuesOf(proposal({ when: WEEKLY, timing: { rest_days: 0 } }))).toHaveLength(1);
  });

  it("takes null or an empty object as no constraint", () => {
    expect(incomingFields(parseProposal(proposal({ timing: null }))).timing).toBeNull();
    expect(incomingFields(parseProposal(proposal({ timing: {} }))).timing).toBeNull();
    expect(incomingFields(parseProposal(proposal({ timing: { travel: {} } }))).timing).toBeNull();
    expect(incomingFields(parseProposal(proposal())).timing).toBeNull();
  });

  it("writes a fixed time's travel into the block's travel columns; none given is none", () => {
    const block = incomingFields(
      parseProposal(proposal({ when: FIXED, timing: { travel: { before: 25 } } })),
    );
    expect(block.facts).toMatchObject({ travel_before_min: 25, travel_after_min: 0 });
    expect(block.timing).toBeUndefined();
    expect(incomingFields(parseProposal(proposal({ when: FIXED }))).facts).toMatchObject({
      travel_before_min: 0,
      travel_after_min: 0,
    });
  });
});

describe("timing, field by field", () => {
  const windows = [{ from: "16:00", to: "18:00" }];
  const avoid = [{ from: "18:00", to: "20:00" }];

  it("a new record without timing leaves the column alone; with timing, each field has a source", () => {
    const none = mergeProposal(null, incomingFields(parseProposal(proposal())));
    expect(none.patch).not.toHaveProperty("timing");
    expect(none.changed.some((field) => field.startsWith("timing"))).toBe(false);

    const some = mergeProposal(
      null,
      incomingFields(parseProposal(proposal({ timing: { windows, travel: { before: 10 } } }))),
    );
    expect(some.patch.timing).toEqual({ windows, travel: { before: 10 } });
    expect(some.provenance).toMatchObject({
      "timing.windows": "module",
      "timing.travel": "module",
    });
    expect(some.changed).toEqual(expect.arrayContaining(["timing.windows", "timing.travel"]));
  });

  /** The record a first proposal leaves, as the database would hold it. */
  const storedFrom = (timing: WorkProposal["timing"]) => {
    const first = mergeProposal(null, incomingFields(parseProposal(proposal({ timing }))));
    return { values: first.patch, provenance: first.provenance };
  };

  it("removes a field the module no longer sends, keeps one the user changed", () => {
    const stored = storedFrom({ windows, avoid: [{ from: "07:00", to: "08:00" }] });
    stored.provenance["timing.avoid"] = "user";
    // The module now sends other avoided hours and no window.
    const merged = mergeProposal(
      stored,
      incomingFields(parseProposal(proposal({ timing: { avoid } }))),
    );
    expect(merged.patch.timing).toEqual({ avoid: [{ from: "07:00", to: "08:00" }] });
    expect(merged.changed).toEqual(["timing.windows"]);
    expect(merged.kept).toEqual(["timing.avoid"]);
    expect(merged.provenance).not.toHaveProperty("timing.windows");
    expect(merged.provenance["timing.avoid"]).toBe("user");
  });

  it("writes nothing when the same timing comes again", () => {
    const again = mergeProposal(
      storedFrom({ windows }),
      incomingFields(parseProposal(proposal({ timing: { windows } }))),
    );
    expect(again.patch).toEqual({});
    expect(again.changed).toEqual([]);
  });

  it("the last field gone leaves no timing at all", () => {
    const provenance = { "timing.travel": "module" as const };
    const merged = mergeTiming({ travel: { before: 5 } }, null, provenance);
    expect(merged).toEqual({ value: null, changed: ["timing.travel"], kept: [] });
    expect(provenance).toEqual({});
  });
});

describe("the user's form", () => {
  it("goes through the same schema; changed fields become the user's", () => {
    const edited = editTiming(
      { windows: [{ from: "16:00", to: "18:00" }], travel: { before: 10 } },
      { windows: [{ from: "16:00", to: "18:00" }], travel: { before: 20 } },
      { kind: "deadline" },
      { "timing.windows": "module", "timing.travel": "module", title: "module" },
    );
    expect(edited.timing).toEqual({
      windows: [{ from: "16:00", to: "18:00" }],
      travel: { before: 20 },
    });
    expect(edited.provenance).toEqual({
      "timing.windows": "module",
      "timing.travel": "user",
      title: "module",
    });
  });

  it("refuses what the envelope refuses, naming the field", () => {
    expect(() =>
      editTiming(null, { windows: [{ from: "18:00", to: "16:00" }] }, { kind: "deadline" }, null),
    ).toThrow(TimingError);
    expect(
      checkTiming({ rest_days: 3 }, { kind: "recurrence", count: 3, period: "week" }).issues,
    ).toEqual([
      {
        path: ["rest_days"],
        message: "3 times with 3 rest days between them do not fit in 7 days",
        reason: "rest_fit",
      },
    ]);
    expect(checkTiming({ windows: [] }, { kind: "task" }).issues[0].reason).toBe("empty");
    expect(
      checkTiming({ windows: [{ from: "9", to: "10:00" }] }, { kind: "task" }).issues[0].reason,
    ).toBe("clock");
    expect(
      checkTiming({ windows: [{ from: "10:00", to: "09:00" }] }, { kind: "task" }).issues[0].reason,
    ).toBe("order");
    expect(checkTiming({ rest_days: 1 }, { kind: "task" }).issues[0].reason).toBe("not_used");
  });

  it("a stored value that does not pass counts as no constraint for the planner", () => {
    expect(readTiming({ windows: [] })).toBeNull();
    expect(readTiming("x")).toBeNull();
    expect(readTiming({ travel: { after: 15 } })).toEqual({ travel: { after: 15 } });
  });
});
