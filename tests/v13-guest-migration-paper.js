// V13 Phase 2E.3 — PaperSession Guest→Account Migration E2E v2
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const PAPER_QA = '/qa/paper/cet6:mock:paper-001';
const EMAIL = process.env.V13_MIG_USER || 'v13mig_b@example.com';
const PASSWORD = process.env.V13_MIG_PASS || 'MIGtest123456';

function extractWritingDraft(session) {
  if (!session || !session.answers) return '';
  for (const [qid, rec] of Object.entries(session.answers)) {
    if (qid.includes('writing') && rec.draft) return rec.draft;
  }
  return '';
}

async function getPaperSessionsRaw(page) {
  return page.evaluate(() => {
    const result = {};
    for (const k of Object.keys(localStorage)) {
      if (!k.includes('paper-session')) continue;
      try { result[k] = JSON.parse(localStorage.getItem(k)); } catch {}
    }
    return result;
  });
}

async function findInProgress(page) {
  const all = await getPaperSessionsRaw(page);
  const ip = Object.values(all).filter(s => s.phase === 'in_progress');
  ip.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  return ip[0] || null;
}

async function answerWriting(page, text) {
  const ta = page.locator('textarea').first();
  if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ta.fill(text);
    await page.waitForTimeout(500);
    return true;
  }
  return false;
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

