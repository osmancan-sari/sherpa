"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import type { ModuleScene, ModuleUiContext, SceneSubject } from "@/core/contract/types";
import { Button } from "../kit/Button";
import { Field, Input } from "../kit/Field";
import { Sheet, SheetBody, SheetFooter, Window } from "../kit/Overlay";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sahne", rule 3c): a scene may hold the way out
// for one step, a single line of text ("Nerede kaldın?"), skipped with one tap. The shell's
// "Çık", the scene's own ending (`controls.finish`, `controls.stop`) and the keyboard pass
// through it; "Takıldım" and "Yatıyorum" do not. With no connection the step is not asked; a
// module that fails, or does not answer in 10 seconds, does not hold the way out: it goes on
// without the note, and the error is only logged. The note is the module's to keep.

/** How long the module's handler may take before the way out goes on without it. */
export const EXIT_NOTE_TIMEOUT_MS = 10_000;

type Session = { id: string; startedAt: Date; day: string };

/** Whether this scene asks on the way out of this work (its `when`; one that throws: no). */
export function asksOnExit(scene: ModuleScene, subject: SceneSubject): boolean {
  const note = scene.beforeExit;
  if (!note) return false;
  try {
    return note.when ? note.when(subject) : true;
  } catch {
    return false;
  }
}

type Pending = {
  action: () => Promise<unknown> | void;
  resolve: (left: boolean) => void;
};

/**
 * The step on the way out of a scene. `leave(action)` runs the action at once, or after the
 * note (saved or skipped); it resolves false when the step was closed without leaving ("Kapat").
 */
export function useExitStep({
  scene,
  subject,
  session,
  ctx,
}: {
  scene: ModuleScene;
  subject: SceneSubject;
  session: Session;
  ctx: ModuleUiContext;
}): {
  leave: (action: () => Promise<unknown> | void) => Promise<boolean>;
  open: boolean;
  /** The form, to draw on the phone's sheet or in a layout's counter place. */
  form: (variant: "sheet" | "card") => ReactNode;
  /** Closes the step without leaving. */
  close: () => void;
  title: string;
} {
  const note = scene.beforeExit;
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  // Each step ends once: a skip while the note is being kept, or a late save, does not run the
  // way out a second time.
  const ended = useRef<WeakSet<Pending>>(new WeakSet());
  const finish = useCallback(async (step: Pending, left: boolean) => {
    if (ended.current.has(step)) return;
    ended.current.add(step);
    setPending(null);
    setText("");
    setSaving(false);
    busy.current = false;
    if (left) await step.action();
    step.resolve(left);
  }, []);

  const leave = useCallback(
    (action: () => Promise<unknown> | void) =>
      new Promise<boolean>((resolve) => {
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        if (!note || offline || !asksOnExit(scene, subject) || busy.current) {
          void Promise.resolve(action()).then(
            () => resolve(true),
            () => resolve(true),
          );
          return;
        }
        busy.current = true;
        setPending({ action, resolve });
      }),
    [note, scene, subject],
  );

  const save = useCallback(async () => {
    if (!pending || !note) return;
    const value = text.trim();
    if (!value) {
      await finish(pending, true);
      return;
    }
    setSaving(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        note.save(value, { subject, session, ctx }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), EXIT_NOTE_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      // The way out is never held: the note is lost, the error only logged.
      console.error("beforeExit", error instanceof Error ? error.message : "unknown");
    } finally {
      clearTimeout(timer);
    }
    await finish(pending, true);
  }, [pending, note, text, subject, session, ctx, finish]);

  const title = note?.title ?? "";
  const form = useCallback(
    (variant: "sheet" | "card") =>
      note && pending ? (
        <ExitNoteForm
          variant={variant}
          title={note.title}
          hint={note.hint ?? null}
          placeholder={note.placeholder ?? null}
          value={text}
          saving={saving}
          onChange={setText}
          onSave={() => void save()}
          onSkip={() => void finish(pending, true)}
        />
      ) : null,
    [note, pending, text, saving, save, finish],
  );

  return {
    leave,
    open: pending !== null,
    form,
    close: () => {
      if (pending) void finish(pending, false);
    },
    title,
  };
}

/** The note's form: a line, "Kaydet ve çık" and a quiet "Yazmadan çık" (frames K3T6, K3P6). */
function ExitNoteForm({
  variant,
  title,
  hint,
  placeholder,
  value,
  saving,
  onChange,
  onSave,
  onSkip,
}: {
  variant: "sheet" | "card";
  title: string;
  hint: string | null;
  placeholder: string | null;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const field = (
    <Field label={hint ?? title}>
      <Input
        autoFocus
        value={value}
        maxLength={200}
        placeholder={placeholder ?? undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
  const save = (
    <Button type="submit" variant="primary" disabled={saving}>
      Kaydet ve çık
    </Button>
  );
  const skip = (
    <Button type="button" variant="quiet" disabled={saving} onClick={onSkip}>
      Yazmadan çık
    </Button>
  );
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSave();
  };
  if (variant === "sheet") {
    // The phone's sheet: the line in its body; "Yazmadan çık" at the left, the primary at the right.
    return (
      <form data-testid="exit-note" aria-label={title} className="contents" onSubmit={submit}>
        <SheetBody>{field}</SheetBody>
        <SheetFooter>
          {skip}
          <span className="flex-1" />
          {save}
        </SheetFooter>
      </form>
    );
  }
  return (
    <form
      data-testid="exit-note"
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={submit}
    >
      {field}
      <div className="flex flex-wrap items-center gap-3">
        {save}
        {skip}
      </div>
    </form>
  );
}

/**
 * The step as the shell draws it: on the phone a sheet from the bottom (K3T6); on the board a
 * card in the layout's counter place when a layout takes it (K3P6), else a small window.
 */
export function ExitStepOverlay({
  device,
  step,
  claimed,
}: {
  device: "pano" | "telefon";
  step: ReturnType<typeof useExitStep>;
  claimed: boolean;
}) {
  if (!step.open) return null;
  if (device === "telefon") {
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) step.close();
        }}
        title={step.title}
        bare
      >
        {step.form("sheet")}
      </Sheet>
    );
  }
  if (claimed) return null;
  return (
    <Window
      open
      onOpenChange={(open) => {
        if (!open) step.close();
      }}
      title={step.title}
      role="dialog"
      actions={null}
    >
      {step.form("card")}
    </Window>
  );
}

/** The card a layout draws on the board in its counter's place. */
export function ExitNoteCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      data-testid="exit-note-card"
      className="glass-main rounded-panel flex flex-col gap-4 p-5 md:p-7"
    >
      <h3 className="md:text-section text-2xl font-bold">{title}</h3>
      {children}
    </section>
  );
}
