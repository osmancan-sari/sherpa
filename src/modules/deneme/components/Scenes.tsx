"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneChain, SceneKey, SceneProps } from "@/core/contract/types";
import { type Step, StepRunner } from "@/core/ui/kit";
import { useNotify } from "@/core/ui/Notices";
import { SAVE_FAILED } from "@/core/ui/Notices";
import { formatMinutes, formatTime } from "@/lib/date";
import { getItem, updateItem } from "../queries";

// The module's scenes (docs/06-modul-sozlesmesi.md, "Sahne"): while a focused sitting ("odak")
// runs, a free scene; while a workout runs, a step scene on the kit's StepRunner, its step kept in
// the module's own row so both screens follow it. A record named with "[hata]" throws: the core's
// fallback is tried against it.

import { kindOf, sourceOf } from "../subject";

export const WORKOUT_STEPS: Step[] = [
  { key: "isinma", title: "Isınma", seconds: 300, note: "Hafif tempoda yürü ya da pedal çevir." },
  { key: "squat", title: "Squat", reps: 10 },
  { key: "sinav", title: "Şınav", reps: 10 },
  { key: "soguma", title: "Soğuma", seconds: 120, note: "Yavaşla, esne." },
];

export function DenemeScene(props: SceneProps) {
  return kindOf(props.subject) === "antrenman" ? (
    <WorkoutScene {...props} />
  ) : (
    <FocusScene {...props} />
  );
}

/**
 * Ç3g: the Today keys this scene takes (`keys: "scene"` in scene.ts): the handler sees the latest
 * render's state; the listener is the core's.
 */
