"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneChain, SceneKey, SceneProps, SceneWelcomeProps } from "@/core/contract/types";
import { type ChecklistStep, Checklist, token } from "@/core/ui/kit";
import { useNotify } from "@/core/ui/Notices";
import { SAVE_FAILED } from "@/core/ui/Notices";
import { formatMinutes, formatTime } from "@/lib/date";
import { getItem, updateItem } from "../queries";

// The module's scenes (docs/06-modul-sozlesmesi.md, "Sahne"): while a focused sitting ("odak")
// runs, a free scene; while a workout runs, a step scene on the kit's checklist (Checklist), its step kept in
// the module's own row so both screens follow it. A record named with "[hata]" throws: the core's
// fallback is tried against it.

import { kindOf, sourceOf } from "../subject";
import { FlowScene, PomodoroScene } from "./LayoutScenes";

export const WORKOUT_STEPS: ChecklistStep[] = [
  { key: "isinma", title: "Isınma", seconds: 300, detail: "Hafif tempoda yürü ya da pedal çevir." },
  { key: "squat", title: "Squat", reps: 10 },
  { key: "sinav", title: "Şınav", reps: 10 },
  { key: "soguma", title: "Soğuma", seconds: 120, detail: "Yavaşla, esne." },
];

export function DenemeScene(props: SceneProps) {
  const kind = kindOf(props.subject);
  // Okul çekirdek A: the kit's layouts (pomodoro, flow; the workout's checklist).
  if (kind === "pomodoro") return <PomodoroScene {...props} />;
  if (kind === "akis") return <FlowScene {...props} />;
  return kind === "antrenman" ? <WorkoutScene {...props} /> : <FocusScene {...props} />;
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
    // A session still being written is not ended (the core's own Space waits for it too).
    if (key === "space" && session.id !== "pending") void controls.finish();
  });
  if (title.includes("[hata]")) throw new Error("deneme: the scene fails on purpose");
  const tell = () => {
    // Ç4a: the day's next planned work (no day's three).
    const first = today.work.first;
    const next = first && first.title !== title ? first : null;
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

/**
 * Sabah açılışı (docs/06-modul-sozlesmesi.md, "Sahne", rule 7): the welcome of a focused sitting
 * or a workout that begins the morning's chain. "Günaydın", the work, one "Başla"; small, "Biraz
 * önce uyandım" (while no waking is recorded) and "Şimdi değil". A title with "[hata]" throws:
 * the core gives the Today screen back.
 */
export function DenemeWelcome({ subject, woke, controls, device }: SceneWelcomeProps) {
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const [earlier, setEarlier] = useState(false);
  if (title.includes("[hata]")) throw new Error("deneme: the welcome fails on purpose");
  const begin = (minutes?: number) => void controls.start(minutes).catch(() => undefined);
  return (
    <div className="flex flex-1 flex-col justify-between gap-8" data-testid="deneme-welcome">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Karşılama · {device === "pano" ? "pano" : "telefon"}
        </p>
        <h2 className="text-3xl leading-tight font-semibold md:text-6xl">Günaydın</h2>
        <p className="text-lg md:text-2xl">Önce: {title}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="h-12 px-6 text-base" onClick={() => begin()}>
          Başla
        </Button>
        <div className="flex flex-wrap gap-2">
          {earlier ? (
            [15, 30, 60].map((minutes) => (
              <Button key={minutes} variant="quiet" size="sm" onClick={() => begin(minutes)}>
                {minutes} dk önce
              </Button>
            ))
          ) : woke ? null : (
            <Button variant="quiet" size="sm" onClick={() => setEarlier(true)}>
              Biraz önce uyandım
            </Button>
          )}
          <Button variant="quiet" size="sm" onClick={controls.later}>
            Şimdi değil
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A step scene: the workout's steps; which one it is on lives in the module's row. */
function WorkoutScene({ subject, controls, say, ctx, keys, device, facet }: SceneProps) {
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
      {/* Okul çekirdek A: the kit's checklist (the former StepRunner); the title is the step. */}
      <Checklist
        device={device}
        title={WORKOUT_STEPS[current]?.title ?? "Antrenman"}
        color={facet?.color ?? token("color-swatch-teal")}
        steps={WORKOUT_STEPS}
        current={current}
        onStep={onStep}
      />
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
      sky="radial-gradient(circle at 35% 35%, var(--sky-sun), $color)"
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
      sky="radial-gradient(circle at 70% 30%, var(--sky-moon) 0 18%, $color 20%)"
    />
  );
}
