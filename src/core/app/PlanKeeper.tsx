"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { keepWeek, storedWeek, weekInput } from "@/core/data/keep";
import { clearPastPlannedDays, planDay, touchDay } from "@/core/data/planning";
import { closeUnanswered } from "@/core/data/sessions";
import { buildPlan, isReturning, overrun } from "@/core/planner";
import { weekAction } from "@/core/planner/week";
import { CORE, MODULE, useDb } from "./CoreProvider";
import { useTodayPlan } from "./hooks";

// The plan keeper: nothing depends on the user doing anything (rule 3). Whenever the app is
// open it makes sure the week has its commitment (re-made only on a trigger, new items added
// when they come) and today its plan (docs/04-planlayici.md, "Otomatik plan"). The day's first
// touch is the user's: it is written when someone first touches a screen that day.

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
    const needsPlan = !day?.plan_source;
    // A session nobody answered for is closed at its estimate, unmeasured.
    const open = rows.openSession;
    const task = open ? rows.tasks.find((row) => row.id === open.task_id) : undefined;
    const rhythm = open ? rows.rhythms.find((row) => row.id === open.rhythm_id) : undefined;
    const unanswered =
      open && open.id !== "pending"
        ? overrun(open, task?.est_minutes ?? rhythm?.est_minutes ?? null, now) === "close"
        : false;
    if (!action && !needsPlan && !unanswered) return;

    busy.current = true;
    void (async () => {
      try {
        // The week first; the day is planned once the sittings it made have been read back.
        // keepWeek reads the rows again itself: this screen's may be older than its own write.
        if (unanswered && open) await closeUnanswered(db, open.id);
        else if (action) await keepWeek(db, now);
        else {
          // Back after days away: what was planned for the days missed is spread again.
          if (isReturning(input)) await clearPastPlannedDays(db, input.date);
          await planDay(db, { plan: buildPlan(input), day: input });
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

  // The first touch of the day: a key or a tap on any screen, once a day.
  const date = input?.date;
  const touched = useRef<string | null>(null);
  useEffect(() => {
    if (!date) return;
    const day = rows?.days.find((row) => row.date === date);
    if (day?.started_at) touched.current = date;
    const onTouch = () => {
      if (touched.current === date) return;
      touched.current = date;
      touchDay(db, date, new Date())
        .then(() => queryClient.invalidateQueries({ queryKey: [CORE, "days"] }))
        .catch(() => {
          touched.current = null;
        });
    };
    window.addEventListener("pointerdown", onTouch);
    window.addEventListener("keydown", onTouch);
    return () => {
      window.removeEventListener("pointerdown", onTouch);
      window.removeEventListener("keydown", onTouch);
    };
  }, [date, rows, db, queryClient]);

  return null;
}
