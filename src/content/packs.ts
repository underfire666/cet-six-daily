import { mockVocabulary } from "@/data/mockVocabulary";
import { mockReadingArticles } from "@/data/mockReading";
import { mockListeningMaterials } from "@/data/mockListening";
import { mockTranslationTasks } from "@/data/mockTranslation";
import { mockWritingTasks } from "@/data/mockWriting";
import { registerContentPack } from "./registry";
import { MOCK_SOURCE } from "./sources";
import type { ContentPack } from "./types";

/** 把现有 Mock 数据注册为 ContentPack。source.type=mock, license=unknown。 */
export function registerBuiltinPacks(): void {
  const now = new Date().toISOString();

  const vocab: ContentPack = {
    id: "pack-vocabulary-mock",
    name: "CET-6 Vocabulary (Mock)",
    version: "1.0.0",
    contentType: "vocabulary",
    sourceId: MOCK_SOURCE.id,
    items: mockVocabulary,
    createdAt: now,
    updatedAt: now,
  };

  const reading: ContentPack = {
    id: "pack-reading-mock",
    name: "CET-6 Reading (Mock)",
    version: "1.0.0",
    contentType: "reading",
    sourceId: MOCK_SOURCE.id,
    items: mockReadingArticles,
    createdAt: now,
    updatedAt: now,
  };

  const listening: ContentPack = {
    id: "pack-listening-mock",
    name: "CET-6 Listening (Mock)",
    version: "1.0.0",
    contentType: "listening",
    sourceId: MOCK_SOURCE.id,
    items: mockListeningMaterials,
    createdAt: now,
    updatedAt: now,
  };

  const translation: ContentPack = {
    id: "pack-translation-mock",
    name: "CET-6 Translation (Mock)",
    version: "1.0.0",
    contentType: "translation",
    sourceId: MOCK_SOURCE.id,
    items: mockTranslationTasks,
    createdAt: now,
    updatedAt: now,
  };

  const writing: ContentPack = {
    id: "pack-writing-mock",
    name: "CET-6 Writing (Mock)",
    version: "1.0.0",
    contentType: "writing",
    sourceId: MOCK_SOURCE.id,
    items: mockWritingTasks,
    createdAt: now,
    updatedAt: now,
  };

  for (const pack of [vocab, reading, listening, translation, writing]) {
    registerContentPack(pack);
  }
}
