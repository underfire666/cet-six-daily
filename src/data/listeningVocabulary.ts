import type { Word } from "@/types/vocabulary";
import { mockListeningMaterials } from "./mockListening";

const createdAt = "2026-09-20T00:00:00.000Z";

export const listeningVocabulary: Word[] = (() => {
  const map = new Map<string, Word>();
  for (const material of mockListeningMaterials)
    for (const [key, entry] of Object.entries(material.vocabulary)) {
      const id = `lw_${key.toLowerCase()}`;
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
        source: "listening",
        createdAt,
      });
    }
  return [...map.values()];
})();

export const listeningWordByKey = (key: string) =>
  listeningVocabulary.find(
    (word) => word.word.toLowerCase() === key.toLowerCase(),
  );

export const listeningWordById = (id: string) =>
  listeningVocabulary.find((word) => word.id === id);
