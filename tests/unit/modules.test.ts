import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRegistry, definitionProblems } from "@/core/contract/registry";
import { sablon } from "@/modules/_sablon/module";
import { deneme } from "@/modules/deneme/module";
import { DEMO_MODULE_ENABLED, registry, TEMPLATE_COPY } from "@/modules/registry";

// The two modules of the core phases follow the contract, and a module is nothing but its own
// folder plus one line in the registry.

describe("the module template", () => {
  it("is a valid definition as it stands", () => {
    expect(definitionProblems(sablon)).toEqual([]);
  });

  it("gives a working module once it is renamed (README step 2)", () => {
    const ev = { ...sablon, slug: "ev", name: "Ev", color: "#16a34a" };
    const copy = createRegistry([ev, deneme]);
    expect(copy.get("ev")?.ui.tabs.map((tab) => tab.key)).toEqual(["genel"]);
  });

  it("is not registered itself; only a renamed copy is, where the demo switch is on", () => {
    expect(registry.get("sablon")).toBeUndefined();
    expect(TEMPLATE_COPY).toEqual({ ...sablon, slug: "sablon-kopya", name: "Şablon kopyası" });
    expect(registry.get(TEMPLATE_COPY.slug) !== undefined).toBe(DEMO_MODULE_ENABLED);
  });
});

describe("the deneme module", () => {
  it("follows the contract", () => {
    expect(definitionProblems(deneme)).toEqual([]);
  });

  it("uses every connection point of the contract", () => {
    // The connection points and the interface floor (docs/06-modul-sozlesmesi.md).
    expect(deneme.intake.length).toBeGreaterThan(0);
    expect(deneme.blocks?.length).toBeGreaterThan(0);
    expect(typeof deneme.chip).toBe("function");
    expect(typeof deneme.nowCard).toBe("function");
    expect(typeof deneme.alerts).toBe("function");
    expect(deneme.emits.length).toBeGreaterThan(0);
    expect(Object.keys(deneme.on ?? {})).toEqual(
      expect.arrayContaining([deneme.emits[0], "core.prompt_answered"]),
    );
    expect(Object.keys(deneme.modeBehavior).sort()).toEqual([
      "busy",
      "holiday",
      "minimum",
      "normal",
    ]);
    expect(typeof deneme.weeklyReport).toBe("function");
    expect(typeof deneme.onActivate).toBe("function");
    expect(typeof deneme.onOutcome).toBe("function");
    expect(deneme.sizingHints).toBeTruthy();
    expect(deneme.tables).toEqual(["deneme_items"]);
    // Interface: a tab of its own, a sub page, a full-screen view, a quick action, settings.
    expect(deneme.ui.tabs.length).toBeGreaterThan(1);
    expect(deneme.ui.routes?.length).toBeGreaterThan(0);
    expect(deneme.ui.fullscreen?.length).toBeGreaterThan(0);
    expect(deneme.ui.actions?.length).toBeGreaterThan(0);
    expect(deneme.ui.settings).toBeTypeOf("function");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["1", true],
    ["", false],
    ["0", false],
    ["true", false],
  ])("is registered only where the demo switch is on (%j)", async (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_SHERPA_DEMO_MODULE", value);
    vi.resetModules();
    const fresh = await import("@/modules/registry");
    expect(fresh.DEMO_MODULE_ENABLED).toBe(expected);
    expect(fresh.registry.get("deneme") !== undefined).toBe(expected);
    expect(fresh.registry.get("sablon-kopya") !== undefined).toBe(expected);
  });
});

/** Every source file under a folder. */
function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("module boundaries", () => {
  const modulesRoot = path.join("src", "modules");
  const folders = readdirSync(modulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it("finds the module folders", () => {
    expect(folders).toEqual(expect.arrayContaining(["_sablon", "deneme"]));
  });

  it.each(folders)("%s imports no other module", (folder) => {
    for (const file of sourceFiles(path.join(modulesRoot, folder))) {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
      for (const target of imports) {
        // Its own folder (relative), the core, the shared library and components are fine.
        const other = /^@\/modules\/([^/]+)/.exec(target)?.[1];
        expect(other === undefined || other === folder, `${file} imports ${target}`).toBe(true);
        expect(target.startsWith("../../"), `${file} leaves its folder: ${target}`).toBe(false);
      }
    }
  });

  // docs/06-modul-sozlesmesi.md, "Modül çekirdekten neyi içe aktarabilir". A new entry here
  // goes into that table as well.
  const ALLOWED = [
    "@/core/contract/types",
    "@/core/types",
    "@/core/ui/module/ModuleProvider",
    "@/core/app/hooks",
    "@/core/app/actions",
    "@/core/ui/Notices",
    "@/core/ui/kit",
    "@/lib/date",
    "@/lib/utils",
    "@/lib/supabase/database.types",
  ];

  it.each(folders)("%s imports from the core only what the contract allows", (folder) => {
    for (const file of sourceFiles(path.join(modulesRoot, folder))) {
      const source = readFileSync(file, "utf8");
      const targets = [
        ...source.matchAll(/from\s+["']([^"']+)["']/g),
        ...source.matchAll(/import\(\s*["']([^"']+)["']/g),
        ...source.matchAll(/require\(\s*["']([^"']+)["']/g),
      ].map((match) => match[1]);
      for (const target of targets) {
        // Its own files, and packages from node_modules, are the module's own business.
        if (target.startsWith("./") || target.startsWith("../")) continue;
        if (!target.startsWith("@/")) continue;
        const allowed = ALLOWED.includes(target) || target.startsWith("@/components/ui/");
        expect(allowed, `${file} imports ${target}`).toBe(true);
      }
    }
  });

  it("the allow list would catch a module reaching for the core's data functions", () => {
    for (const target of ["@/core/data/work", "@/core/data/propose", "@/lib/supabase/client"]) {
      expect(ALLOWED.includes(target) || target.startsWith("@/components/ui/")).toBe(false);
    }
  });

  it("no module reaches into a core table directly", () => {
    const coreTables = [
      "areas",
      "modules",
      "work_items",
      "tasks",
      "rhythms",
      "rhythm_logs",
      "block_series",
      "blocks",
      "sessions",
      "days",
      "week_plans",
      "horizon_reviews",
      "life_mode_periods",
      "inbox_entries",
      "prompts",
      "events",
      "weekly_reviews",
      "planner_stats",
      "settings",
    ];
    for (const folder of folders) {
      for (const file of sourceFiles(path.join(modulesRoot, folder))) {
        const source = readFileSync(file, "utf8");
        for (const table of coreTables) {
          // .from("table"), with any quote and any spacing or line break after the bracket.
          const reached = new RegExp("\\.from\\(\\s*[\"'`]" + table + "[\"'`]").test(source);
          expect(reached, `${file} touches ${table}`).toBe(false);
        }
      }
    }
  });
});
