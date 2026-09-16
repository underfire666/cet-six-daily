import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  countdownText,
  dayDifference,
  monthCells,
  shiftMonth,
  todayInShanghai,
  validDate,
} from "../src/lib/dates";
import { getLesson, mockExamDate } from "../src/data/mock";
test("Shanghai day changes at UTC 16:00", () => {
  assert.equal(todayInShanghai(new Date("2026-09-15T15:59:59Z")), "2026-09-15");
  assert.equal(todayInShanghai(new Date("2026-09-15T16:00:00Z")), "2026-09-16");
});
test("date arithmetic handles leap years and year changes", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(dayDifference("2026-09-15", mockExamDate), 87);
});
test("calendar is Monday-first and includes every day", () => {
  const leap = monthCells("2024-02");
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[3], "2024-02-01");
  assert.equal(monthCells("2026-03").length, 42);
  assert.equal(monthCells("2026-06")[0], "2026-06-01");
});
test("invalid dates rejected", () => {
  for (const value of ["2026-02-29", "2026-13-01", "hello", "2026-9-1"])
    assert.equal(validDate(value), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("countdown has exam-day and elapsed states", () => {
  assert.equal(
    countdownText("2026-12-10", mockExamDate),
    "距离六级考试还有 1 天",
  );
  assert.match(countdownText(mockExamDate, mockExamDate), /今天/);
  assert.match(countdownText("2026-12-12", mockExamDate), /更新/);
});
test("today, future, history and rescheduled plans are consistent", () => {
  const today = "2026-09-15";
  assert.equal(getLesson(today, today).minutes, 14);
  assert.equal(getLesson(today, today).status, "today");
  assert.equal(getLesson("2026-09-16", today).status, "locked");
  for (let i = 1; i <= 7; i++)
    assert.equal(getLesson(addDays(today, -i), today).status, "completed");
  const adjusted = getLesson("2026-09-06", today);
  assert.equal(adjusted.status, "adjusted");
  assert.equal(getLesson(adjusted.rescheduledTo!, today).status, "locked");
  assert.equal(getLesson("2026-09-16", "2026-09-16").status, "today");
});
