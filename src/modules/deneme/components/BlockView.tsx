"use client";

import { useEffect, useState } from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { BlockViewProps } from "@/core/contract/types";
import { Button, Field, Input, Panel } from "@/core/ui/kit";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { formatTime } from "@/lib/date";
import { getItem, updateItem } from "../queries";

// Okul çekirdek A (`ui.blockView`): an event's fixed block opens this view from Today, the day's
// flow and Takvim, as a lesson would. It opens no session and counts nothing; the strip says where
// the block stands. A line written here is the module's own (`deneme_items.block_note`).

const PHASE_TEXT = { before: "başlamadı", during: "sürüyor", after: "bitti" } as const;

export function DenemeBlockView({ block, phase, ctx, strip, device, exit, now }: BlockViewProps) {
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const id = block.source_id;
  const record = useModuleQuery(ctx.module, ["item", id], (moduleCtx) =>
    id ? getItem(moduleCtx, id) : Promise.resolve(null),
  );
  const [note, setNote] = useState("");
  const left = Math.max(0, Math.round((Date.parse(block.ends_at) - now.getTime()) / 60_000));
  useEffect(() => {
    strip({
      detail:
        phase === "before" ? `bugün ${formatTime(new Date(block.starts_at))}` : PHASE_TEXT[phase],
    });
  }, [strip, phase, block.starts_at]);

  const save = async () => {
    if (!id || !note.trim()) return;
    try {
      await updateItem(ctx, id, { block_note: note.trim() });
      setNote("");
      await refreshAll();
    } catch {
      notify(SAVE_FAILED);
    }
  };

  return (
    <div
      data-testid="deneme-block-view"
      data-phase={phase}
      className={device === "pano" ? "grid grid-cols-2 items-start gap-10" : "flex flex-col gap-4"}
    >
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-title md:text-scene tracking-title font-bold">{block.title}</h2>
          <p className="text-ink-2 text-note tabular-nums">
            {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}
            {block.location ? ` · ${block.location}` : ""}
          </p>
        </header>
        <Panel variant="main" className="gap-2 p-5">
          <p className="text-2xl font-bold">
            {phase === "during" ? `Bitişe ${left} dk` : phase === "after" ? "Bitti" : "Başlamadı"}
          </p>
        </Panel>
      </div>
      <div className="flex flex-col gap-4">
        <Panel variant="dense" label="Not" className="gap-3 px-4 pb-4">
          {record.data?.block_note ? (
            <p className="text-base font-semibold" data-testid="block-note">
              {record.data.block_note}
            </p>
          ) : null}
          <Field label="Tek cümle">
            <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => void save()}>
              Not al
            </Button>
            <Button variant="quiet" onClick={exit}>
              {"Bugün'e dön"}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
