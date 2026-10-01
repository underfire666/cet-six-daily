import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPrivatePaperReadiness,
  scorePrivateAnswers,
  computePrivateContentHash,
  countValidAnswers,
} from "../src/lib/private-papers/readiness";
import {
  loadStudyProgress,
  saveStudyProgress,
  clearStudyProgress,
  getProgressStatusMessage,
} from "../src/lib/private-papers/progress-storage";
import { PRIVATE_STUDY_PROGRESS_VERSION } from "../src/lib/private-papers/readiness";

function makeValidContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    isPartial: false,
    sections: [
      {
        sectionId: "reading-1",
        type: "reading",
        order: 0,
        groups: [
          {
            groupId: "careful-1",
            type: "careful_reading",
            order: 0,
            passage: "This is a test passage about artificial intelligence.",
            questions: [
              {
                questionId: "q1",
                order: 0,
                prompt: "What is the main topic?",
                type: "choice",
                options: [
                  { id: "A", text: "AI" },
                  { id: "B", text: "Biology" },
                  { id: "C", text: "Chemistry" },
                  { id: "D", text: "Physics" },
                ],
                answerId: "A",
                shortExplanation: "The passage discusses AI.",
              },
              {
                questionId: "q2",
                order: 1,
                prompt: "How many options does each question have?",
                type: "choice",
                options: [
                  { id: "A", text: "2" },
                  { id: "B", text: "3" },
                  { id: "C", text: "4" },
                  { id: "D", text: "5" },
                ],
                answerId: "C",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

// === Readiness: valid content ===

test("1. valid reading/careful_reading/choice content → ready", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  assert.equal(result.ready, true);
  assert.equal(result.questions.length, 2);
  assert.equal(result.reason, undefined);
});

test("2. flat questions have correct structure and ordering", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  assert.equal(result.ready, true);
  const [q1, q2] = result.questions;
  assert.equal(q1.index, 0);
  assert.equal(q1.questionId, "q1");
  assert.equal(q1.prompt, "What is the main topic?");
  assert.equal(q1.options.length, 4);
  assert.equal(q1.answerId, "A");
  assert.equal(q1.passage, "This is a test passage about artificial intelligence.");
  assert.equal(q2.index, 1);
  assert.equal(q2.questionId, "q2");
  assert.equal(q2.answerId, "C");
});

// === Readiness: isPartial ===

test("3. isPartial=true → not ready with specific reason", () => {
  const result = checkPrivatePaperReadiness(makeValidContent({ isPartial: true }));
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("草稿"));
  assert.equal(result.questions.length, 0);
});

// === Readiness: sections ===

test("4. no sections → not ready", () => {
  const result = checkPrivatePaperReadiness(makeValidContent({ sections: [] }));
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("section"));
});

test("5. sections not array → not ready", () => {
  const result = checkPrivatePaperReadiness(makeValidContent({ sections: "not-array" }));
  assert.equal(result.ready, false);
});

test("6. non-reading section → not ready", () => {
  const content = makeValidContent();
  (content.sections as Record<string, unknown>[])[0].type = "writing";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.equal(result.ready, false);
});

test("7. listening section → not ready", () => {
  const content = makeValidContent();
  (content.sections as Record<string, unknown>[])[0].type = "listening";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.equal(result.ready, false);
});

// === Readiness: groups ===

test("8. non-careful_reading group → not ready", () => {
  const content = makeValidContent();
  const groups = (content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[];
  groups[0].type = "cloze";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("careful_reading"));
});

test("9. matching group → not ready", () => {
  const content = makeValidContent();
  const groups = (content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[];
  groups[0].type = "matching";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("10. group with questionRefs → not ready", () => {
  const content = makeValidContent();
  const groups = (content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[];
  groups[0].questionRefs = [{ contentId: "some-item", order: 0 }];
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("questionRefs"));
});

test("11. group with assetIds → not ready", () => {
  const content = makeValidContent();
  const groups = (content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[];
  groups[0].assetIds = ["audio-1"];
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.equal(result.ready, false);
});

test("12. group with no questions → not ready", () => {
  const content = makeValidContent();
  const groups = (content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[];
  groups[0].questions = [];
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("题目"));
});

// === Readiness: questions ===

test("13. non-choice question → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].type = "cloze";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("choice"));
});

test("14. subjective_writing question → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].type = "subjective_writing";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("15. question with fewer than 2 options → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].options = [{ id: "A", text: "Only one" }];
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("选项"));
});

test("16. question with no options → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].options = undefined;
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("17. question missing answerId → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].answerId = undefined;
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("答案"));
});

test("18. question answerId not in options → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].answerId = "Z";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.equal(result.ready, false);
});

