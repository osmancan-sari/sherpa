import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { seedDemo } from "../../scripts/demo-data";
import { insert, rows, update, waitFor } from "./data";
import { test } from "./fixtures";
import { ALLOWED_EMAIL, requestCode } from "./helpers";
import { type Cookie, PUBLISHABLE_KEY, readSession, SUPABASE_URL } from "./supabase";

// Phase screenshots. Runs only when SHERPA_SHOTS names the phase folder, for example:
//   $env:SHERPA_SHOTS = "c1"; npm run test:e2e
// Files land in docs/ekran-goruntuleri/<folder>/<pano|telefon>-<screen>-<theme>.png
//
// The screens are shown with the sample data (scripts/demo-data.ts) and the "deneme" module.

const folder = path.join("docs", "ekran-goruntuleri", process.env.SHERPA_SHOTS ?? "gecici");

/** A database client signed in as the test account, from the session the tests store. */
async function userDb() {
  const state = JSON.parse(readFileSync("playwright/.auth/user.json", "utf8")) as {
    cookies: Cookie[];
  };
  const session = await readSession(state.cookies);
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    accessToken: async () => session.access_token,
  });
}

/** Sample data, plus the test module with a few records of its own. */
async function prepare(page: Page): Promise<string> {
  await seedDemo(await userDb(), new Date());
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  await page.goto("/m/deneme");
  const actions = page.getByRole("toolbar", { name: "Hızlı eylemler" });
  await actions.getByRole("button", { name: "Örnek kayıt" }).click();
  const [first] = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 1,
  );
  // The action goes on after the record is stored: it proposes the work and publishes an
  // event. Wait for all of it before leaving the page.
  await waitFor(
    () => rows("work_items"),
    (list) => list.some((item) => item.title === "Örnek hedef"),
  );
  await waitFor(
    () => rows("modules"),
    (list) =>
      list.some((row) => (row.settings as { added_count?: number } | null)?.added_count === 1),
  );
  // Finished records are written straight into the module's table: they have no open work.
  // (An open record has to come through the module, or it would have no work item.)
  await insert("deneme_items", [
    { title: "Kaynak taraması", minutes: 45, done: true, spent_minutes: 50, feedback: "kolay" },
    { title: "Sunum provası", minutes: 30, done: true, spent_minutes: 25 },
  ]);
  return first.id as string;
}

type Screen = { name: string; path: string; ready: (page: Page) => Promise<void> };

