// Captures the screens where the ANN output appears, from the running app.
// Needs the frontend (5173), backend (5000) and ANN service (5001).
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "figures");

async function apiLogin(email) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password123" }) });
  return r.json();
}

async function openAs(browser, email, url, width = 1366) {
  const { token, user } = await apiLogin(email);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
  }, [token, user]);
  const page = await ctx.newPage();
  await page.goto(BASE + url);
  return { page, token, ctx };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const info = {};

  // 1. Student AI feedback (Meena, low contributor)
  {
    const { page, ctx } = await openAs(browser, "23cs005@example.edu", "/student/feedback", 1100);
    await page.waitForSelector(".hbars");
    await page.waitForTimeout(1800);
    info.studentFeedback = await page.$$eval(".hbars li", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
    info.studentReasons = await page.$$eval(".row-card .title", (els) => els.map((e) => e.innerText));
    await page.addStyleTag({ content: ".topbar{position:static!important}" });
    await page.locator(".content").screenshot({ path: path.join(OUT, "ui-feedback.png") });
    await ctx.close();
  }

  // 2. Faculty student detail (same student) and analytics
  {
    const fac = await apiLogin("faculty@example.edu");
    const H = { Authorization: `Bearer ${fac.token}` };
    const teams = await (await fetch(`${BASE}/api/faculty/teams`, { headers: H })).json();
    let meenaId = null;
    for (const t of teams) {
      const ov = await (await fetch(`${BASE}/api/faculty/teams/${t._id}/overview`, { headers: H })).json();
      const row = ov.rows.find((r) => r.student.name === "Meena");
      if (row) meenaId = row.student.id;
    }
    const { page, ctx } = await openAs(browser, "faculty@example.edu", `/faculty/students/${meenaId}`, 1100);
    await page.waitForSelector(".hbars");
    await page.waitForTimeout(1800);
    info.facultyBreakdown = await page.$$eval(".hbars li", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
    await page.addStyleTag({ content: ".topbar{position:static!important}" });
    const box = await page.locator(".content").boundingBox();
    await page.screenshot({ path: path.join(OUT, "ui-detail.png"), fullPage: true, clip: { x: box.x, y: box.y, width: box.width, height: 780 } });
    await page.goto(BASE + "/faculty/analytics");
    await page.waitForSelector("text=Prediction model");
    await page.waitForTimeout(2500);
    const panel = page.locator(".panel", { hasText: "Prediction model" });
    info.analyticsModel = await panel.innerText();
    await panel.screenshot({ path: path.join(OUT, "ui-analytics.png") });
    await ctx.close();
  }

  // 3. Public estimator (landing page)
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/");
    await page.getByRole("button", { name: "Low activity" }).click();
    await page.getByRole("button", { name: "Estimate risk" }).click();
    await page.waitForSelector(".meter");
    await page.waitForTimeout(800);
    info.estimator = await page.locator(".result").innerText();
    await page.locator("#estimator").screenshot({ path: path.join(OUT, "ui-estimator.png") });
    await ctx.close();
  }

  fs.writeFileSync(path.join(__dirname, "screenshots-info.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
