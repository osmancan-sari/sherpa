"use client";

import { useState } from "react";
import {
  Button,
  DateInput,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  SheetFooter,
  Stepper,
} from "@/core/ui/kit";
import type { Assessment, Course } from "../queries";
import { changeAssessment } from "../rules";
import {
  addAssessment,
  addMeeting,
  addStep,
  removeAssessment,
  updateDate,
} from "../server/entries";
import { readSentence } from "../server/sentence";
import { KIND_LABEL } from "../server/text";
import { useWrite } from "./useTerm";

// The module's small forms (okul.md section 7): each is one sentence or at most two touches;
// on the phone a sheet from below, on the board from the side (the kit's Sheet).

const KINDS = ["quiz", "midterm", "final", "homework", "project", "project_step", "presentation"];

/**
 * "Sınav ya da teslim ekle" (`assessment`; only on a course's page): one sentence ("Quiz 4 3
 * Aralık") read into the short form below it, which the user may correct before saving.
 */
export function AddAssessmentSheet({
  course,
  open,
  onOpenChange,
  from,
}: {
  course: Pick<Course, "id" | "name">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A sentence written in class being turned into a date ("Tarihe çevir"). */
  from?: { noteId: string; text: string } | null;
}) {
  const write = useWrite();
  const [sentence, setSentence] = useState(from?.text ?? "");
  const [form, setForm] = useState(() => formOf(from?.text ?? ""));
  const [weight, setWeight] = useState("");
  const read = (text: string) => {
    setSentence(text);
    setForm(formOf(text));
  };
  const save = async () => {
    if (!form.title.trim()) return;
    const done = await write((ctx) =>
      addAssessment(ctx, {
        courseId: course.id,
        title: form.title,
        kind: form.kind,
        date: form.date || null,
        time: form.time || null,
        weight: weight ? Number(weight.replace(",", ".")) : null,
        fromNote: from?.noteId ?? null,
      }),
    );
    if (done) {
      onOpenChange(false);
      read("");
      setWeight("");
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sınav ya da teslim ekle"
      description={course.name}
      footer={
        <SheetFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!form.title.trim()}>
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tek cümle" hint="Örnek: Quiz 4 3 Aralık 10:30">
          <Input
            value={sentence}
            maxLength={160}
            onChange={(event) => read(event.target.value)}
            aria-label="Tek cümle"
          />
        </Field>
        <Field label="Ad">
          <Input
            aria-label="Ad"
            value={form.title}
            maxLength={160}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Tür">
          <Select
            aria-label="Tür"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gün">
            <DateInput
              aria-label="Gün"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </Field>
          <Field label="Saat">
            <Input
              aria-label="Saat"
              value={form.time}
              placeholder="SS:dd"
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Ağırlık (%)">
          <Input
            aria-label="Ağırlık (%)"
            value={weight}
            inputMode="decimal"
            maxLength={6}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function formOf(text: string) {
  const read = readSentence(text, new Date());
  return {
    title: read.title,
    kind: read.kind ?? "homework",
    date: read.date ?? "",
    time: read.time ?? "",
  };
}

/** A date by hand (`date_update`; frame SorumlulukAyrinti): the user's from now on. */
export function DateSheet({
  assessment,
  open,
  onOpenChange,
}: {
  assessment: Assessment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const write = useWrite();
  const [date, setDate] = useState(assessment.date ?? "");
  const [time, setTime] = useState(assessment.time?.slice(0, 5) ?? "");
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    const done = await write((ctx) =>
      updateDate(ctx, assessment.id, date || null, /^\d{1,2}:\d{2}$/.test(time) ? time : null),
    );
    if (done) onOpenChange(false);
  };
  const remove = async () => {
    const done = await write((ctx) => removeAssessment(ctx, assessment.id));
    if (done) {
      onOpenChange(false);
      window.history.back();
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tarih ve saat"
      description={assessment.title}
      footer={
        <SheetFooter>
          <Button variant="danger" onClick={() => (confirm ? void remove() : setConfirm(true))}>
            {confirm ? "Kaldırmayı onayla" : `${KIND_LABEL[assessment.kind] ?? "İşi"} kaldır`}
          </Button>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gün">
            <DateInput
              aria-label="Gün"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Saat">
            <Input
              aria-label="Saat"
              value={time}
              placeholder="SS:dd"
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => setTime(event.target.value)}
            />
          </Field>
        </div>
        <p className="text-ink-2 text-sm">Elle verdiğin tarih bir daha hiçbir kaynakla ezilmez.</p>
      </div>
    </Sheet>
  );
}

/**
 * The course's attendance condition (not in the frames: **görüşün gerek**): none, a number of
 * absences allowed, or a share to attend. With one, "Derse girdin mi?" is asked after its lessons.
 */
export function AttendanceRuleSheet({
  course,
  open,
  onOpenChange,
}: {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const write = useWrite();
  const initial =
    course.absence_limit !== null ? "count" : course.attendance_min_pct !== null ? "share" : "none";
  const [kind, setKind] = useState<"none" | "count" | "share">(initial);
  const [count, setCount] = useState(course.absence_limit ?? 4);
  const [share, setShare] = useState(course.attendance_min_pct ?? 70);
  const save = async () => {
    const done = await write(async (ctx) => {
      const { error } = await ctx.db
        .from("okul_courses")
        .update({
          absence_limit: kind === "count" ? count : null,
          attendance_min_pct: kind === "share" ? share : null,
        })
        .eq("id", course.id);
      if (error) throw new Error(error.message);
    });
    if (done) onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Devam şartı"
      description={course.name}
      footer={
        <SheetFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Devam şartı"
          value={kind}
          onChange={setKind}
          options={[
            { value: "none", label: "Yok" },
            { value: "count", label: "Devamsızlık hakkı" },
            { value: "share", label: "Devam oranı" },
          ]}
        />
        {kind === "count" ? (
          <Stepper
            label="Devamsızlık hakkı"
            value={count}
            onChange={setCount}
            min={0}
            max={30}
            unit="ders"
          />
        ) : null}
        {kind === "share" ? (
          <Stepper
            label="En az devam"
            value={share}
            onChange={setShare}
            min={5}
            max={100}
            step={5}
            unit="%"
          />
        ) : null}
        <p className="text-ink-2 text-sm">Şart varsa ders bitince “Derse girdin mi?” sorulur.</p>
      </div>
    </Sheet>
  );
}

/** A step of a project (`step_edit`): add with its name, day and owner. */
export function StepSheet({
  project,
  step,
  open,
  onOpenChange,
}: {
  project: Assessment;
  step?: Assessment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const write = useWrite();
  const [title, setTitle] = useState(step?.title ?? "");
  const [date, setDate] = useState(step?.date ?? "");
  const [owner, setOwner] = useState<"me" | "other" | "none">(
    (step?.owner as "me" | "other" | "none" | null) ?? "me",
  );
  const [ownerName, setOwnerName] = useState(step?.owner_name ?? "");
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    if (!title.trim()) return;
    const done = await write(async (ctx) => {
      if (step) {
        await changeAssessment(ctx, step.id, {
          title: title.trim(),
          owner,
          owner_name: owner === "other" ? ownerName.trim() || null : null,
          proposed: false,
          ...(date !== (step.date ?? "")
            ? { date: date || null, date_status: date ? "exact" : "unknown", date_source: "user" }
            : {}),
        });
      } else {
        await addStep(ctx, project.id, {
          title,
          date: date || null,
          owner,
          ownerName: owner === "other" ? ownerName : undefined,
        });
      }
    });
    if (done) onOpenChange(false);
  };
  const remove = async () => {
    if (!step) return;
    const done = await write((ctx) => removeAssessment(ctx, step.id));
    if (done) onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={step ? "Alt iş" : "Alt iş ekle"}
      description={project.title}
      footer={
        <SheetFooter>
          {step ? (
            <Button variant="danger" onClick={() => (confirm ? void remove() : setConfirm(true))}>
              {confirm ? "Silmeyi onayla" : "Sil"}
            </Button>
          ) : null}
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!title.trim()}>
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Ad">
          <Input
            aria-label="Ad"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Gün">
          <DateInput
            aria-label="Gün"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Segmented
          label="Kimin"
          value={owner}
          onChange={setOwner}
          options={[
            { value: "me", label: "Sen" },
            { value: "other", label: "Başkası" },
            { value: "none", label: "Kimse" },
          ]}
        />
        {owner === "other" ? (
          <Field label="Kim">
            <Input
              aria-label="Kim"
              value={ownerName}
              maxLength={60}
              onChange={(event) => setOwnerName(event.target.value)}
            />
          </Field>
        ) : null}
        <p className="text-ink-2 text-sm">Yalnızca senin alt işlerin plana girer.</p>
      </div>
    </Sheet>
  );
}

/** A team meeting of a project (decision 6): its day, hour and length (at most 90 minutes). */
export function MeetingSheet({
  project,
  open,
  onOpenChange,
}: {
  project: Assessment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const write = useWrite();
  const [day, setDay] = useState("");
  const [time, setTime] = useState("15:00");
  const [minutes, setMinutes] = useState(45);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{1,2}:\d{2}$/.test(time);
  const save = async () => {
    if (!valid) return;
    const done = await write((ctx) => addMeeting(ctx, project.id, { day, time, minutes }));
    if (done) onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Takım toplantısı ekle"
      description={project.title}
      footer={
        <SheetFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!valid}>
            Kaydet
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gün">
            <DateInput
              aria-label="Gün"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          </Field>
          <Field label="Saat">
            <Input
              aria-label="Saat"
              value={time}
              placeholder="SS:dd"
              maxLength={5}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <Stepper
          label="Süre"
          value={minutes}
          onChange={setMinutes}
          min={10}
          max={90}
          step={5}
          unit="dk"
        />
      </div>
    </Sheet>
  );
}
