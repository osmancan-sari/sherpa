import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Changing work by hand: tasks, work items, rhythms, fixed blocks and their series.

/** A calendar day in Istanbul, `days` from today, as yyyy-MM-dd. */
function istanbulDay(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

function istanbulTime(instant: unknown): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant as string));
}

async function openEditor(page: Page, button: string, title: string) {
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("a task is edited, put on hold and given up from its module's page", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Rapor yaz" });
  await page.goto(`/m/${mod.slug}`);
  const upcoming = page.getByRole("region", { name: "Yaklaşanlar" });
  await expect(upcoming).toContainText("Rapor yaz");

  let dialog = await openEditor(page, "Düzenle: Rapor yaz", "İşi düzenle");
  await expect(dialog.getByLabel("Ad", { exact: true })).toHaveValue("Rapor yaz");
  await expect(dialog.getByLabel("Süre (dk)")).toHaveValue("30");
  // A task is one sitting: longer than 90 minutes cannot be saved here either.
  await dialog.getByLabel("Süre (dk)").fill("120");
  await expect(dialog.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  await dialog.getByLabel("Süre (dk)").fill("45");
  await dialog.getByLabel("Ad", { exact: true }).fill("Rapor yaz (son hali)");
  const due = istanbulDay(2);
  await dialog.getByLabel("Son tarih (isteğe bağlı)").fill(due);
  await dialog.getByLabel("Önem").selectOption({ label: "Yüksek" });
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();

  await expect(upcoming).toContainText("Rapor yaz (son hali)");
  await expect(upcoming).toContainText("45 dk");
  const [edited] = await waitFor(
    () => rows("tasks"),
    (list) => list[0].title === "Rapor yaz (son hali)",
  );
  expect(edited).toMatchObject({ est_minutes: 45, importance: 3, status: "todo" });
  expect(new Date(edited.due_at as string).toISOString()).toBe(
    new Date(`${due}T23:59:00+03:00`).toISOString(),
  );

  // On hold: it stays on the module's page, marked, and is no longer offered on Today.
  dialog = await openEditor(page, "Düzenle: Rapor yaz (son hali)", "İşi düzenle");
  await dialog.getByLabel("Durum").selectOption({ label: "Bekliyor" });
  await dialog.getByLabel("Neyi bekliyor (isteğe bağlı)").fill("Danışmanın yanıtı");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(upcoming).toContainText("bekliyor");
  await waitFor(
    () => rows("tasks"),
    (list) => list[0].status === "waiting" && list[0].waiting_on === "Danışmanın yanıtı",
  );
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText(
    "Bugün için planlanan bir şey yok.",
  );

  // Given up: nothing is deleted, the task is marked dropped and leaves the list.
  await page.goto(`/m/${mod.slug}`);
  dialog = await openEditor(page, "Düzenle: Rapor yaz (son hali)", "İşi düzenle");
  await dialog.getByRole("button", { name: "Bırak" }).click();
  await expect(upcoming).toContainText("Bu modülde sırada iş yok.");
  const [dropped] = await waitFor(
    () => rows("tasks"),
    (list) => list[0].status === "dropped",
  );
  expect(dropped.title).toBe("Rapor yaz (son hali)");
});

test("what the user changes on a proposed work item survives the module's next proposal", async ({
  page,
}) => {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  await page.goto("/m/deneme");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Örnek kayıt" })
    .click();
  const [proposed] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  // Proposed without a length: the middle of the module's bounds, marked as a default.
  expect(proposed.effort_total_minutes).toBe(135);
  expect(proposed.provenance).toMatchObject({ effort_total_minutes: "default" });

  // The user sets the effort and the importance by hand.
  const dialog = await openEditor(page, "Düzenle: Örnek hedef", "İş kalemini düzenle");
  await dialog.getByLabel("Toplam efor (dk) (isteğe bağlı)").fill("90");
  await dialog.getByLabel("Önem").selectOption({ label: "Çok yüksek" });
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  const [mine] = await waitFor(
    () => rows("work_items"),
    (list) => list[0].effort_total_minutes === 90,
  );
  expect(mine).toMatchObject({ importance: 4, title: "Örnek hedef" });
  expect(mine.provenance).toMatchObject({
    effort_total_minutes: "user",
    importance: "user",
    title: "module",
  });
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText(
    "0 dk / 1 sa 30 dk",
  );

  // The record changes in the module: it proposes the same key again, with a length of its own
  // and a new name. The name is the module's to change; the effort is the user's now.
  const table = page.getByRole("table", { name: "Deneme kayıtları" });
  const minutes = table.getByLabel("Süre: Örnek hedef");
  await minutes.fill("60");
  await minutes.press("Enter");
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0].minutes === 60,
  );
  const name = table.getByLabel("Ad: Örnek hedef");
  await name.fill("Örnek hedef 2");
  await name.press("Enter");
  const works = await waitFor(
    () => rows("work_items"),
    (list) => list[0].title === "Örnek hedef 2",
  );
  expect(works).toHaveLength(1);
  expect(works[0]).toMatchObject({ id: proposed.id, effort_total_minutes: 90, importance: 4 });
  expect(works[0].provenance).toMatchObject({ effort_total_minutes: "user", importance: "user" });
});

