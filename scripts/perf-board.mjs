// The board's load (Ç4b, docs/ILERLEME.md "Başarım"): Today on the board for a while, with the glass as
// it is and with "Saydamlığı azalt"; CPU time of the page (CDP Performance). Needs a running
// build (npx next start -p 3150) and a signed-in state (playwright/.auth/user.json):
//   node scripts/perf-board.mjs 3150 60 /
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const [port = "3150", seconds = "60", path = "/"] = process.argv.slice(2);

async function measure(label, look) {
  const browser = await chromium.launch({ args: ["--enable-gpu-rasterization"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: "playwright/.auth/user.json",
  });
  await context.addInitScript(
    (value) => localStorage.setItem("sherpa.look", value),
    JSON.stringify(look),
  );
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const read = async () =>
    Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
    );
  const a = await read();
  const t0 = Date.now();
  await page.waitForTimeout(Number(seconds) * 1000);
  const b = await read();
  const wall = (Date.now() - t0) / 1000;
  const d = (k) => (b[k] ?? 0) - (a[k] ?? 0);
  console.log(
    JSON.stringify({
      label,
      seconds: wall.toFixed(1),
      cpuPercent: ((d("TaskDuration") / wall) * 100).toFixed(2),
      scriptMs: (d("ScriptDuration") * 1000).toFixed(0),
      layoutMs: (d("LayoutDuration") * 1000).toFixed(0),
      styleMs: (d("RecalcStyleDuration") * 1000).toFixed(0),
      layouts: d("LayoutCount"),
      styleRecalcs: d("RecalcStyleCount"),
      framesPerSecond: (d("Frames") / wall).toFixed(2),
    }),
  );
  await browser.close();
}

await measure("cam", { transparency: null, motion: null });
await measure("saydamlik-azalt", { transparency: true, motion: null });
