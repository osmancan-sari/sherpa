"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_MONTHLY_BUDGET_USD } from "@/core/ai/budget";
import type { AiStatus } from "@/core/ai/status";
import { useSaveAiSettings } from "@/core/app/actions";
import { useAiStatus, useAiUsage, useSettings } from "@/core/app/hooks";
import { ClientOnly } from "../ClientOnly";

// Settings → Yapay zeka: the switch, the monthly limit, whether the AI answers now, and what
// this month's calls cost (docs/10-yapay-zeka.md, rule 9).

const STATE: Record<AiStatus["state"], string> = {
  on: "Açık.",
  no_provider: "API anahtarı yok; uygulama yapay zekasız çalışıyor.",
  no_model: "Model ayarlanmamış (AI_MODEL_FAST); uygulama yapay zekasız çalışıyor.",
  no_price: "Modelin fiyatı tabloda yok; maliyeti sayılamadığı için çağrı yapılmıyor.",
  disabled: "Kapalı.",
  budget: "Bu ayın bütçesi doldu; yapay zeka ay sonuna kadar kapalı.",
  check_failed: "Durum okunamadı.",
};

const KIND: Record<string, string> = {
  enrich: "Giriş okuma",
  size: "Süre tahmini",
  decompose: "Adımlara bölme",
  extract: "Metinden çıkarma",
};

/** Turkish digits; small amounts keep enough decimals to not read as zero. */
const usd = (value: number) =>
  `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  })} $`;

export function AiSettings() {
  return (
    <ClientOnly>
      <AiSettingsBody />
    </ClientOnly>
  );
}

function AiSettingsBody() {
  const settings = useSettings();
  const status = useAiStatus();
  const usage = useAiUsage();
  const save = useSaveAiSettings();

  const enabled = settings.data?.ai_enabled ?? true;
  const budget = Number(settings.data?.ai_monthly_budget_usd ?? DEFAULT_MONTHLY_BUDGET_USD);
  const [draft, setDraft] = useState<string | null>(null);
  const budgetText = draft ?? String(budget);
  const budgetValue = Number(budgetText.replace(",", "."));
  const budgetValid = budgetText.trim() !== "" && Number.isFinite(budgetValue) && budgetValue >= 0;

  const state = status.data?.state;
  const line = state ? STATE[state] : null;
  const fake = status.data?.provider === "fake" ? " Sahte sağlayıcı (yerel)." : "";
  const model =
    state === "on" && status.data?.models.fast ? ` Model: ${status.data.models.fast}.` : "";

  return (
    <div className="flex flex-col gap-4">
      {line ? (
        <p className="text-sm" data-testid="ai-state">
          {line}
          {model}
          {fake}
        </p>
      ) : null}

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={settings.isLoading}
          onChange={(event) => save.mutate({ enabled: event.target.checked })}
          className="size-5"
        />
        Yapay zeka açık
      </label>

      <form
        noValidate
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!budgetValid) return;
          save.mutate({ budgetUsd: budgetValue }, { onSuccess: () => setDraft(null) });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Aylık sınır ($; 0 kapatır)</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={budgetText}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={!budgetValid || undefined}
            className="h-11 w-32 md:h-9"
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          className="h-11 md:h-9"
          disabled={!budgetValid || draft === null || budgetValue === budget}
        >
          Kaydet
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Bu ay:</span>{" "}
          <span className="tabular-nums">
            {usd(status.data?.spentUsd ?? 0)} / {usd(budget)}
          </span>
        </p>
        {(usage.data ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="sr-only">Bu ayın yapay zeka çağrıları</caption>
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-1 pr-3 font-normal">Çağrı</th>
                  <th className="py-1 pr-3 font-normal">Model</th>
                  <th className="py-1 pr-3 text-right font-normal">Sayı</th>
                  <th className="py-1 pr-3 text-right font-normal">Başarısız</th>
                  <th className="py-1 pr-3 text-right font-normal">Belirteç</th>
                  <th className="py-1 text-right font-normal">Maliyet</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {usage.data!.map((row) => (
                  <tr key={`${row.kind}-${row.model}`} className="border-border border-t">
                    <td className="py-1 pr-3">{KIND[row.kind] ?? row.kind}</td>
                    <td className="py-1 pr-3 break-all">{row.model}</td>
                    <td className="py-1 pr-3 text-right">{row.calls}</td>
                    <td className="py-1 pr-3 text-right">{row.failed}</td>
                    <td className="py-1 pr-3 text-right">
                      {(row.inputTokens + row.outputTokens).toLocaleString("tr-TR")}
                    </td>
                    <td className="py-1 text-right">{usd(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Bu ay çağrı yapılmadı.</p>
        )}
      </div>
    </div>
  );
}
