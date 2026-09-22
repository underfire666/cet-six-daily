import type { Word } from "@/types/vocabulary";
import type { ReadingArticle } from "@/types/reading";
import type { ListeningMaterial } from "@/types/listening";
import type { TranslationTask } from "@/types/translation";
import type { WritingTask } from "@/types/writing";
import { getActiveItems, getContentPack, getItems } from "./registry";
import { resolveAlias } from "./aliases";
import { registerBuiltinPacks } from "./packs";
import { normalizeWord } from "./normalize";

function ensureBootstrap() {
  registerBuiltinPacks();
}

function byId<T extends { id: string }>(type: string, id: string): T | undefined {
  ensureBootstrap();
  return getItems<T>(type).find(item => item.id === resolveAlias(id));
}

export const vocabularyRepository = {
  all(): Word[] {
    ensureBootstrap();
    return getActiveItems<Word>("vocabulary");
  },
  getById(id: string): Word | undefined {
    return byId<Word>("vocabulary", id);
  },
  getByWord(word: string): Word | undefined {
    const n = normalizeWord(word);
    return this.all().find((w) => normalizeWord(w.word) === n);
  },
  getByTag(tag: string): Word[] {
    return this.all().filter((w) => w.tags.includes(tag));
  },
  /** 1-5 → easy(1-2)/normal(3)/hard(4-5) */
  getByDifficulty(d: "easy" | "normal" | "hard"): Word[] {
    return this.all().filter((w) =>
      d === "easy" ? w.difficulty <= 2 : d === "normal" ? w.difficulty === 3 : w.difficulty >= 4,
    );
  },
  search(q: string): Word[] {
    const n = normalizeWord(q);
    if (!n) return [];
    return this.all().filter(
      (w) =>
        normalizeWord(w.word).includes(n) ||
        w.meaning.includes(q) ||
        w.secondaryMeanings.some((m) => m.includes(q)),
    );
  },
};

export const readingRepository = {
  all(): ReadingArticle[] {
    ensureBootstrap();
    return getActiveItems<ReadingArticle>("reading");
  },
  getById(id: string): ReadingArticle | undefined {
    return byId<ReadingArticle>("reading", id);
  },
  getByDifficulty(d: "easy" | "normal" | "hard"): ReadingArticle[] {
    return this.all().filter((a) => a.difficulty === d);
  },
  getByTag(tag: string): ReadingArticle[] {
    return this.all().filter((a) => (a as unknown as { tags?: string[] }).tags?.includes(tag));
  },
};

export const listeningRepository = {
  all(): ListeningMaterial[] {
    ensureBootstrap();
    return getActiveItems<ListeningMaterial>("listening");
  },
  getById(id: string): ListeningMaterial | undefined {
    return byId<ListeningMaterial>("listening", id);
  },
  getByDifficulty(d: "easy" | "normal" | "hard"): ListeningMaterial[] {
    return this.all().filter((m) => m.difficulty === d);
  },
};

export const translationRepository = {
  all(): TranslationTask[] {
    ensureBootstrap();
    return getActiveItems<TranslationTask>("translation");
  },
  getById(id: string): TranslationTask | undefined {
    return byId<TranslationTask>("translation", id);
  },
};

export const writingRepository = {
  all(): WritingTask[] {
    ensureBootstrap();
    return getActiveItems<WritingTask>("writing");
  },
  getById(id: string): WritingTask | undefined {
    return byId<WritingTask>("writing", id);
  },
};

/** 兼容旧 import：测试里直接拿 pack。 */
export { getContentPack };
