import type { Page } from "@playwright/test";
import { createRegistry } from "@/core/contract/registry";
import { startSessionTold } from "@/core/data/session-events";
import { okul } from "@/modules/okul/module";
import { insertAssessment } from "@/modules/okul/queries";
import { setDocsReady, syncAssessment } from "@/modules/okul/rules";
import { runDay } from "./clock";
import { rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { roomInTheDay } from "./helpers";
import { okulContext, sized, smallTerm, userDb } from "./okul-helpers";

// Okul step 1's scenes (okul.md "Simülasyon" 3 and 4; prompts/okul-adim-1.md, decisions 2 and
// 5): a homework's two sittings on the flow with the note on the way out, "Kaldığın yer" and the
// hand-in; a project step's last sitting on the pomodoro ("Bugünlük yeter" adds a sitting, "Bitti"
// opens the hand-in); a marked quiz's preparation on the pomodoro without sections. The counted
// minutes in the database leave the breaks out.

const registry = createRegistry([okul]);

/** Starts the work of `key` the way "Başla" does (the database stamps it now). */
async function start(key: string) {
  const [item] = (await rows("work_items")).filter((row) => row.key === key);
  const session = await startSessionTold(
    { db: await userDb(), registry },
    {
      workItemId: item.id as string,
    },
  );
  return session.id as string;
}

/** As if the running session had run `minutes` already. */
async function ranFor(id: string, minutes: number) {
  await update("sessions", id, {
    started_at: new Date(Date.now() - minutes * 60_000).toISOString(),
  });
}

/**
 * The pomodoro at its last round's focus, 26 minutes in: the earlier rounds and their breaks went
 * by ("Molayı bitir" waits for a touch, so the state is written as the scene would have kept it).
 */
async function lastRound(assessmentId: string, sessionId: string, rounds: number) {
  await update("okul_assessments", assessmentId, {
    layout_state: {
      session: sessionId,
      round: rounds,
      phase: "focus",
      since: new Date(Date.now() - 26 * 60_000).toISOString(),
      pausedAt: null,
      pausedMs: 0,
      extraMs: 0,
      focusMs: (rounds - 1) * 25 * 60_000,
    },
  });
}

async function ended(id: string) {
  const list = await waitFor(
    () => rows("sessions"),
    (all) => all.some((row) => row.id === id && row.ended_at !== null),
  );
  return list.find((row) => row.id === id)!;
}

const scene = (page: Page) => page.getByTestId("okul-scene");

test("Today's card for a homework and a marked preparation: its title and one line", async ({
  page,
}) => {
  await roomInTheDay(page);
  const ctx = await okulContext();
  const [course] = await smallTerm(ctx, [{ code: "ALG305E", name: "Algoritma", color: "#5fd6c6" }]);
  const quiz = await insertAssessment(ctx, {
    course_id: course.id,
    title: "Quiz 3",
    kind: "quiz",
    date: runDay(1),
    time: "10:00",
    weight: 10,
    date_status: "exact",
  });
  await syncAssessment(ctx, quiz.id);
  await sized(`prep:${quiz.id}`, 120, 90);
  await setDocsReady(ctx, quiz.id, true);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "Quiz 3 hazırlığı" })).toBeVisible();
  await expect(now).toContainText("Algoritma");
  await expect(now).toContainText("yaklaşık");
  await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();
  await now.getByRole("button", { name: "Neden?" }).click();
  await expect(now.getByRole("note", { name: "Neden bu iş" })).toContainText("ağırlığı %10");
});

