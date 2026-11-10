import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Verification rule: tests are never skipped or narrowed to get to green.
// ESLint refuses the usual ways of doing that in test files, so `npm run check` fails on them.
const eslint = new ESLint();

async function gateErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.severity === 2 && message.ruleId === "no-restricted-syntax")
    .map((message) => message.message);
}

const header = 'import { describe, expect, it, test } from "vitest";\n';
const body = '("x", () => {\n  expect(1).toBe(1);\n});\n';

describe("tests cannot be skipped or narrowed", () => {
  it("rejects only, skip, todo and fixme in unit and end-to-end tests", async () => {
    const calls = ["it.only", "it.skip", "test.only", "test.skip", "describe.skip", "test.fixme"];
    for (const filePath of ["src/lib/example.test.ts", "tests/e2e/example.spec.ts"]) {
      for (const call of calls) {
        const errors = await gateErrors(
          `${header}${call}${body}export { describe, it, test };\n`,
          filePath,
        );
        expect(errors, `${call} in ${filePath}`).toHaveLength(1);
        expect(errors[0]).toContain("Tests are not skipped or narrowed");
      }
    }
  });

  it("rejects nested and declared forms", async () => {
    const snippets = [
      `${header}test.describe.skip${body}export { describe, it };\n`,
      `${header}it.todo("later");\nexport { describe, expect, test };\n`,
      `${header}describe.only${body}export { it, test };\n`,
    ];
    for (const snippet of snippets) {
      expect(await gateErrors(snippet, "tests/e2e/example.spec.ts"), snippet).toHaveLength(1);
    }
  });

  it("leaves ordinary tests alone", async () => {
    const code = `${header}describe("x", () => {\n  it${body.replace(/\n/g, "\n  ").trimEnd()}\n  test${body.replace(/\n/g, "\n  ").trimEnd()}\n});\n`;
    expect(await gateErrors(code, "src/lib/example.test.ts")).toHaveLength(0);
  });
}, 60_000);
