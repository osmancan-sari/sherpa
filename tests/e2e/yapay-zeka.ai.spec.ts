import type { Page } from "@playwright/test";
import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The AI end to end (Ç2), against the server that runs the recorded fake provider
// (SHERPA_AI_FAKE=1, port 3101). The same build without any provider runs on port 3100; the
// tests that need "no AI" go there. Markers in a line make the fake misbehave on purpose
// (src/core/ai/fake.ts): [ai:unsure], [ai:invalid].

const WITHOUT_AI = "http://127.0.0.1:3100";

type Row = Record<string, unknown>;
const mark = (row: Row) => row.ai as { fields: Record<string, { reason: string }> } | null;

async function activateDeneme(page: Page, origin = "") {
  await page.goto(`${origin}/ayarlar/moduller`);
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  const [row] = await waitFor(
    () => rows("modules"),
    (list) => list.length === 1,
  );
  return row as { id: string };
}

async function freeLine(page: Page, text: string) {
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill(text);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Gelen kutusuna eklendi.");
}

/** A record of the module without a length: its effort is left to the AI. */
async function addRecord(page: Page, title: string) {
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill(title);
  await page.keyboard.press("Tab");
  await dialog
    .getByRole("group", { name: "Kayıt türü" })
    .getByRole("button", { name: "Kayıt" })
    .click();
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
}

const upcoming = (page: Page) => page.getByRole("region", { name: "Yaklaşanlar" });

test("a free line becomes work of the right module within seconds, its values marked with reasons", async ({
  page,
}) => {
  const mod = await activateDeneme(page);
  await page.goto("/");
  await freeLine(page, "Sunum slaytları cuma");

  // The AI reads the line on the server; the task arrives through the live connection.
  const [task] = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
    10_000,
  );
  expect(task).toMatchObject({ module_id: mod.id, title: "Sunum slaytları", est_minutes: 45 });
  expect(task.due_at).not.toBeNull();
  const fields = mark(task)!.fields;
  expect(Object.keys(fields)).toEqual(
    expect.arrayContaining(["module_id", "est_minutes", "importance"]),
  );
  // "cuma" was typed on the line: the deadline is the user's, not marked.
  expect(fields.due_at).toBeUndefined();
  const [entry] = await rows("inbox_entries");
  expect(entry.status).toBe("routed");
  const [call] = await rows("ai_calls");
  expect(call).toMatchObject({ kind: "enrich", ok: true });
  expect(Number(call.cost_usd)).toBeGreaterThan(0);

  // On the module page the row carries the mark; a tap opens the reasons.
  await page.goto("/m/deneme");
  const row = upcoming(page).getByRole("listitem").filter({ hasText: "Sunum slaytları" });
  await row.getByRole("button", { name: "Yapay zekanın koyduğu değerler" }).click();
  await expect(row.getByRole("note")).toContainText("Süre: benzer işlere göre");
  await expect(row.getByRole("note")).toContainText("Modül: tek etkin modül");

  // In the form the reason stands under the field until the user changes it; the change is a
  // correction, recorded, and the AI's mark leaves that field.
  await row.getByRole("button", { name: "Düzenle: Sunum slaytları" }).click();
  const dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await expect(dialog.getByText("benzer işlere göre")).toBeVisible();
  await dialog.getByLabel("Süre (dk)").fill("20");
  await expect(dialog.getByText("benzer işlere göre")).toBeHidden();
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  const [feedback] = await waitFor(
    () => rows("ai_feedback"),
    (list) => list.length === 1,
  );
  expect(feedback).toMatchObject({
    kind: "enrich",
    module_slug: "deneme",
    ai_value: { est_minutes: 45 },
    user_value: { est_minutes: 20 },
  });
  const [edited] = await rows("tasks");
  expect((edited.ai as { user_edited: string[] }).user_edited).toEqual(["est_minutes"]);
});

test("a line the AI is unsure about waits as a card; one tap confirms it", async ({ page }) => {
  await activateDeneme(page);
  await page.goto("/");
  await freeLine(page, "okuma listesi [ai:unsure]");
  await waitFor(
    () => rows("inbox_entries"),
    (list) => list[0]?.status === "needs_confirm",
    10_000,
  );
  expect(await rows("tasks")).toEqual([]);

  await page.goto("/gelen");
  const card = page.getByRole("listitem").filter({ hasText: "okuma listesi" });
  await expect(card.getByText("Öneri:")).toBeVisible();
  // The AI's module is already chosen.
  await expect(
    card.getByRole("group", { name: "Önerilen modül" }).getByRole("button", { name: "Deneme" }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByRole("status")).toHaveText("İş eklendi.");
  await expect(card).toBeHidden();

  const [task] = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
  );
  expect(mark(task)!.fields.module_id).toBeDefined();
  const [entry] = await rows("inbox_entries");
  expect(entry.status).toBe("routed");
  // The module was the AI's own choice: nothing to correct.
  expect(await rows("ai_feedback")).toEqual([]);
});

