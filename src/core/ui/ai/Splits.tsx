"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { postAi } from "@/core/ai/client";
import type { DecomposeOutcome } from "@/core/ai/flows/decompose";
import { readMark } from "@/core/ai/marks";
import { useAnswerSplit, useRefreshAll } from "@/core/app/actions";
import { useWorkItems } from "@/core/app/hooks";
import type { WorkItem } from "@/core/types";
import { formatMinutes } from "@/lib/date";
import { useNotify } from "../Notices";

// Splitting a large work item: the AI suggests pieces (`decompose`), the module page shows the
// suggestion, one tap accepts or declines it. Nothing becomes work before that.

const SAID: Record<string, string> = {
  proposed: "Bölme önerisi modül sayfasında.",
  skipped: "Yapay zeka şu an kapalı; bölme önerilemedi.",
  failed: "Yapay zeka yanıt vermedi; bölme önerilemedi.",
  gone: "Bu iş kalemi kapalı.",
};

/** "Adımlara böl" in the work item's form. */
export function SplitButton({ item, onDone }: { item: WorkItem; onDone: () => void }) {
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const [busy, setBusy] = useState(false);
  if (item.status !== "active" && item.status !== "waiting") return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 md:h-9"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const outcome = await postAi<DecomposeOutcome>("decompose", { id: item.id });
        await refreshAll();
        setBusy(false);
        notify(SAID[outcome?.status ?? "failed"]);
        onDone();
      }}
    >
      {busy ? "Bölünüyor…" : "Adımlara böl"}
    </Button>
  );
}

/** The suggested splits of a module's work items, each with "Böl" and "Bölme". */
export function SplitSuggestions({ moduleId }: { moduleId: string }) {
  const workItems = useWorkItems();
  const answer = useAnswerSplit();

  const groups = useMemo(() => {
    const items = workItems.data ?? [];
    const byParent = new Map<string, WorkItem[]>();
    for (const item of items) {
      if (item.status !== "proposed" || !item.parent_id || item.module_id !== moduleId) continue;
      byParent.set(item.parent_id, [...(byParent.get(item.parent_id) ?? []), item]);
    }
    return [...byParent.entries()].flatMap(([parentId, pieces]) => {
      const parent = items.find((item) => item.id === parentId);
      return parent ? [{ parent, pieces }] : [];
    });
  }, [workItems.data, moduleId]);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ parent, pieces }) => {
        const reason = readMark(pieces[0].ai)?.fields.effort_total_minutes?.reason;
        return (
          <section
            key={parent.id}
            aria-label={`Bölme önerisi: ${parent.title}`}
            className="border-border flex flex-col gap-3 rounded-xl border border-dashed p-4"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Bölme önerisi:</span>{" "}
                <span className="font-medium">{parent.title}</span>
              </p>
              {reason ? <p className="text-muted-foreground text-sm">{reason}</p> : null}
            </div>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
              {pieces.map((piece) => (
                <li key={piece.id}>
                  {piece.title}
                  {piece.effort_total_minutes ? (
                    <span className="text-muted-foreground tabular-nums">
                      {" "}
                      · {formatMinutes(piece.effort_total_minutes)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 md:h-9"
                onClick={() => answer.mutate({ parentId: parent.id, accept: true })}
              >
                Böl
              </Button>
              <Button
                variant="ghost"
                className="h-11 md:h-9"
                onClick={() => answer.mutate({ parentId: parent.id, accept: false })}
              >
                Bölme
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
