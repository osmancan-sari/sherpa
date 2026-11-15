"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Component, type ReactNode, useMemo } from "react";
import { type KnownModule, useModuleQuery, useModules, useNow } from "@/core/app/hooks";
import { moduleColor } from "@/core/contract/colors";
import type { ChipData, ModuleAreaView, ModuleReport } from "@/core/contract/types";
import { dayKey, shiftDay, weekStart } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { Panel, PanelLabel } from "../kit/Panel";
import { ConnectionPill } from "../look/Connection";
import { PageShell } from "../PageShell";
import { useLayoutDevice } from "../sky/Backdrop";
import { ModuleProvider } from "./ModuleProvider";

// The area's page (/a/<area>; docs/tasarim/ekranlar/moduller.md, "Alan sayfası"; frames MT7, MT8,
// MP4; Ç4c): only its shell. The area's name and members; a panel per member module (its state
// line, the week's numbers, a link to it); below them the views the members give the page
// (`ui.areaViews`), each with its source at its right. The page's metrics are designed later
// (13 Kas 2026): no score is drawn here.

export function AreaScreen() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  return (
    <ClientOnly>
      <AreaBody slug={slug} />
    </ClientOnly>
  );
}

function AreaBody({ slug }: { slug: string }) {
  const { modules, isLoading } = useModules();
  const board = useLayoutDevice() === "pano";
  const members = modules.filter(
    ({ row, definition }) =>
      definition?.area?.slug === slug && (row.status === "active" || row.status === "paused"),
  );
  if (isLoading) return null;
  const name = members[0]?.definition?.area?.name;
  if (!name) {
    return (
      <PageShell title="Alan" width="read" back={{ href: "/m", label: "Modüller" }}>
        <Panel variant="dense" className="items-start gap-3 p-4 md:p-4.5">
          <p className="text-base">Böyle bir alan yok.</p>
          <Link
            href="/m"
            className="link-quiet text-note min-h-touch inline-flex w-fit items-center font-semibold"
          >
            Modüller
          </Link>
        </Panel>
      </PageShell>
    );
  }
  const ordered = [
    ...members.filter(({ row }) => row.status === "active"),
    ...members.filter(({ row }) => row.status === "paused"),
  ];
  const views = ordered
    .filter(({ row }) => row.status === "active")
    .flatMap((mod) => (mod.definition?.ui.areaViews ?? []).map((view) => ({ mod, view })));

  return (
    <div className="flex w-full flex-1 flex-col gap-3.5 px-4 pt-4.5 pb-6 md:gap-4 md:px-10 md:pt-6">
      <header className="flex flex-col gap-0.5 px-1 md:flex-row md:items-baseline md:gap-3.5 md:px-0">
        <div className="flex items-center gap-2">
          <Link
            href="/m"
            aria-label="Modüller"
            className="size-touch focus-visible:shadow-focus -my-2.5 -mr-1 -ml-2.5 flex shrink-0 items-center justify-center rounded-full outline-none md:hidden"
          >
            <ChevronLeft aria-hidden className="size-5.5" />
          </Link>
          <h1 className="text-title tracking-title font-bold md:text-3xl">{name}</h1>
          <span className="ml-auto md:hidden">
            <ConnectionPill />
          </span>
        </div>
        <p data-testid="area-members" className="text-ink-2 text-note md:text-lead">
          Alan · {ordered.map(({ row }) => row.name).join(", ")}
        </p>
        <span className="ml-auto max-md:hidden">
          <ConnectionPill />
        </span>
      </header>

      <ul aria-label="Üyeler" className="grid items-start gap-3.5 md:grid-cols-3 md:gap-4">
        {ordered.map((mod) => (
          <li key={mod.row.id} className="min-w-0">
            <MemberPanel mod={mod} />
          </li>
        ))}
      </ul>

      {views.length > 0 ? (
        <div className="grid items-start gap-3.5 md:grid-cols-12 md:gap-4">
          {views.map(({ mod, view }) => (
            <AreaViewPanel
              key={`${mod.row.slug}-${view.key}`}
              mod={mod}
              view={view}
              device={board ? "pano" : "telefon"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A member: its colour, name and state line, the week's numbers; a touch goes to its page. */
function MemberPanel({ mod }: { mod: KnownModule }) {
  const now = useNow();
  const week = useMemo(() => {
    const from = weekStart(dayKey(now));
    return { from, to: shiftDay(from, 6) };
  }, [now]);
  const chip = useModuleQuery<ChipData | null>(mod.row, ["chip"], async (ctx) =>
    mod.definition ? mod.definition.chip(ctx) : null,
  );
  const report = useModuleQuery<ModuleReport | null>(mod.row, ["report", week.from], async (ctx) =>
    mod.definition ? mod.definition.weeklyReport(ctx, week) : null,
  );
  const paused = mod.row.status === "paused";
  const metrics = paused ? [] : (report.data?.metrics ?? []).slice(0, 3);
  return (
    <Link
      href={`/m/${mod.row.slug}`}
      aria-label={`${mod.row.name}${chip.data?.text ? `: ${chip.data.text}` : ""}`}
      className={cn(
        "glass-dense rounded-dense focus-visible:shadow-focus flex min-h-14 flex-col gap-2 px-4 py-3 outline-none",
        paused && "opacity-55",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="size-2.25 shrink-0 rounded-full"
          style={{ backgroundColor: moduleColor(mod) }}
        />
        <span className="text-lead shrink-0 font-semibold">{mod.row.name}</span>
        <span className="text-ink-2 min-w-0 flex-1 truncate text-sm">{chip.data?.text}</span>
        {paused ? <span className="text-ink-2 shrink-0 text-sm">duraklatıldı</span> : null}
        <ChevronRight aria-hidden className="text-ink-2 size-4.5 shrink-0" />
      </span>
      {metrics.length > 0 ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col">
              <dt className="text-ink-2 text-sm">{metric.label}</dt>
              <dd className="text-lg font-bold tabular-nums">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Link>
  );
}

/** A view a member gives the page, in a dense panel; its source at its right. */
function AreaViewPanel({
  mod,
  view,
  device,
}: {
  mod: KnownModule;
  view: ModuleAreaView;
  device: "pano" | "telefon";
}) {
  const View = view.component;
  return (
    <section
      aria-label={view.title}
      className={cn(
        "glass-dense rounded-dense flex min-w-0 flex-col gap-2.5 px-4 pt-3.5 pb-4",
        view.wide ? "md:col-span-7" : "md:col-span-5",
      )}
    >
      <div className="flex items-baseline gap-3">
        <PanelLabel className="flex-1">{view.title}</PanelLabel>
        <span className="text-ink-2 text-sm">{mod.row.name}</span>
      </div>
      <ModuleProvider mod={mod}>
        <ViewBoundary>
          <View device={device} />
        </ViewBoundary>
      </ModuleProvider>
    </section>
  );
}

/** A view that throws says so in its panel; the page and the other views stay. */
class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="text-ink-2 text-note">
        Bu görünüm açılamadı.
      </p>
    ) : (
      this.props.children
    );
  }
}
