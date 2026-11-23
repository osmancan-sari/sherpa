"use client";

import { useState } from "react";
import { Button, ListRow, Panel, Segmented, Sheet, SheetFooter, Stepper } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import {
  DEFAULT_FLOW_REMINDER,
  DEFAULT_POMODORO,
  type Method,
  methodsOf,
  type OkulSettings,
  settingsOf,
  type WorkType,
} from "../rules";
import { useWrite, withOkul } from "./useTerm";

// Okul's settings (frames OkulAyarlar, SahneYontem, SahneSureler; decision 8): only "Çalışma" in
// step 1: the method per kind of work, the pomodoro's lengths, the flow's break reminder. The
// methods and lengths are not changed on the scene. Sources, notifications, documents and the
// folder come with steps 2 and 3.

const TYPES: { key: WorkType; label: string }[] = [
  { key: "reading", label: "Konu okuma" },
  { key: "written", label: "Yazılı ödev ve rapor" },
  { key: "code", label: "Kodlama ödevi ve proje kodu" },
];
const METHOD_TEXT: Record<Method, string> = { pomodoro: "pomodoro", flow: "akış" };

function OkulSettingsFormInner() {
  const { ctx } = useModule();
  const write = useWrite();
  const settings = settingsOf(ctx);
  const methods = methodsOf(settings);
  const pomodoro = { ...DEFAULT_POMODORO, ...(settings.pomodoro ?? {}) };
  const reminder = settings.flow_reminder ?? DEFAULT_FLOW_REMINDER;
  const [open, setOpen] = useState<"methods" | "lengths" | null>(null);
  const save = (patch: Partial<OkulSettings>) =>
    write((context) => context.saveSettings({ ...settingsOf(context), ...patch }));

  return (
    <div data-testid="okul-settings" className="flex flex-col gap-4">
      <Panel variant="dense" label="Çalışma" className="pb-1.5">
        <ListRow
          className="border-line border-t border-b-0"
          onClick={() => setOpen("methods")}
          title="Yöntemler"
          subtitle={TYPES.map(
            (type) => `${type.label.toLocaleLowerCase("tr")}: ${METHOD_TEXT[methods[type.key]]}`,
          ).join(" · ")}
        />
        <ListRow
          className="border-line border-t border-b-0"
          onClick={() => setOpen("lengths")}
          title="Pomodoro süreleri"
          subtitle={`odak ${pomodoro.focus} dk · kısa mola ${pomodoro.short} dk · uzun mola ${pomodoro.long} dk`}
        />
        <div className="border-line flex items-center justify-between gap-3 border-t px-4 py-3 md:px-4.5">
          <div className="flex flex-col">
            <span className="text-base font-semibold">Akışta mola hatırlatması</span>
            <span className="text-ink-2 text-sm">bu kadar çalışınca hatırlatır</span>
          </div>
          <Stepper
            label="Akışta mola hatırlatması"
            value={reminder}
            onChange={(value) => void save({ flow_reminder: value })}
            min={30}
            max={180}
            step={15}
            unit="dk"
          />
        </div>
      </Panel>
      {open === "methods" ? (
        <MethodsSheet
          initial={methods}
          onClose={() => setOpen(null)}
          onSave={(next) => save({ methods: next })}
        />
      ) : null}
      {open === "lengths" ? (
        <LengthsSheet
          initial={pomodoro}
          onClose={() => setOpen(null)}
          onSave={(next) => save({ pomodoro: next })}
        />
      ) : null}
    </div>
  );
}

function MethodsSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: Record<WorkType, Method>;
  onClose: () => void;
  onSave: (methods: Record<WorkType, Method>) => Promise<boolean>;
}) {
  const [methods, setMethods] = useState(initial);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title="Yöntemler"
      description="Oturum sırasında değiştirilmez."
      footer={
        <SheetFooter>
          <Button variant="quiet" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(methods).then((ok) => ok && onClose())}
          >
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-5">
        {TYPES.map((type) => (
          <div key={type.key} className="flex flex-col gap-2">
            <span className="text-base font-semibold">{type.label}</span>
            <Segmented
              label={type.label}
              value={methods[type.key]}
              onChange={(value) => setMethods({ ...methods, [type.key]: value })}
              options={[
                { value: "pomodoro", label: "Pomodoro" },
                { value: "flow", label: "Akış" },
              ]}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function LengthsSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: { focus: number; short: number; long: number };
  onClose: () => void;
  onSave: (lengths: { focus: number; short: number; long: number }) => Promise<boolean>;
}) {
  const [lengths, setLengths] = useState(initial);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title="Pomodoro süreleri"
      description="Oturum sırasında değiştirilmez."
      footer={
        <SheetFooter>
          <Button variant="quiet" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(lengths).then((ok) => ok && onClose())}
          >
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        {(
          [
            ["focus", "Odak", 10, 60],
            ["short", "Kısa mola", 3, 20],
            ["long", "Uzun mola", 5, 40],
          ] as const
        ).map(([field, label, min, max]) => (
          <div key={field} className="flex items-center justify-between gap-3">
            <span className="text-base font-semibold">{label}</span>
            <Stepper
              label={label}
              value={lengths[field]}
              onChange={(value) => setLengths({ ...lengths, [field]: value })}
              min={min}
              max={max}
              step={5}
              unit="dk"
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export const OkulSettingsForm = withOkul(OkulSettingsFormInner);
