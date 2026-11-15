import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { seedDemo } from "../../scripts/demo-data";
import { seedChains } from "../../scripts/demo-chains";
import { seedFacets } from "../../scripts/demo-facets";
import { insert, rows, update, waitFor } from "./data";
import { expect, quietTest as base, test } from "./fixtures";
import { ALLOWED_EMAIL, openQuickAdd, requestCode, roomInTheDay } from "./helpers";
import { type Cookie, PUBLISHABLE_KEY, readSession, SUPABASE_URL } from "./supabase";

// Phase screenshots. Runs only when SHERPA_SHOTS names the phase folder, for example:
//   $env:SHERPA_SHOTS = "c1"; npm run test:e2e
// Files land in docs/ekran-goruntuleri/<folder>/<pano|telefon>-<screen>[-saydamlik].png (Ç4b: one colour
// system; "-saydamlik" is the look with "Saydamlığı azalt" on).
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
async function prepare(page: Page, now: Date): Promise<string> {
  await seedDemo(await userDb(), now);
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
      // Ç4c: Takvim (the closing has no page of its own: its shots are taken in the scene).
      name: "takvim",
      path: "/takvim",
      ready: async (page) => {
        await expect(
          page.getByRole("region", { name: "Bu hafta" }).getByRole("listitem").first(),
        ).toBeVisible();
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
        // The account line streams in after the shell: wait for it before the picture.
        await expect(
          page.locator("section", { hasText: "Hesap" }).getByRole("paragraph"),
        ).toHaveText(ALLOWED_EMAIL);
      },
    },
    {
      name: "ayarlar-gorunum",
      path: "/ayarlar/gorunum",
      ready: async (page) => {
        await expect(page.getByRole("switch", { name: "Saydamlığı azalt" })).toBeVisible();
      },
    },
    {
      name: "galeri",
      path: "/tasarim",
      ready: heading("Tasarım"),
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

/** With "Saydamlığı azalt" only the screens where the glass carries the most (K3B). */
const SOLID = ["bugun", "modul-okul", "gelen", "ayarlar"];

/** The look of the run: the glass as it is, or with "Saydamlığı azalt" (docs/tasarim/ilkeler.md). */
const LOOKS = [
  { name: "cam", suffix: "", choice: { transparency: null, motion: null } },
  { name: "saydamlik", suffix: "-saydamlik", choice: { transparency: true, motion: null } },
] as const;

for (const look of LOOKS) {
  test(`screens, ${look.name}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(
      (value) => localStorage.setItem("sherpa.look", value),
      JSON.stringify(look.choice),
    );
    // The screens are taken at 18:00 of yesterday, with the sample data seeded for that moment:
    // outside the sample blocks (the office runs 09:00–17:30), the same whenever the run is, and
    // in the past, so the session's token never looks expired.
    const shotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.now() - 86_400_000),
    );
    const shotNow = new Date(`${shotDay}T18:00:00+03:00`);
    await page.clock.setFixedTime(shotNow);
    const itemId = await prepare(page, shotNow);
    const phone = testInfo.project.use.isMobile === true;
    const shot = async (name: string) => {
      const file = (suffix: string) =>
        path.join(folder, `${testInfo.project.name}-${name}${suffix}${look.suffix}.png`);
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
        () => document.documentElement.scrollHeight > window.innerHeight + 1,
      );
      if (long) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.screenshot({ path: file("-alt"), animations: "disabled" });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    };

    for (const screen of screensFor(itemId)) {
      if (look.suffix && !SOLID.includes(screen.name)) continue;
      await page.goto(screen.path);
      await screen.ready(page);
      await shot(screen.name);
    }
    if (look.suffix) return;

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

    // Ç3b: the "Zaman" section of a task with office hours and travel (sample data).
    await page.goto("/m/ev-ornek");
    await page.getByRole("button", { name: "Düzenle: Banka işlemi" }).click();
    const timingDialog = page.getByRole("dialog", { name: "İşi düzenle" });
    await timingDialog.getByText("Zaman", { exact: true }).click();
    await expect(timingDialog.getByLabel("Yol: gidiş (dk)")).toBeVisible();
    await shot("zaman-form");
    await page.keyboard.press("Escape");
    await page.goto("/");
    await expect(now.getByRole("heading")).toBeVisible();

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

    // Ç4c: "Sıradakiler" opened; on the phone a piece of the day's flow touched (its balloon).
    await page
      .getByRole("region", { name: "Sıradakiler" })
      .getByRole("button", {
        name: "Hepsini göster",
      })
      .click();
    await shot("bugun-sirada-acik");
    await page.getByRole("button", { name: "Küçült" }).click();
    if (phone) {
      const piece = page.getByTestId("strip-work").last();
      await piece.scrollIntoViewIfNeeded();
      await piece.tap();
      await expect(page.getByTestId("strip-balloon")).toBeVisible();
      await shot("bugun-balon");
    }

    // Ç4c: Takvim's day detail: today, a coming day, a past day.
    await page.goto("/takvim");
    const days = page.getByRole("region", { name: "Haftanın günleri" });
    await days.locator('[aria-current="date"]').click();
    await expect(page.getByRole("region", { name: "Günün ayrıntısı" })).toBeVisible();
    await shot("takvim-bugun");
    const boxes = days.getByRole("button");
    const todayIndex = await boxes.evaluateAll((list) =>
      list.findIndex((box) => box.getAttribute("aria-current") === "date"),
    );
    const other = todayIndex < 6 ? todayIndex + 1 : todayIndex - 1;
    await boxes.nth(other).click();
    await expect(page.getByRole("region", { name: "Günün ayrıntısı" })).toBeVisible();
    await shot(todayIndex < 6 ? "takvim-gelecek" : "takvim-gecmis");
    if (todayIndex > 0 && todayIndex < 6) {
      await boxes.nth(todayIndex - 1).click();
      await shot("takvim-gecmis");
    }
    await page.goto("/");

    // The night: the day was closed (Ç4a: no finish line).
    const [today] = (await rows("days")).filter((row) => row.plan_source !== null);
    await update("days", today.id as string, { closed_at: new Date().toISOString() });
    await page.goto("/");
    await expect(now).toContainText("Yarın ilk iş:");
    await shot("bugun-gece");

    // Ç3b: time constraints on the screens. The day is open again; a workout with travel is
    // due, the bank's hours are gone, and an item's only window this week has passed.
    await update("days", today.id as string, { closed_at: null });
    const [okul] = (await rows("modules")).filter((row) => row.slug === "okul-ornek");
    const [saglik] = (await rows("modules")).filter((row) => row.slug === "saglik-ornek");
    const weekday =
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(
          shotNow,
        ),
      ) + 1;
    const dueToday = new Date(`${shotDay}T23:00:00+03:00`).toISOString();
    await insert("tasks", [
      {
        module_id: saglik.id,
        title: "Salon antrenmanı",
        est_minutes: 60,
        importance: 4,
        context: "out",
        energy: "physical",
        due_at: dueToday,
        timing: { windows: [{ from: "07:00", to: "22:00" }], travel: { before: 20, after: 20 } },
      },
      {
        module_id: okul.id,
        title: "Öğrenci işleri",
        est_minutes: 20,
        due_at: dueToday,
        timing: { windows: [{ days: [1, 2, 3, 4, 5], from: "09:00", to: "12:00" }] },
      },
    ]);
    const [burs] = await insert("work_items", {
      module_id: okul.id,
      title: "Burs başvurusu",
      effort_total_minutes: 45,
      due_at: dueToday,
      timing: { windows: [{ days: [weekday], from: "10:00", to: "12:00" }] },
    });
    await page.goto("/");
    // The week keeper gives the new item its sitting; the screen is taken once it has.
    await waitFor(
      () => rows("tasks"),
      (list) => list.some((task) => task.work_item_id === burs.id),
    );
    await page.goto("/");
    // The work with travel is in the plan (Ç4a: the card shows what comes first in time; the
    // sample's own work may come before it now that the day runs to the bedtime).
    await expect(page.getByRole("main")).toContainText("Salon antrenmanı");
    await expect(page.getByRole("region", { name: "Uyarılar" })).toContainText(
      "Bugün uygun saat kalmadı",
    );
    await shot("bugun-zaman");
    await page.goto("/takvim");
    await expect(page.getByRole("region", { name: "Uygun saat" })).toBeVisible();
    await shot("takvim-zaman");

    // Ç3c: the day's frame. On, with an ordinary day (08:00–19:00) and last week's nights.
    const [settings] = await rows("settings");
    await update("settings", settings.id as string, {
      day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      day_start_default: "08:00",
    });
    await update("days", today.id as string, { woke_at: null });
    const at = (time: string, day = shotDay) => new Date(`${day}T${time}:00+03:00`);
    const before = (days: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
        new Date(shotNow.getTime() - days * 86_400_000),
      );
    for (const [days, wake, bed] of [
      [3, "07:10", "23:40"],
      [2, "07:30", "00:20"],
    ] as const) {
      const day = before(days);
      const bedDay = bed < "12:00" ? before(days - 1) : day;
      await insert("days", {
        date: day,
        woke_at: at(wake, day).toISOString(),
        bed_at: at(bed, bedDay).toISOString(),
      });
    }

    // The morning: nobody has said "Uyandım" yet.
    await page.clock.setFixedTime(at("07:30"));
    await page.goto("/");
    await expect(now.getByRole("heading", { name: "Günaydın" })).toBeVisible();
    await shot("bugun-gunaydin");

    // The evening: up at 07:00, the day closed at 23:25 (Ç4a: no finish line brings it; late
    // enough that no sample block of the day is on).
    await update("days", today.id as string, {
      woke_at: at("07:00").toISOString(),
      closed_at: at("23:25").toISOString(),
    });
    await page.clock.setFixedTime(at("23:30"));
    await page.goto("/");
    await expect(page.getByTestId("sleep-line")).toBeVisible();
    await shot("bugun-aksam");

    // The night after "Yatıyorum".
    await page.goto("/");
    await now.getByRole("button", { name: "Yatıyorum" }).click();
    await expect(now).toContainText("Yarın uyanış");
    await shot("bugun-gece-cerceve");

    // The scenes: back in the day, the test module's goal, then a workout.
    await update("days", today.id as string, { bed_at: null, closed_at: null });
    await page.clock.setFixedTime(at("15:00"));
    const record = async (title: string, kind: string) => {
      await page.goto("/");
      await openQuickAdd(page);
      const entry = page.getByRole("dialog", { name: "Yeni giriş" });
      await entry.getByLabel("Giriş").fill(title);
      await page.keyboard.press("Tab");
      await entry
        .getByRole("group", { name: "Kayıt türü" })
        .getByRole("button", { name: "Kayıt" })
        .click();
      await entry.getByLabel("Tür", { exact: true }).selectOption(kind);
      await entry.getByRole("button", { name: "Kaydet" }).click();
      await expect(entry).toBeHidden();
    };
    await record("Rapor odağı", "odak");
    await page.goto("/m/deneme");
    await page
      .getByRole("region", { name: "Yaklaşanlar" })
      .getByRole("button", { name: "Başla: Rapor odağı" })
      .click();
    await waitFor(
      () => rows("sessions"),
      (list) => list.some((row) => row.ended_at === null),
    );
    await page.goto("/");
    await expect(page.getByTestId("deneme-focus")).toBeVisible();
    await shot("bugun-sahne");

    await record("Salon", "antrenman");
    await page.goto("/m/deneme");
    await page
      .getByRole("region", { name: "Yaklaşanlar" })
      .getByRole("button", { name: "Başla: Salon" })
      .click();
    await waitFor(
      () => rows("sessions"),
      (list) => list.some((row) => row.ended_at === null && row.rhythm_id !== null),
    );
    await page.goto("/");
    await expect(page.getByTestId("deneme-workout")).toBeVisible();
    await shot("bugun-sahne-adimlar");

    // Settings with the frame and this device's voice.
    await page.goto("/ayarlar/cerceve");
    await expect(page.getByRole("form", { name: "Günün çerçevesi" })).toBeVisible();
    await shot("ayarlar-cerceve");
    await page.goto("/ayarlar/ses");
    await expect(page.getByRole("group", { name: "Sesli anlatım" })).toBeVisible();
    await shot("ayarlar-ses");
    await page.goto("/ayarlar/yapay-zeka");
    await expect(page.getByTestId("ai-state")).toBeVisible();
    await shot("ayarlar-yapay-zeka");

    // Ç3d: Settings → Bağlantılar, with a token in use and one just made (shown once).
    await insert("device_tokens", {
      name: "iPhone Kestirmeler",
      token_hash: "f".repeat(64),
      hint: "shp_Q7xK",
      scopes: ["core/wake", "core/bed"],
      last_used_at: new Date(shotNow.getTime() - 11 * 3_600_000).toISOString(),
    });
    await page.goto("/ayarlar/baglantilar");
    const form = page.getByRole("form", { name: "Yeni anahtar" });
    await form.getByLabel("Ad").fill("Ninova toplayıcısı");
    await form.getByRole("checkbox", { name: /Deneme: Kayıt/ }).check();
    await form.getByRole("button", { name: "Anahtar üret" }).click();
    await expect(page.getByTestId("new-token")).toBeVisible();
    await page.getByRole("heading", { name: "Bağlantılar" }).scrollIntoViewIfNeeded();
    await shot("ayarlar-baglantilar");
  });
}

// Ç3e: a module's facets (Ç4b: one colour system): the day with work in
// the morning, evening and topic facets, the module page, the colour picker, and the two
// facets' scenes. The test module's records come through its own rules (scripts/demo-facets.ts).
{
  test(`facet screens`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const shotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.now() - 86_400_000),
    );
    const shotNow = new Date(`${shotDay}T10:00:00+03:00`);
    await page.clock.setFixedTime(shotNow);
    await seedFacets(await userDb(), shotNow);
    const phone = testInfo.project.use.isMobile === true;
    const shot = async (name: string) => {
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: path.join(folder, `${testInfo.project.name}-${name}.png`),
        fullPage: !phone,
        animations: "disabled",
      });
    };

    await page.goto("/");
    await expect(
      page.locator('[data-testid="strip-work"][aria-label*="Günlük yaz"]'),
    ).toBeVisible();
    await shot("bugun-bolumler");

    await page.goto("/m/deneme");
    await expect(
      page.getByRole("region", { name: "Yaklaşanlar" }).getByText("İstatistik ödevi"),
    ).toBeVisible();
    await shot("modul-deneme-bolumler");

    await page.goto("/ayarlar/moduller/deneme");
    const sabah = page.getByTestId("color-row-sabah");
    await sabah.getByRole("button", { name: "Sabah: rengi değiştir" }).click();
    await expect(sabah.getByRole("group", { name: "Sabah: hazır renkler" })).toBeVisible();
    await shot("ayarlar-renkler");

    const start = async (title: string) => {
      await page.goto("/m/deneme");
      await page
        .getByRole("region", { name: "Yaklaşanlar" })
        .getByRole("button", { name: `Başla: ${title}` })
        .click();
      await waitFor(
        () => rows("sessions"),
        (list) => list.some((row) => row.ended_at === null),
      );
      await page.goto("/");
    };
    await start("Sabah esnemesi");
    await expect(page.getByTestId("deneme-gunes")).toBeVisible();
    await shot("bugun-sahne-sabah");
    await start("Günlük yaz");
    await expect(page.getByTestId("deneme-gece")).toBeVisible();
    await shot("bugun-sahne-aksam");
  });
}

// Ç3f: the anchored chains: the card's place in the morning, the scene with the
// whole chain (another module's work in it), the next module's card after Bitti, the evening's
// scene with the bed chain and the closing opened inside it. The sample chains come from
// scripts/demo-chains.ts (two modules on each anchor); the frame is on, the clock yesterday's.
{
  test(`chain screens`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const shotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.now() - 86_400_000),
    );
    const at = (time: string, day = shotDay) => new Date(`${day}T${time}:00+03:00`);
    // The morning on today's date when the real clock is past it (a routine's log is written
    // on the database's day: on yesterday's screen it would still look open), else yesterday.
    const realDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(),
    );
    const morningDay = Date.now() > at("07:30", realDay).getTime() ? realDay : shotDay;
    const [settings] = await rows("settings");
    await update("settings", settings.id as string, {
      day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      day_start_default: "08:00",
    });
    // Ç3g: tonight's bed at 21:30, so the bed-bound work is offered at 21:00 (15 minutes ahead).
    await insert("days", {
      date: shotDay,
      woke_at: at("07:00").toISOString(),
      expected_bed: "21:30:00",
    });
    if (morningDay !== shotDay) {
      await insert("days", { date: morningDay, woke_at: at("07:00", morningDay).toISOString() });
    }
    await seedChains(await userDb(), at("07:00"));
    const phone = testInfo.project.use.isMobile === true;
    const shot = async (name: string) => {
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: path.join(folder, `${testInfo.project.name}-${name}.png`),
        fullPage: !phone,
        animations: "disabled",
      });
    };
    const now = page.getByRole("region", { name: "Şimdi" });

    await page.clock.setFixedTime(at("07:02", morningDay));
    await page.goto("/");
    await expect(now.getByTestId("chain-line")).toBeVisible();
    await shot("bugun-dizi-oneri");
    await now.getByRole("button", { name: "Başla", exact: true }).click();
    await expect(page.getByTestId("scene-chain")).toBeVisible();
    await shot("bugun-sahne-dizi");
    await page.getByTestId("deneme-gunes").getByRole("button", { name: "Bitti" }).click();
    await expect(now.getByRole("heading", { name: "Boyun hareketleri" })).toBeVisible();
    // Once the session is written (its buttons wait for it).
    await expect(now.getByRole("button", { name: "Bitti" })).toBeEnabled();
    await shot("bugun-dizi-kart");
    await now.getByRole("button", { name: "Durdur" }).click();
    await expect(now.getByRole("button", { name: "Başla", exact: true })).toBeVisible();

    await page.clock.setFixedTime(at("21:00"));
    await page.goto("/");
    await expect(now.getByTestId("chain-line")).toBeVisible();
    await shot("bugun-dizi-aksam");
    await now.getByRole("button", { name: "Başla", exact: true }).click();
    await now.getByRole("button", { name: "Bitti" }).click();
    await expect(page.getByTestId("deneme-gece")).toBeVisible();
    await shot("bugun-sahne-aksam-dizi");
    await page.getByTestId("deneme-gece").getByRole("button", { name: "Günü kapat" }).click();
    await expect(
      page.getByRole("region", { name: "Sahne" }).getByRole("heading", { name: "Kapanış" }),
    ).toBeVisible();
    await shot("bugun-sahne-kapanis");
    // Ç4c: the closing's steps inside the scene (KS*, KSP*).
    const closing = page.getByRole("region", { name: "Sahne" });
    await closing.getByRole("button", { name: "İleri" }).click();
    await shot("kapanis-bugun");
    await closing.getByRole("button", { name: "İleri" }).click();
    await expect(closing.getByRole("region", { name: "Yarın" })).toBeVisible();
    await shot("kapanis-yarin");
    await closing.getByRole("button", { name: "İleri" }).click();
    await shot("kapanis-bosalt");
    await closing.getByRole("button", { name: "İleri" }).click();
    await shot("kapanis-onay");
  });
}

// Rutin 1: the routine's scene by the clock (the dawn, the day, the night), Günaydın, the evening's
// last step, "İyi geceler", and the module page with a step's sheet. The scene draws its own sky.
// Sessions are written straight (the scene comes with
// the running work); the clock is yesterday's.
test("rutin screens", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const shotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() - 86_400_000),
  );
  const at = (time: string) => new Date(`${shotDay}T${time}:00+03:00`);
  const phone = testInfo.project.use.isMobile === true;
  const shot = async (name: string) => {
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(folder, `${testInfo.project.name}-${name}.png`),
      fullPage: !phone,
      animations: "disabled",
    });
  };
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  const rhythms = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
  const [mod] = await rows("modules");
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
    day_start_default: "08:00",
  });
  // Told from outside (the phone's alarm automation, as core/wake writes it).
  await insert("days", {
    date: shotDay,
    woke_at: at("06:58").toISOString(),
    woke_source: "outside",
  });
  const rhythm = (key: string) => rhythms.find((row) => row.key === `rutin:${key}`)!.id;
  const scene = page.getByTestId("rutin-scene");
  const run = async (key: string) => {
    for (const open of (await rows("sessions")).filter((row) => row.ended_at === null)) {
      // Never before its start: the database's clock (which stamped it, to the microsecond) may
      // run a little ahead of this one.
      const end = Math.max(Date.now(), Date.parse(open.started_at as string) + 1_000);
      await update("sessions", open.id as string, { ended_at: new Date(end).toISOString() });
    }
    await insert("sessions", { rhythm_id: rhythm(key), module_id: mod.id });
  };

  // The dawn: Günaydın (the waking came from outside), then the teeth with the timer.
  await run("sabah");
  await page.clock.setFixedTime(at("07:00"));
  await page.goto("/");
  await expect(scene).toHaveAttribute("data-screen", "gunaydin");
  await shot("rutin-gunaydin");
  await scene.getByRole("button", { name: "Kalktım" }).click();
  await scene.getByRole("button", { name: "Sonraki" }).click();
  await expect(scene).toHaveAttribute("data-part", "1");
  await shot("rutin-sabah-safak");

  // The day: the second block with the sun up.
  await run("hazirlik");
  await page.clock.setFixedTime(at("11:30"));
  await page.goto("/");
  await expect(scene).toHaveAttribute("data-sky", "day");
  await expect(scene).toHaveAttribute("data-screen", "adim");
  await shot("rutin-hazirlik-gunduz");

  // The night: the evening, its last step, "İyi geceler".
  await run("aksam");
  await page.clock.setFixedTime(at("22:20"));
  await page.goto("/");
  await expect(scene).toHaveAttribute("data-routine", "aksam");
  await expect(scene).toHaveAttribute("data-screen", "adim");
  await shot("rutin-aksam-gece");
  const evening = (await rows("rutin_routines")).find((row) => row.key === "aksam")!;
  const eveningRun = await waitFor(
    () => rows("rutin_runs"),
    (list) => list.some((row) => row.routine_id === evening.id),
  );
  await update(
    "rutin_runs",
    eveningRun.find((row) => row.routine_id === evening.id)!.id as string,
    // Ç4c: "Yarının listesi" (3) comes before "Telefonu salona bırak" (4).
    { step_position: 4, part_position: 1 },
  );
  await page.reload();
  await expect(scene.getByRole("button", { name: "Yatıyorum" })).toBeVisible();
  await shot("rutin-aksam-son");
  await scene.getByRole("button", { name: "Yatıyorum" }).click();
  await expect(scene).toHaveAttribute("data-screen", "iyi-geceler");
  await shot("rutin-iyi-geceler");

  // The module page: the morning, the evening, a step's sheet.
  await page.goto("/m/rutin");
  await expect(page.getByTestId("rutin-sabah")).toBeVisible();
  await shot("rutin-modul-sabah");
  await page.goto("/m/rutin/aksam");
  await expect(page.getByTestId("rutin-aksam")).toBeVisible();
  await shot("rutin-modul-aksam");
  // Ç4c: the Sağlık area's page (its shell; Rutin's view) and Modüller's area panel.
  await page.goto("/a/saglik");
  await expect(page.getByRole("region", { name: "Son 14 gün · temel adımlar" })).toBeVisible();
  await shot("alan-saglik");
  await page.goto("/m");
  await expect(page.getByRole("link", { name: "Alan sayfası" })).toBeVisible();
  await shot("moduller-alan");
  await page.goto("/m/rutin/sabah");
  await page
    .getByTestId("rutin-sabah")
    .getByRole("button", { name: /^Diş bakımı temel/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Adımı düzenle" })).toBeVisible();
  await shot("rutin-adim-duzenle");
});

// Ç3g: the evening card with the bed-bound work still to come, the bed question, the records in
// Ayarlar, Rutin's morning tab with another module's work as its own group.
test("c3g screens", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const shotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() - 86_400_000),
  );
  const at = (time: string) => new Date(`${shotDay}T${time}:00+03:00`);
  const phone = testInfo.project.use.isMobile === true;
  const shot = async (name: string) => {
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(folder, `${testInfo.project.name}-${name}.png`),
      fullPage: !phone,
      animations: "disabled",
    });
  };
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
    day_start_default: "08:00",
  });
  await insert("days", { date: shotDay, woke_at: at("07:00").toISOString() });
  const [deneme] = await insert("modules", { slug: "deneme", name: "Deneme", color: "#7c3aed" });
  const day = (await rows("days")).find((row) => row.date === shotDay)!;
  await insert("tasks", {
    module_id: deneme.id,
    title: "Boyun hareketleri",
    est_minutes: 10,
    timing: { anchor: "wake", order: 20 },
  });
  const now = page.getByRole("region", { name: "Şimdi" });

  await page.clock.setFixedTime(at("07:02"));
  await page.goto("/m/rutin");
  await expect(page.getByTestId("rutin-other-group")).toBeVisible();
  await shot("rutin-modul-sabah-diger");

  // Ç4a: the evening before the bedtime range comes with the closing (no finish line).
  await update("days", day.id as string, { closed_at: at("19:25").toISOString() });
  await page.clock.setFixedTime(at("19:30"));
  await page.goto("/");
  await expect(now.getByTestId("evening-later")).toBeVisible();
  await shot("bugun-aksam-sirada");
  await now.getByRole("button", { name: "Yatıyorum" }).click();
  await expect(page.getByRole("alertdialog", { name: /Şimdi yatıyor musun/ })).toBeVisible();
  await shot("bugun-yatis-sorusu");
  await page.getByRole("button", { name: "Vazgeç" }).click();

  await page.goto("/ayarlar/kayitlar");
  await expect(page.getByTestId("day-records")).toBeVisible();
  await page.getByTestId("day-records").scrollIntoViewIfNeeded();
  await shot("ayarlar-kayitlar");
});

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
      path: path.join(folder, `${testInfo.project.name}-${name}.png`),
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

// Ç4b, docs/tasarim/ekranlar/bos-ve-hata.md (frames XT1, XT2, XT6–XT14, XP1–XP4): the empty and
// error states on an empty account. A read that fails is made by stopping its request; the AI
// budget by answering the status request; the lost connection by taking the browser offline.
test("empty and error screens", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  await roomInTheDay(page);
  const shot = async (name: string) => {
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(folder, `${testInfo.project.name}-${name}.png`),
      animations: "disabled",
    });
  };
  const main = page.getByRole("main");

  // Modüller with no module switched on (XT9).
  await page.goto("/m");
  await expect(main.getByText("Henüz modül yok.")).toBeVisible();
  await shot("bos-moduller");

  // Quick add with no module switched on: everything goes to the inbox (XT14).
  await openQuickAdd(page);
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await expect(dialog).toContainText("Etkin modül yok");
  await dialog.getByLabel("Giriş").fill("kombi bakımı için usta çağır");
  await shot("bos-hizli-giris");
  await page.keyboard.press("Escape");

  // The module pages that are not there (XT10–XT13, XP4).
  await insert("modules", [
    { slug: "spor-ornek", name: "Spor", color: "#22c55e", status: "archived" },
    { slug: "ev-ornek", name: "Ev", color: "#16a34a" },
  ]);
  await page.goto("/m/spor-ornek");
  await expect(main).toContainText("Bu modül arşivde.");
  await shot("hata-modul-arsivde");
  await page.goto("/m/deneme");
  await expect(main).toContainText("Bu modül etkin değil.");
  await shot("hata-modul-etkin-degil");
  await page.goto("/m/hic-yok");
  await expect(main).toContainText("Böyle bir modül yok.");
  await shot("hata-modul-yok");
  await page.goto("/m/ev-ornek/olmayan");
  await expect(main).toContainText("Bu modülde böyle bir sayfa yok.");
  await shot("hata-sayfa-yok");

  // A list that could not be read (XT8), and Bugün's (XT1, XP1).
  await page.route("**/rest/v1/inbox_entries*", (route) => route.abort());
  await page.goto("/gelen");
  await expect(page.getByRole("alert").filter({ hasText: "Veri okunamadı." })).toBeVisible({
    timeout: 15_000,
  });
  await shot("hata-gelen-okunamadi");
  await page.unroute("**/rest/v1/inbox_entries*");
  await page.route("**/rest/v1/tasks*", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Veri okunamadı." })).toBeVisible({
    timeout: 15_000,
  });
  await shot("hata-bugun-okunamadi");
  await page.unroute("**/rest/v1/tasks*");

  // The month's AI budget used up, on an empty day (XT6, XT7, XP3).
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { state: "budget" }, contentType: "application/json" }),
  );
  await page.goto("/");
  await expect(page.getByText("Bu ayın yapay zeka bütçesi doldu")).toBeVisible();
  await shot("bos-gun-butce");
  // The line stands at the end of the screen: on the phone, scrolled down to it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot("bos-gun-butce-alt");
  await page.unroute("**/api/ai/status");

  // The connection lost: a small pill at the right of the title; the screen stays (XT2, XP2).
  await page.goto("/gelen");
  await expect(page.getByRole("heading", { level: 1, name: "Gelen kutusu" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "bağlantı yok" })).toBeVisible();
  await shot("hata-baglanti-yok");
  await context.setOffline(false);
});
