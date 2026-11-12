import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// The scene on both layouts (Ç3c; docs/07-yol-haritasi.md, "Ç3c"): starting a "deneme" goal
// turns the Today screen into its scene, under the core's strip; finishing it brings the
// standard screen back.

test("starting the work opens the module's scene under the core's strip; Bitti brings the standard screen back", async ({
  page,
}) => {
  await activateDeneme(page);
  await addRecord(page, "Rapor taslağı", { minutes: "30" });
  await startFromModule(page, "Rapor taslağı");

  const scene = page.getByTestId("scene");
  await expect(scene).toBeVisible();
  const strip = page.getByLabel("Sahne şeridi");
  await expect(strip).toContainText("Rapor taslağı");
  await expect(strip.getByRole("button", { name: "Çık" })).toBeVisible();
  await expect(page.getByTestId("deneme-focus")).toBeVisible();
  // The rest of the Today screen is the scene's.
  await expect(page.getByRole("region", { name: "Sıradakiler" })).toHaveCount(0);

  await page.getByTestId("deneme-focus").getByRole("button", { name: "Bitti" }).click();
  await expect(scene).toBeHidden();
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1 && list[0].ended_at !== null,
  );
});
