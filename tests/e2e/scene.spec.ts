import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { activateDeneme, addRecord, recordSpeech, spoken, startFromModule } from "./scene-helpers";

// The scene's rules end to end (Ç3c; docs/06-modul-sozlesmesi.md, "Sahne"): "Çık" and
// "Sahneye dön", a failing scene, work without a scene, the step scene, and `say`.

test("Çık leaves the scene and the session runs on; Sahneye dön goes back", async ({ page }) => {
  await activateDeneme(page);
  await addRecord(page, "Okuma notları", { minutes: "30", kind: "odak" });
  await startFromModule(page, "Okuma notları");
  await expect(page.getByTestId("scene")).toBeVisible();

  await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();
  const card = page.getByRole("region", { name: "Şimdi" });
  await expect(card.getByRole("heading", { name: "Okuma notları" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Bitti" })).toBeVisible();
  expect((await rows("sessions"))[0].ended_at).toBeNull();
  // Remembered on this device across a reload.
  await page.reload();
  await expect(card.getByRole("button", { name: "Sahneye dön" })).toBeVisible();
  await card.getByRole("button", { name: "Sahneye dön" }).click();
  await expect(page.getByTestId("scene")).toBeVisible();
});

test("a scene that fails gives the standard card back with one line; the session is untouched", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Kırık sahne [hata]", { minutes: "30", kind: "odak" });
  await startFromModule(page, "Kırık sahne [hata]");
  await expect(
    page.getByRole("status").filter({ hasText: "Sahne açılamadı; iş sürüyor." }),
  ).toBeVisible();
  const card = page.getByRole("region", { name: "Şimdi" });
  await expect(card.getByRole("heading", { name: "Kırık sahne [hata]" })).toBeVisible();
  await expect(page.getByTestId("scene")).toHaveCount(0);
  expect((await rows("sessions"))[0].ended_at).toBeNull();
  await card.getByRole("button", { name: "Bitti" }).click();
  await waitFor(
    () => rows("sessions"),
    (list) => list[0].ended_at !== null,
  );
});

test("work whose module has no scene, or whose scene says no, keeps the Ç3 card", async ({
  page,
}) => {
  await activateDeneme(page);
  // A habit: the module's scene answers no.
  await addRecord(page, "Esneme", { kind: "aliskanlik" });
  await startFromModule(page, "Esneme");
  const card = page.getByRole("region", { name: "Şimdi" });
  await expect(card.getByRole("button", { name: "Bitti" })).toBeVisible();
  await expect(page.getByTestId("scene")).toHaveCount(0);

  // A module without code: no scene at all. Starting its work stops the habit.
  const mod = await seedModule();
  const [task] = await insert("tasks", { module_id: mod.id, title: "Ödev", est_minutes: 30 });
  await page.goto("/");
  await page
    .getByRole("region", { name: "Sıradakiler" })
    .getByRole("button", { name: "Başla: Ödev" })
    .or(card.getByRole("button", { name: "Başla" }))
    .first()
    .click();
  await waitFor(
    () => rows("sessions"),
    (list) => list.some((row) => row.task_id === task.id && row.ended_at === null),
  );
  await expect(card.getByRole("button", { name: "Bitti" })).toBeVisible();
  await expect(page.getByTestId("scene")).toHaveCount(0);
});

test("the step scene: countdown, Sonraki, Atla; its step kept in the module's row", async ({
  page,
}) => {
  await page.clock.install();
  await activateDeneme(page);
  await addRecord(page, "Salon", { kind: "antrenman", minutes: "45" });
  await startFromModule(page, "Salon");
  const scene = page.getByTestId("deneme-workout");
  await expect(scene.getByRole("heading", { name: "Isınma" })).toBeVisible();
  await expect(scene.getByRole("timer", { name: "Kalan süre" })).toHaveText("05:00");

  // The countdown runs out: the next step comes by itself.
  await page.clock.fastForward("05:01");
  await expect(scene.getByRole("heading", { name: "Squat" })).toBeVisible();
  await expect(scene).toContainText("10 tekrar");
  await scene.getByRole("button", { name: "Sonraki" }).click();
  await expect(scene.getByRole("heading", { name: "Şınav" })).toBeVisible();
  await scene.getByRole("button", { name: "Atla" }).click();
  await expect(scene.getByRole("heading", { name: "Soğuma" })).toBeVisible();
  await waitFor(
    () => rows("deneme_items"),
    (list) => list[0]?.scene_step === 3,
  );

  // Back on the screen, it starts where the row says.
  await page.reload();
  const again = page.getByTestId("deneme-workout");
  await expect(again.getByRole("heading", { name: "Soğuma" })).toBeVisible();
  await again.getByRole("button", { name: "Sonraki" }).click();
  await expect(page.getByTestId("steps-done")).toBeVisible();
  await page.getByRole("button", { name: "Antrenmanı bitir" }).click();
  await expect(page.getByTestId("scene")).toBeHidden();
  await waitFor(
    () => rows("rhythm_logs"),
    (list) => list.length === 1,
  );
});

test("say: the scene's words are spoken on the device that was touched, and shown too", async ({
  page,
}) => {
  await recordSpeech(page);
  await activateDeneme(page);
  await addRecord(page, "Sunum", { minutes: "30", kind: "odak" });
  await startFromModule(page, "Sunum");
  const scene = page.getByTestId("deneme-focus");
  await scene.getByRole("button", { name: "Anlat" }).click();
  await expect(scene.getByRole("status")).toContainText("Sunum sürüyor.");
  await expect.poll(() => spoken(page)).toEqual(["Sunum sürüyor."]);
});

test("the voice settings are this device's: off is silent, Dene speaks, the choice stays", async ({
  page,
}) => {
  await recordSpeech(page);
  await page.goto("/ayarlar");
  const voice = page.getByRole("group", { name: "Sesli anlatım" });
  await voice.getByRole("button", { name: "Dene" }).click();
  await expect.poll(() => spoken(page)).toEqual(["Sesli anlatım açık.", "Böyle konuşacağım."]);
  await expect(voice.getByLabel("Ses", { exact: true })).toContainText("Deneme sesi");

  await voice.getByLabel("Sesli anlatım açık").uncheck();
  await voice.getByRole("button", { name: "Dene" }).click();
  await page.waitForTimeout(300);
  expect(await spoken(page)).toHaveLength(2);
  // Kept on the device across a reload.
  await page.reload();
  await expect(voice.getByLabel("Sesli anlatım açık")).not.toBeChecked();
});
