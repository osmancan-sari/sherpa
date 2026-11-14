import type { Page } from "@playwright/test";
import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { recordSpeech, spoken } from "./scene-helpers";

// Rutin, step 1 (docs/moduller/rutin.md, "Adım 1 · Temel", criteria 1–5 and 8, 10): the three
// rhythms on switch-on, the morning as one chain, the step scene (sub-steps, the timed one, its
// hold, its reload), the records, the morning's end ("İyi günler"), the evening's bed
// ("Yatıyorum", "İyi geceler", "Geri al"), the waking from outside (Günaydın), the module page.
// Hours are YESTERDAY's, as in chains.spec.ts: the browser's clock is never ahead of the
// database's. The bedtime's undo runs on the real clock (the database counts its 10 minutes).

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const DAY = istanbulDay(-1);
const dayAt = (time: string, day = DAY) => new Date(`${day}T${time}:00+03:00`);
const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

type Row = Record<string, unknown> & { id: string };

async function switchOn(page: Page) {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
  await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
}

/** The frame on (08:00–19:00 day), the module on, the day woken at 07:00 unless told otherwise. */
async function setUp(
  page: Page,
  frame: Record<string, unknown> = {},
  woke: string | null = "07:00",
) {
  await switchOn(page);
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { ...FRAME, ...frame },
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
  if (woke) await insert("days", { date: DAY, woke_at: dayAt(woke).toISOString() });
}

const scene = (page: Page) => page.getByTestId("rutin-scene");
const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const open = async () => (await rows("sessions")).filter((row) => row.ended_at === null);
const rhythmOf = async (key: string) =>
  (await rows("rhythms")).find((row) => row.key === `rutin:${key}`) as Row;
const runOf = async (key: string) => {
  const routine = (await rows("rutin_routines")).find((row) => row.key === key) as Row;
  return (await rows("rutin_runs")).find((row) => row.routine_id === routine.id) as Row | undefined;
};
const records = async () => rows("rutin_run_steps");
const stepId = async (title: string, routineKey?: string) => {
  const routines = await rows("rutin_routines");
  const list = (await rows("rutin_steps")).filter(
    (row) =>
      row.title === title &&
      (!routineKey ||
        row.routine_id === (routines.find((routine) => routine.key === routineKey) as Row).id),
  );
  return (list[0] as Row).id;
};

test("switching on proposes the three rhythms; after the waking the morning is one chain that goes on by itself", async ({
  page,
}) => {
  await setUp(page);
  const rhythms = await rows("rhythms");
  expect(
    rhythms.map((row) => [row.key, row.title, (row.timing as { order: number }).order]).sort(),
  ).toEqual([
    ["rutin:aksam", "Akşam kapanışı", 10],
    ["rutin:hazirlik", "Duş ve hazırlık", 30],
    ["rutin:sabah", "Sabah", 10],
  ]);

  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Sabah" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText(
    "Sabah dizisi 1/2 · sırada Duş ve hazırlık",
  );
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();

  // The scene, as 8.2 lays it out: the step, its sub-steps, what comes next; m = 6 alone.
  await expect(scene(page)).toHaveAttribute("data-screen", "adim");
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
  await expect(page.getByTestId("rutin-count")).toHaveText(/1 \/ 6$/);
  await expect(page.getByTestId("rutin-part-count")).toHaveText("1 / 4");
  const panel = scene(page).getByRole("region", { name: "Bu adımda" });
  await expect(panel).toContainText("Su jeti");
  await expect(panel).toContainText("Fırçala · 2 dk");
  // The board's list: the whole morning, the current step marked.
  const chain = page.getByTestId("rutin-chain");
  await expect(chain).toContainText("BU SABAH");
  await expect(chain.locator('[data-state="current"]')).toContainText("Diş bakımı");

  // "Atla" skips the step; on the next one "Hepsini yaptım" closes the block: done, in bulk.
  await scene(page).getByRole("button", { name: "Atla" }).click();
  await expect(scene(page).getByRole("heading", { name: "Bir bardak su" })).toBeVisible();
  await expect(page.getByTestId("rutin-count")).toHaveText(/2 \/ 6$/);
  await scene(page).getByRole("button", { name: "Sonraki" }).click();

  // The block ends, the chain goes on: "Duş ve hazırlık" starts by itself, its scene comes.
  const ready = await rhythmOf("hazirlik");
  await waitFor(open, (list) => list.length === 1 && list[0].rhythm_id === ready.id);
  await expect(scene(page)).toHaveAttribute("data-routine", "hazirlik");
  await expect(scene(page).getByRole("heading", { name: "Duş" })).toBeVisible();
  await expect(page.getByTestId("rutin-count")).toHaveText(/3 \/ 6$/);

  // The morning's records: the teeth skipped, the water done; the basic steps not all done.
  const morning = await waitFor(
    () => runOf("sabah"),
    (run) => Boolean(run?.finished_at),
  );
  expect(morning!.minimum_done).toBe(false);
  const done = await records();
  const teeth = await stepId("Diş bakımı", "sabah");
  const water = await stepId("Bir bardak su");
  expect(done.find((row) => row.step_id === teeth)).toMatchObject({ result: "skipped" });
  expect(done.find((row) => row.step_id === water)).toMatchObject({ result: "done" });

  // "Hepsini yaptım": the rest done, in bulk, and the basic steps of the block all done.
  await scene(page).getByRole("button", { name: "Hepsini yaptım" }).click();
  const hazirlik = await waitFor(
    () => runOf("hazirlik"),
    (run) => Boolean(run?.finished_at),
  );
  expect(hazirlik!.minimum_done).toBe(true);
  const bulk = (await records()).filter((row) => row.run_id === hazirlik!.id);
  // Duş, its add-on Dercos (due: never done), SPF, Giyin, Yürüyüş.
  expect(bulk).toHaveLength(5);
  expect(bulk.every((row) => row.result === "done" && row.bulk === true)).toBe(true);
  // The morning is over: no session runs, the scene is gone.
  await waitFor(open, (list) => list.length === 0);
  await expect(scene(page)).toBeHidden();
});

