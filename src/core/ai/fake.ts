import { parseQuickText } from "@/core/intake/parse";
import { dayKey, istanbulInstant, shiftDay } from "@/lib/date";
import type { DecomposeOutput } from "./calls/decompose";
import type { EnrichInput, EnrichOutput } from "./calls/enrich";
import type { ExtractInput, ExtractOutput } from "./calls/extract";
import type {
  MonthCallInput,
  MonthOutput,
  PlanCallInput,
  PlanOutput,
  ReviewCallInput,
  ReviewOutput,
  WeekCallInput,
  WeekOutput,
} from "./calls/planning";
import type { SizeInput, SizeOutput } from "./calls/size";
import { type AiKind, type AiProvider, ProviderError, type ProviderRequest } from "./types";

// A provider that never leaves the machine. It answers from recorded rules, so the app and the
// end-to-end tests can run every AI path without an API key (stop D3 in prompts/BASLA.md).
//
// Markers in the input make it misbehave on purpose:
//   [ai:invalid]  answers JSON that does not fit the schema
//   [ai:timeout]  never answers (until the gateway gives up)
//   [ai:error]    fails like an unreachable API
//   [ai:refusal]  refuses, after using some tokens

type Answer = (input: unknown, request: ProviderRequest) => unknown;

const none = { value: null, confidence: 0, reason: "" };

/** Words that make the fake read a line as work of several sittings. */
const LARGE = ["proje", "tez", "sınav", "sinav", "rapor", "[ai:item]"];

/**
 * Reads a line roughly the way a model would: the module named in it (or the only one there
 * is), the day and duration typed at its end, a larger size for project-like words.
 * `[ai:unsure]` makes it unsure, so the answer becomes a card to confirm; `[ai:nominutes]` gives
 * no duration (unless one is typed), so `size` is asked for it.
 */
function enrich(input: unknown): EnrichOutput {
  const given = input as Partial<EnrichInput> & { text: string };
  const text = given.text;
  const today = given.today ?? dayKey(new Date());
  const modules = given.modules ?? [];
  const lower = text.toLocaleLowerCase("tr");
  const now = istanbulInstant(today, "12:00");
  const parsed = parseQuickText(text.replace(/\[ai:[a-z]+\]/g, " "), now);

  // Whole words only: "ödev" does not name the module "Ev".
  const lineWords = new Set(lower.split(/[^\p{L}\p{N}-]+/u));
  const named = modules.find(
    (mod) => lineWords.has(mod.name.toLocaleLowerCase("tr")) || lineWords.has(mod.slug),
  );
  const chosen = named ?? (modules.length === 1 ? modules[0] : undefined);
  const unsure = lower.includes("[ai:unsure]");
  const large = LARGE.some((word) => lower.includes(word));
  const minutes = parsed.minutes ?? (large ? 240 : 45);
  const noMinutes = lower.includes("[ai:nominutes]") && parsed.minutes === null;
  const soon = parsed.dueDay !== null && parsed.dueDay <= shiftDay(today, 3);

  return {
    title: parsed.title.trim() || "İş",
    module: chosen
      ? {
          value: chosen.slug,
          confidence: unsure ? 0.3 : named ? 0.9 : 0.7,
          reason: named ? "modülün adı geçiyor" : "tek etkin modül",
        }
      : { value: null, confidence: 0.2, reason: "uygun modül bulunamadı" },
    target: {
      value: large ? "work_item" : "task",
      confidence: unsure ? 0.3 : 0.8,
      reason: large ? "birden çok oturum ister" : "tek oturumluk görünüyor",
    },
    est_minutes: noMinutes
      ? { value: null, confidence: 0.2, reason: "benzer iş verisi yok" }
      : { value: minutes, confidence: 0.6, reason: "benzer işlere göre" },
    energy: { value: large ? "deep" : "light", confidence: 0.6, reason: "işin türüne göre" },
    context: { value: "any", confidence: 0.5, reason: "yer belirtilmemiş" },
    importance: soon
      ? { value: 3, confidence: 0.7, reason: "son tarih yakın" }
      : { value: 2, confidence: 0.5, reason: "yakın son tarih yok" },
    due: parsed.dueDay
      ? { value: parsed.dueDay, confidence: 0.9, reason: "satırda gün yazıyor" }
      : none,
    timing: fakeTiming(lower),
    steps: large
      ? [
          { title: "Kapsamı çıkar", minutes: 45 },
          { title: "İlk taslak", minutes: 90 },
        ]
      : [],
  };
}

