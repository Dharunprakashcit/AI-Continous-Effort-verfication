// Rasterizes the PDF pages to PNG (PDF.js in headless Edge) so layout can be checked.
//   node render-pdf-pages.js <pdf> <outDir> [firstPage] [lastPage]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const [pdfPath, outDir, first = "1", last = "999"] = process.argv.slice(2);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const bytes = Array.from(fs.readFileSync(pdfPath));
  const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js" });
  const total = await page.evaluate(async (b) => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    window.__doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(b) }).promise;
    return window.__doc.numPages;
  }, bytes);
  console.log("pages:", total);
  const to = Math.min(total, Number(last));
  for (let n = Number(first); n <= to; n++) {
    const url = await page.evaluate(async (n) => {
      const p = await window.__doc.getPage(n);
      const vp = p.getViewport({ scale: 1.5 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      return c.toDataURL("image/png");
    }, n);
    fs.writeFileSync(path.join(outDir, `page-${String(n).padStart(2, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