async function main() {
  console.log('=== V13 PaperSession Guest→Account Migration E2E v2 ===\n');
  console.log('Ensuring test account...');
  const uid = await ensureAccount();
  console.log(`  Account: ${uid}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();

  // Step 1: Guest creates paper session
  console.log('Step 1: Guest creates in-progress PaperSession');
  await page.goto(`${BASE}${PAPER_QA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const sb = page.locator('button:has-text("开始"), button:has-text("模拟考试")').first();
  if (await sb.isVisible({ timeout: 3000 }).catch(() => false)) { await sb.click(); await page.waitForTimeout(2000); }

  const DRAFT = 'Guest migration v2 test essay. The quick brown fox jumps over the lazy dog. Migration verification draft.';
  await answerWriting(page, DRAFT);
  console.log('  Writing draft entered');

  await gotoSection(page, '听力');
  for (let i = 0; i < 3; i++) { await answerChoice(page, i % 4); if (i < 2) await nextQ(page); }
  console.log('  3 Listening answers');

  await gotoSection(page, '阅读');
  await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await answerChoice(page, (i + 1) % 4); if (i < 2) await nextQ(page); }
  console.log('  3 Reading answers');

  const guestSession = await findInProgress(page);
  const guestDraft = extractWritingDraft(guestSession);
  const guestAnswerIds = Object.keys(guestSession.answers || {});
  console.log(`\n  GUEST_SESSION_ID: ${guestSession.sessionId}`);
  console.log(`  GUEST_ANSWER_COUNT: ${guestAnswerIds.length}`);
  console.log(`  GUEST_ANSWER_IDS: ${JSON.stringify(guestAnswerIds)}`);
  console.log(`  GUEST_WRITING_DRAFT: ${guestDraft ? 'present (' + guestDraft.length + ' chars)' : 'MISSING'}`);
  console.log(`  GUEST_PHASE: ${guestSession.phase}`);

  // Step 2: Login
  console.log('\nStep 2: Login as User A');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);

  // Step 3: Navigate to account page and trigger migration
  console.log('\nStep 3: Navigate to /me/account, trigger migration');
  await page.goto(`${BASE}/me/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const mergeBtn = page.locator('button:has-text("把本机学习记录合并到账号")').first();
  const mergeVisible = await mergeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  Migration button visible: ${mergeVisible}`);

  if (!mergeVisible) {
    console.log('  FAIL: Migration button not visible!');
    // Debug: check what's on the page
    const allBtns = await page.locator('button').allTextContents();
    console.log('  Buttons:', JSON.stringify(allBtns.slice(0, 10)));
    await browser.close();
    process.exit(1);
  }

  await mergeBtn.click();
  await page.waitForTimeout(2000);

  // Click confirm in preview
  const confirmBtn = page.locator('button:has-text("合并到我的账号")').first();
  const confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  Confirm button visible: ${confirmVisible}`);
  if (confirmVisible) {
    await confirmBtn.click();
    console.log('  Migration confirmed, waiting...');
    await page.waitForTimeout(8000);
  } else {
    console.log('  WARNING: No confirm button, may have auto-migrated');
    await page.waitForTimeout(5000);
  }

  // Step 4: Verify migrated session
  console.log('\nStep 4: Verify migrated PaperSession in User A namespace');
  const allSessions = await getPaperSessionsRaw(page);
  console.log(`  Total paper session keys: ${Object.keys(allSessions).length}`);
  for (const k of Object.keys(allSessions)) {
    console.log(`    ${k}: answers=${Object.keys(allSessions[k].answers || {}).length}`);
  }

  const userNs = `user:${uid}:`;
  const userSessions = {};
  const flatSessions = {};
  for (const [k, v] of Object.entries(allSessions)) {
    if (k.startsWith(userNs)) userSessions[k] = v;
    else flatSessions[k] = v;
  }
  console.log(`  User-namespaced: ${Object.keys(userSessions).length}`);
  console.log(`  Flat (guest): ${Object.keys(flatSessions).length}`);

  const migratedSession = Object.values(userSessions).find(s => s.sessionId === guestSession.sessionId);
  if (!migratedSession) {
    console.log('  FAIL: Migrated session not found in user namespace!');
    await browser.close();
    process.exit(1);
  }

  const migratedDraft = extractWritingDraft(migratedSession);
  const migratedAnswerIds = Object.keys(migratedSession.answers || {});
  console.log(`\n  USER_A_SESSION_ID: ${migratedSession.sessionId}`);
  console.log(`  USER_A_ANSWER_COUNT: ${migratedAnswerIds.length}`);
  console.log(`  USER_A_WRITING_DRAFT: ${migratedDraft ? 'present (' + migratedDraft.length + ' chars)' : 'MISSING'}`);
  console.log(`  USER_A_PHASE: ${migratedSession.phase}`);

  const sessionMatch = migratedSession.sessionId === guestSession.sessionId;
  const answersMatch = JSON.stringify([...migratedAnswerIds].sort()) === JSON.stringify([...guestAnswerIds].sort());
  const countMatch = migratedAnswerIds.length === guestAnswerIds.length;
  const draftMatch = migratedDraft === guestDraft;
  const phaseMatch = migratedSession.phase === guestSession.phase;
  const duplicateCount = Object.values(userSessions).filter(s => s.sessionId === guestSession.sessionId).length;

  console.log(`\n  Session ID match: ${sessionMatch}`);
  console.log(`  Answer IDs match: ${answersMatch}`);
  console.log(`  Answer count match: ${countMatch}`);
  console.log(`  Writing draft match: ${draftMatch}`);
  console.log(`  Phase match: ${phaseMatch}`);
  console.log(`  Duplicate sessions: ${duplicateCount} (should be 1)`);

  const pass = sessionMatch && answersMatch && countMatch && draftMatch && phaseMatch && duplicateCount === 1;

  console.log('\n=== RESULT ===');
  console.log(`  PAPER_SESSION_GUEST_MIGRATION: ${pass ? 'PASS' : 'FAIL'}`);

  const fs = require('fs');
  fs.writeFileSync('tests/v13-guest-migration-result.json', JSON.stringify({
    guestSessionId: guestSession.sessionId, guestAnswers: guestAnswerIds.length,
    guestAnswerIds, guestDraft, guestPhase: guestSession.phase,
    migratedSessionId: migratedSession.sessionId, migratedAnswers: migratedAnswerIds.length,
    migratedAnswerIds, migratedDraft, migratedPhase: migratedSession.phase,
    sessionMatch, answersMatch, countMatch, draftMatch, phaseMatch, duplicateCount, pass,
  }, null, 2));

  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
