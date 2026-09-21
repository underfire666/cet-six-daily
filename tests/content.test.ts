import assert from "node:assert/strict";
import test from "node:test";
import { registerBuiltinPacks } from "../src/content/packs";
import {
  getActiveItems,
  getContentPack,
  listContentPacks,
  registerContentPack,
  resetRegistry,
} from "../src/content/registry";
import { MOCK_SOURCE } from "../src/content/sources";
import { normalizeWord, hashString } from "../src/content/normalize";
import { validatePack, validateAll } from "../src/content/validator";
import { selectContent } from "../src/content/selector";
import { resolveAlias, listAliases } from "../src/content/aliases";
import { vocabularyRepository, readingRepository, listeningRepository, translationRepository, writingRepository } from "../src/content/repositories";
import { validatePaper } from "../src/content/papers";
import type { ContentPack } from "../src/content/types";

test("registry: builtin packs register and list", () => {
  resetRegistry();
  registerBuiltinPacks();
  const packs = listContentPacks();
  assert.equal(packs.length, 5);
  assert.ok(getContentPack("pack-vocabulary-mock"));
  assert.ok(getContentPack("pack-reading-mock"));
  assert.ok(getContentPack("pack-listening-mock"));
  assert.ok(getContentPack("pack-translation-mock"));
  assert.ok(getContentPack("pack-writing-mock"));
});

test("registry: duplicate pack id throws", () => {
  resetRegistry();
  registerBuiltinPacks();
  const dup: ContentPack = {
    id: "pack-vocabulary-mock",
    name: "dup",
    version: "1.0.0",
    contentType: "vocabulary",
    sourceId: MOCK_SOURCE.id,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.throws(() => registerContentPack(dup), /duplicate pack/);
});

test("registry: unknown source throws", () => {
  resetRegistry();
  const bad: ContentPack = {
    id: "bad-pack",
    name: "bad",
    version: "1.0.0",
    contentType: "vocabulary",
    sourceId: "nope",
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.throws(() => registerContentPack(bad), /unknown source/);
});

test("normalizeWord: case + whitespace", () => {
  assert.equal(normalizeWord("  Abandon  "), "abandon");
  assert.equal(normalizeWord("Hello   World"), "hello world");
});

test("hashString: deterministic", () => {
  assert.equal(hashString("2026-09-21:reading:u1"), hashString("2026-09-21:reading:u1"));
  assert.notEqual(hashString("a"), hashString("b"));
});

test("validator: builtin packs pass", () => {
  resetRegistry();
  registerBuiltinPacks();
  const report = validateAll(listContentPacks());
  assert.equal(report.errors.length, 0, report.errors.map((e) => e.message).join("\n"));
  assert.ok(report.counts.vocabulary > 0);
  assert.ok(report.counts.reading > 0);
  assert.ok(report.counts.listening > 0);
});

test("validator: duplicate id detected", () => {
  resetRegistry();
  const pack: ContentPack = {
    id: "test-dup",
    name: "dup",
    version: "1.0.0",
    contentType: "reading",
    sourceId: MOCK_SOURCE.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      { id: "r1", title: "a", passage: "x", questions: [] },
      { id: "r1", title: "b", passage: "y", questions: [] },
    ],
  };
  const issues = validatePack(pack);
  assert.ok(issues.some((i) => i.message.includes("duplicate id")));
});

test("validator: invalid answerId detected", () => {
  resetRegistry();
  const pack: ContentPack = {
    id: "test-bad-answer",
    name: "bad",
    version: "1.0.0",
    contentType: "reading",
    sourceId: MOCK_SOURCE.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "r1", title: "a", passage: "x",
        questions: [{ id: "q1", options: [{ id: "A" }, { id: "B" }], answerId: "C" }],
      },
    ],
  };
  const issues = validatePack(pack);
  assert.ok(issues.some((i) => i.message.includes("invalid answerId")));
});

test("selector: deterministic by seed", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const r1 = selectContent({ pool, limit: 2, seed: "day1", idOf: (x) => x.id });
  const r2 = selectContent({ pool, limit: 2, seed: "day1", idOf: (x) => x.id });
  assert.deepEqual(r1.items, r2.items);
});

test("selector: excludeIds filters", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const r = selectContent({ pool, limit: 5, seed: "x", excludeIds: new Set(["a", "b"]), idOf: (x) => x.id, allowRepeat: true });
  assert.ok(r.items.every((i) => i.id !== "a" && i.id !== "b"));
});

test("selector: fallback when pool small", () => {
  const pool = [{ id: "a" }];
  const r = selectContent({ pool, limit: 3, seed: "x", idOf: (x) => x.id });
  assert.equal(r.items.length, 1);
  assert.equal(r.fallbackReason, "pool_small");
});

test("repositories: getById works for all modules", () => {
  assert.ok(vocabularyRepository.all().length > 0);
  assert.ok(readingRepository.all().length > 0);
  assert.ok(listeningRepository.all().length > 0);
  assert.ok(translationRepository.all().length > 0);
  assert.ok(writingRepository.all().length > 0);

  const v = vocabularyRepository.all()[0];
  assert.equal(vocabularyRepository.getById(v.id)?.id, v.id);

  const r = readingRepository.all()[0];
  assert.equal(readingRepository.getById(r.id)?.id, r.id);
});

test("repositories: getByWord normalizes case", () => {
  const w = vocabularyRepository.all()[0];
  assert.equal(vocabularyRepository.getByWord(w.word.toUpperCase())?.id, w.id);
});

test("aliases: identity when no mapping", () => {
  assert.equal(resolveAlias("anything"), "anything");
  assert.ok(Array.isArray(listAliases()));
});

test("papers: validatePaper catches bad data", () => {
  assert.equal(validatePaper({ id: "p", examType: "CET6", year: 2025, month: 6, set: 1, sections: [], sourceId: "x", version: "1", status: "draft", authenticity: "past_exam" }).length > 0, true);
  assert.equal(validatePaper({ id: "p", examType: "CET6", year: 2025, month: 6, set: 1, sections: [{ kind: "reading", itemIds: ["r1"] }], sourceId: "x", version: "1", status: "draft", authenticity: "past_exam" }).length, 0);
});
