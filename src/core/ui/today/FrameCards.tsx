"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStartSession } from "@/core/app/actions";
import { useRecordBed, useRecordWake, useSetExpected } from "@/core/app/frame-actions";
import type { KnownModule } from "@/core/app/hooks";
import type { Assignment, DayFrame, SleepPlan, TodayBriefLine } from "./frame-text";
import { sleepLine, shortLine } from "./frame-text";
import { formatMinutes, formatTime, shiftDay } from "@/lib/date";
import { useAskBed } from "./BedAsk";
import { CardActions, CardFrame, ChainLine, ModuleLine, sessionTargetOf, TITLE } from "./NowCard";

// The day's frame on the card (docs/05-arayuz.md, "Günün çerçevesi"; Ç3c; look: BT20, BT22):
// "Günaydın" with "Uyandım", the evening with tonight's bed and tomorrow's waking, and the two
// one-day changes. Ç4c: no "Günü kapat" on the evening's card; the closing is a step of the
// evening's scene ("Kapanış" here only when no active module holds it).

const MINUTE = 60_000;
const clock = (instant: Date) => formatTime(instant);

/** "Günaydın": one tap records the waking; "Biraz önce" (two taps) a moment before it. */
export function MorningCard({
  date,
  now,
  first,
  startOnWake,
  brief,
  modules,
}: {
  date: string;
  now: Date;
  /** The first wake-bound work, offered right after "Uyandım". */
  first: Assignment | null;
  startOnWake: boolean;
  brief: TodayBriefLine;
  modules: Map<string, KnownModule>;
}) {
  const wake = useRecordWake();
  const start = useStartSession();
  const [earlier, setEarlier] = useState(false);
  const woke = (at: Date) => {
    wake.mutate({ date, at });
    // "Uyandım'dan sonra ilk rutin kendiliğinden başlasın" (Settings): one tap, waking and routine.
    if (startOnWake && first) start.mutate(sessionTargetOf(first.candidate));
  };
  const firstModule = first ? modules.get(first.candidate.moduleId) : undefined;
  return (
    <CardFrame label={null}>
      <h2 className={TITLE}>Günaydın</h2>
      <ul aria-label="Bugünün özeti" className="text-note md:text-lead flex flex-col gap-1.5">
        {brief.firstBlock ? <li className="text-ink-soft">İlk blok: {brief.firstBlock}</li> : null}
        {first ? (
          <li className="text-ink-2">
            Önce: {first.candidate.title}
            {firstModule ? ` · ${firstModule.row.name}` : null}
          </li>
        ) : null}
      </ul>
      <CardActions>
        <Button
          variant="primary"
          size="lg"
          data-primary=""
          data-wake-action
          onClick={() => woke(now)}
        >
          Uyandım
        </Button>
        {earlier ? (
          [15, 30, 60].map((minutes) => (
            <Button
              key={minutes}
              variant="secondary"
              size="lg"
              data-wake-action
              onClick={() => woke(new Date(now.getTime() - minutes * MINUTE))}
            >
              {minutes} dk önce
            </Button>
          ))
        ) : (
          <Button variant="secondary" size="lg" data-wake-action onClick={() => setEarlier(true)}>
            Biraz önce
          </Button>
        )}
      </CardActions>
    </CardFrame>
  );
}

/**
 * The evening (BT22): the evening's next work with "Başla" (the card's only primary), tonight's
 * bed with tomorrow's waking and the sleep between them, "Yatıyorum" (secondary), and the two
 * one-day changes. No "Günü kapat" (Ç4c): the closing is in the evening's scene; "Kapanış" is
 * offered here only when no active module holds it (`onClosing`).
 */
