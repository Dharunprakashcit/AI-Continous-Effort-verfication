// Renders the SVG diagrams in diagrams-ann.html to PNG files in figures/.
const path = require("path");
const { chromium } = require("playwright-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DIR = __dirname;

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto("file:///" + path.join(DIR, "diagrams-ann.html").replace(/\\/g, "/"));
  for (const id of ["a1", "a2", "a3"]) {
    const el = await page.$("#" + id);
    await el.screenshot({ path: path.join(DIR, "figures", `${id}.png`) });
    console.log("wrote", id);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
