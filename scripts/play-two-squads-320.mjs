import { chromium } from 'playwright-core';
import { playLibrary } from './play-loop.mjs';
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
try {
  const context = await browser.newContext({viewport:{width:320,height:568},hasTouch:true});
  const result = await playLibrary(await context.newPage(), {width:320,height:568,squads:2,baseURL:process.env.TI_BASE_URL});
  console.log(`Passed ${result.length} two-squad browser journeys.`);
} finally { await browser.close(); }
