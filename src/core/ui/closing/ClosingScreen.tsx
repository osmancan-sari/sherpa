"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useAddInboxEntry,
  useAnswerPrompt,
  useCompleteTask,
  useLogRhythm,
} from "@/core/app/actions";
import { useColors } from "@/core/app/facets";
import { type KnownModule, useAiStatus, useModules, useTodayPlan } from "@/core/app/hooks";
import { useCloseDay } from "@/core/app/plan-actions";
import type { ClosingResult } from "@/core/contract/types";
import { useQuery } from "@tanstack/react-query";
import { postAi } from "@/core/ai/client";
import { buildPlan, type Candidate, type PlanAdvice, tomorrowInput } from "@/core/planner";
import { formatMinutes } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AiReason, Textarea } from "../kit/Field";
import { LoadFailed } from "../today/TodayScreen";

// The evening closing (docs/04-planlayici.md, "Akşam kapanışı"; look docs/tasarim/ekranlar/
// kapanis.md, KS*, KSP*): confirming tomorrow's plan. One step per screen, moved through with the
// keyboard (Enter goes on, Escape goes back). It may never be done at all: tomorrow plans itself
// (rule 3). Ç4c: it opens only inside a scene (the evening's, or the standard scene shell when no
// module holds it); there is no page of its own and no "Onayla ve yat" (the scene's last step
// records the bedtime).

const STEPS = ["Sorular", "Bugün", "Yarın", "Boşalt", "Onay"] as const;
/** At most this many open questions are asked at the closing. */
const MAX_QUESTIONS = 5;

/**
 * Ç3f: the closing inside a scene (`controls.closing()`; docs/06-modul-sozlesmesi.md, "Diziler"
 * rule 6): back to the scene when it is confirmed or given up, with how it ended (Ç4c).
 */
export function ClosingInScene({ onDone }: { onDone: (result: ClosingResult) => void }) {
  return <ClosingBody onDone={onDone} />;
}

