import { test as base } from "@playwright/test";
import { resetData } from "./data";

/**
 * `test` for the signed-in specs: every test starts from an account without any data, so the
 * order of the tests and what an earlier run left behind never matter.
 */
export const test = base.extend<{ cleanAccount: void }>({
  cleanAccount: [
    async ({}, use) => {
      await resetData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
