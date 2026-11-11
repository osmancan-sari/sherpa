import { readFile } from "node:fs/promises";
import { CORE_EXPORT_TABLES } from "@/core/data/export";
import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Settings: fixed blocks (weekly series and one-off blocks) and the export of everything.
// The modules part of Settings is walked in deneme-module.spec.ts.

/** A calendar day in Istanbul, `days` from today, as yyyy-MM-dd. */
function istanbulDay(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

function istanbulClock(instant: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

test("a weekly series produces the coming weeks' blocks; a single one can be cancelled", async ({
  page,
}) => {
  await page.goto("/ayarlar");
  await page.getByRole("link", { name: "Haftalık seriler ve tek seferlik bloklar" }).click();
  await expect(page).toHaveURL(/\/ayarlar\/bloklar$/);
  await expect(page.getByText("Seri yok.")).toBeVisible();

  const form = page.getByRole("form", { name: "Yeni seri" });
  await expect(form.getByRole("button", { name: "Seri ekle" })).toBeDisabled();
  await form.getByLabel("Ad", { exact: true }).fill("Sinyal işleme");
  await form.getByLabel("Tür", { exact: true }).selectOption({ label: "Ders" });
  await form.getByLabel("Gün", { exact: true }).selectOption({ label: "Çarşamba" });
  await form.getByLabel("Başlangıç").fill("13:30");
  await form.getByLabel("Bitiş").fill("16:30");
  await form.getByLabel("Yer (isteğe bağlı)").fill("B-104");
  await form.getByLabel("Gün tipi").selectOption({ label: "Kampüs" });
  await form.getByRole("button", { name: "Seri ekle" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Seri eklendi; önümüzdeki 8 haftanın blokları üretildi.",
  );

  const [series] = await waitFor(
    () => rows("block_series"),
    (list) => list.length === 1,
  );
  expect(series).toMatchObject({
    title: "Sinyal işleme",
    kind: "class",
    weekday: 3,
    start_time: "13:30:00",
    end_time: "16:30:00",
    location: "B-104",
    day_type: "campus",
  });

  // Eight weeks ahead: one block per Wednesday, a week apart, at the series' hours.
  const blocks = await waitFor(
    () => rows("blocks"),
    (list) => list.length >= 8,
  );
  expect(blocks.length).toBeLessThanOrEqual(9);
  const starts = blocks.map((block) => Date.parse(block.starts_at as string)).sort((a, b) => a - b);
  for (const block of blocks) {
    expect(block).toMatchObject({ series_id: series.id, status: "planned", day_type: "campus" });
    expect(istanbulClock(block.starts_at as string)).toBe("Çarşamba 13:30");
    expect(istanbulClock(block.ends_at as string)).toBe("Çarşamba 16:30");
  }
  for (let index = 1; index < starts.length; index++) {
    expect(starts[index] - starts[index - 1]).toBe(7 * 86_400_000);
  }
  expect(starts.at(-1)! - Date.now()).toBeGreaterThan(49 * 86_400_000);

  await expect(page.getByRole("region", { name: "Haftalık seriler" })).toContainText(
    "Çarşamba 13:30–16:30 · Ders · B-104",
  );

  // One block of the series is cancelled; the others stay.
  const coming = page.getByRole("list", { name: "Yaklaşan bloklar" });
  const second = coming.getByRole("listitem").nth(1);
  await expect(second).toContainText("Sinyal işleme");
  await second.getByRole("button", { name: /^İptal et: Sinyal işleme/ }).click();
  await expect(second.getByRole("button", { name: /^Geri al: Sinyal işleme/ })).toBeVisible();
  const afterCancel = await waitFor(
    () => rows("blocks"),
    (list) => list.some((block) => block.status === "cancelled"),
  );
  expect(afterCancel.filter((block) => block.status === "cancelled")).toHaveLength(1);
  expect(afterCancel).toHaveLength(blocks.length);
  const cancelled = afterCancel.find((block) => block.status === "cancelled")!;

  // Opening the app again tops the series up; the cancelled block is not produced again.
  await page.reload();
  await expect(coming.getByRole("listitem").nth(1)).toContainText("Sinyal işleme");
  await expect(
    coming
      .getByRole("listitem")
      .nth(1)
      .getByRole("button", { name: /^Geri al/ }),
  ).toBeVisible();
  const afterReload = await rows("blocks");
  expect(afterReload).toHaveLength(blocks.length);
  expect(afterReload.find((block) => block.id === cancelled.id)!.status).toBe("cancelled");

  // The cancellation can be taken back.
  await coming
    .getByRole("listitem")
    .nth(1)
    .getByRole("button", { name: /^Geri al/ })
    .click();
  await waitFor(
    () => rows("blocks"),
    (list) => list.every((block) => block.status === "planned"),
  );

  // Ending the series removes what is still to come; the series itself is kept, closed.
  await page.getByRole("button", { name: "Seriyi bitir: Sinyal işleme" }).click();
  await expect(page.getByText("Seri yok.")).toBeVisible();
  const left = await waitFor(
    () => rows("blocks"),
    (list) => list.every((block) => Date.parse(block.ends_at as string) <= Date.now()),
  );
  expect(left.length).toBeLessThanOrEqual(1);
  const [ended] = await rows("block_series");
  expect(ended.valid_to).toBe(istanbulDay(-1));
});

test("a one-off block is added from Settings and shows on its day", async ({ page }) => {
  await page.goto("/ayarlar/bloklar");
  const form = page.getByRole("form", { name: "Yeni blok" });
  const day = istanbulDay(3);
  await form.getByLabel("Ad", { exact: true }).fill("Diş hekimi");
  await form.getByLabel("Tarih").fill(day);
  await form.getByLabel("Başlangıç").fill("15:00");
  await form.getByLabel("Bitiş").fill("14:00");
  // A block cannot end before it starts.
  await expect(form.getByRole("button", { name: "Blok ekle" })).toBeDisabled();
  await form.getByLabel("Bitiş").fill("16:00");
  await form.getByRole("button", { name: "Blok ekle" }).click();
  await expect(page.getByRole("status")).toHaveText("Blok eklendi.");

  const [block] = await waitFor(
    () => rows("blocks"),
    (list) => list.length === 1,
  );
  expect(block).toMatchObject({ title: "Diş hekimi", kind: "appointment", series_id: null });
  expect(new Date(block.starts_at as string).toISOString()).toBe(
    new Date(`${day}T15:00:00+03:00`).toISOString(),
  );
  await expect(page.getByRole("list", { name: "Yaklaşan bloklar" })).toContainText(
    "15:00–16:00 · Diş hekimi",
  );
});

test("everything the account holds is exported as one JSON file", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Dışa aktarılacak iş" });
  await insert("inbox_entries", { raw_text: "ham giriş" });
  // A module's own table is part of "everything" too.
  await insert("deneme_items", { title: "Modül kaydı" });

  await page.goto("/ayarlar");
  const waiting = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tümünü dışa aktar" }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(/^sherpa-\d{4}-\d{2}-\d{2}\.json$/);

  const document = JSON.parse(await readFile(await download.path(), "utf8")) as {
    app: string;
    format: number;
    exported_at: string;
    tables: Record<string, Record<string, unknown>[]>;
  };
  expect(document).toMatchObject({ app: "sherpa", format: 1 });
  expect(Math.abs(Date.parse(document.exported_at) - Date.now())).toBeLessThan(60_000);
  expect(Object.keys(document.tables).sort()).toEqual(
    [...CORE_EXPORT_TABLES, "deneme_items"].sort(),
  );
  expect(document.tables.modules.map((row) => row.slug)).toEqual([mod.slug]);
  expect(document.tables.tasks.map((row) => row.title)).toEqual(["Dışa aktarılacak iş"]);
  expect(document.tables.inbox_entries.map((row) => row.raw_text)).toEqual(["ham giriş"]);
  expect(document.tables.deneme_items.map((row) => row.title)).toEqual(["Modül kaydı"]);
  expect(document.tables.sessions).toEqual([]);
});
