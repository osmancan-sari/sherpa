"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useAddInboxEntry,
  useAnswerPrompt,
  useCompleteTask,
  useLogRhythm,
} from "@/core/app/actions";
import { type KnownModule, useModules, useTodayPlan } from "@/core/app/hooks";
import { useCloseDay } from "@/core/app/plan-actions";
import { buildPlan, type Candidate, tomorrowInput } from "@/core/planner";
import { formatMinutes } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { LoadFailed } from "../today/TodayScreen";

// The evening closing (docs/04-planlayici.md, "Akşam kapanışı"): confirming tomorrow's plan. One
// step per screen, moved through with the keyboard (Enter goes on, Escape goes back). It may
// never be done at all: tomorrow plans itself (rule 3).

const STEPS = ["Sorular", "Bugün", "Yarın", "Boşalt", "Onay"] as const;
/** At most this many open questions are asked at the closing. */
const MAX_QUESTIONS = 5;

export function ClosingScreen() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 md:px-10 md:py-8">
      <ClientOnly
        fallback={<h1 className="text-xl font-semibold tracking-tight md:text-2xl">Kapanış</h1>}
      >
        <ClosingBody />
      </ClientOnly>
    </div>
  );
}

function ClosingBody() {
  const router = useRouter();
  const { modules } = useModules();
  const { input, rows, failed, retry, now, context } = useTodayPlan();
  const answer = useAnswerPrompt();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const addEntry = useAddInboxEntry();
  const close = useCloseDay();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dump, setDump] = useState("");
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);

  const tomorrow = useMemo(() => {
    if (!rows) return null;
    const base = tomorrowInput(rows, { now, context });
    return { base, plan: buildPlan({ ...base, skipped: [...(base.skipped ?? []), ...removed] }) };
  }, [rows, now, context, removed]);

  if (failed) return <LoadFailed onRetry={retry} />;
  if (!input || !rows || !tomorrow) {
    return <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Kapanış</h1>;
  }

  const questions = rows.prompts
    .filter(
      (prompt) => prompt.status === "pending" && Date.parse(prompt.ask_after) <= now.getTime(),
    )
    .slice(0, MAX_QUESTIONS);
  // What was meant for today and is still open: one tap marks it done.
  const leftToday = input.tasks.filter(
    (task) =>
      (task.status === "todo" || task.status === "doing") &&
      (input.top3?.includes(task.id) || task.planned_date === input.date),
  );
  const rhythmsLeft = input.rhythms.filter(
    (rhythm) =>
      rhythm.active &&
      !input.rhythmLogs.some((log) => log.rhythm_id === rhythm.id && log.done_on === input.date),
  );
  const top3 = picked ?? tomorrow.plan.top3;
  const candidates = tomorrow.plan.candidates.filter((row) => row.type !== "follow_up");
  const placed = new Set(
    tomorrow.plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment.candidate.id] : [])),
  );

  const next = () => setStep((value) => Math.min(STEPS.length - 1, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const togglePick = (id: string) => {
    const current = picked ?? tomorrow.plan.top3;
    setPicked(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  };
  const confirm = () => {
    const lines = dump
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) addEntry.mutate({ id: crypto.randomUUID(), text: line });
    const plan = buildPlan({
      ...tomorrow.base,
      top3,
      skipped: [...(tomorrow.base.skipped ?? []), ...removed],
    });
    close.mutate(
      {
        today: input.date,
        now: new Date(),
        tomorrow: { plan: { ...plan, top3 }, day: tomorrow.base, stored: { skipped: removed } },
        note: null,
      },
      { onSuccess: () => router.push("/") },
    );
  };
  return (
    <div className="flex flex-col gap-6">
      <StepKeys onNext={step === STEPS.length - 1 ? confirm : next} onBack={back} />
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Kapanış</h1>
        <ol
          aria-label="Adımlar"
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
          {STEPS.map((name, index) => (
            <li
              key={name}
              aria-current={index === step ? "step" : undefined}
              className={cn(index === step && "text-foreground font-medium")}
            >
              {index + 1}. {name}
            </li>
          ))}
        </ol>
      </header>

      <section
        aria-label={STEPS[step]}
        className="border-border flex min-h-64 flex-col gap-4 rounded-2xl border p-6"
      >
        {step === 0 ? (
          questions.length === 0 ? (
            <p className="text-muted-foreground">Cevap bekleyen soru yok.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {questions.map((prompt) => (
                <li key={prompt.id} className="flex flex-col gap-2">
                  <p>
                    <span className="text-muted-foreground">
                      {moduleMap.get(prompt.module_id)?.row.name} ·{" "}
                    </span>
                    {prompt.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {((prompt.options as { value: string; label: string }[] | null) ?? []).map(
                      (option) => (
                        <Button
                          key={option.value}
                          variant="outline"
                          className="h-11 md:h-9"
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
            <h2 className="font-medium">Bugün başka ne yaptın?</h2>
            {leftToday.length === 0 && rhythmsLeft.length === 0 ? (
              <p className="text-muted-foreground">Bugün için açık kalan bir şey yok.</p>
            ) : (
              <ul className="divide-border border-border divide-y rounded-xl border">
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
            <h2 className="font-medium">Yarının taslağı</h2>
            <p className="text-muted-foreground text-sm">
              Günün üç işi işaretli. Dokunarak değiştir; istemediğini çıkar.
            </p>
            {candidates.length === 0 ? (
              <p className="text-muted-foreground">Yarın için planlanan bir şey yok.</p>
            ) : (
              <ul className="divide-border border-border divide-y rounded-xl border">
                {candidates.map((candidate) => (
                  <DraftRow
                    key={candidate.id}
                    candidate={candidate}
                    mod={moduleMap.get(candidate.moduleId)}
                    chosen={top3.includes(candidate.id)}
                    fits={placed.has(candidate.id)}
                    onToggle={() => togglePick(candidate.id)}
                    onRemove={() => {
                      setRemoved([...removed, candidate.id]);
                      if (picked) setPicked(picked.filter((id) => id !== candidate.id));
                    }}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="font-medium">Aklında kalanlar</h2>
            <p className="text-muted-foreground text-sm">
              Her satır gelen kutusuna bir giriş olur.
            </p>
            <textarea
              aria-label="Aklında kalanlar"
              value={dump}
              onChange={(event) => setDump(event.target.value)}
              rows={5}
              className="border-input bg-background focus-visible:ring-ring/50 rounded-lg border p-3 text-base outline-none focus-visible:ring-3"
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="font-medium">Yarın</h2>
            {top3.length === 0 ? (
              <p className="text-muted-foreground">
                Yarın için seçilen iş yok; yarın sabah plan kendiliğinden kurulur.
              </p>
            ) : (
              <ol className="flex list-decimal flex-col gap-1 pl-5">
                {top3.map((id) => (
                  <li key={id}>{candidates.find((row) => row.id === id)?.title ?? "İş"}</li>
                ))}
              </ol>
            )}
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button variant="outline" className="h-11 md:h-9" onClick={back}>
            Geri
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button className="h-11 md:h-9" onClick={next}>
            İleri
          </Button>
        ) : (
          <Button className="h-11 md:h-9" disabled={close.isPending} onClick={confirm}>
            Onayla
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">Enter ile ilerle, Escape ile geri dön.</p>
    </div>
  );
}

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
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className={cn("min-w-0 truncate", done && "text-muted-foreground line-through")}>
        {mod ? <span className="text-muted-foreground">{mod.row.name} · </span> : null}
        {title}
      </span>
      <Button
        variant="outline"
        className="h-11 shrink-0 md:h-9"
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
  candidate,
  mod,
  chosen,
  fits,
  onToggle,
  onRemove,
}: {
  candidate: Candidate;
  mod: KnownModule | undefined;
  chosen: boolean;
  fits: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        aria-pressed={chosen}
        aria-label={`Günün üç işi: ${candidate.title}`}
        onClick={onToggle}
        className={cn(
          "border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
          chosen && "bg-foreground text-background",
        )}
      >
        {chosen ? <Check aria-hidden className="size-3.5" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate">{candidate.title}</p>
        <p className="text-muted-foreground truncate text-sm tabular-nums">
          {[mod?.row.name, formatMinutes(candidate.minutes), fits ? null : "vakit kalırsa"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Button
        variant="ghost"
        className="h-11 shrink-0 md:h-9"
        aria-label={`Çıkar: ${candidate.title}`}
        onClick={onRemove}
      >
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