/**
 * Time constraints written out on the line, read the way the prompt asks (rule 12): "8'den
 * sonra" (an evening hour when "akşam" is there) is a window to midnight, "18-20 arası …
 * olmasın" an avoided range, "20 dk yol" travel each way. Nothing else is guessed.
 */
function fakeTiming(lower: string): EnrichOutput["timing"] {
  const pad = (hour: number, minute = 0) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const evening = (hour: number) => (lower.includes("akşam") && hour < 12 ? hour + 12 : hour);
  const after = /(\d{1,2})(?::(\d{2}))?['’]?(?:den|dan|ten|tan) sonra/u.exec(lower);
  const between = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s*aras[ıi]/u.exec(lower);
  const travel = /(\d{1,3})\s*dk\s*yol/u.exec(lower);
  const avoid = between && /olmas[ıi]n|kalabal[ıi]k|kaçın/u.test(lower);
  if (!after && !avoid && !travel)
    return { value: null, confidence: 0.8, reason: "saat kısıtı yazmıyor" };
  return {
    value: {
      windows: after
        ? [{ days: null, from: pad(evening(Number(after[1])), Number(after[2] ?? 0)), to: "24:00" }]
        : null,
      prefer: null,
      avoid:
        avoid && between
          ? [{ days: null, from: pad(Number(between[1])), to: pad(Number(between[2])) }]
          : null,
      travel: travel ? { before: Number(travel[1]), after: Number(travel[1]) } : null,
    },
    confidence: 0.8,
    reason: "satırda saat kısıtı yazıyor",
  };
}

function size(input: unknown): SizeOutput {
  const { need, bounds } = input as SizeInput;
  const wants = (field: SizeInput["need"][number]) => need.includes(field);
  // Inside the bounds but not their middle, so a test can tell the AI's value from the default.
  const effort = bounds ? Math.round((bounds.min + (bounds.max - bounds.min) * 0.6) / 5) * 5 : 120;
  return {
    effort_total_minutes: wants("effort_total_minutes")
      ? { value: effort, confidence: 0.7, reason: "benzer işlerin süresine göre" }
      : none,
    session_minutes: wants("session_minutes")
      ? { value: 45, confidence: 0.6, reason: "odak isteyen iş" }
      : none,
    importance: wants("importance")
      ? { value: 3, confidence: 0.6, reason: "son tarih yakın" }
      : none,
    energy: wants("energy") ? { value: "deep", confidence: 0.6, reason: "odak isteyen iş" } : none,
  };
}

function decompose(): DecomposeOutput {
  return {
    steps: [
      { ref: "a", title: "Kapsamı çıkar", effort_minutes: 45, depends_on: [], due: null },
      { ref: "b", title: "İlk taslak", effort_minutes: 120, depends_on: ["a"], due: null },
      {
        ref: "c",
        title: "Gözden geçir ve bitir",
        effort_minutes: 60,
        depends_on: ["b"],
        due: null,
      },
    ],
    reason: "Önce kapsam, sonra taslak, en son gözden geçirme.",
  };
}

/**
 * Every line of the text as one suggestion `{ title, due_on, minutes }` (the day and duration
 * typed at its end, as quick add reads them), kept only where the extractor's item takes that
 * shape. Enough for a module's reader to be tried end to end without a key.
 */
function extract(input: unknown, request: ProviderRequest): ExtractOutput<unknown> {
  const { text, today } = input as ExtractInput;
  const now = istanbulInstant(today, "12:00");
  const suggestions = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("[ai:"))
    .map((line) => {
      const parsed = parseQuickText(line, now);
      return { title: parsed.title, due_on: parsed.dueDay, minutes: parsed.minutes };
    })
    .filter((item) => request.schema.safeParse({ suggestions: [item], note: null }).success);
  return { suggestions, note: null };
}

