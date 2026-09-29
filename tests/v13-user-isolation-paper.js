// V13 Phase 2E.3 — PaperSession User A/B Isolation E2E v2
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const PAPER_QA = '/qa/paper/cet6:mock:paper-001';
const EMAIL_A = 'v13iso_c@example.com';
const PASS_A = 'ISOtest123456';
const EMAIL_B = 'v13iso_d@example.com';
const PASS_B = 'ISOtest123456';

async function getPaperSessionsForUser(page, userId) {
  // Read ONLY the current user's namespaced paper sessions
  return page.evaluate((uid) => {
    const prefix = `user:${uid}:cet-daily:v13:paper-session:`;
    const result = {};
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(prefix)) continue;
      try { result[k] = JSON.parse(localStorage.getItem(k)); } catch {}
    }
    return result;
  }, userId);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  if (!uid) throw new Error(`Login failed for ${email}`);
  return uid;
}

async function logout(page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
}

async function ensureAccount(email, password) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  let uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  if (!uid) {
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').first().fill(email);
    const pi = page.locator('input[type="password"]');
    await pi.nth(0).fill(password);
    if (await pi.count() > 1) await pi.nth(1).fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  }
  await browser.close();
  return uid;
}

async function answerChoice(page, idx = 0) {
  const opts = page.locator('button:has-text("A."), button:has-text("B."), button:has-text("C."), button:has-text("D.")');
  const n = await opts.count();
  if (n > 0) { await opts.nth(Math.min(idx, n - 1)).click(); await page.waitForTimeout(400); return true; }
  return false;
}

async function nextQ(page) {
  const btn = page.locator('button:has-text("下一题"), button:has-text("完成本节")').first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(600); return true; }
  return false;
}

async function gotoSection(page, name) {
  const tab = page.locator(`button:has-text("${name}")`).first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) { await tab.click(); await page.waitForTimeout(800); return true; }
  return false;
}

async function triggerSync(page) { await page.evaluate(() => window.dispatchEvent(new Event('online'))); }