test("another module's wake-bound work counts in the morning and its own scene comes between (m = 7)", async ({
  page,
}) => {
  await setUp(page);
  const [deneme] = await insert<Row>("modules", {
    slug: "deneme",
    name: "Deneme",
    color: "#7c3aed",
  });
  const [neck] = await insert<Row>("tasks", {
    module_id: deneme.id,
    title: "Boyun hareketleri",
    est_minutes: 10,
    facet: "sabah",
    timing: { anchor: "wake", order: 20 },
  });
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await expect(page.getByTestId("rutin-count")).toHaveText(/1 \/ 7$/);
  const neckRow = page.getByTestId("rutin-chain").locator('[data-mine="false"]');
  await expect(neckRow).toContainText("Boyun hareketleri");
  await expect(neckRow).toContainText("Deneme · 10 dk");

  await scene(page).getByRole("button", { name: "Hepsini yaptım" }).click();
  // The chain's next work is the test module's: its own scene.
  await waitFor(open, (list) => list.length === 1 && list[0].task_id === neck.id);
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Bitti" }).click();
  // Back in the morning: the shower, the fourth of seven.
  await expect(scene(page)).toHaveAttribute("data-routine", "hazirlik");
  await expect(page.getByTestId("rutin-count")).toHaveText(/4 \/ 7$/);
});

test("the timed sub-step: held before its time, it runs out into the next one and says its name; a reload finds it", async ({
  page,
}) => {
  await recordSpeech(page);
  await setUp(page);
  await page.clock.install({ time: dayAt("07:02") });
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await expect(scene(page)).toHaveAttribute("data-part", "0");
  await scene(page).getByRole("button", { name: "Sonraki" }).click();
  await expect(scene(page)).toHaveAttribute("data-part", "1");

  // "Fırçala": two minutes; until then the main button asks to be held, a tap does nothing.
  const hold = page.getByTestId("rutin-hold");
  await expect(hold).toHaveText("Erken geç · basılı tut");
  await hold.click();
  await page.clock.runFor(1000);
  await expect(scene(page)).toHaveAttribute("data-part", "1");
  await expect(page.getByTestId("rutin-timer")).toHaveText(/^01:5\d$/);

  // Half a minute on, the page is reloaded: the timer goes on from its stored start.
  await page.clock.runFor(30_000);
  await page.reload();
  await expect(page.getByTestId("rutin-timer")).toHaveText(/^01:2\d$/);
  // Only a touched screen speaks: the phone is in the hand again.
  await scene(page).getByRole("heading", { name: "Diş bakımı" }).click();

  // It runs out: "Dil" by itself, said aloud on this touched screen.
  await page.clock.runFor(92_000);
  await expect(scene(page)).toHaveAttribute("data-part", "2");
  await expect.poll(() => spoken(page)).toContain("Dil");
  const run = await runOf("sabah");
  expect(run).toMatchObject({ step_position: 0, part_position: 2 });
});

