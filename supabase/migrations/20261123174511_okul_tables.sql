-- Module "okul" (src/modules/okul; design docs/moduller/okul.md, section 3; step 1 in
-- prompts/okul-adim-1.md): the term, its courses, every exam, homework and project with its steps,
-- every class session, the sentences written in class and the two preparation documents of each
-- exam. All with user_id and RLS like every table; only the module reads and writes them.
--
-- Beyond okul.md's list, three small tables: a team meeting the user adds to a project
-- (okul_meetings), the follow-up and material tasks brought over from Notion (okul_tasks: a
-- proposal's source must be one of the module's own records), and the minutes the module counted
-- of each of its sessions (okul_session_log: decision 9, the module's own "spent"). Files, rules
-- and the readers' runs come with steps 2 and 3.

create table public.okul_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  name text not null check (length(btrim(name)) between 1 and 60),
  -- the first and the last day of the lessons
  starts_on date not null,
  ends_on date not null,
  finals_from date,
  finals_to date,
  break_weeks int[] not null default '{}',
  folder_root text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (finals_to is null or finals_from is null or finals_to >= finals_from),
  unique (user_id, name)
);

create table public.okul_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  term_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9]{2,12}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  position int not null default 0,
  -- 1 = Monday … 7 = Sunday
  weekday smallint check (weekday between 1 and 7),
  start_time time,
  end_time time,
  -- the schedule as the source wrote it, when it could not be read into the fields above
  schedule_text text,
  room text,
  location text not null default 'campus' check (location in ('campus', 'online')),
  ninova_path text,
  kepler_ref text,
  claude_project_url text,
  notion_page_url text,
  local_folder text,
  folder text,
  grading_note text,
  -- [{ text, kind?, threshold? }]
  vf_conditions jsonb not null default '[]' check (jsonb_typeof(vf_conditions) = 'array'),
  syllabus_weeks jsonb check (syllabus_weeks is null or jsonb_typeof(syllabus_weeks) = 'array'),
  -- the attendance condition: a number of absences allowed, or a share of the sessions held to
  -- attend. Either one makes the course ask "Derse girdin mi?" (rule 15); none: it never asks
  absence_limit int check (absence_limit is null or absence_limit between 0 and 100),
  attendance_min_pct int check (attendance_min_pct is null or attendance_min_pct between 1 and 100),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time),
  unique (user_id, term_id, code),
  unique (user_id, external_id),
  foreign key (term_id, user_id) references public.okul_terms (id, user_id) on delete cascade
);

-- Every quiz, midterm, final, homework, project, project step and presentation: the one source of
-- its date, weight and scope. A date the user set (date_source 'user') is never overwritten.
create table public.okul_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  course_id uuid not null,
  parent_id uuid,
  title text not null check (length(btrim(title)) between 1 and 160),
  kind text not null
    check (kind in ('quiz', 'midterm', 'final', 'homework', 'project', 'project_step',
                    'presentation')),
  -- homework and steps: the scene's method (code: the flow; the rest: the pomodoro)
  output_kind text check (output_kind in ('code', 'written', 'report', 'slides')),
  date date,
  time time,
  room text,
  duration_min int check (duration_min is null or duration_min between 5 and 600),
  date_status text not null default 'unknown' check (date_status in ('exact', 'estimated', 'unknown')),
  date_source text
    check (date_source in ('syllabus', 'announcement', 'ninova', 'kepler', 'calendar', 'rule',
                           'guess', 'user', 'notion')),
  date_basis text check (date_basis is null or length(date_basis) <= 300),
  -- the source's own note on the time ("23:59", "ders saatinde")
  time_note text check (time_note is null or length(time_note) <= 300),
  -- the day the work opens (homework); empty: from now on
  opens_on date,
  weight numeric(5, 2) check (weight is null or weight between 0 and 100),
  score numeric(6, 2) check (score is null or score between 0 and 100),
  score_source text check (score_source in ('kepler', 'user')),
  excluded boolean not null default false,
  scope_from_week int check (scope_from_week is null or scope_from_week between 1 and 30),
  scope_to_week int check (scope_to_week is null or scope_to_week between 1 and 30),
  scope_text text check (scope_text is null or length(scope_text) <= 500),
  scope_source text not null default 'rule' check (scope_source in ('rule', 'announcement', 'user')),
  -- where the record came from, as the source said it ("Syllabus", "Duyuru (30/10)")
  source_text text check (source_text is null or length(source_text) <= 200),
  vf_condition text check (vf_condition is null or length(vf_condition) <= 300),
  -- project steps: whose step it is (only the user's are planned), and its place among the steps
  owner text check (owner in ('me', 'other', 'none')),
  owner_name text check (owner_name is null or length(owner_name) <= 60),
  position int not null default 0,
  -- the step was suggested (the AI's, later the user's to edit)
  proposed boolean not null default false,
  -- the work ends with handing it in (a submission checklist of its own): homework always does
  submits boolean not null default true,
  ninova_id text,
  submitted_at timestamptz,
  submit_source text check (submit_source in ('ninova', 'user')),
  status text not null default 'todo' check (status in ('todo', 'preparing', 'done', 'cancelled')),
  notes text check (notes is null or length(notes) <= 2000),
  -- the scene's state, the same on both screens: the layout's timer (`PomodoroState`,
  -- `FlowState`, each for its own session) and the checklist's step (submission)
  layout_state jsonb,
  checklist_state jsonb,
  -- the sentence written on the way out ("Nerede kaldın?") and when
  resume_note text check (resume_note is null or char_length(resume_note) <= 300),
  resume_noted_at timestamptz,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id),
  check (scope_to_week is null or scope_from_week is null or scope_to_week >= scope_from_week),
  unique (user_id, external_id),
  foreign key (course_id, user_id) references public.okul_courses (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.okul_assessments (id, user_id)
    on delete set null (parent_id)
);
create index okul_assessments_course_idx on public.okul_assessments (course_id, date);

