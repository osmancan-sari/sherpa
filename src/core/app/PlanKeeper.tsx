"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { postAi } from "@/core/ai/client";
import { keepWeek, storedWeek, weekInput } from "@/core/data/keep";
import { clearPastPlannedDays, planDay, touchDay } from "@/core/data/planning";
import { closeUnanswered } from "@/core/data/sessions";
import { buildPlan, isReturning, overrun, storedPlan } from "@/core/planner";
import { weekAction } from "@/core/planner/week";
import { weekStart, weekdayOf } from "@/lib/date";
import { CORE, MODULE, useDb } from "./CoreProvider";
import { useAiStatus, useHorizonReviews, useTodayPlan, useWeeklyReviews } from "./hooks";

// The plan keeper: nothing depends on the user doing anything (rule 3). Whenever the app is
// open it makes sure the week has its commitment (re-made only on a trigger, new items added
// when they come) and today its plan (docs/04-planlayici.md, "Otomatik plan"). The day's first
// touch is the user's: it is written when someone first touches a screen that day.
//
// With the AI on (docs/10-yapay-zeka.md): the week is committed on the server with its advice,
// the day's plan gets its advice once a day (unless the closing confirmed it), the coming weeks
// are looked at once a month and the week behind from Saturday. Every AI step is on top of the
// engine's: when it fails, what the engine planned stands.

/** The weekday (ISO) from which the week behind is looked back at. */
const REVIEW_FROM = 6;

export function PlanKeeper() {
  const db = useDb();
  const queryClient = useQueryClient();
  const { input, rows, now } = useTodayPlan();
  const aiStatus = useAiStatus();
  const aiOn = aiStatus.data?.state === "on";
  // Until the server has said whether the AI answers, the week waits: committed now, it would
  // be committed without the AI's advice.
  const aiKnown = aiStatus.data !== undefined || aiStatus.isError;
  const weeklyReviews = useWeeklyReviews();
  const horizonReviews = useHorizonReviews();
  const busy = useRef(false);
  // Changes that came while a step was running are looked at again once it is done, not at the
  // next tick of the clock.
  const [round, setRound] = useState(0);
  /** AI requests already made by this screen: one each, whatever the answer. */
  const asked = useRef(new Set<string>());

  useEffect(() => {
    // Until the server has said whether the AI answers, nothing is planned: the week would be
    // committed without its advice, the day planned before the week's sittings.
    if (!input || !rows || busy.current || !aiKnown) return;
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
    // The AI's steps, each once per screen (the server reuses an answer to the same question).
    // The day's plan is asked once a day on any screen: the attempt is kept on the day.
    const askPlan =
      aiOn &&
      day?.plan_source === "auto" &&
      !storedPlan(day).aiAsked &&
      !asked.current.has(`plan:${input.date}`);
    const month = `${input.date.slice(0, 7)}-01`;
    const askMonth =
      aiOn &&
      horizonReviews.data !== undefined &&
      !horizonReviews.data.some((row) => row.period_start === month) &&
      !asked.current.has(`month:${month}`);
    const thisWeek = weekStart(input.date);
    const askReview =
      aiOn &&
      weekdayOf(input.date) >= REVIEW_FROM &&
      weeklyReviews.data !== undefined &&
      !weeklyReviews.data.some((row) => row.week_start === thisWeek) &&
      !asked.current.has(`review:${thisWeek}`);
    if (!action && !needsPlan && !unanswered && !askPlan && !askMonth && !askReview) return;

    busy.current = true;
    // Only what this step wrote is read again: refreshing everything would undo the optimistic
    // change of a touch that is still being written.
    let wrote: string[] = [];
    // Looked at again at once only when the step changed something; a step that failed or
    // found nothing to do waits for the next change or tick of the clock.
    let changed = false;
    void (async () => {
      try {
        if (unanswered && open) {
          wrote = ["sessions", "tasks", "work_items"];
          await closeUnanswered(db, open.id);
          changed = true;
        } else if (action) {
          // The week first; the day is planned once the sittings it made have been read back.
          // keepWeek reads the rows again itself: this screen's may be older than its own write.
          wrote = ["week_plans", "tasks", "planner_stats"];
          const viaAi =
            aiOn && action.kind === "commit" ? await postAi<{ action: unknown }>("week", {}) : null;
          if (viaAi) changed = viaAi.action !== null;
          else changed = (await keepWeek(db, now)).action !== null;
        } else if (needsPlan) {
          wrote = ["days"];
          // Back after days away: what was planned for the days missed is spread again.
          if (isReturning(input)) {
            wrote.push("tasks");
            await clearPastPlannedDays(db, input.date);
          }
          await planDay(db, { plan: buildPlan(input), day: input });
          changed = true;
        } else if (askPlan) {
          wrote = ["days", "tasks"];
          asked.current.add(`plan:${input.date}`);
          await postAi("plan", { date: input.date, context: input.context });
        } else if (askMonth) {
          wrote = ["horizon_reviews"];
          asked.current.add(`month:${month}`);
          await postAi("month", {});
        } else if (askReview) {
          wrote = ["weekly_reviews"];
          asked.current.add(`review:${thisWeek}`);
          await postAi("review", {});
        }
      } catch {
        // The next change or tick of the clock tries again; the screens plan live from the data
        // anyway.
      } finally {
        // Free again only once the screens hold what was written.
        await Promise.all(
          wrote.map((table) => queryClient.invalidateQueries({ queryKey: [CORE, table] })),
        );
        if (wrote.includes("tasks")) void queryClient.invalidateQueries({ queryKey: [MODULE] });
        busy.current = false;
        if (changed) setRound((value) => value + 1);
      }
    })();
  }, [
    input,
    rows,
    now,
    db,
    queryClient,
    aiOn,
    aiKnown,
    weeklyReviews.data,
    horizonReviews.data,
    round,
  ]);

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
