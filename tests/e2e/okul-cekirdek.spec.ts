import { rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { roomInTheDay } from "./helpers";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// Okul çekirdek A (prompts/okul-cekirdek-a.md): the core's general abilities a school module
// asked for, tried on the "deneme" module's examples.

test("a scene's own backdrop takes the facet's resolved colour; a colour changed elsewhere reaches it", async ({
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
  // Ayarlar on another device changes the facet's colour: the scene's backdrop follows, live.
  await update("modules", mod.id as string, { facet_colors: { sabah: "#db2777" } });
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
