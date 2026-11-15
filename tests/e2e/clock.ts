// The end-to-end run's clock: every test sees one fixed moment, not the real time of day, so the
// suite passes whenever it runs (before Ç4a's follow-up it did not start between 20:30 and
// 24:00). Every page is held at this moment (fixtures.ts); the specs write their data around it
// (`runNow`, `runDay`).
//
// The app stamps sessions and finished work with the database's own clock (`now()`), and the
// database cannot be held. So the run's moment is never ahead of the real time: a session the
// database stamps then looks just started (or a moment in the future), never hours old.
//
// - Default: today at 10:00 (Istanbul), or the real time when it is earlier (a run after
//   midnight). The day has room either way: the test account's day runs from 00:00 to 22:00.
// - `SHERPA_E2E_AT=HH:MM`: that time today, or yesterday's when today's is still to come (to run
//   the suite at an evening hour any time of day). A test that needs room in the day, or needs the
//   database's stamps (sessions, finished work, an outside waking) to fall on its day, holds
//   today's 10:00 (or the real time when it is earlier) with `roomInTheDay`.

const ZONE = "Europe/Istanbul";
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const dayOf = (instant: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(instant);
const at = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`);

function pick(): Date {
  const real = new Date();
  // Whole minutes: the screens show minutes.
  real.setSeconds(0, 0);
  const asked = process.env.SHERPA_E2E_AT;
  if (asked !== undefined && asked !== "") {
    if (!CLOCK.test(asked)) throw new Error(`SHERPA_E2E_AT must be HH:MM, not "${asked}"`);
    const today = at(dayOf(real), asked);
    if (today <= real) return today;
    return at(dayOf(new Date(real.getTime() - 86_400_000)), asked);
  }
  return roomy(real);
}

/** Today's 10:00, or the real time when it is earlier: a moment with room, never ahead. */
function roomy(real: Date): Date {
  const morning = at(dayOf(real), "10:00");
  return morning <= real ? morning : real;
}

const RUN = pick();

/**
 * Where a test that needs room in the day, and the database's "today", holds its pages
 * (`roomInTheDay`): today's 10:00, or the real time when it is earlier.
 */
export function roomMoment(): Date {
  const real = new Date();
  real.setSeconds(0, 0);
  return roomy(real);
}
/** The test's own moment: the run's, or the hour a test holds (`holdRunClock`). */
let current = RUN;

/** Back to the run's moment (every test starts there; fixtures.ts). */
export function resetRunClock(): void {
  current = RUN;
}

/** A test holds its own moment (`roomInTheDay`); the data it writes follows. */
export function holdRunClock(at: Date): void {
  current = at;
}

/** The test's "now": the moment its pages are held at. */
export function runNow(): Date {
  return new Date(current.getTime());
}

/** "YYYY-MM-DD" in Istanbul, `days` from the test's day. */
export function runDay(days = 0): string {
  return dayOf(new Date(current.getTime() + days * 86_400_000));
}

/** An instant `minutes` from the test's moment, as the database takes it. */
export function runAt(minutes: number): string {
  return new Date(current.getTime() + minutes * 60_000).toISOString();
}
