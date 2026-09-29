// Register a fresh test account for E2E
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const EMAIL = 'v13e2e_a@example.com';
const PASSWORD = 'E2Etest123456';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();

  console.log('Navigating to /register...');
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check form
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, placeholder: i.placeholder
    }));
  });
  console.log('Inputs:', JSON.stringify(inputs));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
  });
  console.log('Buttons:', JSON.stringify(buttons));

  // Fill registration form
  const emailInput = page.locator('input[type="email"]').first();
  const passInputs = page.locator('input[type="password"]');
  const passCount = await passInputs.count();
  console.log('Password inputs count:', passCount);

  await emailInput.fill(EMAIL);
  await passInputs.nth(0).fill(PASSWORD);
  if (passCount > 1) {
    await passInputs.nth(1).fill(PASSWORD);
  }

  // Click register button
  const registerBtn = page.locator('button[type="submit"], button:has-text("注册"), button:has-text("Register")').first();
  await registerBtn.click();
  console.log('Clicked register');

  await page.waitForTimeout(5000);
  console.log('URL after register:', page.url());

  // Check if registered and logged in
  const userId = await page.evaluate(() => window.__CET_SYNC_USER_ID || 'NOT SET');
  console.log('__CET_SYNC_USER_ID:', userId);

  const lsKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => !k.includes('nextauth')));
  console.log('localStorage keys:', JSON.stringify(lsKeys));

  await browser.close();
  console.log('\nDone. Use:', EMAIL, '/', PASSWORD);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