async function waitSync(page, timeout = 30000) {
  await triggerSync(page);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const empty = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (!k.includes('sync-queue')) continue;
        try { if (JSON.parse(localStorage.getItem(k) || '[]').length > 0) return false; } catch {}
      }
      return true;
    });
    if (empty) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function main() {
  console.log('=== V13 PaperSession User A/B Isolation E2E v2 ===\n');
  console.log('Ensuring test accounts...');
  const uidA = await ensureAccount(EMAIL_A, PASS_A);
  const uidB = await ensureAccount(EMAIL_B, PASS_B);
  console.log(`  User A: ${uidA}`);
  console.log(`  User B: ${uidB}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();

  // Step 1: User A creates paper session
  console.log('Step 1: User A creates PaperSession');
  await login(page, EMAIL_A, PASS_A);
  await page.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const sb = page.locator('button:has-text("开始"), button:has-text("模拟考试")').first();
  if (await sb.isVisible({ timeout: 3000 }).catch(() => false)) { await sb.click(); await page.waitForTimeout(2000); }
  await gotoSection(page, '听力');
  for (let i = 0; i < 4; i++) { await answerChoice(page, i % 4); if (i < 3) await nextQ(page); }
  await gotoSection(page, '阅读');
  await page.waitForTimeout(500);
  for (let i = 0; i < 2; i++) { await answerChoice(page, (i + 1) % 4); if (i < 1) await nextQ(page); }

  const sessionsA = await getPaperSessionsForUser(page, uidA);
  const sessionA = Object.values(sessionsA)[0];
  const A_SESSION_ID = sessionA.sessionId;
  const A_ANSWERS_COUNT = Object.keys(sessionA.answers || {}).length;
  console.log(`  A_SESSION_ID: ${A_SESSION_ID}`);
  console.log(`  A_ANSWERS_COUNT: ${A_ANSWERS_COUNT}`);
  console.log(`  A namespace sessions: ${Object.keys(sessionsA).length}`);

  console.log('  Syncing A...');
  await waitSync(page, 30000);
  await page.waitForTimeout(2000);

  // Step 2: Logout A (clear cookies and localStorage)
  console.log('\nStep 2: Logout A (clear all local data)');
  await logout(page);
  console.log('  Logged out');

  // Step 3: Login B
  console.log('\nStep 3: Login B');
  await login(page, EMAIL_B, PASS_B);
  await waitSync(page, 30000);
  await page.waitForTimeout(3000);

  // Step 4: Verify B's namespace has no A session
  console.log('\nStep 4: Verify B namespace isolation');
  const sessionsB = await getPaperSessionsForUser(page, uidB);
  console.log(`  B namespace sessions: ${Object.keys(sessionsB).length}`);
  const bHasA = Object.values(sessionsB).some(s => s.sessionId === A_SESSION_ID);
  console.log(`  B has A session in namespace: ${bHasA ? 'YES (FAIL)' : 'NO (PASS)'}`);

  // Navigate B to Paper QA — should show fresh start (not resume A)
  console.log('\nStep 5: B navigates to Paper QA (should be fresh)');
  await page.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const startBtnB = page.locator('button:has-text("开始"), button:has-text("模拟考试")').first();
  const startVisible = await startBtnB.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`  Start button visible (fresh session): ${startVisible ? 'YES (PASS)' : 'NO (might be resumed)'}`);

  // If start button visible, B is NOT resuming A's session → isolation works
  // If not visible, check if the session being shown is A's
  let bResumedA = false;
  if (!startVisible) {
    const sessionsAfter = await getPaperSessionsForUser(page, uidB);
    bResumedA = Object.values(sessionsAfter).some(s => s.sessionId === A_SESSION_ID);
    console.log(`  B resumed A session: ${bResumedA ? 'YES (FAIL)' : 'NO (PASS)'}`);
  }

  // Step 6: Logout B, Login A, verify A's session restored
  console.log('\nStep 6: Logout B, Login A');
  await logout(page);
  await login(page, EMAIL_A, PASS_A);
  await waitSync(page, 30000);
  await page.waitForTimeout(3000);

  console.log('\nStep 7: Verify A session restored');
  await page.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const restoredSessions = await getPaperSessionsForUser(page, uidA);
  const restored = Object.values(restoredSessions).find(s => s.sessionId === A_SESSION_ID);
  const restoredAnswers = restored ? Object.keys(restored.answers || {}).length : 0;
  console.log(`  Restored A_SESSION_ID: ${restored?.sessionId || 'NOT FOUND'}`);
  console.log(`  Restored A_ANSWERS: ${restoredAnswers}`);
  const aRestored = restored?.sessionId === A_SESSION_ID && restoredAnswers === A_ANSWERS_COUNT;
  console.log(`  A fully restored: ${aRestored ? 'YES' : 'NO'}`);

  const pass = !bHasA && !bResumedA && aRestored;
  console.log('\n=== RESULT ===');
  console.log(`  B_NAMESPACE_HAS_A_SESSION: ${bHasA ? 'YES' : 'NO'}`);
  console.log(`  B_RESUMED_A_SESSION: ${bResumedA ? 'YES' : 'NO'}`);
  console.log(`  A_SESSION_RESTORED: ${aRestored ? 'YES' : 'NO'}`);
  console.log(`  PAPER_SESSION_USER_ISOLATION: ${pass ? 'PASS' : 'FAIL'}`);

  const fs = require('fs');
  fs.writeFileSync('tests/v13-user-isolation-result.json', JSON.stringify({
    aSessionId: A_SESSION_ID, aAnswersCount: A_ANSWERS_COUNT,
    bNamespaceHasA: bHasA, bResumedA, aRestored, pass,
  }, null, 2));

  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
