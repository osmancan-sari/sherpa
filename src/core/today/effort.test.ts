import { describe, expect, it } from "vitest";
import { workItem } from "@/core/testing/factories";
import { effortText, effortWhy, isPlaceholder } from "./effort";

// Okul çekirdek A: a placeholder effort on the screens (docs/tasarim/parcalar.md, "Yaklaşık süre").

describe("a placeholder effort on the screens", () => {
  it("is written 'yaklaşık' before its minutes", () => {
    expect(effortText(120, true)).toBe("yaklaşık 2 sa");
    expect(effortText(45, false)).toBe("45 dk");
    expect(isPlaceholder(workItem({ effort_provisional: true }))).toBe(true);
    expect(isPlaceholder(workItem())).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
  });

  it("'Neden?' says what it rests on: the module's sentence, else the AI's reason", () => {
    const basis = "Önceki iki midterm 7 ve 9 saat sürdü.";
    expect(effortWhy(workItem({ effort_provisional: true, effort_basis: basis }), "ai")).toBe(
      `Süre yaklaşık: ${basis}`,
    );
    expect(effortWhy(workItem({ effort_provisional: true }), "benzer işlere göre")).toBe(
      "Süre yaklaşık: benzer işlere göre",
    );
    expect(effortWhy(workItem({ effort_provisional: true }))).toBe(
      "Süre yaklaşık; modül kesin süreyi verince güncellenir.",
    );
    // A real effort says its sentence when it has one, else nothing.
    expect(effortWhy(workItem({ effort_basis: basis }))).toBe(`Süre: ${basis}`);
    expect(effortWhy(workItem(), "ai")).toBeNull();
    expect(effortWhy(null)).toBeNull();
  });
});
