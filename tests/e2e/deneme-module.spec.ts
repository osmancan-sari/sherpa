import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The "deneme" module: everything it shows and does reaches the core through the module
// contract. These tests walk every connection point through the real interface.

async function activate(page: Page) {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  const [row] = await waitFor(
    () => rows("modules"),
    (list) => list.length === 1,
  );
  return row;
}

async function addRecord(
  page: Page,
  title: string,
  extra: { minutes?: string; kind?: string } = {},
) {
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill(title);
  await page.keyboard.press("Tab");
  await dialog
    .getByRole("group", { name: "Kayıt türü" })
    .getByRole("button", { name: "Kayıt" })
    .click();
  // The first field of the module's form already holds what was typed.
  await expect(dialog.getByLabel("Ad", { exact: true })).toHaveValue(title);
  if (extra.kind) await dialog.getByLabel("Tür", { exact: true }).selectOption(extra.kind);
  if (extra.minutes) await dialog.getByLabel(/Süre \(dk\)/).fill(extra.minutes);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
}

test("switching the module on gives it a row, a chip and a page", async ({ page }) => {
  const row = await activate(page);
  expect(row).toMatchObject({ slug: "deneme", name: "Deneme", status: "active", color: "#6250d6" });
  expect(row.mode_behavior).toMatchObject({ holiday: { weightMultiplier: 0 } });
  expect((await rows("areas")).map((area) => area.slug)).toEqual(["sinama"]);

  await page.goto("/");
  const chip = page
    .getByRole("navigation", { name: "Modüller" })
    .getByRole("link", { name: /Deneme/ });
  await expect(chip).toContainText("açık kayıt yok");
  await chip.click();
  await expect(page).toHaveURL(/\/m\/deneme$/);

  // The five regions of every module page, in order.
  await expect(page.getByRole("heading", { level: 1, name: "Deneme" })).toBeVisible();
  const regions = ["Durum", "Yaklaşanlar", "Gövde", "Geçmiş ve gidişat", "Giriş ve ayarlar"];
  const tops: number[] = [];
  for (const name of regions) {
    const region = page.getByRole("region", { name });
    await expect(region).toBeVisible();
    tops.push((await region.boundingBox())!.y);
  }
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  await expect(page.getByRole("region", { name: "Gövde" })).toContainText("Henüz kayıt yok.");
  await expect(page.getByLabel("Bu hafta")).toContainText("Açık kayıt");
});

test("its entry type in quick add creates a record, proposes the work and publishes an event", async ({
  page,
}) => {
  const mod = await activate(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await addRecord(page, "Rapor taslağı");
  await expect(page.getByRole("status")).toHaveText("Kaydedildi.");

  const [item] = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 1,
  );
  expect(item).toMatchObject({ title: "Rapor taslağı", kind: "hedef", done: false });

  // The module proposed an envelope; the core wrote the work item. No length was given, so
  // the effort is the middle of the module's bounds (30 to 240 minutes).
  const [work] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  expect(work).toMatchObject({
    module_id: mod.id,
    key: `item:${item.id}`,
    title: "Rapor taslağı",
    status: "active",
    effort_total_minutes: 135,
    source_type: "deneme.item",
    source_id: item.id,
  });
  expect(work.provenance).toMatchObject({ title: "module", effort_total_minutes: "default" });

  // The event is recorded, and the module's own listener counted it in its settings.
  const events = await waitFor(
    () => rows("events"),
    (list) => list.length === 1,
  );
  expect(events[0]).toMatchObject({ type: "deneme.item_added", module_slug: "deneme" });
  await waitFor(
    () => rows("modules"),
    (list) => (list[0].settings as { added_count?: number }).added_count === 1,
  );

  // The work is offered on the Today screen and the chip changed.
  await expect(page.getByRole("region", { name: "Şimdi" }).getByRole("heading")).toHaveText(
    "Rapor taslağı",
  );
  await expect(page.getByRole("navigation", { name: "Modüller" })).toContainText("1 açık kayıt");
});

