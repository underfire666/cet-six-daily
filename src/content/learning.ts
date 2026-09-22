/** Application-facing adapters. Keep legacy IDs intact, including lookup words. */
import { vocabularyRepository, readingRepository, listeningRepository, translationRepository, writingRepository } from "./repositories";
import { getItems } from "./registry";
import { registerBuiltinPacks } from "./packs";
import type { Word } from "@/types/vocabulary";
import type { ReadingArticle } from "@/types/reading";
import type { ListeningMaterial } from "@/types/listening";
export { vocabularySettings } from "@/data/mockVocabulary";
export const getVocabulary = () => vocabularyRepository.all();
export const getReadingArticles = () => readingRepository.all();
export const getListeningMaterials = () => listeningRepository.all();
export const getTranslationTasks = () => translationRepository.all();
export const getWritingTasks = () => writingRepository.all();
export const readingArticleById = (id: string) => readingRepository.getById(id);
export const listeningMaterialById = (id: string) => listeningRepository.getById(id);
export const translationTaskById = (id: string) => translationRepository.getById(id);
export const writingTaskById = (id: string) => writingRepository.getById(id);

function lookupWords(source: "reading" | "listening"): Word[] {
  registerBuiltinPacks();
  const items = getItems<ReadingArticle | ListeningMaterial>(source);
  const words = new Map<string,Word>();
  for (const item of items) for (const [key,entry] of Object.entries(item.vocabulary)) {
    const id = `${source === "reading" ? "rw" : "lw"}_${key.toLowerCase()}`;
    if (!words.has(id)) words.set(id, { id, word:entry.word, phonetic:entry.phonetic, partOfSpeech:entry.partOfSpeech, meaning:entry.meaning, secondaryMeanings:[], example:entry.sentence, exampleTranslation:entry.sentenceTranslation, difficulty:2, tags:[], source, createdAt:"2026-09-18T00:00:00.000Z" });
  }
  return [...words.values()];
}
export const readingWordById = (id: string) => lookupWords("reading").find(w=>w.id===id);
export const listeningWordById = (id: string) => lookupWords("listening").find(w=>w.id===id);
export const readingWordByKey = (key: string) => lookupWords("reading").find(w=>w.word.toLowerCase()===key.toLowerCase());
export const listeningWordByKey = (key: string) => lookupWords("listening").find(w=>w.word.toLowerCase()===key.toLowerCase());
export const wordById = (id: string) => vocabularyRepository.getById(id) ?? readingWordById(id) ?? listeningWordById(id);
export const getHistoricalVocabulary = () => { registerBuiltinPacks(); return [...getItems<Word>("vocabulary"), ...lookupWords("reading"), ...lookupWords("listening")]; };
