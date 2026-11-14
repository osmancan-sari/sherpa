"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useTodayPlan } from "@/core/app/hooks";
import { bedAsks } from "@/core/today/bedtime";
import { formatTime } from "@/lib/date";
import { Dialog } from "../Dialog";

// Ç3g: "Yatıyorum" far before the bedtime range (docs/05-arayuz.md, "Günün çerçevesi"): one short
// question before the day is closed by a tap that may have been a slip ("Saat 16:49. Şimdi yatıyor
// musun?"). In the range and near it, one tap as before. Every way the core records a bedtime
// from a tap goes through here: the evening card, "Onayla ve yat", a scene's `controls.bed()`.

type Pending = { at: Date; start: Date; framed: boolean; answer: (yes: boolean) => void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const set = (next: Pending | null) => {
  pending = next;
  listeners.forEach((listener) => listener());
};

/** Asks when `at` is far before tonight's bedtime range; resolves true to go on with the bed. */
export function useAskBed(): (at: Date) => Promise<boolean> {
  const { input } = useTodayPlan();
  return useCallback(
    (at: Date) => {
      const asks = input ? bedAsks(input, at) : null;
      if (!asks) return Promise.resolve(true);
      pending?.answer(false);
      return new Promise<boolean>((resolve) => set({ at, ...asks, answer: resolve }));
    },
    [input],
  );
}

/** The question itself; mounted once in the app's shell. */
export function BedAskDialog() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => null,
  );
  const answer = (yes: boolean) => {
    current?.answer(yes);
    set(null);
  };
  return (
    <Dialog
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) answer(false);
      }}
      title={current ? `Saat ${formatTime(current.at)}. Şimdi yatıyor musun?` : ""}
      description={
        current
          ? `${current.framed ? "Yatış aralığının başı" : "Günün bitişi"}: ${formatTime(current.start)}.`
          : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-9" onClick={() => answer(true)}>
          Evet, yatıyorum
        </Button>
        <Button variant="outline" className="h-11 md:h-9" onClick={() => answer(false)}>
          Vazgeç
        </Button>
      </div>
    </Dialog>
  );
}
