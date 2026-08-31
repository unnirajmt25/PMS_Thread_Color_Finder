import { chromium } from "playwright";

const shotDir = "C:\\Users\\UNNIRA~1\\AppData\\Local\\Temp\\claude\\d--PMS-RA-Color-Finder\\5b0cf82a-f5c9-4752-869b-8ce01279f7b1\\scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto("http://localhost:5175/");
await page.waitForSelector("text=Smart Search");
await page.hover("text=Smart Search");
await page.screenshot({ path: `${shotDir}\\feat-01-hover.png` });

await page.click("text=Wide Palette");
await page.waitForSelector("text=Browse every vendor");
console.log("Wide Palette -> URL:", page.url());

await page.goto("http://localhost:5175/");
await page.click("text=Smart Search");
await page.waitForSelector("#vendor-selector");
console.log("Smart Search -> URL:", page.url());

await page.goto("http://localhost:5175/");
await page.click("text=Perfect Match");
await page.waitForSelector("#vendor-selector");
console.log("Perfect Match -> URL:", page.url());

console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
await browser.close();
