"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "./kit/Button";
import { Field, Input, Select } from "./kit/Field";
import { SheetBody, SheetFooter } from "./kit/Overlay";
import { Dialog } from "./Dialog";

// A small form in a dialog, for changing a record by hand: a task, a work item, a rhythm, a
// block. The caller names the fields and gets back only the ones that were changed, so a save
// never claims a field the user did not touch.

export type EditField = {
  name: string;
  label: string;
  type: "text" | "date" | "time" | "number" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Its share of the row: a pair ("Son tarih" and "Süre") or a three ("Hedef, Dönem, Süre"). */
  width?: "half" | "third";
  min?: number;
  max?: number;
  step?: number;
};

export type EditValues = Record<string, string>;

const SPAN = { full: "col-span-6", half: "col-span-3", third: "col-span-2" } as const;

function fieldProblem(field: EditField, value: string): boolean {
  if (value.trim() === "") return field.required === true;
  if (field.type !== "number") return false;
  const number = Number(value);
  if (!Number.isInteger(number)) return true;
  if (field.min !== undefined && number < field.min) return true;
  return field.max !== undefined && number > field.max;
}

/** Mount it only while it is open: its state starts from `initial` each time. */
export function EditDialog({
  title,
  fields,
  initial,
  saveLabel = "Kaydet",
  validate,
  onSave,
  onClose,
  extra,
  hints = {},
  section,
}: {
  title: string;
  fields: EditField[];
  initial: EditValues;
  saveLabel?: string;
  /** A rule across fields (an end after its start); false keeps the save button off. */
  validate?: (values: EditValues) => boolean;
  /** Called with the changed fields only; not called when nothing changed. */
  onSave: (changed: EditValues, values: EditValues) => void;
  onClose: () => void;
  /** Secondary actions next to the save button ("Bırak", "Durdur"). */
  extra?: ReactNode;
  /** Field name → the AI's reason, for values the AI set (shown under the field). */
  hints?: Record<string, string>;
  /**
   * A section of its own under the fields (the "Zaman" section), told the current values: it
   * may keep the save off, and a change in it is a change of the form.
   */
  section?: (values: EditValues) => { node: ReactNode; valid: boolean; changed: boolean };
}) {
  const [values, setValues] = useState<EditValues>(initial);
  const set = (name: string, value: string) => setValues((old) => ({ ...old, [name]: value }));
  const sectionState = section?.(values);
  const valid =
    fields.every((field) => !fieldProblem(field, values[field.name] ?? "")) &&
    (validate?.(values) ?? true) &&
    (sectionState?.valid ?? true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const changed = Object.fromEntries(
      fields
        .filter((field) => (values[field.name] ?? "") !== (initial[field.name] ?? ""))
        .map((field) => [field.name, values[field.name] ?? ""]),
    );
    if (Object.keys(changed).length > 0 || sectionState?.changed) onSave(changed, values);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())} title={title} bare>
      {/* The form checks its own fields; the browser's check would refuse a length like 12 or 37
          minutes because of the step. */}
      <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <div className="grid grid-cols-6 gap-x-3 gap-y-4">
            {fields.map((field) => {
              const label = field.required ? field.label : `${field.label} (isteğe bağlı)`;
              const value = values[field.name] ?? "";
              // Only while untouched: once the user types, the value is theirs.
              const ai = Boolean(hints[field.name]) && value === (initial[field.name] ?? "");
              return (
                <Field
                  key={field.name}
                  label={label}
                  aiReason={ai ? hints[field.name] : undefined}
                  className={SPAN[field.width ?? "full"]}
                >
                  {({ id, describedBy }) =>
                    field.type === "select" ? (
                      <Select
                        id={id}
                        // Named on its own: a select would also read out its value.
                        aria-label={label}
                        aria-describedby={describedBy}
                        ai={ai}
                        value={value}
                        onChange={(event) => set(field.name, event.target.value)}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        aria-label={label}
                        aria-describedby={describedBy}
                        ai={ai}
                        type={field.type}
                        inputMode={field.type === "number" ? "numeric" : undefined}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        onChange={(event) => set(field.name, event.target.value)}
                        aria-invalid={fieldProblem(field, value) || undefined}
                      />
                    )
                  }
                </Field>
              );
            })}
          </div>
          {sectionState?.node}
        </SheetBody>
        <SheetFooter>
          {extra}
          <span className="flex-1" />
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {saveLabel}
          </Button>
        </SheetFooter>
      </form>
    </Dialog>
  );
}