test("holding the main button passes a timed sub-step early", async ({ page }) => {
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await scene(page).getByRole("button", { name: "Sonraki" }).click();
  const hold = page.getByTestId("rutin-hold");
  await expect(hold).toBeVisible();
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();
  await expect(scene(page)).toHaveAttribute("data-part", "2");
});

test("the morning's last step says Bitti; then İyi günler, then the Today screen", async ({
  page,
}) => {
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:40"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await scene(page).getByRole("button", { name: "Hepsini yaptım" }).click();
  await expect(scene(page)).toHaveAttribute("data-routine", "hazirlik");
  // Straight to the walk (the last step).
  const run = await waitFor(
    () => runOf("hazirlik"),
    (row) => Boolean(row),
  );
  await update("rutin_runs", run!.id, { step_position: 3, part_position: 0 });
  await expect(scene(page).getByRole("heading", { name: "Yürüyüş" })).toBeVisible();
  await expect(scene(page).getByRole("button", { name: "Hepsini yaptım" })).toBeHidden();
  await scene(page).getByRole("button", { name: "Bitti" }).click();
  await expect(scene(page)).toHaveAttribute("data-screen", "iyi-gunler");
  await expect(scene(page).getByRole("heading", { name: "İyi günler" })).toBeVisible();
  await waitFor(open, (list) => list.length === 0);
  await expect(scene(page)).toBeHidden();
  const records = (await rows("rutin_run_steps")).filter((row) => row.run_id === run!.id);
  // The walk's own record (the board's clock is held still here, so its seconds are 0).
  const walk = await stepId("Yürüyüş");
  expect(records.find((row) => row.step_id === walk)).toMatchObject({ result: "done" });
});

test("Uyandım on this screen skips Günaydın: the teeth and the day's summary come at once", async ({
  page,
}) => {
  await recordSpeech(page);
  await setUp(page, { start_on_wake: true }, null);
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Uyandım" }).click();
  await expect(scene(page)).toHaveAttribute("data-screen", "adim");
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
  await expect.poll(async () => (await spoken(page)).join(" ")).toContain("Günaydın.");
});

test("a waking told from outside shows Günaydın; Kalktım brings the teeth and tells the day", async ({
  page,
}) => {
  await recordSpeech(page);
  // The phone's automation wrote the waking before the app came to the front (as core/wake does).
  await setUp(page, { start_on_wake: true }, "06:58");
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-screen", "gunaydin");
  await expect(scene(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  expect(await spoken(page)).toEqual([]);
  await scene(page).getByRole("button", { name: "Kalktım" }).click();
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
  await expect.poll(async () => (await spoken(page)).join(" ")).toContain("Günaydın.");
});

test("Yatıyorum writes the bedtime, İyi geceler stays after a reload, Geri al opens the last step again", async ({
  page,
}) => {
  // The real clock: the database counts the 10 minutes from the bedtime.
  await switchOn(page);
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, { day_frame: FRAME });
  const evening = await rhythmOf("aksam");
  const [mod] = await rows("modules");
  await insert("sessions", {
    rhythm_id: evening.id,
    module_id: mod.id,
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  });
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-routine", "aksam");
  await expect(scene(page).getByRole("heading", { name: "Antiperspirant" })).toBeVisible();
  await expect(page.getByTestId("rutin-count")).toHaveText(/1 \/ 4$/);
  const run = await waitFor(
    () => runOf("aksam"),
    (row) => Boolean(row),
  );
  await update("rutin_runs", run!.id, { step_position: 3, part_position: 1 });
  await expect(scene(page).getByRole("heading", { name: "Telefonu salona bırak" })).toBeVisible();
  await expect(scene(page)).toContainText("Işık kapalı.");
  await expect(scene(page).getByRole("button", { name: "Atla" })).toBeHidden();
  await scene(page).getByRole("button", { name: "Yatıyorum" }).click();

  await expect(scene(page)).toHaveAttribute("data-screen", "iyi-geceler");
  await expect(scene(page).getByRole("heading", { name: "İyi geceler" })).toBeVisible();
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list.some((row) => row.bed_at !== null),
  );
  expect(day.bed_session_id).not.toBeNull();
  await waitFor(open, (list) => list.length === 0);
  // The screen goes dark; opened again, "İyi geceler" and "Geri al" are there.
  await page.reload();
  await expect(scene(page)).toHaveAttribute("data-screen", "iyi-geceler");
  await expect(page.getByTestId("rutin-owl").locator('[data-asleep="true"]')).toHaveCount(1);
  await scene(page).getByRole("button", { name: "Geri al" }).click();

  await expect(scene(page)).toHaveAttribute("data-screen", "adim");
  await expect(scene(page).getByRole("heading", { name: "Telefonu salona bırak" })).toBeVisible();
  await waitFor(open, (list) => list.length === 1);
  await waitFor(
    () => rows("days"),
    (list) => list.every((row) => row.bed_at === null),
  );
  await expect.poll(async () => (await runOf("aksam"))?.finished_at ?? null).toBeNull();
});

