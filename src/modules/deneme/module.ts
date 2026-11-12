import type { ModuleDefinition } from "@/core/contract/types";
import { dayKey, shiftDay } from "@/lib/date";
import { ExtractPage } from "./components/ExtractPage";
import { ItemsTab } from "./components/ItemsTab";
import { KitTab } from "./components/KitTab";
import { denemeScene } from "./scene";
import { FocusView, HistoryView, ItemPage, SettingsForm } from "./components/Views";
import { kayitReader } from "./extract";
import { type DenemeKind, listItems, SOURCE_TYPE } from "./queries";
import { addItem, EVENTS, listeners, onOutcome, proposalFor, settingsOf } from "./rules";

// "Deneme": the small module the core is tried against until real modules arrive. It uses
// every connection point of the contract (docs/06-modul-sozlesmesi.md) once, with the simplest
// thing that makes the point. It is switched on only where NEXT_PUBLIC_SHERPA_DEMO_MODULE=1
// (src/modules/registry.ts); it never runs against production data.

const KINDS: DenemeKind[] = ["hedef", "aliskanlik", "etkinlik", "antrenman", "odak"];

export const deneme: ModuleDefinition = {
  slug: "deneme",
  name: "Deneme",
  kind: "lifelong",
  area: { slug: "sinama", name: "Sınama" },
  color: "#6250d6",

  // 1. What it gives the main screen
  async chip(ctx) {
    const items = await listItems(ctx);
    const open = items.filter((item) => !item.done);
    const soon = shiftDay(dayKey(ctx.now()), 1);
    const due = open.filter((item) => item.due_on !== null && item.due_on <= soon);
    if (open.length === 0) return { text: "açık kayıt yok", health: "ok" };
    if (due.length > 0) return { text: `${due.length} kayıt yarına kadar`, health: "attention" };
    return { text: `${open.length} açık kayıt`, health: "ok" };
  },
  nowCard(task) {
    if (task.source_type !== SOURCE_TYPE || !task.source_id) return null;
    return {
      detail: "Deneme modülünün kaydı",
      links: [{ label: "Kaydı aç", href: `/m/deneme/kayit/${task.source_id}` }],
    };
  },
  async alerts(ctx) {
    const today = dayKey(ctx.now());
    const late = (await listItems(ctx)).filter(
      (item) => !item.done && item.due_on !== null && item.due_on < today,
    );
    if (late.length === 0) return [];
    // One alert, one action; no count and no pile of overdue items (product rule 2).
    // The core shows module alerts from Ç3 on (AlertBar); until then this is only declared.
    return [
      {
        key: "tarihi-gecen",
        text: "Tarihi geçen kayıtlara yeni bir tarih verilebilir.",
        action: { label: "Kayıtlara bak", href: "/m/deneme" },
      },
    ];
  },

  // 2. Which entries it accepts
  intake: [
    {
      key: "kayit",
      label: "Kayıt",
      fields: [
        { name: "title", label: "Ad", type: "text", required: true },
        {
          name: "kind",
          label: "Tür",
          type: "select",
          required: true,
          default: "hedef",
          options: [
            { value: "hedef", label: "Hedef" },
            { value: "aliskanlik", label: "Alışkanlık" },
            { value: "etkinlik", label: "Etkinlik" },
            { value: "antrenman", label: "Antrenman" },
            { value: "odak", label: "Odak" },
          ],
        },
        { name: "due_on", label: "Tarih", type: "date" },
        { name: "minutes", label: "Süre (dk)", type: "number", min: 5 },
      ],
      examples: ["deneme kaydı: rapor taslağı cuma", "haftada üç kez esneme"],
      async handle(values, ctx) {
        const kind = KINDS.includes(values.kind as DenemeKind)
          ? (values.kind as DenemeKind)
          : "hedef";
        await addItem(ctx, {
          title: String(values.title ?? ""),
          kind,
          due_on: typeof values.due_on === "string" && values.due_on ? values.due_on : null,
          // Shorter than the shortest sitting is not a length the core takes: left open instead.
          minutes:
            typeof values.minutes === "number" && values.minutes >= 5 ? values.minutes : null,
        });
      },
    },
  ],
  // A pasted block of the form { "deneme": { "title": "...", "minutes": 40 } }
  blocks: [
    {
      key: "kayit",
      match: (payload) =>
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { deneme?: { title?: unknown } }).deneme?.title === "string",
      async handle(payload, ctx) {
        const block = (payload as { deneme: { title: string; minutes?: number; due_on?: string } })
          .deneme;
        await addItem(ctx, {
          title: block.title,
          minutes: typeof block.minutes === "number" && block.minutes >= 5 ? block.minutes : null,
          due_on: typeof block.due_on === "string" ? block.due_on : null,
        });
      },
    },
  ],

  // 3. Events
  emits: [EVENTS.itemAdded, EVENTS.itemRemoved],
  on: listeners,

  // 4. Reaction to the life mode
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: {
      weightMultiplier: 0.5,
      floorMultiplier: 0.5,
      note: "Yalnızca tarihli kayıtlar öne çıkar.",
    },
    minimum: { weightMultiplier: 0.2, floorMultiplier: 0, note: "Alışkanlıklar durur." },
    holiday: { weightMultiplier: 0, floorMultiplier: 0, note: "Hiçbir şey önerilmez." },
  },

  // 5. Weekly report
  async weeklyReport(ctx, week) {
    const items = await listItems(ctx);
    const finished = items.filter(
      (item) =>
        item.done &&
        dayKey(new Date(item.updated_at)) >= week.from &&
        dayKey(new Date(item.updated_at)) <= week.to,
    );
    const open = items.filter((item) => !item.done);
    return {
      metrics: [
        { label: "Açık kayıt", value: String(open.length) },
        { label: "Bu hafta biten", value: String(finished.length) },
        { label: "Eklenen (toplam)", value: String(settingsOf(ctx).added_count ?? 0) },
      ],
      suggestions:
        open.length > 5 ? ["Açık kayıt çok; birkaçını bırakmak haftayı hafifletir."] : [],
    };
  },

  // 6. Life cycle
  async onActivate(ctx) {
    // Proposing again on activation brings back the work of records that are still open:
    // archiving left the module's mark on what it dropped, and a new proposal undoes that.
    for (const item of await listItems(ctx)) {
      if (!item.done) await ctx.propose(proposalFor(item, settingsOf(ctx), ctx.now()));
    }
  },

  async onArchive(ctx) {
    // The last word before the module goes quiet: it notes when it was put away.
    await ctx.saveSettings({ ...settingsOf(ctx), archived_on: dayKey(ctx.now()) });
  },

  // Work envelope
  sizingHints:
    "Deneme kayıtları küçük işlerdir: bir hedef genellikle 30 dakika ile 4 saat arasında sürer.",
  onOutcome,

  // Pasted text → suggested records (AI `extract`); the page /m/deneme/metin uses it.
  extractors: [kayitReader],

  tables: ["deneme_items"],

  // Interface
  ui: {
    tabs: [
      { key: "kayitlar", label: "Kayıtlar", component: ItemsTab },
      { key: "bilesenler", label: "Bileşenler", component: KitTab },
    ],
    routes: [
      { path: "kayit/:id", title: "Kayıt", component: ItemPage },
      { path: "metin", title: "Metinden çıkar", component: ExtractPage },
    ],
    fullscreen: [{ key: "odak", label: "Odak", component: FocusView }],
    actions: [
      { key: "yeni", label: "Kayıt ekle", run: (ctx) => ctx.openIntake("kayit") },
      { key: "metin", label: "Metinden çıkar", run: (ctx) => ctx.navigate("metin") },
      {
        key: "ornek",
        label: "Örnek kayıt",
        run: async (ctx) => {
          await addItem(ctx, { title: "Örnek hedef", due_on: shiftDay(dayKey(ctx.now()), 3) });
        },
      },
    ],
    settings: SettingsForm,
    history: HistoryView,
    // While a focused sitting ("odak") or a workout runs, the Today screen is the module's (Ç3c).
    scene: denemeScene,
  },
};
