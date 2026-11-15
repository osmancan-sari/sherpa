"use client";

import { useState } from "react";
import {
  BarChart,
  ChoiceChips,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  type GridCell,
  HeatGrid,
  LineChart,
  Panel,
  StepRunner,
  Timeline,
  Timer,
} from "@/core/ui/kit";
import { token } from "@/core/ui/tokens";

// The gallery's part for the pieces modules draw their own screens with (docs/06, "Modül
// arayüzü"; docs/tasarim/parcalar.md, "Modüllerin parçaları"): charts, table, grid, timeline,
// timer, step runner, choice chips, the empty and the error state. Sample data, fixed.

const BLUE = token("color-swatch-blue");
const SUN = token("color-swatch-sun");

const WEEKS = [
  { label: "19.10", value: 3.5 },
  { label: "26.10", value: 5 },
  { label: "02.11", value: 4 },
  { label: "09.11", value: 6.5 },
];

type Row = { id: string; title: string; minutes: number };
const ROWS: Row[] = [
  { id: "1", title: "Kaynak taraması", minutes: 50 },
  { id: "2", title: "Sunum provası", minutes: 25 },
  { id: "3", title: "Rapor taslağı", minutes: 90 },
];
const COLUMNS: Column<Row>[] = [
  { key: "title", header: "Kayıt", cell: (row) => row.title, text: (row) => row.title },
  { key: "minutes", header: "Süre", cell: (row) => `${row.minutes} dk`, align: "right" },
];

const CELLS: GridCell[] = Array.from({ length: 14 }, (_, index) => ({
  key: String(index),
  label: `${index + 1}. gün: ${index % 5} kayıt`,
  level: (index % 5) as GridCell["level"],
}));

export function ModulePieces() {
  const [kind, setKind] = useState<"hedef" | "aliskanlik">("hedef");
  const [step, setStep] = useState(0);
  return (
    <section aria-label="Modüllerin parçaları" className="flex flex-col gap-3">
      <h2 className="panel-label text-ink">Modüllerin parçaları</h2>
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Panel variant="dense" className="gap-3 p-4">
          <BarChart title="Haftalık süre (saat)" data={WEEKS} unit="sa" color={BLUE} />
        </Panel>
        <Panel variant="dense" className="gap-3 p-4">
          <LineChart title="Toplam kayıt, hafta hafta" data={WEEKS} color={SUN} />
        </Panel>
        <Panel variant="dense" className="gap-3 p-4">
          <DataTable
            caption="Örnek kayıtlar"
            columns={COLUMNS}
            rows={ROWS}
            rowKey={(row) => row.id}
            filterLabel="Kayıtlarda ara"
          />
        </Panel>
        <Panel variant="dense" className="gap-3 p-4">
          <HeatGrid
            label="İki haftada eklenen kayıtlar"
            columns={7}
            cells={CELLS}
            columnLabels={["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]}
          />
          <Timeline
            label="Tarihli kayıtlar"
            items={[
              { key: "a", when: "12 Kas", title: "Kaynak taraması", muted: true, color: BLUE },
              { key: "b", when: "Cuma", title: "Sunum provası", detail: "hedef", color: BLUE },
            ]}
          />
        </Panel>
        <Panel variant="dense" className="gap-4 p-4">
          <Timer label="Örnek süre" startedAt={null} durationSeconds={1500} />
          <ChoiceChips
            label="Tür"
            value={kind}
            onChange={setKind}
            options={[
              { value: "hedef", label: "Hedef" },
              { value: "aliskanlik", label: "Alışkanlık" },
            ]}
          />
          <StepRunner
            steps={[
              { key: "isin", title: "Isınma", seconds: 60 },
              { key: "sinav", title: "Şınav", reps: 10 },
            ]}
            current={step}
            onStep={(index) => setStep(index + 1)}
          />
        </Panel>
        <div className="flex flex-col gap-3">
          <EmptyState>Gösterilecek bir şey yok.</EmptyState>
          <ErrorState onRetry={() => undefined} />
        </div>
      </div>
    </section>
  );
}
