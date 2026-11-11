import { describe, expect, it } from "vitest";
import type { ModuleDefinition, StructuredBlockHandler } from "@/core/contract/types";
import { findStructuredBlocks, routeStructuredBlocks } from "./blocks";

const fence = (body: string, mark = "```") => `${mark}sherpa\n${body}\n${mark}`;

describe("findStructuredBlocks", () => {
  it("finds a fenced sherpa block inside other text and parses its JSON", () => {
    const text = `Doküman hazır.\n\n${fence('{ "course": "BBF301E", "minutes": 240 }')}\n\nKolay gelsin.`;
    const blocks = findStructuredBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].payload).toEqual({ course: "BBF301E", minutes: 240 });
    expect(blocks[0].raw).toBe(fence('{ "course": "BBF301E", "minutes": 240 }'));
  });

  it("reads both kinds of fence, several blocks, Windows line ends and a payload over lines", () => {
    const text = [
      fence('{ "n": 1 }'),
      "arada bir satır",
      fence('{\n  "n": 2,\n  "list": [1, 2]\n}', "~~~"),
      '```sherpa  \r\n{ "n": 3 }\r\n```',
    ].join("\n");
    expect(findStructuredBlocks(text).map((block) => block.payload)).toEqual([
      { n: 1 },
      { n: 2, list: [1, 2] },
      { n: 3 },
    ]);
  });

  it("skips what is not a sherpa block or not JSON", () => {
    expect(findStructuredBlocks("düz metin")).toEqual([]);
    expect(findStructuredBlocks('```json\n{ "n": 1 }\n```')).toEqual([]);
    expect(findStructuredBlocks(fence("bu JSON değil"))).toEqual([]);
    // A fence that is opened with one mark and closed with the other is not a block.
    expect(findStructuredBlocks('```sherpa\n{ "n": 1 }\n~~~')).toEqual([]);
    // One broken block does not hide a good one next to it.
    expect(
      findStructuredBlocks(`${fence("{ bozuk")}\n${fence('{ "n": 2 }')}`).map((b) => b.payload),
    ).toEqual([{ n: 2 }]);
  });
});

function moduleWith(slug: string, handlers: StructuredBlockHandler[]): ModuleDefinition {
  return { slug, blocks: handlers } as unknown as ModuleDefinition;
}

const handler = (key: string, match: (payload: unknown) => boolean): StructuredBlockHandler => ({
  key,
  match,
  handle: async () => {},
});

const has = (field: string) => (payload: unknown) =>
  typeof payload === "object" && payload !== null && field in payload;

describe("routeStructuredBlocks", () => {
  const okul = moduleWith("okul", [handler("prep", has("course")), handler("grade", has("grade"))]);
  const beslenme = moduleWith("beslenme", [handler("plan", has("meals"))]);
  const greedy = moduleWith("her-sey", [handler("any", () => true)]);

  it("gives each block to the module whose handler accepts it", () => {
    const blocks = findStructuredBlocks(
      [fence('{ "meals": 3 }'), fence('{ "grade": "BA" }')].join("\n"),
    );
    const { routed, unclaimed } = routeStructuredBlocks(blocks, [okul, beslenme]);
    expect(routed.map((route) => [route.module.slug, route.handler.key])).toEqual([
      ["beslenme", "plan"],
      ["okul", "grade"],
    ]);
    expect(unclaimed).toEqual([]);
  });

  it("the first module in the list that accepts a block takes it", () => {
    const blocks = findStructuredBlocks(fence('{ "course": "BBF301E" }'));
    expect(routeStructuredBlocks(blocks, [okul, greedy]).routed[0].module.slug).toBe("okul");
    expect(routeStructuredBlocks(blocks, [greedy, okul]).routed[0].module.slug).toBe("her-sey");
  });

  it("returns blocks nobody accepts separately", () => {
    const blocks = findStructuredBlocks(
      [fence('{ "unknown": true }'), fence('{ "course": "X" }')].join("\n"),
    );
    const { routed, unclaimed } = routeStructuredBlocks(blocks, [okul, beslenme]);
    expect(routed).toHaveLength(1);
    expect(unclaimed.map((block) => block.payload)).toEqual([{ unknown: true }]);
    expect(routeStructuredBlocks(blocks, []).unclaimed).toHaveLength(2);
  });

  it("a handler whose match throws does not take the block and does not stop the others", () => {
    const broken = moduleWith("bozuk", [
      handler("throws", () => {
        throw new Error("match failed");
      }),
    ]);
    const blocks = findStructuredBlocks(fence('{ "course": "X" }'));
    const { routed } = routeStructuredBlocks(blocks, [broken, okul]);
    expect(routed.map((route) => route.module.slug)).toEqual(["okul"]);
  });

  it("modules without block handlers are passed over", () => {
    const plain = { slug: "duz" } as unknown as ModuleDefinition;
    const blocks = findStructuredBlocks(fence('{ "course": "X" }'));
    expect(routeStructuredBlocks(blocks, [plain, okul]).routed[0].module.slug).toBe("okul");
  });
});
