import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Clock times typed on the phone's number pad (Rutin 1 follow-up, 14 Kas 2026): the pad has no
// ":", so the fields take digits alone and put the colon themselves ("0630" → 06:30, "800" →
// 08:00, "24" → 24:00); a colon typed by hand works too. Runs on the board and the phone.

test("the day's frame takes its hours from the number pad", async ({ page }) => {
  await page.goto("/ayarlar");
  const form = page.getByRole("form", { name: "Günün çerçevesi" });
  await form.getByLabel("Günün çerçevesi açık").check();
  const field = (label: string) => form.getByLabel(label, { exact: true });
  await expect(field("Uyanış başlangıç")).toHaveAttribute("inputmode", "numeric");

  const type = async (label: string, keys: string) => {
    await field(label).fill("");
    await field(label).pressSequentially(keys);
  };
  // Four digits: the colon comes at once.
  await type("Uyanış başlangıç", "0630");
  await expect(field("Uyanış başlangıç")).toHaveValue("06:30");
  // Three digits, two digits: on leaving the field.
  await type("Uyanış bitiş", "800");
  await field("Yatış başlangıç").focus();
  await expect(field("Uyanış bitiş")).toHaveValue("08:00");
  await type("Yatış başlangıç", "22");
  await type("Yatış bitiş", "24");
  await field("Uyanış başlangıç").focus();
  await expect(field("Yatış başlangıç")).toHaveValue("22:00");
  await expect(field("Yatış bitiş")).toHaveValue("24:00");

  await form.getByRole("button", { name: "Kaydet" }).click();
  const [settings] = await waitFor(
    () => rows("settings"),
    (list) => list[0]?.day_frame !== null,
  );
  // Midnight is 00:00 in the frame.
  expect(settings.day_frame).toMatchObject({ wake: ["06:30", "08:00"], bed: ["22:00", "00:00"] });
});

test("a work's hours take digits alone, or a colon typed by hand", async ({ page }) => {
  const mod = await seedModule();
  const [task] = await insert<{ id: string }>("tasks", { module_id: mod.id, title: "Salon" });
  await page.goto(`/m/${mod.slug}`);
  await page.getByRole("button", { name: "Düzenle: Salon" }).click();
  const dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await dialog.getByText("Zaman", { exact: true }).click();
  await dialog.getByRole("button", { name: "Yalnızca şu saatlerde: aralık ekle" }).click();
  const from = dialog.getByLabel("Yalnızca şu saatlerde 1: başlangıç");
  const to = dialog.getByLabel("Yalnızca şu saatlerde 1: bitiş");
  // A new range comes with hours of its own: typed over.
  await from.fill("");
  await from.pressSequentially("930");
  await to.fill("");
  await to.pressSequentially("17:30");
  await expect(from).toHaveValue("09:30");
  await expect(to).toHaveValue("17:30");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  const [saved] = await waitFor(
    () => rows("tasks"),
    (list) =>
      list.some(
        (row) => row.id === task.id && (row.timing as { windows?: unknown } | null)?.windows,
      ),
  );
  expect(saved.timing).toMatchObject({ windows: [{ from: "09:30", to: "17:30" }] });
});
