import test from "node:test";
import assert from "node:assert/strict";
import type { ExamModule } from "../src/content/exam-catalog";
import { practiceSessionHref } from "../src/lib/exam-records";
import {
  completeExitHref,
  practiceCompleteHref,
  recordsReturnFromSearch,
  sessionExitHref,
} from "../src/lib/exam-records-route";

const modules: ExamModule[] = ["listening", "reading", "translation", "writing"];
const asUrl = (href: string) => new URL(href, "https://cet.test");
const queryOf = (href: string) => Object.fromEntries(asUrl(href).searchParams);
const recordsSearch = (returnTo: string) => `?${new URLSearchParams({ returnTo })}`;

for (const examModule of modules) {
  for (const status of ["in_progress", "completed"] as const) {
    test(`${examModule}: session to completion returns to the original ${status} records filter`, () => {
      const sessionId = `selected:${examModule}:original-session`;
      const recordsHref = `/practice/exams/records?status=${status}&module=${examModule}`;
      const sessionHref = practiceSessionHref(examModule, sessionId, recordsHref);
      const sessionUrl = asUrl(sessionHref);
      assert.equal(sessionUrl.pathname, `/practice/${examModule}/session/${sessionId}`);
      assert.equal(sessionExitHref("selected", `/practice/${examModule}`, sessionUrl.search), recordsHref);

      const completeHref = practiceCompleteHref(examModule, sessionId, sessionUrl.search);
      const completeUrl = asUrl(completeHref);
      assert.equal(completeUrl.pathname, `/practice/${examModule}/complete/${sessionId}`);
      assert.deepEqual(queryOf(completeHref), { returnTo: recordsHref });
      assert.equal(recordsReturnFromSearch(completeUrl.search), recordsHref);
      assert.equal(completeExitHref(`/practice/${examModule}`, completeUrl.search), recordsHref);
    });
  }

  test(`${examModule}: selected sessions and completion preserve every original exam filter`, () => {
    const sessionId = `selected:${examModule}:exam-origin`;
    const search = `?year=2024&period=12&set=3&exam=2024-12-3&module=${examModule}&session=stale&unknown=remove-me`;
    const expectedBrowse = "/practice/exams?year=2024&period=12&set=3&exam=2024-12-3" +
      (examModule === "listening" ? "" : `&module=${examModule}`);
    const expectedQuery = {
      year: "2024", period: "12", set: "3", exam: "2024-12-3",
      ...(examModule === "listening" ? {} : { module: examModule }),
    };

    assert.equal(sessionExitHref("selected", `/practice/${examModule}`, search), expectedBrowse);
    const completeHref = practiceCompleteHref(examModule, sessionId, search);
    assert.equal(asUrl(completeHref).pathname, `/practice/${examModule}/complete/${sessionId}`);
    assert.deepEqual(queryOf(completeHref), expectedQuery);
    assert.equal(sessionExitHref("selected", `/practice/${examModule}`, asUrl(completeHref).search), expectedBrowse);
    assert.equal(completeExitHref(expectedBrowse, asUrl(completeHref).search), expectedBrowse);
  });

  test(`${examModule}: daily and extra exits retain the module home even with a records return URL`, () => {
    const moduleHome = `/practice/${examModule}`;
    const search = `${recordsSearch(`/practice/exams/records?status=in_progress&module=${examModule}`)}&exam=2024-12-3`;
    for (const mode of ["daily", "extra"]) {
      assert.equal(sessionExitHref(mode, moduleHome, ""), moduleHome);
      assert.equal(sessionExitHref(mode, moduleHome, search), moduleHome);
    }
    assert.equal(completeExitHref(moduleHome, ""), moduleHome);
    assert.equal(practiceCompleteHref(examModule, "daily:unchanged-id", ""), `/practice/${examModule}/complete/daily:unchanged-id`);
  });
}

test("records return resolution accepts the base records page and normalizes filter order", () => {
  assert.equal(recordsReturnFromSearch(""), null);
  assert.equal(recordsReturnFromSearch("?exam=2024-12-3"), null);
  assert.equal(recordsReturnFromSearch(recordsSearch("/practice/exams/records")), "/practice/exams/records");
  assert.equal(
    recordsReturnFromSearch(recordsSearch("/practice/exams/records?module=writing&status=completed")),
    "/practice/exams/records?status=completed&module=writing",
  );
});

test("records origin wins over exam origin while both safe contexts survive completion", () => {
  const recordsHref = "/practice/exams/records?status=in_progress&module=reading";
  const search = `${recordsSearch(recordsHref)}&year=2024&period=12&set=3&exam=2024-12-3&module=reading&session=old&junk=drop`;
  assert.equal(sessionExitHref("selected", "/practice/reading", search), recordsHref);
  const completeHref = practiceCompleteHref("reading", "selected:same-id", search);
  assert.deepEqual(queryOf(completeHref), {
    year: "2024", period: "12", set: "3", exam: "2024-12-3", module: "reading", returnTo: recordsHref,
  });
  assert.equal(completeExitHref("/practice/exams?exam=2024-12-3", asUrl(completeHref).search), recordsHref);
});

