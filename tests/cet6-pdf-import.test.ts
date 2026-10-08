import test from "node:test";
import assert from "node:assert/strict";
import { getReadingArticles, getTranslationTasks, getWritingTasks, readingArticleById } from "../src/content/learning";
import { listContentPacks, getPublishableItems, resetRegistry } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { validateAll } from "../src/content/validator";
import { pickDailyArticles, planFor, startReading } from "../src/lib/reading/store";
import { emptyReadingStore, loadReadingStore } from "../src/lib/reading/storage";
import { pickDailyTranslation } from "../src/lib/translation/store";
import { pickDailyWriting } from "../src/lib/writing/store";
import { readingLesson } from "../src/lib/reading/questions";
import { createSession, reduceSession, firstSubmissionAccuracy } from "../src/lib/lesson/session";
import { scoreTranslation } from "../src/lib/translation/scoring";
import manifest from "../src/content/imported/cet6-2026-06-manifest.json";

const keys = [
  ["JIDCFKBGAE", "DIFKBHLEMJ", "ABCDA", "CBADD"],
  ["DOANEFJIBH", "FJGMDLCHKB", "CABCD", "CBDBA"],
  ["BANDEMOICJ", "EAGCPIBNDO", "BCDCD", "AADDA"],
];
for (let set = 1; set <= 3; set++) for (const [index, kind] of ["cloze", "matching", "careful1", "careful2"].entries()) {
  test(`PDF set ${set} ${kind}: complete questions, verified key, grading and explanations`, () => {
    const article = readingArticleById(`cet6:2026-06:set${set}:${kind}`)!;
    assert.ok(article);
    assert.equal(article.questions.map(q => q.answerId).join(""), keys[set - 1][index]);
    assert.equal(article.questions.length, index < 2 ? 10 : 5);
    const definition = readingLesson(article);
    let session = createSession("2026-10-05", "review", definition, "check", "2026-10-05T00:00:00Z");
    for (const q of definition.questions) {
      assert.ok(q.options.some(o => o.id === q.answerId));
      assert.ok(q.explanation.trim().length > 0 && q.details!.includes("【答案】") && q.details!.length > 100);
      session = reduceSession(session, { type: "select", optionId: q.answerId }, definition);
      session = reduceSession(session, { type: "check" }, definition);
      session = reduceSession(session, { type: "continue", today: "2026-10-05", now: "2026-10-05T00:00:00Z" }, definition);
    }
    assert.equal(session.phase, "complete");
    assert.equal(firstSubmissionAccuracy(session, definition), 100);
    if (kind === "cloze") {
      assert.equal(article.questions[0].options.length, 15);
      for (let n = 26; n <= 35; n++) assert.ok(article.passage.includes(`[${n}] _____`));
      assert.equal(new Set(article.questions.map(q => q.answerId)).size, 10);
    }
    if (kind === "matching") assert.ok(article.passage.startsWith("A) "));
    assert.ok(!article.passage.includes("lazynote.cn"));
  });
}

test("PDF import has stable unique IDs and full counted modules", () => {
  const articles = getReadingArticles().filter(a => a.id.startsWith("cet6:2026-06:"));
  assert.equal(articles.length, 12);
  const questions = articles.flatMap(a => a.questions);
  assert.equal(questions.length, 90);
  assert.equal(new Set(questions.map(q => q.id)).size, 90);
  assert.equal(getTranslationTasks().filter(t => t.id.startsWith("cet6:2026-06:")).length, 3);
  assert.equal(getWritingTasks().filter(t => t.id.startsWith("cet6:2026-06:")).length, 3);
  assert.equal(manifest.listeningEnabled, false);
  assert.equal(manifest.documents[2].listeningStatus, "shared_with_set1");
});

test("new daily plans prioritize imported content and remain deterministic", () => {
  for (const day of ["2026-10-05", "2026-10-06", "2026-12-31", "2027-01-01"]) {
    for (const pick of [pickDailyArticles, pickDailyTranslation, pickDailyWriting]) {
      const ids = pick(day);
      assert.deepEqual(ids, pick(day));
      assert.ok(ids.length > 0 && ids.every(id => /^cet6:202[2-6]-\d{2}:/.test(id)));
      assert.equal(ids.length, new Set(ids).size);
    }
  }
});

test("a pre-import plan remains playable and survives refresh", () => {
  const article = getReadingArticles().find(a => a.sourceType === "mock")!;
  const store = emptyReadingStore(), day = "2026-10-05";
  store.daily[day] = { date: day, articleIds: [article.id], completedArticleIds: [] };
  const started = startReading(store, "daily", day, `${day}T00:00:00Z`, "old").store;
  const loaded = loadReadingStore({ length: 1, key: () => null, getItem: () => JSON.stringify(started), setItem: () => {}, removeItem: () => {} });
  assert.deepEqual(planFor(loaded.store, day).articleIds, [article.id]);
  assert.equal(loaded.store.sessions.old.articleId, article.id);
});

test("reference translations are meaningful score inputs and writing meets required opening", () => {
  for (const task of getTranslationTasks().filter(t => t.id.startsWith("cet6:2026-06:"))) {
    assert.ok(task.promptChinese.length > 100 && task.referenceTranslation.length > 500);
    assert.equal(scoreTranslation(task, task.referenceTranslation, "2026-10-05T00:00:00Z").score, 15);
    assert.ok(task.referenceExplanation?.includes("【译法】"));
  }
  for (const task of getWritingTasks().filter(t => t.id.startsWith("cet6:2026-06:"))) {
    const opening = task.prompt.match(/"([^"]+)"/)![1];
    assert.ok(task.referenceEssay.startsWith(opening));
    assert.ok(task.referenceEssay.split(/\s+/).length >= 150);
    assert.ok(task.referenceEssay.split(/\s+/).length <= 200);
    assert.equal(task.outline.length, 3);
    assert.ok(task.referenceExplanation?.includes("【第 1 段】"));
  }
});

test("re-registration does not duplicate imported items or assert licensing", () => {
  resetRegistry(); registerBuiltinPacks(); registerBuiltinPacks();
  assert.equal(listContentPacks().length, 13);
  assert.equal(validateAll(listContentPacks()).errors.length, 0);
  for (const pack of listContentPacks().filter(p => p.id.startsWith("pack-cet6-2026-06"))) assert.equal(pack.rights?.licenseStatus, "unknown");
  assert.ok(!getPublishableItems<{id?:string}>().some(i => i.id?.startsWith("cet6:2026-06:")));
});
