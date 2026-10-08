import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getReadingArticles, getTranslationTasks, getWritingTasks, readingArticleById, translationTaskById, writingTaskById } from "../src/content/learning";
import { readingLesson } from "../src/lib/reading/questions";
import { createSession, reduceSession, firstSubmissionAccuracy } from "../src/lib/lesson/session";
import { scoreTranslation } from "../src/lib/translation/scoring";
import { pickDailyArticles } from "../src/lib/reading/store";
import { pickDailyTranslation } from "../src/lib/translation/store";
import { pickDailyWriting } from "../src/lib/writing/store";
import { listContentPacks, getPublishableItems } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import manifest from "../src/content/imported/cet6-history-manifest.json";

const articles = getReadingArticles().filter(a => a.sourceType === "past_exam");
const additional = articles.filter(a => !a.id.startsWith("cet6:2026-06:"));
for (const article of additional) {
  test(`history PDF ${article.id}: complete and playable with feedback`, () => {
    const definition = readingLesson(article);
    assert.equal(article.questions.length, article.exerciseType === "careful" ? 5 : 10);
    const n = article.exerciseType === "cloze" ? 26 : article.exerciseType === "matching" ? 36 : article.id.endsWith("careful1") ? 46 : 51;
    let session = createSession("2026-10-06", "review", definition, "audit", "2026-10-06T00:00:00Z");
    for (const [i, question] of article.questions.entries()) {
      assert.equal(question.id, `${article.id}:q${n+i}`);
      assert.ok(question.prompt.length > 10);
      assert.ok(question.options.some(o => o.id === question.answerId));
      assert.ok(question.detailedExplanation.includes(`【答案】 ${question.answerId}`));
      assert.ok(question.detailedExplanation.length > 100);
      assert.ok(question.options.every(o => o.text.trim()));
      session = reduceSession(session, { type: "select", optionId: question.answerId }, definition);
      session = reduceSession(session, { type: "check" }, definition);
      session = reduceSession(session, { type: "continue", today: "2026-10-06", now: "2026-10-06T00:00:00Z" }, definition);
    }
    assert.equal(session.phase, "complete");
    assert.equal(firstSubmissionAccuracy(session, definition), 100);
    if (article.exerciseType === "cloze") {
      assert.equal(article.questions[0].options.length, 15);
      assert.equal(new Set(article.questions.map(q => q.answerId)).size, 10);
      for (let i = 26; i <= 35; i++) assert.equal(article.passage.split(`[${i}] _____`).length, 2);
    }
    if (article.exerciseType === "matching") assert.ok(article.passage.startsWith("A) "));
    assert.ok(!article.passage.includes("lazynote.cn"));
  });
}

for (const task of getTranslationTasks().filter(t => t.sourceType === "past_exam" && !t.id.startsWith("cet6:2026-06:"))) {
  test(`history PDF ${task.id}: reference, explanation and rules score`, () => {
    assert.ok(task.promptChinese.length > 100);
    assert.ok(task.referenceTranslation.length > 300);
    assert.ok(task.referenceExplanation?.includes("【译法】"));
    assert.ok(task.keywords.length > 0 && task.keywords.every(k => task.referenceTranslation.toLowerCase().includes(k)));
    assert.equal(scoreTranslation(task, task.referenceTranslation, "2026-10-06T00:00:00Z").score, 15);
    assert.ok(!task.promptChinese.includes("lazynote.cn"));
  });
}
for (const task of getWritingTasks().filter(t => t.sourceType === "past_exam" && !t.id.startsWith("cet6:2026-06:"))) {
  test(`history PDF ${task.id}: original requirements, reference and explanation`, () => {
    assert.ok(task.prompt.startsWith("Directions:"));
    const wordCount = task.referenceEssay.split(/\s+/).length;
    assert.ok(wordCount >= 150 && wordCount <= 200);
    assert.ok(task.referenceExplanation?.includes("【第 1 段】"));
    assert.equal(task.outline.map(b => b.content).join("\n\n"), task.referenceEssay);
    assert.ok(task.suggestedWords.every(k => task.referenceEssay.toLowerCase().includes(k)));
    assert.ok(!task.prompt.includes("lazynote.cn"));
  });
}

test("five-year import counts unique exercises and resolves all shared references", () => {
  assert.equal(manifest.documents.length, 33);
  assert.equal(articles.length, 112);
  const questions = articles.flatMap(a => a.questions);
  assert.equal(questions.length, 840);
  assert.equal(new Set(questions.map(q => q.id)).size, 840);
  assert.equal(getTranslationTasks().filter(t => t.sourceType === "past_exam").length, 33);
  assert.equal(getWritingTasks().filter(t => t.sourceType === "past_exam").length, 33);
  for (const document of manifest.documents) {
    assert.equal(document.readingIds.length, 4);
    assert.ok(document.readingIds.every(id => readingArticleById(id)));
    assert.ok(translationTaskById(document.translationId));
    assert.ok(writingTaskById(document.writingId));
  }
  const shared = manifest.documents.find(d => d.id === "2023-03-2")!;
  assert.deepEqual(shared.readingIds, ["cloze", "matching", "careful1", "careful2"].map(part => `cet6:2023-03:set1:${part}`));
  assert.ok(!readingArticleById("cet6:2023-03:set2:cloze"));
});

test("shared passages are not duplicated and original natural numbers are preserved", () => {
  const hashes = articles.map(a => createHash("sha256").update(a.passage.replace(/\s+/g, " ").trim()).digest("hex"));
  assert.equal(new Set(hashes).size, articles.length);
  const passage = readingArticleById("cet6:2023-06:set3:cloze")!.passage;
  assert.ok(passage.includes("record 30 seconds of audio"));
  assert.ok(passage.includes("two [30] _____ weeks"));
  assert.ok(readingArticleById("cet6:2022-12:set2:cloze")!.passage.includes("[34] _____"));
});

test("daily selection covers all five years deterministically without Mock fallback", () => {
  for (const pick of [pickDailyArticles, pickDailyTranslation, pickDailyWriting]) {
    const years = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      const ids = pick(date);
      assert.deepEqual(ids, pick(date));
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.every(id => /^cet6:202[2-6]-\d{2}:/.test(id)));
      ids.forEach(id => years.add(id.split(":")[1].slice(0, 4)));
    }
    assert.deepEqual([...years].sort(), ["2022", "2023", "2024", "2025", "2026"]);
  }
});

test("import registration stays idempotent and preserves formal Paper/audio boundaries", () => {
  registerBuiltinPacks(); registerBuiltinPacks();
  assert.equal(listContentPacks().length, 13);
  for (const pack of listContentPacks().filter(p => p.id.startsWith("pack-cet6-2022-2025"))) {
    assert.equal(pack.rights?.licenseStatus, "unknown");
    assert.equal(pack.rights?.rightsStatus, "unverified");
  }
  assert.ok(!getPublishableItems<{ id?: string }>().some(i => i.id?.startsWith("cet6:202")));
  assert.equal(manifest.listeningEnabled, false);
  assert.equal(manifest.pendingListeningQuestions, 475);
});