const heading = (name: string) => async (page: Page) => {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

function screensFor(itemId: string): Screen[] {
  return [
    {
      name: "bugun",
      path: "/",
      ready: async (page) => {
        await expect(
          page.getByRole("region", { name: "Şimdi" }).getByRole("heading"),
        ).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Modüller" })).toContainText("Deneme");
      },
    },
    {
      name: "hafta",
      path: "/hafta",
      ready: async (page) => {
        await expect(
          page.getByRole("region", { name: "Haftanın kalemleri" }).getByRole("listitem").first(),
        ).toBeVisible();
      },
    },
    {
      name: "kapanis",
      path: "/kapanis",
      ready: async (page) => {
        await expect(page.getByRole("region", { name: "Sorular" })).toBeVisible();
      },
    },
    {
      name: "moduller",
      path: "/m",
      ready: async (page) => {
        await expect(page.getByRole("main").getByRole("link", { name: /Deneme/ })).toBeVisible();
      },
    },
    {
      name: "modul-okul",
      path: "/m/okul-ornek",
      ready: async (page) => {
        await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText(
          "YZV406E HW2",
        );
        await expect(page.getByRole("region", { name: "Geçmiş ve gidişat" })).toContainText("Okul");
      },
    },
    {
      name: "modul-deneme",
      path: "/m/deneme",
      ready: async (page) => {
        await expect(
          page.getByRole("table", { name: "Deneme kayıtları" }).getByRole("row"),
        ).toHaveCount(4);
        await expect(page.getByLabel("Bu hafta")).toBeVisible();
        await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText(
          "Örnek hedef",
        );
      },
    },
    {
      name: "modul-deneme-bilesenler",
      path: "/m/deneme/bilesenler",
      ready: async (page) => {
        await expect(page.getByRole("list", { name: "Tarihli kayıtlar" })).toBeVisible();
      },
    },
    {
      name: "modul-deneme-kayit",
      path: `/m/deneme/kayit/${itemId}`,
      ready: async (page) => {
        await expect(page.getByRole("heading", { level: 2, name: "Örnek hedef" })).toBeVisible();
      },
    },
    {
      name: "modul-deneme-tam-ekran",
      path: "/m/deneme/tam/odak",
      ready: async (page) => {
        await expect(page.getByRole("timer", { name: "Odak süresi" })).toBeVisible();
      },
    },
    {
      name: "gelen",
      path: "/gelen",
      ready: async (page) => {
        // Two plain entries and the card the AI left (sample data, Ç2).
        await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
      },
    },
    {
      name: "ayarlar",
      path: "/ayarlar",
      ready: async (page) => {
        // Two parts of this screen arrive after the shell: the active theme (known only
        // after hydration) and the account line (streamed in). Wait for both before the picture.
        await expect(
          page.getByRole("group", { name: "Tema" }).locator("[aria-pressed=true]"),
        ).toHaveCount(1);
        await expect(
          page.locator("section", { hasText: "Hesap" }).getByRole("paragraph"),
        ).toHaveText(ALLOWED_EMAIL);
      },
    },
    {
      name: "ayarlar-moduller",
      path: "/ayarlar/moduller",
      ready: async (page) => {
        await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
      },
    },
    {
      name: "modul-deneme-metin",
      path: "/m/deneme/metin",
      ready: heading("Metinden çıkar"),
    },
    {
      name: "ayarlar-modul-deneme",
      path: "/ayarlar/moduller/deneme",
      ready: heading("Deneme ayarları"),
    },
    {
      name: "ayarlar-bloklar",
      path: "/ayarlar/bloklar",
      ready: async (page) => {
        await expect(
          page.getByRole("list", { name: "Yaklaşan bloklar" }).getByRole("listitem").first(),
        ).toBeVisible();
      },
    },
  ];
}

/** In the light theme only the screens where colour carries the most. */
const LIGHT = ["bugun", "modul-okul", "modul-deneme", "modul-deneme-bilesenler", "ayarlar-bloklar"];

for (const theme of ["dark", "light"] as const) {
  test(`screens, ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    const itemId = await prepare(page);
    const phone = testInfo.project.use.isMobile === true;
    const shot = async (name: string) => {
      const file = (suffix: string) =>
        path.join(folder, `${testInfo.project.name}-${name}${suffix}-${theme}.png`);
      // Move the pointer away, so no button is caught in its hover state.
      await page.mouse.move(0, 0);
      // Finish colour transitions instead of catching them halfway.
      if (!phone) {
        await page.screenshot({ path: file(""), fullPage: true, animations: "disabled" });
        return;
      }
      // On the phone the bottom bar is fixed to the screen, so a full-page picture would show
      // it in the middle of the page. Take what the screen shows: the top, and for a long page
      // its end as well.
      await page.screenshot({ path: file(""), animations: "disabled" });
      const long = await page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight * 1.3,
      );
      if (long) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.screenshot({ path: file("-alt"), animations: "disabled" });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    };

    for (const screen of screensFor(itemId)) {
      if (theme === "light" && !LIGHT.includes(screen.name)) continue;
      await page.goto(screen.path);
      await screen.ready(page);
      await shot(screen.name);
    }
    if (theme === "light") return;

    // Dialogs and states that need a touch first.
    await page.goto("/m/okul-ornek");
    await page.getByRole("button", { name: "Düzenle: YZV406E HW2: lokalizasyon soruları" }).click();
    await expect(page.getByRole("dialog", { name: "İş kalemini düzenle" })).toBeVisible();
    await shot("duzenleme");
    await page.keyboard.press("Escape");

    // The AI's part (Ç2): the reasons of an estimate, the reason in the form, a suggested split.
    // The sample data's report was sized by the fake provider; the split is written as data.
    const [report] = (await rows("work_items")).filter((row) => row.key === "project:dl:report");
    await insert(
      "work_items",
      ["Kaynakları topla", "Taslak bölümler", "Gözden geçir"].map((title, index) => ({
        module_id: report.module_id,
        parent_id: report.id,
        title,
        status: "proposed",
        effort_total_minutes: [60, 150, 60][index],
        ai: {
          kind: "decompose",
          model: "fake-plan",
          at: new Date().toISOString(),
          call_id: "",
          input: "DL ara raporu",
          user_edited: [],
          fields: {
            effort_total_minutes: {
              value: [60, 150, 60][index],
              confidence: 0.6,
              reason: "Önce kaynaklar, sonra taslak, en son gözden geçirme.",
            },
          },
        },
      })),
    );
    await page.goto("/m/okul-ornek");
    const reportRow = page
      .getByRole("region", { name: "Yaklaşanlar" })
      .getByRole("listitem")
      .filter({ hasText: "DL ara raporu" });
    await reportRow.getByRole("button", { name: "Yapay zekanın koyduğu değerler" }).click();
    await expect(reportRow.getByRole("note")).toBeVisible();
    await shot("yz-gerekce");
    await reportRow.getByRole("button", { name: "Düzenle: DL ara raporu" }).click();
    await expect(page.getByRole("dialog", { name: "İş kalemini düzenle" })).toBeVisible();
    await shot("yz-duzenleme");
    await page.keyboard.press("Escape");

    await page.goto("/");
    const now = page.getByRole("region", { name: "Şimdi" });
    await expect(now.getByRole("heading")).toBeVisible();
    await page.getByRole("button", { name: "Yeni giriş" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
    await dialog.getByLabel("Giriş", { exact: true }).fill("Sunum slaytları cuma 45dk");
    await dialog.getByRole("button", { name: "Okul", exact: true }).click();
    await shot("hizli-giris");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Ç3: why this work, the minutes the user has, the closing's draft, the night.
    await now.getByRole("button", { name: "Neden?" }).click();
    await expect(now.getByRole("note", { name: "Neden bu iş" })).toBeVisible();
    await shot("bugun-neden");

    await now.getByRole("button", { name: "Başla" }).click();
    await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
    await shot("bugun-oturum");
    await now.getByRole("button", { name: "Durdur" }).click();
    await expect(now.getByRole("button", { name: "Başla" })).toBeVisible();

    await page.getByRole("button", { name: "X dk'm var" }).click();
    const minutes = page.getByRole("dialog", { name: "Kaç dakikan var?" });
    await minutes.getByLabel("Dakika").fill("30");
    await minutes.getByRole("button", { name: "Bul" }).click();
    await expect(minutes.getByRole("button", { name: "Başla" })).toBeVisible();
    await shot("x-dk");
    await page.keyboard.press("Escape");

    await page.goto("/kapanis");
    await page.getByRole("button", { name: "İleri" }).click();
    await shot("kapanis-bugun");
    await page.getByRole("button", { name: "İleri" }).click();
    await expect(page.getByRole("region", { name: "Yarın" })).toBeVisible();
    await shot("kapanis-yarin");

    // The night: the day's finish line has passed.
    const [today] = (await rows("days")).filter((row) => row.plan_source !== null);
    await update("days", today.id as string, { finish_line: "00:00" });
    await page.goto("/");
    await expect(now).toContainText("Yarın ilk iş:");
    await shot("bugun-gece");
  });
}

base("login screens", async ({ browser }, testInfo) => {
  const { viewport, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  const shot = async (name: string) => {
    // Move the pointer off the button it just clicked, so the picture shows the resting state.
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(folder, `${testInfo.project.name}-${name}-dark.png`),
      animations: "disabled",
    });
  };

  // Step one: the e-mail address.
  await page.goto("/giris");
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await shot("giris");

  // Another address is turned away.
  await page.getByLabel("E-posta").fill("baskasi@ornek.test");
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot("giris-reddedildi");

  // Step two: the code from the e-mail.
  await requestCode(page);
  await shot("giris-kod");

  await context.close();
});
