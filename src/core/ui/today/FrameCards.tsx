"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStartSession } from "@/core/app/actions";
import { useRecordBed, useRecordWake, useSetExpected } from "@/core/app/frame-actions";
import { useColors } from "@/core/app/facets";
import type { KnownModule } from "@/core/app/hooks";
import type { Assignment, DayFrame, SleepPlan, TodayBriefLine } from "./frame-text";
import { sleepLine, shortLine } from "./frame-text";
import { formatTime, shiftDay } from "@/lib/date";
import { sessionTargetOf } from "./NowCard";

// The day's frame on the card (docs/05-arayuz.md, "Günün çerçevesi"; Ç3c): "Günaydın" with
// "Uyandım", the evening with tonight's bed and tomorrow's waking, and the two one-day changes.

/** The work's module (and facet), with a dot in the work's colour (Ç3e). */
function WorkModule({ mod, candidate }: { mod: KnownModule; candidate: Assignment["candidate"] }) {
  const colors = useColors();
  const facet = colors.facetOf(mod.row.id, candidate);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        data-testid="work-dot"
        className="size-2 rounded-full"
        style={{ backgroundColor: colors.of(mod.row.id, candidate) }}
      />
      {facet ? `${mod.row.name} · ${facet.name}` : mod.row.name}
    </span>
  );
}

const TITLE = "text-3xl leading-tight font-semibold tracking-tight md:text-5xl";
const BIG = "h-12 px-6 text-base";
const SECOND = "h-12 px-5 text-base";
const SMALL = "h-11 px-3 text-sm md:h-9";

const MINUTE = 60_000;
const clock = (instant: Date) => formatTime(instant);

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label="Şimdi"
      className="border-border bg-card flex min-h-56 flex-col justify-between gap-6 rounded-2xl border p-6 md:min-h-72 md:p-8"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{label}</p>
      {children}
    </section>
  );
}

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
  return (
    <Frame label="Günaydın">
      <div className="flex flex-col gap-3">
        <h2 className={TITLE}>Günaydın</h2>
        <ul
          aria-label="Bugünün özeti"
          className="text-muted-foreground flex flex-col gap-1 md:text-lg"
        >
          {brief.top.length > 0 ? <li>Günün işleri: {brief.top.join(", ")}</li> : null}
          {brief.firstBlock ? <li>İlk blok: {brief.firstBlock}</li> : null}
          <li>Bitiş {brief.finishLine}</li>
          {first ? (
            <li>
              Önce: {first.candidate.title}
              {modules.get(first.candidate.moduleId) ? (
                <>
                  {" · "}
                  <WorkModule
                    mod={modules.get(first.candidate.moduleId)!}
                    candidate={first.candidate}
                  />
                </>
              ) : null}
            </li>
          ) : null}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button className={BIG} data-wake-action onClick={() => woke(now)}>
          Uyandım
        </Button>
        {earlier ? (
          [15, 30, 60].map((minutes) => (
            <Button
              key={minutes}
              variant="outline"
              className={SECOND}
              data-wake-action
              onClick={() => woke(new Date(now.getTime() - minutes * MINUTE))}
            >
              {minutes} dk önce
            </Button>
          ))
        ) : (
          <Button
            variant="ghost"
            className={SECOND}
            data-wake-action
            onClick={() => setEarlier(true)}
          >
            Biraz önce
          </Button>
        )}
      </div>
    </Frame>
  );
}

/**
 * The evening: the evening's next work, tonight's bed with tomorrow's waking and the sleep
 * between them, "Yatıyorum", "Günü kapat", and the two one-day changes.
 */
export function EveningCard({
  date,
  now,
  frame,
  next,
  closed,
  modules,
}: {
  date: string;
  now: Date;
  frame: DayFrame;
  next: Assignment | null;
  closed: boolean;
  modules: Map<string, KnownModule>;
}) {
  const bed = useRecordBed();
  const expected = useSetExpected();
  const start = useStartSession();
  const [change, setChange] = useState<"bed" | "wake" | null>(null);
  const tonight: SleepPlan = frame.tonight;
  const mod = next ? modules.get(next.candidate.moduleId) : undefined;
  const short = shortLine(tonight);
  return (
    <Frame label="Akşam">
      <div className="flex flex-col gap-3">
        {next ? (
          <div className="flex flex-col gap-1">
            {mod ? (
              <p className="text-muted-foreground text-sm">
                <WorkModule mod={mod} candidate={next.candidate} />
              </p>
            ) : null}
            <h2 className={TITLE}>{next.candidate.title}</h2>
          </div>
        ) : (
          <h2 className={TITLE}>Akşam</h2>
        )}
        <p data-testid="sleep-line" className="tabular-nums md:text-lg">
          {sleepLine(frame)}
        </p>
        {short ? (
          <p role="note" className="text-muted-foreground md:text-lg">
            {short}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Button className={BIG} onClick={() => start.mutate(sessionTargetOf(next.candidate))}>
              Başla
            </Button>
          ) : null}
          <Button
            className={next ? SECOND : BIG}
            variant={next ? "outline" : "default"}
            onClick={() => bed.mutate({ date, at: now })}
          >
            Yatıyorum
          </Button>
          {closed ? null : (
            <Link
              href="/kapanis"
              className="border-border hover:bg-muted flex h-12 items-center rounded-lg border px-5 text-base"
            >
              Günü kapat
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {change === null ? (
            <>
              <Button variant="ghost" className={SMALL} onClick={() => setChange("bed")}>
                Bu gece geç yatacağım
              </Button>
              <Button variant="ghost" className={SMALL} onClick={() => setChange("wake")}>
                Yarın erken kalkacağım
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">
                {change === "bed" ? "Ne kadar geç?" : "Ne kadar erken?"}
              </span>
              {[30, 60, 90].map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  className={SMALL}
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
              <Button variant="ghost" className={SMALL} onClick={() => setChange(null)}>
                Vazgeç
              </Button>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}