function useSceneKeys(keys: SceneProps["keys"], handle: (key: SceneKey) => void) {
  const latest = useRef(handle);
  useEffect(() => {
    latest.current = handle;
  });
  useEffect(() => keys?.listen((key) => latest.current(key)), [keys]);
}

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** A free scene: the work, the time, a line said aloud (and shown), the core's buttons. */
function FocusScene({ subject, session, controls, say, today, device, keys }: SceneProps) {
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const [said, setSaid] = useState<string | null>(null);
  // Ç3g: Space is still "Bitti" here, now the scene's own.
  useSceneKeys(keys, (key) => {
    if (key === "space") void controls.finish();
  });
  if (title.includes("[hata]")) throw new Error("deneme: the scene fails on purpose");
  const tell = () => {
    const next = today.top.find((row) => row.title !== title);
    const text = next ? `${title} sürüyor. Sonra sırada ${next.title} var.` : `${title} sürüyor.`;
    setSaid(text);
    say(text, { interrupt: true });
  };
  return (
    <div className="flex flex-1 flex-col justify-between gap-8" data-testid="deneme-focus">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Odak · {device === "pano" ? "pano" : "telefon"}
        </p>
        <h2 className="text-3xl leading-tight font-semibold md:text-6xl">{title}</h2>
        <p className="text-5xl font-semibold tabular-nums md:text-8xl" aria-label="Geçen süre">
          {clock(session.elapsedSeconds)}
        </p>
        {said ? (
          <p role="status" className="text-muted-foreground md:text-lg">
            {said}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-12 px-6 text-base" onClick={() => void controls.finish()}>
          Bitti
        </Button>
        <Button variant="outline" className="h-12 px-5 text-base" onClick={tell}>
          Anlat
        </Button>
        <Button variant="outline" className="h-12 px-5 text-base" onClick={controls.stuck}>
          Takıldım
        </Button>
      </div>
    </div>
  );
}

/** A step scene: the workout's steps; which one it is on lives in the module's row. */
function WorkoutScene({ subject, controls, say, ctx, keys }: SceneProps) {
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const id = sourceOf(subject);
  const item = useModuleQuery(ctx.module, ["item", id], (moduleCtx) =>
    id ? getItem(moduleCtx, id) : Promise.resolve(null),
  );
  const [local, setLocal] = useState<number | null>(null);
  const current = local ?? item.data?.scene_step ?? 0;
  const save = (step: number | null) => {
    if (!id) return;
    updateItem(ctx, id, { scene_step: step })
      .then(() => refreshAll())
      .catch(() => notify(SAVE_FAILED));
  };
  const onStep = (index: number) => {
    const next = index + 1;
    setLocal(next);
    save(next);
    const step = WORKOUT_STEPS[next];
    say(step ? `Sıradaki: ${step.title}.` : "Antrenman tamam.", { interrupt: true });
  };
  const done = current >= WORKOUT_STEPS.length;
  // Ç3g: Space is the workout's next step (not the core's "Bitti" of the whole workout).
  useSceneKeys(keys, (key) => {
    if (key === "space" && !done) onStep(current);
  });
  return (
    <div className="flex flex-1 flex-col justify-between gap-8" data-testid="deneme-workout">
      <StepRunner steps={WORKOUT_STEPS} current={current} onStep={onStep} />
      {done ? (
        <div>
          <Button
            className="h-12 px-6 text-base"
            onClick={() => {
              save(null);
              void controls.finish();
            }}
          >
            Antrenmanı bitir
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const WOKE_FROM: Record<NonNullable<SceneProps["today"]["wokeFrom"]>, string> = {
  screen: "ekrandan",
  outside: "dışarıdan",
  estimate: "ilk dokunuştan",
};

/**
 * Ç3g: the core's day as a scene reads it: the session's planning day, where the waking came
 * from, tomorrow's expected waking and tonight's sleep (moved by a real bedtime).
 */
function DayLine({ session, today, evening }: SceneProps & { evening: boolean }) {
  const parts = [`Gün ${session.day}`];
  if (!evening) parts.push(`uyanış ${today.wokeFrom ? WOKE_FROM[today.wokeFrom] : "yok"}`);
  if (evening && today.tomorrow) {
    parts.push(
      `yarın uyanış ${formatTime(today.tomorrow.wake)}`,
      `uyku ${formatMinutes(today.tomorrow.sleepMinutes)}`,
    );
  }
  return (
    <p data-testid="scene-day" className="text-muted-foreground text-sm tabular-nums">
      {parts.join(" · ")}
    </p>
  );
}

const STATE_LABEL: Record<SceneChain["items"][number]["state"], string> = {
  done: "yapıldı",
  running: "şimdi",
  next: "sırada",
  passed: "geçildi",
};

/**
 * Ç3f: the whole chain the running work is part of, other modules' work included (name, module,
 * colour, minutes, state: all a scene gets of them). The example of drawing `chain`.
 */
function ChainList({ chain }: { chain: SceneChain }) {
  return (
    <ol
      aria-label={chain.anchor === "wake" ? "Bu sabah" : "Bu akşam"}
      data-testid="scene-chain"
      className="flex flex-col gap-1 text-sm md:text-base"
    >
      {chain.items.map((item) => (
        <li
          key={item.id}
          data-state={item.state}
          data-mine={item.mine ? "true" : "false"}
          aria-current={item.state === "running" ? "step" : undefined}
          className={
            item.state === "done" || item.state === "passed"
              ? "text-muted-foreground flex flex-wrap items-center gap-x-2"
              : "flex flex-wrap items-center gap-x-2"
          }
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className={item.state === "running" ? "font-medium" : undefined}>{item.title}</span>
          <span className="text-muted-foreground basis-full pl-4 tabular-nums sm:basis-auto sm:pl-0">
            {[item.mine ? null : item.module.name, `${item.minutes} dk`, STATE_LABEL[item.state]]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Ç3e: the morning facet's scene, sunny, and the evening facet's, a night sky. One component
 * each, drawn with the facet the core hands over (`facet`: its name and the user's colour).
 * Ç3f: with the chain the work is part of beside it.
 */
function FacetScene(
  props: SceneProps & {
    testId: string;
    greeting: string;
    sky: string;
    evening?: boolean;
  },
) {
  const {
    subject,
    session,
    controls,
    facet,
    chain,
    today,
    bedtime,
    testId,
    greeting,
    sky,
    evening = false,
  } = props;
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const color = facet?.color ?? "currentColor";
  const [undo, setUndo] = useState<string | null>(null);
  // Ç3g: the strip as the scene wants it: the morning names its facet and counts from the
  // waking; the evening can leave the strip out ("Şeridi gizle").
  const [plain, setPlain] = useState(false);
  const wokeAt = today.wokeAt?.getTime() ?? null;
  const { strip } = props;
  useEffect(() => {
    if (evening) strip(plain ? { hidden: true } : null);
    else strip({ title: facet?.name ?? title, since: wokeAt === null ? null : new Date(wokeAt) });
  }, [strip, evening, plain, facet?.name, title, wokeAt]);
  // Rutin 1: after "Yatıyorum" the scene stays for a while; "Geri al" takes the bedtime back.
  if (bedtime) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4" data-testid={`${testId}-bed`}>
        <h2 className="text-3xl font-semibold md:text-5xl">İyi geceler</h2>
        <p className="text-muted-foreground">Yatış kaydedildi.</p>
        <DayLine {...props} evening />
        <div>
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              void bedtime
                .undo()
                .then((result) => setUndo(result))
                .catch(() => setUndo("failed"))
            }
          >
            Geri al
          </Button>
        </div>
        {undo && undo !== "undone" ? (
          <p role="status" className="text-muted-foreground text-sm">
            {undo === "expired"
              ? "Geri almak için geç."
              : undo === "changed"
                ? "Yatış başka yoldan değişti."
                : "Geri alınamadı."}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className="flex flex-1 flex-col justify-between gap-8"
      data-testid={testId}
      data-facet={facet?.key}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            data-testid="facet-sky"
            className="size-14 rounded-full md:size-20"
            style={{ background: sky.replaceAll("$color", color) }}
          />
          <p className="text-muted-foreground text-sm md:text-base">
            {facet?.name ?? ""} · {greeting}
          </p>
        </div>
        <h2 className="text-3xl leading-tight font-semibold md:text-6xl">{title}</h2>
        <p className="text-5xl font-semibold tabular-nums md:text-8xl" aria-label="Geçen süre">
          {clock(session.elapsedSeconds)}
        </p>
        <DayLine {...props} evening={evening} />
        {chain ? <ChainList chain={chain} /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-12 px-6 text-base" onClick={() => void controls.finish()}>
          Bitti
        </Button>
        <Button variant="outline" className="h-12 px-5 text-base" onClick={controls.stuck}>
          Takıldım
        </Button>
        {/* Ç3f: the evening's closing inside the scene, and the day's end from it. */}
        {evening && !today.closed ? (
          <Button variant="outline" className="h-12 px-5 text-base" onClick={controls.closing}>
            Günü kapat
          </Button>
        ) : null}
        {evening ? (
          <Button
            variant="outline"
            className="h-12 px-5 text-base"
            onClick={() => void controls.bed()}
          >
            Yatıyorum
          </Button>
        ) : null}
        {evening ? (
          <Button
            variant="ghost"
            className="h-12 px-5 text-base"
            aria-pressed={plain}
            onClick={() => setPlain(!plain)}
          >
            {plain ? "Şeridi göster" : "Şeridi gizle"}
          </Button>
        ) : null}
      </div>
      {evening && today.closed ? (
        <p className="text-muted-foreground text-sm">Günün kapanışı yapıldı.</p>
      ) : null}
    </div>
  );
}

export function SunScene(props: SceneProps) {
  return (
    <FacetScene
      {...props}
      testId="deneme-gunes"
      greeting="güne başlarken"
      sky="radial-gradient(circle at 35% 35%, #fde68a, $color)"
    />
  );
}

export function NightScene(props: SceneProps) {
  return (
    <FacetScene
      {...props}
      testId="deneme-gece"
      greeting="gün biterken"
      evening
      sky="radial-gradient(circle at 70% 30%, #e2e8f0 0 18%, $color 20%)"
    />
  );
}
