import { formatMinutes, istanbulInstant } from "@/lib/date";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The planner on the Today screen (Ç3). The account's day runs from midnight to 23:59
// (tests/e2e/data.ts), so these tests do not depend on the hour they run at.

test("opening the app plans the week and the day; the first touch is the user's", async ({
  page,
}) => {
  const mod = await seedModule();
  const [item] = await insert("work_items", {
    module_id: mod.id,
    title: "Dönem projesi",
    effort_total_minutes: 180,
    session_minutes: 60,
  });

  await page.goto("/");
  // Nobody did anything: the week has its commitment, the item its sitting, the day its plan.
  const [week] = await waitFor(
    () => rows("week_plans"),
    (list) => list.length === 1,
  );
  expect(week).toMatchObject({ committed: [item.id], plan_source: "auto" });
  const sittings = await waitFor(
    () => rows("tasks"),
    (list) => list.length > 0,
  );
  expect(sittings.every((task) => task.work_item_id === item.id)).toBe(true);
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list[0]?.plan_source === "auto",
  );
  expect(day.started_at).toBeNull();
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText("Dönem projesi");
  await expect(page.getByRole("region", { name: "Günün şeridi" })).toBeVisible();

  // The first tap of the day is its start.
  await page.getByRole("heading", { name: "Bugün", exact: true }).click();
  await waitFor(
    () => rows("days"),
    (list) => list[0]?.started_at !== null,
  );
});

const at = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();
/** Today in Istanbul, as the planner keys it. */
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const tomorrow = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() + 86_400_000),
  );

