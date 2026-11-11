import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The first Today screen: the pool in order, the "now" card, Başla and Bitti, unplanned work.

const at = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

test("Başla then Bitti leaves one session record and finishes the task", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "HW2: lokalizasyon soruları",
    est_minutes: 45,
  });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "HW2: lokalizasyon soruları" })).toBeVisible();
  await expect(now).toContainText("Okul");
  await now.getByRole("button", { name: "Başla" }).click();

  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
  await expect(now).toContainText("0 dk geçti · tahmin 45 dk");
  await expect(now.getByRole("progressbar", { name: "Geçen süre" })).toBeVisible();
  const open = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  expect(open[0].ended_at).toBeNull();
  expect((await rows("tasks"))[0].status).toBe("doing");

  // The clock is the server's: the elapsed time comes from the stored start, not from a
  // counter on this device. (That an open screen follows such a change without a reload is
  // tested in sync.spec.ts, which runs while the live service is quiet.)
  await update("sessions", open[0].id as string, { started_at: at(-25) });
  await page.reload();
  await expect(now).toContainText("25 dk geçti · tahmin 45 dk");

  await now.getByRole("button", { name: "Bitti" }).click();
  await expect(now).toContainText("Bugün için planlanan bir şey yok.");
  await expect(page.getByRole("main")).toContainText("1 iş bitti");

  const sessions = await waitFor(
    () => rows("sessions"),
    (list) => list[0].ended_at !== null,
  );
  expect(sessions).toHaveLength(1);
  const minutes =
    (Date.parse(sessions[0].ended_at as string) - Date.parse(sessions[0].started_at as string)) /
    60_000;
  expect(Math.round(minutes)).toBe(25);
  const [task] = await rows("tasks");
  expect(task).toMatchObject({ status: "done" });
  expect(task.done_at).not.toBeNull();
});

test("two sessions are never open at once: starting another task stops the first", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Birinci iş", due_at: at(60) },
    { module_id: mod.id, title: "İkinci iş", due_at: at(120) },
  ]);

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("heading", { name: "Birinci iş" })).toBeVisible();
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();

  await page.getByRole("button", { name: "Başla: İkinci iş" }).click();
  await expect(now.getByRole("heading", { name: "İkinci iş" })).toBeVisible();
  // The first one is back in the list, not finished.
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toContainText("Birinci iş");

  const sessions = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 2,
  );
  expect(sessions.filter((session) => session.ended_at === null)).toHaveLength(1);
  const tasks = await rows("tasks");
  expect(tasks.find((task) => task.title === "Birinci iş")?.status).toBe("todo");
  expect(tasks.find((task) => task.title === "İkinci iş")?.status).toBe("doing");

  // Durdur stops without finishing.
  await now.getByRole("button", { name: "Durdur" }).click();
  await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();
  await waitFor(
    () => rows("sessions"),
    (list) => list.every((session) => session.ended_at !== null),
  );
  expect((await rows("tasks")).map((task) => task.status)).toEqual(["todo", "todo"]);
});

test("the pool is ordered by deadline, then importance", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Tarihsiz" },
    { module_id: mod.id, title: "Yarın", due_at: at(24 * 60) },
    { module_id: mod.id, title: "Bugün düşük", due_at: at(120), importance: 1 },
    { module_id: mod.id, title: "Bugün yüksek", due_at: at(120), importance: 4 },
    { module_id: mod.id, title: "Tarihsiz önemli", importance: 4 },
    { module_id: mod.id, title: "Bekleyen", status: "waiting", due_at: at(10) },
  ]);

  await page.goto("/");
  // The first of the order is the suggestion; the rest follow in the list.
  await expect(
    page.getByRole("region", { name: "Şimdi" }).getByRole("heading", { name: "Bugün yüksek" }),
  ).toBeVisible();
  const list = page.getByRole("region", { name: "Sıradakiler" });
  await expect(list.locator("li p:first-child")).toHaveText([
    "Bugün düşük",
    "Yarın",
    "Tarihsiz önemli",
    "Tarihsiz",
  ]);
  await expect(list).not.toContainText("Bekleyen");
  // The title exactly: after 22:00 "Bugün düşük" (due in two hours) reads "yarın 00:…" too.
  await expect(list.getByText("Yarın", { exact: true }).locator("..")).toContainText(
    "Okul · 30 dk · yarın",
  );
});

