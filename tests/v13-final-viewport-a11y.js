// V13 Phase 2E.3 Final Evidence Closure — Viewport + Accessibility Tests
// Run with: node tests/v13-final-viewport-a11y.js
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const PAPER_QA = '/qa/paper/cet6:mock:paper-001';

async function checkPage(page, url, label) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const de = document.documentElement;
    const scrollW = de.scrollWidth;
    const clientW = de.clientWidth;
    const bodyScrollW = document.body.scrollWidth;
    const overflow = scrollW > clientW;
    // Check for horizontal overflow elements
    const overflowEls = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > clientW + 1 || r.left < -1) {
        if (el.tagName !== 'HTML' && el.tagName !== 'BODY') {
          overflowEls.push(`${el.tagName}.${el.className?.toString().slice(0,40)} right=${r.right.toFixed(0)}`);
        }
      }
    });
    return { scrollW, clientW, bodyScrollW, overflow, overflowEls: overflowEls.slice(0, 5) };
  });
  const status = result.overflow ? 'FAIL' : 'PASS';
  console.log(`[${status}] ${label}: scrollW=${result.scrollW} clientW=${result.clientW} overflow=${result.overflow}`);
  if (result.overflow && result.overflowEls.length) {
    console.log(`  Overflow elements: ${result.overflowEls.join('; ')}`);
  }
  return { label, ...result, status };
}

