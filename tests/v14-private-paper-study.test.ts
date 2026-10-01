import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPrivatePaperReadiness,
  scorePrivateAnswers,
  computePrivateContentHash,
} from "../src/lib/private-papers/readiness";

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
  assert.ok(result.reason?.includes("reading"));
});

test("7. listening section → not ready", () => {
  const content = makeValidContent();
  (content.sections as Record<string, unknown>[])[0].type = "listening";
  const result = checkPrivatePaperReadiness(content);
  assert.equal(result.ready, false);
  assert.ok(result.reason?.includes("reading"));
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
  assert.ok(result.reason?.includes("assetIds"));
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
  assert.ok(result.reason?.includes("不在选项中"));
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
