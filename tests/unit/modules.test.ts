import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRegistry, definitionProblems } from "@/core/contract/registry";
import { sablon } from "@/modules/_sablon/module";
import { deneme } from "@/modules/deneme/module";
import { registry } from "@/modules/registry";

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

  it("is not registered itself", () => {
    expect(registry.get("sablon")).toBeUndefined();
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

  it("is registered only where the demo switch is on", () => {
    expect(registry.get("deneme") !== undefined).toBe(
      process.env.NEXT_PUBLIC_SHERPA_DEMO_MODULE === "1",
    );
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
      "inbox_entries",
      "prompts",
      "events",
      "settings",
    ];
    for (const folder of folders) {
      for (const file of sourceFiles(path.join(modulesRoot, folder))) {
        const source = readFileSync(file, "utf8");
        for (const table of coreTables) {
          expect(source.includes(`.from("${table}")`), `${file} touches ${table}`).toBe(false);
        }
      }
    }
  });
});