test("invalid return URLs are discarded without losing a valid exam origin", () => {
  const invalidReturns = [
    "https://evil.example/practice/exams/records",
    "//evil.example/practice/exams/records",
    "/practice/reading",
    "/practice/exams/records/reading/session-1",
    "/practice/exams/records-elsewhere",
    "/practice/exams/records?redirect=https://evil.example",
    "/practice/exams/records\\evil",
    "/practice/exams/records\n",
  ];
  for (const returnTo of invalidReturns) {
    const search = recordsSearch(returnTo);
    assert.equal(recordsReturnFromSearch(search), null, returnTo);
    assert.equal(sessionExitHref("selected", "/practice/writing", search), "/practice/exams", returnTo);
    assert.equal(completeExitHref("/practice/writing", search), "/practice/writing", returnTo);
    assert.equal(practiceCompleteHref("writing", "same-session", search), "/practice/writing/complete/same-session", returnTo);

    const examSearch = `${search}&year=2024&period=12&set=3&exam=2024-12-3&module=writing`;
    const browse = "/practice/exams?year=2024&period=12&set=3&exam=2024-12-3&module=writing";
    assert.equal(sessionExitHref("selected", "/practice/writing", examSearch), browse, returnTo);
    const completeHref = practiceCompleteHref("writing", "same-session", examSearch);
    assert.deepEqual(queryOf(completeHref), { year: "2024", period: "12", set: "3", exam: "2024-12-3", module: "writing" }, returnTo);
    assert.equal(completeExitHref(browse, asUrl(completeHref).search), browse, returnTo);
  }
});

test("completion preserves the supplied fallback exactly when records return is absent or invalid", () => {
  const defaultHref = "/practice/exams?year=2024&period=12&set=3&exam=2024-12-3&module=translation";
  for (const search of [
    "", "?exam=2024-12-3", "?exam=unknown",
    `${recordsSearch("https://evil.example")}&exam=2024-12-3`,
  ]) {
    assert.equal(completeExitHref(defaultHref, search), defaultHref);
  }
});

test("completion normalizes exam filters and drops unknown query keys", () => {
  const href = practiceCompleteHref("reading", "selected:original", "?year=1999&period=13&set=9&exam=2024-12-3&module=invalid&session=other&status=completed&unknown=drop");
  assert.equal(asUrl(href).pathname, "/practice/reading/complete/selected:original");
  assert.deepEqual(queryOf(href), { exam: "2024-12-3" });
});

test("exam filters without a valid exam cannot create an exam return context", () => {
  for (const search of [
    "?year=2024&period=12&set=3&module=reading",
    "?year=2024&period=12&set=3&exam=missing&module=reading",
    "?exam=https://evil.example&module=reading",
  ]) {
    assert.equal(sessionExitHref("selected", "/practice/reading", search), "/practice/exams");
    assert.equal(practiceCompleteHref("reading", "same-id", search), "/practice/reading/complete/same-id");
  }
  const recordsHref = "/practice/exams/records?status=in_progress&module=reading";
  assert.deepEqual(queryOf(practiceCompleteHref("reading", "same-id", `?exam=missing&year=2024&module=reading&${new URLSearchParams({ returnTo: recordsHref })}`)), { returnTo: recordsHref });
});

test("completion rejects invalid modules and session IDs instead of constructing unsafe paths", () => {
  const search = `${recordsSearch("/practice/exams/records")}&exam=2024-12-3`;
  for (const invalidModule of ["", "private", "../reading", "Reading"]) {
    assert.equal(practiceCompleteHref(invalidModule as ExamModule, "valid-id", search), "/practice/exams");
  }
  for (const sessionId of ["", "x".repeat(129), "../session", "a/b", "a?returnTo=override", "a#hash", "a%2Fb", "a b", "会话"]) {
    assert.equal(practiceCompleteHref("reading", sessionId, search), "/practice/exams", sessionId);
  }
  for (const sessionId of ["a", "A_9:-", "x".repeat(128)]) {
    assert.equal(practiceCompleteHref("reading", sessionId, ""), `/practice/reading/complete/${sessionId}`);
  }
});

test("return URL helpers work in Node without window or browser state", () => {
  assert.equal(typeof window, "undefined");
  const recordsHref = "/practice/exams/records?status=completed&module=translation";
  const search = recordsSearch(recordsHref);
  assert.equal(recordsReturnFromSearch(search), recordsHref);
  assert.equal(sessionExitHref("selected", "/practice/translation", search), recordsHref);
  assert.equal(completeExitHref("/practice/translation", search), recordsHref);
  assert.equal(asUrl(practiceCompleteHref("translation", "selected:pure", search)).searchParams.get("returnTo"), recordsHref);
});
