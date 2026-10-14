// Renders the SVG diagrams in figures/diagrams.html to PNG files.
const path = require("path");
const { chromium } = require("playwright-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = path.join(__dirname, "..", "figures");

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto("file:///" + path.join(OUT, "diagrams.html").replace(/\\/g, "/"));
  for (const id of ["fig1", "fig2", "fig3", "fig4", "fig5"]) {
    const el = await page.$("#" + id);
    await el.screenshot({ path: path.join(OUT, `${id}.png`) });
    console.log("wrote", id);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
