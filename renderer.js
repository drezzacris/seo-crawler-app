import { chromium } from "playwright";

export async function renderWithPlaywright(url) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      userAgent: process.env.CRAWLER_USER_AGENT
    });

    const start = Date.now();

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const html = await page.content();

    return {
      html,
      status: response?.status() || null,
      finalUrl: page.url(),
      responseTimeMs: Date.now() - start,
      rendered: true
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}