import { describe, expect, it } from "vitest";
import { findStructuredBlocks, routeStructuredBlocks } from "./blocks";
import {
  dueAtEndOfDay,
  fitsOneSitting,
  parseDayWord,
  parseDurationWord,
  parseQuickText,
} from "./parse";
import type { ModuleDefinition } from "@/core/contract/types";

// Thursday 12 November 2026, 10:40 in Istanbul.
const NOW = new Date("2026-11-12T10:40:00+03:00");

describe("parseDayWord", () => {
  it("reads the short words from the interface document", () => {
    expect(parseDayWord("bugün", NOW)).toBe("2026-11-12");
    expect(parseDayWord("yarın", NOW)).toBe("2026-11-13");
    expect(parseDayWord("Yarın", NOW)).toBe("2026-11-13");
    expect(parseDayWord("cuma", NOW)).toBe("2026-11-13");
    expect(parseDayWord("15.11", NOW)).toBe("2026-11-15");
    expect(parseDayWord("+3g", NOW)).toBe("2026-11-15");
    expect(parseDayWord("+2h", NOW)).toBe("2026-11-26");
  });

  it("takes a weekday as the next such day; today's own weekday means next week", () => {
    expect(parseDayWord("perşembe", NOW)).toBe("2026-11-19");
    expect(parseDayWord("pazartesi", NOW)).toBe("2026-11-16");
    expect(parseDayWord("çarşamba", NOW)).toBe("2026-11-18");
    expect(parseDayWord("ÇARŞAMBA", NOW)).toBe("2026-11-18");
    expect(parseDayWord("sali", NOW)).toBe("2026-11-17");
    expect(parseDayWord("pazar", NOW)).toBe("2026-11-15");
  });

  it("rolls a date without a year over to next year once it has passed", () => {
    expect(parseDayWord("12.11", NOW)).toBe("2026-11-12");
    expect(parseDayWord("11.11", NOW)).toBe("2027-11-11");
    expect(parseDayWord("5.1", NOW)).toBe("2027-01-05");
    expect(parseDayWord("05.01.2026", NOW)).toBe("2026-01-05");
  });

  it("refuses dates that do not exist and words that are not dates", () => {
    for (const word of ["31.11", "30.02", "0.5", "15.13", "29.02.2027", "slayt", "3g", "+g", ""]) {
      expect(parseDayWord(word, NOW), word).toBeNull();
    }
    expect(parseDayWord("29.02.2028", NOW)).toBe("2028-02-29");
  });

  it("uses the Istanbul day, not the device's or UTC's", () => {
    // 23:30 UTC on the 12th is already the 13th in Istanbul.
    const lateUtc = new Date("2026-11-12T23:30:00Z");
    expect(parseDayWord("bugün", lateUtc)).toBe("2026-11-13");
    expect(parseDayWord("yarın", lateUtc)).toBe("2026-11-14");
  });
});

describe("parseDurationWord", () => {
  it("reads minutes and hours", () => {
    expect(parseDurationWord("45dk")).toBe(45);
    expect(parseDurationWord("90DK")).toBe(90);
    expect(parseDurationWord("1s")).toBe(60);
    expect(parseDurationWord("2sa")).toBe(120);
    expect(parseDurationWord("2saat")).toBe(120);
    expect(parseDurationWord("1.5s")).toBe(90);
    expect(parseDurationWord("1,5sa")).toBe(90);
    expect(parseDurationWord("1s30dk")).toBe(90);
  });

  it("refuses everything else", () => {
    for (const word of ["45", "dk", "s", "0dk", "slayt", "5.11", "s30", "3d", ""]) {
      expect(parseDurationWord(word), word).toBeNull();
    }
  });
});