test("one tap finishes a task from the list, and the finish can be taken back", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Önce bu", due_at: at(60) },
    { module_id: mod.id, title: "Fatura öde", due_at: at(120) },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: "Bitti: Fatura öde" }).click();
  const list = page.getByRole("region", { name: "Sıradakiler" });
  await expect(list.getByRole("button", { name: "Bitti: Fatura öde" })).toBeHidden();
  await waitFor(
    () => rows("tasks"),
    (tasks) => tasks.some((task) => task.status === "done"),
  );
  expect(await rows("sessions")).toHaveLength(0);

  await list.getByText("Bugün bitenler (1)").click();
  await list.getByRole("button", { name: "Geri al: Fatura öde" }).click();
  await expect(list.getByRole("button", { name: "Bitti: Fatura öde" })).toBeVisible();
  await waitFor(
    () => rows("tasks"),
    (tasks) => tasks.every((task) => task.status === "todo"),
  );
});

test("unplanned work: one line starts a session without a task", async ({ page }) => {
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("button", { name: "Başka bir şey yapıyorum" }).click();
  await now.getByLabel("Ne yapıyorsun?").fill("Telefon görüşmesi");
  await page.keyboard.press("Enter");

  await expect(now.getByRole("heading", { name: "Telefon görüşmesi" })).toBeVisible();
  const open = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  expect(open[0]).toMatchObject({ title: "Telefon görüşmesi", task_id: null, module_id: null });

  await now.getByRole("button", { name: "Bitti" }).click();
  await expect(now).toContainText("Bugün için planlanan bir şey yok.");
  await waitFor(
    () => rows("sessions"),
    (list) => list[0].ended_at !== null,
  );
  expect(await rows("tasks")).toHaveLength(0);
});

test("a work item is started as its next sitting, and the time counts towards it", async ({
  page,
}) => {
  const mod = await seedModule();
  const [item] = await insert("work_items", {
    module_id: mod.id,
    title: "Midterm hazırlığı",
    effort_total_minutes: 300,
    session_minutes: 60,
    due_at: at(3 * 24 * 60),
  });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("1 sa");
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("heading", { name: "Midterm hazırlığı" })).toBeVisible();
  await expect(now).toContainText("tahmin 1 sa", { timeout: 5000 });

  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  await update("sessions", session.id as string, { started_at: at(-40) });
  await now.getByRole("button", { name: "Durdur" }).click();

  const items = await waitFor(
    () => rows("work_items"),
    (list) => (list[0].effort_done_minutes as number) > 0,
  );
  expect(items[0]).toMatchObject({ id: item.id, effort_done_minutes: 40, status: "active" });
  const tasks = await rows("tasks");
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ work_item_id: item.id, est_minutes: 60, status: "todo" });
  // The sitting stands for the item now: it is listed once, not twice.
  await expect(page.getByRole("main").getByText("Midterm hazırlığı")).toHaveCount(1);
});

test("a fixed block that is running takes the card; the day's blocks are listed", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Sırada bekleyen iş" });
  // Clock times inside today in Istanbul, whatever the hour the test runs at.
  await insert("blocks", [
    {
      title: "YZV406E dersi",
      kind: "class",
      starts_at: at(-20),
      ends_at: at(20),
      location: "A101",
    },
    { title: "İptal edilen", starts_at: at(-10), ends_at: at(10), status: "cancelled" },
  ]);

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "YZV406E dersi" })).toBeVisible();
  await expect(now).toContainText("bitiyor · A101");
  await expect(now.getByRole("button", { name: "Başla" })).toBeHidden();

  // The pool is still there, and the task can be started from the list.
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toContainText(
    "Sırada bekleyen iş",
  );
  const blocks = page.getByRole("region", { name: "Bugünün sabit blokları" });
  await expect(blocks.getByRole("listitem").filter({ hasText: "YZV406E dersi" })).toHaveAttribute(
    "aria-current",
    "time",
  );
  await expect(blocks).not.toContainText("İptal edilen");
});

test("a rhythm is offered while it has debt and can be ticked off", async ({ page }) => {
  const mod = await seedModule("ev-ornek", "Ev", "#16a34a");
  await insert("rhythms", {
    module_id: mod.id,
    title: "Çalışma odası süpürme",
    target_count: 2,
    period: "week",
    est_minutes: 15,
  });
  await insert("tasks", { module_id: mod.id, title: "Tarihli iş", due_at: at(60) });

  await page.goto("/");
  const list = page.getByRole("region", { name: "Sıradakiler" });
  await expect(list).toContainText("Ev · 15 dk · 0/2");
  await list.getByRole("button", { name: "Yapıldı: Çalışma odası süpürme" }).click();
  // Done once today: it is not offered a second time today.
  await expect(list).not.toContainText("Çalışma odası süpürme");
  const logs = await waitFor(
    () => rows("rhythm_logs"),
    (rows) => rows.length === 1,
  );
  expect(logs[0].session_id).toBeNull();
});

