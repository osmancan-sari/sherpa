import type { ModuleJob } from "@/core/contract/types";
import { dayKey } from "@/lib/date";
import { listItems } from "./queries";
import { settingsOf } from "./rules";

// Scheduled work (Ç3d; docs/06-modul-sozlesmesi.md, "Sunucu zemini"): every morning the module
// writes the day's digest into its settings, whether or not anyone opens the app. Idempotent:
// the digest is keyed by its day, so a second run of the same day writes the same thing.

export const jobs: ModuleJob[] = [
  {
    key: "ozet",
    every: "day",
    at: "05:00",
    async run(ctx) {
      const open = (await listItems(ctx)).filter((item) => !item.done).length;
      await ctx.saveSettings({
        ...settingsOf(ctx),
        daily_digest: { date: dayKey(ctx.now()), open },
      });
    },
  },
];
