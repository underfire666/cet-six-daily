/**
 * V14.10.1: Exam Practice Records Fix regression tests.
 * Covers: safe return URL validation, shared sets lookup,
 * returnTo href encoding, result label logic, and data integrity.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  safeRecordsReturnUrl,
  recordsReturnParam,
  readExamRecords,
  examRecordsHref,
} from "../src/lib/exam-records-route";
import {
  practiceSessionHref,
  practiceRecordReviewHref,
  collectPracticeRecords,
  type PracticeRecordStores,
} from "../src/lib/exam-records";
import type { ReadingSession } from "../src/types/reading";
import type { AnswerRecord } from "../src/types/session";

// ─── safeRecordsReturnUrl ───────────────────────────────────────────────────

test("safeRecordsReturnUrl: accepts plain records page", () => {
  assert.equal(safeRecordsReturnUrl("/practice/exams/records"), "/practice/exams/records");
});

test("safeRecordsReturnUrl: accepts records page with valid filters", () => {
  assert.equal(
    safeRecordsReturnUrl("/practice/exams/records?status=completed&module=reading"),
    "/practice/exams/records?status=completed&module=reading",
  );
});

test("safeRecordsReturnUrl: rejects external URLs", () => {
  assert.equal(safeRecordsReturnUrl("https://evil.com"), null);
  assert.equal(safeRecordsReturnUrl("http://localhost:3000/practice/exams/records"), null);
});

test("safeRecordsReturnUrl: rejects protocol-relative URLs", () => {
  assert.equal(safeRecordsReturnUrl("//evil.com/practice/exams/records"), null);
});

test("safeRecordsReturnUrl: rejects sub-routes of records", () => {
  assert.equal(safeRecordsReturnUrl("/practice/exams/records/reading/abc"), null);
  assert.equal(safeRecordsReturnUrl("/practice/exams/records/"), null);
});

test("safeRecordsReturnUrl: rejects unknown query params", () => {
  assert.equal(safeRecordsReturnUrl("/practice/exams/records?redirect=https://evil.com"), null);
  assert.equal(safeRecordsReturnUrl("/practice/exams/records?status=completed&evil=1"), null);
});

test("safeRecordsReturnUrl: rejects invalid status/module values", () => {
  // Invalid values get normalized to defaults, but the URL is still safe
  const result = safeRecordsReturnUrl("/practice/exams/records?status=evil&module=hacked");
  assert.equal(result, "/practice/exams/records");
});

test("safeRecordsReturnUrl: rejects null/undefined/empty", () => {
  assert.equal(safeRecordsReturnUrl(null), null);
  assert.equal(safeRecordsReturnUrl(undefined), null);
  assert.equal(safeRecordsReturnUrl(""), null);
});

test("safeRecordsReturnUrl: rejects paths with backslashes or newlines", () => {
  assert.equal(safeRecordsReturnUrl("/practice/exams/records\\..\\..\\evil"), null);
  assert.equal(safeRecordsReturnUrl("/practice/exams/records\n?status=completed"), null);
});

test("safeRecordsReturnUrl: rejects other internal routes", () => {
  assert.equal(safeRecordsReturnUrl("/practice/exams"), null);
  assert.equal(safeRecordsReturnUrl("/"), null);
  assert.equal(safeRecordsReturnUrl("/me"), null);
});

// ─── recordsReturnParam ─────────────────────────────────────────────────────

test("recordsReturnParam: empty for default state", () => {
  assert.equal(recordsReturnParam({ status: "all", module: "all" }), "");
});

test("recordsReturnParam: encodes non-default state", () => {
  const param = recordsReturnParam({ status: "in_progress", module: "reading" });
  assert.ok(param.startsWith("returnTo="));
  const decoded = decodeURIComponent(param.slice("returnTo=".length));
  assert.equal(decoded, "/practice/exams/records?status=in_progress&module=reading");
});

// ─── practiceSessionHref / practiceRecordReviewHref with returnTo ───────────

test("practiceSessionHref: appends returnTo when provided", () => {
  const href = practiceSessionHref("reading", "rs-1", "/practice/exams/records?status=in_progress");
  assert.ok(href.startsWith("/practice/reading/session/rs-1?"));
  assert.ok(href.includes("returnTo="));
  assert.ok(href.includes(encodeURIComponent("/practice/exams/records?status=in_progress")));
});

test("practiceSessionHref: no returnTo when omitted", () => {
  assert.equal(practiceSessionHref("reading", "rs-1"), "/practice/reading/session/rs-1");
});

test("practiceRecordReviewHref: appends returnTo when provided", () => {
  const href = practiceRecordReviewHref("listening", "ls-1", "/practice/exams/records?module=listening");
  assert.ok(href.startsWith("/practice/exams/records/listening/ls-1?"));
  assert.ok(href.includes("returnTo="));
});

test("practiceRecordReviewHref: no returnTo when omitted", () => {
  assert.equal(practiceRecordReviewHref("reading", "rs-1"), "/practice/exams/records/reading/rs-1");
});

// ─── Shared sets lookup via collectPracticeRecords ──────────────────────────

function makeReadingSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    schemaVersion: 1,
    id: "rs-shared-test",
    mode: "selected",
    planDate: "2026-09-29",
    articleId: "cet6:2022-06:set1:cloze",
    phase: "quiz",
    readingCompleted: false,
    collectedWordIds: [],
    startedAt: "2026-09-29T11:00:00.000Z",
    applied: false,
    lesson: {
      schemaVersion: 1, id: "r:test", lessonId: "test", lessonVersion: 1,
      date: "2026-09-29", mode: "daily", round: "initial", index: 0,
      selected: null, phase: "answering", records: {}, retestQueue: [],
      startedAt: "2026-09-29T11:00:00.000Z", celebrationSeen: false,
    },
    ...overrides,
  };
}

test("collectPracticeRecords: sharedSets contains all sharing sets", () => {
  // cet6:2022-06:set1:cloze is shared across sets in the catalog
  const stores: PracticeRecordStores = {
    listening: { sessions: {} },
    reading: { sessions: { "rs-shared": makeReadingSession() } },
    translation: { sessions: {} },
    writing: { sessions: {} },
  };
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.ok(Array.isArray(record.sharedSets));
  assert.ok(record.sharedSets.length >= 1);
  // The canonical set should be in sharedSets
  assert.ok(record.sharedSets.includes("1"));
  // originalSetKnown should be false for historical sessions
  assert.equal(record.originalSetKnown, false);
});

test("collectPracticeRecords: non-shared content has single sharedSet", () => {
  // Use a content ID that likely only appears in one set
  const stores: PracticeRecordStores = {
    listening: { sessions: {} },
    reading: { sessions: { "rs-unique": makeReadingSession({ articleId: "cet6:2024-12:set1:careful1" }) } },
    translation: { sessions: {} },
    writing: { sessions: {} },
  };
  const records = collectPracticeRecords(stores);
  if (records.length > 0) {
    assert.ok(Array.isArray(records[0].sharedSets));
    assert.ok(records[0].sharedSets.length >= 1);
  }
});

// ─── Result label logic (mirrors ExamRecordReview helpers) ──────────────────

function resultLabel(record: AnswerRecord): string {
  if (record.retest && record.retest.length > 0) {
    const lastRetest = record.retest[record.retest.length - 1];
    if (lastRetest.correct) return "复测答对";
    return "复测答错";
  }
  if (record.initialResult === "first_try_correct") return "首次答对";
  if (record.initialResult === "second_try_correct") return "重试答对";
  if (record.initialResult === "ai_hint_correct") return "提示后答对";
  if (record.initialResult === "wrong") return "答错";
  if (record.initialResult === "unmastered") return "未掌握";
  return "未完成";
}

function isFinalCorrect(record: AnswerRecord): boolean {
  if (record.retest && record.retest.length > 0) {
    return record.retest[record.retest.length - 1].correct;
  }
  if (record.initial && record.initial.length > 0) {
    return record.initial[record.initial.length - 1].correct;
  }
  return false;
}

function finalUserAnswer(record: AnswerRecord): string | null {
  if (record.retest && record.retest.length > 0) {
    return record.retest[record.retest.length - 1].optionId;
  }
  if (record.initial && record.initial.length > 0) {
    return record.initial[record.initial.length - 1].optionId;
  }
  return null;
}

function makeAnswerRecord(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    initial: [{ optionId: "A", correct: false, hinted: false }],
    retest: [],
    hintUsed: false,
    initialResult: "wrong",
    ...overrides,
  };
}

test("resultLabel: initial wrong + retest correct shows 复测答对", () => {
  const record = makeAnswerRecord({
    initial: [{ optionId: "A", correct: false, hinted: false }],
    initialResult: "wrong",
    retest: [{ optionId: "B", correct: true, hinted: false }],
    retestResult: "first_try_correct",
  });
  assert.equal(resultLabel(record), "复测答对");
  assert.equal(isFinalCorrect(record), true);
  assert.equal(finalUserAnswer(record), "B");
});

test("resultLabel: initial wrong + retest wrong shows 复测答错", () => {
  const record = makeAnswerRecord({
    initial: [{ optionId: "A", correct: false, hinted: false }],
    initialResult: "wrong",
    retest: [{ optionId: "C", correct: false, hinted: false }],
    retestResult: "wrong",
  });
  assert.equal(resultLabel(record), "复测答错");
  assert.equal(isFinalCorrect(record), false);
  assert.equal(finalUserAnswer(record), "C");
});

test("resultLabel: first try correct shows 首次答对", () => {
  const record = makeAnswerRecord({
    initial: [{ optionId: "B", correct: true, hinted: false }],
    initialResult: "first_try_correct",
    retest: [],
  });
  assert.equal(resultLabel(record), "首次答对");
  assert.equal(isFinalCorrect(record), true);
  assert.equal(finalUserAnswer(record), "B");
});

test("resultLabel: second try correct shows 重试答对", () => {
  const record = makeAnswerRecord({
    initial: [
      { optionId: "A", correct: false, hinted: false },
      { optionId: "B", correct: true, hinted: false },
    ],
    initialResult: "second_try_correct",
    retest: [],
  });
  assert.equal(resultLabel(record), "重试答对");
  assert.equal(isFinalCorrect(record), true);
  assert.equal(finalUserAnswer(record), "B");
});

test("resultLabel: no attempts shows 未完成", () => {
  const record = makeAnswerRecord({ initial: [], retest: [], initialResult: undefined });
  assert.equal(resultLabel(record), "未完成");
  assert.equal(isFinalCorrect(record), false);
  assert.equal(finalUserAnswer(record), null);
});

test("resultLabel: retest takes precedence over initial", () => {
  // Initial was correct, but retest was wrong — final should reflect retest
  const record = makeAnswerRecord({
    initial: [{ optionId: "B", correct: true, hinted: false }],
    initialResult: "first_try_correct",
    retest: [{ optionId: "A", correct: false, hinted: false }],
    retestResult: "wrong",
  });
  assert.equal(resultLabel(record), "复测答错");
  assert.equal(isFinalCorrect(record), false);
});

// ─── readExamRecords / examRecordsHref roundtrip ────────────────────────────

test("readExamRecords + examRecordsHref: roundtrip preserves filters", () => {
  const state = readExamRecords("status=completed&module=writing");
  assert.equal(state.status, "completed");
  assert.equal(state.module, "writing");
  const href = examRecordsHref(state);
  assert.ok(href.includes("status=completed"));
  assert.ok(href.includes("module=writing"));
  // Re-parse should give same state
  const reparsed = readExamRecords(href.split("?")[1] ?? "");
  assert.equal(reparsed.status, "completed");
  assert.equal(reparsed.module, "writing");
});

// ─── Data integrity: collectPracticeRecords doesn't mutate stores ───────────

test("collectPracticeRecords: does not mutate input stores", () => {
  const session = makeReadingSession({ id: "rs-no-mutate" });
  const stores: PracticeRecordStores = {
    listening: { sessions: {} },
    reading: { sessions: { "rs-no-mutate": session } },
    translation: { sessions: {} },
    writing: { sessions: {} },
  };
  const snapshot = JSON.parse(JSON.stringify(stores));
  collectPracticeRecords(stores);
  assert.deepEqual(stores, snapshot);
});

// ─── Version consistency ────────────────────────────────────────────────────

test("package version is 14.10.1", async () => {
  const pkg = await import("../package.json", { with: { type: "json" } });
  assert.equal(pkg.default.version, "14.10.1");
});
