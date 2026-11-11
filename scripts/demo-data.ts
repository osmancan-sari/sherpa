import { fakeProvider } from "@/core/ai/fake";
import { enrichEntry } from "@/core/ai/flows/enrich";
import { sizeWorkItem } from "@/core/ai/flows/size";
import { createRegistry } from "@/core/contract/registry";
import type { WorkProposal } from "@/core/contract/types";
import { createBlock, createSeries } from "@/core/data/blocks";
import { addInboxEntry } from "@/core/data/inbox";
import { propose } from "@/core/data/propose";
import { keepWeek } from "@/core/data/keep";
import { createTask } from "@/core/data/work";
import { check, type Db, type ModuleRow, unwrap } from "@/core/types";
import { dayKey, END_OF_DAY, istanbulInstant, shiftDay, weekdayOf, weekStart } from "@/lib/date";

// Sample data for trying the core without real modules (docs/07-yol-haritasi.md, Ç1): a few
// made-up modules with realistic work items, rhythms, blocks and some history. The module rows
// have no code behind them; their work arrives the way a real module's would, as envelopes
// through `propose`, and the rest the way the user would add it by hand.
//
// The AI's part (Ç2) is played by the recorded fake provider through the real flows: a quick-add
// line it read and turned into a task, a line it was not sure about (a card in the inbox), and a
// work item whose effort it estimated. The calls show in Settings → Yapay zeka.
//
// Everything is dated relative to `now`, so the Today screen has something to show whenever
// the seed runs. Meant for an account without data; it is never run against production
// (scripts/seed-demo.ts refuses anything but the local stack).

export type DemoSummary = Record<
  | "modules"
  | "work_items"
  | "rhythms"
  | "series"
  | "blocks"
  | "tasks"
  | "sessions"
  | "inbox"
  | "ai_calls",
  number
>;

const SOURCE_IDS = {
  midterm: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0001",
  homework: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0002",
  proposal: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0003",
  report: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0004",
  sweeping: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0005",
  laundry: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0006",
  routine: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0007",
  walk: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0008",
  prep: "5d0c1f6e-0f3b-4f0a-9a57-1f1f4a6b0009",
};

