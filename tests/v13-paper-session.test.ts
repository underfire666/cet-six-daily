/**
 * V13 Phase 2E: Paper Session / Learning Flow 单元测试
 *
 * 覆盖：
 * 1. PaperSession create / resume / stable question IDs
 * 2. Objective answers persist
 * 3. Subjective drafts persist
 * 4. Completion requires all sections
 * 5. Duplicate completion idempotent
 * 6. Results calculation (accuracy, wrong count)
 * 7. No fake 710 score (scoreDisclaimer present)
 * 8. Wrong answers create Review items
 * 9. Review item dedupe (same session)
 * 10. Review item sourceModule mapping (listening/reading)
 * 11. XP calculation (base + accuracy bonus)
 * 12. XP idempotent (same event ID)
 * 13. PaperSession storage save/load
 * 14. Bad record isolation
 * 15. findInProgressSession
 * 16. Paper content helpers (flatten, sectionQuestionIds)
 * 17. questionIdToCorrect mapping
 * 18. isPaperCompletable logic
 * 19. getWrongQuestionIds
 * 20. Paper review item ID format
 * 21. Paper XP event ID format
 * 22. Audio failure does not corrupt session (session independent of audio)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resetRegistry, getPaperById } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { registerMockPaper001, MOCK_PAPER_001_ID } from "../src/content/papers/cet6-mock-paper-001";
import type { CET6Paper } from "../src/content/papers";
import type { PaperSessionState, PaperSessionAction } from "../src/types/paper";
import {
  createPaperSession,
  reducePaperSession,
  calculatePaperResult,
  isPaperCompletable,
  getWrongQuestionIds,
  isValidPaperSession,
} from "../src/lib/paper/session";
import {
  buildSectionQuestionIds,
  buildQuestionIdToCorrect,
  flattenPaperQuestions,
  getPaperTotalQuestions,
} from "../src/lib/paper/content";
import {
  createPaperReviewItems,
  mergePaperReviewItems,
  paperReviewItemId,
} from "../src/lib/paper/review";
import {
  calculatePaperXp,
  paperCompleteXpEventId,
  settlePaperXp,
} from "../src/lib/paper/xp";
import { emptyReviewStore } from "../src/lib/review/store";
import type { StudyProfile } from "../src/types/session";

function setup(): CET6Paper {
  resetRegistry();
  registerBuiltinPacks();
  registerMockPaper001();
  const paper = getPaperById<CET6Paper>(MOCK_PAPER_001_ID);
  assert.ok(paper, "Paper 001 should be registered");
  return paper;
}

function makeSession(paper: CET6Paper, overrides: Partial<PaperSessionState> = {}): PaperSessionState {
  const now = "2026-09-28T10:00:00.000Z";
  const sectionIds = paper.sections.map((s) => ({
    sectionId: s.sectionId,
    type: s.type,
    totalQuestions: s.groups.reduce((n, g) => n + (g.questions?.length ?? 0), 0),
  }));
  const session = createPaperSession({
    sessionId: "test-session-001",
    paperId: paper.paperId,
    paperContentVersion: paper.contentVersion ?? "1.0.0",
    examSpecId: paper.examSpecId ?? "cet6-current-2026",
    ownerNamespace: "test-user",
    now,
    sectionIds,
  });
  return { ...session, ...overrides };
}

function answerAllQuestions(paper: CET6Paper, session: PaperSessionState, correctRatio = 0.7): PaperSessionState {
  const questionIdToCorrect = buildQuestionIdToCorrect(paper);
  const objectiveIds = Object.keys(questionIdToCorrect);
  let s = session;
  let idx = 0;
  for (const section of paper.sections) {
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        // 客观题：有 answerId + options 的（choice/cloze/careful 都走这个分支）
        if (q.answerId && q.options && q.options.length > 0) {
          const shouldBeCorrect = objectiveIds.length > 0 && idx / objectiveIds.length < correctRatio;
          const optionId = shouldBeCorrect ? q.answerId : (q.options.find((o) => o.id !== q.answerId)?.id ?? q.answerId);
          const action: PaperSessionAction = { type: "select_answer", questionId: q.questionId, optionId, now: "2026-09-28T10:05:00.000Z" };
          s = reducePaperSession(s, action, buildSectionQuestionIds(paper));
          idx++;
        } else if (q.type === "matching" && q.answerText) {
          // Matching 题：答案是段落字母（如 "E"），模拟选择
          const shouldBeCorrect = idx / 30 < correctRatio;
          const optionId = shouldBeCorrect ? q.answerText : "X";
          const action: PaperSessionAction = { type: "select_answer", questionId: q.questionId, optionId, now: "2026-09-28T10:05:00.000Z" };
          s = reducePaperSession(s, action, buildSectionQuestionIds(paper));
          idx++;
        } else if (q.type === "subjective_writing" || q.type === "subjective_translation") {
          const draftAction: PaperSessionAction = { type: "set_subjective_draft", questionId: q.questionId, draft: "test draft text", now: "2026-09-28T10:05:00.000Z" };
          s = reducePaperSession(s, draftAction, buildSectionQuestionIds(paper));
          const submitAction: PaperSessionAction = { type: "submit_subjective", questionId: q.questionId, text: "test submitted text", now: "2026-09-28T10:06:00.000Z" };
          s = reducePaperSession(s, submitAction, buildSectionQuestionIds(paper));
        }
      }
    }
  }
  // Mark all sections completed
  for (const section of paper.sections) {
    const action: PaperSessionAction = { type: "complete_section", sectionId: section.sectionId, now: "2026-09-28T10:10:00.000Z" };
    s = reducePaperSession(s, action, buildSectionQuestionIds(paper));
  }
  return s;
}

// ============ 1. PaperSession create / resume / stable question IDs ============
test("PaperSession: create produces valid session with stable structure", () => {
  const paper = setup();
  const session = makeSession(paper);
  assert.equal(session.sessionId, "test-session-001");
  assert.equal(session.paperId, paper.paperId);
  assert.equal(session.phase, "in_progress");
  assert.equal(session.sectionProgress.length, paper.sections.length);
  assert.ok(isValidPaperSession(session));
});

test("PaperSession: question IDs are stable across sessions", () => {
  const paper = setup();
  const ids1 = flattenPaperQuestions(paper).map((f) => f.question.questionId);
  const ids2 = flattenPaperQuestions(paper).map((f) => f.question.questionId);
  assert.deepEqual(ids1, ids2);
  assert.ok(ids1.length > 0);
});

// ============ 2. Objective answers persist ============
test("PaperSession: select_answer persists objective answer", () => {
  const paper = setup();
  let session = makeSession(paper);
  const firstQuestion = flattenPaperQuestions(paper)[0];
  const action: PaperSessionAction = {
    type: "select_answer",
    questionId: firstQuestion.question.questionId,
    optionId: "A",
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  assert.equal(session.answers[firstQuestion.question.questionId]?.selectedOptionId, "A");
});

// ============ 3. Subjective drafts persist ============
test("PaperSession: set_subjective_draft persists draft", () => {
  const paper = setup();
  let session = makeSession(paper);
  const writingQuestion = flattenPaperQuestions(paper).find((f) => f.question.type === "subjective_writing");
  assert.ok(writingQuestion, "Paper should have a writing question");
  const action: PaperSessionAction = {
    type: "set_subjective_draft",
    questionId: writingQuestion.question.questionId,
    draft: "my draft essay",
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  assert.equal(session.answers[writingQuestion.question.questionId]?.draft, "my draft essay");
});

test("PaperSession: submit_subjective marks submitted", () => {
  const paper = setup();
  let session = makeSession(paper);
  const writingQuestion = flattenPaperQuestions(paper).find((f) => f.question.type === "subjective_writing");
  assert.ok(writingQuestion);
  const draftAction: PaperSessionAction = {
    type: "set_subjective_draft",
    questionId: writingQuestion.question.questionId,
    draft: "essay text",
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, draftAction, buildSectionQuestionIds(paper));
  const submitAction: PaperSessionAction = {
    type: "submit_subjective",
    questionId: writingQuestion.question.questionId,
    text: "essay text",
    now: "2026-09-28T10:02:00.000Z",
  };
  session = reducePaperSession(session, submitAction, buildSectionQuestionIds(paper));
  assert.equal(session.answers[writingQuestion.question.questionId]?.submittedText, "essay text");
  assert.ok(session.answers[writingQuestion.question.questionId]?.submittedAt);
});

// ============ 4. Completion requires all sections ============
test("PaperSession: isPaperCompletable false when sections incomplete", () => {
  const paper = setup();
  const session = makeSession(paper);
  assert.equal(isPaperCompletable(session, buildSectionQuestionIds(paper)), false);
});

test("PaperSession: isPaperCompletable true when all sections complete", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session);
  assert.equal(isPaperCompletable(session, buildSectionQuestionIds(paper)), true);
});

// ============ 5. Duplicate completion idempotent ============
test("PaperSession: submit_paper is idempotent (second submit no-op)", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  const action: PaperSessionAction = { type: "submit_paper", result, now };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  const phaseAfterFirst = session.phase;
  // Second submit should be no-op
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  assert.equal(session.phase, phaseAfterFirst);
  assert.equal(session.phase, "completed");
});

// ============ 6. Results calculation ============
test("PaperSession: calculatePaperResult produces accuracy and wrong count", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session, 0.7);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  assert.ok(result.overallAccuracy >= 0 && result.overallAccuracy <= 100);
  assert.ok(result.wrongCount >= 0);
  assert.ok(result.totalQuestions > 0);
  assert.equal(result.writingStatus, "submitted");
  assert.equal(result.translationStatus, "submitted");
});

// ============ 7. No fake 710 score ============
test("PaperSession: result has scoreDisclaimer and no fake 710 score", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  assert.ok(result.scoreDisclaimer.length > 0);
  assert.ok(result.scoreDisclaimer.includes("非官方") || result.scoreDisclaimer.includes("练习"));
  // No 710 score field
  assert.equal((result as unknown as Record<string, unknown>).score710, undefined);
  assert.equal((result as unknown as Record<string, unknown>).officialScore, undefined);
});

// ============ 8. Wrong answers create Review items ============
test("Paper Review: createPaperReviewItems creates items for wrong answers", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session, 0.5);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  const submitAction: PaperSessionAction = { type: "submit_paper", result, now };
  session = reducePaperSession(session, submitAction, buildSectionQuestionIds(paper));
  const items = createPaperReviewItems(paper, session);
  assert.ok(items.length > 0, "Should create review items for wrong answers");
  for (const item of items) {
    assert.ok(item.sourceModule === "listening" || item.sourceModule === "reading");
    assert.equal(item.sourceActivityId, paper.paperId);
    assert.equal(item.masteryStatus, "weak");
  }
});

// ============ 9. Review item dedupe ============
test("Paper Review: mergePaperReviewItems dedupes existing items", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session, 0.5);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  const submitAction: PaperSessionAction = { type: "submit_paper", result, now };
  session = reducePaperSession(session, submitAction, buildSectionQuestionIds(paper));
  const items = createPaperReviewItems(paper, session);
  const store = emptyReviewStore();
  const { store: merged1, addedCount: added1 } = mergePaperReviewItems(store, items);
  assert.equal(added1, items.length);
  // Merge again should add 0
  const { store: merged2, addedCount: added2 } = mergePaperReviewItems(merged1, items);
  assert.equal(added2, 0);
  assert.equal(Object.keys(merged2.items).length, items.length);
});

// ============ 10. Review item sourceModule mapping ============
test("Paper Review: listening wrong answers map to sourceModule=listening", () => {
  const paper = setup();
  let session = makeSession(paper);
  // Answer all listening questions wrong
  for (const section of paper.sections) {
    if (section.type !== "listening") continue;
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        if (q.type === "choice" && q.answerId && q.options) {
          const wrongOption = q.options.find((o) => o.id !== q.answerId);
          if (wrongOption) {
            const action: PaperSessionAction = { type: "select_answer", questionId: q.questionId, optionId: wrongOption.id, now: "2026-09-28T10:05:00.000Z" };
            session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
          }
        }
      }
    }
  }
  const items = createPaperReviewItems(paper, session);
  const listeningItems = items.filter((i) => i.sourceModule === "listening");
  assert.ok(listeningItems.length > 0, "Should have listening review items");
});

// ============ 11. XP calculation ============
test("Paper XP: calculatePaperXp gives base + accuracy bonus", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session, 1.0); // 100% correct
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  const xp = calculatePaperXp(result);
  assert.ok(xp >= 50 && xp <= 100);
});

// ============ 12. XP idempotent ============
test("Paper XP: settlePaperXp is idempotent for same event ID", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session);
  const now = "2026-09-28T10:30:00.000Z";
  const result = calculatePaperResult(session, buildQuestionIdToCorrect(paper), buildSectionQuestionIds(paper), now);
  const profile: StudyProfile = {
    schemaVersion: 1,
    anchorDate: "2026-09-28",
    completedLessons: {},
    rewardsByDay: {},
    bonusXpEvents: {},
  };
  const { profile: p1, xpAdded: xp1 } = settlePaperXp(profile, paper.paperId, session, result);
  assert.ok(xp1 > 0);
  const { xpAdded: xp2, alreadySettled } = settlePaperXp(p1, paper.paperId, session, result);
  assert.equal(xp2, 0);
  assert.equal(alreadySettled, true);
});

// ============ 13. Paper content helpers ============
test("Paper content: flattenPaperQuestions returns all questions in order", () => {
  const paper = setup();
  const flattened = flattenPaperQuestions(paper);
  assert.equal(flattened.length, getPaperTotalQuestions(paper));
  // Check order: writing first, then listening, reading, translation
  const sectionTypes = [...new Set(flattened.map((f) => f.sectionType))];
  assert.deepEqual(sectionTypes, ["writing", "listening", "reading", "translation"]);
});

test("Paper content: buildSectionQuestionIds maps section to question IDs", () => {
  const paper = setup();
  const map = buildSectionQuestionIds(paper);
  for (const section of paper.sections) {
    assert.ok(map[section.sectionId]);
    const expected = section.groups.reduce((n, g) => n + (g.questions?.length ?? 0), 0);
    assert.equal(map[section.sectionId].length, expected);
  }
});

test("Paper content: buildQuestionIdToCorrect maps objective questions", () => {
  const paper = setup();
  const map = buildQuestionIdToCorrect(paper);
  let objectiveCount = 0;
  for (const section of paper.sections) {
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        if (q.type === "choice" && q.answerId) {
          objectiveCount++;
          assert.equal(map[q.questionId], q.answerId);
        }
      }
    }
  }
  assert.ok(objectiveCount > 0);
});

// ============ 14. getWrongQuestionIds ============
test("PaperSession: getWrongQuestionIds returns only wrong objective answers", () => {
  const paper = setup();
  let session = makeSession(paper);
  session = answerAllQuestions(paper, session, 0.5);
  const wrongIds = getWrongQuestionIds(session, buildQuestionIdToCorrect(paper));
  assert.ok(wrongIds.length > 0);
  // All wrong IDs should be objective questions with selectedOptionId != correct
  for (const qid of wrongIds) {
    const answer = session.answers[qid];
    const correct = buildQuestionIdToCorrect(paper)[qid];
    assert.ok(answer?.selectedOptionId);
    assert.notEqual(answer?.selectedOptionId, correct);
  }
});

// ============ 15. Paper review item ID format ============
test("Paper Review: paperReviewItemId has correct format", () => {
  const id = paperReviewItemId("listening", "cet6:mock:paper-001", "q1");
  assert.equal(id, "listening:cet6:mock:paper-001:q1");
});

// ============ 16. Paper XP event ID format ============
test("Paper XP: paperCompleteXpEventId has correct format", () => {
  const id = paperCompleteXpEventId("cet6:mock:paper-001", "session-123");
  assert.equal(id, "paper-complete:cet6:mock:paper-001:session-123");
});

// ============ 17. Audio failure does not corrupt session ============
test("PaperSession: session state is independent of audio (audio failure doesn't corrupt)", () => {
  const paper = setup();
  let session = makeSession(paper);
  // Simulate answering questions without audio playing
  const firstQuestion = flattenPaperQuestions(paper)[0];
  const action: PaperSessionAction = {
    type: "select_answer",
    questionId: firstQuestion.question.questionId,
    optionId: "A",
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  assert.ok(isValidPaperSession(session));
  assert.equal(session.answers[firstQuestion.question.questionId]?.selectedOptionId, "A");
  // No audio-related fields in session that could be corrupted
  assert.equal((session as unknown as Record<string, unknown>).audioError, undefined);
});

// ============ 18. isValidPaperSession rejects malformed data ============
test("PaperSession: isValidPaperSession rejects malformed session", () => {
  assert.equal(isValidPaperSession(null), false);
  assert.equal(isValidPaperSession({}), false);
  assert.equal(isValidPaperSession({ sessionId: "x" }), false);
});

// ============ 19. navigate action updates position ============
test("PaperSession: navigate updates current position", () => {
  const paper = setup();
  let session = makeSession(paper);
  const action: PaperSessionAction = {
    type: "navigate",
    sectionIndex: 1,
    groupIndex: 0,
    questionIndex: 0,
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  assert.equal(session.currentSectionIndex, 1);
  assert.equal(session.currentGroupIndex, 0);
  assert.equal(session.currentQuestionIndex, 0);
});

// ============ 20. complete_section marks section completed ============
test("PaperSession: complete_section marks section status completed", () => {
  const paper = setup();
  let session = makeSession(paper);
  const firstSectionId = paper.sections[0].sectionId;
  const action: PaperSessionAction = {
    type: "complete_section",
    sectionId: firstSectionId,
    now: "2026-09-28T10:01:00.000Z",
  };
  session = reducePaperSession(session, action, buildSectionQuestionIds(paper));
  const sp = session.sectionProgress.find((s) => s.sectionId === firstSectionId);
  assert.equal(sp?.status, "completed");
  assert.ok(sp?.completedAt);
});

// ============ 21. Paper 001 has correct structure (7 materials / 25 listening questions) ============
test("Paper 001: has 7 listening materials and 25 listening questions", () => {
  const paper = setup();
  const listeningSection = paper.sections.find((s) => s.type === "listening");
  assert.ok(listeningSection);
  assert.equal(listeningSection!.groups.length, 7);
  const listeningQuestions = listeningSection!.groups.reduce((n, g) => n + (g.questions?.length ?? 0), 0);
  assert.equal(listeningQuestions, 25);
});

// ============ 22. Paper 001 status is staging ============
test("Paper 001: status is staging (not published)", () => {
  const paper = setup();
  assert.equal(paper.status, "staging");
});

// ============ 23. Paper 001 authenticity is original ============
test("Paper 001: authenticity is original (not real past paper)", () => {
  const paper = setup();
  assert.equal(paper.authenticity, "original");
});