// --- Planning (Ç3) -----------------------------------------------------------------------------

/**
 * The day: the three are the engine's candidates in its order, the first one with a reason;
 * a candidate whose title carries "[ai:defer]" is put off (the engine refuses it when it is
 * mandatory). Enough to see the advice and its reasons arrive end to end.
 */
function plan(input: unknown): PlanOutput {
  const { candidates } = input as PlanCallInput;
  const deferred = candidates.filter((row) => row.title.includes("[ai:defer]"));
  const chosen = candidates.filter((row) => !row.title.includes("[ai:defer]")).slice(0, 3);
  return {
    top3: chosen.map((row, index) => ({
      id: row.id,
      reason: index === 0 ? "Yapay zeka: günün en önemli işi bu." : "Yapay zeka: bugün sığıyor.",
    })),
    prefer: [],
    defer: deferred.map((row) => ({ id: row.id, reason: "Yapay zeka: yarına kalabilir." })),
    estimates: [],
    warnings: [],
  };
}

/** The week: the engine's own commitment, each with a reason. */
function week(input: unknown): WeekOutput {
  const { base } = input as WeekCallInput;
  return {
    committed: base.map((id) => ({ id, reason: "Yapay zeka: bu haftaya düşüyor." })),
    drop: [],
    module_budgets: [],
  };
}

/** The coming weeks: a busy week where demand is over capacity. */
function month(input: unknown): MonthOutput {
  const { weeks } = input as MonthCallInput;
  const tight = weeks.find((row) => row.demand > row.capacity);
  return {
    proposals: tight
      ? [
          {
            kind: "mode",
            item_id: null,
            week_start: tight.week_start,
            mode: "busy",
            text: `${tight.week_start} haftası sıkışık; o hafta Yoğun mod önerilir.`,
          },
        ]
      : [],
  };
}

/** The week behind: a plain summary of the modules' reports. */
function review(input: unknown): ReviewOutput {
  const { modules, worked } = input as ReviewCallInput;
  const minutes = worked.reduce((sum, row) => sum + row.minutes, 0);
  return {
    summary: `Bu hafta ${modules.length} modülde ${minutes} dakika çalışıldı.`,
    suggestions: ["Önümüzdeki hafta en yakın son tarihten başla."],
    mode: null,
  };
}

const ANSWERS: Record<AiKind, Answer> = {
  enrich,
  size,
  decompose,
  extract,
  plan,
  replan: plan,
  week,
  month,
  review,
};

/** Rough token count, so the fake's calls have a cost and the budget is exercised. */
const tokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

export function fakeProvider(answers: Partial<Record<AiKind, Answer>> = {}): AiProvider {
  return {
    name: "fake",
    async complete(request: ProviderRequest) {
      const usage = {
        model: request.model,
        inputTokens: tokens(request.system) + tokens(request.user),
        outputTokens: 50,
      };
      if (request.user.includes("[ai:timeout]")) {
        await new Promise<never>((_, reject) => {
          request.signal.addEventListener("abort", () =>
            reject(new ProviderError("timeout", "aborted")),
          );
        });
      }
      if (request.user.includes("[ai:error]")) {
        throw new ProviderError("provider_error", "fake: unreachable");
      }
      if (request.user.includes("[ai:refusal]")) {
        throw new ProviderError("refused", "fake: refusal", usage);
      }
      if (request.user.includes("[ai:invalid]")) {
        return { ...usage, text: JSON.stringify({ title: 42 }) };
      }
      const answer = answers[request.kind] ?? ANSWERS[request.kind];
      const text = JSON.stringify(answer(JSON.parse(request.user), request));
      return { ...usage, outputTokens: tokens(text), text };
    },
  };
}
