import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Architecture rule: src/core never imports from src/modules.
// This lints small snippets as if they lived at the given path, using the project's real config.
const eslint = new ESLint();

const RULES = ["no-restricted-imports", "no-restricted-syntax"];

async function restrictedImportErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.severity === 2 && RULES.includes(message.ruleId ?? ""))
    .map((message) => message.message);
}

describe("core does not import modules", () => {
  it("rejects an alias import of a module from the core", async () => {
    const errors = await restrictedImportErrors(
      'import { okul } from "@/modules/okul/module";\nexport const x = okul;\n',
      "src/core/planner/example.ts",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("src/core must not import from src/modules");
  });

  it("rejects the registry and relative paths too", async () => {
    expect(
      await restrictedImportErrors(
        'import { modules } from "@/modules/registry";\nexport const x = modules;\n',
        "src/core/data/example.ts",
      ),
    ).toHaveLength(1);
    expect(
      await restrictedImportErrors(
        'import { modules } from "../../modules/registry";\nexport const x = modules;\n',
        "src/core/ui/Example.tsx",
      ),
    ).toHaveLength(1);
  });

  it("rejects every other spelling of a path into the modules", async () => {
    const spellings = [
      "./../../modules/registry",
      "../../../src/modules/registry",
      "@/core/../modules/registry",
      "@/modules",
      "../../modules",
    ];
    for (const spelling of spellings) {
      const errors = await restrictedImportErrors(
        `import { modules } from "${spelling}";\nexport const x = modules;\n`,
        "src/core/data/example.ts",
      );
      expect(errors, spelling).toHaveLength(1);
      expect(errors[0]).toContain("src/core must not import from src/modules");
    }
  });

  it("rejects re-exports, type imports, dynamic imports and require", async () => {
    const snippets = [
      'export { modules } from "@/modules/registry";\n',
      'import type { Okul } from "@/modules/okul/module";\nexport type X = Okul;\n',
      'export const load = () => import("@/modules/registry");\n',
      'export const load = () => import("./../../modules/registry");\n',
      "export const load = (slug: string) => import(`@/modules/${slug}/module`);\n",
      'export const registry = require("../../modules/registry");\n',
    ];
    for (const snippet of snippets) {
      const errors = await restrictedImportErrors(snippet, "src/core/data/example.ts");
      expect(errors, snippet).toHaveLength(1);
      expect(errors[0]).toContain("src/core must not import from src/modules");
    }
  });

  it("allows core-to-core and library imports", async () => {
    expect(
      await restrictedImportErrors(
        'import { dayKey } from "@/lib/date";\nimport { x } from "../data/x";\nexport const y = [dayKey, x];\n',
        "src/core/planner/example.ts",
      ),
    ).toHaveLength(0);
    // Dynamic imports inside the core, and packages that merely have "modules" in their name.
    expect(
      await restrictedImportErrors(
        'import x from "some-modules/thing";\nexport const load = () => import("../data/x");\nexport const y = x;\n',
        "src/core/planner/example.ts",
      ),
    ).toHaveLength(0);
  });

  it("lets code outside the core import modules", async () => {
    expect(
      await restrictedImportErrors(
        'import { modules } from "@/modules/registry";\nexport const x = modules;\n',
        "src/app/(app)/m/example.ts",
      ),
    ).toHaveLength(0);
  });
}, 60_000);

// Architecture rule: AI calls go through the single gateway; only src/core/ai uses the SDK.
describe("only the AI gateway imports the provider's SDK", () => {
  const SDK = 'import Anthropic from "@anthropic-ai/sdk";\nexport const x = Anthropic;\n';
  const HELPER =
    'import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";\nexport const x = zodOutputFormat;\n';

  it("rejects the SDK everywhere else: routes, components, the rest of the core, modules, scripts", async () => {
    for (const filePath of [
      "src/app/api/ai/example/route.ts",
      "src/core/ui/Example.tsx",
      "src/core/data/example.ts",
      "src/modules/deneme/example.ts",
      "src/lib/example.ts",
      "scripts/example.ts",
    ]) {
      for (const code of [SDK, HELPER]) {
        const errors = await restrictedImportErrors(code, filePath);
        expect(errors, filePath).toHaveLength(1);
        expect(errors[0]).toContain("Only src/core/ai may use the AI provider's SDK");
      }
    }
  });

  it("keeps the module rule in the core next to the SDK rule", async () => {
    const errors = await restrictedImportErrors(
      'import Anthropic from "@anthropic-ai/sdk";\nimport { m } from "@/modules/registry";\nexport const x = [Anthropic, m];\n',
      "src/core/data/example.ts",
    );
    expect(errors).toHaveLength(2);
  });

  it("allows the SDK inside the gateway, where the module rule still holds", async () => {
    expect(await restrictedImportErrors(SDK, "src/core/ai/anthropic.ts")).toHaveLength(0);
    expect(await restrictedImportErrors(HELPER, "src/core/ai/example.ts")).toHaveLength(0);
    expect(
      await restrictedImportErrors(
        'import { m } from "@/modules/registry";\nexport const x = m;\n',
        "src/core/ai/example.ts",
      ),
    ).toHaveLength(1);
  });
}, 60_000);