test("proposing again with the same key keeps one record, and keeps what the user changed", async ({
  page,
}) => {
  await activate(page);
  await page.goto("/m/deneme");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Örnek kayıt" })
    .click();
  const [work] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  expect(work.title).toBe("Örnek hedef");
  expect(work.due_at).not.toBeNull();

  // The user changes the work's importance in the core (by hand, as the planner screens will).
  await update("work_items", work.id as string, {
    importance: 4,
    provenance: { ...(work.provenance as object), importance: "user" },
  });

  // The record's name is edited in the module's table: the module proposes the same key again.
  const table = page.getByRole("table", { name: "Deneme kayıtları" });
  const cell = table.getByLabel("Ad: Örnek hedef");
  await cell.fill("Örnek hedef (yeni ad)");
  await cell.press("Enter");

  const works = await waitFor(
    () => rows("work_items"),
    (list) => list[0].title === "Örnek hedef (yeni ad)",
  );
  expect(works).toHaveLength(1);
  expect(works[0]).toMatchObject({ id: work.id, importance: 4, key: work.key });
  expect(works[0].provenance).toMatchObject({ importance: "user", title: "module" });
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText(
    "Örnek hedef (yeni ad)",
  );

  // A length typed into the table is a fact from the module: it replaces the default effort.
  const minutes = table.getByLabel("Süre: Örnek hedef (yeni ad)");
  await minutes.fill("60");
  await minutes.press("Enter");
  const sized = await waitFor(
    () => rows("work_items"),
    (list) => list[0].effort_total_minutes === 60,
  );
  expect(sized[0].provenance).toMatchObject({ effort_total_minutes: "module" });
  expect(await rows("deneme_items")).toHaveLength(1);
});

