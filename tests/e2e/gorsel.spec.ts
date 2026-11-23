import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, quietTest, test } from "./fixtures";
import { openQuickAdd } from "./helpers";
import { okulContext, sampleTerm } from "./okul-helpers";
import { insertSession } from "@/modules/okul/queries";
import { syncSession } from "@/modules/okul/rules";

// The visual check (docs/tasarim/README.md, "Görsel denetim"): the gallery and the main screens,
// at one fixed moment, with fixed data, on the phone and on the board, against approved images
// kept in the repository (gorsel.spec.ts-snapshots/). When the look changes without intent the
// test breaks. An approved image is renewed only on purpose:
//   npx playwright test gorsel --update-snapshots
// and the reason goes into the commit message (CLAUDE.md "Tasarım").

/** 13 November 2026, 14:10 in Istanbul: the day sky of frames Hava_acik and HavaSakin_acik. */
const MOMENT = new Date("2026-11-13T14:10:00+03:00");

// Both run in the board's browser project at scale 1, so the images stay small and the same on
// every run; the phone's own viewport behaviour (isMobile, the keyboard, safe areas) is the
// "telefon" project's, and the real device's (docs/ILERLEME.md, "Senden bekleyenler").
const DEVICES = [
  { name: "telefon", viewport: { width: 390, height: 844 }, hasTouch: true },
  { name: "pano", viewport: { width: 1440, height: 900 }, hasTouch: false },
] as const;

