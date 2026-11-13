import type { Browser, Locator, Page } from "@playwright/test";
import { insert, rows, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { roomInTheDay, STORAGE_STATE } from "./helpers";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// A module's facets end to end (Ç3e; docs/06-modul-sozlesmesi.md, "Bölümler"; docs/05,
// "Renkler ve bölümler"), with the "deneme" module: two fixed facets with a colour, a scene and
// a tone of their own, and one facet per open topic from its data.

const AMBER = "rgb(217, 119, 6)"; // sabah, #d97706
const NAVY = "rgb(67, 97, 216)"; // akşam, #4361d8
const MODULE = "rgb(98, 80, 214)"; // the module, #6250d6
const ROSE = "rgb(225, 29, 72)"; // "Gül" in the palette
const GREEN = "rgb(22, 163, 74)"; // "Yeşil"
const TEAL = "rgb(13, 148, 136)"; // the first topic's colour

/** The work-colour dot of a row (on the Today screen, the module page, the week). */
const dotOf = (row: Locator) => row.getByTestId("work-dot").first();

function upcoming(page: Page, title: string) {
  return page
    .getByRole("region", { name: "Yaklaşanlar" })
    .getByRole("listitem")
    .filter({ hasText: title });
}

async function phone(browser: Browser, baseURL: string) {
  const context = await browser.newContext({
    baseURL,
    storageState: STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  return { context, page: await context.newPage() };
}

test("work in a facet has the facet's colour on the module page, the strip, the lists and the week", async ({
  page,
}) => {
  await roomInTheDay(page);
  await activateDeneme(page);
  await addRecord(page, "Sabah yürüyüşü", { minutes: "30", facet: "sabah" });
  await addRecord(page, "Akşam okuması", { minutes: "30", facet: "aksam" });
  await addRecord(page, "Bölümsüz iş", { minutes: "30" });
  const items = await rows<{ title: string; facet: string | null }>("work_items");
  expect(Object.fromEntries(items.map((row) => [row.title, row.facet]))).toEqual({
    "Sabah yürüyüşü": "sabah",
    "Akşam okuması": "aksam",
    "Bölümsüz iş": null,
  });

  await page.goto("/m/deneme");
  await expect(dotOf(upcoming(page, "Sabah yürüyüşü"))).toHaveCSS("background-color", AMBER);
  await expect(dotOf(upcoming(page, "Akşam okuması"))).toHaveCSS("background-color", NAVY);
  await expect(dotOf(upcoming(page, "Bölümsüz iş"))).toHaveCSS("background-color", MODULE);
  await expect(upcoming(page, "Sabah yürüyüşü")).toContainText("Sabah");

  // Today: the strip, and the card or the list, whichever each work is in.
  await page.goto("/");
  await expect(page.locator('[data-testid="strip-work"][title*="Sabah yürüyüşü"]')).toHaveCSS(
    "background-color",
    AMBER,
  );
  await expect(page.locator('[data-testid="strip-work"][title*="Akşam okuması"]')).toHaveCSS(
    "background-color",
    NAVY,
  );
  // The card and "Sıradakiler" hold the three between them, each in its own colour.
  await expect(page.getByTestId("work-dot").first()).toBeVisible();
  const colours = await page
    .getByTestId("work-dot")
    .evaluateAll((dots) => dots.map((dot) => getComputedStyle(dot).backgroundColor));
  expect(colours).toEqual(expect.arrayContaining([AMBER, NAVY, MODULE]));

  // The week's items.
  await page.goto("/hafta");
  const week = page.getByRole("region", { name: "Haftanın kalemleri" });
  await expect(dotOf(week.getByRole("listitem").filter({ hasText: "Sabah yürüyüşü" }))).toHaveCSS(
    "background-color",
    AMBER,
    { timeout: 15_000 },
  );
  // Module-level places keep the module's colour: the chip.
  await page.goto("/");
  const chip = page.locator('footer a[href="/m/deneme"]');
  await expect(chip.locator("span").first()).toHaveCSS("background-color", MODULE);
});

test("the facet chooses the scene and its tone; without a scene of its own the module's comes", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Sabah esnemesi", { minutes: "20", facet: "sabah" });
  await addRecord(page, "Akşam günlüğü", { minutes: "20", facet: "aksam" });
  await addRecord(page, "Tez taslağı", { minutes: "30", kind: "odak" });

  await startFromModule(page, "Sabah esnemesi");
  const scene = page.getByTestId("scene");
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await expect(scene).toHaveAttribute("data-tone", "energy");
  await expect(scene).toHaveAttribute("data-facet", "sabah");
  await expect(page.getByLabel("Sahne şeridi").getByTestId("work-dot")).toHaveCSS(
    "background-color",
    AMBER,
  );
  await expect(page.getByTestId("deneme-gunes")).toContainText("Sabah");

  await startFromModule(page, "Akşam günlüğü");
  await expect(page.getByTestId("deneme-gece")).toBeVisible();
  await expect(scene).toHaveAttribute("data-tone", "calm");
  await expect(page.getByLabel("Sahne şeridi").getByTestId("work-dot")).toHaveCSS(
    "background-color",
    NAVY,
  );

  // No facet: the module's own scene, by its own `when` (a focused sitting).
  await startFromModule(page, "Tez taslağı");
  await expect(page.getByTestId("deneme-focus")).toBeVisible();
  await expect(scene).toHaveAttribute("data-tone", "focus");
  await expect(scene).not.toHaveAttribute("data-facet", /.+/);

  // A topic's facet has no scene: still the module's, in the topic's colour.
  const [topic] = await insert<{ id: string }>("deneme_items", {
    title: "İstatistik",
    kind: "konu",
  });
  const sitting = (await rows<{ id: string; title: string }>("work_items")).find(
    (row) => row.title === "Tez taslağı",
  )!;
  await page.goto("/m/deneme");
  await upcoming(page, "Tez taslağı").getByRole("button", { name: "Düzenle: Tez taslağı" }).click();
  const dialog = page.getByRole("dialog", { name: "İş kalemini düzenle" });
  await dialog.getByLabel("Bölüm", { exact: true }).selectOption({ label: "İstatistik" });
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await waitFor(
    () => rows<{ id: string; facet: string | null }>("work_items"),
    (list) => list.find((row) => row.id === sitting.id)?.facet === `konu-${topic.id.slice(0, 8)}`,
  );
  await page.goto("/");
  await expect(page.getByTestId("deneme-focus")).toBeVisible();
  await expect(scene).toHaveAttribute("data-facet", `konu-${topic.id.slice(0, 8)}`);
  await expect(scene).toHaveAttribute("data-tone", "focus");
  await expect(page.getByLabel("Sahne şeridi").getByTestId("work-dot")).toHaveCSS(
    "background-color",
    TEAL,
  );
});

test("a topic added is a facet at once; the form puts work in it; a topic removed gives the module's colour back", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "İstatistik ödevi", { minutes: "60" });
  await page.goto("/ayarlar/moduller/deneme");
  const colours = page.getByRole("region", { name: "Renkler" });
  await expect(colours.getByTestId(/^color-row-/)).toHaveCount(3);

  // The module's data changes elsewhere: the list (and its colours) follows without a reload.
  const [topic] = await insert<{ id: string }>("deneme_items", {
    title: "İstatistik",
    kind: "konu",
  });
  const key = `konu-${topic.id.slice(0, 8)}`;
  await expect(colours.getByTestId(`color-row-${key}`)).toContainText("İstatistik");
  await expect(colours.getByTestId(`color-row-${key}`).getByTestId("color-dot")).toHaveCSS(
    "background-color",
    TEAL,
  );

  // The form: the facet is the user's from now on.
  await page.goto("/m/deneme");
  const row = upcoming(page, "İstatistik ödevi");
  await row.getByRole("button", { name: "Düzenle: İstatistik ödevi" }).click();
  const dialog = page.getByRole("dialog", { name: "İş kalemini düzenle" });
  const field = dialog.getByLabel("Bölüm", { exact: true });
  await expect(field.locator("option")).toHaveText(["Bölümsüz", "Sabah", "Akşam", "İstatistik"]);
  await field.selectOption({ label: "İstatistik" });
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dotOf(row)).toHaveCSS("background-color", TEAL);
  const [item] = await waitFor(
    () => rows<{ facet: string; provenance: Record<string, string> }>("work_items"),
    (list) => list[0]?.facet === key,
  );
  expect(item.provenance.facet).toBe("user");

  // The topic goes: the work keeps its key and shows in the module's colour, without an error.
  await page.getByRole("button", { name: "Sil: İstatistik", exact: true }).click();
  await expect(dotOf(row)).toHaveCSS("background-color", MODULE);
  expect((await rows<{ facet: string }>("work_items"))[0].facet).toBe(key);
  await row.getByRole("button", { name: "Düzenle: İstatistik ödevi" }).click();
  await expect(dialog.getByLabel("Bölüm", { exact: true })).toHaveValue(key);
  await expect(dialog.getByLabel("Bölüm", { exact: true }).locator("option:checked")).toHaveText(
    `${key} (artık yok)`,
  );
});

