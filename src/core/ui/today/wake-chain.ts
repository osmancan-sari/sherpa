"use client";

import { useEffect, useRef, useState } from "react";
import { useStartChain } from "@/core/app/actions";
import type { Plan, PlanInput } from "@/core/planner";
import { type Chain, wakeChainStart } from "@/core/today/chain";
import { sessionTargetOf } from "./NowCard";

// Ç3f: after a waking told from outside (the phone's alarm automation, `core/wake`), the wake
// chain's first work starts when the app comes to the front on a device (docs/06-modul-
// sozlesmesi.md, "Diziler" rule 5). The front is the page opening or becoming visible again; for
// a short while after it the fresh data is waited for (the waking may still be on its way), then
// the moment is over: a screen that stays open does not start anything by itself. Once a day per
// device; the database makes sure two devices start one session.

/** How long after coming to the front the data may still bring the waking. */
const FRONT_WINDOW_MS = 20_000;
const DONE_KEY = "sherpa.chain.wake";
/**
 * The page's opening, if it was a moment ago (`performance.now()` counts from it). Going from
 * Hafta to Bugün inside the app is no coming to the front: by then the opening is over.
 */
function openedJustNow(): Date | null {
  const since = performance.now();
  return since < FRONT_WINDOW_MS ? new Date(Date.now() - since) : null;
}

function startedOn(): string | null {
  try {
    return localStorage.getItem(DONE_KEY);
  } catch {
    return null;
  }
}

function markStarted(date: string) {
  try {
    localStorage.setItem(DONE_KEY, date);
  } catch {
    // This page only.
  }
}

export function useWakeChainStart(
  input: PlanInput | undefined,
  plan: Plan | undefined,
  wake: Chain | null,
) {
  const start = useStartChain();
  // When the app last came to the front on this device; null once that moment is over.
  const [front, setFront] = useState<Date | null>(openedJustNow);

  const tried = useRef(false);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      tried.current = false;
      setFront(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!front) return;
    const timer = setTimeout(() => setFront(null), FRONT_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [front]);

  useEffect(() => {
    if (!front || tried.current || !input || !plan) return;
    if (startedOn() === input.date) return;
    const chosen = wakeChainStart(input, wake, front);
    if (!chosen) return;
    tried.current = true;
    markStarted(input.date);
    start.mutate({ since: chosen.since.toISOString(), target: sessionTargetOf(chosen.target) });
  }, [front, input, plan, wake, start]);
}
