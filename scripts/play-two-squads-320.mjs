import { chromium } from 'playwright-core';
import { playLiveCalls } from './play-loop.mjs';
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
try {
  const context = await browser.newContext({viewport:{width:320,height:568},hasTouch:true});
  const result = await playLiveCalls(await context.newPage(), {width:320,height:568,squads:2,baseURL:process.env.TI_BASE_URL});
  console.log(`Passed ${result.length} live browser journeys at 320px, ${result.filter(entry => entry.squads > 1).length} with two squads.`);
} finally { await browser.close(); }
