import { describe, expect, it } from "vitest";
import { dayColumn, docsText, progressText, type Row, termOf, weekLabel } from "./pages";

// The home page's shape (okul-sayfalar.md, "Ana sayfa"): weeks from this one on, the weeks gone
// by folded, the finals apart, the undated ones last; a row's lines.

const now = new Date("2026-11-23T10:00:00+03:00"); // Monday

const row = (
  title: string,
  date: string | null,
  weight: number | null,
  estimated = false,
): Row => ({
  id: title,
  title,
  kind: "quiz",
  course: { id: "c", code: "SNM101E", name: "Sınama", color: "#000000", facet: "snm101e" },
  date,
  time: null,
  estimated,
  weight,
  done: false,
  submitted: false,
  score: null,
  line: "",
  progress: null,
  docs: null,
  parentId: null,
  owner: null,
  ownerName: null,
  proposed: false,
});

describe("the term by week", () => {
  it("folds the weeks gone by, groups the rest by week, keeps the finals and the undated apart", () => {
    const term = termOf(
      [
        row("Eski", "2026-11-10", 5),
        row("Bu hafta", "2026-11-24", 20),
        row("Bu hafta tahmini", "2026-11-26", 5, true),
        row("Gelecek", "2026-12-01", 10),
        row("Final", "2027-01-05", 40, true),
        row("Tarihsiz", null, 10),
      ],
      { finals_from: "2027-01-02", finals_to: "2027-01-17" },
      now,
    );
    expect(term.past.map((r) => r.title)).toEqual(["Eski"]);
    expect(term.weeks.map((w) => [w.label, w.rows.length, w.weight])).toEqual([
      ["23–29 KAS", 2, "%20 + tahmini %5"],
      ["30 KAS – 6 ARA", 1, "%10"],
    ]);
    expect(term.finals?.label).toBe("FİNAL DÖNEMİ · 2–17 OCA");
    expect(term.unknown.map((r) => r.title)).toEqual(["Tarihsiz"]);
  });

  it("writes a week, a day, a progress and the documents the way the frames do", () => {
    expect(weekLabel("2026-12-28")).toBe("28 ARA – 3 OCA");
    expect(dayColumn("2026-11-24")).toEqual({ date: "24", under: "Kas Sal" });
    expect(progressText({ label: "hazırlık", done: 240, total: 480, provisional: true })).toBe(
      "hazırlık 4 sa / yaklaşık 8 sa",
    );
    expect(progressText({ label: "çalışma", done: 0, total: 180, provisional: false })).toBe(
      "çalışma 0 dk / 3 sa",
    );
    expect(docsText({ ready: true, day: "2026-12-01" })).toBe("dokümanlar hazır");
    expect(docsText({ ready: false, day: "2026-12-01" })).toBe("dokümanlar: 1 Ara");
  });
});
