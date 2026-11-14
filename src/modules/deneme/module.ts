import type { ModuleDefinition, ModuleFacet } from "@/core/contract/types";
import { dayKey, shiftDay } from "@/lib/date";
import { ExtractPage } from "./components/ExtractPage";
import { ItemsTab } from "./components/ItemsTab";
import { KitTab } from "./components/KitTab";
import { denemeScene, nightScene, sunScene } from "./scene";
import { FocusView, HistoryView, ItemPage, SettingsForm } from "./components/Views";
import { kayitReader } from "./extract";
import { ingest } from "./ingest";
import { jobs } from "./jobs";
import { type DenemeKind, listItems, SOURCE_TYPE } from "./queries";
import { addItem, EVENTS, listeners, onOutcome, proposalFor, proposes, settingsOf } from "./rules";

// "Deneme": the small module the core is tried against until real modules arrive. It uses
// every connection point of the contract (docs/06-modul-sozlesmesi.md) once, with the simplest
// thing that makes the point. It is switched on only where NEXT_PUBLIC_SHERPA_DEMO_MODULE=1
// (src/modules/registry.ts); it never runs against production data.

const KINDS: DenemeKind[] = [
  "hedef",
  "aliskanlik",
  "etkinlik",
  "antrenman",
  "odak",
  "konu",
  "rutin",
];

/**
 * Ç3e: the module's facets. Two fixed ones, each with a scene and a tone of its own, as a
 * routine module's morning and evening would have; and one per open topic ("konu"), from the
 * module's data, as a school module's courses would be. Topics share the module's default scene.
 */
export const FIXED_FACETS: ModuleFacet[] = [
  { key: "sabah", name: "Sabah", color: "#d97706", scene: "gunes", tone: "energy" },
  { key: "aksam", name: "Akşam", color: "#4361d8", scene: "gece", tone: "calm" },
];
const TOPIC_COLORS = ["#0d9488", "#db2777", "#16a34a", "#0891b2", "#ea580c", "#c026d3"];

/** A topic's facet key: stable as long as the record lives. */
export const topicFacet = (id: string) => `konu-${id.slice(0, 8)}`;

export const deneme: ModuleDefinition = {
  slug: "deneme",
  name: "Deneme",
  kind: "lifelong",
  area: { slug: "sinama", name: "Sınama" },
  color: "#6250d6",

  async facets(ctx) {
    const topics = (await listItems(ctx)).filter((item) => item.kind === "konu" && !item.done);
    return [
      ...FIXED_FACETS,
      ...topics.map((item, index) => ({
        key: topicFacet(item.id),
        name: item.title,
        color: TOPIC_COLORS[index % TOPIC_COLORS.length],
      })),
    ];
  },

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
            { value: "konu", label: "Konu" },
            { value: "rutin", label: "Rutin (sabah ya da akşam dizisi)" },
          ],
        },
        {
          name: "facet",
          label: "Bölüm",
          type: "select",
          default: "",
          options: [
            { value: "", label: "Bölümsüz" },
            { value: "sabah", label: "Sabah" },
            { value: "aksam", label: "Akşam" },
          ],
        },
        { name: "due_on", label: "Tarih", type: "date" },
        { name: "minutes", label: "Süre (dk)", type: "number", min: 5 },
        { name: "chain_order", label: "Dizide sıra (1–99)", type: "number", min: 1, max: 99 },
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
          facet: values.facet === "sabah" || values.facet === "aksam" ? values.facet : null,
          // Ç3f: a routine's place in its chain; only a routine has one.
          chain_order:
            kind === "rutin" &&
            typeof values.chain_order === "number" &&
            Number.isInteger(values.chain_order) &&
            values.chain_order >= 1 &&
            values.chain_order <= 99
              ? values.chain_order
              : null,
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
      if (!item.done && proposes(item))
        await ctx.propose(proposalFor(item, settingsOf(ctx), ctx.now()));
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

  // While the app is closed (Ç3d): records from outside, and a morning digest.
  ingest,
  jobs,

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
    // Ç3e: the fixed facets' scenes: a sunny one for the morning, a night one for the evening.
    scenes: { gunes: sunScene, gece: nightScene },
  },
};
