import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

// The class merger knows the design tokens: a size and a colour of the same prefix are two
// groups, and two of one group keep the last (src/lib/utils.ts).
describe("cn and the design tokens", () => {
  it("keeps a token size next to a token colour", () => {
    expect(cn("text-note text-ink")).toBe("text-note text-ink");
    expect(cn("text-ink-2 text-sm")).toBe("text-ink-2 text-sm");
  });

  it("keeps the last of one group", () => {
    expect(cn("text-lead font-semibold", "text-heading")).toBe("font-semibold text-heading");
    expect(cn("bg-glass-dense", "bg-light")).toBe("bg-light");
    expect(cn("rounded-panel", "rounded-dense")).toBe("rounded-dense");
    expect(cn("h-control", "h-11")).toBe("h-11");
  });
});
