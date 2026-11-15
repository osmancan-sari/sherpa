import { describe, expect, it } from "vitest";
import { checkTiming } from "@/core/contract/timing";
import { draftOf, valueOf } from "./TimingSection";

// The timing form's draft (src/core/ui/work/TimingSection.tsx), Ç4a: `after_finish` is no longer
// offered; a value a module stored is kept, but never with an anchor.

describe("the timing draft", () => {
  it("keeps a stored after_finish as it was", () => {
    const stored = { windows: [{ from: "20:00", to: "22:00" }], after_finish: true as const };
    expect(checkTiming(valueOf(draftOf(stored)), { kind: "task" }).timing).toEqual(stored);
  });

  it("drops it once the work is bound to the waking or the bedtime, so the value saves", () => {
    const draft = { ...draftOf({ after_finish: true }), anchor: "bed" as const };
    const checked = checkTiming(valueOf(draft), { kind: "task" });
    expect(checked.issues).toEqual([]);
    expect(checked.timing).toEqual({ anchor: "bed" });
  });
});