test("the module page: a step is renamed, lengthened, made every other day and basic; one is added, closed and deleted; the rhythm follows", async ({
  page,
}) => {
  await switchOn(page);
  await page.goto("/m/rutin");
  const morning = page.getByTestId("rutin-sabah");
  await expect(morning.getByRole("region", { name: "SABAH" })).toContainText("toplam 4 dk");
  await expect(morning.getByRole("region", { name: "DUŞ VE HAZIRLIK" })).toContainText(
    "toplam 40 dk",
  );

  // Giyin: 15 → 17 minutes, by hand; every 2 days; basic.
  await morning.getByRole("button", { name: /^Giyin \d/ }).click();
  const sheet = page.getByRole("dialog", { name: "Adımı düzenle" });
  await sheet.getByLabel("Adımın adı").fill("Giyin ve çantayı al");
  await sheet.getByRole("button", { name: "Süre: artır" }).click();
  await sheet.getByRole("button", { name: "Süre: artır" }).click();
  await expect(sheet).toContainText("Süre · elle");
  await sheet.getByRole("radio", { name: "N günde bir" }).click();
  await sheet.getByRole("button", { name: "Kaç günde bir: artır" }).click();
  await sheet.getByRole("switch", { name: "Temel adım" }).click();
  // A sub-step with a time of its own.
  await sheet.getByRole("button", { name: "+ Alt adım ekle" }).click();
  await sheet.getByLabel("Alt adımın adı").fill("Anahtar");
  await sheet.getByLabel("Alt adımın adı").press("Enter");
  await sheet.getByRole("button", { name: "Kaydet" }).click();
  await expect(sheet).toBeHidden();
  const giyin = await waitFor(
    () => rows("rutin_steps"),
    (list) => list.some((row) => row.title === "Giyin ve çantayı al"),
  );
  expect(giyin.find((row) => row.title === "Giyin ve çantayı al")).toMatchObject({
    seconds: 1020,
    seconds_auto: false,
    every_days: 3,
    minimum: true,
    parts: [{ title: "Anahtar" }],
  });
  await expect.poll(async () => (await rhythmOf("hazirlik")).est_minutes).toBe(42);

  // Yürüyüş switched off on its row: 30 minutes.
  await morning.getByRole("switch", { name: "Yürüyüş açık" }).click();
  await expect.poll(async () => (await rhythmOf("hazirlik")).est_minutes).toBe(30);

  // A step added to the evening.
  await page.goto("/m/rutin/aksam");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Adım ekle" })
    .click();
  const add = page.getByRole("dialog", { name: "Adım ekle" });
  await add.getByLabel("Adımın adı").fill("Göz damlası");
  await add.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(add).toBeHidden();
  await expect(page.getByTestId("rutin-aksam")).toContainText("Göz damlası");
  await expect.poll(async () => (await rhythmOf("aksam")).est_minutes).toBe(10);

  // Deleted: the confirmation offers to close instead; "Sil" deletes.
  await page
    .getByTestId("rutin-aksam")
    .getByRole("button", { name: /^Göz damlası \d/ })
    .click();
  await page
    .getByRole("dialog", { name: "Adımı düzenle" })
    .getByRole("button", { name: "Adımı sil" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Adımı sil" });
  await expect(confirm).toContainText("Göz damlası silinsin mi?");
  await expect(confirm.getByRole("button", { name: "Kapat" })).toBeVisible();
  await confirm.getByRole("button", { name: "Sil" }).click();
  await expect(page.getByTestId("rutin-aksam")).not.toContainText("Göz damlası");
  await expect.poll(async () => (await rhythmOf("aksam")).est_minutes).toBe(9);
});

test("the scene keeps still with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  const animations = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="rutin-scene"]')!
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
  );
  expect(animations).toBe(0);
});
