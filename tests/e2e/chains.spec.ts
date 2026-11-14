import type { Page } from "@playwright/test";
import { insert, rows, update } from "./data";
import { expect, test } from "./fixtures";

// The anchored chains (Ç3f; docs/06-modul-sozlesmesi.md, "Diziler"): two modules' wake-bound
// work in one morning, the scene that sees all of it, the standard card's line. The frame is off
// in the test account; these tests switch it on. Hours are YESTERDAY's (see timing.spec.ts): the
// browser's clock is never ahead of the database's.

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const DAY = istanbulDay(-1);
const dayAt = (time: string, day = DAY) => new Date(`${day}T${time}:00+03:00`);
const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

type Row = Record<string, unknown> & { id: string };

/** The frame on, an ordinary day (08:00–19:00), the test module and a renamed template copy. */
async function setUp(frame: Record<string, unknown> = {}) {
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { ...FRAME, ...frame },
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
  const [deneme] = await insert<Row>("modules", {
    slug: "deneme",
    name: "Deneme",
    color: "#7c3aed",
  });
  const [copy] = await insert<Row>("modules", {
    slug: "sablon-kopya",
    name: "Şablon kopyası",
    color: "#16a34a",
  });
  return { deneme, copy };
}

/** The morning: teeth (deneme, sunny facet), neck (the template copy), shower (deneme). */
async function morning(frame: Record<string, unknown> = {}) {
  const { deneme, copy } = await setUp(frame);
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  const [teeth, neck, shower] = await insert<Row>("tasks", [
    {
      module_id: deneme.id,
      title: "Diş ve su",
      est_minutes: 10,
      facet: "sabah",
      timing: { anchor: "wake", order: 10 },
    },
    { module_id: copy.id, title: "Boyun", est_minutes: 10, timing: { anchor: "wake", order: 20 } },
    {
      module_id: deneme.id,
      title: "Duş ve hazırlık",
      est_minutes: 15,
      facet: "sabah",
      timing: { anchor: "wake", order: 30 },
    },
  ]);
  return { deneme, copy, teeth, neck, shower };
}

const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const chainItems = (page: Page) => page.getByTestId("scene-chain").getByRole("listitem");

test("two modules' wake-bound work is one chain: the scene gets all of it, the card its place", async ({
  page,
}) => {
  await morning();
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Diş ve su" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Sabah dizisi 1/3 · sırada Boyun");

  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  const scene = page.getByTestId("deneme-gunes");
  await expect(scene).toBeVisible();
  const items = chainItems(page);
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveAttribute("data-state", "running");
  await expect(items.nth(0)).toHaveAttribute("data-mine", "true");
  await expect(items.nth(1)).toContainText("Boyun");
  await expect(items.nth(1)).toContainText("Şablon kopyası · 10 dk · sırada");
  await expect(items.nth(1)).toHaveAttribute("data-mine", "false");
  await expect(items.nth(2)).toContainText("Duş ve hazırlık");
  await expect(items.nth(2)).toHaveAttribute("data-state", "next");

  // Out of the scene: the standard card says where the work stands.
  await page.getByRole("button", { name: "Çık" }).click();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Sabah dizisi 1/3 · sırada Boyun");
  await expect(card(page).getByRole("button", { name: "Sahneye dön" })).toBeVisible();
});

test("the evening's card shows the bed chain's place of the work it offers", async ({ page }) => {
  const { deneme, copy } = await setUp();
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  await insert("tasks", [
    {
      module_id: copy.id,
      title: "Akşam esnemesi",
      est_minutes: 10,
      timing: { anchor: "bed", order: 10 },
    },
    {
      module_id: deneme.id,
      title: "Yüz",
      est_minutes: 10,
      facet: "aksam",
      timing: { anchor: "bed", order: 20 },
    },
  ]);
  // Tomorrow is light: bed at 01:00, the bed-bound work from 00:40.
  await page.clock.setFixedTime(dayAt("21:00"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Akşam esnemesi" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Akşam dizisi 1/2 · sırada Yüz");
});
