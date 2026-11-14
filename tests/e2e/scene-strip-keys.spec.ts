import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// Ç3g (docs/06-modul-sozlesmesi.md, "Sahne" rules 2 and 3a): a scene sets what the core's strip
// says and may leave it out on a screen; a scene that says so takes the Today keys. The examples
// are the "deneme" module's scenes. Scenes that do neither keep the strip and the keys as they
// were (the earlier specs, unchanged).

const strip = 'header[aria-label="Sahne şeridi"]';

test("the strip: the scene's own name, minutes from the waking or none, and no strip at all on a screen", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Sabah esnemesi", { minutes: "20", facet: "sabah" });
  await addRecord(page, "Akşam günlüğü", { minutes: "20", facet: "aksam" });

  // The morning scene names its facet; without a waking it shows no minutes.
  await startFromModule(page, "Sabah esnemesi");
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await expect(page.getByTestId("strip-title")).toHaveText("Sabah");
  await expect(page.getByTestId("strip-minutes")).toBeHidden();

  // The evening scene keeps the core's strip until it hides it, and gets it back.
  await startFromModule(page, "Akşam günlüğü");
  await expect(page.getByTestId("deneme-gece")).toBeVisible();
  await expect(page.getByTestId("strip-title")).toHaveText("Akşam günlüğü");
  await expect(page.getByTestId("strip-minutes")).toHaveText("· 0 dk");
  await page.getByRole("button", { name: "Şeridi gizle" }).click();
  await expect(page.locator(strip)).toHaveCount(0);
  await page.getByRole("button", { name: "Şeridi göster" }).click();
  await expect(page.locator(strip)).toHaveCount(1);
  await expect(page.getByTestId("strip-title")).toHaveText("Akşam günlüğü");
});

test("a scene that takes the keys: Space is the workout's next step, not the core's Bitti", async ({
  page,
}) => {
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Salon", { kind: "antrenman", minutes: "45" });
  await startFromModule(page, "Salon");
  const scene = page.getByTestId("deneme-workout");
  await expect(scene.getByRole("heading", { name: "Isınma" })).toBeVisible();
  await expect(page.getByTestId("scene")).toHaveAttribute("data-scene-keys", "");
  await scene.getByRole("heading", { name: "Isınma" }).click();
  await page.keyboard.press(" ");
  await expect(scene.getByRole("heading", { name: "Squat" })).toBeVisible();
  await page.keyboard.press(" ");
  await expect(scene.getByRole("heading", { name: "Şınav" })).toBeVisible();
  // The session is the same one: Space ended nothing.
  const open = (await rows("sessions")).filter((row) => row.ended_at === null);
  expect(open).toHaveLength(1);
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0]?.scene_step === 2,
  );
  // Space while typing is the field's: nothing moves.
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill("not ");
  await expect(dialog.getByLabel("Giriş")).toHaveValue("not ");
  await page.keyboard.press("Escape");
  await expect(scene.getByRole("heading", { name: "Şınav" })).toBeVisible();
});

test("a focus scene that takes the keys keeps Space as Bitti, its own now", async ({ page }) => {
  await activateDeneme(page);
  await addRecord(page, "Okuma notları", { minutes: "30", kind: "odak" });
  await startFromModule(page, "Okuma notları");
  await expect(page.getByTestId("deneme-focus")).toBeVisible();
  await page.getByTestId("deneme-focus").getByRole("heading").click();
  await page.keyboard.press(" ");
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1 && list[0].ended_at !== null,
  );
  await expect(page.getByTestId("scene")).toBeHidden();
});

test("a scene reads the core's day: the session's planning day past midnight, where the waking came from, tomorrow's waking", async ({
  page,
}) => {
  const day = (offset: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.now() + offset * 86_400_000),
    );
  const yesterday = day(-1);
  const before = day(-2);
  const at = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);
  /** The day's row as given (the screens may have written one already). */
  const putDay = async (date: string, fields: Record<string, unknown>) => {
    const known = (await rows("days")).find((row) => row.date === date);
    if (known) await update("days", known.id as string, fields);
    else await insert("days", { date, ...fields });
  };
  await activateDeneme(page);
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  await putDay(before, { woke_at: at(before, "07:00").toISOString(), woke_source: "outside" });
  const [mod] = await rows("modules");
  const [task] = await insert<{ id: string }>("tasks", {
    module_id: mod.id,
    title: "Gece notu",
    est_minutes: 20,
    facet: "aksam",
  });
  // Started at 00:20: the evening's day, the night before.
  await insert("sessions", {
    task_id: task.id,
    module_id: mod.id,
    started_at: at(yesterday, "00:20").toISOString(),
  });
  await page.clock.setFixedTime(at(yesterday, "00:30"));
  await page.goto("/");
  await expect(page.getByTestId("deneme-gece")).toBeVisible();
  await expect(page.getByTestId("scene-day")).toContainText(`Gün ${before}`);
  await expect(page.getByTestId("scene-day")).toContainText(/yarın uyanış \d\d:\d\d · uyku/);

  // The morning's scene says the waking came from outside.
  await update("sessions", (await rows("sessions"))[0].id as string, {
    ended_at: at(yesterday, "00:40").toISOString(),
  });
  await putDay(yesterday, {
    woke_at: at(yesterday, "07:00").toISOString(),
    woke_source: "outside",
  });
  const [morning] = await insert<{ id: string }>("tasks", {
    module_id: mod.id,
    title: "Sabah notu",
    est_minutes: 20,
    facet: "sabah",
  });
  await insert("sessions", {
    task_id: morning.id,
    module_id: mod.id,
    started_at: at(yesterday, "07:10").toISOString(),
  });
  await page.clock.setFixedTime(at(yesterday, "07:15"));
  await page.goto("/");
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await expect(page.getByTestId("scene-day")).toContainText(`Gün ${yesterday} · uyanış dışarıdan`);
});