test("Ertele moves the work to tomorrow; put off three times, the screen asks to split, drop or date it", async ({
  page,
}) => {
  const mod = await seedModule();
  const [often] = await insert("tasks", {
    module_id: mod.id,
    title: "Hep ertelenen",
    importance: 4,
    defer_count: 2,
  });
  await insert("tasks", { module_id: mod.id, title: "Sıradaki" });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Hep ertelenen");
  await now.getByRole("button", { name: "Ertele" }).click();
  await expect(now.getByRole("heading")).toHaveText("Sıradaki");
  const [moved] = await waitFor(
    () => rows("tasks"),
    (list) => list.some((task) => task.id === often.id && task.defer_count === 3),
  ).then((list) => list.filter((task) => task.id === often.id));
  expect(moved.planned_date).toBe(tomorrow());
  await expect(page.getByRole("region", { name: "Uyarılar" })).toContainText(
    "Hep ertelenen: 3 kez ertelendi. Böl, bırak ya da bir tarihe bağla.",
  );
  // The warning's one action takes the user to the work's module.
  await page
    .getByRole("region", { name: "Uyarılar" })
    .getByRole("link", { name: "Modüle git" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/m/${mod.slug}$`));
});

test("Takıldım closes the session and offers three ways on: a smaller step, waiting, not today", async ({
  page,
}) => {
  const mod = await seedModule();
  const [hard] = await insert("tasks", { module_id: mod.id, title: "Zor bölüm", importance: 4 });
  const [other] = await insert("tasks", { module_id: mod.id, title: "Hocaya soru" });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("button", { name: "Başla" }).click();
  await now.getByRole("button", { name: "Takıldım" }).click();
  await expect(now).toContainText("Takıldın. Nasıl devam edelim?");
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1 && list[0].ended_at !== null,
  );

  // A smaller first step: a new task of the same module, today.
  await now.getByRole("button", { name: "Adımı küçült" }).click();
  await now.getByLabel("İlk küçük adım").fill("Kaynakları bul");
  await now.getByRole("button", { name: "Kaydet" }).click();
  const [step] = await waitFor(
    () => rows("tasks"),
    (list) => list.some((task) => task.title === "Kaynakları bul"),
  ).then((list) => list.filter((task) => task.title === "Kaynakları bul"));
  expect(step).toMatchObject({ module_id: mod.id, est_minutes: 15, planned_date: today() });
  expect((await rows("tasks")).find((task) => task.id === hard.id)!.status).toBe("todo");

  // Waiting on someone: the task waits, a follow-up comes in three days.
  await page.reload();
  const card = page.getByRole("region", { name: "Sıradakiler" });
  await card.getByRole("button", { name: "Başla: Hocaya soru" }).click();
  await expect(now.getByRole("heading")).toHaveText("Hocaya soru");
  await now.getByRole("button", { name: "Takıldım" }).click();
  await now.getByRole("button", { name: "Birini bekliyorum" }).click();
  await now.getByLabel("Kimi ya da neyi bekliyorsun?").fill("Hoca");
  await now.getByRole("button", { name: "Kaydet" }).click();
  const waiting = await waitFor(
    () => rows("tasks"),
    (list) => list.some((task) => task.id === other.id && task.status === "waiting"),
  ).then((list) => list.find((task) => task.id === other.id)!);
  expect(waiting).toMatchObject({ waiting_on: "Hoca" });
  expect(waiting.follow_up_on).not.toBeNull();

  // Not today: put off to tomorrow.
  await expect(now.getByRole("heading")).toHaveText("Zor bölüm");
  await now.getByRole("button", { name: "Başla" }).click();
  await now.getByRole("button", { name: "Takıldım" }).click();
  await now.getByRole("button", { name: "Bugün değil" }).click();
  await waitFor(
    () => rows("tasks"),
    (list) => list.some((task) => task.id === hard.id && task.planned_date === tomorrow()),
  );
});

test("a waiting task's follow-up day brings a short reminder; the answer puts it back", async ({
  page,
}) => {
  const mod = await seedModule();
  const [waiting] = await insert("tasks", {
    module_id: mod.id,
    title: "Staj belgesi",
    status: "waiting",
    waiting_on: "Bölüm sekreteri",
    follow_up_on: today(),
  });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("Bölüm sekreteri bekleniyor. Takip et.");
  // Still waiting: asked again in three days.
  await now.getByRole("button", { name: "Hâlâ bekliyor" }).click();
  await waitFor(
    () => rows("tasks"),
    (list) => list[0].follow_up_on !== today(),
  );
  await expect(now).toContainText("Bugün için planlanan bir şey yok.");
  await update("tasks", waiting.id as string, { follow_up_on: today() });
  await page.reload();
  await now.getByRole("button", { name: "Cevap geldi" }).click();
  await waitFor(
    () => rows("tasks"),
    (list) => list[0].status === "todo" && list[0].id === waiting.id,
  );
  await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();
});

test("X dk'm var finds the work that fits; the keys start and finish it", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Uzun okuma", est_minutes: 60, importance: 4 },
    { module_id: mod.id, title: "Kısa mesaj", est_minutes: 15 },
  ]);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Uzun okuma");

  await page.keyboard.press("x");
  const dialog = page.getByRole("dialog", { name: "Kaç dakikan var?" });
  await dialog.getByLabel("Dakika").fill("20");
  await dialog.getByRole("button", { name: "Bul" }).click();
  await expect(dialog).toContainText("Kısa mesaj");
  await dialog.getByRole("button", { name: "Başla" }).click();
  await expect(dialog).toBeHidden();
  await expect(now.getByRole("heading")).toHaveText("Kısa mesaj");
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();

  // Space finishes what runs and starts what is offered.
  await page.keyboard.press(" ");
  await expect(now.getByRole("heading")).toHaveText("Uzun okuma");
  await page.keyboard.press(" ");
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
  const sessions = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 2,
  );
  expect(sessions.filter((session) => session.ended_at === null)).toHaveLength(1);
});

test("E puts off what is offered; R plans the day again", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Birinci", importance: 4 },
    { module_id: mod.id, title: "İkinci" },
  ]);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Birinci");
  await page.keyboard.press("e");
  await expect(now.getByRole("heading")).toHaveText("İkinci");
  await page.keyboard.press("r");
  await expect(page.getByRole("status")).toHaveText("Gün yeniden planlandı.");
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list.length === 1 && (list[0].top3 as string[]).length === 1,
  );
  expect(day.plan_source).toBe("auto");
});

test("the day is done once its three are; what is left waits behind 'Vakit kalırsa'", async ({
  page,
}) => {
  const mod = await seedModule();
  const [done] = await insert("tasks", {
    module_id: mod.id,
    title: "Bitmiş iş",
    status: "done",
    // Finished today, whatever the hour the test runs at.
    done_at: istanbulInstant(today(), "00:01").toISOString(),
    est_minutes: 30,
  });
  await insert("tasks", { module_id: mod.id, title: "Fazladan iş" });
  await insert("days", { date: today(), top3: [done.id], plan_source: "auto" });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Bugün tamam");
  await expect(now).toContainText("1 iş · 30 dk");
  await expect(page.getByLabel("Günün ilerlemesi")).toHaveText("Bugün 1/1");
  await now.getByRole("button", { name: "Vakit kalırsa" }).click();
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toContainText("Fazladan iş");
});

test("after the finish line the screen is at night and shows the first work of tomorrow", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Yarının işi" });
  // The day ended at midnight: everything after it is night.
  await insert("days", { date: today(), finish_line: "00:00", plan_source: "auto" });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("Yarın ilk iş: Yarının işi");
  await expect(now.getByRole("button", { name: "Başla" })).toHaveCount(0);
  // The night is quiet: no strip of the day, no warnings, nothing next.
  await expect(page.getByRole("region", { name: "Günün şeridi" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Uyarılar" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toContainText(
    "Sırada başka iş yok.",
  );
});

test("back after three days the screen opens on 'Kaldığın yerden devam' and piles nothing up", async ({
  page,
}) => {
  const mod = await seedModule();
  const [old] = await insert("tasks", {
    module_id: mod.id,
    title: "Eski iş",
    status: "done",
    done_at: at(-4 * 24 * 60),
  });
  await insert("sessions", {
    task_id: old.id,
    module_id: mod.id,
    started_at: at(-4 * 24 * 60 - 30),
    ended_at: at(-4 * 24 * 60),
  });
  await insert("tasks", [
    { module_id: mod.id, title: "Kaçan teslim", due_at: at(-2 * 24 * 60), importance: 4 },
    { module_id: mod.id, title: "Bekleyen okuma" },
  ]);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Kaldığın yerden devam");
  // Only the day's three are shown; there is no list of what was missed.
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toContainText(
    "Sırada başka iş yok.",
  );
  await expect(page.getByRole("region", { name: "Uyarılar" })).toHaveCount(0);
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
});

test("'Neden?' tells why this work, why now", async ({ page }) => {
  const mod = await seedModule();
  // Due at the end of today, whatever the hour the test runs at.
  await insert("tasks", {
    module_id: mod.id,
    title: "Bugün teslim",
    due_at: istanbulInstant(today(), "23:58").toISOString(),
  });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("button", { name: "Neden?" }).click();
  await expect(now.getByRole("note", { name: "Neden bu iş" })).toContainText("Son tarihi bugün.");
});

test("a session past twice its estimate asks whether it goes on; unanswered, it is closed at the estimate", async ({
  page,
}) => {
  const mod = await seedModule();
  const [asked] = await insert("tasks", {
    module_id: mod.id,
    title: "Uzayan iş",
    est_minutes: 30,
    status: "doing",
  });
  const [session] = await insert("sessions", {
    task_id: asked.id,
    module_id: mod.id,
    started_at: at(-65),
  });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("Devam ediyor musun?");
  await now.getByRole("button", { name: "Devam ediyorum" }).click();
  await expect(now).not.toContainText("Devam ediyor musun?");
  await waitFor(
    () => rows("sessions"),
    (list) => list[0].confirmed_at !== null,
  );

  // Nobody answered for half an hour: the screen closes it by itself.
  await update("sessions", session.id as string, { started_at: at(-95), confirmed_at: null });
  await page.reload();
  const [closed] = await waitFor(
    () => rows("sessions"),
    (list) => list[0].ended_at !== null,
    10_000,
  );
  expect(closed.measured).toBe(false);
  await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();
});

test("the evening closing: what was done, tomorrow's three, what is on the mind, then night", async ({
  page,
}) => {
  const mod = await seedModule();
  const [left] = await insert("tasks", {
    module_id: mod.id,
    title: "Bugünkü iş",
    planned_date: today(),
  });
  await insert("tasks", [
    { module_id: mod.id, title: "Yarın A", importance: 4 },
    { module_id: mod.id, title: "Yarın B", importance: 3 },
    { module_id: mod.id, title: "Yarın C" },
  ]);
  await page.goto("/");
  await page.getByRole("link", { name: "Günü kapat" }).click();
  await expect(page.getByRole("heading", { name: "Kapanış" })).toBeVisible();

  // 1. No open questions: on with Enter.
  await expect(page.getByRole("region", { name: "Sorular" })).toContainText(
    "Cevap bekleyen soru yok.",
  );
  await page.keyboard.press("Enter");
  // 2. One tap marks what was done today.
  await page.getByRole("button", { name: "Yaptım: Bugünkü iş" }).click();
  await waitFor(
    () => rows("tasks"),
    (list) => list.some((task) => task.id === left.id && task.status === "done"),
  );
  await page.getByRole("button", { name: "İleri" }).click();
  // Escape goes back a step.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Bugün" })).toBeVisible();
  await page.getByRole("button", { name: "İleri" }).click();
  // 3. Tomorrow's draft: "Yarın C" is taken out, "Yarın B" is not one of the three.
  const draft = page.getByRole("region", { name: "Yarın" });
  await draft.getByRole("button", { name: "Çıkar: Yarın C" }).click();
  await expect(draft).not.toContainText("Yarın C");
  const pickB = draft.getByRole("button", { name: "Günün üç işi: Yarın B" });
  await expect(pickB).toHaveAttribute("aria-pressed", "true");
  await pickB.click();
  await expect(pickB).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "İleri" }).click();
  // 4. What is on the mind goes to the inbox, a line each; Ctrl+Enter goes on from the box.
  await page.getByLabel("Aklında kalanlar").fill("perde ölçüsü\nannemi ara");
  await page.keyboard.press("Control+Enter");
  // 5. Confirm: tomorrow is kept, today goes to night.
  await expect(page.getByRole("region", { name: "Onay" })).toContainText("Yarın A");
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page).toHaveURL(/\/$/);
  const days = await waitFor(
    () => rows("days"),
    (list) => list.some((day) => day.date === tomorrow() && day.plan_source === "closing"),
  );
  const next = days.find((day) => day.date === tomorrow())!;
  expect((next.top3 as string[]).length).toBe(1);
  expect(days.find((day) => day.date === today())!.closed_at).not.toBeNull();
  expect((await rows("inbox_entries")).map((entry) => entry.raw_text).sort()).toEqual([
    "annemi ara",
    "perde ölçüsü",
  ]);
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText("Yarın ilk iş: Yarın A");
});

test("the week: the days, the capacity, the week's items, the life mode and the coming weeks", async ({
  page,
}) => {
  const mod = await seedModule();
  const [item] = await insert("work_items", {
    module_id: mod.id,
    title: "Haftanın raporu",
    effort_total_minutes: 120,
    due_at: at(2 * 24 * 60),
  });
  await page.goto("/");
  await waitFor(
    () => rows("week_plans"),
    (list) => list.length === 1,
  );
  await page.goto("/hafta");
  await expect(
    page.getByRole("region", { name: "Haftanın günleri" }).getByRole("listitem"),
  ).toHaveCount(7);
  await expect(page.getByRole("region", { name: "Kapasite" })).toContainText("kullanılabilir");
  const items = page.getByRole("region", { name: "Haftanın kalemleri" });
  await expect(items).toContainText("Haftanın raporu");
  // Its share of this week (all of it, or a part when the deadline is in the next week).
  const [plan] = await rows("week_plans");
  const share = (plan.shares as Record<string, { minutes: number }>)[item.id as string].minutes;
  await expect(items).toContainText(`0 dk / ${formatMinutes(share)} bu hafta`);
  await expect(
    page.getByRole("region", { name: "Önümüzdeki haftalar" }).getByRole("listitem"),
  ).toHaveCount(8);

  // Busy mode from today: the week is committed again in it, and Today shows the mode.
  const mode = page.getByRole("region", { name: "Hayat modu" });
  await mode.getByLabel("Mod").selectOption("busy");
  await mode.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status")).toHaveText("Hayat modu kaydedildi.");
  await waitFor(
    () => rows("week_plans"),
    (list) => list[0]?.life_mode === "busy",
    10_000,
  );
  await page.getByRole("button", { name: "Haftayı yeniden kur" }).click();
  await expect(page.getByRole("status")).toHaveText("Hafta yeniden kuruldu.");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Hayat modu: Yoğun" })).toBeVisible();
});

test("the week shows the AI's reasons and notes when it has them", async ({ page }) => {
  const mod = await seedModule();
  const [item] = await insert("work_items", {
    module_id: mod.id,
    title: "Gerekçeli kalem",
    effort_total_minutes: 90,
    due_at: at(3 * 24 * 60),
  });
  await page.goto("/");
  const [week] = await waitFor(
    () => rows("week_plans"),
    (list) => list.length === 1,
  );
  // As the AI's `week` and `review` would leave them.
  await update("week_plans", week.id as string, {
    reasons: { [item.id as string]: "Bu hafta teslim." },
  });
  await insert("weekly_reviews", {
    week_start: week.week_start,
    summary: {
      summary: "Bu hafta iki modülde çalışıldı.",
      suggestions: ["Pazartesi erken başla."],
      mode: null,
    },
  });
  await page.goto("/hafta");
  await expect(page.getByRole("region", { name: "Haftanın kalemleri" })).toContainText(
    "Bu hafta teslim.",
  );
  const notes = page.getByRole("region", { name: "Yapay zekanın notları" });
  await expect(notes).toContainText("Bu hafta iki modülde çalışıldı.");
  await expect(notes).toContainText("Pazartesi erken başla.");
});
