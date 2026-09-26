import { test } from "node:test";
import assert from "node:assert/strict";

// Pure conflict-strategy logic tests (no DB).
// These encode the V12 conflict matrix decisions.

type WordbookEntry = { wordId: string; addedAt: string; removedAt?: string };

function mergeWordbook(
  local: WordbookEntry[],
  remote: WordbookEntry[],
): WordbookEntry[] {
  const map = new Map<string, WordbookEntry>();
  for (const e of [...local, ...remote]) {
    const existing = map.get(e.wordId);
    if (!existing) {
      map.set(e.wordId, e);
      continue;
    }
    // tombstone wins: whichever has removedAt later wins
    const localRemoved = existing.removedAt ?? "";
    const incomingRemoved = e.removedAt ?? "";
    if (incomingRemoved && (!localRemoved || incomingRemoved > localRemoved)) {
      map.set(e.wordId, e);
    } else if (!incomingRemoved && localRemoved) {
      // keep tombstone
    } else {
      map.set(e.wordId, e.addedAt > existing.addedAt ? e : existing);
    }
  }
  return Array.from(map.values());
}

test("wordbook merge: same word from two devices -> one entry", () => {
  const merged = mergeWordbook(
    [{ wordId: "w1", addedAt: "2026-01-01" }],
    [{ wordId: "w1", addedAt: "2026-01-02" }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].addedAt, "2026-01-02");
});

test("wordbook merge: A removes w1, B still has old cache -> tombstone wins", () => {
  const merged = mergeWordbook(
    [{ wordId: "w1", addedAt: "2026-01-01", removedAt: "2026-01-10" }],
    [{ wordId: "w1", addedAt: "2026-01-01" }],
  );
  assert.equal(merged.length, 1);
  assert.ok(merged[0].removedAt);
});

test("wordbook merge: A adds w1, B adds w2 -> both present", () => {
  const merged = mergeWordbook(
    [{ wordId: "w1", addedAt: "2026-01-01" }],
    [{ wordId: "w2", addedAt: "2026-01-02" }],
  );
  assert.equal(merged.length, 2);
});

// XP event idempotency: set union by eventId.
function mergeXpEvents(local: { eventId: string; amount: number }[], remote: { eventId: string; amount: number }[]) {
  const map = new Map<string, number>();
  for (const e of [...local, ...remote]) map.set(e.eventId, e.amount);
  return Array.from(map.entries()).map(([eventId, amount]) => ({ eventId, amount }));
}

test("xp merge: duplicate eventId counted once", () => {
  const merged = mergeXpEvents(
    [{ eventId: "e1", amount: 10 }, { eventId: "e2", amount: 5 }],
    [{ eventId: "e1", amount: 10 }, { eventId: "e3", amount: 15 }],
  );
  assert.equal(merged.length, 3);
  assert.equal(merged.reduce((s, e) => s + e.amount, 0), 30);
});

// Review mastery: later review event wins.
type ReviewState = { reviewItemId: string; mastery: string; reviewedAt: string };
function mergeReview(a: ReviewState, b: ReviewState): ReviewState {
  return a.reviewedAt > b.reviewedAt ? a : b;
}

test("review merge: newer review wins over stale LWW", () => {
  const a: ReviewState = { reviewItemId: "r1", mastery: "hard", reviewedAt: "2026-01-01" };
  const b: ReviewState = { reviewItemId: "r1", mastery: "easy", reviewedAt: "2026-02-01" };
  assert.equal(mergeReview(a, b).mastery, "easy");
});