test("tabs, a sub page and a full-screen view are the module's own, under its address", async ({
  page,
}) => {
  await activate(page);
  await page.goto("/m/deneme");
  await page.getByRole("button", { name: "Örnek kayıt" }).click();
  // The name sits in a field of the table (edited in place), not in its text.
  await expect(
    page.getByRole("table", { name: "Deneme kayıtları" }).getByLabel("Ad: Örnek hedef"),
  ).toHaveValue("Örnek hedef");
  const [item] = await rows("deneme_items");

  // Tabs map to addresses.
  const tabs = page.getByRole("navigation", { name: "Sekmeler" });
  await expect(tabs.getByRole("link", { name: "Kayıtlar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await tabs.getByRole("link", { name: "Bileşenler" }).click();
  await expect(page).toHaveURL(/\/m\/deneme\/bilesenler$/);
  await expect(tabs.getByRole("link", { name: "Bileşenler" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The component kit, drawn by the module with its own data.
  const body = page.getByRole("region", { name: "Gövde" });
  await expect(body.getByRole("group", { name: "Toplam kayıt sayısı, hafta hafta" })).toBeVisible();
  await expect(
    body.getByRole("list", { name: "Son dört haftada eklenen kayıtlar" }).getByRole("listitem"),
  ).toHaveCount(28);
  await expect(body.getByRole("list", { name: "Tarihli kayıtlar" })).toContainText("Örnek hedef");
  await body.getByRole("button", { name: "Tekrar: artır" }).click();
  await expect(body.getByRole("group", { name: "Tekrar" }).getByRole("status")).toContainText("4");
  await body.getByRole("radio", { name: "Etkinlik" }).click();
  await expect(body.getByRole("radio", { name: "Etkinlik" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // A reload on a tab address lands on the same tab.
  await page.reload();
  await expect(tabs.getByRole("link", { name: "Bileşenler" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Sub page.
  await tabs.getByRole("link", { name: "Kayıtlar" }).click();
  await page.getByRole("link", { name: "Ayrıntı: Örnek hedef" }).click();
  await expect(page).toHaveURL(new RegExp(`/m/deneme/kayit/${item.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Kayıt" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("2 sa 15 dk (varsayılan: sınırın ortası)");
  await page.getByRole("main").getByRole("link", { name: "Deneme" }).click();
  await expect(page).toHaveURL(/\/m\/deneme$/);

  // Full-screen view: the app shell is gone, the view has the screen.
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("link", { name: "Odak" })
    .click();
  await expect(page).toHaveURL(/\/m\/deneme\/tam\/odak$/);
  await expect(page.getByRole("timer", { name: "Odak süresi" })).toContainText("25:00");
  await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yeni giriş" })).toHaveCount(0);
  await page.getByRole("button", { name: "Dakika: azalt" }).click();
  await expect(page.getByRole("timer")).toContainText("20:00");
  await page.getByRole("button", { name: "Başlat" }).click();
  await expect(page.getByRole("timer")).toContainText(/19:5\d/, { timeout: 5000 });
  await page.getByRole("link", { name: "Kapat" }).click();
  await expect(page).toHaveURL(/\/m\/deneme$/);
  await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toBeVisible();
});

test("the quick action opens the module's entry form; its settings form saves", async ({
  page,
}) => {
  await activate(page);
  await page.goto("/m/deneme");
  await page
    .getByRole("toolbar", { name: "Hızlı eylemler" })
    .getByRole("button", { name: "Kayıt ekle" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  // Opened on the module and on its entry type.
  await expect(dialog.getByRole("button", { name: "Deneme" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    dialog.getByRole("group", { name: "Kayıt türü" }).getByRole("button", { name: "Kayıt" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  await dialog.getByLabel("Giriş").fill("Esneme");
  await dialog.getByLabel("Tür", { exact: true }).selectOption("aliskanlik");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();

  // A recurrence proposal became a rhythm, with the module's default length.
  const [rhythm] = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 1,
  );
  expect(rhythm).toMatchObject({
    title: "Esneme",
    target_count: 3,
    period: "week",
    floor_count: 1,
    est_minutes: 15,
  });
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("Esneme");
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("0/3");

  // The module's own settings form, at its place under Settings.
  await page
    .getByRole("region", { name: "Giriş ve ayarlar" })
    .getByRole("link", { name: "Modül ayarları" })
    .click();
  await expect(page).toHaveURL(/\/ayarlar\/moduller\/deneme$/);
  await expect(page.getByRole("heading", { level: 1, name: "Deneme ayarları" })).toBeVisible();
  const form = page.getByRole("region", { name: "Modülün ayarları" });
  await form.getByRole("button", { name: "Varsayılan süre: artır" }).click();
  await form.getByRole("button", { name: "Kaydet" }).click();
  // The stepper's own readout is a status too; the notice is the one that says "Kaydedildi."
  await expect(page.getByRole("status").filter({ hasText: "Kaydedildi." })).toBeVisible();
  await waitFor(
    () => rows("modules"),
    (list) => (list[0].settings as { default_minutes?: number }).default_minutes === 20,
  );
  await expect(page.getByRole("region", { name: "Hayat modları" })).toContainText(
    "Alışkanlıklar durur.",
  );

  // A fixed-time proposal became a block.
  await page.goto("/m/deneme");
  await page
    .getByRole("region", { name: "Giriş ve ayarlar" })
    .getByRole("button", { name: "Kayıt ekle" })
    .click();
  await dialog.getByLabel("Giriş").fill("Toplantı");
  await dialog.getByLabel("Tür", { exact: true }).selectOption("etkinlik");
  await dialog.getByLabel(/Tarih/).fill("2031-03-14");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  const [block] = await waitFor(
    () => rows("blocks"),
    (list) => list.length === 1,
  );
  expect(block).toMatchObject({ title: "Toplantı", status: "planned" });
  expect(new Date(block.starts_at as string).toISOString()).toBe("2031-03-14T07:00:00.000Z");
  expect(new Date(block.ends_at as string).toISOString()).toBe("2031-03-14T08:00:00.000Z");
});

test("the module's own content on the card, the outcome report and its question", async ({
  page,
}) => {
  await activate(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await addRecord(page, "Kısa hedef", { minutes: "30" });
  const [item] = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 1,
  );

  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now).toContainText("30 dk");
  await now.getByRole("button", { name: "Başla" }).click();
  // nowCard: the module adds its own line and link to the card of its own work.
  await expect(now).toContainText("Deneme modülünün kaydı", { timeout: 5000 });
  await expect(now.getByRole("link", { name: "Kaydı aç" })).toHaveAttribute(
    "href",
    `/m/deneme/kayit/${item.id}`,
  );

  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  await update("sessions", session.id as string, {
    started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
  });
  await now.getByRole("button", { name: "Bitti" }).click();

  // The planned effort is used up: the item does not close on its own, the card asks.
  await expect(now).toContainText("Ayrılan 30 dk doldu. Bitti mi?");
  await now.getByRole("button", { name: "Bitti" }).click();

  // onOutcome: the core told the module what the work cost; the module closed its record.
  const [done] = await waitFor(
    () => rows("deneme_items"),
    (list) => list[0].done === true,
  );
  expect(done.spent_minutes).toBe(30);
  expect((await rows("work_items"))[0].status).toBe("done");

  // The module asked one question; the answer comes back to it as an event.
  const question = page.getByRole("region", { name: "Soru" });
  await expect(question).toContainText("Deneme · “Kısa hedef” nasıldı?");
  await question.getByRole("button", { name: "Zor" }).click();
  await expect(question).toBeHidden();
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0].feedback === "zor",
  );
  await expect(page.getByRole("navigation", { name: "Modüller" })).toContainText("açık kayıt yok");
});

test("'Sonra' puts the question away for now", async ({ page }) => {
  await activate(page);
  const [mod] = await rows("modules");
  await insert("prompts", {
    module_id: mod.id,
    kind: "zorluk",
    question: "Sonraya bırakılacak soru",
    options: [{ value: "kolay", label: "Kolay" }],
  });
  await page.goto("/");
  const question = page.getByRole("region", { name: "Soru" });
  await question.getByRole("button", { name: "Sonra" }).click();
  await expect(question).toBeHidden();
  const [prompt] = await waitFor(
    () => rows("prompts"),
    (list) => Date.parse(list[0].ask_after as string) > Date.now() + 2 * 3_600_000,
  );
  expect(prompt.status).toBe("pending");
});

test("deleting a record takes its work back; nothing in the core is deleted", async ({ page }) => {
  await activate(page);
  await page.goto("/m/deneme");
  await page.getByRole("button", { name: "Örnek kayıt" }).click();
  await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  await page.getByRole("button", { name: "Sil: Örnek hedef" }).click();

  await expect(page.getByRole("region", { name: "Gövde" })).toContainText("Henüz kayıt yok.");
  const [work] = await waitFor(
    () => rows("work_items"),
    (list) => list[0].status === "dropped",
  );
  expect(work.title).toBe("Örnek hedef");
  expect(await rows("deneme_items")).toHaveLength(0);
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText(
    "Bu modülde sırada iş yok.",
  );
  expect((await rows("events")).map((event) => event.type)).toEqual([
    "deneme.item_added",
    "deneme.item_removed",
  ]);
});

test("a pasted sherpa block goes straight to the module that knows it", async ({ page }) => {
  await activate(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  const pasted = [
    "Doküman hazır.",
    "```sherpa",
    '{ "deneme": { "title": "Bloktan gelen kayıt", "minutes": 40 } }',
    "```",
  ].join("\n");
  // Pasted the way the clipboard delivers it: several lines at once.
  await dialog.getByLabel("Giriş").focus();
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.activeElement!.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, pasted);
  // Browsers insert the text themselves on a real paste; a synthetic event does not, so the
  // same text is typed in if the field is still empty.
  if ((await dialog.getByLabel("Giriş").inputValue()) === "") {
    await dialog.getByLabel("Giriş").fill(pasted);
  }
  expect(await dialog.getByLabel("Giriş").inputValue()).toContain("\n");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("Deneme modülüne işlendi.");
  const [item] = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 1,
  );
  expect(item).toMatchObject({ title: "Bloktan gelen kayıt", minutes: 40 });
  const [work] = await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );
  expect(work).toMatchObject({ effort_total_minutes: 40, session_minutes: 40 });
  // The raw entry is kept in the inbox data, marked as routed.
  const [entry] = await waitFor(
    () => rows("inbox_entries"),
    (list) => list[0]?.status === "routed",
  );
  expect(entry.raw_text).toContain("```sherpa");
  expect(entry.routed).toEqual([{ type: "block:kayit", module: "deneme" }]);
});

test("a block nobody knows stays in the inbox as text", async ({ page }) => {
  await activate(page);
  await page.goto("/");
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill('```sherpa\n{ "course": "BBF301E" }\n```');
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Gelen kutusuna eklendi.");
  const [entry] = await waitFor(
    () => rows("inbox_entries"),
    (list) => list.length === 1,
  );
  expect(entry.status).toBe("new");
  expect(await rows("deneme_items")).toHaveLength(0);
});

test("pausing hides the module's work; archiving drops it and keeps the data", async ({ page }) => {
  await activate(page);
  await page.goto("/m/deneme");
  await page.getByRole("button", { name: "Örnek kayıt" }).click();
  await waitFor(
    () => rows("work_items"),
    (list) => list.length === 1,
  );

  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: duraklat" }).click();
  await expect(page.getByRole("button", { name: "Deneme: etkinleştir" })).toHaveText("Sürdür");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText(
    "Bugün için planlanan bir şey yok.",
  );
  await expect(page.getByRole("navigation", { name: "Modüller" })).toHaveCount(0);
  expect((await rows("work_items"))[0].status).toBe("active");

  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: arşivle" }).click();
  const confirm = page.getByRole("alert").filter({ hasText: "Veri silinmez." });
  await expect(confirm).toContainText("Veri silinmez.");
  await confirm.getByRole("button", { name: "Arşivle" }).click();
  await waitFor(
    () => rows("modules"),
    (list) => list[0].status === "archived",
  );
  const [droppedWork] = await rows("work_items");
  expect(droppedWork.status).toBe("dropped");
  expect(await rows("deneme_items")).toHaveLength(1);
  // onArchive: the module had its last word.
  await waitFor(
    () => rows("modules"),
    (list) => typeof (list[0].settings as { archived_on?: string }).archived_on === "string",
  );

  await page.goto("/m/deneme");
  await expect(page.getByRole("main")).toContainText("Bu modül arşivde.");

  // Switching it on again brings the open record's work back (onActivate proposes again).
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await waitFor(
    () => rows("modules"),
    (list) => list[0].status === "active",
  );
  await waitFor(
    () => rows("work_items"),
    (list) => list[0].status === "active",
  );
  expect(await rows("work_items")).toHaveLength(1);
  await page.goto("/m/deneme");
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("Örnek hedef");
});

test("a module row without code has a page with the core's defaults", async ({ page }) => {
  const mod = await seedModule("ev-ornek", "Ev", "#16a34a");
  await insert("tasks", { module_id: mod.id, title: "Çamaşır" });
  const [task] = await rows("tasks");
  await insert("sessions", {
    module_id: mod.id,
    task_id: task.id,
    started_at: new Date(Date.now() - 50 * 60_000).toISOString(),
    ended_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  });

  await page.goto("/m/ev-ornek");
  await expect(page.getByRole("heading", { level: 1, name: "Ev" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("Çamaşır");
  await expect(page.getByRole("region", { name: "Gövde" })).toContainText(
    "Bu modülün kendi görünümü yok.",
  );
  // Without a view of its own, "history" is the time spent per week.
  const history = page.getByRole("region", { name: "Geçmiş ve gidişat" });
  await expect(history.getByRole("group", { name: "Ev: haftalık harcanan süre" })).toBeVisible();
  await history.getByText("Tablo").click();
  await expect(history.getByRole("table")).toContainText("45 dk");

  await page.goto("/m/ev-ornek/olmayan");
  await expect(page.getByRole("main")).toContainText("Bu modülde böyle bir sayfa yok.");
  await page.goto("/m/hic-yok");
  await expect(page.getByRole("main")).toContainText("Böyle bir modül yok.");
  await page.goto("/m/deneme");
  await expect(page.getByRole("main")).toContainText("Bu modül etkin değil.");
  await page.goto("/m/deneme/tam/odak");
  await expect(page.getByText("Bu modül etkin değil.")).toBeVisible();
});

test("the modules screen lists what is switched on", async ({ page }) => {
  await activate(page);
  await seedModule("ev-ornek", "Ev", "#16a34a");
  await page.goto("/m");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /Deneme/ })).toHaveAttribute("href", "/m/deneme");
  await expect(main.getByRole("link", { name: /Ev/ })).toHaveAttribute("href", "/m/ev-ornek");
  await main.getByRole("link", { name: "Modülleri aç, duraklat ya da arşivle" }).click();
  await expect(page).toHaveURL(/\/ayarlar\/moduller$/);
});
