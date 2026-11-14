import { describe, expect, it } from "vitest";
import type { PlanRows } from "@/core/planner";
import { dayRow, rhythm, session, task } from "@/core/testing/factories";
import { bedAsks, sceneBedtime } from "./bedtime";

// Rutin 1: the night screen is the scene whose "Yatıyorum" wrote tonight's bedtime, for the 10
// minutes it can be taken back (docs/06-modul-sozlesmesi.md, "Diziler" rule 6).

const BED = new Date("2026-11-13T22:30:00+03:00");
const evening = rhythm({ title: "Akşam kapanışı" });
const closed = session({
  rhythm_id: evening.id,
  started_at: "2026-11-13T19:20:00Z",
  ended_at: BED.toISOString(),
});

function rowsWith(extra: Partial<PlanRows> = {}): PlanRows {
  return {
    settings: null,
    modules: [],
    tasks: [],
    workItems: [],
    rhythms: [evening],
    rhythmLogs: [],
    blocks: [],
    sessions: [closed],
    openSession: null,
    prompts: [],
    inbox: [],
    days: [dayRow({ date: "2026-11-13", bed_at: BED.toISOString(), bed_session_id: closed.id })],
    weekPlans: [],
    lifeModes: [],
    stats: [],
    ...extra,
  };
}

const minutes = (n: number) => new Date(BED.getTime() + n * 60_000);

describe("the scene after its bedtime", () => {
  it("is the closed session with its rhythm, until ten minutes after the bedtime", () => {
    const found = sceneBedtime("2026-11-13", rowsWith(), minutes(3));
    expect(found?.state).toMatchObject({ kind: "running", session: closed, rhythm: evening });
    expect(found?.at).toEqual(BED);
    expect(found?.until).toEqual(minutes(10));
    expect(sceneBedtime("2026-11-13", rowsWith(), minutes(10))).toBeNull();
  });

  it("is a task's when the work was a task", () => {
    const work = task({ title: "Akşam" });
    const ended = session({ task_id: work.id, ended_at: BED.toISOString() });
    const rows = rowsWith({
      tasks: [work],
      sessions: [ended],
      days: [dayRow({ date: "2026-11-13", bed_at: BED.toISOString(), bed_session_id: ended.id })],
    });
    expect(sceneBedtime("2026-11-13", rows, minutes(1))?.state).toMatchObject({
      task: work,
      rhythm: null,
    });
  });

  it("is none for a bedtime written another way, another day, or a session still open", () => {
    const plain = rowsWith({
      days: [dayRow({ date: "2026-11-13", bed_at: BED.toISOString(), bed_session_id: null })],
    });
    expect(sceneBedtime("2026-11-13", plain, minutes(1))).toBeNull();
    expect(sceneBedtime("2026-11-14", rowsWith(), minutes(1))).toBeNull();
    const running = rowsWith({ sessions: [{ ...closed, ended_at: null }] });
    expect(sceneBedtime("2026-11-13", running, minutes(1))).toBeNull();
    expect(sceneBedtime("2026-11-13", undefined, minutes(1))).toBeNull();
  });
});

describe("Yatıyorum far before bedtime asks first (Ç3g)", () => {
  const at = (time: string, day = "2026-11-14") => new Date(`${day}T${time}:00+03:00`);
  const framed = { frame: { bedStart: at("22:00") } as never, finishLine: at("19:00") };

  it("asks more than two hours before the bedtime range; one tap in it and near it", () => {
    expect(bedAsks(framed, at("16:49"))).toEqual({ start: at("22:00"), framed: true });
    expect(bedAsks(framed, at("19:59"))).not.toBeNull();
    expect(bedAsks(framed, at("20:00"))).toBeNull();
    expect(bedAsks(framed, at("22:30"))).toBeNull();
    expect(bedAsks(framed, at("00:40", "2026-11-15"))).toBeNull();
  });

  it("without the frame the finish line stands for the range", () => {
    const off = { frame: undefined, finishLine: at("19:00") };
    expect(bedAsks(off, at("16:49"))).toEqual({ start: at("19:00"), framed: false });
    expect(bedAsks(off, at("17:30"))).toBeNull();
  });
});
