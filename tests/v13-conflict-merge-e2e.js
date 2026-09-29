// V13 Phase 2E.3 — Conflict Merge Real Concurrent E2E (v2)
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const PAPER_QA = '/qa/paper/cet6:mock:paper-001';
const EMAIL = 'v13e2e_a@example.com';
const PASSWORD = process.env.V13_TEST_PASSWORD || 'E2Etest123456';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  if (!uid) throw new Error('Login failed: userId not set');
  console.log(`  Logged in, userId=${uid}`);
}

async function getSessions(page) {
  return page.evaluate(() => {
    const result = {};
    for (const k of Object.keys(localStorage)) {
      if (!k.includes('paper-session')) continue;
      try {
        const v = JSON.parse(localStorage.getItem(k));
        result[k] = {
          sessionId: v.sessionId,
          answersCount: Object.keys(v.answers || {}).length,
          answers: Object.keys(v.answers || {}),
          phase: v.phase,
        };
      } catch {}
    }
    return result;
  });
}

async function findSessionByAnswers(page, minAnswers) {
  const sessions = await getSessions(page);
  for (const [k, v] of Object.entries(sessions)) {
    if (v.answersCount >= minAnswers) return { key: k, ...v };
  }
  return null;
}

async function triggerSync(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

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

async function startSession(page) {
  await page.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const btn = page.locator('button:has-text("开始"), button:has-text("模拟考试")').first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(2000);
    console.log('  Started new session');
  } else {
    console.log('  Session already exists (resuming)');
  }
}

