// V13 Phase 2E.3 — Conflict Merge E2E v3.1 (same session, 10/10 target)
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const PAPER_QA = '/qa/paper/cet6:mock:paper-001';
const EMAIL = process.env.V13_TEST_USER || 'v13cm_c@example.com';
const PASSWORD = process.env.V13_TEST_PASS || 'CMtest123456';

async function clearPaperSessions(page) {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('paper-session')) localStorage.removeItem(k);
      if (k.includes('sync-queue')) localStorage.removeItem(k);
    }
  });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  if (!uid) throw new Error('Login failed');
  return uid;
}

async function ensureAccount() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  let uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  if (!uid) {
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').first().fill(EMAIL);
    const pi = page.locator('input[type="password"]');
    await pi.nth(0).fill(PASSWORD);
    if (await pi.count() > 1) await pi.nth(1).fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    uid = await page.evaluate(() => window.__CET_SYNC_USER_ID || null);
  }
  await browser.close();
  return uid;
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
          answerIds: Object.keys(v.answers || {}),
          phase: v.phase,
          startedAt: v.startedAt,
          currentSectionIndex: v.currentSectionIndex,
          currentGroupIndex: v.currentGroupIndex,
          currentQuestionIndex: v.currentQuestionIndex,
        };
      } catch {}
    }
    return result;
  });
}

async function findInProgress(page) {
  const sessions = await getSessions(page);
  const ip = Object.values(sessions).filter(s => s.phase === 'in_progress');
  ip.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  return ip[0] || null;
}

