"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { keepWeek, storedWeek, weekInput } from "@/core/data/keep";
import { clearPastPlannedDays, touchDay } from "@/core/data/planning";
import { buildPlan, isReturning } from "@/core/planner";
import { weekAction } from "@/core/planner/week";
import { CORE, MODULE, useDb } from "./CoreProvider";
import { useTodayPlan } from "./hooks";

// The plan keeper: nothing depends on the user doing anything (rule 3). Whenever the app is
// open it makes sure the week has its commitment (re-made only on a trigger, new items added
// when they come) and today its record and plan (docs/04-planlayici.md, "Otomatik plan").

export function PlanKeeper() {
  const db = useDb();
  const queryClient = useQueryClient();
  const { input, rows, now } = useTodayPlan();
  const busy = useRef(false);

  useEffect(() => {
    if (!input || !rows || busy.current) return;
    const week = weekInput(rows, now);
    const action = weekAction(
      storedWeek(rows.weekPlans.find((row) => row.week_start === week.weekStart)),
      week,
    );
    const day = rows.days.find((row) => row.date === input.date) ?? null;
    const needsDay = !day || !day.plan_source || !day.started_at;
    if (!action && !needsDay) return;

    busy.current = true;
    void (async () => {
      try {
        // The week first; the day is planned once the sittings it made have been read back.
        // keepWeek reads the rows again itself: what this screen holds may be older than a
        // write it has just made.
        if (action) await keepWeek(db, now);
        else {
          // Back after days away: what was planned for the days missed is spread again.
          if (isReturning(input)) await clearPastPlannedDays(db, input.date);
          await touchDay(db, {
            date: input.date,
            now,
            plan: buildPlan(input),
            dayType: input.dayType,
            day,
          });
        }
      } catch {
        // The next change or minute tries again; the screens plan live from the data anyway.
      } finally {
        // Free again only once the screens hold what was written.
        await queryClient.invalidateQueries({ queryKey: [CORE] });
        void queryClient.invalidateQueries({ queryKey: [MODULE] });
        busy.current = false;
      }
    })();
  }, [input, rows, now, db, queryClient]);

  return null;
}