test("an answer outside the schema writes nothing: the line stays in the inbox", async ({
  page,
}) => {
  await activateDeneme(page);
  await page.goto("/");
  await freeLine(page, "fatura öde [ai:invalid]");
  const [call] = await waitFor(
    () => rows("ai_calls"),
    (list) => list.length === 1,
    10_000,
  );
  expect(call).toMatchObject({ kind: "enrich", ok: false, output: null });
  const [entry] = await rows("inbox_entries");
  expect(entry).toMatchObject({ status: "new", suggestion: null });
  expect(await rows("tasks")).toEqual([]);
  expect(await rows("work_items")).toEqual([]);
  await page.goto("/gelen");
  await expect(page.getByRole("main").getByText("fatura öde [ai:invalid]")).toBeVisible();
});

test("with the budget at 0 no call is made, the screens say so, and the line stays in the inbox", async ({
  page,
}) => {
  await activateDeneme(page);
  await page.goto("/ayarlar");
  const section = page.getByRole("main");
  await expect(section.getByTestId("ai-state")).toHaveText(/Açık\./);
  await section.getByLabel("Aylık sınır ($; 0 kapatır)").fill("0");
  await section.getByRole("button", { name: "Kaydet" }).click();
  await expect(section.getByTestId("ai-state")).toHaveText(/bütçesi doldu/);

  await page.goto("/");
  await expect(page.getByText("Bu ayın yapay zeka bütçesi doldu")).toBeVisible();
  await freeLine(page, "Sunum slaytları cuma");
  // The request has come back (the screen re-reads), and nothing was asked of the AI.
  await page.waitForTimeout(1500);
  expect(await rows("ai_calls")).toEqual([]);
  expect(await rows("tasks")).toEqual([]);
  const [entry] = await rows("inbox_entries");
  expect(entry.status).toBe("new");
});

test("an envelope with an empty effort is filled by the AI inside the bounds, with its reason", async ({
  page,
}) => {
  await activateDeneme(page);
  await page.goto("/m/deneme");
  await addRecord(page, "Rapor taslağı");

  // Without the AI it would be the middle of the bounds (135); the fake answers off the middle.
  const [item] = await waitFor(
    () => rows("work_items"),
    (list) => list[0]?.effort_total_minutes === 155,
    10_000,
  );
  expect(item.provenance).toMatchObject({ effort_total_minutes: "ai", session_minutes: "ai" });
  expect(mark(item)!.fields.effort_total_minutes.reason).toBe("benzer işlerin süresine göre");

  const row = upcoming(page).getByRole("listitem").filter({ hasText: "Rapor taslağı" });
  // The estimate reaches the screen through the live connection: the row then carries the mark.
  await expect(row.getByRole("button", { name: "Yapay zekanın koyduğu değerler" })).toBeVisible();
  await row.getByRole("button", { name: "Düzenle: Rapor taslağı" }).click();
  const dialog = page.getByRole("dialog", { name: "İş kalemini düzenle" });
  await expect(dialog.getByText("benzer işlerin süresine göre")).toBeVisible();
  await dialog.getByLabel(/Toplam efor/).fill("200");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  const [feedback] = await waitFor(
    () => rows("ai_feedback"),
    (list) => list.length === 1,
  );
  expect(feedback).toMatchObject({ kind: "size", user_value: { effort_total_minutes: 200 } });

  // A later proposal of the module (the record is renamed) keeps the user's effort.
  await page.goto("/m/deneme");
  const cell = page
    .getByRole("table", { name: "Deneme kayıtları" })
    .getByLabel("Ad: Rapor taslağı");
  await cell.fill("Rapor taslağı v2");
  await cell.press("Enter");
  await waitFor(
    () => rows("work_items"),
    (list) => list[0]?.title === "Rapor taslağı v2",
  );
  await page.waitForTimeout(1500);
  const [after] = await rows("work_items");
  expect(after.effort_total_minutes).toBe(200);
  expect(after.provenance).toMatchObject({ effort_total_minutes: "user" });
});