async function triggerSync(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

async function waitSync(page, timeout = 45000) {
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

async function answerWriting(page, text) {
  const ta = page.locator('textarea').first();
  if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ta.fill(text);
    await page.waitForTimeout(300);
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
  console.log('=== V13 Conflict Merge E2E v3.1 (same session, 10/10) ===\n');
  console.log('Ensuring test account...');
  const uid = await ensureAccount();
  console.log(`  Account: ${uid}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const ctxB = await browser.newContext({ viewport: { width: 430, height: 932 } });
  let blockA = false, blockB = false;
  ctxA.route('**/api/sync/**', r => blockA ? r.abort() : r.continue());
  ctxB.route('**/api/sync/**', r => blockB ? r.abort() : r.continue());
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  console.log('Step 1: Login + clear');
  await login(pageA); await login(pageB);
  await clearPaperSessions(pageA); await clearPaperSessions(pageB);
  console.log('  Done\n');

  console.log('Step 2: Device A Q1-Q5');
  await pageA.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await pageA.waitForTimeout(2000);
  const sb = pageA.locator('button:has-text("开始"), button:has-text("模拟考试")').first();
  if (await sb.isVisible({ timeout: 3000 }).catch(() => false)) { await sb.click(); await pageA.waitForTimeout(2000); }
  await answerWriting(pageA, 'CM v3.1 essay. Quick brown fox.');
  await gotoSection(pageA, '听力');
  for (let i = 0; i < 4; i++) { await answerChoice(pageA, i % 4); if (i < 3) await nextQ(pageA); }
  const bl = await findInProgress(pageA);
  const SID = bl.sessionId;
  console.log(`  SID=${SID}, answers=${bl.answersCount}, pos=sec${bl.currentSectionIndex}/g${bl.currentGroupIndex}/q${bl.currentQuestionIndex}`);

  console.log('\nStep 3: Device A sync');
  console.log(`  Sync: ${await waitSync(pageA, 45000)}`);
  await pageA.waitForTimeout(2000);

  console.log('\nStep 4: Device B pulls (on home)');
  await pageB.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await pageB.waitForTimeout(2000);
  console.log(`  Pull: ${await waitSync(pageB, 45000)}`);
  await pageB.waitForTimeout(3000);
  const blB = await findInProgress(pageB);
  console.log(`  B: ${blB?.sessionId}, answers=${blB?.answersCount}`);
  console.log(`  MATCH: ${blB?.sessionId === SID}`);
  if (blB?.sessionId !== SID) { console.log('FATAL mismatch'); await browser.close(); process.exit(1); }

  console.log('\nStep 5: Device B navigates to QA');
  await pageB.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await pageB.waitForTimeout(3000);
  const rB = await findInProgress(pageB);
  console.log(`  Resumed: ${rB?.sessionId}, answers=${rB?.answersCount}, pos=sec${rB.currentSectionIndex}/g${rB.currentGroupIndex}/q${rB.currentQuestionIndex}`);

  console.log('\nStep 6: Block sync');
  blockA = true; blockB = true;

  console.log('\nStep 7: Device A Q6-Q8');
  await nextQ(pageA);
  for (let i = 0; i < 3; i++) { await answerChoice(pageA, (i+1)%4); if (i<2) await nextQ(pageA); }
  const pmA = await findInProgress(pageA);
  console.log(`  A pre-merge: ${pmA.answersCount}`);

  console.log('\nStep 8: Device B Q9-Q10 (from Q5, 4 next=Q9)');
  for (let i = 0; i < 4; i++) { const ok = await nextQ(pageB); console.log(`    next${i+1}:${ok}`); await pageB.waitForTimeout(400); }
  const posB = await findInProgress(pageB);
  console.log(`  B pos before Q9: sec${posB.currentSectionIndex}/g${posB.currentGroupIndex}/q${posB.currentQuestionIndex}`);
  await answerChoice(pageB, 2); await pageB.waitForTimeout(400);
  await nextQ(pageB); await pageB.waitForTimeout(400);
  await answerChoice(pageB, 3);
  const pmB = await findInProgress(pageB);
  console.log(`  B pre-merge: ${pmB.answersCount}, IDs=${JSON.stringify(pmB.answerIds)}`);

  console.log('\nStep 9: Unblock + sync');
  blockA = false; blockB = false;
  console.log(`  A push: ${await waitSync(pageA, 45000)}`);
  console.log(`  B push: ${await waitSync(pageB, 45000)}`);
  await pageA.waitForTimeout(3000); await pageB.waitForTimeout(3000);
  await triggerSync(pageA); await triggerSync(pageB);
  await pageA.waitForTimeout(8000); await pageB.waitForTimeout(8000);
  console.log('  Reloading...');
  await pageA.reload({ waitUntil: 'networkidle' });
  await pageB.reload({ waitUntil: 'networkidle' });
  await pageA.waitForTimeout(3000); await pageB.waitForTimeout(3000);

  console.log('\nStep 10: Final');
  const fA = await findInProgress(pageA);
  const fB = await findInProgress(pageB);
  console.log(`  A: ${fA?.answersCount} answers`);
  console.log(`  B: ${fB?.answersCount} answers`);
  const aC = fA?.answersCount || 0, bC = fB?.answersCount || 0;
  const sameS = fA?.sessionId === fB?.sessionId;
  const sameA = JSON.stringify([...(fA?.answerIds||[])].sort()) === JSON.stringify([...(fB?.answerIds||[])].sort());
  const pass = aC === 10 && bC === 10 && sameS && sameA;
  console.log(`\n=== RESULT ===`);
  console.log(`  BASELINE: 5, A_PREMERGE: ${pmA.answersCount}, B_PREMERGE: ${pmB.answersCount}`);
  console.log(`  FINAL_A: ${aC}, FINAL_B: ${bC}`);
  console.log(`  SAME_SESSION: ${sameS}, SAME_ANSWERS: ${sameA}`);
  console.log(`  CONFLICT_MERGE: ${pass ? 'PASS' : 'FAIL'}`);

  const fs = require('fs');
  fs.writeFileSync('tests/v13-cm-v3-result.json', JSON.stringify({
    sessionId: SID, baseline: 5, aPreMerge: pmA.answersCount, bPreMerge: pmB.answersCount,
    finalA: aC, finalB: bC, sameSession: sameS, sameAnswers: sameA, pass,
    finalAIds: fA?.answerIds, finalBIds: fB?.answerIds,
  }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
