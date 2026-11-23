import { insert, rows, update, waitFor } from "./data";
import { runAt } from "./clock";
import { expect, test } from "./fixtures";
import { roomInTheDay, STORAGE_STATE } from "./helpers";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// Okul çekirdek A (prompts/okul-cekirdek-a.md): the core's general abilities a school module
// asked for, tried on the "deneme" module's examples.

test("a scene's own backdrop takes the facet's resolved colour, and the new one after a change", async ({
  page,
}) => {
  await activateDeneme(page);
  const [mod] = await rows("modules");
  await update("modules", mod.id as string, { facet_colors: { sabah: "#0d9488" } });
  await addRecord(page, "Sabah esnemesi", { minutes: "20", facet: "sabah" });
  await startFromModule(page, "Sabah esnemesi");
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  const backdrop = page.getByTestId("deneme-backdrop").filter({ visible: true }).first();
  await expect(backdrop).toHaveAttribute("data-color", "#0d9488");
  // The colour changed in Ayarlar: the scene stands on the new one (live: sync.spec.ts).
  await update("modules", mod.id as string, { facet_colors: { sabah: "#db2777" } });
  await page.reload();
  await expect(backdrop).toHaveAttribute("data-color", "#db2777");
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
});

test("a placeholder effort: 'yaklaşık' on the module page, Bugün and Takvim; Neden? says why; the real minutes take it away", async ({
  page,
}) => {
  await roomInTheDay(page);
  await activateDeneme(page);
  await page.goto("/m/deneme");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Yer tutucu örnek" })
    .click();
  const [item] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  expect(item).toMatchObject({
    effort_provisional: true,
    effort_basis: "Benzer deneme kayıtları bir ile dört saat arasında sürdü.",
  });
  const upcoming = page.getByRole("region", { name: "Yaklaşanlar" });
  await expect(upcoming).toContainText("Örnek sınav hazırlığı");
  await expect(upcoming).toContainText("yaklaşık");

  // Bugün: the card's minutes are "yaklaşık", and "Neden?" says what they rest on.
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "Örnek sınav hazırlığı" })).toBeVisible();
  await expect(now).toContainText("yaklaşık");
  await now.getByRole("button", { name: "Neden?" }).click();
  await expect(now.getByRole("note", { name: "Neden bu iş" })).toContainText(
    "Süre yaklaşık: Benzer deneme kayıtları bir ile dört saat arasında sürdü.",
  );

  // Takvim: due next week; its row there says "yaklaşık".
  await page.goto("/takvim");
  await page.getByRole("button", { name: "Sonraki hafta" }).click();
  const minutes = page.getByTestId("week-work-minutes").filter({ visible: true });
  await expect(minutes.first()).toContainText("yaklaşık");

  // The module learns the real length: the mark goes, the effort is the module's.
  const [record] = await rows("deneme_items");
  await page.goto(`/m/deneme/kayit/${record.id}`);
  await page.getByRole("button", { name: "Süreyi kesinleştir: 2 sa" }).click();
  const [settled] = await waitFor(
    () => rows("work_items"),
    (list) => list[0]?.effort_provisional === false,
  );
  expect(settled).toMatchObject({ effort_total_minutes: 120, effort_basis: null });
  expect((settled.provenance as Record<string, string>).effort_total_minutes).toBe("module");
  await page.goto("/m/deneme");
  await expect(upcoming).toContainText("Örnek sınav hazırlığı");
  await expect(upcoming).not.toContainText("yaklaşık");
});

/** Moves the running session's start back by `minutes`, as if it had been running that long. */
async function runningFor(minutes: number) {
  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.some((row) => row.ended_at === null),
  );
  await update("sessions", session.id as string, {
    started_at: new Date(Date.now() - minutes * 60_000).toISOString(),
  });
  return session.id as string;
}

