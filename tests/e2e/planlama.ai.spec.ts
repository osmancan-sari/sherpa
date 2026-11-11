import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The planning calls (Ç3) end to end, against the server with the recorded fake provider
// (SHERPA_AI_FAKE=1, port 3101). The engine plans first; the AI's advice and its reasons come
// on top; with the AI off the engine's plan stands (docs/10-yapay-zeka.md).

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const tomorrow = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() + 86_400_000),
  );

async function seedWork() {
  const mod = await seedModule();
  await insert("tasks", [
    { module_id: mod.id, title: "Rapor", importance: 3 },
    { module_id: mod.id, title: "Okuma" },
  ]);
  return mod;
}

test("the morning plan carries the AI's advice and its reasons behind 'neden?'", async ({
  page,
}) => {
  await seedWork();
  await page.goto("/");
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list[0]?.plan_source === "ai",
    15_000,
  );
  expect(day.date).toBe(today());
  const kinds = (await rows("ai_calls")).map((call) => call.kind);
  expect(kinds).toContain("plan");

  const now = page.getByRole("region", { name: "Şimdi" });
  await now.getByRole("button", { name: "Neden?" }).click();
  await expect(now.getByRole("note", { name: "Neden bu iş" })).toContainText("Yapay zeka:");
});

test("'Yeniden planla' asks the AI to plan the rest of the day", async ({ page }) => {
  await seedWork();
  await page.goto("/");
  // Whatever the morning's plan is by now, "Yeniden planla" plans again at once (the engine)
  // and asks the AI for the rest of the day.
  await expect(page.getByRole("region", { name: "Şimdi" }).getByRole("heading")).toBeVisible();
  await page.getByRole("button", { name: "Yeniden planla" }).click();
  await expect(page.getByRole("status")).toHaveText("Gün yeniden planlandı.");
  await waitFor(
    () => rows("ai_calls"),
    (list) => list.some((call) => call.kind === "replan"),
  );
});

test("the evening closing's draft comes from the AI, with its reasons", async ({ page }) => {
  await seedWork();
  await page.goto("/kapanis");
  await page.getByRole("button", { name: "İleri" }).click();
  await page.getByRole("button", { name: "İleri" }).click();
  const draft = page.getByRole("region", { name: "Yarın" });
  await expect(draft).toContainText("Yapay zeka: günün en önemli işi bu.");
  await page.getByRole("button", { name: "İleri" }).click();
  await page.getByRole("button", { name: "İleri" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();
  const days = await waitFor(
    () => rows("days"),
    (list) => list.some((row) => row.date === tomorrow() && row.plan_source === "closing"),
  );
  const next = days.find((row) => row.date === tomorrow())!;
  expect(Object.values(next.plan_reasons as Record<string, string>)).toContain(
    "Yapay zeka: günün en önemli işi bu.",
  );
});

test("with the AI switched off the plan still comes, the engine's own", async ({ page }) => {
  await seedWork();
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, { ai_enabled: false });
  await page.goto("/");
  await waitFor(
    () => rows("days"),
    (list) => list[0]?.plan_source === "auto",
    15_000,
  );
  await expect(page.getByRole("region", { name: "Şimdi" }).getByRole("heading")).toHaveText(
    "Rapor",
  );
  // Give the screen a moment to have asked, had it wanted to.
  await page.waitForTimeout(2_000);
  expect((await rows("days"))[0].plan_source).toBe("auto");
  expect(await rows("ai_calls")).toEqual([]);
});
