import { rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
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