test("a homework's two sittings: the flow, Süre doldu, the note on the way out, Kaldığın yer, the hand-in on two screens, Yükledim", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.clock.install();
  const ctx = await okulContext(() => new Date());
  const [course] = await smallTerm(ctx, [{ code: "ALG305E", name: "Algoritma", color: "#5fd6c6" }]);
  const homework = await insertAssessment(ctx, {
    course_id: course.id,
    title: "Assignment 2",
    kind: "homework",
    output_kind: "code",
    date: runDay(3),
    time: "23:59",
    date_status: "exact",
  });
  await syncAssessment(ctx, homework.id);
  await sized(`hw:${homework.id}`, 180, 90);

  // The first sitting: the flow; no note yet; the progress line.
  const first = await start(`hw:${homework.id}`);
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-method", "flow");
  await expect(page.getByTestId("resume-note")).toHaveCount(0);
  await expect(page.getByTestId("okul-scene-progress")).toContainText("Bu ödevde 0 dk / 3 sa");
  await ranFor(first, 91);
  await page.reload();
  await expect(page.getByTestId("time-up")).toContainText("Süre doldu.");
  await page.getByTestId("time-up").getByRole("button", { name: "Bitti" }).click();
  const note = page.getByTestId("exit-note");
  await note.getByRole("textbox").fill("Kenar durumları kaldı");
  await note.getByRole("button", { name: "Kaydet ve çık" }).click();
  const one = await ended(first);
  expect(one.counted_minutes).toBeGreaterThanOrEqual(90);
  await waitFor(
    () => rows("okul_assessments"),
    (list) => list[0]?.resume_note === "Kenar durumları kaldı",
  );
  await waitFor(
    () => rows("okul_session_log"),
    (list) => list.length === 1 && list[0].role === "homework",
  );

  // The second, the last: the line from the way out; "Bitti" opens the hand-in on the same scene.
  const second = await start(`hw:${homework.id}`);
  await page.goto("/");
  await expect(page.getByTestId("resume-note")).toContainText("Kenar durumları kaldı");
  await ranFor(second, 91);
  await page.reload();
  await expect(page.getByTestId("time-up")).toContainText("teslim adımları açılır");
  await page.getByTestId("time-up").getByRole("button", { name: "Bitti" }).click();
  const handIn = page.getByTestId("okul-hand-in");
  await expect(handIn).toBeVisible();
  await expect(page.getByTestId("strip-title")).toHaveText("Assignment 2 teslimi");
  await expect(page.getByTestId("strip-minutes")).toHaveText("· 0 / 4");
  await handIn.getByRole("button", { name: "Sonraki" }).click();
  await expect(page.getByTestId("strip-minutes")).toHaveText("· 1 / 4");

  // The other screen opens on the same step.
  const other = await browser.newContext({ storageState: "playwright/.auth/user.json", baseURL });
  const phone = await other.newPage();
  await phone.goto("/");
  await expect(phone.getByTestId("okul-hand-in")).toBeVisible();
  await expect(phone.getByTestId("strip-minutes")).toHaveText("· 1 / 4");
  await other.close();

  // "Yükledim": uploaded by the user's word; the work and its hand-in leave the plan.
  await handIn.getByRole("button", { name: "Yükledim" }).click();
  await note.getByRole("button", { name: "Yazmadan çık" }).click();
  await ended(second);
  const [row] = await waitFor(
    () => rows("okul_assessments"),
    (list) => list[0]?.submitted_at !== null,
  );
  expect(row).toMatchObject({ submit_source: "user", status: "done" });
  await waitFor(
    () => rows("work_items"),
    (list) =>
      list.filter((item) => item.status === "dropped").length === 2 &&
      list.every((item) => item.status === "dropped"),
  );
  // The pages say it was handed in.
  await page.goto("/m/okul");
  await expect(page.getByTestId("okul-home")).toContainText("teslim edildi");
  await page.goto("/m/okul/bolum/alg305e");
  await expect(page.getByTestId("okul-course")).toContainText("teslim edildi");
});

