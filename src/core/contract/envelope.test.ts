import { describe, expect, it } from "vitest";
import {
  effortMidpoint,
  incomingFields,
  markUserEdited,
  mergeProposal,
  nextSessionMinutes,
  parseProposal,
  ProposalError,
  proposalTarget,
} from "./envelope";
import type { WorkProposal } from "./types";

const SOURCE = { type: "okul.assessment", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" };

/** A deadline proposal by default; a recurrence or fixed-time one carries only what it is given. */
function proposal(overrides: Partial<WorkProposal> = {}): WorkProposal {
  const deadline = !overrides.when?.recurrence && !overrides.when?.fixed;
  return {
    schema: 1,
    key: "assessment:8f2c:prep",
    source: SOURCE,
    title: "BBF301E Midterm hazırlığı",
    ...(deadline
      ? {
          when: { due: "2026-11-12T10:00:00+03:00", hard: true },
          effort: { bounds: { min: 120, max: 600 } },
          fit: { energy: "deep" as const, context: "desk" as const },
          importance: 4 as const,
          meta: { course_code: "BBF301E" },
        }
      : {}),
    ...overrides,
  };
}

describe("parseProposal", () => {
  it("accepts the envelope from the data model document, nulls included", () => {
    const parsed = parseProposal({
      schema: 1,
      module: "okul",
      key: "assessment:8f2c…:prep",
      source: SOURCE,
      title: "BBF301E Midterm hazırlığı",
      when: {
        due: "2026-11-12T10:00:00+03:00",
        hard: true,
        earliest: null,
        recurrence: null,
        fixed: null,
      },
      effort: { total_minutes: null, session_minutes: null, bounds: { min: 120, max: 600 } },
      fit: { energy: "deep", context: "desk" },
      importance: 4,
      depends_on: [],
      flex: { splittable: true, droppable: false },
      artifact: null,
      meta: { course_code: "BBF301E", weight: 30, scope: "Hafta 1–6" },
    });
    expect(parsed.key).toBe("assessment:8f2c…:prep");
    expect(proposalTarget(parsed)).toBe("work_item");
  });

  it("refuses what the envelope does not allow, naming every problem", () => {
    const bad: [string, unknown][] = [
      ["schema", { ...proposal(), schema: 2 }],
      ["key", { ...proposal(), key: "  " }],
      ["key", { ...proposal(), key: "a,b" }],
      ["key", { ...proposal(), key: 'a"b' }],
      ["key", { ...proposal(), key: "a{b}" }],
      ["key", { ...proposal(), key: "a b" }],
      ["depends_on", { ...proposal(), depends_on: ["a,b"] }],
      ["title", { ...proposal(), title: "" }],
      ["source.id", { ...proposal(), source: { type: "x", id: "not-a-uuid" } }],
      ["when.due", { ...proposal(), when: { due: "cuma" } }],
      ["when.due", { ...proposal(), when: { due: "2026-11-12T10:00:00" } }],
      ["importance", { ...proposal(), importance: 5 }],
      ["effort.session_minutes", { ...proposal(), effort: { session_minutes: 120 } }],
      ["effort.bounds", { ...proposal(), effort: { bounds: { min: 600, max: 120 } } }],
      ["fit.energy", { ...proposal(), fit: { energy: "huge" } }],
      ["depends_on", { ...proposal(), depends_on: ["assessment:8f2c:prep"] }],
    ];
    for (const [path, input] of bad) {
      let caught: unknown;
      try {
        parseProposal(input);
      } catch (error) {
        caught = error;
      }
      expect(caught, path).toBeInstanceOf(ProposalError);
      expect((caught as ProposalError).issues.join(" "), path).toContain(path);
    }
  });

  it("allows only one form of when", () => {
    const fixed = { starts_at: "2026-11-12T09:00:00+03:00", ends_at: "2026-11-12T10:00:00+03:00" };
    const recurrence = { count: 2, period: "week" as const };

    expect(proposalTarget(parseProposal(proposal({ when: { recurrence } })))).toBe("rhythm");
    expect(proposalTarget(parseProposal(proposal({ when: { fixed } })))).toBe("block");
    expect(proposalTarget(parseProposal(proposal({ when: undefined })))).toBe("work_item");

    expect(() => parseProposal(proposal({ when: { recurrence, fixed } }))).toThrow(ProposalError);
    expect(() =>
      parseProposal(proposal({ when: { due: "2026-11-12T10:00:00+03:00", recurrence } })),
    ).toThrow(ProposalError);
    expect(() =>
      parseProposal(proposal({ when: { fixed: { ...fixed, ends_at: fixed.starts_at } } })),
    ).toThrow(/ends before it starts/);
    expect(() =>
      parseProposal(proposal({ when: { recurrence: { count: 1, period: "week", floor: 2 } } })),
    ).toThrow(/floor/);
    expect(() =>
      parseProposal(
        proposal({
          when: { due: "2026-11-12T10:00:00+03:00", earliest: "2026-11-13T10:00:00+03:00" },
        }),
      ),
    ).toThrow(/after the deadline/);
  });
});

describe("fields a form has no place for", () => {
  const recurrence = { count: 2, period: "week" as const };
  const fixed = { starts_at: "2026-11-12T09:00:00+03:00", ends_at: "2026-11-12T10:00:00+03:00" };

  it("are refused instead of being dropped silently", () => {
    const cases: [Partial<WorkProposal>, string][] = [
      [{ when: { recurrence }, importance: 3 }, "importance: not used by a recurrence"],
      [{ when: { recurrence }, effort: { total_minutes: 60 } }, "effort.total_minutes"],
      [{ when: { recurrence }, effort: { bounds: { min: 1, max: 2 } } }, "effort.bounds"],
      [{ when: { recurrence }, depends_on: ["a"] }, "depends_on"],
      [{ when: { recurrence }, artifact: "x.pdf" }, "artifact"],
      [{ when: { recurrence }, flex: { droppable: true } }, "flex"],
      [{ when: { fixed }, effort: { session_minutes: 30 } }, "effort: not used by a fixed time"],
      [{ when: { fixed }, fit: { energy: "deep" } }, "fit"],
      [{ when: { fixed }, importance: 2 }, "importance"],
      [{ when: { fixed }, meta: { a: 1 } }, "meta"],
    ];
    for (const [overrides, message] of cases) {
      expect(() => parseProposal(proposal(overrides)), message).toThrow(message);
    }
  });

  it("accepts what the form does use, and empty values", () => {
    parseProposal(
      proposal({
        when: { recurrence },
        effort: { session_minutes: 20 },
        fit: { energy: "physical" },
        meta: { a: 1 },
        depends_on: [],
        importance: null,
      }),
    );
    parseProposal(proposal({ when: { fixed }, effort: {}, meta: {}, artifact: null }));
  });
});

describe("effort when nobody knows better", () => {
  it("is the middle of the bounds, rounded to five minutes", () => {
    expect(effortMidpoint({ min: 120, max: 600 })).toBe(360);
    expect(effortMidpoint({ min: 20, max: 33 })).toBe(25);
    expect(effortMidpoint({ min: 1, max: 2 })).toBe(5);
    expect(effortMidpoint(null)).toBeNull();
  });

  it("is written with the source 'default'; a known effort keeps the source 'module'", () => {
    const empty = incomingFields(proposal());
    expect(empty.judgments.effort_total_minutes).toEqual({ value: 360, source: "default" });

    const known = incomingFields(proposal({ effort: { total_minutes: 90, session_minutes: 45 } }));
    expect(known.judgments.effort_total_minutes).toEqual({ value: 90, source: "module" });
    expect(known.judgments.session_minutes).toEqual({ value: 45, source: "module" });

    const unknown = incomingFields(proposal({ effort: undefined }));
    expect(unknown.judgments.effort_total_minutes).toBeUndefined();
  });
});

describe("incomingFields", () => {
  it("maps a deadline proposal to work item columns", () => {
    const fields = incomingFields(proposal({ depends_on: ["a:1"], artifact: "D:/okul/doc.pdf" }));
    expect(fields.facts).toEqual({
      title: "BBF301E Midterm hazırlığı",
      source_type: "okul.assessment",
      source_id: SOURCE.id,
      due_at: "2026-11-12T07:00:00.000Z",
      due_is_hard: true,
      earliest_at: null,
      artifact_url: "D:/okul/doc.pdf",
      depends_on_keys: ["a:1"],
      meta: { course_code: "BBF301E" },
    });
    expect(fields.judgments).toMatchObject({
      importance: { value: 4, source: "module" },
      energy: { value: "deep", source: "module" },
      context: { value: "desk", source: "module" },
    });
  });

  it("maps a recurrence to rhythm columns and a fixed time to block columns", () => {
    const rhythm = incomingFields(
      proposal({
        when: { recurrence: { count: 2, period: "week", floor: 1 } },
        effort: { session_minutes: 20 },
        fit: { energy: "physical" },
      }),
    );
    expect(rhythm.facts).toMatchObject({ target_count: 2, period: "week", floor_count: 1 });
    expect(rhythm.judgments).toEqual({
      est_minutes: { value: 20, source: "module" },
      energy: { value: "physical", source: "module" },
    });

    const block = incomingFields(
      proposal({
        when: {
          fixed: {
            starts_at: "2026-11-12T09:00:00+03:00",
            ends_at: "2026-11-12T10:30:00+03:00",
            location: "A101",
          },
        },
      }),
    );
    expect(block.facts).toMatchObject({
      starts_at: "2026-11-12T06:00:00.000Z",
      ends_at: "2026-11-12T07:30:00.000Z",
      location: "A101",
    });
    expect(block.judgments).toEqual({});
  });
});

describe("mergeProposal", () => {
  it("writes every field of a new record and remembers who set it", () => {
    const result = mergeProposal(null, incomingFields(proposal()));
    expect(result.patch).toMatchObject({
      title: "BBF301E Midterm hazırlığı",
      effort_total_minutes: 360,
      importance: 4,
    });
    expect(result.provenance).toMatchObject({
      title: "module",
      due_at: "module",
      effort_total_minutes: "default",
      importance: "module",
    });
    expect(result.patch.provenance).toEqual(result.provenance);
    expect(result.kept).toEqual([]);
  });

  it("changes nothing when the same proposal comes again", () => {
    const first = mergeProposal(null, incomingFields(proposal()));
    // The database returns timestamps in its own spelling of the same instant.
    const stored = {
      values: { ...first.patch, due_at: "2026-11-12T07:00:00+00:00" },
      provenance: first.provenance,
    };
    const second = mergeProposal(stored, incomingFields(proposal()));
    expect(second.changed).toEqual([]);
    expect(second.patch).toEqual({});
  });

  it("sees the same proposal as the same, however the database spells it back", () => {
    const source = { type: "okul.assessment", id: "8F2C1D7E-3B4A-4C5D-9E6F-0A1B2C3D4E5F" };
    const meta = { course_code: "BBF301E", weight: 30, scope: "Hafta 1–6", nested: { b: 1, a: 2 } };
    const first = mergeProposal(null, incomingFields(proposal({ source, meta })));
    expect(first.patch.source_id).toBe("8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f");

    // jsonb comes back with its keys in another order.
    const stored = {
      values: {
        ...first.patch,
        meta: { scope: "Hafta 1–6", weight: 30, nested: { a: 2, b: 1 }, course_code: "BBF301E" },
      },
      provenance: first.provenance,
    };
    const second = mergeProposal(stored, incomingFields(proposal({ source, meta })));
    expect(second.changed).toEqual([]);
    expect(second.patch).toEqual({});

    // A real difference inside meta is still a change; so is a different order in a list.
    const edited = mergeProposal(
      stored,
      incomingFields(proposal({ source, meta: { ...meta, weight: 40 } })),
    );
    expect(edited.changed).toEqual(["meta"]);
    const reordered = mergeProposal(
      { values: { ...first.patch, depends_on_keys: ["b", "a"] }, provenance: first.provenance },
      incomingFields(proposal({ source, meta, depends_on: ["a", "b"] })),
    );
    expect(reordered.changed).toEqual(["depends_on_keys"]);
  });

  it("follows the module when the source record changes", () => {
    const first = mergeProposal(null, incomingFields(proposal()));
    const stored = { values: first.patch, provenance: first.provenance };
    const moved = mergeProposal(
      stored,
      incomingFields(proposal({ when: { due: "2026-11-11T10:00:00+03:00", hard: true } })),
    );
    expect(moved.changed).toEqual(["due_at"]);
    expect(moved.patch.due_at).toBe("2026-11-11T07:00:00.000Z");

    // A deadline can also go away: an empty fact is written.
    const cleared = mergeProposal(stored, incomingFields(proposal({ when: {} })));
    expect(cleared.patch).toMatchObject({ due_at: null, due_is_hard: false });
  });

  it("never overwrites a field the user changed, and says which ones it kept", () => {
    const first = mergeProposal(null, incomingFields(proposal()));
    const stored = {
      values: { ...first.patch, importance: 2, due_at: "2026-11-14T07:00:00.000Z" },
      provenance: markUserEdited(first.provenance, ["importance", "due_at"]),
    };
    const again = mergeProposal(
      stored,
      incomingFields(proposal({ title: "BBF301E Midterm", importance: 4 })),
    );
    expect(again.changed).toEqual(["title"]);
    expect(again.kept.sort()).toEqual(["due_at", "importance"]);
    expect(again.patch).not.toHaveProperty("importance");
    expect(again.patch).not.toHaveProperty("due_at");
    expect(again.provenance).toMatchObject({ importance: "user", due_at: "user", title: "module" });

    // A user value that happens to equal the proposal is not reported as kept.
    const equal = mergeProposal(
      { values: first.patch, provenance: markUserEdited(first.provenance, ["importance"]) },
      incomingFields(proposal()),
    );
    expect(equal.kept).toEqual([]);
    expect(equal.provenance.importance).toBe("user");
  });

  it("does not let a default replace an estimate that is already there", () => {
    const first = mergeProposal(null, incomingFields(proposal()));
    // The AI (Ç2) or the user has since put a real estimate in.
    for (const source of ["ai", "user"] as const) {
      const stored = {
        values: { ...first.patch, effort_total_minutes: 200 },
        provenance: { ...first.provenance, effort_total_minutes: source },
      };
      const again = mergeProposal(stored, incomingFields(proposal()));
      expect(again.patch, source).not.toHaveProperty("effort_total_minutes");
      expect(again.provenance.effort_total_minutes).toBe(source);
    }
  });

  it("lets a module's known effort replace a default or an AI estimate, but not the user's", () => {
    const first = mergeProposal(null, incomingFields(proposal()));
    const known = incomingFields(proposal({ effort: { total_minutes: 240 } }));

    const overDefault = mergeProposal({ values: first.patch, provenance: first.provenance }, known);
    expect(overDefault.patch.effort_total_minutes).toBe(240);
    expect(overDefault.provenance.effort_total_minutes).toBe("module");

    const overUser = mergeProposal(
      {
        values: { ...first.patch, effort_total_minutes: 100 },
        provenance: markUserEdited(first.provenance, ["effort_total_minutes"]),
      },
      known,
    );
    expect(overUser.patch).not.toHaveProperty("effort_total_minutes");
    expect(overUser.kept).toEqual(["effort_total_minutes"]);
  });

  it("leaves an estimate alone when the module no longer states it", () => {
    const first = mergeProposal(null, incomingFields(proposal({ importance: 4 })));
    const stored = { values: first.patch, provenance: first.provenance };
    const again = mergeProposal(stored, incomingFields(proposal({ importance: null })));
    expect(again.patch).not.toHaveProperty("importance");
  });
});

describe("nextSessionMinutes", () => {
  it("uses the item's session length, else the remaining effort up to 45 minutes", () => {
    const item = { session_minutes: null, effort_total_minutes: 300, effort_done_minutes: 0 };
    expect(nextSessionMinutes({ ...item, session_minutes: 60 })).toBe(60);
    expect(nextSessionMinutes(item)).toBe(45);
    expect(nextSessionMinutes({ ...item, effort_done_minutes: 280 })).toBe(20);
    expect(nextSessionMinutes({ ...item, effort_done_minutes: 298 })).toBe(5);
    expect(nextSessionMinutes({ ...item, effort_done_minutes: 320 })).toBe(45);
    expect(nextSessionMinutes({ ...item, effort_total_minutes: null })).toBe(45);
  });
});
