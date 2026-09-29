/**
 * V13.0.2 hotfix regression test: PaperStartPage QA/Staging badge.
 *
 * Production route (/practice/paper/[paperId]) must NOT show
 * "QA / Staging — 仅开发环境" badge.
 * QA route (/qa/paper/[paperId]) MAY show the badge.
 *
 * Uses react-dom/server renderToString with real Paper 001 content.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { PaperProvider } from "../src/components/paper/PaperProvider";
import { PaperStartPage } from "../src/components/paper/PaperStartPage";
import { mockPaper001 } from "../src/content/papers/cet6-mock-paper-001";

function renderStartPage(qaMode?: boolean): string {
  return renderToString(
    <PaperProvider paper={mockPaper001} ownerNamespace="test-guest" isLoggedIn={false}>
      <PaperStartPage qaMode={qaMode} />
    </PaperProvider>,
  );
}

test("production Paper start: does NOT contain 'QA / Staging'", () => {
  const html = renderStartPage(); // default qaMode=false
  assert.ok(!html.includes("QA / Staging"), "Production start page must not contain 'QA / Staging'");
});

test("production Paper start: does NOT contain '仅开发环境'", () => {
  const html = renderStartPage(); // default qaMode=false
  assert.ok(!html.includes("仅开发环境"), "Production start page must not contain '仅开发环境'");
});

test("production Paper start: explicit qaMode=false does NOT show badge", () => {
  const html = renderStartPage(false);
  assert.ok(!html.includes("QA / Staging"), "qaMode=false must not show QA badge");
  assert.ok(!html.includes("仅开发环境"), "qaMode=false must not show dev-only text");
});

test("QA Paper start: qaMode=true DOES show 'QA / Staging' badge", () => {
  const html = renderStartPage(true);
  assert.ok(html.includes("QA / Staging"), "QA mode must show 'QA / Staging' badge");
});

test("QA Paper start: qaMode=true DOES show '仅开发环境'", () => {
  const html = renderStartPage(true);
  assert.ok(html.includes("仅开发环境"), "QA mode must show '仅开发环境' text");
});

test("production Paper start: still shows paper title and original mock label", () => {
  const html = renderStartPage();
  assert.ok(html.includes(mockPaper001.title), "Production start page must show paper title");
  assert.ok(html.includes("原创高仿真模拟卷"), "Production start page must show original mock label");
  assert.ok(html.includes("非官方真题"), "Production start page must show non-official disclaimer");
});

test("production Paper start: shows AI synthesized audio disclosure", () => {
  const html = renderStartPage();
  assert.ok(html.includes("AI 合成语音"), "Production start page must show AI audio disclosure");
  assert.ok(html.includes("仅供学习练习使用"), "Production start page must show practice-only disclaimer");
});