test("a work item is split into suggested pieces that become work only when accepted", async ({
  page,
}) => {
  await activateDeneme(page);
  await page.goto("/m/deneme");
  await addRecord(page, "Dönem projesi");
  await waitFor(
    () => rows("work_items"),
    (list) => list[0]?.effort_total_minutes === 155,
    10_000,
  );

  const row = upcoming(page).getByRole("listitem").filter({ hasText: "Dönem projesi" });
  await expect(row.getByRole("button", { name: "Yapay zekanın koyduğu değerler" })).toBeVisible();
  await row.getByRole("button", { name: "Düzenle: Dönem projesi" }).click();
  await page
    .getByRole("dialog", { name: "İş kalemini düzenle" })
    .getByRole("button", { name: "Adımlara böl" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Bölme önerisi modül sayfasında.");

  const suggestion = page.getByRole("region", { name: "Bölme önerisi: Dönem projesi" });
  await expect(suggestion.getByRole("listitem")).toHaveText([
    /Kapsamı çıkar/,
    /İlk taslak/,
    /Gözden geçir ve bitir/,
  ]);
  // Not work yet: the pieces are not listed among the module's work.
  await expect(upcoming(page).getByRole("list").last().getByText("Kapsamı çıkar")).toHaveCount(0);

  await suggestion.getByRole("button", { name: "Böl", exact: true }).click();
  await expect(suggestion).toBeHidden();
  await waitFor(
    () => rows("work_items"),
    (list) => list.filter((item) => item.status === "active").length === 4,
  );
  await expect(upcoming(page).getByText("Kapsamı çıkar")).toBeVisible();
});

test("the module reads a pasted list through its extractor; kept suggestions become records", async ({
  page,
}) => {
  await activateDeneme(page);
  await page.goto("/m/deneme");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Metinden çıkar" })
    .click();
  await expect(page.getByRole("heading", { name: "Metinden çıkar" })).toBeVisible();
  const text = page.getByRole("main").getByRole("textbox", { name: "Metin" });
  // While the page changes, the old screen may still be there for a moment.
  await expect(text).toHaveCount(1);
  await text.fill("- Rapor taslağı cuma 45dk\n- Kitabı iade et");
  await page.getByRole("button", { name: "Oku" }).click();

  const suggestions = page.getByRole("region", { name: "Öneriler" });
  await expect(suggestions.getByRole("listitem")).toHaveCount(2);
  await suggestions.getByRole("button", { name: "Hepsini ekle" }).click();
  await expect(page.getByRole("status")).toHaveText("2 kayıt eklendi.");
  const items = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 2,
  );
  expect(items.map((item) => [item.title, item.minutes]).sort()).toEqual([
    ["Kitabı iade et", null],
    ["Rapor taslağı", 45],
  ]);
});

test("settings show this month's calls and what they cost", async ({ page }) => {
  await activateDeneme(page);
  await page.goto("/");
  await freeLine(page, "Sunum slaytları");
  await waitFor(
    () => rows("ai_calls"),
    (list) => list.length === 1,
    10_000,
  );
  await page.goto("/ayarlar");
  const table = page.getByRole("table", { name: "Bu ayın yapay zeka çağrıları" });
  await expect(table.getByRole("row").filter({ hasText: "Giriş okuma" })).toContainText(
    "fake-fast",
  );
});

test("without any provider every feature works: lines wait in the inbox, efforts take the middle", async ({
  page,
}) => {
  await activateDeneme(page, WITHOUT_AI);
  await page.goto(`${WITHOUT_AI}/ayarlar`);
  await expect(page.getByTestId("ai-state")).toHaveText(/API anahtarı yok/);

  await page.goto(`${WITHOUT_AI}/`);
  await freeLine(page, "Sunum slaytları cuma");
  await page.goto(`${WITHOUT_AI}/m/deneme`);
  await addRecord(page, "Rapor taslağı");
  const [item] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  await page.waitForTimeout(1500);
  expect((await rows("work_items"))[0]).toMatchObject({
    effort_total_minutes: 135,
    ai: null,
  });
  expect(item.provenance).toMatchObject({ effort_total_minutes: "default" });
  const [entry] = await rows("inbox_entries");
  expect(entry.status).toBe("new");
  expect(await rows("tasks")).toEqual([]);
  expect(await rows("ai_calls")).toEqual([]);

  // Nothing on screen breaks: the inbox shows the line with its manual actions.
  await page.goto(`${WITHOUT_AI}/gelen`);
  const card = page.getByRole("listitem").filter({ hasText: "Sunum slaytları cuma" });
  await expect(card.getByRole("button", { name: "İşe çevir" })).toBeVisible();
  await expect(card.getByText("Öneri:")).toHaveCount(0);
});
