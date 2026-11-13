"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneProps } from "@/core/contract/types";
import { type Step, StepRunner } from "@/core/ui/kit";
import { useNotify } from "@/core/ui/Notices";
import { SAVE_FAILED } from "@/core/ui/Notices";
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

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** A free scene: the work, the time, a line said aloud (and shown), the core's buttons. */
function FocusScene({ subject, session, controls, say, today, device }: SceneProps) {
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  if (title.includes("[hata]")) throw new Error("deneme: the scene fails on purpose");
  const [said, setSaid] = useState<string | null>(null);
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
function WorkoutScene({ subject, controls, say, ctx }: SceneProps) {
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

/**
 * Ç3e: the morning facet's scene, sunny, and the evening facet's, a night sky. One component
 * each, drawn with the facet the core hands over (`facet`: its name and the user's colour).
 */
function FacetScene({
  subject,
  session,
  controls,
  facet,
  testId,
  greeting,
  sky,
}: SceneProps & { testId: string; greeting: string; sky: string }) {
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const color = facet?.color ?? "currentColor";
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
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-12 px-6 text-base" onClick={() => void controls.finish()}>
          Bitti
        </Button>
        <Button variant="outline" className="h-12 px-5 text-base" onClick={controls.stuck}>
          Takıldım
        </Button>
      </div>
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
      sky="radial-gradient(circle at 70% 30%, #e2e8f0 0 18%, $color 20%)"
    />
  );
}
