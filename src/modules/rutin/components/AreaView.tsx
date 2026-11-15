"use client";

import { useModuleQuery } from "@/core/app/hooks";
import type { AreaViewProps } from "@/core/contract/types";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { cn } from "@/lib/utils";
import { shiftDay } from "@/lib/date";
import { token } from "@/core/ui/tokens";
import { listRoutines, listRuns } from "../queries";
import type { Routine, Run } from "../server/flow";

// Rutin's view on the Sağlık area's page (docs/tasarim/ekranlar/moduller.md, "Alan sayfası";
// frames MT8, MP4; Ç4c): the last 14 days, a square a day for the morning and the evening;
// filled when that day's open basic steps were all done (the morning counts its two blocks
// together, rutin.md 1). A day without a run stays grey. No score, no streak.

const DAYS = 14;

export function BasicStepsView({ device }: AreaViewProps) {
  const { row } = useModule();
  const data = useModuleQuery(row, ["area", "basic-steps"], async (ctx) => {
    const today = await ctx.day();
    const from = shiftDay(today, -(DAYS - 1));
    const [routines, runs] = await Promise.all([listRoutines(ctx), listRuns(ctx, from)]);
    return { today, routines, runs };
  });
  if (!data.data) return <div className="min-h-24" />;
  const { today, routines, runs } = data.data;
  const days = Array.from({ length: DAYS }, (_, index) => shiftDay(today, index - (DAYS - 1)));
  const rows = [
    { key: "sabah", label: "Sabah", color: token("color-swatch-sun"), keys: ["sabah", "hazirlik"] },
    { key: "aksam", label: "Akşam", color: token("color-swatch-moon"), keys: ["aksam"] },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((line) => (
        <div key={line.key} className="flex items-center gap-3">
          <span className="text-note w-13 shrink-0">{line.label}</span>
          <ol
            aria-label={`${line.label}: son ${DAYS} gün`}
            className={cn("flex min-w-0 flex-1", device === "pano" ? "gap-1.5" : "gap-0.75")}
          >
            {days.map((day) => {
              const done = doneOn(day, line.keys, routines, runs);
              return (
                <li
                  key={day}
                  title={`${day.slice(8)}.${day.slice(5, 7)}: ${done ? "temel adımlar yapıldı" : "yapılmadı"}`}
                  data-done={done || undefined}
                  className="bg-fill-field aspect-square min-w-0 flex-1 rounded-sm md:rounded-md"
                  style={done ? { backgroundColor: line.color } : undefined}
                />
              );
            })}
          </ol>
        </div>
      ))}
      <p className="text-ink-2 text-sm">Dolu: o günün temel adımları yapıldı. Boş gün gri kalır.</p>
    </div>
  );
}

/** The day's blocks of the line were each done with their basic steps (the open ones only). */
function doneOn(day: string, keys: string[], routines: Routine[], runs: Run[]): boolean {
  const open = routines.filter((routine) => keys.includes(routine.key) && routine.active);
  if (open.length === 0) return false;
  return open.every((routine) =>
    runs.some((run) => run.routine_id === routine.id && run.day === day && run.minimum_done),
  );
}
