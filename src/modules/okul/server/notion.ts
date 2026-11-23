// Notion's four databases to the module's records (docs/08-notion-aktarim.md; prompts/okul-adim-1.md,
// decision 7). Pure: the exported JSON in, the rows and what was left out out; importer.ts writes
// them. Nothing here reads or prints the content; the import's report gives counts only.

type Raw = Record<string, unknown>;

export type NotionExport = {
  courses: Raw[];
  assessments: Raw[];
  sessions: Raw[];
  tasks: Raw[];
};

export type CourseIn = {
  external_id: string;
  code: string;
  name: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  schedule_text: string | null;
  vf_conditions: { text: string }[];
  grading_note: string | null;
  claude_project_url: string | null;
  notion_page_url: string | null;
  local_folder: string | null;
};

export type AssessmentIn = {
  external_id: string;
  course_code: string;
  title: string;
  kind: "quiz" | "midterm" | "final" | "homework" | "project" | "project_step" | "presentation";
  date: string | null;
  time: string | null;
  date_status: "exact" | "estimated" | "unknown";
  time_note: string | null;
  weight: number | null;
  score: number | null;
  excluded: boolean;
  scope_text: string | null;
  source_text: string | null;
  vf_condition: string | null;
  status: "todo" | "preparing" | "done";
  notes: string | null;
  submits: boolean;
};

export type SessionIn = {
  external_id: string;
  course_code: string;
  date: string;
  course_week: number | null;
  topic: string | null;
  kind: "lecture" | "exam" | "presentation" | "holiday";
  attendance: "attended" | "missed" | null;
  notes: string | null;
};

export type TaskIn = {
  external_id: string;
  course_code: string | null;
  title: string;
  kind: "follow_up" | "material";
  due_on: string | null;
  importance: number | null;
};

export type ReadExport = {
  courses: CourseIn[];
  assessments: AssessmentIn[];
  sessions: SessionIn[];
  tasks: TaskIn[];
  /** Weekly tasks left out, by their Notion type ("Hazırlık", "Takip · arşivli"…). */
  skippedTasks: Record<string, number>;
  /** Rows the import could not read whole; counted by what was missing. */
  problems: { kind: string; count: number }[];
  /** Time notes with no hour in them (kept as they were in `time_note`). */
  unparsedTimeNotes: number;
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const yes = (value: unknown) => value === "__YES__" || value === true;

const WEEKDAYS: Record<string, number> = {
  Pazartesi: 1,
  Salı: 2,
  Çarşamba: 3,
  Perşembe: 4,
  Cuma: 5,
  Cumartesi: 6,
  Pazar: 7,
};

const ASSESSMENT_KINDS: Record<string, AssessmentIn["kind"]> = {
  Quiz: "quiz",
  Midterm: "midterm",
  Final: "final",
  Ödev: "homework",
  Proje: "project",
  "Proje Adımı": "project_step",
  Sunum: "presentation",
};

const SESSION_KINDS: Record<string, SessionIn["kind"]> = {
  Ders: "lecture",
  Sınav: "exam",
  Sunum: "presentation",
  Tatil: "holiday",
};

const STATUS: Record<string, AssessmentIn["status"]> = {
  Yapılacak: "todo",
  Hazırlanıyor: "preparing",
  Tamamlandı: "done",
};

const PRIORITY: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

/** An hour in a text ("23:59", "ders 14:30"); null when there is none. */
export function hourIn(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d])/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

/** "09:30" or "09:30-12:20" (also with "–"). */
export function scheduleIn(text: string | null): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };
  const match = text.match(
    /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*[-–]\s*([01]?\d|2[0-3])[:.]([0-5]\d))?\s*$/,
  );
  if (!match) return { start: null, end: null };
  const start = `${match[1].padStart(2, "0")}:${match[2]}`;
  const end = match[3] ? `${match[3].padStart(2, "0")}:${match[4]}` : null;
  return { start, end: end && end > start ? end : null };
}

const day = (value: unknown) => {
  const text = str(value);
  return text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};

