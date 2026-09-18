import type { Word } from "@/types/vocabulary";
import { mockReadingArticles } from "./mockReading";

const createdAt = "2026-09-18T00:00:00.000Z";

export const readingVocabulary: Word[] = (() => {
  const map = new Map<string, Word>();
  for (const article of mockReadingArticles)
    for (const [key, entry] of Object.entries(article.vocabulary)) {
      const id = `rw_${key.toLowerCase()}`;
      if (map.has(id)) continue;
      map.set(id, {
        id,
        word: entry.word,
        phonetic: entry.phonetic,
        partOfSpeech: entry.partOfSpeech,
        meaning: entry.meaning,
        secondaryMeanings: [],
        example: entry.sentence,
        exampleTranslation: entry.sentenceTranslation,
        difficulty: 2,
        tags: [],
        source: "reading",
        createdAt,
      });
    }
  return [...map.values()];
})();

export const readingWordByKey = (key: string) =>
  readingVocabulary.find(
    (word) => word.word.toLowerCase() === key.toLowerCase(),
  );

export const readingWordById = (id: string) =>
  readingVocabulary.find((word) => word.id === id);
