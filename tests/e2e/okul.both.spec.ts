import type { Page } from "@playwright/test";
import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { okul } from "@/modules/okul/module";
import { insertSession } from "@/modules/okul/queries";
import { askAttendance, syncSession } from "@/modules/okul/rules";
import { runAt, runDay } from "./clock";
import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { hhmm, okulContext, sampleTerm, smallTerm } from "./okul-helpers";

// Okul step 1 (prompts/okul-adim-1.md, "Testler"), on the phone (375 px) and the board: the
// module page with the sample term; a lesson's fixed block opening its view from the day's flow
// and Takvim (package A's test the phone lacked); "Derse girdin mi?" only in a course with an
// attendance condition, the view's answer and Today's one writing the same record.

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const COURSES = [
  ["rob301e", "Robotics"],
  ["bda410e", "Big Data"],
  ["alg305e", "Algoritma"],
  ["mlo420e", "MLOps"],
  ["dlr303e", "Deep Learning"],
  ["dvz330e", "Data Viz"],
] as const;

test("Okul's page: the term by week, six courses in the picker and their pages; no state line; 'Sınav ya da teslim ekle' only on a course", async ({
  page,
}, info) => {
  const phone = info.project.name === "telefon";
  if (phone) await page.setViewportSize({ width: 375, height: 812 });
  await sampleTerm();
  await page.goto("/m/okul");
  await expect(page.getByRole("heading", { level: 1, name: "Okul" })).toBeVisible();
  const head = page.getByRole("region", { name: "Durum" });
  await expect(head).toContainText("26-27 Güz");
  await expect(head).not.toContainText("sınav");
  await expect(head.getByRole("button", { name: "İş ekle" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Geçmiş ve gidişat" })).toHaveCount(0);
  const home = page.getByTestId("okul-home").filter({ visible: true });
  await expect(home.getByTestId("okul-week").first()).toBeVisible();
  await expect(home).toContainText("Assignment 2");
  await expect(home).toContainText("TAHMİN EDİLEMEYEN");
  await expect(page.getByRole("button", { name: "Sınav ya da teslim ekle" })).toHaveCount(0);
  expect(await sidewaysOverflow(page)).toBe(0);

  const nav = page.getByRole("navigation", { name: "Sekmeler" });
  if (phone) {
    const picker = nav.getByRole("button", { name: "Bölümler" });
    await expect(picker).toHaveText("Ders seç");
    await picker.click();
    const list = page.getByRole("list", { name: "Bölümler" });
    await expect(list.getByRole("link")).toHaveCount(6);
    await expect(list.getByRole("link", { name: /Algoritma/ })).toContainText(
      "ALG305E · sıradaki: Assignment 2",
    );
    expect(await sidewaysOverflow(page)).toBe(0);
    await list.getByRole("link", { name: /Deep Learning/ }).click();
  } else {
    await expect(nav.getByRole("link")).toHaveCount(7);
    await nav.getByRole("link", { name: "Deep Learning" }).click();
  }
  await expect(page).toHaveURL(/\/m\/okul\/bolum\/dlr303e$/);

  for (const [key, name] of COURSES) {
    await page.goto(`/m/okul/bolum/${key}`);
    const course = page.getByTestId("okul-course").filter({ visible: true });
    await expect(course).toHaveAttribute("data-facet", key);
    await expect(course.getByRole("heading", { level: 2 })).toHaveText(name);
    await expect(course.getByRole("button", { name: "Sınav ya da teslim ekle" })).toBeVisible();
    await expect(head).not.toContainText("Dikkat");
    expect(await sidewaysOverflow(page)).toBe(0);
  }

  // The course's page: its summary and its work; a step the AI suggested says so.
  await page.goto("/m/okul/bolum/dlr303e");
  const course = page.getByTestId("okul-course").filter({ visible: true });
  await expect(course.getByTestId("okul-course-summary")).toContainText("7,4 / 9,7");
  await expect(course.getByTestId("okul-step").filter({ hasText: "Temel model" })).toContainText(
    "2. kişi",
  );
  await expect(course.getByTestId("okul-step").filter({ hasText: "Temel model" })).toContainText(
    "öneri",
  );
  // The attendance page.
  await course.getByRole("link", { name: "Devam" }).click();
  await expect(page.getByTestId("okul-attendance").filter({ visible: true })).toContainText(
    "Kalan devamsızlık",
  );
  expect(await sidewaysOverflow(page)).toBe(0);
});

test("a lesson's block opens its view from the day's flow and Takvim; no session; 'Çık' is Today", async ({
  page,
}, info) => {
  const phone = info.project.name === "telefon";
  const ctx = await okulContext();
  const [course] = await smallTerm(ctx, [
    { code: "SNM101E", name: "Sınama", color: "#5fd6c6", room: "D-101" },
  ]);
  const start = new Date(runAt(-30));
  const lesson = await insertSession(ctx, {
    course_id: course.id,
    date: runDay(),
    start_time: hhmm(start),
    end_time: hhmm(new Date(runAt(60))),
  });
  await syncSession(ctx, lesson.id);
  const [block] = await waitFor(
    () => rows("blocks"),
    (list) => list.length === 1,
  );

  await page.goto("/");
  const view = page.getByTestId("okul-lesson").filter({ visible: true });
  // The day's flow (on the phone too, package A's open test).
  const piece = page.locator('[data-testid="strip-block"][data-opens]').filter({ visible: true });
  await piece.first().click();
  await expect(page).toHaveURL(new RegExp(`/\\?blok=${block.id}$`));
  await expect(view).toHaveAttribute("data-phase", "during");
  await expect(page.getByTestId("strip-minutes")).toHaveText("· derste");
  // A sentence in class.
  await view
    .getByRole("textbox", { name: "Derste söylenen" })
    .fill("Quiz 2 bir hafta erkene gelebilir");
  await view.getByRole("button", { name: "Not al" }).click();
  await expect(view.getByTestId("okul-class-note")).toHaveCount(1);
  await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await rows("sessions")).toEqual([]);

  // Takvim's day.
  await page.goto("/takvim");
  await page
    .getByRole("region", { name: "Haftanın günleri" })
    .locator('[aria-current="date"]')
    .filter({ visible: true })
    .first()
    .click();
  const detail = page.getByRole("region", { name: "Günün ayrıntısı" }).filter({ visible: true });
  await detail.getByRole("link", { name: /Sınama/ }).click();
  await expect(page).toHaveURL(new RegExp(`/\\?blok=${block.id}$`));
  await expect(view).toBeVisible();

  // "Tarihe çevir": the sentence becomes an assessment of the course, the note says so.
  await view.getByRole("button", { name: "Tarihe çevir" }).click();
  const sheet = page.getByRole("dialog", { name: "Sınav ya da teslim ekle" });
  await sheet.getByLabel("Ad").fill("Quiz 2");
  await sheet.getByRole("button", { name: "Kaydet" }).click();
  const [assessment] = await waitFor(
    () => rows("okul_assessments"),
    (list) => list.length === 1,
  );
  expect(assessment).toMatchObject({ title: "Quiz 2", course_id: course.id });
  await waitFor(
    () => rows("okul_class_notes"),
    (list) => list[0]?.converted_to === assessment.id,
  );
  await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await rows("sessions")).toEqual([]);
  if (phone) expect(await sidewaysOverflow(page)).toBe(0);
});

test("'Derse girdin mi?' only in a course with an attendance condition; the view's answer and Today's write the same record", async ({
  page,
}) => {
  const ctx = await okulContext();
  const [ruled, free] = await smallTerm(ctx, [
    { code: "SNM101E", name: "Sınama", color: "#5fd6c6", absence_limit: 3 },
    { code: "SNM202E", name: "Serbest", color: "#c3a9ff" },
  ]);
  const ended = (courseId: string, from: number, to: number) =>
    insertSession(ctx, {
      course_id: courseId,
      date: runDay(),
      start_time: hhmm(new Date(runAt(from))),
      end_time: hhmm(new Date(runAt(to))),
    });
  const first = await ended(ruled.id, -240, -180);
  const other = await ended(free.id, -170, -120);
  const second = await ended(ruled.id, -110, -60);
  // Blocks are proposed only while ahead: these two were proposed in the morning; a past block
  // opens by its address, as it does from Takvim.
  const morning = createModuleContext({
    db: ctx.db,
    registry: createRegistry([okul]),
    module: ctx.module,
    now: () => new Date(runAt(-300)),
  });
  for (const id of [first.id, other.id]) await syncSession(morning, id);
  await waitFor(
    () => rows("blocks"),
    (list) => list.length === 2,
  );
  const blocks = await rows("blocks");
  const ruledBlock = blocks.find((row) => row.source_id === first.id)!;
  const freeBlock = blocks.find((row) => row.source_id === other.id)!;

  // The view after the lesson: the question in the course that asks; none in the other.
  await page.goto(`/?blok=${ruledBlock.id}`);
  const view = page.getByTestId("okul-lesson").filter({ visible: true });
  await expect(view).toHaveAttribute("data-phase", "after");
  await expect(page.getByTestId("strip-minutes")).toHaveText("· ders bitti");
  const question = view.getByTestId("okul-attendance-question");
  await expect(question).toContainText("Derse girdin mi?");
  await question.getByRole("button", { name: "Girmedim" }).click();
  await waitFor(
    () => rows("okul_sessions"),
    (list) => list.find((row) => row.id === first.id)?.attendance === "missed",
  );
  await expect(question).toContainText("Girmedin.");
  await page.goto(`/?blok=${freeBlock.id}`);
  await expect(view).toHaveAttribute("data-phase", "after");
  await expect(view.getByTestId("okul-attendance-question")).toHaveCount(0);

  // The hour's job: asks on Today only for the lesson whose view was not opened, in the course
  // that asks; the answer there writes the record and the view says it.
  expect(await askAttendance(ctx)).toBe(1);
  const prompts = await rows("prompts");
  expect(prompts.map((row) => row.subject_id)).toEqual([second.id]);
  await page.goto("/");
  const ask = page.getByRole("region", { name: "Soru" }).filter({ visible: true });
  await expect(ask).toContainText("Sınama: derse girdin mi?");
  await ask.getByRole("button", { name: "Girdim" }).click();
  await waitFor(
    () => rows("okul_sessions"),
    (list) => list.find((row) => row.id === second.id)?.attendance === "attended",
  );
});