function ClosingBody({ onDone }: { onDone: (result: ClosingResult) => void }) {
  const { modules } = useModules();
  const { input, rows, failed, retry, now, context } = useTodayPlan();
  const answer = useAnswerPrompt();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const addEntry = useAddInboxEntry();
  const close = useCloseDay();
  const [step, setStep] = useState(0);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dump, setDump] = useState("");
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);

  // With the AI on, tomorrow's draft comes from its `plan` call, with reasons (docs/04,
  // "Akşam kapanışı"); nothing is written until the user confirms. Without it, the engine's.
  const aiOn = useAiStatus().data?.state === "on";
  const tomorrowDate = rows ? tomorrowInput(rows, { now, context }).date : null;
  const preview = useQuery({
    queryKey: ["closing-preview", tomorrowDate],
    enabled: aiOn && tomorrowDate !== null,
    staleTime: Infinity,
    queryFn: () =>
      postAi<{ status: string; advice?: PlanAdvice }>("plan", {
        date: tomorrowDate,
        preview: true,
        context,
      }),
  });
  const advice = preview.data?.status === "applied" ? preview.data.advice : undefined;

  const tomorrow = useMemo(() => {
    if (!rows) return null;
    const base = { ...tomorrowInput(rows, { now, context }), advice };
    return { base, plan: buildPlan({ ...base, skipped: [...(base.skipped ?? []), ...removed] }) };
  }, [rows, now, context, removed, advice]);

  if (failed) return <LoadFailed onRetry={retry} />;
  if (!input || !rows || !tomorrow) {
    return <h2 className="tracking-title px-1 text-2xl font-bold md:px-0 md:text-3xl">Kapanış</h2>;
  }

  const questions = rows.prompts
    .filter(
      (prompt) => prompt.status === "pending" && Date.parse(prompt.ask_after) <= now.getTime(),
    )
    .slice(0, MAX_QUESTIONS);
  // What was meant for today and is still open: one tap marks it done.
  const leftToday = input.tasks.filter(
    (task) =>
      (task.status === "todo" || task.status === "doing") && task.planned_date === input.date,
  );
  const rhythmsLeft = input.rhythms.filter(
    (rhythm) =>
      rhythm.active &&
      !input.rhythmLogs.some((log) => log.rhythm_id === rhythm.id && log.done_on === input.date),
  );
  // Ç4a: tomorrow's draft is its plan's work in order (no day's three, no "vakit kalırsa"):
  // what does not fit is not on it; routines bound to the waking or the bedtime are not either.
  const draft = tomorrow.plan.slots.flatMap((slot) =>
    slot.assignment && slot.part === undefined && slot.assignment.candidate.type !== "follow_up"
      ? [slot.assignment.candidate]
      : [],
  );

  const next = () => setStep((value) => Math.min(STEPS.length - 1, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const confirm = () => {
    // One confirmation at a time: a second Enter while it is being written does nothing.
    if (close.isPending || close.isSuccess) return;
    const lines = dump
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // What was taken out of tomorrow joins what was already off it; a sitting takes its item.
    const takenOut = removed.flatMap((id) => {
      const task = tomorrow.base.tasks.find((row) => row.id === id);
      return task?.work_item_id ? [id, task.work_item_id] : [id];
    });
    const skipped = [...new Set([...(tomorrow.base.skipped ?? []), ...takenOut])];
    const plan = buildPlan({ ...tomorrow.base, skipped });
    close.mutate(
      {
        today: input.date,
        now: new Date(),
        tomorrow: {
          plan,
          day: tomorrow.base,
          // Ç4a: what the closing takes out is not tomorrow's own "Ertele" (`putOff` empty):
          // tomorrow is not "done" for it.
          stored: advice ? { skipped, putOff: [], advice } : { skipped, putOff: [] },
        },
        note: null,
        reasons: advice?.reasons ?? null,
      },
      {
        onSuccess: () => {
          for (const line of lines) addEntry.mutate({ id: crypto.randomUUID(), text: line });
          onDone("confirmed");
        },
      },
    );
  };
  return (
    <div className="flex flex-col gap-3.5 md:gap-4">
      <StepKeys onNext={step === STEPS.length - 1 ? () => confirm() : next} onBack={back} />
      <h2 className="tracking-title px-1 text-2xl font-bold md:px-0 md:text-3xl">Kapanış</h2>
      <ol aria-label="Adımlar" className="flex gap-1.5 md:max-w-180 md:gap-2.5">
        {STEPS.map((name, index) => (
          <li
            key={name}
            aria-current={index === step ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col gap-1.5"
          >
            <span
              aria-hidden
              className={cn("h-1 rounded-xs", index <= step ? "bg-ink" : "bg-fill-step")}
            />
            <span
              className={cn(
                "truncate text-sm",
                index === step ? "text-ink font-semibold" : "text-ink-2",
              )}
            >
              {index + 1}. {name}
            </span>
          </li>
        ))}
      </ol>

      <section
        aria-label={STEPS[step]}
        className="glass-dense rounded-dense flex min-h-[40vh] flex-col gap-3 p-4.75 md:min-h-[45vh] md:max-w-180"
      >
        {step === 0 ? (
          questions.length === 0 ? (
            <p className="text-ink-2 text-lead">Cevap bekleyen soru yok.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {questions.map((prompt) => (
                <li key={prompt.id} className="flex flex-col gap-2.5">
                  <p className="text-lead">
                    <span className="text-ink-2">
                      {moduleMap.get(prompt.module_id)?.row.name} ·{" "}
                    </span>
                    {prompt.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {((prompt.options as { value: string; label: string }[] | null) ?? []).map(
                      (option) => (
                        <Button
                          key={option.value}
                          variant="secondary"
                          size="sm"
                          className="h-11.5"
                          onClick={() => answer.mutate({ prompt, value: option.value })}
                        >
                          {option.label}
                        </Button>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {step === 1 ? (
          <>
            <h3 className="text-xl font-semibold">Bugün başka ne yaptın?</h3>
            {leftToday.length === 0 && rhythmsLeft.length === 0 ? (
              <p className="text-ink-2 text-lead">Bugün için açık kalan bir şey yok.</p>
            ) : (
              <ul className={LIST}>
                {leftToday.map((task) => (
                  <DoneRow
                    key={task.id}
                    title={task.title}
                    mod={moduleMap.get(task.module_id)}
                    onDone={() => complete.mutate(task.id)}
                  />
                ))}
                {rhythmsLeft.map((rhythm) => (
                  <DoneRow
                    key={rhythm.id}
                    title={rhythm.title}
                    mod={moduleMap.get(rhythm.module_id)}
                    onDone={() => logRhythm.mutate(rhythm.id)}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Yarının taslağı</h3>
              <p className="text-ink-2 text-note">İstemediğini çıkar.</p>
            </div>
            {draft.length === 0 ? (
              <p className="text-ink-2 text-lead">Yarın için planlanan bir şey yok.</p>
            ) : (
              <ul className={LIST}>
                {draft.map((candidate) => (
                  <DraftRow
                    key={candidate.id}
                    candidate={candidate}
                    mod={moduleMap.get(candidate.moduleId)}
                    reason={advice?.reasons?.[candidate.id]}
                    onRemove={() => setRemoved([...removed, candidate.id])}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Aklında kalanlar</h3>
              <p className="text-ink-2 text-note">Her satır gelen kutusuna bir giriş olur.</p>
            </div>
            <Textarea
              aria-label="Aklında kalanlar"
              value={dump}
              onChange={(event) => setDump(event.target.value)}
              rows={6}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h3 className="text-xl font-semibold">Yarın</h3>
            {draft.length === 0 ? (
              <p className="text-ink-2 text-lead">
                Yarın için seçilen iş yok; yarın sabah plan kendiliğinden kurulur.
              </p>
            ) : (
              <ol className="text-lead flex flex-col gap-3">
                {draft.map((candidate) => (
                  <li key={candidate.id}>{candidate.title}</li>
                ))}
              </ol>
            )}
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={back}>
            Geri
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={next}>
            İleri
          </Button>
        ) : (
          <Button variant="primary" disabled={close.isPending} onClick={() => confirm()}>
            Onayla
          </Button>
        )}
        {/* "Vazgeç" skips the closing; the scene goes on (Ç4c). */}
        <Button variant="quiet" onClick={() => onDone("skipped")}>
          Vazgeç
        </Button>
      </div>
      <p className="text-ink-2 text-sm max-md:hidden">Enter ile ilerle, Escape ile geri dön.</p>
    </div>
  );
}

/** The steps' lists: a box of rows inside the panel (KS2, KS3). */
const LIST = "bg-fill-field border-edge-quiet rounded-2xl flex flex-col overflow-hidden border";

function DoneRow({
  title,
  mod,
  onDone,
}: {
  title: string;
  mod: KnownModule | undefined;
  onDone: () => void;
}) {
  const [done, setDone] = useState(false);
  return (
    <li className="border-line flex min-h-15 items-center justify-between gap-3 border-b pr-2.5 pl-4 last:border-b-0">
      <span className={cn("min-w-0 truncate text-base", done && "text-ink-2 line-through")}>
        {mod ? <span className="text-ink-2">{mod.row.name} · </span> : null}
        {title}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={done}
        aria-label={`Yaptım: ${title}`}
        onClick={() => {
          setDone(true);
          onDone();
        }}
      >
        Yaptım
      </Button>
    </li>
  );
}

function DraftRow({
  reason,
  candidate,
  mod,
  onRemove,
}: {
  candidate: Candidate;
  mod: KnownModule | undefined;
  onRemove: () => void;
  /** The AI's reason, when it planned the draft. */
  reason?: string;
}) {
  const colors = useColors();
  return (
    <li className="border-line flex min-h-15 items-center gap-3 border-b py-2 pr-2.5 pl-4 last:border-b-0">
      <span
        aria-hidden
        data-testid="work-dot"
        className="size-2.25 shrink-0 rounded-full"
        style={{ backgroundColor: colors.of(candidate.moduleId, candidate) }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-base font-semibold">{candidate.title}</p>
        <p className="text-ink-2 truncate text-sm tabular-nums">
          {[mod?.row.name, formatMinutes(candidate.minutes)].filter(Boolean).join(" · ")}
        </p>
        {reason ? <AiReason>{reason}</AiReason> : null}
      </div>
      <Button variant="quiet" size="sm" aria-label={`Çıkar: ${candidate.title}`} onClick={onRemove}>
        Çıkar
      </Button>
    </li>
  );
}

/**
 * Enter goes on, Escape goes back. Through the window: focus may be anywhere on the page. A
 * text box keeps its own Enter (Ctrl+Enter goes on from there); a button its own.
 */
function StepKeys({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && !(event.ctrlKey || event.metaKey)) return;
      if (target instanceof HTMLButtonElement && event.key === "Enter") return;
      if (event.key === "Enter") {
        event.preventDefault();
        onNext();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack]);
  return null;
}
