#!/usr/bin/env node
import { chromium, webkit } from "playwright";

const url = process.env.AUDIO_TEST_URL
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/` : `http://127.0.0.1:${process.env.PORT || 8080}/`);
const reactions = ["vip", "pitboss", "squirrel", "car", "bus"];
const minimumPeak = 0.002;

async function check(browserType, name, required) {
  let browser;
  try {
    browser = await browserType.launch({
      headless: true,
      args: name === "chromium" ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
    });
  } catch (error) {
    if (!required) {
      return { browser: name, skipped: true, reason: `browser runtime unavailable: ${String(error).split("\n")[0]}` };
    }
    throw error;
  }

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Fly", exact: true }).click();
    await page.waitForFunction(() => window.__gullAudioTest?.getState?.() === "running", null, { timeout: 10_000 });

    const peaks = {};
    for (const reaction of reactions) {
      peaks[reaction] = await page.evaluate((kind) => window.__gullAudioTest.measureReaction(kind), reaction);
      if (peaks[reaction] < minimumPeak) {
        throw new Error(`${name}: ${reaction} produced peak ${peaks[reaction]} (expected >= ${minimumPeak})`);
      }
    }
    return {
      browser: name,
      audioState: await page.evaluate(() => window.__gullAudioTest.getState()),
      peaks,
    };
  } finally {
    await browser.close();
  }
}

const results = [];
results.push(await check(chromium, "chromium", true));
results.push(await check(webkit, "webkit", false));
console.log(JSON.stringify({ ok: true, url, results }, null, 2));