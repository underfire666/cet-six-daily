import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDailyPlan, mergePaperSessionPayloads, validateMutation, type SyncMutationInput } from "../src/lib/sync/server";
import { backoffDelay, dedupeSameEntity } from "../src/lib/sync/client";
import { nsKey } from "../src/lib/storage/namespace";

test("validateMutation rejects bad entity / missing fields", () => {
  assert.notEqual(validateMutation({}), null);
  assert.equal(
    validateMutation({
      mutationId: "m1",
      entityType: "xpEvent",
      entityId: "e1",
      operation: "upsert",
      payload: { source: "vocabulary", sourceId: "w1", amount: 10, eventId: "e1", earnedAt: new Date().toISOString() },
    }),
    null,
  );
  assert.notEqual(
    validateMutation({
      mutationId: "m1",
      entityType: "bogus" as SyncMutationInput["entityType"],
      entityId: "e1",
      operation: "upsert",
      payload: {},
    }),
    null,
  );
});

test("mergeDailyPlan completed-wins: never drops completed", () => {
  const merged = mergeDailyPlan(
    { completedTaskIds: ["a", "b"] },
    { completedTaskIds: ["b", "c"] },
  );
  assert.deepEqual([...(merged.completedTaskIds as string[])].sort(), ["a", "b", "c"]);
});

test("mergeDailyPlan with no existing returns incoming", () => {
  const merged = mergeDailyPlan(null, { completedTaskIds: ["x"] });
  assert.deepEqual(merged.completedTaskIds, ["x"]);
});

test("backoff grows and caps", () => {
  assert.ok(backoffDelay(0) < backoffDelay(3));
  assert.ok(backoffDelay(20) <= 300_000);
});

test("dedupeSameEntity keeps latest only", () => {
  const queue = [
    { mutationId: "m1", entityType: "wordbook", entityId: "w1", operation: "upsert" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
    { mutationId: "m2", entityType: "wordbook", entityId: "w1", operation: "remove" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
    { mutationId: "m3", entityType: "xpEvent", entityId: "x1", operation: "upsert" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
  ];
  const out = dedupeSameEntity(queue, "wordbook", "w1");
  assert.equal(out.length, 2);
  assert.equal(out.find((m) => m.entityType === "wordbook")?.mutationId, "m2");
});

test("nsKey: guest keeps legacy key, user namespaces it", () => {
  assert.equal(nsKey("guest", "cet-daily:v1:study"), "cet-daily:v1:study");
  assert.equal(nsKey({ type: "user", id: "u1" }, "cet-daily:v1:study"), "user:u1:cet-daily:v1:study");
});

test("validateMutation: XP source whitelist rejects unknown source", () => {
  assert.notEqual(
    validateMutation({
      mutationId: "m",
      entityType: "xpEvent",
      entityId: "e",
      operation: "upsert",
      payload: { source: "hacker", sourceId: "x", amount: 10, eventId: "e", earnedAt: new Date().toISOString() },
    }),
    null,
  );
});

test("validateMutation: XP amount capped at 200", () => {
  assert.notEqual(
    validateMutation({
      mutationId: "m",
      entityType: "xpEvent",
      entityId: "e",
      operation: "upsert",
      payload: { source: "vocabulary", sourceId: "x", amount: 999, eventId: "e", earnedAt: new Date().toISOString() },
    }),
    null,
  );
  assert.equal(
    validateMutation({
      mutationId: "m",
      entityType: "xpEvent",
      entityId: "e",
      operation: "upsert",
      payload: { source: "vocabulary", sourceId: "x", amount: 200, eventId: "e", earnedAt: new Date().toISOString() },
    }),
    null,
  );
});

test("validateMutation: review status/mastery enum enforced", () => {
  assert.notEqual(
    validateMutation({
      mutationId: "m",
      entityType: "reviewItem",
      entityId: "r",
      operation: "upsert",
      payload: { status: "hacked" },
    }),
    null,
  );
});

// ============ mergePaperSessionPayloads (V13 conflict merge) ============

test("mergePaperSessionPayloads: answers from different question ranges merge, no data loss", () => {
  const existing = { answers: { q1: { selectedOptionId: "A" }, q2: { selectedOptionId: "B" } } };
  const incoming = { answers: { q3: { selectedOptionId: "C" }, q4: { selectedOptionId: "D" } } };
  const merged = mergePaperSessionPayloads(existing, incoming);
  const answers = merged.answers as Record<string, unknown>;
  assert.equal(Object.keys(answers).length, 4);
  assert.ok(answers.q1);
  assert.ok(answers.q2);
  assert.ok(answers.q3);
  assert.ok(answers.q4);
});

test("mergePaperSessionPayloads: same-question conflict incoming wins (LWW)", () => {
  const existing = { answers: { q1: { selectedOptionId: "A" } } };
  const incoming = { answers: { q1: { selectedOptionId: "B" } } };
  const merged = mergePaperSessionPayloads(existing, incoming);
  assert.equal((merged.answers as Record<string, { selectedOptionId: string }>).q1.selectedOptionId, "B");
});

test("mergePaperSessionPayloads: sectionProgress completed wins over in_progress", () => {
  const existing = { sectionProgress: [{ sectionId: "s1", status: "completed", completedAt: "2026-01-01" }] };
  const incoming = { sectionProgress: [{ sectionId: "s1", status: "in_progress" }] };
  const merged = mergePaperSessionPayloads(existing, incoming);
  const sp = merged.sectionProgress as Array<{ sectionId: string; status: string }>;
  assert.equal(sp[0].status, "completed");
});

test("mergePaperSessionPayloads: phase completed wins", () => {
  const existing = { phase: "completed" };
  const incoming = { phase: "in_progress" };
  const merged = mergePaperSessionPayloads(existing, incoming);
  assert.equal(merged.phase, "completed");
});

test("mergePaperSessionPayloads: completedAt non-null wins", () => {
  const existing = { completedAt: "2026-01-01T00:00:00Z" };
  const incoming = { completedAt: null };
  const merged = mergePaperSessionPayloads(existing, incoming);
  assert.equal(merged.completedAt, "2026-01-01T00:00:00Z");
});

test("mergePaperSessionPayloads: xpSettled/reviewSettled true wins", () => {
  const existing = { xpSettled: true, reviewSettled: true };
  const incoming = { xpSettled: false, reviewSettled: false };
  const merged = mergePaperSessionPayloads(existing, incoming);
  assert.equal(merged.xpSettled, true);
  assert.equal(merged.reviewSettled, true);
});

test("mergePaperSessionPayloads: result kept from existing when incoming has none", () => {
  const existing = { result: { overallAccuracy: 80, wrongCount: 5 } };
  const incoming = { answers: { q1: { selectedOptionId: "A" } } };
  const merged = mergePaperSessionPayloads(existing, incoming);
  assert.ok(merged.result);
  assert.equal((merged.result as Record<string, number>).overallAccuracy, 80);
});
