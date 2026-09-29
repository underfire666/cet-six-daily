// Diagnostic: check login, __CET_SYNC_USER_ID, and localStorage keys
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();

  // Try login
  console.log('Navigating to /login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Print page content to understand login form
  const formHtml = await page.evaluate(() => document.querySelector('form')?.outerHTML?.slice(0, 500) || 'no form');
  console.log('Form HTML:', formHtml);

  // Find all inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
    }));
  });
  console.log('Inputs:', JSON.stringify(inputs));

  // Find all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim(), type: b.type
    }));
  });
  console.log('Buttons:', JSON.stringify(buttons));

  // Try to fill and submit
  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();

  if (await emailInput.isVisible({ timeout: 2000 })) {
    await emailInput.fill('v13test_a@example.com');
    console.log('Filled email');
  } else {
    console.log('Email input not visible, trying name=email');
    await page.locator('input[name="email"]').first().fill('v13test_a@example.com');
  }

  if (await passInput.isVisible({ timeout: 2000 })) {
    await passInput.fill('Test123456');
    console.log('Filled password');
  } else {
    console.log('Password input not visible');
  }

  // Click login button
  const loginBtn = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first();
  console.log('Login button visible:', await loginBtn.isVisible({ timeout: 2000 }));
  await loginBtn.click();
  console.log('Clicked login button');

  // Wait for navigation
  await page.waitForTimeout(5000);
  console.log('URL after login:', page.url());

  // Check __CET_SYNC_USER_ID
  const userId = await page.evaluate(() => window.__CET_SYNC_USER_ID || 'NOT SET');
  console.log('__CET_SYNC_USER_ID:', userId);

  // Check localStorage keys
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys:', JSON.stringify(lsKeys.filter(k => !k.includes('nextauth'))));

  // Navigate to Paper QA
  console.log('\nNavigating to Paper QA...');
  await page.goto(`${BASE}/qa/paper/cet6:mock:paper-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  // Check paper session keys
  const paperKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('paper')));
  console.log('Paper session keys:', JSON.stringify(paperKeys));

  // Check __CET_SYNC_USER_ID again
  const userId2 = await page.evaluate(() => window.__CET_SYNC_USER_ID || 'NOT SET');
  console.log('__CET_SYNC_USER_ID on QA page:', userId2);

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