test("a module's question is shown once and answered with one touch", async ({ page }) => {
  const mod = await seedModule();
  await insert("prompts", [
    {
      module_id: mod.id,
      kind: "attendance",
      question: "YZV406E dersine girdin mi?",
      options: [
        { value: "yes", label: "Girdim" },
        { value: "no", label: "Girmedim" },
      ],
      ask_after: at(-5),
    },
    { module_id: mod.id, kind: "attendance", question: "Henüz sorulmayacak", ask_after: at(600) },
  ]);

  await page.goto("/");
  const card = page.getByRole("region", { name: "Soru" });
  await expect(card).toContainText("Okul · YZV406E dersine girdin mi?");
  await expect(page.getByRole("region", { name: "Soru" })).toHaveCount(1);
  await card.getByRole("button", { name: "Girdim" }).click();
  await expect(card).toBeHidden();

  const prompts = await waitFor(
    () => rows("prompts"),
    (list) => list.some((prompt) => prompt.status === "answered"),
  );
  expect(prompts.find((prompt) => prompt.status === "answered")).toMatchObject({
    answer: { value: "yes" },
  });
  const events = await waitFor(
    () => rows("events"),
    (list) => list.length === 1,
  );
  expect(events[0]).toMatchObject({ type: "core.prompt_answered", module_slug: null });
});

test("work of a paused module is not offered", async ({ page }) => {
  const mod = await seedModule();
  const paused = await seedModule("ev-ornek", "Ev", "#16a34a");
  await update("modules", paused.id, { status: "paused" });
  await insert("tasks", [
    { module_id: mod.id, title: "Etkin modülün işi" },
    { module_id: paused.id, title: "Duraklatılmış modülün işi" },
  ]);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Etkin modülün işi" })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Duraklatılmış modülün işi");
  await expect(page.getByRole("navigation", { name: "Modüller" }).getByRole("link")).toHaveText([
    /Okul/,
  ]);
});

test("a read that fails is not shown as an empty day", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Görünmesi gereken iş" });
  await page.route("**/rest/v1/tasks*", (route) => route.abort());
  await page.goto("/");
  const failed = page.getByRole("alert").filter({ hasText: "Veri okunamadı." });
  await expect(failed).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Bugün için planlanan bir şey yok.")).toHaveCount(0);

  await page.unroute("**/rest/v1/tasks*");
  await failed.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByRole("region", { name: "Şimdi" }).getByRole("heading")).toHaveText(
    "Görünmesi gereken iş",
  );
});

test("a write that fails is taken back on the screen and said so", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Birinci iş", due_at: at(60) },
    { module_id: mod.id, title: "İkinci iş" },
  ]);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  const upcoming = page.getByRole("region", { name: "Sıradakiler" });
  await expect(now.getByRole("heading")).toHaveText("Birinci iş");
  await expect(upcoming.getByRole("listitem")).toHaveText([/İkinci iş/]);

  // Every write of these two buttons fails, a moment after it was sent: long enough to see
  // that the screen had already changed.
  const WRITES = "**/rest/v1/rpc/**";
  await page.route(WRITES, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.abort();
  });
  const failed = page
    .getByRole("status")
    .filter({ hasText: "Kaydedilemedi. Değişiklik geri alındı." });

  // "Bitti" in the list: the row goes at once, and comes back when the write fails.
  await upcoming.getByRole("button", { name: "Bitti: İkinci iş" }).click();
  await expect(upcoming.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("1 iş bitti");
  await expect(failed).toBeVisible();
  await expect(upcoming.getByRole("listitem")).toHaveText([/İkinci iş/]);
  await expect(page.getByRole("main")).not.toContainText("1 iş bitti");
  expect((await rows("tasks")).map((task) => task.status)).toEqual(["todo", "todo"]);

  // "Başla" on the card: the clock shows at once, and the card goes back to the offer.
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
  await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();
  await expect(now.getByRole("button", { name: "Bitti" })).toHaveCount(0);
  await expect(failed).toBeVisible();
  expect(await rows("sessions")).toEqual([]);
  expect((await rows("tasks")).map((task) => task.status)).toEqual(["todo", "todo"]);

  // Once writes go through again, the same tap works.
  await page.unroute(WRITES);
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
});

test("a work item whose planned effort is used up asks; 'Devam et' goes on with it", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("work_items", {
    module_id: mod.id,
    title: "Uzayan rapor",
    effort_total_minutes: 60,
    effort_done_minutes: 60,
  });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("Ayrılan 1 sa doldu. Bitti mi?");
  await now.getByRole("button", { name: "Devam et" }).click();

  // The item is not closed; a new sitting is running on it.
  await expect(now.getByRole("button", { name: "Durdur" })).toBeVisible();
  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  expect(session.ended_at).toBeNull();
  const [item] = await rows("work_items");
  expect(item.status).toBe("active");
  const [sitting] = await rows("tasks");
  expect(sitting).toMatchObject({ work_item_id: item.id, status: "doing" });
});
