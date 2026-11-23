import type { ModuleJob } from "@/core/contract/types";
import { askAttendance, syncAll } from "./rules";

// The module's scheduled work (docs/06-modul-sozlesmesi.md, "Sunucu zemini"). Both are idempotent.
//
// - "gunluk", every night after midnight: the whole term is proposed again. A preparation whose
//   documents are not marked moves its earliest start on to the next day (decision 2), so it stays
//   a load and never opens a sitting; lessons ahead are kept in the plan.
// - "devam", every hour: "Derse girdin mi?" on Today for a lesson that ended, in a course with an
//   attendance condition, when its view was not opened (rule 15).
export const jobs: ModuleJob[] = [
  { key: "gunluk", every: "day", at: "00:30", run: async (ctx) => void (await syncAll(ctx)) },
  { key: "devam", every: "hour", run: async (ctx) => void (await askAttendance(ctx)) },
];