test("a rhythm is added by hand, changed and stopped", async ({ page }) => {
  const mod = await seedModule("ev-ornek", "Ev", "#16a34a");
  await page.goto(`/m/${mod.slug}`);
  await page
    .getByRole("region", { name: "Giriş ve ayarlar" })
    .getByRole("button", { name: "Ritim ekle" })
    .click();
  let dialog = page.getByRole("dialog", { name: "Yeni ritim" });
  await expect(dialog.getByRole("button", { name: "Ekle" })).toBeDisabled();
  await dialog.getByLabel("Ad", { exact: true }).fill("Süpürme");
  await dialog.getByLabel("Hedef").fill("3");
  await dialog.getByLabel("Dönem").selectOption({ label: "Haftada" });
  await dialog.getByLabel("Süre (dk)").fill("10");
  await dialog.getByRole("button", { name: "Ekle" }).click();
  await expect(dialog).toBeHidden();

  const upcoming = page.getByRole("region", { name: "Yaklaşanlar" });
  await expect(upcoming).toContainText("Süpürme");
  await expect(upcoming).toContainText("10 dk · 0/3");
  const [rhythm] = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 1,
  );
  expect(rhythm).toMatchObject({
    module_id: mod.id,
    title: "Süpürme",
    target_count: 3,
    period: "week",
    est_minutes: 10,
    active: true,
  });

  dialog = await openEditor(page, "Düzenle: Süpürme", "Ritmi düzenle");
  await dialog.getByLabel("Hedef").fill("2");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(upcoming).toContainText("0/2");
  await waitFor(
    () => rows("rhythms"),
    (list) => list[0].target_count === 2,
  );

  dialog = await openEditor(page, "Düzenle: Süpürme", "Ritmi düzenle");
  await dialog.getByRole("button", { name: "Durdur" }).click();
  await expect(upcoming).toContainText("Bu modülde sırada iş yok.");
  const [stopped] = await waitFor(
    () => rows("rhythms"),
    (list) => list[0].active === false,
  );
  expect(stopped.title).toBe("Süpürme");
});

test("a series is edited: its coming blocks follow, a block changed by hand stays", async ({
  page,
}) => {
  // A series on the weekday two days from now, so none of its blocks is under way or over.
  const firstDay = istanbulDay(2);
  const weekday = ((new Date(`${firstDay}T12:00:00+03:00`).getUTCDay() + 6) % 7) + 1;
  await insert("block_series", {
    title: "Seminer",
    kind: "class",
    weekday,
    start_time: "10:00",
    end_time: "12:00",
  });
  // Opening the app produces the series' blocks.
  await page.goto("/ayarlar/bloklar");
  const coming = page.getByRole("list", { name: "Yaklaşan bloklar" });
  await expect(coming.getByRole("listitem").first()).toContainText("10:00–12:00 · Seminer");
  const produced = await waitFor(
    () => rows("blocks"),
    (list) => list.length >= 8,
  );

  // One block is changed by hand: an hour longer, in another room.
  await coming
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: /^Düzenle: Seminer/ })
    .click();
  let dialog = page.getByRole("dialog", { name: "Bloğu düzenle" });
  await dialog.getByLabel("Bitiş").fill("13:00");
  // A block cannot end before it starts.
  await dialog.getByLabel("Başlangıç").fill("14:00");
  await expect(dialog.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  await dialog.getByLabel("Başlangıç").fill("10:00");
  await dialog.getByLabel("Yer (isteğe bağlı)").fill("B-201");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(coming.getByRole("listitem").first()).toContainText("10:00–13:00 · Seminer · B-201");
  const byHand = (
    await waitFor(
      () => rows("blocks"),
      (list) => list.some((block) => block.location === "B-201"),
    )
  ).find((block) => block.location === "B-201")!;
  expect(byHand.provenance).toMatchObject({ ends_at: "user", location: "user" });

  // The series moves an hour later and gets a new name.
  await page.getByRole("button", { name: "Seriyi düzenle: Seminer" }).click();
  dialog = page.getByRole("dialog", { name: "Seriyi düzenle" });
  await dialog.getByLabel("Ad", { exact: true }).fill("Bitirme semineri");
  await dialog.getByLabel("Başlangıç").fill("11:00");
  await dialog.getByLabel("Bitiş").fill("13:30");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("region", { name: "Haftalık seriler" })).toContainText("11:00–13:30");

  const after = await waitFor(
    () => rows("blocks"),
    (list) => list.filter((block) => block.title === "Bitirme semineri").length >= 7,
  );
  expect(after).toHaveLength(produced.length);
  for (const block of after) {
    if (block.id === byHand.id) {
      // Changed by hand: left exactly as the user set it.
      expect(block).toMatchObject({ title: "Seminer", location: "B-201" });
      expect(istanbulTime(block.starts_at)).toBe("10:00");
      expect(istanbulTime(block.ends_at)).toBe("13:00");
    } else {
      expect(block.title).toBe("Bitirme semineri");
      expect(istanbulTime(block.starts_at)).toBe("11:00");
      expect(istanbulTime(block.ends_at)).toBe("13:30");
    }
  }
  const [series] = await rows("block_series");
  expect(series).toMatchObject({ title: "Bitirme semineri", start_time: "11:00:00" });

  // A single block can also move to another day.
  await update("blocks", byHand.id as string, { status: "planned" });
  await coming
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: /^Düzenle: Seminer/ })
    .click();
  dialog = page.getByRole("dialog", { name: "Bloğu düzenle" });
  const moved = istanbulDay(3);
  await dialog.getByLabel("Tarih").fill(moved);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await waitFor(
    () => rows("blocks"),
    (list) =>
      new Date(list.find((block) => block.id === byHand.id)!.starts_at as string).toISOString() ===
      new Date(`${moved}T10:00:00+03:00`).toISOString(),
  );
});