export async function seedDemo(db: Db, now: Date): Promise<DemoSummary> {
  const today = dayKey(now);
  const day = (offset: number) => shiftDay(today, offset);
  const at = (offset: number, time: string) => istanbulInstant(day(offset), time).toISOString();
  const endOf = (offset: number) => at(offset, END_OF_DAY);

  // --- Modules: rows only, the way a module whose code is not installed looks ---------------
  const area = unwrap(
    await db.from("areas").insert({ slug: "yasam", name: "Yaşam", sort: 1 }).select().single(),
  );
  const moduleRows = unwrap(
    await db
      .from("modules")
      .insert(
        [
          {
            slug: "okul-ornek",
            name: "Okul",
            kind: "term",
            color: "#2563eb",
            sort: 1,
            weight: 1.5,
            starts_on: day(-45),
            ends_on: day(75),
          },
          {
            slug: "ev-ornek",
            name: "Ev",
            kind: "lifelong",
            color: "#16a34a",
            sort: 2,
            area_id: area.id,
            weekly_floor_minutes: 60,
            mode_behavior: {
              normal: { weightMultiplier: 1, floorMultiplier: 1 },
              busy: { weightMultiplier: 0.5, floorMultiplier: 0.5 },
              minimum: { weightMultiplier: 0.3, floorMultiplier: 0.5 },
              holiday: { weightMultiplier: 0, floorMultiplier: 0 },
            },
          },
          {
            slug: "saglik-ornek",
            name: "Sağlık",
            kind: "lifelong",
            color: "#d97706",
            sort: 3,
            area_id: area.id,
            weekly_floor_minutes: 90,
            mode_behavior: {
              normal: { weightMultiplier: 1, floorMultiplier: 1 },
              busy: { weightMultiplier: 0.3, floorMultiplier: 0.5 },
              minimum: { weightMultiplier: 0.3, floorMultiplier: 0.5 },
              holiday: { weightMultiplier: 0.5, floorMultiplier: 0 },
            },
          },
          { slug: "is-ornek", name: "İş", kind: "lifelong", color: "#7c3aed", sort: 4 },
        ],
        // Rows with different columns: the ones left out take the column default, not null.
        { defaultToNull: false },
      )
      .select(),
  );
  const mod = (slug: string): ModuleRow => moduleRows.find((row) => row.slug === slug)!;
  const okul = mod("okul-ornek");
  const ev = mod("ev-ornek");
  const saglik = mod("saglik-ornek");
  const is = mod("is-ornek");

  // --- Envelopes: what the modules would propose --------------------------------------------
  const proposals: [ModuleRow, WorkProposal][] = [
    [
      okul,
      {
        schema: 1,
        key: "assessment:bbf301e-midterm:prep",
        source: { type: "okul.assessment", id: SOURCE_IDS.midterm },
        title: "BBF301E Midterm hazırlığı",
        when: { due: at(6, "10:00"), hard: true },
        // No length known: the core writes the middle of the bounds, as it does without the AI.
        effort: { bounds: { min: 120, max: 600 } },
        fit: { energy: "deep", context: "desk" },
        importance: 4,
        flex: { splittable: true, droppable: false },
        meta: { course_code: "BBF301E", weight: 30, scope: "Hafta 1–6" },
      },
    ],
    [
      okul,
      {
        schema: 1,
        key: "assessment:yzv406e-hw2",
        source: { type: "okul.assessment", id: SOURCE_IDS.homework },
        title: "YZV406E HW2: lokalizasyon soruları",
        when: { due: endOf(2), hard: true },
        effort: { total_minutes: 180, session_minutes: 45 },
        fit: { energy: "deep", context: "desk" },
        importance: 3,
        meta: { course_code: "YZV406E", weight: 10 },
      },
    ],
    [
      okul,
      {
        schema: 1,
        key: "project:dl:proposal-fixes",
        source: { type: "okul.assessment", id: SOURCE_IDS.proposal },
        title: "DL proposal düzeltmeleri",
        when: { due: endOf(9) },
        effort: { total_minutes: 120, session_minutes: 40 },
        fit: { energy: "deep", context: "desk" },
        importance: 2,
      },
    ],
    [
      okul,
      {
        // Waits for the fixes above: a dependency keeps it out of the list until they are done.
        schema: 1,
        key: "project:dl:report",
        source: { type: "okul.assessment", id: SOURCE_IDS.report },
        title: "DL ara raporu",
        when: { due: endOf(20), earliest: at(8, "09:00") },
        effort: { bounds: { min: 180, max: 480 } },
        fit: { energy: "deep", context: "desk" },
        importance: 3,
        depends_on: ["project:dl:proposal-fixes"],
      },
    ],
    [
      okul,
      {
        schema: 1,
        key: "assessment:bbf301e-midterm:exam",
        source: { type: "okul.assessment", id: SOURCE_IDS.midterm },
        title: "BBF301E Midterm",
        when: { fixed: { starts_at: at(6, "10:00"), ends_at: at(6, "12:00"), location: "D-201" } },
      },
    ],
    [
      ev,
      {
        schema: 1,
        key: "rhythm:supurme",
        source: { type: "ev.rhythm", id: SOURCE_IDS.sweeping },
        title: "Süpürme",
        when: { recurrence: { count: 2, period: "week", floor: 1 } },
        effort: { session_minutes: 15 },
        fit: { energy: "physical", context: "home" },
      },
    ],
    [
      ev,
      {
        schema: 1,
        key: "rhythm:camasir",
        source: { type: "ev.rhythm", id: SOURCE_IDS.laundry },
        title: "Çamaşır zamanı",
        when: { recurrence: { count: 1, period: "week" } },
        effort: { session_minutes: 30 },
        fit: { energy: "light", context: "home" },
      },
    ],
    [
      saglik,
      {
        schema: 1,
        key: "rhythm:sabah-rutini",
        source: { type: "saglik.rhythm", id: SOURCE_IDS.routine },
        title: "Sabah rutini",
        when: { recurrence: { count: 1, period: "day", floor: 1 } },
        effort: { session_minutes: 20 },
        fit: { energy: "physical", context: "home" },
      },
    ],
    [
      saglik,
      {
        schema: 1,
        key: "rhythm:yuruyus",
        source: { type: "saglik.rhythm", id: SOURCE_IDS.walk },
        title: "Yürüyüş",
        when: { recurrence: { count: 3, period: "week", floor: 1 } },
        effort: { session_minutes: 30 },
        fit: { energy: "physical", context: "out" },
      },
    ],
    [
      saglik,
      {
        schema: 1,
        key: "prep:haftalik",
        source: { type: "saglik.prep", id: SOURCE_IDS.prep },
        title: "Haftalık yemek hazırlığı",
        when: { due: endOf(4) },
        effort: { total_minutes: 120, session_minutes: 60 },
        fit: { energy: "light", context: "home" },
        importance: 2,
      },
    ],
  ];
  for (const [row, proposal] of proposals) await propose(db, row, proposal);

  // --- Fixed blocks: weekly series and one-off blocks ---------------------------------------
  // Series start at the beginning of this week, so today's blocks exist too.
  const valid_from = weekStart(today);
  const series = [
    {
      module_id: okul.id,
      title: "BBF301E",
      kind: "class" as const,
      weekday: 1,
      start_time: "09:30",
      end_time: "12:30",
      location: "Kampüs D-201",
      day_type: "campus" as const,
    },
    {
      module_id: okul.id,
      title: "YZV406E",
      kind: "class" as const,
      weekday: 3,
      start_time: "13:30",
      end_time: "16:30",
      location: "Kampüs B-104",
      day_type: "campus" as const,
    },
    ...[2, 4].map((weekday) => ({
      module_id: is.id,
      title: "Ofis",
      kind: "work" as const,
      weekday,
      start_time: "09:00",
      end_time: "17:30",
      location: "Ofis",
      day_type: "office" as const,
    })),
    {
      module_id: null,
      title: "Korunan zaman",
      kind: "protected" as const,
      weekday: 6,
      start_time: "19:00",
      end_time: "22:00",
    },
  ];
  for (const item of series) await createSeries(db, { ...item, valid_from }, now);

  await createBlock(db, {
    module_id: saglik.id,
    title: "Diş hekimi",
    kind: "appointment",
    starts_at: at(3, "15:00"),
    ends_at: at(3, "16:00"),
    location: "Klinik",
  });

  // --- Tasks the user added by hand ---------------------------------------------------------
  const tasks = [
    { module_id: is.id, title: "Haftalık rapor", est_minutes: 45, due_at: endOf(3) },
    {
      module_id: is.id,
      title: "Sunum slaytları",
      est_minutes: 60,
      due_at: endOf(5),
      importance: 3,
      energy: "deep" as const,
    },
    { module_id: ev.id, title: "Ampul al", est_minutes: 15, context: "out" as const },
    { module_id: saglik.id, title: "Alışveriş listesi", est_minutes: 15, due_at: endOf(1) },
    { module_id: okul.id, title: "Danışmana e-posta", est_minutes: 10, kind: "admin" as const },
    {
      module_id: okul.id,
      title: "Staj belgesi",
      est_minutes: 20,
      status: "waiting" as const,
      waiting_on: "Bölüm sekreterliği",
      follow_up_on: day(4),
    },
  ];
  for (const { status, waiting_on, follow_up_on, ...task } of tasks) {
    const created = await createTask(db, task);
    if (status) {
      check(
        await db.from("tasks").update({ status, waiting_on, follow_up_on }).eq("id", created.id),
      );
    }
  }

  // --- History: finished sessions and rhythm logs of the last weeks -------------------------
  const rhythms = unwrap(await db.from("rhythms").select("id, key, module_id"));
  const rhythm = (key: string) => rhythms.find((row) => row.key === key)!;
  const sessions: {
    module_id: string;
    title: string;
    rhythm_id?: string;
    started_at: string;
    ended_at: string;
  }[] = [];
  const logs: { rhythm_id: string; done_on: string }[] = [];
  const span = (offset: number, time: string, minutes: number) => {
    const start = istanbulInstant(day(offset), time);
    return {
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    };
  };
  for (let week = 1; week <= 5; week++) {
    const back = -7 * week;
    sessions.push(
      { module_id: okul.id, title: "Ders çalışma", ...span(back, "19:00", 40 + week * 10) },
      { module_id: okul.id, title: "Ödev", ...span(back + 2, "20:00", 45) },
      { module_id: is.id, title: "Rapor", ...span(back + 1, "18:00", 30 + (week % 2) * 15) },
      {
        module_id: ev.id,
        title: "Süpürme",
        rhythm_id: rhythm("rhythm:supurme").id,
        ...span(back + 3, "18:30", 15),
      },
      {
        module_id: saglik.id,
        title: "Yürüyüş",
        rhythm_id: rhythm("rhythm:yuruyus").id,
        ...span(back + 4, "08:00", 30),
      },
    );
  }
  // Yesterday evening's reading: the account is in use, not back after days away (Ç3).
  sessions.push({ module_id: okul.id, title: "Okuma", ...span(-1, "20:00", 35) });
  // This period: one sweep and one walk are already done; the morning routine is still open today.
  const monday = weekStart(today);
  logs.push(
    { rhythm_id: rhythm("rhythm:supurme").id, done_on: monday },
    { rhythm_id: rhythm("rhythm:yuruyus").id, done_on: monday },
  );
  check(await db.from("sessions").insert(sessions, { defaultToNull: false }));
  check(await db.from("rhythm_logs").insert(logs));

  // --- Inbox: free text waiting to be routed ------------------------------------------------
  const inbox = ["kırtasiyeden A4 defter", "Elif'in doğum günü hediyesi 22.11"];
  for (const text of inbox) await addInboxEntry(db, text);

  // --- The AI, played by the fake provider ------------------------------------------------------
  const ai = {
    db,
    config: {
      provider: fakeProvider(),
      models: { fast: "fake-fast", plan: "fake-plan" },
      timeouts: { fast: 5_000, plan: 5_000 },
    },
  };
  const noCode = createRegistry([]);
  // Names its module: read and turned into a task, the AI's values marked.
  const sure = await addInboxEntry(db, "Okul sunum slaytları cuma");
  await enrichEntry(ai, noCode, sure.id, now);
  // Names none: left as a card to confirm.
  const unsure = await addInboxEntry(db, "perde ölçüsünü al");
  await enrichEntry(ai, noCode, unsure.id, now);
  // The report's effort was left to the AI: estimated inside the module's bounds, with a reason.
  const report = unwrap(
    await db.from("work_items").select("id").eq("key", "project:dl:report").single(),
  );
  await sizeWorkItem(ai, noCode, { id: report.id }, now);

  const count = async (table: "work_items" | "rhythms" | "block_series" | "blocks" | "tasks") => {
    const { count: total, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return total ?? 0;
  };
  // The planner (Ç3): a busy week ahead, and this week committed the way the screen does it
  // on its first opening (the work items' share of the week cut into sittings).
  check(
    await db.from("life_mode_periods").insert({
      mode: "busy",
      starts_on: day(7 - weekdayOf(today) + 1),
      ends_on: day(7 - weekdayOf(today) + 7),
      note: "Vize haftası",
    }),
  );
  await keepWeek(db, now);

  return {
    modules: moduleRows.length,
    work_items: await count("work_items"),
    rhythms: await count("rhythms"),
    series: await count("block_series"),
    blocks: await count("blocks"),
    tasks: await count("tasks"),
    sessions: sessions.length,
    // The plain entries and the card the AI left; the line it understood became a task.
    inbox: inbox.length + 1,
    ai_calls: unwrap(await db.from("ai_calls").select("id")).length,
  };
}
