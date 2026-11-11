import type { Page } from "@playwright/test";
import { rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Quick add: one box, two uses. Every entry is at most two touches or one sentence.

async function openQuickAdd(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await expect(dialog.getByLabel("Giriş")).toBeFocused();
  return dialog;
}

test("free use: Enter without picking anything puts the text in the inbox", async ({ page }) => {
  await seedModule();
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("çamaşır birikti");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Gelen kutusuna eklendi.");

  await page
    .getByRole("navigation", { name: "Ana gezinme" })
    .getByRole("link", { name: "Gelen kutusu" })
    .click();
  await expect(page.getByRole("main").getByText("çamaşır birikti")).toBeVisible();

  const entries = await waitFor(
    () => rows("inbox_entries"),
    (list) => list.length === 1,
  );
  expect(entries[0]).toMatchObject({ raw_text: "çamaşır birikti", status: "new" });
  expect(await rows("tasks")).toHaveLength(0);
});

test("structured use: one sentence, Tab, Enter makes a task with its date and length", async ({
  page,
}) => {
  const mod = await seedModule();
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("Sunum slaytları yarın 45dk");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Okul" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // The words at the end of the line were read as the date and the length.
  await expect(dialog.getByLabel("Süre (dk)")).toHaveValue("45");
  await expect(dialog.getByLabel("Tarih")).not.toHaveValue("");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  // The task is on the Today screen at once, as the suggestion.
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "Sunum slaytları" })).toBeVisible();
  await expect(now).toContainText("45 dk");

  const tasks = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
  );
  expect(tasks[0]).toMatchObject({
    title: "Sunum slaytları",
    module_id: mod.id,
    est_minutes: 45,
    status: "todo",
  });
  const due = new Date(tasks[0].due_at as string);
  const tomorrow = new Date(Date.now() + 24 * 3_600_000);
  const dayIn = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date);
  expect(dayIn(due)).toBe(dayIn(tomorrow));
  expect(await rows("inbox_entries")).toHaveLength(0);
});

test("a task longer than 90 minutes cannot be saved; the interface offers a work item", async ({
  page,
}) => {
  const mod = await seedModule();
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("Dönem raporu 3s");
  await dialog.getByRole("button", { name: "Okul" }).click();
  await expect(dialog.getByLabel("Süre (dk)")).toHaveValue("180");
  await dialog.getByRole("button", { name: "Ekle" }).click();

  // Nothing was saved; the dialog explains and offers the conversion.
  const offer = dialog.getByRole("alert");
  await expect(offer).toContainText("90 dakikadan uzun iş tek oturuma sığmaz");
  await expect(offer.getByRole("button", { name: "İş kalemi olarak kaydet" })).toBeVisible();
  expect(await rows("tasks")).toHaveLength(0);
  expect(await rows("work_items")).toHaveLength(0);

  await offer.getByRole("button", { name: "İş kalemi olarak kaydet" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("İş kalemi olarak eklendi.");

  const items = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  expect(items[0]).toMatchObject({
    title: "Dönem raporu",
    module_id: mod.id,
    effort_total_minutes: 180,
    status: "active",
  });
  // No task of its own: the only tasks are the item's sittings, opened when the week took it
  // in (Ç3).
  const tasks = await waitFor(
    () => rows("tasks"),
    (list) => list.length > 0,
  );
  expect(tasks.every((task) => task.work_item_id === items[0].id)).toBe(true);
  // The item is offered on the Today screen as a sitting that fits.
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading", { name: "Dönem raporu" })).toBeVisible();
  await expect(now).toContainText("45 dk");
});

test("the length can be brought down to 90 minutes instead", async ({ page }) => {
  await seedModule();
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("Uzun toplantı notları 2s");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await dialog.getByRole("alert").getByRole("button", { name: "Süreyi 90 dk yap" }).click();
  await expect(dialog.getByLabel("Süre (dk)")).toHaveValue("90");
  await dialog.getByRole("button", { name: "Ekle" }).click();

  const tasks = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
  );
  expect(tasks[0]).toMatchObject({ title: "Uzun toplantı notları", est_minutes: 90 });
  expect(await rows("work_items")).toHaveLength(0);
});

test("Tab walks through the modules and back to none", async ({ page }) => {
  await seedModule("okul-ornek", "Okul");
  await seedModule("ev-ornek", "Ev", "#16a34a");
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("Süpürge");
  const pressed = () =>
    dialog.getByRole("group", { name: "Modül" }).locator("[aria-pressed=true]").allTextContents();

  expect(await pressed()).toEqual([]);
  await expect(dialog.getByRole("button", { name: "Gelen kutusuna ekle" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await pressed()).toEqual(["Okul"]);
  await page.keyboard.press("Tab");
  expect(await pressed()).toEqual(["Ev"]);
  await page.keyboard.press("Tab");
  expect(await pressed()).toEqual([]);
  await page.keyboard.press("Shift+Tab");
  expect(await pressed()).toEqual(["Ev"]);
  await expect(dialog.getByLabel("Giriş")).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Ekle", exact: true })).toBeVisible();
});

test("with no module switched on, everything goes to the inbox and the dialog says so", async ({
  page,
}) => {
  const dialog = await openQuickAdd(page);
  await expect(dialog).toContainText("Etkin modül yok");
  await dialog.getByLabel("Giriş").fill("fikir: yeni proje");
  await page.keyboard.press("Enter");
  const entries = await waitFor(
    () => rows("inbox_entries"),
    (list) => list.length === 1,
  );
  expect(entries[0].raw_text).toBe("fikir: yeni proje");
});

test("typing in a field does not open quick add; Escape closes it", async ({ page }) => {
  await seedModule();
  const dialog = await openQuickAdd(page);
  await dialog.getByLabel("Giriş").fill("nnn");
  await expect(dialog.getByLabel("Giriş")).toHaveValue("nnn");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await rows("inbox_entries")).toHaveLength(0);
});

test("Shift+Enter adds a line; Enter alone saves", async ({ page }) => {
  const dialog = await openQuickAdd(page);
  const box = dialog.getByLabel("Giriş", { exact: true });
  await box.pressSequentially("ilk satır");
  await page.keyboard.press("Shift+Enter");
  await box.pressSequentially("ikinci satır");
  await expect(dialog).toBeVisible();
  await expect(box).toHaveValue("ilk satır\nikinci satır");
  expect(await rows("inbox_entries")).toHaveLength(0);

  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  const [entry] = await waitFor(
    () => rows("inbox_entries"),
    (list) => list.length === 1,
  );
  expect(entry.raw_text).toBe("ilk satır\nikinci satır");
});
