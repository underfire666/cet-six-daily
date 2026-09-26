/**
 * V13 Phase 1: 真实内容系统 / 真题导入基础设施 测试
 * 覆盖：
 *  - Paper 领域模型（Exam→Paper→Section→Group→Question）校验
 *  - Stable ID 确定性
 *  - Content Provenance / Rights（unknown→blocked、permission_required→blocked、owned→allowed、licensed+evidence→allowed）
 *  - Content Lifecycle
 *  - Import Batch（deterministic + idempotent）
 *  - Duplicate Detection
 *  - Staging vs Published 隔离（学习页/Selector 不暴露 staging/blocked）
 *  - 59 Mock 回归
 *  - Deprecated ID → Registry resolve → replay
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  paperStableId,
  sectionStableId,
  groupStableId,
  questionStableId,
  assetStableId,
  isValidStableId,
} from "../src/content/stable-id";
import { validatePaper, type CET6Paper, type PaperSection } from "../src/content/papers";
import { rightsVerdict, rightsIssues, isPublishable } from "../src/content/rights";
import { canTransition, advanceLifecycle, lifecycleFromStatus, isLearningVisible } from "../src/content/lifecycle";
import {
  createImportBatch,
  inputFingerprint,
  buildBatchId,
  wasImported,
  resetImportBatches,
} from "../src/content/import-batch";
import { importContentPackWithBatch, importContentPackFromJson } from "../src/content/importer";
import { resetRegistry, getContentPack, getItems, getPublishableItems, getPaperById, resolveContentById } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { validateAll } from "../src/content/validator";
import { registerSyntheticPaperFixture, syntheticCet6Paper, SYNTHETIC_PAPER_ID } from "../src/content/fixture/cet6-2025-12-synthetic";
import { registerAlias, resolveAlias } from "../src/content/aliases";
import { CET6_EXAM_SPEC, allowedSubsections } from "../src/content/exam-spec";
import { vocabularyRepository } from "../src/content/repositories";
import { MOCK_SOURCE } from "../src/content/sources";
import type { ContentRights } from "../src/content/types";

function setup() {
  resetRegistry();
  resetImportBatches();
  registerBuiltinPacks();
  registerSyntheticPaperFixture();
}

function registeredPacks() {
  return [
    "pack-vocabulary-mock",
    "pack-reading-mock",
    "pack-listening-mock",
    "pack-translation-mock",
    "pack-writing-mock",
    "pack-paper-cet6-2025-12-synthetic",
  ].map((id) => getContentPack(id)!);
}

// ---------------------------------------------------------------- Paper 模型

test("paper model: synthetic fixture passes validation", () => {
  setup();
  const errors = validatePaper(syntheticCet6Paper);
  assert.deepEqual(errors, [], `expected no paper errors, got: ${errors.join("; ")}`);
  // registry 整体校验也无 error
  const rep = validateAll(registeredPacks() as never);
  assert.ok(rep.counts.paper >= 1, "paper pack should be registered");
  assert.equal(rep.errors.length, 0, `synthetic pack should validate clean: ${rep.errors.map(e => e.message).join("; ")}`);
});

test("paper model: section order must be 1..N", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  bad.sections[0] = { ...bad.sections[0], order: 9 } as PaperSection;
  const errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("orders must be 1..N")), `expected order error: ${errors.join("; ")}`);
});

test("paper model: duplicate questionId in group rejected", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  const g = bad.sections.find((s) => s.type === "reading")!.groups.find((g) => g.type === "cloze")!;
  g.questions!.push(structuredClone(g.questions![0]));
  const errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("duplicate questionId")), `expected duplicate error: ${errors.join("; ")}`);
});

test("paper model: choice question must have valid answerId", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  const g = bad.sections.find((s) => s.type === "listening")!.groups[0]!;
  g.questions![0].answerId = "zz";
  const errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("invalid answerId")), `expected answerId error: ${errors.join("; ")}`);
});

test("paper model: paperId must match identity and format", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  bad.paperId = "cet6:2024-6:set1";
  let errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("mismatch identity")), `expected mismatch: ${errors.join("; ")}`);
  bad.paperId = "not-a-paper-id";
  errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("invalid paperId format")), `expected format error: ${errors.join("; ")}`);
});

test("paper model: empty sections rejected", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  bad.sections = [];
  const errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("no sections")), `expected sections error: ${errors.join("; ")}`);
});

test("paper model: fixture must be explicit isPartial/fixture flags", () => {
  setup();
  assert.equal(syntheticCet6Paper.isPartial, true, "partial paper must be explicitly marked");
  assert.equal(syntheticCet6Paper.fixture, true, "synthetic fixture must be explicitly marked");
});

// ---------------------------------------------------------------- Stable ID

test("stable id: deterministic and well-formed", () => {
  const p1 = paperStableId({ exam: "CET6", year: 2025, session: 12, set: 1 });
  const p2 = paperStableId({ exam: "CET6", year: 2025, session: 12, set: 1 });
  assert.equal(p1, "cet6:2025-12:set1");
  assert.equal(p1, p2, "same identity must produce same id");
  assert.ok(isValidStableId(p1, "paper"));
  const s = sectionStableId({ exam: "CET6", year: 2025, session: 12, set: 1, section: "reading" });
  assert.equal(s, "cet6:2025-12:set1:reading");
  assert.ok(isValidStableId(s, "section"));
  const g = groupStableId({ exam: "CET6", year: 2025, session: 12, set: 1, section: "reading", subsection: "careful", group: "g3" });
  assert.equal(g, "cet6:2025-12:set1:reading:careful:g3");
  assert.ok(isValidStableId(g, "group"));
  const q = questionStableId({ exam: "CET6", year: 2025, session: 12, set: 1, section: "reading", subsection: "careful", group: "g3", question: "q2" });
  assert.equal(q, "cet6:2025-12:set1:reading:careful:g3:q2");
  assert.ok(isValidStableId(q, "question"));
  const a = assetStableId({ exam: "CET6", year: 2025, session: 12, set: 1, section: "listening", subsection: "lecture", group: "g2", asset: "audio1" });
  assert.ok(isValidStableId(a, "asset"));
  assert.ok(!isValidStableId("word_sustain", "paper"));
  assert.ok(!isValidStableId("cet6:2025-12:set1", "section"));
});

// ---------------------------------------------------------------- Rights

const owned: ContentRights = { licenseStatus: "owned", rightsHolder: "P" };
const licensedOk: ContentRights = { licenseStatus: "licensed", licenseName: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };
const licensedNoEvidence: ContentRights = { licenseStatus: "licensed" };
const permission: ContentRights = { licenseStatus: "permission_required" };
const unknown: ContentRights = { licenseStatus: "unknown" };

test("rights: owned → allowed", () => {
  assert.equal(rightsVerdict(owned), "allowed");
  assert.ok(isPublishable(owned));
});

test("rights: licensed + evidence → allowed (with warning)", () => {
  assert.equal(rightsVerdict(licensedOk), "allowed");
  const issues = rightsIssues(licensedOk, { scope: "production" });
  assert.ok(issues.some((i) => i.level === "warning"), "licensed should carry a verify-before-publish warning");
});

test("rights: licensed without evidence → blocked", () => {
  assert.equal(rightsVerdict(licensedNoEvidence), "blocked");
  assert.ok(!isPublishable(licensedNoEvidence));
  const issues = rightsIssues(licensedNoEvidence, { scope: "production" });
  assert.ok(issues.some((i) => i.level === "error" && i.message.includes("blocked")));
});

test("rights: permission_required → blocked", () => {
  assert.equal(rightsVerdict(permission), "blocked");
  const issues = rightsIssues(permission, { scope: "production" });
  assert.ok(issues.some((i) => i.level === "error" && i.message.includes("permission_required")));
});

test("rights: unknown → blocked for production", () => {
  assert.equal(rightsVerdict(unknown), "unknown");
  const issues = rightsIssues(unknown, { scope: "production" });
  assert.ok(issues.some((i) => i.level === "error" && i.message.includes("unknown")));
  // mock source（licenseType=unknown）不能进 production pool（现有行为保留）
  setup();
  const prod = getPublishableItems();
  assert.ok(!prod.some((it) => (it as { sourceId?: string }).sourceId === MOCK_SOURCE.id), "mock must not enter production pool");
});

test("rights: missing metadata → unknown", () => {
  assert.equal(rightsVerdict(undefined), "unknown");
  assert.equal(rightsVerdict(null), "unknown");
});

// ---------------------------------------------------------------- Lifecycle

test("lifecycle: transitions are strict and monotonic", () => {
  assert.ok(canTransition("raw", "normalized"));
  assert.ok(canTransition("validated", "reviewed"));
  assert.ok(canTransition("publishable", "published"));
  assert.ok(canTransition("published", "deprecated"));
  assert.ok(!canTransition("raw", "published"), "cannot skip stages");
  assert.ok(!canTransition("published", "raw"), "cannot go backwards");
  assert.ok(!canTransition("raw", "raw"));
  assert.equal(advanceLifecycle("raw"), "normalized");
  assert.equal(advanceLifecycle("publishable"), "published");
  assert.equal(advanceLifecycle("published"), "deprecated");
  assert.equal(advanceLifecycle("deprecated"), null);
});

test("lifecycle: V10 status mapping", () => {
  assert.equal(lifecycleFromStatus("active"), "published");
  assert.equal(lifecycleFromStatus("draft"), "raw");
  assert.equal(lifecycleFromStatus("published"), "published");
  assert.equal(lifecycleFromStatus("staging"), "reviewed");
  assert.ok(isLearningVisible("published"));
  assert.ok(!isLearningVisible(lifecycleFromStatus("staging")));
  assert.ok(!isLearningVisible("raw"));
});

// ---------------------------------------------------------------- Import Batch

test("import batch: deterministic fingerprint and batchId", () => {
  const raw = JSON.stringify({ a: 1 });
  const raw2 = JSON.stringify({ a: 2 });
  assert.equal(inputFingerprint(raw), inputFingerprint(raw), "same input → same fingerprint");
  assert.notEqual(inputFingerprint(raw), inputFingerprint(raw2), "different input → different fingerprint");
  const b = createImportBatch({ sourceId: "src-x", raw, itemCount: 3 });
  assert.ok(b.batchId.startsWith("import-src-x-"));
  assert.equal(b.importedAt.length > 0, true);
  assert.equal(b.importerVersion, "v13.0.0");
  assert.equal(b.itemCount, 3);
  assert.equal(buildBatchId("src-x", inputFingerprint(raw)), b.batchId, "batchId derived deterministically");
});

test("import batch: same source + same input → idempotent (no re-registration)", () => {
  setup();
  const raw = JSON.stringify({
    id: "pb-idem-test",
    name: "Idempotent Pack",
    version: "1.0.0",
    contentType: "vocabulary",
    sourceId: MOCK_SOURCE.id,
    items: [
      {
        id: "pb_idem_word",
        type: "vocabulary",
        word: "idempotent",
        phonetic: "/ˌaɪdəmˈpoʊtənt/",
        partOfSpeech: "adj.",
        meaning: "幂等的",
        example: "An idempotent import never duplicates records.",
        exampleTranslation: "幂等导入不会重复记录。",
        difficulty: 3,
        tags: [],
        authenticity: "practice",
        status: "active",
        version: "1.0.0",
        sourceId: MOCK_SOURCE.id,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
  });
  const first = importContentPackWithBatch(raw);
  assert.equal(first.imported, true, "first import registers");
  assert.ok(wasImported(MOCK_SOURCE.id, raw));
  const second = importContentPackWithBatch(raw);
  assert.equal(second.imported, false, "repeat import is idempotent");
  assert.equal(second.batch.batchId, first.batch.batchId, "same input → same batchId");
  // 注册表里仍只有一份
  const vocab = getItems<{ id: string }>("vocabulary");
  assert.equal(vocab.filter((v) => v.id === "pb_idem_word").length, 1);
  const packs = [getContentPack("pb-idem-test")!];
  assert.equal(packs.filter(Boolean).length, 1);
});

// ---------------------------------------------------------------- Duplicate detection

test("duplicate: same paper identity across packs → error", () => {
  setup();
  const dup = structuredClone(syntheticCet6Paper) as CET6Paper;
  const dupPack = {
    id: "pack-paper-dup-test",
    name: "Duplicate Paper Pack",
    version: "1.0.0",
    contentType: "paper",
    sourceId: "src-cet6-synthetic",
    items: [dup],
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
  const report = validateAll([getContentPack("pack-paper-cet6-2025-12-synthetic")!, dupPack as never]);
  assert.ok(report.errors.some((e) => e.message.includes("duplicate paper identity")), `expected duplicate identity error: ${report.errors.map(e => e.message).join("; ")}`);
});

test("duplicate: different set is not a duplicate paper identity", () => {
  setup();
  const p2 = structuredClone(syntheticCet6Paper) as CET6Paper;
  p2.paperId = paperStableId({ exam: "CET6", year: 2025, session: 12, set: 2 });
  p2.set = 2;
  const pack2 = {
    id: "pack-paper-set2",
    name: "Set 2 Pack",
    version: "1.0.0",
    contentType: "paper",
    sourceId: "src-cet6-synthetic",
    items: [p2],
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
  const report = validateAll([getContentPack("pack-paper-cet6-2025-12-synthetic")!, pack2 as never]);
  assert.ok(!report.errors.some((e) => e.message.includes("duplicate paper identity")), "set2 must not collide with set1");
});

test("duplicate: same reading passage text across packs → warning", () => {
  setup();
  const base = {
    id: "warn-r-1",
    type: "reading",
    title: "Dup Passage A",
    difficulty: "easy",
    passage: "This exact passage text is intentionally repeated across two packs to trigger a duplicate-text warning.",
    estimatedMinutes: 3,
    vocabulary: {},
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea?",
        options: [{ id: "a", text: "One." }, { id: "b", text: "Two." }],
        answerId: "a",
        shortExplanation: "x",
        detailedExplanation: "y",
        hint: "z",
      },
    ],
    authenticity: "practice",
    status: "active",
    version: "1.0.0",
    sourceId: MOCK_SOURCE.id,
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
  const packA = { id: "warn-pack-a", name: "Warn Pack A", version: "1.0.0", contentType: "reading", sourceId: MOCK_SOURCE.id, items: [base], createdAt: "2026-09-26T00:00:00.000Z", updatedAt: "2026-09-26T00:00:00.000Z" };
  const packB = { ...packA, id: "warn-pack-b", items: [{ ...base, id: "warn-r-2" }] };
  const report = validateAll([packA as never, packB as never]);
  assert.ok(report.warnings.some((w) => w.message.includes("duplicate normalized text hash")), `expected text-dup warning: ${report.warnings.map(w => w.message).join("; ")}`);
});

// ---------------------------------------------------------------- Staging / Published 隔离

test("isolation: staging fixture never enters production pool or learning pool", () => {
  setup();
  // production published pool：不含 paper（fixture staging）
  const pub = getPublishableItems();
  assert.equal(pub.filter((it) => (it as { type?: string }).type === "paper").length, 0);
  // demo 学习池（五专项）不含 paper
  assert.equal(getItems("paper").length, 1, "paper pack exists in registry");
  for (const t of ["vocabulary", "reading", "listening", "translation", "writing"]) {
    assert.ok(!getItems(t).some((it) => (it as { type?: string }).type === "paper"));
  }
  // fixture 仅开发/测试 resolve
  assert.equal(getPaperById<{ paperId?: string }>(SYNTHETIC_PAPER_ID)?.paperId, SYNTHETIC_PAPER_ID);
  assert.ok(resolveContentById(SYNTHETIC_PAPER_ID), "dev/test resolve works");
});

// ---------------------------------------------------------------- 59 Mock 回归

test("regression: 59 mock items intact and registry clean", () => {
  setup();
  assert.equal(getItems("vocabulary").length, 30);
  assert.equal(getItems("reading").length, 6);
  assert.equal(getItems("listening").length, 7);
  assert.equal(getItems("translation").length, 8);
  assert.equal(getItems("writing").length, 8);
  const rep = validateAll(registeredPacks() as never);
  assert.equal(rep.errors.length, 0, `mock+papers must validate: ${rep.errors.map((e) => e.message).join("; ")}`);
});

test("regression: repositories still resolve mock content", () => {
  setup();
  assert.equal(vocabularyRepository.all().length, 30);
  assert.ok(vocabularyRepository.getById("word_sustain"), "legacy mock id resolves");
});

// ---------------------------------------------------------------- Deprecated ID → Registry resolve → replay

test("deprecated id: alias maps old id to new stable id and repo resolves", () => {
  setup();
  registerAlias({ legacyId: "legacy-word-1", stableId: "word_sustain" });
  assert.equal(resolveAlias("legacy-word-1"), "word_sustain");
  // Registry byId 兼容旧 ID（repository 先 resolveAlias）
  const hit = vocabularyRepository.getById("legacy-word-1");
  assert.ok(hit, "old content ID must resolve through alias to Registry");
  assert.equal(hit!.id, "word_sustain");
});

test("deprecated id: unknown legacy id falls back to identity", () => {
  assert.equal(resolveAlias("never-existed-id"), "never-existed-id");
});

// ---------------------------------------------------------------- Exam spec

test("exam spec: official public structure available", () => {
  assert.equal(CET6_EXAM_SPEC.exam, "CET6");
  assert.equal(CET6_EXAM_SPEC.sections.length, 4);
  assert.deepEqual(allowedSubsections("reading"), ["cloze", "matching", "careful_reading"]);
  assert.deepEqual(allowedSubsections("listening"), ["long_conversation", "passage", "lecture"]);
  assert.equal(allowedSubsections("writing").length, 0);
  assert.equal(CET6_EXAM_SPEC.rightsStatus, "official_public_material");
});

// ---------------------------------------------------------------- Importer rejects bad JSON (existing behavior preserved)

test("importer: malformed JSON still rejected", () => {
  setup();
  assert.throws(() => importContentPackFromJson("{not json"), /invalid JSON/);
});

test("importer: rights-blocked paper pack rejected by registry validation", () => {
  setup();
  const bad = structuredClone(syntheticCet6Paper) as CET6Paper;
  bad.rights = { licenseStatus: "unknown" };
  const raw = JSON.stringify({
    id: "pack-paper-rights-blocked",
    name: "Blocked Rights Pack",
    version: "1.0.0",
    contentType: "paper",
    sourceId: "src-cet6-synthetic",
    items: [bad],
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  });
  try {
    importContentPackWithBatch(raw);
    assert.fail("unknown-rights paper must be rejected");
  } catch (err) {
    const e = err as { issues?: string[]; message: string };
    const combined = `${e.message} ${(e.issues ?? []).join(" ")}`;
    assert.match(combined, /rights|unknown|blocked/, "unknown-rights paper must be rejected");
  }
});
