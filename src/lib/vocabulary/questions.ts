import type { LessonDefinition, Option, Question } from "@/types/question";
import type {
  UserVocabularyState,
  VocabularyQuestionType,
  Word,
} from "@/types/vocabulary";
import { vocabularyExercises } from "@/data/mockVocabularyExercises";

function choices(
  answer: Word,
  words: Word[],
  field: "word" | "meaning",
): Option[] {
  const distractors = vocabularyExercises[answer.word].distractors.map(
    (name) => words.find((w) => w.word === name)!,
  );
  return [answer, ...distractors]
    .map((item) => ({ id: item.id, text: item[field] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function questionTypeFor(
  state: UserVocabularyState | undefined,
  index: number,
): VocabularyQuestionType {
  return ["en_to_zh", "zh_to_en", "sentence_blank"][
    (index + (state?.reviewCount ?? 0)) % 3
  ] as VocabularyQuestionType;
}
export function vocabularyQuestion(
  word: Word,
  words: Word[],
  type: VocabularyQuestionType,
): Question {
  const common = {
    id: `vq:${word.id}`,
    module: "vocabulary" as const,
    answerId: word.id,
    explanation: `${word.word} ${word.partOfSpeech} 表示“${word.meaning}”。`,
    details: `${word.example} ${word.exampleTranslation}${word.secondaryMeanings.length ? ` 其他常见义：${word.secondaryMeanings.join("；")}。` : ""}`,
    hint: `先结合词性 ${word.partOfSpeech} 和句子语境判断。`,
  };
  if (type === "zh_to_en")
    return {
      ...common,
      type: "choice",
      prompt: `“${word.meaning}”对应哪个单词？`,
      options: choices(word, words, "word"),
    };
  if (type === "sentence_blank")
    return {
      ...common,
      type: "fill_blank",
      prompt: "选择合适的词，补全句子",
      sentence: vocabularyExercises[word.word].sentence,
      options: choices(word, words, "word"),
    };
  return {
    ...common,
    type: "choice",
    prompt: `${word.word} 最接近的意思是？`,
    options: choices(word, words, "meaning"),
  };
}
export function vocabularyLesson(
  wordIds: string[],
  allWords: Word[],
  states: Record<string, UserVocabularyState>,
): LessonDefinition {
  const words = wordIds
    .map((id) => allWords.find((word) => word.id === id))
    .filter((word): word is Word => !!word);
  return {
    id: `vocabulary:${wordIds.join(",")}`,
    version: 1,
    title: "词汇专项",
    minutes: Math.max(3, words.length * 2),
    questions: words.map((word, index) =>
      vocabularyQuestion(
        word,
        allWords,
        questionTypeFor(states[word.id], index),
      ),
    ),
  };
}
