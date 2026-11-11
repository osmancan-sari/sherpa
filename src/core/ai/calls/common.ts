import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

export const ENERGY = Constants.public.Enums.energy_kind;
export const CONTEXT = Constants.public.Enums.context_kind;

/**
 * A value the AI judged: the value (null when it cannot tell), how sure it is (0 to 1), and one
 * short reason the user sees next to the value. Stored as is under `ai.fields` (docs/10).
 */
export function judged<T extends z.ZodType>(value: T) {
  return z.object({
    value: value.nullable(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(300),
  });
}

export type Judged<T> = { value: T | null; confidence: number; reason: string };

export const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-MM-dd");

/** Rules every prompt shares. */
export const SHARED_RULES = `
- The user lives in Istanbul and writes in Turkish. Every text you write for the user (titles,
  reasons, step names) is short, plain Turkish: no exclamation marks, no emoji, no praise.
- Dates are calendar days in Istanbul time, written yyyy-MM-dd. "today" and "weekday" in the
  input tell you where you are; Turkish day names ("cuma", "yarın", "haftaya") are relative to it.
- When you cannot tell a value, give null with a low confidence instead of guessing.
- A reason is one short clause that names the evidence ("benzer 3 iş ortalama 50 dk sürdü").
- Answer only with the JSON the output format asks for.`.trim();