test("19. question missing prompt → not ready", () => {
  const content = makeValidContent();
  const questions = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  questions[0].prompt = "";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("题干"));
});

// === Scoring ===

test("20. all correct → 100%", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const questions = result.questions;
  const answers: Record<number, string> = { 0: "A", 1: "C" };
  const score = scorePrivateAnswers(questions, answers);
  assert.equal(score.correct, 2);
  assert.equal(score.total, 2);
  assert.equal(score.accuracy, 100);
});

test("21. all wrong → 0%", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const questions = result.questions;
  const answers: Record<number, string> = { 0: "B", 1: "A" };
  const score = scorePrivateAnswers(questions, answers);
  assert.equal(score.correct, 0);
  assert.equal(score.accuracy, 0);
});

test("22. partial correct → 50%", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const questions = result.questions;
  const answers: Record<number, string> = { 0: "A", 1: "A" };
  const score = scorePrivateAnswers(questions, answers);
  assert.equal(score.correct, 1);
  assert.equal(score.accuracy, 50);
});

test("23. unanswered → 0%", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const questions = result.questions;
  const score = scorePrivateAnswers(questions, {});
  assert.equal(score.correct, 0);
  assert.equal(score.accuracy, 0);
});

test("24. extra answers don't affect score", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const questions = result.questions;
  const answers: Record<number, string> = { 0: "A", 1: "C", 99: "X" };
  const score = scorePrivateAnswers(questions, answers);
  assert.equal(score.correct, 2);
  assert.equal(score.accuracy, 100);
});

// === Content hash ===

