import type { ModuleDefinition } from "@/core/contract/types";
import { Overview } from "./components/Overview";
import { listOpenWork } from "./queries";
import { listeners } from "./rules";

// Template for a new module. Copy this folder, rename it, and follow README.md.
// Every field the contract requires is here with the smallest valid value; the optional
// ones are listed at the bottom as comments. The contract itself: docs/06-modul-sozlesmesi.md.

export const sablon: ModuleDefinition = {
  // Lower-case letters, digits and dashes. Also the folder name, the URL (/m/<slug>) and the
  // prefix of the module's events ("<slug>.") and tables ("<slug>_").
  slug: "sablon",
  name: "Şablon",
  kind: "lifelong", // lifelong | term | until_goal
  color: "#737373",

  // 1. Main screen: one line of status and its health.
  async chip(ctx) {
    const open = await listOpenWork(ctx);
    return { text: open.length === 0 ? "sırada iş yok" : `${open.length} açık iş`, health: "ok" };
  },

  // 2. Entry types of the module, shown in quick add next to "İş". None yet.
  intake: [],

  // 3. Events the module publishes, and the ones it listens to (rules.ts).
  emits: [],
  on: listeners,

  // 4. How the module behaves in each life mode.
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: { weightMultiplier: 0.5, floorMultiplier: 0.5 },
    minimum: { weightMultiplier: 0.2, floorMultiplier: 0 },
    holiday: { weightMultiplier: 0, floorMultiplier: 0 },
  },

  // 5. Weekly report: a few numbers and at most two suggestions.
  async weeklyReport(ctx) {
    const open = await listOpenWork(ctx);
    return { metrics: [{ label: "Açık iş", value: String(open.length) }], suggestions: [] };
  },

  // Interface: at least one tab. The page frame, the tab bar and the routes come from the core.
  ui: {
    tabs: [{ key: "genel", label: "Genel", component: Overview }],
  },

  // Optional, add when the module needs them:
  //   area: { slug: "saglik", name: "Sağlık" }      the area page the module belongs to
  //   nowCard: (task) => ({ detail, links })        its own content on the "now" card
  //   alerts: async (ctx) => [...]                  at most one is shown
  //   blocks: [{ key, match, handle }]              structured blocks pasted into quick add
  //   onActivate / onArchive                        life cycle
  //   sizingHints: "..."                            effort hints for the AI
  //   onOutcome: async (outcome, ctx) => {}         what a proposed item cost
  //   extractors: [{ key, version, instructions, item }]   readers of pasted text (ctx.extract)
  //   tables: ["sablon_..."]                        own tables (included in the export)
  //   ui.routes / ui.fullscreen / ui.actions / ui.settings / ui.history
};