test("the pomodoro layout: a break, Molayı bitir, the same state after a reload and on another device, Turu atla, Süre doldu, +5 dk; the focus minutes count", async ({
  page,
  browser,
  baseURL,
}) => {
  // The page's clock is the real one: the session's start is the database's.
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Konu okuma", { kind: "pomodoro", minutes: "120" });
  await startFromModule(page, "Konu okuma");
  const scene = page.getByTestId("deneme-pomodoro");
  const ring = page.getByTestId("pomodoro-ring");
  await expect(ring).toHaveAttribute("data-phase", "focus");
  await expect(scene.getByRole("timer", { name: "Odak" })).toBeVisible();
  await expect(scene.getByTestId("session-sections")).toContainText("Oku: birinci bölüm");
  // The strip: elapsed over the sitting's 45 minutes.
  await expect(page.getByTestId("strip-minutes")).toHaveText("· 0 dk / 45 dk");

  // 26 minutes in: the first round's focus ran out at 25, its break began then.
  const sessionId = await runningFor(26);
  await page.reload();
  await expect(ring).toHaveAttribute("data-phase", "break");
  await expect(scene.getByRole("timer", { name: "Kısa mola" })).toHaveText(/^01:0\d$/);
  await expect(page.getByTestId("layout-line")).toContainText("1 / 2 tur bitti");
  await scene.getByRole("button", { name: "+5 dk" }).click();
  await expect(scene).toContainText("10 dk");
  await scene.getByRole("button", { name: "Molayı bitir" }).click();
  await expect(ring).toHaveAttribute("data-round", "2");
  await expect(ring).toHaveAttribute("data-phase", "focus");
  await waitFor(
    () => rows("deneme_items"),
    (list) => (list[0]?.layout_state as { round?: number } | null)?.round === 2,
  );

  // A reload and the other device: the same round, from the record.
  await page.reload();
  await expect(ring).toHaveAttribute("data-round", "2");
  await expect(page.getByTestId("layout-line")).toContainText("tur 2 / 2 · son tur");
  const phone = await browser.newContext({
    baseURL,
    storageState: STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  const other = await phone.newPage();
  await other.goto("/");
  await expect(other.getByTestId("pomodoro-ring")).toHaveAttribute("data-round", "2");
  await expect(other.getByTestId("pomodoro-ring")).toHaveAttribute("data-phase", "focus");
  await phone.close();

  // Turu atla in the last round: the time is up; +5 dk gives it more.
  await scene.getByRole("button", { name: "Turu atla" }).click();
  const card = page.getByTestId("time-up");
  await expect(card).toContainText("Süre doldu.");
  await card.getByRole("button", { name: "+5 dk" }).click();
  await expect(card).toHaveCount(0);

  // "Oturumu bitir": "Oturum bitti.", then the session ends with the focus minutes (the break
  // left out). The page's clock is the real one here: the database checks the minutes against it.
  await scene.getByRole("button", { name: "Oturumu bitir" }).click();
  await expect(page.getByTestId("session-end")).toHaveText("Oturum bitti.");
  await expect(page.getByTestId("scene")).toBeHidden();
  const [ended] = await waitFor(
    () => rows("sessions"),
    (list) => list.find((row) => row.id === sessionId)?.ended_at !== null,
  );
  // The 25 minutes of the first round and the moments of the second: never the 26 of the wall
  // clock with the break.
  expect(ended.counted_minutes).toBe(25);
  const [item] = await rows("work_items");
  expect(item.effort_done_minutes).toBe(25);
});

test("the flow layout: a break counts up and is no work; Süre doldu at the planned time; Bitir tells the worked minutes", async ({
  page,
}) => {
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Ödev kodu", { kind: "akis", minutes: "30" });
  await startFromModule(page, "Ödev kodu");
  const clock = page.getByTestId("flow-clock");
  await expect(clock).toContainText("mola vermeden");
  await runningFor(20);
  await page.reload();
  await expect(clock.getByRole("timer", { name: "Akış" })).toHaveText(/^20:0\d$/);
  await page.getByRole("button", { name: "Mola ver" }).click();
  await expect(clock).toHaveAttribute("data-break", "");
  await expect(clock).toContainText("çalışılan 20 dk · mola süreye sayılmaz");
  await page.clock.fastForward("03:00");
  await expect(clock.getByRole("timer", { name: "Mola" })).toHaveText(/^03:0\d$/);
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(clock).toContainText("çalışılan 20 dk");
  // The planned 30 minutes of work come ten minutes later, the break not counted.
  await page.clock.fastForward("09:00");
  await expect(page.getByTestId("time-up")).toHaveCount(0);
  await page.clock.fastForward("01:10");
  await expect(page.getByTestId("time-up")).toContainText("Süre doldu.");
});

test("the way out's note: Çık and the scene's ending ask Nerede kaldın?; written, skipped, offline and a failing module never hold the way out; Space too", async ({
  page,
}) => {
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Ödev kodu", { kind: "akis", minutes: "60" });
  await startFromModule(page, "Ödev kodu");
  const scene = page.getByTestId("scene");
  const strip = page.getByLabel("Sahne şeridi");
  const note = page.getByTestId("exit-note");
  const now = page.getByRole("region", { name: "Şimdi" });
  const backToScene = async () => {
    await now.getByRole("button", { name: "Sahneye dön" }).click();
    await expect(page.getByTestId("deneme-flow")).toBeVisible();
  };

  // The shell's "Çık": the question in the counter's place (the board); written and kept.
  await strip.getByRole("button", { name: "Çık" }).click();
  await expect(page.getByTestId("exit-note-card")).toContainText("Nerede kaldın?");
  await expect(page.getByTestId("flow-clock")).toHaveCount(0);
  await note.getByRole("textbox").fill("Merge yazıldı; test 3 geçmiyor");
  await note.getByRole("button", { name: "Kaydet ve çık" }).click();
  await expect(scene).toBeHidden();
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0]?.exit_note === "Merge yazıldı; test 3 geçmiyor",
  );
  // The session goes on; back in the scene the line is where it stood.
  expect((await rows("sessions")).filter((row) => row.ended_at === null)).toHaveLength(1);
  await backToScene();
  await expect(page.getByTestId("resume-note")).toContainText("Merge yazıldı; test 3 geçmiyor");

  // Offline: no question, the way out goes on.
  await page.context().setOffline(true);
  await strip.getByRole("button", { name: "Çık" }).click();
  await expect(note).toHaveCount(0);
  await expect(scene).toBeHidden();
  await page.context().setOffline(false);
  await backToScene();

  // A module that fails to keep the line: the way out goes on, the old line stays.
  await strip.getByRole("button", { name: "Çık" }).click();
  await note.getByRole("textbox").fill("[hata] kaydedilmesin");
  await note.getByRole("button", { name: "Kaydet ve çık" }).click();
  await expect(scene).toBeHidden();
  expect((await rows("deneme_items"))[0].exit_note).toBe("Merge yazıldı; test 3 geçmiyor");
  await backToScene();

  // Space ("Bitti") asks too; "Yazmadan çık" ends the session in one tap, the line untouched.
  await page.getByTestId("deneme-flow").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(" ");
  await expect(note).toBeVisible();
  await note.getByRole("button", { name: "Yazmadan çık" }).click();
  await expect(scene).toBeHidden();
  await waitFor(
    () => rows("sessions"),
    (list) => list.every((row) => row.ended_at !== null),
  );
  expect((await rows("deneme_items"))[0].exit_note).toBe("Merge yazıldı; test 3 geçmiyor");
});