/** Waits until the page stands still: its sky drawn, its fonts loaded, nothing moving. */
async function settled(page: Page) {
  await expect(page.locator("[data-testid=backdrop][data-phase]")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function shot(
  page: Page,
  name: string,
  options: { mask?: ReturnType<Page["locator"]>[]; fullPage?: boolean } = {},
) {
  await settled(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    // Tight: a change of a token (a colour, a size) moves more pixels than this.
    maxDiffPixelRatio: 0.002,
    // And a pixel counts as changed at a small colour distance: the glass and the calm backdrop
    // are close dark colours, and at the default (0.2) a panel that grew by hundreds of pixels
    // over the backdrop still read as unchanged (Ç4b, Modüller on the board).
    threshold: 0.02,
    fullPage: options.fullPage,
    animations: "disabled",
    caret: "hide",
    mask: options.mask,
  });
}

for (const device of DEVICES) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport, hasTouch: device.hasTouch });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(MOMENT);
    });

    test(`gallery (${device.name})`, async ({ page }) => {
      await page.goto("/tasarim");
      await expect(page.getByRole("heading", { name: "Tasarım" })).toBeVisible();
      // The whole gallery, every piece and state.
      await shot(page, `galeri-${device.name}`, { fullPage: true });
    });

    test(`inbox (${device.name})`, async ({ page }) => {
      await insert("inbox_entries", [
        { raw_text: "kombi bakımı için usta çağır" },
        { raw_text: "salı 14:00 danışmanla görüşme" },
      ]);
      await page.goto("/gelen");
      await expect(page.getByText("kombi bakımı için usta çağır")).toBeVisible();
      await shot(page, `gelen-${device.name}`);
    });

    test(`modules and a module page (${device.name})`, async ({ page }) => {
      await seedModule("okul-ornek", "Okul", "#5b8cff");
      const [ev] = await insert("modules", { slug: "ev-ornek", name: "Ev", color: "#5fd6c6" });
      await insert("modules", {
        slug: "is-ornek",
        name: "İş",
        color: "#c3a9ff",
        status: "paused",
      });
      await page.goto("/m");
      await expect(page.getByRole("link", { name: /Ev/ })).toBeVisible();
      await shot(page, `moduller-${device.name}`);

      await page.goto(`/m/${(ev as { slug: string }).slug}`);
      await expect(page.getByText("Bu modülde sırada iş yok.")).toBeVisible();
      await shot(page, `modul-sayfasi-${device.name}`);
    });

    test(`Rutin's module page and a step's sheet (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
      await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      await page.goto("/m/rutin");
      await expect(page.getByTestId("rutin-sabah")).toBeVisible();
      await shot(page, `rutin-modul-${device.name}`);
      await page
        .getByTestId("rutin-sabah")
        .getByRole("button", { name: /^Diş bakımı temel/ })
        .click();
      await expect(page.getByRole("dialog", { name: "Adımı düzenle" })).toBeVisible();
      await shot(page, `rutin-adim-duzenle-${device.name}`);
    });

    test(`the Sağlık area's page (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
      await page.goto("/a/saglik");
      await expect(page.getByRole("region", { name: "Son 14 gün · temel adımlar" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Üyeler" })).toContainText("Sabah yapılan gün");
      await shot(page, `alan-${device.name}`);
    });

    test(`settings (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar");
      await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
      await expect(page.getByText("@")).toBeVisible();
      await shot(page, `ayarlar-${device.name}`);

      // On the board /ayarlar already shows Görünüm; on the phone it is a page of its own.
      if (device.name === "telefon") {
        await page.goto("/ayarlar/gorunum");
        await expect(page.getByRole("switch", { name: "Saydamlığı azalt" })).toBeVisible();
        await shot(page, `ayarlar-gorunum-${device.name}`);
      }
    });

    test(`quick add (${device.name})`, async ({ page }) => {
      await seedModule("okul-ornek", "Okul", "#5b8cff");
      await page.goto("/gelen");
      if (device.name === "telefon") {
        await page.getByRole("button", { name: "Yeni giriş" }).click();
      } else {
        await openQuickAdd(page);
      }
      const sheet = page.getByRole("dialog", { name: "Yeni giriş" });
      await sheet.getByLabel("Giriş").fill("Sunum slaytları cuma 45dk");
      await sheet.getByRole("button", { name: "Okul" }).click();
      await expect(sheet.getByLabel("Süre (dk)")).toHaveValue("45");
      // The date a weekday name points at moves with the real day: masked.
      await shot(page, `hizli-giris-${device.name}`, { mask: [sheet.getByLabel("Tarih")] });
    });

    test(`today, an empty day (${device.name})`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Bugün için planlanan bir şey yok.")).toBeVisible();
      // Ç4c: the layout as drawn (XT7, XP3); the date line follows the fixed moment.
      await shot(page, `bugun-bos-${device.name}`);
    });

    test(`today with work, Sıradakiler open, Takvim (${device.name})`, async ({ page }) => {
      const okul = await seedModule("okul-ornek", "Okul", "#5b8cff");
      const [ev] = await insert("modules", { slug: "ev-ornek", name: "Ev", color: "#5fd6c6" });
      await insert("tasks", [
        {
          module_id: okul.id,
          title: "Proje önerisi taslağı",
          est_minutes: 90,
          importance: 4,
          due_at: "2026-11-14T20:59:00Z",
        },
        { module_id: okul.id, title: "İstatistik ödevi", est_minutes: 60, importance: 3 },
        { module_id: ev.id as string, title: "Süpürme", est_minutes: 15 },
        { module_id: ev.id as string, title: "Ampul al", est_minutes: 15 },
      ]);
      await insert("blocks", {
        title: "Diş hekimi",
        starts_at: "2026-11-13T15:30:00Z",
        ends_at: "2026-11-13T16:15:00Z",
      });
      await page.goto("/");
      const now = page.getByRole("region", { name: "Şimdi" });
      await expect(now.getByRole("heading", { name: "Proje önerisi taslağı" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Günün akışı" })).toBeVisible();
      await shot(page, `bugun-${device.name}`);
      await page.getByRole("button", { name: "Hepsini göster" }).click();
      await expect(page.getByRole("button", { name: "Küçült" })).toBeVisible();
      await shot(page, `bugun-sirada-acik-${device.name}`);

      await page.goto("/takvim");
      await expect(page.getByRole("region", { name: "Bu hafta" })).toContainText(
        "Proje önerisi taslağı",
      );
      await shot(page, `takvim-${device.name}`);
    });

    // Sabah açılışı (16 Nov 2026): Rutin's welcome in the morning's place of Today, at dawn.
    test(`the morning's welcome (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      const [settings] = await rows("settings");
      await update("settings", settings.id as string, {
        day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      });
      await page.clock.setFixedTime(new Date("2026-11-13T07:00:00+03:00"));
      await page.goto("/");
      await expect(
        page.getByTestId("rutin-welcome").getByRole("heading", { name: "Günaydın" }),
      ).toBeVisible();
      await shot(page, `karsilama-${device.name}`);
    });

    // Sabah açılışı, before release: Rutin's scene stands on one sky; on the board it reaches the
    // whole screen behind the menu, with the menu and the core's strip over it.
    test(`Rutin's scene, its first step (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      const rhythms = await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      const [settings] = await rows("settings");
      await update("settings", settings.id as string, {
        day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      });
      const [mod] = await rows("modules");
      // The screens may have written the day's row already (the first touch).
      const woke = {
        woke_at: "2026-11-13T04:00:00Z",
        woke_estimated: false,
        woke_source: "screen",
      };
      const known = (await rows("days")).find((row) => row.date === "2026-11-13");
      if (known) await update("days", known.id as string, woke);
      else await insert("days", { date: "2026-11-13", ...woke });
      await insert("sessions", {
        rhythm_id: rhythms.find((row) => row.key === "rutin:sabah")!.id,
        module_id: mod.id,
        started_at: "2026-11-13T04:00:00Z",
      });
      await page.clock.setFixedTime(new Date("2026-11-13T07:05:00+03:00"));
      await page.goto("/");
      const scene = page.getByTestId("rutin-scene");
      await expect(scene).toHaveAttribute("data-screen", "adim");
      await expect(page.getByTestId("strip-title")).toHaveText("Sabah");
      await shot(page, `rutin-sahne-${device.name}`);
    });

    // Okul çekirdek A: a module page of its own shape (deneme's "Sayfa: ana sayfalı").
    test(`a module page of its own shape (${device.name})`, async ({ page }) => {
      await insert("modules", {
        slug: "deneme",
        name: "Deneme",
        color: "#2563eb",
        status: "active",
        settings: { page: "home" },
      });
      await insert("deneme_items", [
        { title: "Robotik: hız kinematiği", kind: "konu", due_on: "2026-12-08" },
        { title: "Büyük veri sistemleri", kind: "konu" },
        { title: "Rapor taslağı", due_on: "2026-11-20" },
        { title: "Sunum provası", due_on: "2026-11-27" },
      ]);
      await page.goto("/m/deneme");
      await expect(page.getByTestId("deneme-home")).toContainText("Sunum provası");
      await shot(page, `modul-ana-sayfa-${device.name}`);
      if (device.name === "telefon") {
        await page.getByRole("button", { name: "Bölümler" }).click();
        await expect(page.getByRole("list", { name: "Bölümler" })).toBeVisible();
        await shot(page, "modul-secici-telefon");
      }
    });

    // Okul çekirdek A: the way out's note over a flow (deneme's "akis").
    test(`the way out's note (${device.name})`, async ({ page }) => {
      const [mod] = await insert("modules", {
        slug: "deneme",
        name: "Deneme",
        color: "#2563eb",
        status: "active",
      });
      const [record] = await insert("deneme_items", {
        title: "Ödev kodu",
        kind: "akis",
        minutes: 90,
        exit_note: "Merge yazıldı; test 3 geçmiyor",
      });
      const [item] = await insert("work_items", {
        module_id: mod.id,
        key: `item:${record.id}`,
        title: "Ödev kodu",
        effort_total_minutes: 180,
        source_type: "deneme.item",
        source_id: record.id,
        meta: { kind: "akis" },
      });
      const [task] = await insert("tasks", {
        module_id: mod.id,
        work_item_id: item.id,
        title: "Ödev kodu",
        est_minutes: 90,
        status: "doing",
        source_type: "deneme.item",
        source_id: record.id,
      });
      await insert("sessions", {
        task_id: task.id,
        module_id: mod.id,
        started_at: "2026-11-13T10:50:00Z",
      });
      await page.goto("/");
      await expect(page.getByTestId("deneme-flow")).toBeVisible();
      await shot(page, `akis-sahne-${device.name}`);
      await page.getByLabel("Sahne şeridi").getByRole("button", { name: "Çık" }).click();
      await expect(page.getByTestId("exit-note")).toBeVisible();
      await shot(page, `cikarken-not-${device.name}`);
    });

    // Okul çekirdek A: a fixed block's view (deneme's event).
    test(`a fixed block's view (${device.name})`, async ({ page }) => {
      const [mod] = await insert("modules", {
        slug: "deneme",
        name: "Deneme",
        color: "#2563eb",
        status: "active",
      });
      const [record] = await insert("deneme_items", { title: "Seminer", kind: "etkinlik" });
      const [block] = await insert("blocks", {
        module_id: mod.id,
        key: `item:${record.id}`,
        title: "Seminer",
        starts_at: "2026-11-13T10:30:00Z",
        ends_at: "2026-11-13T12:00:00Z",
        source_type: "deneme.item",
        source_id: record.id,
      });
      await page.goto(`/?blok=${block.id}`);
      await expect(page.getByTestId("deneme-block-view")).toHaveAttribute("data-phase", "during");
      await shot(page, `blok-gorunumu-${device.name}`);
    });

    // Okul 1: the module's pages and scenes with the sample term (scripts/demo-okul.ts, made up).
    test(`Okul's pages (${device.name})`, async ({ page }) => {
      await sampleTerm(MOMENT);
      await page.goto("/m/okul");
      await expect(page.getByTestId("okul-home").filter({ visible: true })).toBeVisible();
      await shot(page, `okul-ana-sayfa-${device.name}`, { fullPage: true });
      await page.goto("/m/okul/bolum/dlr303e");
      await expect(page.getByTestId("okul-course").filter({ visible: true })).toBeVisible();
      await shot(page, `okul-ders-${device.name}`, { fullPage: true });
      await page.goto("/m/okul/devam/dlr303e");
      await expect(page.getByTestId("okul-attendance").filter({ visible: true })).toBeVisible();
      await shot(page, `okul-devam-${device.name}`, { fullPage: true });
      const all = await rows("okul_assessments");
      const midterm = (await rows("okul_prep_docs"))[0].assessment_id as string;
      await page.goto(`/m/okul/is/${midterm}`);
      await expect(page.getByTestId("okul-exam").filter({ visible: true })).toBeVisible();
      await shot(page, `okul-sinav-${device.name}`, { fullPage: true });
      const homework = all.find((row) => row.title === "Assignment 2")!;
      await page.goto(`/m/okul/is/${homework.id}`);
      await expect(page.getByTestId("okul-work").filter({ visible: true })).toBeVisible();
      await shot(page, `okul-is-${device.name}`, { fullPage: true });
      await page.goto("/ayarlar/moduller/okul");
      await expect(page.getByTestId("okul-settings")).toBeVisible();
      await shot(page, `okul-ayarlar-${device.name}`);
    });

    test(`Okul's scenes: the flow with Kaldığın yer, the preparation's pomodoro, the hand-in (${device.name})`, async ({
      page,
    }) => {
      await sampleTerm(MOMENT);
      const all = await rows("okul_assessments");
      const items = await rows("work_items");
      const [mod] = (await rows("modules")).filter((row) => row.slug === "okul");
      const homework = all.find((row) => row.title === "Assignment 2")!;
      await update("okul_assessments", homework.id as string, {
        resume_note: "Kenar durumları kaldı; testler yazılacak",
        resume_noted_at: "2026-11-12T13:05:00Z",
      });
      const run = async (key: string, minutes: number, since: string) => {
        const item = items.find((row) => row.key === key)!;
        const [task] = await insert("tasks", {
          module_id: mod.id,
          work_item_id: item.id,
          title: item.title,
          est_minutes: minutes,
          status: "doing",
          source_type: item.source_type,
          source_id: item.source_id,
        });
        const [session] = await insert("sessions", {
          task_id: task.id,
          module_id: mod.id,
          started_at: since,
        });
        return { task, session };
      };
      const flow = await run(`hw:${homework.id}`, 90, "2026-11-13T10:22:00Z");
      await page.goto("/");
      await expect(page.getByTestId("okul-scene")).toHaveAttribute("data-method", "flow");
      await shot(page, `okul-akis-sahne-${device.name}`);
      await update("sessions", flow.session.id as string, { ended_at: "2026-11-13T10:40:00Z" });
      await update("tasks", flow.task.id as string, { status: "todo" });

      const midterm = (await rows("okul_prep_docs"))[0].assessment_id as string;
      await run(`prep:${midterm}`, 90, "2026-11-13T10:58:00Z");
      await page.goto("/");
      await expect(page.getByTestId("okul-scene")).toHaveAttribute("data-method", "pomodoro");
      await shot(page, `okul-hazirlik-sahne-${device.name}`);
    });

    test(`Okul's hand-in list (${device.name})`, async ({ page }) => {
      await sampleTerm(MOMENT);
      const homework = (await rows("okul_assessments")).find(
        (row) => row.title === "Assignment 2",
      )!;
      const item = (await rows("work_items")).find((row) => row.key === `submit:${homework.id}`)!;
      const [mod] = (await rows("modules")).filter((row) => row.slug === "okul");
      const [task] = await insert("tasks", {
        module_id: mod.id,
        work_item_id: item.id,
        title: item.title,
        est_minutes: 10,
        status: "doing",
        source_type: item.source_type,
        source_id: item.source_id,
      });
      const [session] = await insert("sessions", {
        task_id: task.id,
        module_id: mod.id,
        started_at: "2026-11-13T11:06:00Z",
      });
      await update("okul_assessments", homework.id as string, {
        checklist_state: { session: session.id, step: 2, since: "2026-11-13T11:08:00Z" },
      });
      await page.goto("/");
      await expect(page.getByTestId("okul-hand-in")).toBeVisible();
      await shot(page, `okul-teslim-${device.name}`);
    });

    test(`Okul's lesson view, during and after (${device.name})`, async ({ page }) => {
      await sampleTerm(MOMENT);
      const ctx = await okulContext(() => MOMENT);
      const course = (await rows("okul_courses")).find((row) => row.code === "DLR303E")!;
      const during = await insertSession(ctx, {
        course_id: course.id as string,
        date: "2026-11-13",
        course_week: 7,
        start_time: "13:30",
        end_time: "16:20",
      });
      const after = await insertSession(ctx, {
        course_id: course.id as string,
        date: "2026-11-13",
        course_week: 7,
        start_time: "09:00",
        end_time: "11:50",
      });
      await syncSession(ctx, during.id);
      const morning = await okulContext(() => new Date("2026-11-13T08:00:00+03:00"));
      await syncSession(morning, after.id);
      await insert("okul_class_notes", {
        session_id: during.id,
        text: "Quiz 2 bir hafta erkene gelebilir",
        created_at: "2026-11-13T10:50:00Z",
      });
      const blocks = await rows("blocks");
      const open = async (sessionId: string) =>
        page.goto(`/?blok=${blocks.find((row) => row.source_id === sessionId)!.id}`);
      await open(during.id);
      await expect(page.getByTestId("okul-lesson").filter({ visible: true })).toHaveAttribute(
        "data-phase",
        "during",
      );
      await shot(page, `okul-derste-${device.name}`);
      await open(after.id);
      await expect(page.getByTestId("okul-attendance-question")).toBeVisible();
      await shot(page, `okul-ders-bitti-${device.name}`);
    });
  });
}

for (const device of DEVICES) {
  quietTest.describe(`${device.name}, signed out`, () => {
    quietTest.use({
      viewport: device.viewport,
      hasTouch: device.hasTouch,
      storageState: { cookies: [], origins: [] },
    });

    quietTest(`sign-in (${device.name})`, async ({ page }) => {
      await page.clock.setFixedTime(MOMENT);
      await page.goto("/giris");
      await expect(page.getByLabel("E-posta")).toBeVisible();
      await shot(page, `giris-${device.name}`);
    });
  });
}
