import type { Session } from "@/core/types";

// A session running past its time (docs/04-planlayici.md, "Oturum kuralları"): past twice its
// estimate the screen asks "Devam ediyor musun?"; with no answer it is closed as if it had
// taken its estimate, unmeasured. "Devam" pushes the next question one estimate further.

export const OVERRUN_FACTOR = 2;
/** How long the question waits for an answer before the session is closed. */
export const ANSWER_MINUTES = 30;

export type Overrun = "none" | "ask" | "close";

export function overrun(
  session: Pick<Session, "started_at" | "confirmed_at" | "ended_at">,
  estimate: number | null,
  now: Date,
): Overrun {
  if (session.ended_at !== null || !estimate || estimate <= 0) return "none";
  const started = Date.parse(session.started_at);
  const elapsed = (now.getTime() - started) / 60_000;
  let askAt = estimate * OVERRUN_FACTOR;
  if (session.confirmed_at) {
    const confirmed = (Date.parse(session.confirmed_at) - started) / 60_000;
    askAt = Math.max(askAt, confirmed + estimate);
  }
  if (elapsed <= askAt) return "none";
  return elapsed > askAt + ANSWER_MINUTES ? "close" : "ask";
}
