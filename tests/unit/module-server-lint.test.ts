import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Ç3d: a module's server code (rules, queries, ingest, jobs) imports nothing made for the
// browser (docs/06-modul-sozlesmesi.md, "Sunucu zemini"). The real ESLint config is run on small
// sources placed, by name only, where a module's files live.

const eslint = new ESLint();

async function problems(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => `${message.ruleId}: ${message.message}`);
}

const SERVER_FILES = [
  "src/modules/ornek/rules.ts",
  "src/modules/ornek/queries.ts",
  "src/modules/ornek/ingest.ts",
  "src/modules/ornek/jobs.ts",
  "src/modules/ornek/server/ninova.ts",
];

describe("a module's server code", () => {
  const forbidden = [
    'import { useState } from "react";\nexport const x = useState;\n',
    'import { useRouter } from "next/navigation";\nexport const x = useRouter;\n',
    'import Link from "next/link";\nexport const x = Link;\n',
    'import { useQuery } from "@tanstack/react-query";\nexport const x = useQuery;\n',
    'import { useNow } from "@/core/app/hooks";\nexport const x = useNow;\n',
    'import { StepRunner } from "@/core/ui/kit";\nexport const x = StepRunner;\n',
    'import { useSay } from "@/core/voice";\nexport const x = useSay;\n',
    'import { createClient } from "@/lib/supabase/client";\nexport const x = createClient;\n',
    'import { Button } from "@/components/ui/button";\nexport const x = Button;\n',
    'import { ItemsTab } from "./components/ItemsTab";\nexport const x = ItemsTab;\n',
    'export const x = () => import("react");\n',
    '"use client";\nexport const x = 1;\n',
    "export const x = () => window.location.href;\n",
    'export const x = () => localStorage.getItem("a");\n',
    "export const x = () => document.title;\n",
  ];

  it("fails the lint when it imports or touches something of the browser", async () => {
    for (const file of SERVER_FILES) {
      for (const code of forbidden) {
        const found = await problems(code, file);
        expect(
          found.some((problem) => /^no-restricted-(imports|syntax|globals):/.test(problem)),
          `${file}\n${code}\n${found.join("\n")}`,
        ).toBe(true);
      }
    }
  });

  it("may use the contract, the row types, date helpers and zod", async () => {
    const code = [
      'import type { ModuleContext } from "@/core/contract/types";',
      'import { z } from "zod";',
      'import { dayKey } from "@/lib/date";',
      'import { listItems } from "./queries";',
      "export const schema = z.object({ title: z.string() });",
      "export async function run(ctx: ModuleContext) {",
      "  await listItems(ctx);",
      "  return dayKey(ctx.now());",
      "}",
      "",
    ].join("\n");
    for (const file of SERVER_FILES) expect(await problems(code, file), file).toEqual([]);
  });

  it("imports inside the module only server code: no helper as a back door (phase audit)", async () => {
    const restricted = async (code: string, file: string) =>
      (await problems(code, file)).some((problem) => problem.startsWith("no-restricted-imports"));
    const use = (from: string) => `import { x } from "${from}";\nexport const y = x;\n`;
    for (const from of ["./helper", "./scene", "./subject", "./extract", "../okul/rules"]) {
      expect(await restricted(use(from), "src/modules/ornek/jobs.ts"), from).toBe(true);
    }
    for (const from of ["./rules", "./queries", "./ingest", "./server/ninova"]) {
      expect(await restricted(use(from), "src/modules/ornek/jobs.ts"), from).toBe(false);
    }
    // Inside server/: its own files, and the module's server files above it.
    for (const from of ["./parse", "../rules", "../queries"]) {
      expect(await restricted(use(from), "src/modules/ornek/server/ninova.ts"), from).toBe(false);
    }
    for (const from of ["../helper", "../components/View", "../scene"]) {
      expect(await restricted(use(from), "src/modules/ornek/server/ninova.ts"), from).toBe(true);
    }
  });

  it("closes the back door's other spellings too (phase audit, round 2)", async () => {
    const restricted = async (code: string, file: string) =>
      (await problems(code, file)).some((problem) =>
        /^no-restricted-(imports|syntax):/.test(problem),
      );
    const cases: [string, string][] = [
      ['import { x } from "@/modules/ornek/helper";\nexport const y = x;\n', "jobs.ts"],
      ['import { x } from "@/modules/okul/scene";\nexport const y = x;\n', "rules.ts"],
      ['export const y = () => import("./helper");\n', "jobs.ts"],
      ['export const y = () => require("./helper");\n', "ingest.ts"],
      ['import { x } from "./server/../helper";\nexport const y = x;\n', "jobs.ts"],
      ['import { x } from "../rules/../scene";\nexport const y = x;\n', "server/ninova.ts"],
      ['import { useState } from "react";\nexport const y = useState;\n', "server/view.tsx"],
      ['"use client";\nexport const y = 1;\n', "server/view.tsx"],
    ];
    for (const [code, file] of cases) {
      expect(await restricted(code, `src/modules/ornek/${file}`), `${file}: ${code}`).toBe(true);
    }
  });

  it("leaves the module's screens alone", async () => {
    const code = '"use client";\nimport { useState } from "react";\nexport const x = useState;\n';
    expect(await problems(code, "src/modules/ornek/components/View.tsx")).toEqual([]);
  });
});