async function checkA11y(page, url, label) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const issues = [];
    // Check buttons without accessible name
    document.querySelectorAll('button').forEach((b, i) => {
      const name = b.getAttribute('aria-label') || b.textContent?.trim() || b.getAttribute('title');
      if (!name) issues.push(`button[${i}] has no accessible name`);
    });
    // Check textareas without label
    document.querySelectorAll('textarea').forEach((t, i) => {
      const id = t.id;
      const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
      const ariaLabel = t.getAttribute('aria-label');
      const ariaLabelledby = t.getAttribute('aria-labelledby');
      if (!hasLabel && !ariaLabel && !ariaLabelledby) {
        issues.push(`textarea[${i}] has no label (placeholder="${t.placeholder?.slice(0,30)}")`);
      }
    });
    // Check inputs without label
    document.querySelectorAll('input:not([type="hidden"])').forEach((inp, i) => {
      const id = inp.id;
      const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
      const ariaLabel = inp.getAttribute('aria-label');
      if (!hasLabel && !ariaLabel && inp.type !== 'submit') {
        issues.push(`input[${i}][type=${inp.type}] has no label`);
      }
    });
    // Check focus indicators
    const focusable = document.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    let noFocus = 0;
    focusable.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.outlineStyle === 'none' && style.outlineWidth === '0px') {
        // Check if :focus-visible is defined via CSS — can't easily check, just count
        noFocus++;
      }
    });
    // Check landmarks
    const landmarks = {
      header: document.querySelectorAll('header').length,
      main: document.querySelectorAll('main').length,
      nav: document.querySelectorAll('nav').length,
      footer: document.querySelectorAll('footer').length,
    };
    // Check headings
    const h1 = document.querySelectorAll('h1').length;
    const h2 = document.querySelectorAll('h2').length;
    // Check skip link
    const skipLink = document.querySelector('a[href="#page-content"], a[href="#main"], a.skip-link');
    return {
      buttonCount: document.querySelectorAll('button').length,
      textareaCount: document.querySelectorAll('textarea').length,
      inputCount: document.querySelectorAll('input:not([type="hidden"])').length,
      focusableCount: focusable.length,
      noFocusIndicatorCount: noFocus,
      landmarks,
      h1Count: h1,
      h2Count: h2,
      hasSkipLink: !!skipLink,
      issues: issues.slice(0, 10),
    };
  });
  const pass = result.issues.length === 0;
  console.log(`[${pass ? 'PASS' : 'PARTIAL'}] ${label} A11y: buttons=${result.buttonCount} textareas=${result.textareaCount} inputs=${result.inputCount} h1=${result.h1Count} skipLink=${result.hasSkipLink} issues=${result.issues.length}`);
  if (result.issues.length) {
    result.issues.forEach(i => console.log(`  - ${i}`));
  }
  return { label, ...result, pass };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = { viewport430: [], viewport1440: [], a11y: [] };

  // ============ 430px Viewport Test ============
  console.log('\n========== 430px VIEWPORT TEST ==========');
  const ctx430 = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page430 = await ctx430.newPage();

  const pages430 = [
    { url: `${BASE}/`, label: 'Home' },
    { url: `${BASE}${PAPER_QA}`, label: 'Paper Start' },
    { url: `${BASE}/vocabulary`, label: 'Vocabulary' },
    { url: `${BASE}/reading`, label: 'Reading' },
    { url: `${BASE}/listening`, label: 'Listening' },
    { url: `${BASE}/translation`, label: 'Translation' },
    { url: `${BASE}/writing`, label: 'Writing' },
    { url: `${BASE}/review`, label: 'Review/Wrongbook' },
    { url: `${BASE}/me`, label: 'Profile' },
    { url: `${BASE}/me/account`, label: 'Account & Sync' },
  ];

  for (const p of pages430) {
    try {
      results.viewport430.push(await checkPage(page430, p.url, p.label));
    } catch (e) {
      console.log(`[ERROR] ${p.label}: ${e.message}`);
      results.viewport430.push({ label: p.label, status: 'ERROR', error: e.message });
    }
  }
  await ctx430.close();

  // ============ 1440px Viewport Test ============
  console.log('\n========== 1440px VIEWPORT TEST ==========');
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1440 = await ctx1440.newPage();

  const pages1440 = [
    { url: `${BASE}/`, label: 'Home' },
    { url: `${BASE}${PAPER_QA}`, label: 'Paper Start' },
    { url: `${BASE}/vocabulary`, label: 'Vocabulary' },
    { url: `${BASE}/reading`, label: 'Reading' },
    { url: `${BASE}/listening`, label: 'Listening' },
    { url: `${BASE}/translation`, label: 'Translation' },
    { url: `${BASE}/writing`, label: 'Writing' },
    { url: `${BASE}/review`, label: 'Review/Wrongbook' },
    { url: `${BASE}/me`, label: 'Profile' },
    { url: `${BASE}/me/account`, label: 'Account & Sync' },
  ];

  for (const p of pages1440) {
    try {
      results.viewport1440.push(await checkPage(page1440, p.url, p.label));
    } catch (e) {
      console.log(`[ERROR] ${p.label}: ${e.message}`);
      results.viewport1440.push({ label: p.label, status: 'ERROR', error: e.message });
    }
  }
  await ctx1440.close();

  // ============ Accessibility Test (Paper Flow) ============
  console.log('\n========== PAPER FLOW ACCESSIBILITY TEST ==========');
  const ctxA11y = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pageA11y = await ctxA11y.newPage();

  const a11yPages = [
    { url: `${BASE}/`, label: 'Home' },
    { url: `${BASE}${PAPER_QA}`, label: 'Paper Start' },
    { url: `${BASE}/writing`, label: 'Writing' },
    { url: `${BASE}/listening`, label: 'Listening' },
    { url: `${BASE}/reading`, label: 'Reading' },
    { url: `${BASE}/translation`, label: 'Translation' },
    { url: `${BASE}/review`, label: 'Review' },
    { url: `${BASE}/me`, label: 'Profile' },
  ];

  for (const p of a11yPages) {
    try {
      results.a11y.push(await checkA11y(pageA11y, p.url, p.label));
    } catch (e) {
      console.log(`[ERROR] ${p.label} A11y: ${e.message}`);
      results.a11y.push({ label: p.label, pass: false, error: e.message });
    }
  }
  await ctxA11y.close();

  await browser.close();

  // ============ Summary ============
  console.log('\n========== SUMMARY ==========');
  const v430Pass = results.viewport430.filter(r => r.status === 'PASS').length;
  const v430Fail = results.viewport430.filter(r => r.status === 'FAIL').length;
  const v1440Pass = results.viewport1440.filter(r => r.status === 'PASS').length;
  const v1440Fail = results.viewport1440.filter(r => r.status === 'FAIL').length;
  const a11yPass = results.a11y.filter(r => r.pass).length;
  const a11yPartial = results.a11y.filter(r => !r.pass).length;

  console.log(`430px: ${v430Pass}/${results.viewport430.length} PASS, ${v430Fail} FAIL`);
  console.log(`1440px: ${v1440Pass}/${results.viewport1440.length} PASS, ${v1440Fail} FAIL`);
  console.log(`A11y: ${a11yPass}/${results.a11y.length} PASS, ${a11yPartial} PARTIAL`);

  // Write JSON results
  const fs = require('fs');
  fs.writeFileSync('tests/v13-viewport-a11y-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults written to tests/v13-viewport-a11y-results.json');
}

main().catch(e => { console.error(e); process.exit(1); });