-- Every class session of the term. 'not_held' ("Yapılmadı") is not a holiday: the session was
-- planned and did not take place; it leaves the attendance count's denominator.
create table public.okul_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  course_id uuid not null,
  date date not null,
  course_week int check (course_week is null or course_week between 1 and 30),
  topic text check (topic is null or length(topic) <= 300),
  kind text not null default 'lecture'
    check (kind in ('lecture', 'recitation', 'exam', 'presentation', 'holiday')),
  -- the session's own hours and room when they differ from the course's
  start_time time,
  end_time time,
  room text,
  attendance text check (attendance in ('attended', 'missed', 'not_held')),
  attendance_at timestamptz,
  kepler_attendance text check (kepler_attendance in ('present', 'absent')),
  -- the lesson's view was opened (the question then is asked there, not on Today)
  viewed_at timestamptz,
  -- Today's question was asked
  asked_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time),
  unique (user_id, external_id),
  foreign key (course_id, user_id) references public.okul_courses (id, user_id) on delete cascade
);
create index okul_sessions_course_idx on public.okul_sessions (course_id, date);

-- A sentence written in class; later turned into a date ("Tarihe çevir").
create table public.okul_class_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  session_id uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  converted_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.okul_sessions (id, user_id) on delete cascade,
  foreign key (converted_to, user_id) references public.okul_assessments (id, user_id)
    on delete set null (converted_to)
);
create index okul_class_notes_session_idx on public.okul_class_notes (session_id, created_at);

-- An exam's two preparation documents. In step 1 only "Dokümanım hazır" writes them: both
-- 'ready', produced_by 'manual', with no file and no parts (rule 7). Step 3 fills the same rows.
create table public.okul_prep_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  assessment_id uuid not null,
  output text not null check (output in ('topic', 'practice')),
  status text not null default 'waiting'
    check (status in ('waiting', 'queued', 'generating', 'ready', 'failed')),
  file_path text,
  version int not null default 1 check (version >= 1),
  produced_by text check (produced_by in ('auto', 'manual')),
  produced_at timestamptz,
  due_on date,
  parts jsonb check (parts is null or jsonb_typeof(parts) = 'array'),
  missing jsonb check (missing is null or jsonb_typeof(missing) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, output),
  foreign key (assessment_id, user_id) references public.okul_assessments (id, user_id)
    on delete cascade
);

-- A team meeting of a project, added by the user; its scene is a checklist (decision 6).
create table public.okul_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  project_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  checklist_state jsonb,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '90 minutes'),
  foreign key (project_id, user_id) references public.okul_assessments (id, user_id)
    on delete cascade
);

-- A follow-up or material task brought over from Notion's weekly tasks (decision 7): an
-- independent work of the module.
create table public.okul_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  course_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  kind text not null check (kind in ('follow_up', 'material')),
  due_on date,
  importance smallint check (importance between 1 and 4),
  status text not null default 'todo' check (status in ('todo', 'done')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  foreign key (course_id, user_id) references public.okul_courses (id, user_id)
    on delete set null (course_id)
);

-- What the module counted of each of its sessions (decision 9): the scene's counted minutes,
-- else the focus minutes from the layout's state, else the wall clock's. One row per session.
create table public.okul_session_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  assessment_id uuid,
  role text not null check (role in ('prep', 'homework', 'step', 'submit', 'meeting', 'task')),
  minutes int not null check (minutes between 0 and 1440),
  result text,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id),
  foreign key (assessment_id, user_id) references public.okul_assessments (id, user_id)
    on delete cascade
);
create index okul_session_log_assessment_idx on public.okul_session_log (assessment_id);

do $$
declare
  t text;
begin
  foreach t in array array['okul_terms', 'okul_courses', 'okul_assessments', 'okul_sessions',
                           'okul_class_notes', 'okul_prep_docs', 'okul_meetings', 'okul_tasks',
                           'okul_session_log'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;
