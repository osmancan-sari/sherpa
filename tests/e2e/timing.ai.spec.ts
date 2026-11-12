import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// A time constraint written out on a free line becomes the work's (Ç3b; docs/10-yapay-zeka.md,
// rule 12), against the server with the recorded fake provider. The real model is measured by
// `npm run ai:eval`.

test("a free line's stated window and travel land on the task; a line without one has none", async ({
  page,
}) => {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  await page.goto("/");

  const freeLine = async (text: string) => {
    await page.keyboard.press("n");
    const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
    await dialog.getByLabel("Giriş").fill(text);
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
  };
  await freeLine("Salon akşam 8'den sonra, 20 dk yol");
  const [task] = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
    10_000,
  );
  expect(task.timing).toEqual({
    windows: [{ from: "20:00", to: "24:00" }],
    travel: { before: 20, after: 20 },
  });

  await freeLine("Akşam yemeği listesi");
  const all = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 2,
    10_000,
  );
  expect(all.find((row) => row.id !== task.id)?.timing).toBeNull();

  // On the module page the form shows the constraint, and where it came from.
  await page.goto("/m/deneme");
  await page.getByRole("button", { name: /^Düzenle: Salon/ }).click();
  const dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await expect(dialog.getByTestId("timing-summary")).toHaveText("· 20:00–24:00 · yol 20+20 dk");
});