test("the module's and a facet's colour change in Settings, go back to the default, and reach the other device live", async ({
  page,
  browser,
  baseURL,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Sabah yürüyüşü", { minutes: "30", facet: "sabah" });
  await addRecord(page, "Bölümsüz iş", { minutes: "30" });

  const other = await phone(browser, baseURL!);
  await other.page.goto("/m/deneme");
  await expect(dotOf(upcoming(other.page, "Sabah yürüyüşü"))).toHaveCSS("background-color", AMBER);

  await page.goto("/ayarlar/moduller/deneme");
  const sabah = page.getByTestId("color-row-sabah");
  await sabah.getByRole("button", { name: "Sabah: rengi değiştir" }).click();
  await expect(sabah.getByRole("button", { name: "Varsayılana dön" })).toHaveCount(0);
  await sabah
    .getByRole("group", { name: "Sabah: hazır renkler" })
    .getByRole("button", { name: "Gül" })
    .click();
  await expect(sabah.getByTestId("color-dot")).toHaveCSS("background-color", ROSE);
  await waitFor(
    () => rows<{ facet_colors: Record<string, string> }>("modules"),
    (list) => list[0].facet_colors.sabah === "#e11d48",
  );
  // The phone follows without a reload.
  await expect(dotOf(upcoming(other.page, "Sabah yürüyüşü"))).toHaveCSS("background-color", ROSE);

  // The module's own colour: work without a facet follows it.
  const module = page.getByTestId("color-row-module");
  await module.getByRole("button", { name: "Deneme: rengi değiştir" }).click();
  await module
    .getByRole("group", { name: "Deneme: hazır renkler" })
    .getByRole("button", { name: "Yeşil", exact: true })
    .click();
  await expect(dotOf(upcoming(other.page, "Bölümsüz iş"))).toHaveCSS("background-color", GREEN);
  await expect(dotOf(upcoming(other.page, "Sabah yürüyüşü"))).toHaveCSS("background-color", ROSE);

  // A colour of one's own that is hard to see in a theme: one line, and it still saves. (One
  // picker is open at a time.)
  await sabah.getByRole("button", { name: "Sabah: rengi değiştir" }).click();
  await sabah.getByLabel("Sabah: renk kodu").fill("#FFF59D");
  await expect(sabah.getByRole("note")).toHaveText("Bu renk açık ya da koyu temada zor seçilir.");
  await sabah.getByRole("button", { name: "Kaydet" }).click();
  await waitFor(
    () => rows<{ facet_colors: Record<string, string> }>("modules"),
    (list) => list[0].facet_colors.sabah === "#fff59d",
  );

  // Back to the defaults.
  await sabah.getByRole("button", { name: "Varsayılana dön" }).click();
  await module.getByRole("button", { name: "Deneme: rengi değiştir" }).click();
  await module.getByRole("button", { name: "Varsayılana dön" }).click();
  await expect(dotOf(upcoming(other.page, "Sabah yürüyüşü"))).toHaveCSS("background-color", AMBER);
  await expect(dotOf(upcoming(other.page, "Bölümsüz iş"))).toHaveCSS("background-color", MODULE);
  const [row] = await rows<{ color: string; facet_colors: Record<string, string> }>("modules");
  expect(row).toMatchObject({ color: "#6250d6", facet_colors: {} });
  await other.context.close();
});

test("export holds the facets and the colours", async ({ page }) => {
  await activateDeneme(page);
  await addRecord(page, "Sabah yürüyüşü", { minutes: "30", facet: "sabah" });
  const response = await page.request.get("/api/export");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    tables: Record<string, Record<string, unknown>[]>;
  };
  expect(body.tables.work_items[0]).toMatchObject({ title: "Sabah yürüyüşü", facet: "sabah" });
  expect(body.tables.modules[0]).toHaveProperty("facet_colors");
  expect(body.tables.tasks[0] ?? { facet: null }).toHaveProperty("facet");
  expect(body.tables.deneme_items[0]).toMatchObject({ facet: "sabah" });
});