describe("parseQuickText", () => {
  it("takes the date and duration words off the end, in either order", () => {
    expect(parseQuickText("Sunum slaytları cuma", NOW)).toEqual({
      title: "Sunum slaytları",
      dueDay: "2026-11-13",
      minutes: null,
    });
    expect(parseQuickText("Sunum slaytları cuma 45dk", NOW)).toEqual({
      title: "Sunum slaytları",
      dueDay: "2026-11-13",
      minutes: 45,
    });
    expect(parseQuickText("Sunum slaytları 45dk cuma", NOW)).toEqual({
      title: "Sunum slaytları",
      dueDay: "2026-11-13",
      minutes: 45,
    });
    expect(parseQuickText("  Rapor   yaz   2s  ", NOW)).toEqual({
      title: "Rapor yaz",
      dueDay: null,
      minutes: 120,
    });
    expect(parseQuickText("Fatura öde 15.11 20 dk", NOW)).toEqual({
      title: "Fatura öde",
      dueDay: "2026-11-15",
      minutes: 20,
    });
  });

  it("leaves a weekday or a number in the middle of the title alone", () => {
    expect(parseQuickText("Cuma namazından sonra market", NOW)).toEqual({
      title: "Cuma namazından sonra market",
      dueDay: null,
      minutes: null,
    });
    expect(parseQuickText("Bölüm 5 oku yarın", NOW)).toEqual({
      title: "Bölüm 5 oku",
      dueDay: "2026-11-13",
      minutes: null,
    });
    // Only one date and one duration are read; a second one stays in the title.
    expect(parseQuickText("Toplantı cuma pazartesi", NOW)).toEqual({
      title: "Toplantı cuma",
      dueDay: "2026-11-16",
      minutes: null,
    });
  });

  it("never eats the whole line: one word is always the title", () => {
    expect(parseQuickText("yarın", NOW)).toEqual({ title: "yarın", dueDay: null, minutes: null });
    expect(parseQuickText("45 dk", NOW)).toEqual({ title: "45 dk", dueDay: null, minutes: null });
    expect(parseQuickText("cuma 45dk", NOW)).toEqual({ title: "cuma", dueDay: null, minutes: 45 });
    expect(parseQuickText("", NOW)).toEqual({ title: "", dueDay: null, minutes: null });
  });
});

describe("deadlines and the one-sitting limit", () => {
  it("stores a day without a time as the end of that day in Istanbul", () => {
    expect(dueAtEndOfDay("2026-11-13")).toBe("2026-11-13T20:59:00.000Z");
  });

  it("knows what fits in one sitting", () => {
    expect(fitsOneSitting(90)).toBe(true);
    expect(fitsOneSitting(91)).toBe(false);
  });
});

describe("structured blocks", () => {
  const pasted = [
    "Doküman hazır, plan aşağıda.",
    "",
    "```sherpa",
    '{ "course": "BBF301E", "assessment": "Midterm",',
    '  "parts": [ { "title": "Bölüm 1", "kind": "read", "minutes": 40 } ],',
    '  "total_minutes": 40 }',
    "```",
    "",
    "Kolay gelsin.",
  ].join("\n");

  it("finds the sherpa block in pasted text and parses it", () => {
    const blocks = findStructuredBlocks(pasted);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].payload).toMatchObject({ course: "BBF301E", total_minutes: 40 });
    expect(blocks[0].raw.startsWith("```sherpa")).toBe(true);
  });

  it("reads several blocks, tilde fences and Windows line endings", () => {
    const text = '~~~sherpa\r\n{"a":1}\r\n~~~\r\nara\r\n```sherpa\n{"b":2}\n```';
    expect(findStructuredBlocks(text).map((block) => block.payload)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("ignores other fences, broken JSON and plain text", () => {
    expect(findStructuredBlocks('```json\n{"a":1}\n```')).toEqual([]);
    expect(findStructuredBlocks("```sherpa\n{ not json }\n```")).toEqual([]);
    expect(findStructuredBlocks("sherpa bloğu yok")).toEqual([]);
  });

  it("hands each block to the first module that accepts it", () => {
    const handle = async () => {};
    const school = {
      slug: "okul",
      blocks: [
        {
          key: "plan",
          match: (p: unknown) => typeof p === "object" && p !== null && "course" in p,
          handle,
        },
      ],
    } as unknown as ModuleDefinition;
    const broken = {
      slug: "bozuk",
      blocks: [
        {
          key: "x",
          match: () => {
            throw new Error("boom");
          },
          handle,
        },
      ],
    } as unknown as ModuleDefinition;
    const plain = { slug: "ev" } as unknown as ModuleDefinition;

    const blocks = findStructuredBlocks(`${pasted}\n\`\`\`sherpa\n{"unknown":true}\n\`\`\``);
    const { routed, unclaimed } = routeStructuredBlocks(blocks, [plain, broken, school]);
    expect(routed.map((route) => [route.module.slug, route.handler.key])).toEqual([
      ["okul", "plan"],
    ]);
    expect(unclaimed.map((block) => block.payload)).toEqual([{ unknown: true }]);
  });
});