export function readExport(data: NotionExport): ReadExport {
  const problems = new Map<string, number>();
  const problem = (kind: string) => problems.set(kind, (problems.get(kind) ?? 0) + 1);

  const courses: CourseIn[] = [];
  for (const row of data.courses) {
    const url = str(row.url);
    const code = str(row["Kod"])?.replace(/\s+/g, "").toUpperCase() ?? null;
    if (!url || !code) {
      problem("ders: kimlik ya da kod yok");
      continue;
    }
    const schedule = str(row["Saat"]);
    const hours = scheduleIn(schedule);
    if (schedule && !hours.start) problem("ders: saat okunamadı");
    const vf = str(row["VF Şartları"]);
    courses.push({
      external_id: url,
      code,
      name: str(row["Ders Adı"]) ?? code,
      weekday: WEEKDAYS[str(row["Ders Günü"]) ?? ""] ?? null,
      start_time: hours.start,
      end_time: hours.end,
      schedule_text: schedule && !hours.start ? schedule : null,
      vf_conditions: vf ? [{ text: vf }] : [],
      grading_note: str(row["Notlandırma Notu"]),
      claude_project_url: str(row["Claude Projesi"]),
      notion_page_url: str(row["Ders Sayfası"]),
      local_folder: str(row["Lokal Klasör"]),
    });
  }
  const codes = new Set(courses.map((course) => course.code));
  const courseCode = (value: unknown) => {
    const code = str(value)?.replace(/\s+/g, "").toUpperCase() ?? null;
    return code && codes.has(code) ? code : null;
  };

  let unparsedTimeNotes = 0;
  const assessments: AssessmentIn[] = [];
  for (const row of data.assessments) {
    const url = str(row.url);
    const code = courseCode(row["Ders Kodu"]);
    const kind = ASSESSMENT_KINDS[str(row["Tür"]) ?? ""];
    if (!url || !code || !kind) {
      problem(!code ? "değerlendirme: ders eşleşmedi" : "değerlendirme: tür okunamadı");
      continue;
    }
    const date = day(row["date:Tarih:start"]);
    const note = str(row["Zaman Notu"]);
    const time = hourIn(note);
    if (note && !time) unparsedTimeNotes += 1;
    const stated = str(row["Tarih Durumu"]);
    // A date marked "Belirsiz" is still a date: estimated. Without a date, nothing is known.
    const date_status: AssessmentIn["date_status"] = !date
      ? "unknown"
      : stated === "Kesin"
        ? "exact"
        : "estimated";
    assessments.push({
      external_id: url,
      course_code: code,
      title: str(row["Kalem"]) ?? kind,
      kind,
      date,
      time,
      date_status,
      time_note: note,
      weight: num(row["Ağırlık"]),
      score: num(row["Not"]),
      excluded: yes(row["Hesaba Katılmaz"]),
      scope_text: str(row["Kapsam"]),
      source_text: str(row["Kaynak"])?.slice(0, 200) ?? null,
      vf_condition: str(row["VF Şartı"]),
      status: STATUS[str(row["Durum"]) ?? ""] ?? "todo",
      notes: str(row["Notlar"])?.slice(0, 2000) ?? null,
      submits: kind === "homework" || kind === "project" || kind === "project_step",
    });
  }

  const sessions: SessionIn[] = [];
  for (const row of data.sessions) {
    const url = str(row.url);
    const code = courseCode(row["Ders Kodu"]);
    const date = day(row["date:Tarih:start"]);
    const kind = SESSION_KINDS[str(row["Tür"]) ?? ""];
    if (!url || !code || !date || !kind) {
      problem(
        !code ? "oturum: ders eşleşmedi" : !date ? "oturum: tarih yok" : "oturum: tür okunamadı",
      );
      continue;
    }
    const week = str(row["Ders Haftası"])?.match(/\d+/)?.[0];
    const attendance = str(row["Devam"]);
    sessions.push({
      external_id: url,
      course_code: code,
      date,
      course_week: week ? Number(week) : null,
      topic: str(row["Konu"])?.slice(0, 300) ?? null,
      kind,
      attendance:
        attendance === "Katıldım" ? "attended" : attendance === "Katılmadım" ? "missed" : null,
      notes: str(row["Notlar"])?.slice(0, 2000) ?? null,
    });
  }

  // Weekly tasks (decision 7): only the open, unarchived follow-ups and materials come over.
  const skippedTasks: Record<string, number> = {};
  const skip = (why: string) => (skippedTasks[why] = (skippedTasks[why] ?? 0) + 1);
  const tasks: TaskIn[] = [];
  for (const row of data.tasks) {
    const url = str(row.url);
    const type = str(row["Tür"]);
    const title = str(row["Name"]);
    const label = type ?? "Türsüz";
    if (type !== "Takip" && type !== "Materyal") skip(label);
    else if (yes(row["Arşiv"])) skip(`${label} · arşivli`);
    else if (str(row["Status"]) === "Done") skip(`${label} · bitti`);
    else if (!url || !title) skip(`${label} · okunamadı`);
    else {
      tasks.push({
        external_id: url,
        course_code: courseCode(row["Ders Kodu"]),
        title: title.slice(0, 200),
        kind: type === "Takip" ? "follow_up" : "material",
        due_on: day(row["date:Son Tarih:start"]),
        importance: PRIORITY[str(row["Priority"]) ?? ""] ?? null,
      });
    }
  }

  return {
    courses,
    assessments,
    sessions,
    tasks,
    skippedTasks,
    problems: [...problems].map(([kind, count]) => ({ kind, count })),
    unparsedTimeNotes,
  };
}