test("a project step's last sitting: the pomodoro without steps, 'Bugünlük yeter' adds a sitting, 'Bitti' opens the hand-in; breaks are not counted", async ({
  page,
}) => {
  await page.clock.install();
  const ctx = await okulContext(() => new Date());
  const [course] = await smallTerm(ctx, [{ code: "ROB301E", name: "Robotics", color: "#c3a9ff" }]);
  const project = await insertAssessment(ctx, {
    course_id: course.id,
    title: "Proje",
    kind: "project",
    date: runDay(20),
    date_status: "exact",
  });
  const step = await insertAssessment(ctx, {
    course_id: course.id,
    parent_id: project.id,
    title: "Proposal",
    kind: "project_step",
    output_kind: "report",
    date: runDay(5),
    time: "23:59",
    date_status: "exact",
    owner: "me",
    submits: true,
  });
  await syncAssessment(ctx, step.id);
  const itemId = await sized(`step:${step.id}`, 60, 60);

  const first = await start(`step:${step.id}`);
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-method", "pomodoro");
  await expect(page.getByTestId("session-sections")).toHaveCount(0);
  await ranFor(first, 61);
  await lastRound(step.id, first, 2);
  await page.reload();
  const card = page.getByTestId("time-up");
  await expect(card).toContainText("Süre doldu.");
  await card.getByRole("button", { name: "Bugünlük yeter" }).click();
  // The way out asks where it stood (`stop` passes the same step).
  await page.getByTestId("exit-note").getByRole("textbox").fill("Yöntem yazıldı");
  await page.getByTestId("exit-note").getByRole("button", { name: "Kaydet ve çık" }).click();
  const one = await ended(first);
  // Two rounds of 25 minutes, a break of 5 between them: 50 counted.
  expect(one.counted_minutes).toBe(50);
  const [item] = await waitFor(
    () => rows("work_items"),
    (list) => (list.find((row) => row.id === itemId)?.effort_total_minutes as number) > 60,
  );
  expect(item.effort_done_minutes).toBe(50);
  expect(item.effort_total_minutes).toBe(110);

  const second = await start(`step:${step.id}`);
  await page.goto("/");
  await ranFor(second, 61);
  await lastRound(step.id, second, 2);
  await page.reload();
  await card.getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("okul-hand-in")).toBeVisible();
  await expect(page.getByTestId("strip-title")).toHaveText("Proposal teslimi");
  // "Sonra yap": the list closes, the step is done, its hand-in stays open.
  await page.getByTestId("okul-hand-in").getByRole("button", { name: "Sonra yap" }).click();
  await page.getByTestId("exit-note").getByRole("button", { name: "Yazmadan çık" }).click();
  await ended(second);
  await waitFor(
    () => rows("okul_assessments"),
    (list) => list.find((row) => row.id === step.id)?.status === "done",
  );
  const items = await waitFor(
    () => rows("work_items"),
    (list) => list.find((row) => row.key === `step:${step.id}`)?.status === "dropped",
  );
  expect(items.find((row) => row.key === `submit:${step.id}`)?.status).toBe("active");
  expect(
    (await rows("okul_assessments")).find((row) => row.id === step.id)?.submitted_at,
  ).toBeNull();
});

test("a marked quiz's preparation: the pomodoro without sections, Süre doldu, Oturum bitti; the exam's page shows the progress", async ({
  page,
}) => {
  await page.clock.install();
  const ctx = await okulContext(() => new Date());
  const [course] = await smallTerm(ctx, [{ code: "ROB301E", name: "Robotics", color: "#c3a9ff" }]);
  const quiz = await insertAssessment(ctx, {
    course_id: course.id,
    title: "Quiz 3",
    kind: "quiz",
    date: runDay(4),
    time: "09:30",
    weight: 5,
    date_status: "exact",
  });
  await syncAssessment(ctx, quiz.id);
  await sized(`prep:${quiz.id}`, 240, 90);
  await setDocsReady(ctx, quiz.id, true);

  const id = await start(`prep:${quiz.id}`);
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-method", "pomodoro");
  await expect(scene(page)).toContainText("Quiz 3 hazırlığı");
  await expect(page.getByTestId("session-sections")).toHaveCount(0);
  await expect(page.getByTestId("resume-note")).toHaveCount(0);
  await expect(page.getByTestId("okul-scene-progress")).toContainText(
    "Bu quizin hazırlığı 0 dk / yaklaşık 4 sa",
  );
  await ranFor(id, 91);
  await lastRound(quiz.id, id, 3);
  await page.reload();
  await page.getByTestId("time-up").getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("session-end")).toHaveText("Oturum bitti.");
  const one = await ended(id);
  // Three rounds of 25 minutes; the two breaks are out.
  expect(one.counted_minutes).toBe(75);
  await page.goto(`/m/okul/is/${quiz.id}`);
  await expect(page.getByTestId("okul-progress")).toContainText(
    "hazırlık 1 sa 15 dk / yaklaşık 4 sa",
  );
});
