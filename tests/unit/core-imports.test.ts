import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Architecture rule: src/core never imports from src/modules.
// This lints small snippets as if they lived at the given path, using the project's real config.
const eslint = new ESLint();

async function restrictedImportErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
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

  it("allows core-to-core and library imports", async () => {
    expect(
      await restrictedImportErrors(
        'import { dayKey } from "@/lib/date";\nimport { x } from "../data/x";\nexport const y = [dayKey, x];\n',
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
