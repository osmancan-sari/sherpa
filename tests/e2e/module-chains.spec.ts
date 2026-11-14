import { insert, rows, update } from "./data";
import { expect, test } from "./fixtures";
import { activateDeneme } from "./scene-helpers";

// Ç3g (docs/06-modul-sozlesmesi.md, "Modül sayfasında dizi"): a module's page reads today's wake
// and bed chains, read only, other modules' work included with only the chain's fields. The
// example is the "deneme" page; Rutin's morning tab is tried in rutin.spec.ts. Hours are
// yesterday's, as in chains.spec.ts.

const ISTANBUL = "Europe/Istanbul";
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
  new Date(Date.now() - 86_400_000),
);
const dayAt = (time: string) => new Date(`${DAY}T${time}:00+03:00`);
type Row = Record<string, unknown> & { id: string };

test("the module page lists today's chains: its own work and another module's, which leads to that page", async ({
  page,
}) => {
  await activateDeneme(page);
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  const [deneme] = (await rows("modules")) as Row[];
  const [copy] = await insert<Row>("modules", {
    slug: "sablon",
    name: "Şablon kopyası",
    color: "#0f766e",
  });
  await insert("tasks", [
    {
      module_id: deneme.id,
      title: "Diş ve su",
      est_minutes: 10,
      timing: { anchor: "wake", order: 10 },
    },
    {
      module_id: copy.id,
      title: "Boyun hareketleri",
      est_minutes: 10,
      timing: { anchor: "wake", order: 20 },
    },
  ]);
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/m/deneme");
  const chain = page.getByRole("region", { name: "Bugünün uyanış dizisi" });
  const items = chain.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAttribute("data-mine", "true");
  await expect(items.nth(0)).toContainText("Diş ve su");
  await expect(items.nth(1)).toHaveAttribute("data-mine", "false");
  await expect(items.nth(1)).toContainText("Şablon kopyası · 10 dk · sırada");
  await expect(items.nth(1).getByRole("link", { name: "Boyun hareketleri" })).toHaveAttribute(
    "href",
    "/m/sablon",
  );
  await expect(page.getByRole("region", { name: "Bugünün yatış dizisi" })).toHaveCount(0);
});
