"use client";

import { GripVertical, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { ModuleContext, SceneChain } from "@/core/contract/types";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { useModule, useModuleChains } from "@/core/ui/module/ModuleProvider";
import { dayKey, shiftDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  deleteStep,
  insertStep,
  listRecords,
  listRoutines,
  listSteps,
  reorderSteps,
  updateStep,
} from "../queries";
import { proposeAll } from "../rules";
import {
  daysApart,
  formatSeconds,
  lastDoneDays,
  type Part,
  partsOf,
  type Routine,
  type RoutineKey,
  routineSeconds,
  type Step,
} from "../server/flow";

// The module page's body (docs/moduller/rutin.md, 8.6): the morning and the evening as tabs, each
// a numbered list in the scene's order, grouped by block; a step's sheet to edit it (name, length,
// frequency, basic, open, its sub-steps), to add one and to delete one. Every change proposes the
// routines again, so the rhythm's length follows the list; the scene reads the list as it is.
// The glass look of the drawings is step 3; here the core's own page language.

const GROUPS: Record<"sabah" | "aksam", { key: RoutineKey; label: string; context: string }[]> = {
  sabah: [
    { key: "sabah", label: "SABAH", context: "uyanışta" },
    { key: "hazirlik", label: "DUŞ VE HAZIRLIK", context: "hareketlerden sonra" },
  ],
  aksam: [{ key: "aksam", label: "AKŞAM KAPANIŞI", context: "yatmadan önce" }],
};

const WHERE: { key: RoutineKey; label: string }[] = [
  { key: "sabah", label: "Sabah" },
  { key: "hazirlik", label: "Hazırlık" },
  { key: "aksam", label: "Akşam" },
];

export function MorningTab() {
  return <StepsTab facet="sabah" />;
}

export function EveningTab() {
  return <StepsTab facet="aksam" />;
}

type Data = {
  routines: Routine[];
  steps: Step[];
  lastDone: Map<string, string>;
  /** This module's rhythm -> its routine (the chain names rhythms). */
  rhythms: { id: string; routineId: string | null }[];
};

function useList() {
  const { row } = useModule();
  return useModuleQuery(row, ["list"], async (ctx): Promise<Data> => {
    const today = dayKey(ctx.now());
    const [routines, steps, records, rhythms] = await Promise.all([
      listRoutines(ctx),
      listSteps(ctx),
      listRecords(ctx, shiftDay(today, -370)),
      ctx.work.rhythms(),
    ]);
    return {
      routines,
      steps,
      lastDone: lastDoneDays(records),
      rhythms: rhythms.map(({ rhythm }) => ({ id: rhythm.id, routineId: rhythm.source_id })),
    };
  });
}

/** Writes, then proposes the routines again (their length) and refreshes every screen. */
function useWrite() {
  const { ctx } = useModule();
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  return async (write: (ctx: ModuleContext) => Promise<unknown>) => {
    try {
      await write(ctx);
      await proposeAll(ctx);
      await refreshAll();
      return true;
    } catch {
      notify(SAVE_FAILED);
      await refreshAll();
      return false;
    }
  };
}

type Own = {
  kind: "own";
  group: (typeof GROUPS)["sabah"][number];
  routine: Routine;
  mains: Step[];
};
type Section = Own | { kind: "other"; item: SceneChain["items"][number] };

/**
 * The tab's blocks in the scene's order (Ç3g): today's chain on the tab's anchor, this module's
 * routines as their groups and every other module's work as a group of its own (read only, from
 * `useModuleChains`); routines the chain does not hold today come after, in their own order.
 */
function sectionsOf(
  own: Own[],
  chain: SceneChain | null,
  routineOf: (rhythmId: string) => string | null,
): Section[] {
  const placed = new Set<string>();
  const sections: Section[] = [];
  for (const item of chain?.items ?? []) {
    if (!item.mine) {
      sections.push({ kind: "other", item });
      continue;
    }
    const section = own.find((row) => row.routine.id === routineOf(item.id));
    if (section && !placed.has(section.routine.id)) {
      placed.add(section.routine.id);
      sections.push(section);
    }
  }
  for (const section of own) if (!placed.has(section.routine.id)) sections.push(section);
  return sections;
}

function StepsTab({ facet }: { facet: "sabah" | "aksam" }) {
  const list = useList();
  const chains = useModuleChains();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const editing = params.get("adim");
  const adding = params.get("ekle");
  const close = () => router.replace(pathname);
  const open = (query: string) => router.push(`${pathname}?${query}`);

  if (list.isLoading || !list.data) return null;
  const { routines, steps } = list.data;
  if (routines.length === 0) {
    return <p className="text-muted-foreground text-sm">Liste, modül etkinleştirilince yazılır.</p>;
  }
  const step = editing ? steps.find((row) => row.id === editing) : undefined;
  const mainsOf = (routine: Routine) =>
    steps
      .filter((row) => row.routine_id === routine.id && row.parent_id === null)
      .sort((a, b) => a.position - b.position);
  const counted = (list: Step[]) => list.filter((row) => row.active && row.kind === "tap").length;
  // The list is numbered across the tab's blocks, as the scene goes through them.
  const own: Own[] = GROUPS[facet].flatMap((group) => {
    const routine = routines.find((row) => row.key === group.key);
    return routine ? [{ kind: "own" as const, group, routine, mains: mainsOf(routine) }] : [];
  });
  const sections = sectionsOf(
    own,
    facet === "sabah" ? chains.wake : chains.bed,
    (id) => list.data.rhythms.find((row) => row.id === id)?.routineId ?? null,
  );
  const size = (section: Section) => (section.kind === "own" ? counted(section.mains) : 1);
  const starts = sections.map((_, index) =>
    sections.slice(0, index).reduce((sum, row) => sum + size(row), 0),
  );
  return (
    <div className="flex flex-col gap-5" data-testid={`rutin-${facet}`}>
      {sections.map((section, index) =>
        section.kind === "own" ? (
          <StepGroup
            key={section.group.key}
            label={section.group.label}
            context={`${section.group.context} · toplam ${formatSeconds(
              routineSeconds(steps, section.routine.id),
            )}`}
            routine={section.routine}
            mains={section.mains}
            steps={steps}
            first={starts[index]}
            lastDone={list.data.lastDone}
            facet={facet}
            onOpen={(id) => open(`adim=${id}`)}
          />
        ) : (
          <OtherGroup key={section.item.id} item={section.item} number={starts[index] + 1} />
        ),
      )}
      {facet === "aksam" ? (
        <section className="border-border rounded-2xl border px-4 py-3 text-sm">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider">
            YATAKTA · KAYDEDİLMEZ
          </p>
          <p className="mt-1">
            Işık kapalı. &quot;Yatıyorum&quot;dan sonraki ekranda hatırlatılır.
          </p>
        </section>
      ) : null}
      {step ? (
        <StepSheet key={step.id} step={step} data={list.data} onClose={close} />
      ) : adding ? (
        <StepSheet
          key={`new-${adding}`}
          step={null}
          data={list.data}
          initialWhere={(WHERE.find((row) => row.key === adding)?.key ?? facet) as RoutineKey}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/** "3 dk · 4 alt adım · her gün", "Dercos · duşun eki · 3 günde bir · sıradaki yarın". */
function summaryOf(step: Step, steps: Step[], lastDone: Map<string, string>): string {
  const parts = partsOf(step);
  const bits: string[] = [];
  const parent = step.parent_id ? steps.find((row) => row.id === step.parent_id) : null;
  if (parent) bits.push(`${parent.title.toLocaleLowerCase("tr")} eki`);
  if (step.kind === "closing") bits.push("çekirdeğin kapanışına geçer");
  if (step.seconds > 0) bits.push(formatSeconds(step.seconds));
  if (parts.length > 0) bits.push(`${parts.length} alt adım`);
  if (step.every_days && step.every_days > 1) {
    bits.push(`${step.every_days} günde bir`);
    const last = lastDone.get(step.id);
    if (step.active && last) {
      const left = step.every_days - daysApart(last, dayKey(new Date()));
      bits.push(left <= 0 ? "sıradaki bugün" : left === 1 ? "sıradaki yarın" : `${left} gün sonra`);
    }
  } else if (!parent && step.kind === "tap") bits.push("her gün");
  if (!step.active && step.phase && step.phase > 1) bits.push(`faz ${step.phase}`);
  if (!step.active) bits.push("kapalı");
  return bits.join(" · ");
}

function StepGroup({
  label,
  context,
  mains,
  steps,
  first,
  lastDone,
  facet,
  onOpen,
}: {
  label: string;
  context: string;
  routine: Routine;
  mains: Step[];
  steps: Step[];
  first: number;
  lastDone: Map<string, string>;
  facet: "sabah" | "aksam";
  onOpen: (id: string) => void;
}) {
  const write = useWrite();
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = order ?? mains.map((row) => row.id);
  const rows = ids.map((id) => mains.find((row) => row.id === id)).filter(Boolean) as Step[];
  const drag = useRef<{ id: string; y: number; heights: number[] } | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  const onHandleDown = (id: string) => (event: ReactPointerEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const heights = Array.from(listRef.current?.children ?? []).map(
      (child) => (child as HTMLElement).getBoundingClientRect().height,
    );
    drag.current = { id, y: event.clientY, heights };
    setOrder(mains.map((row) => row.id));
  };
  const onHandleMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || !order) return;
    const index = order.indexOf(state.id);
    const delta = event.clientY - state.y;
    const step = state.heights[index] ?? 54;
    if (delta > step * 0.6 && index < order.length - 1) {
      const next = [...order];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      state.y += state.heights[index + 1] ?? step;
      setOrder(next);
    } else if (delta < -step * 0.6 && index > 0) {
      const next = [...order];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      state.y -= state.heights[index - 1] ?? step;
      setOrder(next);
    }
  };
  const onHandleUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state || !order) return;
    const changed = order.some((id, index) => id !== mains[index]?.id);
    if (!changed) return setOrder(null);
    void write((ctx) => reorderSteps(ctx, order)).then(() => setOrder(null));
  };

  const numbers = new Map<string, string>();
  rows
    .filter((row) => row.active && row.kind === "tap")
    .forEach((row, index) => numbers.set(row.id, String(first + index + 1)));
  return (
    <section aria-label={label} className="border-border overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: facet === "aksam" ? "#aab6ff" : "#ffd58a" }}
        />
        <span className="text-xs font-semibold tracking-wider">{label}</span>
        <span className="text-muted-foreground ml-auto text-[13px]">{context}</span>
      </div>
      <ol ref={listRef} className="flex flex-col">
        {rows.map((step) => {
          const addOns = steps
            .filter((row) => row.parent_id === step.id)
            .sort((a, b) => a.position - b.position);
          return (
            <li key={step.id} data-step={step.title}>
              <StepRow
                step={step}
                number={numbers.get(step.id) ?? "–"}
                summary={summaryOf(step, steps, lastDone)}
                facet={facet}
                onOpen={() => onOpen(step.id)}
                handle={
                  <button
                    type="button"
                    aria-label={`${step.title}: sürükleyerek sırala`}
                    className="text-muted-foreground flex size-11 shrink-0 cursor-grab touch-none items-center justify-center"
                    onPointerDown={onHandleDown(step.id)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                  >
                    <GripVertical size={18} aria-hidden />
                  </button>
                }
              />
              {addOns.map((addOn) => (
                <StepRow
                  key={addOn.id}
                  step={addOn}
                  number="+"
                  summary={summaryOf(addOn, steps, lastDone)}
                  facet={facet}
                  indent
                  onOpen={() => onOpen(addOn.id)}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Another module's work in the morning (or the evening): its own group, one row, no switch; it is
 * edited on that module's page (degerler.md, section 8: "Spor modülünden gelir, orada düzenlenir").
 */
function OtherGroup({ item, number }: { item: SceneChain["items"][number]; number: number }) {
  const label = (item.facet?.name ?? item.title).toLocaleUpperCase("tr");
  return (
    <section
      aria-label={label}
      data-testid="rutin-other-group"
      className="border-border overflow-hidden rounded-2xl border"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-xs font-semibold tracking-wider">{label}</span>
        <span className="text-muted-foreground ml-auto text-[13px]">
          {item.module.name} modülü · toplam {item.minutes} dk
        </span>
      </div>
      <Link
        href={`/m/${item.module.slug}`}
        className="border-border flex min-h-[54px] items-center gap-2 border-t pr-4 pl-1"
        data-testid="rutin-other-row"
      >
        <span className="w-2" />
        <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums">
          {number}
        </span>
        <span className="flex min-w-0 flex-1 flex-col py-2">
          <span className="truncate text-[15px] font-semibold">{item.title}</span>
          <span className="text-muted-foreground truncate text-[13px]">
            {item.module.name} modülünden gelir, orada düzenlenir
          </span>
        </span>
        <span className="text-muted-foreground shrink-0 text-sm">{item.module.name} ›</span>
      </Link>
    </section>
  );
}

function StepRow({
  step,
  number,
  summary,
  facet,
  indent = false,
  handle,
  onOpen,
}: {
  step: Step;
  number: string;
  summary: string;
  facet: "sabah" | "aksam";
  indent?: boolean;
  handle?: ReactNode;
  onOpen: () => void;
}) {
  const write = useWrite();
  // Shown at once; the stored value takes over when it comes back (or when the write fails).
  const [pending, setPending] = useState<{ value: boolean; base: string } | null>(null);
  const active = pending && pending.base === step.updated_at ? pending.value : step.active;
  const setActive = (value: boolean) => setPending({ value, base: step.updated_at });
  return (
    <div
      className={cn(
        "border-border flex min-h-[54px] items-center gap-2 border-t pr-2",
        indent ? "pl-[30px]" : "pl-1",
        !active && "opacity-60",
      )}
      data-testid="rutin-step-row"
      data-active={active ? "true" : "false"}
    >
      {handle ?? <span className="w-2" />}
      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums">{number}</span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{step.title}</span>
          {step.minimum ? (
            <span
              className="rounded-[10px] border px-[9px] py-[3px] text-xs"
              style={
                facet === "aksam"
                  ? { borderColor: "rgba(170,182,255,0.5)", background: "rgba(170,182,255,0.2)" }
                  : { borderColor: "rgba(255,213,138,0.45)", background: "rgba(255,213,138,0.2)" }
              }
            >
              temel
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground truncate text-[13px]">{summary}</span>
      </button>
      <Switch
        label={`${step.title} açık`}
        checked={active}
        onChange={(next) => {
          setActive(next);
          void write((ctx) => updateStep(ctx, step.id, { active: next })).then((ok) => {
            if (!ok) setPending(null);
          });
        }}
      />
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "relative h-6 w-[42px] rounded-xl transition-colors motion-reduce:transition-none",
          checked ? "bg-foreground" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[18px] rounded-full transition-[left] motion-reduce:transition-none",
            checked ? "bg-background left-[21px]" : "bg-muted-foreground left-[3px]",
          )}
        />
      </span>
    </button>
  );
}

// --- The step's sheet ------------------------------------------------------------------------------

type Draft = {
  title: string;
  seconds: number;
  secondsAuto: boolean;
  everyDays: number | null;
  minimum: boolean;
  active: boolean;
  parts: Part[];
  where: RoutineKey;
  position: "end" | number;
  parentId: string | null;
};

const draftOf = (step: Step | null, where: RoutineKey): Draft => ({
  title: step?.title ?? "",
  seconds: step?.seconds ?? 60,
  secondsAuto: step?.seconds_auto ?? true,
  everyDays: step?.every_days && step.every_days > 1 ? step.every_days : null,
  minimum: step?.minimum ?? false,
  active: step?.active ?? true,
  parts: step ? partsOf(step) : [],
  where,
  position: "end",
  parentId: step?.parent_id ?? null,
});

function StepSheet({
  step,
  data,
  initialWhere = "sabah",
  onClose,
}: {
  step: Step | null;
  data: Data;
  initialWhere?: RoutineKey;
  onClose: () => void;
}) {
  const write = useWrite();
  const routineKey = step
    ? ((data.routines.find((row) => row.id === step.routine_id)?.key as RoutineKey) ?? "sabah")
    : initialWhere;
  const [draft, setDraft] = useState<Draft>(() => draftOf(step, routineKey));
  const [partOpen, setPartOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const routine = data.routines.find((row) => row.key === draft.where);
  const siblings = data.steps
    .filter(
      (row) => row.routine_id === routine?.id && row.parent_id === null && row.id !== step?.id,
    )
    .sort((a, b) => a.position - b.position);
  const addOn = draft.parentId !== null;
  const number = step
    ? siblings.filter((row) => row.position < step.position).length + 1
    : siblings.length + 1;
  const heading = `${WHERE.find((row) => row.key === routineKey)?.label.toLocaleUpperCase("tr")} · ${
    step ? (addOn ? "EK" : `ADIM ${number}`) : "YENİ ADIM"
  }`;

  const save = async () => {
    if (draft.title.trim() === "" || !routine) return;
    setBusy(true);
    const fields = {
      title: draft.title.trim(),
      seconds: draft.seconds,
      seconds_auto: draft.secondsAuto,
      every_days: draft.everyDays,
      minimum: draft.minimum,
      active: draft.active,
      parts: draft.parts,
      parent_id: draft.parentId,
    };
    const ok = await write(async (ctx) => {
      if (step) return updateStep(ctx, step.id, fields);
      const created = await insertStep(ctx, {
        ...fields,
        routine_id: routine.id,
        position: siblings.length,
      });
      if (draft.position !== "end") {
        const ids = siblings.map((row) => row.id);
        ids.splice(Math.max(0, draft.position - 1), 0, created.id);
        await reorderSteps(ctx, ids);
      }
      return created;
    });
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async (how: "delete" | "close") => {
    if (!step) return;
    setBusy(true);
    const ok = await write((ctx) =>
      how === "delete" ? deleteStep(ctx, step.id) : updateStep(ctx, step.id, { active: false }),
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet onClose={onClose} label={step ? "Adımı düzenle" : "Adım ekle"}>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider">
          {heading}
        </span>
        <span className="flex-1" />
        {step ? (
          <button
            type="button"
            className="text-muted-foreground min-h-11 text-[15px]"
            onClick={() => setConfirm(true)}
          >
            Adımı sil
          </button>
        ) : null}
        <button type="button" className="min-h-11 text-[15px] font-semibold" onClick={onClose}>
          Vazgeç
        </button>
      </div>
      <Input
        aria-label="Adımın adı"
        value={draft.title}
        maxLength={80}
        onChange={(event) => set({ title: event.target.value })}
        className="h-[54px] rounded-[18px] text-xl font-semibold"
        placeholder="Adım"
      />
      <Group>
        {!step ? (
          <Row label="Nereye">
            <Choice
              options={WHERE.map((row) => ({ value: row.key, label: row.label }))}
              value={draft.where}
              onChange={(value) => set({ where: value as RoutineKey, position: "end" })}
            />
          </Row>
        ) : null}
        {!step ? (
          <Row label="Sırası">
            <select
              aria-label="Sırası"
              className="bg-background h-9 rounded-lg border px-2 text-sm"
              value={String(draft.position)}
              onChange={(event) =>
                set({ position: event.target.value === "end" ? "end" : Number(event.target.value) })
              }
            >
              <option value="end">Sona</option>
              {siblings.map((row, index) => (
                <option key={row.id} value={index + 1}>
                  {index + 1}. sıraya ({row.title} önüne)
                </option>
              ))}
            </select>
          </Row>
        ) : null}
        {addOn ? (
          <Row label="Şunun eki">
            <select
              aria-label="Şunun eki"
              className="bg-background h-9 rounded-lg border px-2 text-sm"
              value={draft.parentId ?? ""}
              onChange={(event) => set({ parentId: event.target.value })}
            >
              {siblings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </Row>
        ) : null}
        <Row label={draft.secondsAuto ? "Süre · otomatik" : "Süre · elle"}>
          <Stepper
            label="Süre"
            text={draft.seconds === 0 ? "süresiz" : formatSeconds(draft.seconds)}
            onMinus={() =>
              set({
                seconds: Math.max(0, draft.seconds - (draft.seconds > 60 ? 60 : 15)),
                secondsAuto: false,
              })
            }
            onPlus={() =>
              set({
                seconds: Math.min(10800, draft.seconds + (draft.seconds >= 60 ? 60 : 15)),
                secondsAuto: false,
              })
            }
          />
        </Row>
        {!draft.secondsAuto ? (
          <Row label="">
            <button
              type="button"
              className="min-h-11 text-sm underline underline-offset-4"
              onClick={() => set({ secondsAuto: true })}
            >
              Otomatiğe dön
            </button>
          </Row>
        ) : null}
        <Row label="Sıklık">
          <Choice
            options={[
              { value: "daily", label: "Her gün" },
              { value: "every", label: "N günde bir" },
            ]}
            value={draft.everyDays ? "every" : "daily"}
            onChange={(value) =>
              set({ everyDays: value === "every" ? (draft.everyDays ?? 2) : null })
            }
          />
        </Row>
        {draft.everyDays ? (
          <Row label="Kaç günde bir">
            <Stepper
              label="Kaç günde bir"
              text={`${draft.everyDays} gün`}
              onMinus={() => set({ everyDays: Math.max(2, (draft.everyDays ?? 2) - 1) })}
              onPlus={() => set({ everyDays: Math.min(365, (draft.everyDays ?? 2) + 1) })}
            />
          </Row>
        ) : null}
        <Row label="Temel adım">
          <Switch
            label="Temel adım"
            checked={draft.minimum}
            onChange={(minimum) => set({ minimum })}
          />
        </Row>
        <Row label="Açık">
          <Switch label="Açık" checked={draft.active} onChange={(active) => set({ active })} />
        </Row>
      </Group>
      {!addOn ? (
        <Parts
          parts={draft.parts}
          onChange={(parts) => set({ parts })}
          onTime={(index) => setPartOpen(index)}
        />
      ) : null}
      <Button
        className="h-14 rounded-[28px] text-[17px]"
        disabled={busy || draft.title.trim() === ""}
        onClick={() => void save()}
      >
        {step ? "Kaydet" : "Ekle"}
      </Button>
      {partOpen !== null && draft.parts[partOpen] ? (
        <PartTime
          part={draft.parts[partOpen]}
          onClose={() => setPartOpen(null)}
          onDone={(part) => {
            set({ parts: draft.parts.map((row, index) => (index === partOpen ? part : row)) });
            setPartOpen(null);
          }}
        />
      ) : null}
      {confirm && step ? (
        <Overlay onClose={() => setConfirm(false)} label="Adımı sil">
          <p className="text-[19px] font-semibold">{step.title} silinsin mi?</p>
          <p className="text-muted-foreground text-[15px]">
            Geçmiş kayıtlar kalır. Yalnızca bir süre yapmayacaksan kapatman yeterli.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-[50px] flex-1 rounded-[25px]"
              disabled={busy}
              onClick={() => void remove("close")}
            >
              Kapat
            </Button>
            <Button
              className="h-[50px] flex-1 rounded-[25px]"
              disabled={busy}
              onClick={() => void remove("delete")}
            >
              Sil
            </Button>
          </div>
          <button type="button" className="min-h-11 text-[15px]" onClick={() => setConfirm(false)}>
            Vazgeç
          </button>
        </Overlay>
      ) : null}
    </Sheet>
  );
}

/** The sub-steps: rename by touching the name, the time pill, ×, "+ Alt adım ekle", drag to order. */
function Parts({
  parts,
  onChange,
  onTime,
}: {
  parts: Part[];
  onChange: (parts: Part[]) => void;
  onTime: (index: number) => void;
}) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const dragging = useRef<{ index: number; y: number } | null>(null);
  const move = (from: number, to: number) => {
    const next = [...parts];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };
  return (
    <section aria-label="Alt adımlar" className="flex flex-col">
      <p className="text-muted-foreground px-1 pb-1 text-xs font-semibold tracking-wider">
        ALT ADIMLAR
      </p>
      <Group>
        {parts.map((part, index) => (
          <div
            key={index}
            className="flex min-h-[46px] items-center gap-2"
            data-testid="rutin-part-row"
          >
            <button
              type="button"
              aria-label={`${part.title}: sürükleyerek sırala`}
              className="text-muted-foreground flex size-9 shrink-0 cursor-grab touch-none items-center justify-center"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                dragging.current = { index, y: event.clientY };
              }}
              onPointerMove={(event) => {
                const state = dragging.current;
                if (!state) return;
                const delta = event.clientY - state.y;
                if (delta > 30 && state.index < parts.length - 1) {
                  move(state.index, state.index + 1);
                  dragging.current = { index: state.index + 1, y: state.y + 46 };
                } else if (delta < -30 && state.index > 0) {
                  move(state.index, state.index - 1);
                  dragging.current = { index: state.index - 1, y: state.y - 46 };
                }
              }}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
            >
              <GripVertical size={16} aria-hidden />
            </button>
            {renaming === index ? (
              <Input
                autoFocus
                aria-label="Alt adımın adı"
                defaultValue={part.title}
                className="h-9 flex-1"
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title)
                    onChange(parts.map((row, i) => (i === index ? { ...row, title } : row)));
                  setRenaming(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[15px] font-medium"
                onClick={() => setRenaming(index)}
              >
                {part.title}
              </button>
            )}
            <button
              type="button"
              onClick={() => onTime(index)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-xs",
                part.seconds ? "bg-muted" : "border border-dashed",
              )}
            >
              {part.seconds
                ? `${formatSeconds(part.seconds)}${part.timer ? " · sayaç" : ""}`
                : "süre ekle"}
            </button>
            <button
              type="button"
              aria-label={`${part.title}: çıkar`}
              className="bg-muted flex size-[30px] shrink-0 items-center justify-center rounded-full"
              onClick={() => onChange(parts.filter((_, i) => i !== index))}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="min-h-11 text-left text-[15px] font-semibold"
          onClick={() => {
            onChange([...parts, { title: "Yeni alt adım" }]);
            setRenaming(parts.length);
          }}
        >
          + Alt adım ekle
        </button>
      </Group>
    </section>
  );
}

function PartTime({
  part,
  onClose,
  onDone,
}: {
  part: Part;
  onClose: () => void;
  onDone: (part: Part) => void;
}) {
  const [seconds, setSeconds] = useState(part.seconds ?? 60);
  const [timer, setTimer] = useState(part.timer ?? true);
  const [hold, setHold] = useState(part.hold ?? true);
  const [note, setNote] = useState(part.note ?? "");
  const [title, setTitle] = useState(part.title);
  const done = (withTime: boolean) =>
    onDone({
      title: title.trim() || part.title,
      note: note.trim() || null,
      ...(withTime ? { seconds, timer, hold } : {}),
    });
  return (
    <Overlay onClose={onClose} label="Alt adımın süresi">
      <Input
        aria-label="Alt adımın adı"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-12 text-lg font-semibold"
      />
      <Group>
        <Row label="Süre">
          <Stepper
            label="Alt adımın süresi"
            text={formatSeconds(seconds)}
            onMinus={() => setSeconds(Math.max(5, seconds - (seconds > 60 ? 30 : 5)))}
            onPlus={() => setSeconds(Math.min(3600, seconds + (seconds >= 60 ? 30 : 5)))}
          />
        </Row>
        <Row label="Sayaç göster">
          <Switch label="Sayaç göster" checked={timer} onChange={setTimer} />
        </Row>
        <Row label="Süre dolmadan geçme">
          <Switch label="Süre dolmadan geçme" checked={hold} onChange={setHold} />
        </Row>
        <Row label="Not">
          <Input
            aria-label="Not"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 max-w-56"
          />
        </Row>
      </Group>
      <p className="text-muted-foreground text-[13px]">
        Süre bitince kendiliğinden sıradakine geçer ve adını söyler. Erken geçmek için düğmeye
        basılı tutarsın.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-[50px] flex-1 rounded-[25px]"
          onClick={() => done(false)}
        >
          Süreyi kaldır
        </Button>
        <Button className="h-[50px] flex-1 rounded-[25px]" onClick={() => done(true)}>
          Tamam
        </Button>
      </div>
    </Overlay>
  );
}

// --- Small pieces ------------------------------------------------------------------------------

function Sheet({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-[rgba(4,6,20,0.45)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="bg-card text-card-foreground absolute inset-x-2 bottom-2 flex max-h-[92dvh] flex-col gap-2.5 overflow-y-auto rounded-[34px] border px-3.5 pt-2.5 pb-[18px] shadow-2xl md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:w-[440px] md:rounded-[30px]"
      >
        <span
          aria-hidden
          className="mx-auto h-[5px] w-10 shrink-0 rounded-[3px] bg-current opacity-40 md:hidden"
        />
        {children}
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-[rgba(4,6,20,0.4)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="bg-card text-card-foreground absolute inset-x-7 top-[30%] mx-auto flex max-w-md flex-col gap-3 rounded-[28px] border px-3.5 py-4 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

function useEscape(onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && ref.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 flex flex-col rounded-[20px] border px-3.5 py-1">{children}</div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3">
      <span className="text-muted-foreground text-[15px]">{label}</span>
      {children}
    </div>
  );
}

function Stepper({
  label,
  text,
  onMinus,
  onPlus,
}: {
  label: string;
  text: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const round: CSSProperties = { width: 32, height: 32 };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`${label}: azalt`}
        onClick={onMinus}
        className="bg-muted flex items-center justify-center rounded-full"
        style={round}
      >
        <Minus size={16} aria-hidden />
      </button>
      <span
        className="min-w-14 text-center text-base font-semibold tabular-nums"
        data-testid={`stepper-${label}`}
      >
        {text}
      </span>
      <button
        type="button"
        aria-label={`${label}: artır`}
        onClick={onPlus}
        className="bg-muted flex items-center justify-center rounded-full"
        style={round}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}

function Choice({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" className="bg-muted flex rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 rounded-full px-3 text-sm",
            option.value === value && "bg-foreground text-background font-semibold",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
