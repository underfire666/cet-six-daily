/**
 * V14.10.0: Exam Practice Records & Review tests.
 * Tests the aggregation layer that collects selected-mode sessions
 * from all four module stores and the filtering/sorting logic.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPracticeRecords,
  filterRecords,
  sortRecords,
  formatShanghaiTime,
  moduleLabel,
  practiceSessionHref,
  practiceRecordReviewHref,
  type PracticeRecord,
  type PracticeRecordStores,
} from "../src/lib/exam-records";
import { readExamRecords, examRecordsHref } from "../src/lib/exam-records-route";
import type { ListeningSession } from "../src/types/listening";
import type { ReadingSession } from "../src/types/reading";
import type { TranslationSession } from "../src/types/translation";
import type { WritingSession } from "../src/types/writing";

function makeListeningSession(overrides: Partial<ListeningSession> = {}): ListeningSession {
  return {
    schemaVersion: 1,
    id: "ls-1",
    mode: "selected",
    planDate: "2026-09-29",
    materialId: "cet6-2024-06-1-listening-1",
    phase: "question",
    listeningCompleted: false,
    playCount: 1,
    rate: 1.0,
    transcriptViewedBeforeAnswer: false,
    collectedWordIds: [],
    startedAt: "2026-09-29T10:00:00.000Z",
    applied: false,
    lesson: {
      schemaVersion: 1, id: "l:test", lessonId: "test", lessonVersion: 1,
      date: "2026-09-29", mode: "daily", round: "initial", index: 0,
      selected: null, phase: "answering", records: {}, retestQueue: [],
      startedAt: "2026-09-29T10:00:00.000Z", celebrationSeen: false,
    },
    ...overrides,
  };
}

function makeReadingSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    schemaVersion: 1,
    id: "rs-1",
    mode: "selected",
    planDate: "2026-09-29",
    articleId: "cet6-2024-06-1-reading-careful1",
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

function makeTranslationSession(overrides: Partial<TranslationSession> = {}): TranslationSession {
  return {
    schemaVersion: 1,
    id: "ts-1",
    mode: "selected",
    planDate: "2026-09-29",
    taskId: "cet6-2024-06-1-translation",
    phase: "drafting",
    draft: "test draft",
    startedAt: "2026-09-29T12:00:00.000Z",
    applied: false,
    ...overrides,
  };
}

function makeWritingSession(overrides: Partial<WritingSession> = {}): WritingSession {
  return {
    schemaVersion: 1,
    id: "ws-1",
    mode: "selected",
    planDate: "2026-09-29",
    taskId: "cet6-2024-06-1-writing",
    phase: "drafting",
    draft: "test writing",
    startedAt: "2026-09-29T13:00:00.000Z",
    applied: false,
    ...overrides,
  };
}

function makeStores(partial: Partial<PracticeRecordStores> = {}): PracticeRecordStores {
  return {
    listening: { sessions: {} },
    reading: { sessions: {} },
    translation: { sessions: {} },
    writing: { sessions: {} },
    ...partial,
  };
}

test("collectPracticeRecords: collects selected sessions from all four modules", () => {
  const stores = makeStores({
    listening: { sessions: { "ls-1": makeListeningSession() } },
    reading: { sessions: { "rs-1": makeReadingSession() } },
    translation: { sessions: { "ts-1": makeTranslationSession() } },
    writing: { sessions: { "ws-1": makeWritingSession() } },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 4);
  const modules = new Set(records.map((r) => r.module));
  assert.deepEqual(modules, new Set(["listening", "reading", "translation", "writing"]));
});

test("collectPracticeRecords: ignores non-selected sessions (daily/extra)", () => {
  const stores = makeStores({
    listening: {
      sessions: {
        "ls-daily": makeListeningSession({ id: "ls-daily", mode: "daily" }),
        "ls-extra": makeListeningSession({ id: "ls-extra", mode: "extra" }),
        "ls-selected": makeListeningSession({ id: "ls-selected" }),
      },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 1);
  assert.equal(records[0].sessionId, "ls-selected");
});

test("collectPracticeRecords: completed sessions have status completed and xp", () => {
  const stores = makeStores({
    reading: {
      sessions: {
        "rs-done": makeReadingSession({
          id: "rs-done",
          phase: "complete",
          completedAt: "2026-09-29T11:30:00.000Z",
          applied: true,
          rewardXp: 15,
        }),
      },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "completed");
  assert.equal(records[0].xp, 15);
  assert.equal(records[0].completedAt, "2026-09-29T11:30:00.000Z");
});

test("collectPracticeRecords: unfinished sessions have status in_progress", () => {
  const stores = makeStores({
    translation: { sessions: { "ts-1": makeTranslationSession({ phase: "drafting" }) } },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records[0].status, "in_progress");
  assert.equal(records[0].xp, null);
});

test("collectPracticeRecords: multiple sessions for same content keep independent records", () => {
  const stores = makeStores({
    reading: {
      sessions: {
        "rs-1": makeReadingSession({ id: "rs-1", startedAt: "2026-09-29T10:00:00.000Z" }),
        "rs-2": makeReadingSession({ id: "rs-2", startedAt: "2026-09-30T10:00:00.000Z" }),
      },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 2);
  assert.notEqual(records[0].sessionId, records[1].sessionId);
});

test("collectPracticeRecords: sessions with unknown contentId get null exam metadata", () => {
  const stores = makeStores({
    listening: {
      sessions: { "ls-unknown": makeListeningSession({ id: "ls-unknown", materialId: "unknown-id-123" }) },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records.length, 1);
  assert.equal(records[0].examId, null);
  assert.equal(records[0].examTitle, null);
});

test("filterRecords: filters by status", () => {
  const records: PracticeRecord[] = [
    { sessionId: "a", module: "reading", contentId: "c1", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "quiz", startedAt: "2026-09-29T10:00:00Z", completedAt: null, xp: null, questionCount: 5, answeredCount: 2 },
    { sessionId: "b", module: "reading", contentId: "c2", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "completed", phase: "complete", startedAt: "2026-09-28T10:00:00Z", completedAt: "2026-09-28T10:30:00Z", xp: 10, questionCount: 5, answeredCount: 5 },
  ];
  assert.equal(filterRecords(records, "in_progress", "all").length, 1);
  assert.equal(filterRecords(records, "completed", "all").length, 1);
  assert.equal(filterRecords(records, "all", "all").length, 2);
});

test("filterRecords: filters by module", () => {
  const records: PracticeRecord[] = [
    { sessionId: "a", module: "reading", contentId: "c1", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "quiz", startedAt: "2026-09-29T10:00:00Z", completedAt: null, xp: null, questionCount: 5, answeredCount: 2 },
    { sessionId: "b", module: "listening", contentId: "c2", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "question", startedAt: "2026-09-29T11:00:00Z", completedAt: null, xp: null, questionCount: 3, answeredCount: 1 },
  ];
  assert.equal(filterRecords(records, "all", "reading").length, 1);
  assert.equal(filterRecords(records, "all", "listening").length, 1);
  assert.equal(filterRecords(records, "all", "translation").length, 0);
});

test("sortRecords: in_progress sorted by startedAt desc, completed by completedAt desc", () => {
  const records: PracticeRecord[] = [
    { sessionId: "old-complete", module: "reading", contentId: "c1", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "completed", phase: "complete", startedAt: "2026-09-27T10:00:00Z", completedAt: "2026-09-27T10:30:00Z", xp: 10, questionCount: 5, answeredCount: 5 },
    { sessionId: "new-inprogress", module: "reading", contentId: "c2", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "quiz", startedAt: "2026-09-29T10:00:00Z", completedAt: null, xp: null, questionCount: 5, answeredCount: 2 },
    { sessionId: "new-complete", module: "reading", contentId: "c3", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "completed", phase: "complete", startedAt: "2026-09-28T10:00:00Z", completedAt: "2026-09-28T10:30:00Z", xp: 10, questionCount: 5, answeredCount: 5 },
    { sessionId: "old-inprogress", module: "reading", contentId: "c4", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "quiz", startedAt: "2026-09-28T10:00:00Z", completedAt: null, xp: null, questionCount: 5, answeredCount: 1 },
  ];
  const sorted = sortRecords(records);
  assert.equal(sorted[0].sessionId, "new-inprogress");
  assert.equal(sorted[1].sessionId, "old-inprogress");
  assert.equal(sorted[2].sessionId, "new-complete");
  assert.equal(sorted[3].sessionId, "old-complete");
});

test("sortRecords: in_progress always comes before completed", () => {
  const records: PracticeRecord[] = [
    { sessionId: "complete", module: "reading", contentId: "c1", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "completed", phase: "complete", startedAt: "2026-09-30T10:00:00Z", completedAt: "2026-09-30T10:30:00Z", xp: 10, questionCount: 5, answeredCount: 5 },
    { sessionId: "inprogress", module: "reading", contentId: "c2", examId: null, examYear: null, examPeriod: null, examSet: null, examTitle: null, exerciseTitle: null, sharedWith: null, status: "in_progress", phase: "quiz", startedAt: "2026-09-01T10:00:00Z", completedAt: null, xp: null, questionCount: 5, answeredCount: 2 },
  ];
  const sorted = sortRecords(records);
  assert.equal(sorted[0].sessionId, "inprogress");
  assert.equal(sorted[1].sessionId, "complete");
});

test("formatShanghaiTime: formats ISO string in Shanghai timezone", () => {
  const result = formatShanghaiTime("2026-09-29T10:00:00.000Z");
  assert.ok(result.includes("2026"));
  assert.ok(result.length > 5);
});

test("formatShanghaiTime: returns dash for null", () => {
  assert.equal(formatShanghaiTime(null), "—");
});

test("moduleLabel: returns correct Chinese labels", () => {
  assert.equal(moduleLabel("listening"), "听力");
  assert.equal(moduleLabel("reading"), "阅读");
  assert.equal(moduleLabel("translation"), "翻译");
  assert.equal(moduleLabel("writing"), "写作");
});

test("practiceSessionHref: generates correct session URL", () => {
  assert.equal(practiceSessionHref("reading", "rs-123"), "/practice/reading/session/rs-123");
  assert.equal(practiceSessionHref("listening", "ls-456"), "/practice/listening/session/ls-456");
});

test("practiceRecordReviewHref: generates correct review URL", () => {
  assert.equal(practiceRecordReviewHref("reading", "rs-123"), "/practice/exams/records/reading/rs-123");
});

test("readExamRecords: parses valid query params", () => {
  const state = readExamRecords("status=completed&module=reading");
  assert.equal(state.status, "completed");
  assert.equal(state.module, "reading");
});

test("readExamRecords: defaults to all for invalid params", () => {
  const state = readExamRecords("status=invalid&module=invalid");
  assert.equal(state.status, "all");
  assert.equal(state.module, "all");
});

test("readExamRecords: empty search returns defaults", () => {
  const state = readExamRecords("");
  assert.equal(state.status, "all");
  assert.equal(state.module, "all");
});

test("examRecordsHref: generates URL with filters", () => {
  const href = examRecordsHref({ status: "in_progress", module: "listening" });
  assert.ok(href.includes("status=in_progress"));
  assert.ok(href.includes("module=listening"));
  assert.ok(href.startsWith("/practice/exams/records"));
});

test("examRecordsHref: omits default all values", () => {
  const href = examRecordsHref({ status: "all", module: "all" });
  assert.equal(href, "/practice/exams/records");
});

test("collectPracticeRecords: answeredCount counts answered questions for objective modules", () => {
  const stores = makeStores({
    reading: {
      sessions: {
        "rs-1": makeReadingSession({
          lesson: {
            schemaVersion: 1, id: "r:test", lessonId: "test", lessonVersion: 1,
            date: "2026-09-29", mode: "daily", round: "initial", index: 0,
            selected: null, phase: "answering",
            records: {
              "q1": { initial: [{ optionId: "A", correct: true, hinted: false }], retest: [], hintUsed: false },
              "q2": { initial: [], retest: [], hintUsed: false },
            },
            retestQueue: [],
            startedAt: "2026-09-29T11:00:00.000Z", celebrationSeen: false,
          },
        }),
      },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records[0].answeredCount, 1);
});

test("collectPracticeRecords: empty stores returns empty array", () => {
  const records = collectPracticeRecords(makeStores());
  assert.equal(records.length, 0);
});

test("collectPracticeRecords: completed but not applied session has null xp", () => {
  const stores = makeStores({
    writing: {
      sessions: {
        "ws-1": makeWritingSession({ phase: "complete", completedAt: "2026-09-29T13:30:00Z", applied: false, rewardXp: 20 }),
      },
    },
  });
  const records = collectPracticeRecords(stores);
  assert.equal(records[0].xp, null);
  assert.equal(records[0].status, "completed");
});