test("25. same content → same hash", () => {
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  assert.equal(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("26. different answerId → different hash", () => {
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const q2 = ((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  q2[1].answerId = "D";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("27. different prompt → different hash", () => {
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const q2 = ((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  q2[0].prompt = "Different question?";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("28. title change does NOT affect hash", () => {
  const c1 = makeValidContent({ title: "Title A" });
  const c2 = makeValidContent({ title: "Title B" });
  assert.equal(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("29. explanation change does NOT affect hash", () => {
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const q2 = ((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[];
  q2[0].shortExplanation = "Different explanation.";
  assert.equal(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

// === Multiple sections/groups ===

test("30. multiple careful_reading groups → ready with correct ordering", () => {
  const content = makeValidContent();
  const section = (content.sections as Record<string, unknown>[])[0];
  const groups = section.groups as Record<string, unknown>[];
  groups.push({
    groupId: "careful-2",
    type: "careful_reading",
    order: 1,
    passage: "Second passage.",
    questions: [
      {
        questionId: "q3",
        order: 0,
        prompt: "Third question?",
        type: "choice",
        options: [{ id: "A", text: "Yes" }, { id: "B", text: "No" }],
        answerId: "B",
      },
    ],
  });
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, true);
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[2].questionId, "q3");
  assert.equal(result.questions[2].index, 2);
});

test("31. mixed supported + unsupported group → not ready (no silent skip)", () => {
  const content = makeValidContent();
  const section = (content.sections as Record<string, unknown>[])[0];
  const groups = section.groups as Record<string, unknown>[];
  groups.push({
    groupId: "cloze-1",
    type: "cloze",
    order: 1,
    questions: [],
  });
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("careful_reading"));
});

// === Edge cases ===

test("32. empty content object → not ready", () => {
  const result = checkPrivatePaperReadiness({});
  assert.equal(result.ready, false);
});

test("33. content with malformed section → not ready", () => {
  const result = checkPrivatePaperReadiness({ isPartial: false, sections: ["not-an-object"] });
  assert.equal(result.ready, false);
});

test("34. readiness result always includes contentHash", () => {
  const r1 = checkPrivatePaperReadiness(makeValidContent());
  const r2 = checkPrivatePaperReadiness({ isPartial: true });
  assert.ok(typeof r1.contentHash === "string");
  assert.ok(r1.contentHash.length > 0);
  assert.ok(typeof r2.contentHash === "string");
});

test("35. flat question preserves sectionId and groupId", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const q = result.questions[0];
  assert.equal(q.sectionId, "reading-1");
  assert.equal(q.groupId, "careful-1");
  assert.equal(q.sectionOrder, 0);
  assert.equal(q.groupOrder, 0);
});

// === Hardening: content hash long text ===

test("36. long passage change at position 200+ → different hash", () => {
  const longPrefix = "A".repeat(250);
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const g1 = ((c1.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0];
  const g2 = ((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0];
  g1.passage = longPrefix + "version1";
  g2.passage = longPrefix + "version2";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("37. long prompt change at position 200+ → different hash", () => {
  const longPrefix = "Q".repeat(250);
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const qs1 = (((c1.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[]);
  const qs2 = (((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[]);
  qs1[0].prompt = longPrefix + "old";
  qs2[0].prompt = longPrefix + "new";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("38. long option text change at position 100+ → different hash", () => {
  const longPrefix = "O".repeat(150);
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const opts1 = ((((c1.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[])[0].options as Record<string, unknown>[]);
  const opts2 = ((((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[])[0].options as Record<string, unknown>[]);
  opts1[0].text = longPrefix + "old";
  opts2[0].text = longPrefix + "new";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

test("39. hash uses v2 prefix (FNV-1a 64-bit)", () => {
  const h = computePrivateContentHash(makeValidContent());
  assert.ok(h.startsWith("v2:"));
  assert.equal(h.length, 19); // "v2:" + 16 hex chars
});

test("40. answer change → different hash", () => {
  const c1 = makeValidContent();
  const c2 = makeValidContent();
  const qs = (((c2.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[]);
  qs[0].answerId = "B";
  assert.notEqual(computePrivateContentHash(c1), computePrivateContentHash(c2));
});

// === Hardening: order sorting ===

test("41. reverse array order with correct order field → sorted by order", () => {
  const content = makeValidContent();
  const qs = (((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[]);
  // Swap array order but keep order fields: q1 has order=0, q2 has order=1
  // Put q2 (order=1) first in array, q1 (order=0) second
  const q2 = qs[1];
  const q1 = qs[0];
  qs[0] = { ...q2, order: 1 };
  qs[1] = { ...q1, order: 0 };
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, true);
  assert.equal(result.questions[0].questionId, "q1"); // order=0 comes first
  assert.equal(result.questions[1].questionId, "q2"); // order=1 comes second
  assert.equal(result.questions[0].index, 0);
  assert.equal(result.questions[1].index, 1);
});

test("42. multiple sections sorted by section.order", () => {
  const content = makeValidContent();
  const sections = content.sections as Record<string, unknown>[];
  // Add a second section with order=0 (should come first despite being second in array)
  sections.push({
    sectionId: "reading-0",
    type: "reading",
    order: 0,
    groups: [{
      groupId: "careful-0",
      type: "careful_reading",
      order: 0,
      passage: "First passage.",
      questions: [{
        questionId: "q0",
        order: 0,
        prompt: "Zero question?",
        type: "choice",
        options: [{ id: "A", text: "Yes" }, { id: "B", text: "No" }],
        answerId: "A",
      }],
    }],
  });
  // Set first section order to 1
  sections[0].order = 1;
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, true);
  assert.equal(result.questions[0].questionId, "q0"); // section order=0 first
  assert.equal(result.questions[1].questionId, "q1"); // section order=1 second
});

test("43. original input not mutated by sorting", () => {
  const content = makeValidContent();
  const qs = (((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[]);
  const originalFirstId = qs[0].questionId;
  // Swap array order
  const tmp = qs[0]; qs[0] = qs[1]; qs[1] = tmp;
  qs[0].order = 1; qs[1].order = 0;
  checkPrivatePaperReadiness(content);
  // Original array order should be unchanged
  assert.equal(qs[0].questionId, originalFirstId === "q1" ? "q2" : "q1");
});

// === Hardening: readiness duplicate IDs ===

test("44. duplicate option.id → not ready", () => {
  const content = makeValidContent();
  const opts = ((((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[])[0].options as Record<string, unknown>[]);
  opts[1].id = "A"; // duplicate with opts[0]
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("重复") || result.reason?.includes("结构"));
});

test("45. duplicate questionId across groups → not ready", () => {
  const content = makeValidContent();
  const section = (content.sections as Record<string, unknown>[])[0];
  const groups = section.groups as Record<string, unknown>[];
  groups.push({
    groupId: "careful-2",
    type: "careful_reading",
    order: 1,
    passage: "Second.",
    questions: [{
      questionId: "q1", // duplicate with existing q1
      order: 0,
      prompt: "Dup?",
      type: "choice",
      options: [{ id: "A", text: "X" }, { id: "B", text: "Y" }],
      answerId: "A",
    }],
  });
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("46. empty option id → not ready", () => {
  const content = makeValidContent();
  const opts = ((((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[])[0].questions as Record<string, unknown>[])[0].options as Record<string, unknown>[]);
  opts[0].id = "";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("47. illegal questionRefs structure (not array) → not ready", () => {
  const content = makeValidContent();
  const groups = ((content.sections as Record<string, unknown>[])[0].groups as Record<string, unknown>[]);
  groups[0].questionRefs = "not-an-array";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

test("48. schemaVersion mismatch → not ready via structural validation", () => {
  const content = makeValidContent({ schemaVersion: "9.9.9" });
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
});

// === Hardening: countValidAnswers ===

test("49. countValidAnswers only counts valid question indices", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const answers: Record<number, string> = { 0: "A", 1: "C", 5: "X", 99: "Y" };
  assert.equal(countValidAnswers(result.questions, answers), 2);
});

test("50. countValidAnswers ignores non-string values", () => {
  const result = checkPrivatePaperReadiness(makeValidContent());
  const answers: Record<number, string> = { 0: "A", 1: "" as unknown as string };
  assert.equal(countValidAnswers(result.questions, answers), 1);
});

// === Hardening: progress storage validation ===

// Mock sessionStorage for Node.js tests
class MockSessionStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  removeItem(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

function setupMockStorage(): MockSessionStorage {
  const mock = new MockSessionStorage();
  (globalThis as Record<string, unknown>).window = { sessionStorage: mock } as unknown as Window;
  return mock;
}

test("51. no archive → no_archive status", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "no_archive");
  assert.deepEqual(loaded.answers, {});
  assert.equal(loaded.currentIndex, 0);
  assert.equal(loaded.submitted, false);
});

test("52. valid archive → loaded status with answers", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  const key = "private-study:user1:paper1";
  mock.setItem(key, JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: { 0: "A", 1: "C" },
    currentIndex: 1,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.answers[0], "A");
  assert.equal(loaded.answers[1], "C");
  assert.equal(loaded.currentIndex, 1);
});

test("53. corrupted JSON → corrupted status", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", "{invalid json");
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "corrupted");
  assert.ok(loaded.message?.includes("损坏"));
});

test("54. content hash mismatch → content_changed status", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: "different-hash",
    answers: { 0: "A" },
    currentIndex: 0,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "content_changed");
  assert.ok(loaded.message?.includes("失效"));
});

test("55. owner mismatch → owner_mismatch status", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user2",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: { 0: "A" },
    currentIndex: 0,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "owner_mismatch");
});

test("56. answers is array → filtered to valid object", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: ["A", "C"], // array instead of object
    currentIndex: 0,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.answers, {}); // array is rejected, answers empty
});

test("57. currentIndex decimal → clamped to integer 0", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: {},
    currentIndex: 1.5,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.currentIndex, 0); // decimal rejected → 0
});

test("58. currentIndex out of range → clamped", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: {},
    currentIndex: 999,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.currentIndex, 1); // clamped to total-1
});

test("59. extra answers beyond valid indices → filtered out", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: { 0: "A", 1: "C", 5: "X", 99: "Y" },
    currentIndex: 0,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.equal(Object.keys(loaded.answers).length, 2); // only 0 and 1
  assert.equal(loaded.answers[5], undefined);
  assert.equal(loaded.answers[99], undefined);
});

test("60. save and load roundtrip", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  const state = { answers: { 0: "B" }, currentIndex: 1, submitted: false };
  const saved = saveStudyProgress("user1", "paper1", result.contentHash, state);
  assert.equal(saved, true);
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.answers[0], "B");
  assert.equal(loaded.currentIndex, 1);
});

test("61. clearStudyProgress removes archive", () => {
  setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  saveStudyProgress("user1", "paper1", result.contentHash, { answers: { 0: "A" }, currentIndex: 0, submitted: false });
  clearStudyProgress("user1", "paper1");
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "no_archive");
});

test("62. getProgressStatusMessage returns correct messages", () => {
  assert.equal(getProgressStatusMessage("no_archive"), null);
  assert.equal(getProgressStatusMessage("loaded"), null);
  assert.ok(getProgressStatusMessage("corrupted")?.includes("损坏"));
  assert.ok(getProgressStatusMessage("content_changed")?.includes("失效"));
  assert.ok(getProgressStatusMessage("owner_mismatch")?.includes("账号"));
  assert.ok(getProgressStatusMessage("storage_read_failed")?.includes("存储"));
});

test("63. old version archive → corrupted (version mismatch)", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: 1,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: { 0: "A" },
    currentIndex: 0,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "corrupted");
});

test("64. submitted=true archive → loaded with submitted", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: { 0: "A", 1: "C" },
    currentIndex: 1,
    submitted: true,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.submitted, true);
});

test("65. negative currentIndex → clamped to 0", () => {
  const mock = setupMockStorage();
  const result = checkPrivatePaperReadiness(makeValidContent());
  mock.setItem("private-study:user1:paper1", JSON.stringify({
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId: "user1",
    paperId: "paper1",
    contentHash: result.contentHash,
    answers: {},
    currentIndex: -5,
    submitted: false,
    savedAt: new Date().toISOString(),
  }));
  const loaded = loadStudyProgress("user1", "paper1", result.contentHash, result.questions);
  assert.equal(loaded.currentIndex, 0);
});
