// Runs play-loop's tap budget path in its own browser context for check-feel.
import { measureTapBudget } from './play-loop.mjs';

export async function playTaps({ chromium, executablePath, baseURL }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    return await measureTapBudget(await context.newPage(), { baseURL });
  } finally { await browser.close(); }
}
