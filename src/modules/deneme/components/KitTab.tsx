"use client";

import { useMemo, useState } from "react";
import { useModuleQuery, useNow } from "@/core/app/hooks";
import {
  AlertRow,
  BarChart,
  Button,
  Chip,
  ChoiceChips,
  EmptyState,
  ErrorState,
  type GridCell,
  HeatGrid,
  LineChart,
  ListRow,
  NumberStepper,
  Panel,
  ProgressBar,
  Segmented,
  Sheet,
  Status,
  StepLines,
  Switch,
  Timeline,
} from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { dayKey, formatDue, shiftDay, weekStart } from "@/lib/date";
import { type DenemeKind, KIND_LABEL, listItems } from "../queries";

/**
 * Second tab: every piece of the core's component kit, fed with the module's own records.
 * It doubles as the place to look at the kit on both layouts.
 */
export function KitTab() {
  const { row } = useModule();
  const now = useNow();
  const items = useModuleQuery(row, ["items"], listItems);
  const [count, setCount] = useState(3);
  const [choice, setChoice] = useState<DenemeKind>("hedef");
  const [on, setOn] = useState(true);
  const [view, setView] = useState<"hepsi" | "acik" | "biten">("hepsi");
  const [sheet, setSheet] = useState(false);
  const list = useMemo(() => items.data ?? [], [items.data]);
  const today = dayKey(now);

  const minutes = list
    .filter((item) => item.minutes !== null)
    .slice(-8)
    .map((item) => ({ label: item.title.slice(0, 10), value: item.minutes! }));

  // Records added per day over the last four weeks, and their running total.
  const start = weekStart(shiftDay(today, -21));
  const days = Array.from({ length: 28 }, (_, index) => shiftDay(start, index));
  const perDay = days.map(
    (day) => list.filter((item) => dayKey(new Date(item.created_at)) === day).length,
  );
  const cells: GridCell[] = days.map((day, index) => ({
    key: day,
    label: `${day}: ${perDay[index]} kayıt`,
    level: Math.min(4, perDay[index]) as GridCell["level"],
  }));
  const running = days
    .filter((_, index) => index % 7 === 6)
    .map((day) => ({
      label: day.slice(8) + "." + day.slice(5, 7),
      value: list.filter((item) => dayKey(new Date(item.created_at)) <= day).length,
    }));

  const dated = list
    .filter((item) => item.due_on !== null)
    .sort((a, b) => a.due_on!.localeCompare(b.due_on!))
    .map((item) => ({
      key: item.id,
      when: formatDue(`${item.due_on}T20:59:00Z`, now),
      title: item.title,
      detail: KIND_LABEL[item.kind as DenemeKind],
      muted: item.done,
      color: row.color,
    }));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Piece title="Çubuk grafik">
        {minutes.length > 0 ? (
          <BarChart title="Kayıtların süresi" data={minutes} unit="dk" color={row.color} />
        ) : (
          <EmptyState>Süresi olan kayıt yok.</EmptyState>
        )}
      </Piece>
      <Piece title="Çizgi grafik">
        <LineChart title="Toplam kayıt sayısı, hafta hafta" data={running} color={row.color} />
      </Piece>
      <Piece title="Izgara">
        <HeatGrid
          label="Son dört haftada eklenen kayıtlar"
          columns={7}
          cells={cells}
          columnLabels={["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]}
        />
      </Piece>
      <Piece title="Zaman çizelgesi">
        {dated.length > 0 ? (
          <Timeline label="Tarihli kayıtlar" items={dated} />
        ) : (
          <EmptyState>Tarihli kayıt yok.</EmptyState>
        )}
      </Piece>
      <Piece title="Sayı adımlayıcı">
        <NumberStepper
          label="Tekrar"
          value={count}
          onChange={setCount}
          min={1}
          max={12}
          unit="kez"
        />
      </Piece>
      <Piece title="Seçim çipleri">
        <ChoiceChips
          label="Tür"
          value={choice}
          onChange={setChoice}
          options={(Object.keys(KIND_LABEL) as DenemeKind[]).map((kind) => ({
            value: kind,
            label: KIND_LABEL[kind],
          }))}
        />
      </Piece>
      <Piece title="Boş durum">
        <EmptyState>Gösterilecek bir şey yok.</EmptyState>
      </Piece>
      <Piece title="Hata durumu">
        <ErrorState onRetry={() => void items.refetch()} />
      </Piece>
      {/* Ç4b: the glass language's shared pieces (docs/tasarim/parcalar.md), with the
          module's own records. */}
      <Piece title="Panel ve liste satırı">
        <Panel variant="dense" label="Kayıtlar">
          {list.slice(0, 3).map((item) => (
            <ListRow
              key={item.id}
              dot={row.color}
              pending={item.done}
              title={item.title}
              subtitle={KIND_LABEL[item.kind as DenemeKind]}
              trailing={item.done ? <Status health="ok">bitti</Status> : null}
            />
          ))}
        </Panel>
      </Piece>
      <Piece title="Parçalı seçim, hap, anahtar">
        <Segmented
          label="Gösterim"
          value={view}
          onChange={setView}
          options={[
            { value: "hepsi", label: "Hepsi" },
            { value: "acik", label: "Açık" },
            { value: "biten", label: "Biten" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip dot={row.color} selected>
            Deneme
          </Chip>
          <Switch label="Örnek anahtar" checked={on} onChange={setOn} />
        </div>
      </Piece>
      <Piece title="İlerleme ve uyarı">
        <ProgressBar
          value={list.filter((item) => item.done).length / Math.max(1, list.length)}
          color={row.color}
          label="Biten kayıtlar"
        />
        <StepLines
          total={Math.max(1, list.length)}
          done={list.filter((item) => item.done).length}
          color={row.color}
        />
        <AlertRow tone="info">Uyarı satırı: tek cümle, tek eylem.</AlertRow>
      </Piece>
      <Piece title="Alttan sayfa / yan panel">
        <div>
          <Button onClick={() => setSheet(true)}>Sayfayı aç</Button>
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="Örnek sayfa"
          footer={
            <>
              <span className="flex-1" />
              <Button onClick={() => setSheet(false)}>Vazgeç</Button>
              <Button variant="primary" onClick={() => setSheet(false)}>
                Kaydet
              </Button>
            </>
          }
        >
          <p className="text-ink-2 text-note">Formlar telefonda alttan, panoda sağdan açılır.</p>
        </Sheet>
      </Piece>
    </div>
  );
}

function Piece({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h3 className="panel-label">{title}</h3>
      {children}
    </section>
  );
}
