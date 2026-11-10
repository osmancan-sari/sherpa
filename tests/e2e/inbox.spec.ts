import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Inbox: free text is routed by hand (the AI arrives in Ç2). Entries are never deleted.

test("an entry becomes a task with one touch to open and one to confirm", async ({ page }) => {
  const mod = await seedModule();
  await seedModule("ev-ornek", "Ev", "#16a34a");
  await insert("inbox_entries", { raw_text: "sunum slaytları cuma 45dk" });

  await page.goto("/gelen");
  const entry = page.getByRole("listitem").filter({ hasText: "sunum slaytları cuma 45dk" });
  await entry.getByRole("button", { name: "İşe çevir" }).click();
  // The words at the end of the entry were read as its date and length.
  await expect(entry.getByLabel("Süre (dk)")).toHaveValue("45");
  await expect(entry.getByLabel("Tarih")).not.toHaveValue("");
  await expect(entry.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  await entry.getByRole("button", { name: "Okul" }).click();
  await entry.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("Gelen kutusu boş.")).toBeVisible();
  const tasks = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
  );
  expect(tasks[0]).toMatchObject({ title: "sunum slaytları", module_id: mod.id, est_minutes: 45 });
  expect(tasks[0].due_at).not.toBeNull();

  const entries = await waitFor(
    () => rows("inbox_entries"),
    (list) => list[0].status === "routed",
  );
  expect(entries).toHaveLength(1);
  expect(entries[0].routed).toEqual([{ type: "task", id: tasks[0].id, module: "okul-ornek" }]);
  expect(entries[0].routed_at).not.toBeNull();
});

test("an entry becomes a one-off block", async ({ page }) => {
  await insert("inbox_entries", { raw_text: "diş hekimi" });

  await page.goto("/gelen");
  const entry = page.getByRole("listitem").filter({ hasText: "diş hekimi" });
  await entry.getByRole("button", { name: "Bloğa çevir" }).click();
  await entry.getByLabel("Gün").fill("2031-03-14");
  await entry.getByLabel("Başlangıç").fill("16:00");
  await entry.getByLabel("Bitiş").fill("15:00");
  // A block cannot end before it starts.
  await expect(entry.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  await entry.getByLabel("Bitiş").fill("17:30");
  await entry.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("Gelen kutusu boş.")).toBeVisible();
  const blocks = await waitFor(
    () => rows("blocks"),
    (list) => list.length === 1,
  );
  expect(blocks[0]).toMatchObject({ title: "diş hekimi", status: "planned", series_id: null });
  expect(new Date(blocks[0].starts_at as string).toISOString()).toBe("2031-03-14T13:00:00.000Z");
  expect(new Date(blocks[0].ends_at as string).toISOString()).toBe("2031-03-14T14:30:00.000Z");
  const [routed] = await waitFor(
    () => rows("inbox_entries"),
    (list) => list[0].status === "routed",
  );
  expect(routed.routed).toEqual([{ type: "block", id: blocks[0].id }]);
});

test("'Sil' takes an entry off the list but keeps it in the data", async ({ page }) => {
  await insert("inbox_entries", [{ raw_text: "silinecek not" }, { raw_text: "kalacak not" }]);

  await page.goto("/gelen");
  await page.getByRole("button", { name: "Sil: silinecek not" }).click();
  await expect(page.getByRole("main")).not.toContainText("silinecek not");
  await expect(page.getByRole("main")).toContainText("kalacak not");

  const entries = await waitFor(
    () => rows("inbox_entries"),
    (list) => list.some((entry) => entry.status === "dismissed"),
  );
  expect(entries.map((entry) => [entry.raw_text, entry.status]).sort()).toEqual([
    ["kalacak not", "new"],
    ["silinecek not", "dismissed"],
  ]);
});

test("without a module an entry cannot become a task, and the screen says where modules are", async ({
  page,
}) => {
  await insert("inbox_entries", { raw_text: "modülsüz not" });
  await page.goto("/gelen");
  const entry = page.getByRole("listitem").filter({ hasText: "modülsüz not" });
  await entry.getByRole("button", { name: "İşe çevir" }).click();
  await expect(entry).toContainText("İşin bir modülü olmalı.");
  await expect(entry.getByRole("link", { name: /Ayarlar/ })).toHaveAttribute(
    "href",
    "/ayarlar/moduller",
  );
  await expect(entry.getByRole("button", { name: "Kaydet" })).toBeDisabled();
});