export function EveningCard({
  date,
  now,
  frame,
  next,
  later = null,
  closed,
  modules,
  chainLine = null,
  onClosing,
}: {
  date: string;
  now: Date;
  frame: DayFrame;
  next: Assignment | null;
  /** Ç3g: bed-bound work not offered yet, and when it comes. */
  later?: { assignment: Assignment; at: Date } | null;
  closed: boolean;
  modules: Map<string, KnownModule>;
  /** Ç3f: the next work's place in the bed chain. */
  chainLine?: string | null;
  /** Ç4c: opens the closing in the standard scene shell (no module holds it). */
  onClosing?: () => void;
}) {
  const bed = useRecordBed();
  const askBed = useAskBed();
  const expected = useSetExpected();
  const start = useStartSession();
  const [change, setChange] = useState<"bed" | "wake" | null>(null);
  const tonight: SleepPlan = frame.tonight;
  const mod = next ? modules.get(next.candidate.moduleId) : undefined;
  const short = shortLine(tonight);
  return (
    <CardFrame label={null}>
      <h2 className={TITLE}>Akşam</h2>
      {next ? (
        <>
          <ModuleLine mod={mod} work={next.candidate} />
          <ChainLine text={chainLine} />
          <div className="flex items-center gap-3">
            <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
              <span data-testid="evening-next" className="text-heading font-semibold">
                {next.candidate.title}
              </span>
              <span className="text-ink-2 text-base tabular-nums">
                {formatMinutes(next.minutes)}
              </span>
            </p>
            <Button
              variant="primary"
              size="sm"
              className="h-11.5 px-5"
              onClick={() => start.mutate(sessionTargetOf(next.candidate))}
            >
              Başla
            </Button>
          </div>
        </>
      ) : null}
      {later ? (
        <p
          data-testid="evening-later"
          className="text-ink-2 text-note md:text-lead flex flex-wrap items-center gap-x-2 tabular-nums"
        >
          <span>
            Sırada: {later.assignment.candidate.title} · {formatTime(later.at)}
          </span>
          <button
            type="button"
            className="text-note text-ink min-h-touch link-quiet font-semibold"
            onClick={() => start.mutate(sessionTargetOf(later.assignment.candidate))}
          >
            Şimdi başla
          </button>
        </p>
      ) : null}
      <p data-testid="sleep-line" className="text-ink-2 text-note md:text-lead tabular-nums">
        {sleepLine(frame)}
      </p>
      {short ? (
        <p role="note" className="text-ink-2 text-note md:text-lead">
          {short}
        </p>
      ) : null}
      <CardActions className="mt-0.5">
        <Button
          variant="secondary"
          size="lg"
          className="max-md:w-full"
          onClick={() =>
            void askBed(now).then((yes) => {
              if (yes) bed.mutate({ date, at: now });
            })
          }
        >
          Yatıyorum
        </Button>
        {onClosing && !closed ? (
          <Button variant="secondary" size="lg" className="max-md:w-full" onClick={onClosing}>
            Kapanış
          </Button>
        ) : null}
      </CardActions>
      <div className="flex flex-wrap items-center gap-2">
        {change === null ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setChange("bed")}>
              Bu gece geç yatacağım
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setChange("wake")}>
              Yarın erken kalkacağım
            </Button>
          </>
        ) : (
          <>
            <span className="text-ink-2 text-note">
              {change === "bed" ? "Ne kadar geç?" : "Ne kadar erken?"}
            </span>
            {[30, 60, 90].map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (change === "bed") {
                    expected.mutate({
                      date,
                      bed: clock(new Date(frame.bed.getTime() + minutes * MINUTE)),
                    });
                  } else {
                    expected.mutate({
                      date: shiftDay(date, 1),
                      wake: clock(new Date(tonight.expectedWake.getTime() - minutes * MINUTE)),
                    });
                  }
                  setChange(null);
                }}
              >
                {minutes} dk
              </Button>
            ))}
            <Button variant="quiet" size="sm" onClick={() => setChange(null)}>
              Vazgeç
            </Button>
          </>
        )}
      </div>
    </CardFrame>
  );
}