test("a fixed block the module proposed opens its view from Bugün, the day's flow and Takvim; no session; a block added by hand does not", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Seminer", { kind: "etkinlik", minutes: "60" });
  const [block] = await waitFor(
    () => rows("blocks"),
    (list) => list.length === 1,
  );
  // The block runs now: ten minutes in, fifty to go.
  await update("blocks", block.id as string, { starts_at: runAt(-10), ends_at: runAt(50) });
  const [mod] = await rows("modules");
  await insert("blocks", {
    module_id: mod.id,
    title: "Elle eklenen",
    kind: "appointment",
    starts_at: runAt(120),
    ends_at: runAt(150),
  });

  // Bugün: the Now card has one action while the block runs.
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("link", { name: "Etkinliği aç" }).click();
  await expect(page).toHaveURL(new RegExp(`/\?blok=${block.id}$`));
  const view = page.getByTestId("block-view");
  await expect(view).toBeVisible();
  await expect(page.getByTestId("deneme-block-view")).toHaveAttribute("data-phase", "during");
  // The strip: no minutes, the module's few words.
  await expect(page.getByTestId("strip-title")).toHaveText("Seminer");
  await expect(page.getByTestId("strip-minutes")).toHaveText("· sürüyor");
  // The module writes its own line; the core keeps nothing, and no session runs.
  await view.getByRole("textbox").fill("Sunum slaytları paylaşılacak");
  await view.getByRole("button", { name: "Not al" }).click();
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0]?.block_note === "Sunum slaytları paylaşılacak",
  );
  // A reload keeps the view (the address names the block).
  await page.reload();
  await expect(page.getByTestId("block-note")).toHaveText("Sunum slaytları paylaşılacak");
  await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(view).toHaveCount(0);
  expect(await rows("sessions")).toEqual([]);

  // The day's flow: the block's piece opens the view; the hand-added block's piece does not.
  const pieces = page.getByTestId("strip-block");
  await expect(pieces).toHaveCount(2);
  await expect(page.locator('[data-testid="strip-block"][data-opens]')).toHaveCount(1);
  await page.locator('[data-testid="strip-block"][data-opens]').click();
  await expect(view).toBeVisible();
  await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();

  // Takvim: today's fixed blocks; only the proposed one is a link.
  await page.goto("/takvim");
  await page
    .getByRole("region", { name: "Haftanın günleri" })
    .locator('[aria-current="date"]')
    .click();
  const detail = page.getByRole("region", { name: "Günün ayrıntısı" });
  await expect(detail.getByRole("link", { name: /Seminer/ })).toBeVisible();
  await expect(detail.getByRole("link", { name: /Elle eklenen/ })).toHaveCount(0);
  await detail.getByRole("link", { name: /Seminer/ }).click();
  await expect(page).toHaveURL(new RegExp(`/\?blok=${block.id}$`));
  await expect(view).toBeVisible();
  expect(await rows("sessions")).toEqual([]);
});