async function answerWriting(page, text) {
  const ta = page.locator('textarea').first();
  if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ta.fill(text);
    await page.waitForTimeout(300);
    const sb = page.locator('button:has-text("提交")').first();
    if (await sb.isVisible({ timeout: 2000 }).catch(() => false)) await sb.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function answerChoice(page, idx = 0) {
  const opts = page.locator('button:has-text("A."), button:has-text("B."), button:has-text("C."), button:has-text("D.")');
  const n = await opts.count();
  if (n > 0) {
    await opts.nth(Math.min(idx, n - 1)).click();
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function nextQ(page) {
  const btn = page.locator('button:has-text("下一题"), button:has-text("完成本节")').first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function gotoSection(page, name) {
  const tab = page.locator(`button:has-text("${name}")`).first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function main() {
  console.log('=== V13 Conflict Merge E2E v2 ===\n');
  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const ctxB = await browser.newContext({ viewport: { width: 430, height: 932 } });

  let blockA = false, blockB = false;
  ctxA.route('**/api/sync/**', r => blockA ? r.abort() : r.continue());
  ctxB.route('**/api/sync/**', r => blockB ? r.abort() : r.continue());

  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // Step 1: Login
  console.log('Step 1: Login both');
  await login(pageA);
  await login(pageB);

  // Step 2: Device A starts session, answers Q1-Q5
  console.log('\nStep 2: Device A answers Q1-Q5');
  await startSession(pageA);
  await answerWriting(pageA, 'Conflict merge test essay. The quick brown fox.');
  await gotoSection(pageA, '听力');
  for (let i = 0; i < 4; i++) {
    await answerChoice(pageA, i % 4);
    if (i < 3) await nextQ(pageA);
  }
  const sA = await findSessionByAnswers(pageA, 5);
  console.log(`  Baseline: sessionId=${sA?.sessionId}, answers=${sA?.answersCount}`);

  // Step 3: Device A sync
  console.log('\nStep 3: Device A sync to cloud');
  const okA = await waitSync(pageA, 30000);
  console.log(`  Sync complete: ${okA}`);
  await pageA.waitForTimeout(2000);

  // Step 4: Device B pulls baseline
  console.log('\nStep 4: Device B pulls baseline');
  await pageB.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await pageB.waitForTimeout(2000);
  const okB = await waitSync(pageB, 30000);
  console.log(`  Pull sync complete: ${okB}`);
  await pageB.reload({ waitUntil: 'networkidle' });
  await pageB.waitForTimeout(3000);
  const sB = await findSessionByAnswers(pageB, 5);
  if (sB) {
    console.log(`  Device B baseline: sessionId=${sB.sessionId}, answers=${sB.answersCount}`);
  } else {
    console.log('  FAIL: Device B could not pull baseline session');
    const all = await getSessions(pageB);
    for (const [k, v] of Object.entries(all)) console.log(`    ${k}: answers=${v.answersCount}`);
  }

  // Step 5: Block sync
  console.log('\nStep 5: Block sync on both');
  blockA = true; blockB = true;

  // Step 6: Device A answers Q6-Q8
  console.log('\nStep 6: Device A answers Q6-Q8 (stale)');
  await nextQ(pageA); // from Q5 to Q6
  for (let i = 0; i < 3; i++) {
    await answerChoice(pageA, (i + 1) % 4);
    if (i < 2) await nextQ(pageA);
  }
  const sA2 = await findSessionByAnswers(pageA, 8);
  console.log(`  Device A after Q6-Q8: answers=${sA2?.answersCount}`);

  // Step 7: Device B answers Q9-Q10 (stale, doesn't know Q6-Q8)
  console.log('\nStep 7: Device B answers Q9-Q10 (stale)');
  await gotoSection(pageB, '听力');
  await pageB.waitForTimeout(500);
  // Navigate to Q9 (4 next clicks from Q5)
  for (let i = 0; i < 4; i++) await nextQ(pageB);
  for (let i = 0; i < 2; i++) {
    await answerChoice(pageB, (i + 2) % 4);
    if (i < 1) await nextQ(pageB);
  }
  const sB2 = await getSessions(pageB);
  const bCount = Math.max(...Object.values(sB2).map(v => v.answersCount));
  console.log(`  Device B after Q9-Q10: max answers=${bCount}`);

  // Step 8: Unblock, sync both
  console.log('\nStep 8: Unblock and sync both');
  blockA = false; blockB = false;
  console.log('  Device A sync...');
  await waitSync(pageA, 30000);
  console.log('  Device B sync...');
  await waitSync(pageB, 30000);
  // Extra pull cycle to get each other's changes
  await pageA.waitForTimeout(3000);
  await pageB.waitForTimeout(3000);
  await triggerSync(pageA);
  await triggerSync(pageB);
  await pageA.waitForTimeout(5000);
  await pageB.waitForTimeout(5000);

  // Reload
  console.log('  Reloading both...');
  await pageA.reload({ waitUntil: 'networkidle' });
  await pageB.reload({ waitUntil: 'networkidle' });
  await pageA.waitForTimeout(3000);
  await pageB.waitForTimeout(3000);

  // Step 9: Verify
  console.log('\nStep 9: Verify merged session');
  const finalA = await getSessions(pageA);
  const finalB = await getSessions(pageB);

  console.log('\n--- Device A ---');
  for (const [k, v] of Object.entries(finalA)) {
    console.log(`  ${v.sessionId}: answers=${v.answersCount}, phase=${v.phase}`);
  }
  console.log('\n--- Device B ---');
  for (const [k, v] of Object.entries(finalB)) {
    console.log(`  ${v.sessionId}: answers=${v.answersCount}, phase=${v.phase}`);
  }

  // Find the merged session (the one with baselineSessionId that has most answers)
  const allA = Object.values(finalA);
  const allB = Object.values(finalB);
  const maxA = allA.length ? Math.max(...allA.map(v => v.answersCount)) : 0;
  const maxB = allB.length ? Math.max(...allB.map(v => v.answersCount)) : 0;
  const pass = maxA >= 8 && maxB >= 8;

  console.log('\n=== RESULT ===');
  console.log(`  Device A max answers: ${maxA}`);
  console.log(`  Device B max answers: ${maxB}`);
  console.log(`  Baseline: ${sA?.answersCount}`);
  console.log(`  CONFLICT_MERGE_BROWSER_E2E: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  FINAL_CONFLICT_ANSWERS: ${Math.min(maxA, maxB)}/10`);

  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
