import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The planner on the Today screen (Ç3). The account's day runs from midnight to 23:59
// (tests/e2e/data.ts), so these tests do not depend on the hour they run at.

test("opening the app plans the week and the day; the first touch is the user's", async ({
  page,
}) => {
  const mod = await seedModule();
  const [item] = await insert("work_items", {
    module_id: mod.id,
    title: "Dönem projesi",
    effort_total_minutes: 180,
    session_minutes: 60,
  });

  await page.goto("/");
  // Nobody did anything: the week has its commitment, the item its sitting, the day its plan.
  const [week] = await waitFor(
    () => rows("week_plans"),
    (list) => list.length === 1,
  );
  expect(week).toMatchObject({ committed: [item.id], plan_source: "auto" });
  const sittings = await waitFor(
    () => rows("tasks"),
    (list) => list.length > 0,
  );
  expect(sittings.every((task) => task.work_item_id === item.id)).toBe(true);
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list[0]?.plan_source === "auto",
  );
  expect(day.started_at).toBeNull();
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText("Dönem projesi");

  // The first tap of the day is its start.
  await page.getByRole("heading", { name: "Bugün", exact: true }).click();
  await waitFor(
    () => rows("days"),
    (list) => list[0]?.started_at !== null,
  );
});
