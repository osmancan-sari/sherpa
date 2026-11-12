import "server-only";
import { weekFlow } from "@/core/ai/flows/planning";
import type { ServerDeps } from "./context";

/**
 * The week's commitment on the server: made when there is none, re-made when a trigger fired
 * (a bedtime that shortened tomorrow by more than 30 minutes, a new required item), otherwise
 * left alone. The same `keepWeek` the screens run; with the AI's advice when it answers, by the
 * engine alone when it does not. Idempotent.
 */
export async function keepWeekOnServer(deps: ServerDeps) {
  return weekFlow({ db: deps.db, config: deps.ai }, deps.now(), false);
}