test("the flow layout's break holds after a reload and on another device; Bitir tells the worked minutes; the next sitting starts fresh", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Proje kodu", { kind: "akis", minutes: "120" });
  await startFromModule(page, "Proje kodu");
  const sessionId = await runningFor(20);
  await page.reload();
  const clock = page.getByTestId("flow-clock");
  await page.getByRole("button", { name: "Mola ver" }).click();
  await expect(clock).toHaveAttribute("data-break", "");
  await waitFor(
    () => rows("deneme_items"),
    (list) => (list[0]?.layout_state as { breakSince?: string | null } | null)?.breakSince != null,
  );
  // A reload and the other device: still on the break, the same worked minutes.
  await page.reload();
  await expect(clock).toHaveAttribute("data-break", "");
  await expect(clock).toContainText("çalışılan 20 dk");
  const phone = await browser.newContext({
    baseURL,
    storageState: STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  const other = await phone.newPage();
  // The other device's clock is the real one too (a new context starts at the run's moment).
  await other.clock.setSystemTime(new Date());
  await other.goto("/");
  await expect(other.getByTestId("flow-clock")).toHaveAttribute("data-break", "");
  await expect(other.getByTestId("flow-clock")).toContainText("çalışılan 20 dk");
  await phone.close();

  // Bitir from the break: the note is skipped, the session ends with 20 worked minutes.
  await page.getByRole("button", { name: "Bitir" }).click();
  await page.getByTestId("exit-note").getByRole("button", { name: "Yazmadan çık" }).click();
  await expect(page.getByTestId("scene")).toBeHidden();
  const ended = await waitFor(
    () => rows("sessions"),
    (list) => list.find((row) => row.id === sessionId)?.ended_at != null,
  );
  expect(ended.find((row) => row.id === sessionId)?.counted_minutes).toBe(20);
  const [item] = await rows("work_items");
  expect(item.effort_done_minutes).toBe(20);

  // The next sitting of the same record does not go on from the last one's state.
  await startFromModule(page, "Proje kodu");
  await expect(clock).toContainText("mola vermeden");
  await expect(clock.getByRole("timer", { name: "Akış" })).toHaveText(/^00:0\d$/);
});
