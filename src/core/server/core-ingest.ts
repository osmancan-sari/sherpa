import "server-only";
import { z } from "zod";
import { CORE_INGEST } from "@/core/contract/ingest";
import { recordBed, recordWake } from "@/core/data/frame";
import { getSettings } from "@/core/data/inbox";
import { tellDayClosed, tellDayStarted } from "@/core/data/session-events";
import { CORE_EVENTS, emitEvent } from "@/core/events/bus";
import { dayStartClock, plannerSettings, planningDay } from "@/core/planner";
import { type ServerDeps, serverTold } from "./context";
import { keepWeekOnServer } from "./plan";

// The core's own kinds at the ingest endpoint (docs/02-mimari.md, "Cihaz anahtarları ve giriş
// ucu"): the waking and the bedtime from the phone's alarm or sleep automation, and a context
// from a location automation. They write what "Uyandım" and "Yatıyorum" write and tell the
// modules the same way, here on the server.

/** A value the schema could not judge (it depends on the moment): refused like a bad body. */
export class IngestRejection extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

/** A moment: now if left out; with its offset; at most a day back and five minutes ahead. */
const moment = z.object({ at: z.iso.datetime({ offset: true }).optional() }).strict();

function momentOf(at: string | undefined, now: Date): Date {
  if (!at) return now;
  const instant = new Date(at);
  if (instant.getTime() > now.getTime() + 5 * 60_000) {
    throw new IngestRejection("at", "is in the future");
  }
  if (instant.getTime() < now.getTime() - 24 * 60 * 60_000) {
    throw new IngestRejection("at", "is more than a day ago");
  }
  return instant;
}

/** The day a moment belongs to, as the Today screen sees it then (a bedtime at 01:00: the night before). */
async function dayOf(deps: ServerDeps, instant: Date): Promise<string> {
  const settings = plannerSettings(await getSettings(deps.db));
  return planningDay(instant, dayStartClock(settings));
}

const DEVICE_CONTEXTS = ["desk", "home", "campus", "office", "out", "commute"] as const;

export type CoreIngest = {
  kind: (typeof CORE_INGEST)[number]["kind"];
  schema: z.ZodType;
  handle: (payload: unknown, deps: ServerDeps) => Promise<void>;
};

export const CORE_INGEST_HANDLERS: CoreIngest[] = [
  {
    kind: "wake",
    schema: moment,
    async handle(payload, deps) {
      const { at } = payload as z.infer<typeof moment>;
      const instant = momentOf(at, deps.now());
      const date = await dayOf(deps, instant);
      const row = await recordWake(deps.db, date, instant);
      // A recorded waking is use as well: the app does not open on "Kaldığın yerden devam" for
      // a day it was told about (src/core/planner/input.ts, lastActivityBefore).
      await tellDayStarted(serverTold(deps), {
        date,
        wokeAt: row.woke_at ?? instant.toISOString(),
        estimated: false,
      });
    },
  },
  {
    kind: "bed",
    schema: moment,
    async handle(payload, deps) {
      const { at } = payload as z.infer<typeof moment>;
      const instant = momentOf(at, deps.now());
      const date = await dayOf(deps, instant);
      const row = await recordBed(deps.db, date, instant);
      await tellDayClosed(serverTold(deps), { date, bedAt: row.bed_at ?? instant.toISOString() });
      // Tomorrow now starts at its expected waking after this bedtime; when that costs it more
      // than 30 minutes the week is re-committed, as the screens would on their next look.
      try {
        await keepWeekOnServer(deps);
      } catch (error) {
        // The bedtime stands; the screens keep the week when they next open.
        console.error("week after bedtime failed", error instanceof Error ? error.message : "");
      }
    },
  },
  {
    kind: "context",
    schema: z
      .object({
        context: z.enum(DEVICE_CONTEXTS),
        at: z.iso.datetime({ offset: true }).optional(),
      })
      .strict(),
    async handle(payload, deps) {
      const { context, at } = payload as { context: string; at?: string };
      const instant = momentOf(at, deps.now());
      // Only told for now: the screens do not pick their context from it yet (docs/09, Fikirler).
      const told = serverTold(deps);
      await emitEvent({
        db: told.db,
        registry: told.registry,
        type: CORE_EVENTS.contextReported,
        payload: { context, at: instant.toISOString() },
        moduleSlug: null,
        now: told.now,
        onProposed: told.onProposed,
      });
    },
  },
];
