import test from "node:test";
import assert from "node:assert/strict";
import {
  ContentImportError,
  importContentPackFromJson,
  importAndRegisterContentPack,
} from "../src/content/importer";
import { resetRegistry, getContentPack, getItems } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { MOCK_SOURCE } from "../src/content/sources";

// 在 import 前先 reset 再注册内置 pack（与 content.test.ts 相同的前置）
function setup() {
  resetRegistry();
  registerBuiltinPacks();
}

const vocabPack = {
  id: "importer-vocab-test",
  name: "Importer Vocabulary Test",
  version: "1.0.0",
  contentType: "vocabulary",
  sourceId: MOCK_SOURCE.id,
  items: [
    {
      id: "ivt_alpha",
      type: "vocabulary",
      word: "alpha",
      phonetic: "/ˈælfə/",
      partOfSpeech: "n.",
      meaning: "第一个；开端",
      example: "Alpha is the first letter of the Greek alphabet.",
      exampleTranslation: "Alpha 是希腊字母表中的第一个字母。",
      difficulty: 2,
      tags: ["greek"],
      authenticity: "practice",
      status: "active",
      version: "1.0.0",
      sourceId: MOCK_SOURCE.id,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
};

const readingPack = {
  id: "importer-reading-test",
  name: "Importer Reading Test",
  version: "1.0.0",
  contentType: "reading",
  sourceId: MOCK_SOURCE.id,
  items: [
    {
      id: "irt_1",
      type: "reading",
      title: "A Short Imported Passage",
      difficulty: "easy",
      passage: "This is a short passage used by the importer test.",
      estimatedMinutes: 3,
      vocabulary: {
        importer: { word: "importer", phonetic: "/ɪmˈpɔːtə/", partOfSpeech: "n.", meaning: "导入器", sentence: "The importer works.", sentenceTranslation: "导入器正常运作。" },
      },
      questions: [
        {
          id: "q1",
          prompt: "What is the passage about?",
          options: [
            { id: "a", text: "Imported content" },
            { id: "b", text: "Nothing" },
          ],
          answerId: "a",
          shortExplanation: "The passage mentions the importer.",
          detailedExplanation: "The passage is a test fixture.",
          hint: "Look at the first sentence.",
        },
      ],
      status: "active",
      version: "1.0.0",
      sourceId: MOCK_SOURCE.id,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
};

test("importer: valid vocabulary JSON imports and registers without touching pages", () => {
  setup();
  const pack = importAndRegisterContentPack(JSON.stringify(vocabPack));
  assert.equal(pack.id, "importer-vocab-test");
  assert.ok(getContentPack("importer-vocab-test"));
  const items = getItems("vocabulary");
  assert.ok(items.some((i) => (i as { id: string }).id === "ivt_alpha"));
});

test("importer: missing metadata gets safe defaults (status/authenticity/sourceId/type)", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  const item = raw.items[0];
  delete item.status;
  delete item.authenticity;
  delete item.sourceId;
  delete item.type;
  const pack = importContentPackFromJson(JSON.stringify(raw));
  const imported = pack.items[0] as Record<string, unknown>;
  assert.equal(imported.status, "active");
  assert.equal(imported.authenticity, "practice");
  assert.equal(imported.sourceId, MOCK_SOURCE.id);
  assert.equal(imported.type, "vocabulary");
});

test("importer: valid reading JSON with options/answerId imports", () => {
  setup();
  const pack = importAndRegisterContentPack(JSON.stringify(readingPack));
  assert.equal(pack.contentType, "reading");
  assert.ok(getItems("reading").some((i) => (i as { id: string }).id === "irt_1"));
});

test("importer: rejects invalid JSON", () => {
  setup();
  assert.throws(() => importContentPackFromJson("{not json"), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.match(e.message, /invalid JSON/);
    return true;
  });
});

test("importer: rejects missing pack id", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  delete raw.id;
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), ContentImportError);
});

test("importer: rejects item missing id", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  delete raw.items[0].id;
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.ok(e.issues.some((m) => m.includes("item missing id")));
    return true;
  });
});

test("importer: rejects unknown source", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  raw.sourceId = "source-that-does-not-exist";
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.ok(e.issues.some((m) => m.includes("unknown sourceId")));
    return true;
  });
});

test("importer: rejects duplicate item id within a pack", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  raw.items.push({ ...raw.items[0], id: "ivt_alpha" });
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.ok(e.issues.some((m) => m.includes("duplicate id")));
    return true;
  });
});

test("importer: rejects invalid correctAnswer", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(readingPack));
  raw.items[0].questions[0].answerId = "z";
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.ok(e.issues.some((m) => m.includes("invalid answerId")));
    return true;
  });
});

test("importer: rejects invalid contentType", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  raw.contentType = "game";
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), (e) => {
    assert.ok(e instanceof ContentImportError);
    assert.ok(e.message.includes("invalid contentType"));
    return true;
  });
});

test("importer: rejects duplicate pack id on register", () => {
  setup();
  importAndRegisterContentPack(JSON.stringify(vocabPack));
  const again = JSON.parse(JSON.stringify(vocabPack));
  again.id = "importer-vocab-test";
  assert.throws(() => importAndRegisterContentPack(JSON.stringify(again)), /duplicate pack id/);
});

test("importer: rejects duplicate item id across packs on register", () => {
  setup();
  importAndRegisterContentPack(JSON.stringify(vocabPack));
  const raw = JSON.parse(JSON.stringify(vocabPack));
  raw.id = "importer-vocab-other";
  raw.items[0].id = "ivt_alpha"; // 与已注册 pack 的 item 重复
  assert.throws(() => importAndRegisterContentPack(JSON.stringify(raw)), /duplicate id across packs/);
});

test("importer: invalid vocabulary difficulty is rejected", () => {
  setup();
  const raw = JSON.parse(JSON.stringify(vocabPack));
  raw.items[0].difficulty = 9;
  assert.throws(() => importContentPackFromJson(JSON.stringify(raw)), ContentImportError);
});
