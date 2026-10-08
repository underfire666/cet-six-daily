import test from "node:test";
import assert from "node:assert/strict";
import history from "../src/content/imported/cet6-history-manifest.json";
import listening from "../src/content/imported/cet6-listening-manifest.json";
import { examModules, getExamCatalog, getExamExercise } from "../src/content/exam-catalog";
import { getPublishableItems } from "../src/content/registry";
import { examBrowseHref, examPracticeHref, examReturnHref, readExamBrowse } from "../src/lib/exam-browse-route";

test("exam catalog references all 33 imported papers with exact canonical IDs and available exercises", () => {
  const entries = getExamCatalog();
  assert.equal(entries.length, 33);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 33);
  assert.equal(entries[0].id, "2026-06-1");
  assert.equal(entries.at(-1)?.id, "2022-06-3");
  for (const entry of entries) {
    const document = history.documents.find(document => document.id === entry.id)!;
    const audio = listening.documents.find(document => document.document === entry.id)!;
    assert.deepEqual(entry.exercises.reading.map(item => item.id), document.readingIds);
    assert.deepEqual(entry.exercises.listening.map(item => item.id), audio.materialIds);
    assert.equal(entry.exercises.translation[0].id, document.translationId);
    assert.equal(entry.exercises.writing[0].id, document.writingId);
    assert.equal(entry.exercises.reading.reduce((count, item) => count + item.questionCount, 0), 30);
    assert.equal(entry.exercises.listening.reduce((count, item) => count + item.questionCount, 0), 25);
    for (const practiceModule of examModules) for (const exercise of entry.exercises[practiceModule]) {
      assert.ok(exercise.available && exercise.minutes > 0 && exercise.questionCount > 0, exercise.id);
      assert.equal(exercise.module, practiceModule);
      assert.equal(getExamExercise(practiceModule, exercise.id)?.id, exercise.id);
    }
  }
  const all = entries.flatMap(entry => examModules.flatMap(module => entry.exercises[module]));
  assert.equal(new Set(all.map(item => item.id)).size, 311);
});

test("shared listening and reading sets retain canonical identities including second-set audio", () => {
  const entries = getExamCatalog();
  for (const id of ["2024-06-3", "2024-12-3", "2025-06-3"]) {
    const entry = entries.find(entry => entry.id === id)!;
    const shared = entries.find(candidate => candidate.id === `${entry.year}-${entry.period}-2`)!;
    assert.equal(entry.listeningSharedWith, "2");
    assert.deepEqual(entry.exercises.listening, shared.exercises.listening);
  }
  assert.equal(entries.filter(entry => entry.readingSharedWith).length, 5);
  assert.ok(entries.some(entry => entry.period === "09" && entry.year === "2022"));
  assert.ok(entries.some(entry => entry.period === "03" && entry.year === "2023"));
});

test("catalog selection rejects Mock, private, missing IDs, wrong modules and keeps production guard", () => {
  for (const practiceModule of examModules) {
    for (const id of ["mock-paper", "PRIVATE:userB:paper", "cet6:2026-06:set9:writing"])
      assert.equal(getExamExercise(practiceModule, id), undefined);
    assert.ok(!getPublishableItems<{id: string}>(practiceModule).some(item => item.id.startsWith("cet6:")));
  }
  assert.equal(getExamExercise("reading", "cet6:2026-06:set1:writing"), undefined);
});

test("browse and practice links round-trip all filters without leaking arbitrary return URLs", () => {
  const state = readExamBrowse("?year=2024&period=12&set=3&exam=2024-12-3&module=reading&returnTo=https://example.com&session=old");
  const browse = examBrowseHref(state);
  assert.equal(browse, "/practice/exams?year=2024&period=12&set=3&exam=2024-12-3&module=reading");
  const practice = examPracticeHref("reading", "selected:1", state);
  assert.equal(examReturnHref(practice.split("?")[1]), browse);
  assert.ok(!practice.includes("returnTo"));
  assert.deepEqual(readExamBrowse(browse.split("?")[1]), state);
});

test("browse query validation handles unknown exams, invalid filters and session IDs", () => {
  assert.deepEqual(readExamBrowse("?year=1999&period=13&set=0&exam=../../etc&module=private"), { year: "", period: "", set: "", exam: "", module: "listening" });
  assert.equal(examReturnHref("?exam=https://evil.example&returnTo=//evil.example"), null);
  assert.equal(examReturnHref("?year=2024&session=abc"), null);
  const state = readExamBrowse("?exam=2026-06-1");
  assert.equal(examPracticeHref("reading", "bad&session=override", state), examBrowseHref(state));
  assert.equal(examBrowseHref({ ...state, year: "<script>", set: "-1" }), "/practice/exams?exam=2026-06-1");
});
