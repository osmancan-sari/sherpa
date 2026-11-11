import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decomposeSpec } from "./calls/decompose";
import { enrichSpec } from "./calls/enrich";
import { extractSpec } from "./calls/extract";
import { sizeSpec } from "./calls/size";

// The real provider asks for structured output in the call's schema. The SDK turns the Zod
// schema into the JSON schema the API takes; a schema it cannot turn would only fail with a key.

const extract = extractSpec("okul", {
  key: "duyuru",
  version: "1",
  instructions: "x",
  item: z.object({ title: z.string(), due: z.string().nullable() }),
});

describe("structured output formats", () => {
  for (const spec of [enrichSpec, sizeSpec, decomposeSpec, extract]) {
    it(`${spec.kind}: converts to a strict JSON schema object`, () => {
      const format = zodOutputFormat(spec.schema as z.ZodType<unknown>);
      expect(format.type).toBe("json_schema");
      expect(format.schema).toMatchObject({ type: "object", additionalProperties: false });
      // Every property is required in strict mode; "unknown" is expressed as null.
      const schema = format.schema as { properties: object; required: string[] };
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    });
  }
});
