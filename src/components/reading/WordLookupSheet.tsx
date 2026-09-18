"use client";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";
import { LessonDialog } from "../lesson/LessonDialog";
import type { ReadingArticle } from "@/types/reading";

export function WordLookupSheet({
  article,
  wordKey,
  saved,
  onAdd,
  onClose,
}: {
  article: ReadingArticle;
  wordKey: string;
  saved: boolean;
  onAdd: (wordKey: string) => void;
  onClose: () => void;
}) {
  const entry = article.vocabulary[wordKey];
  return (
    <LessonDialog title="查词" onClose={onClose}>
      {entry ? (
        <div className="reading-lookup">
          <div className="reading-lookup-word">{entry.word}</div>
          <div className="reading-lookup-phonetic">
            {entry.phonetic} · {entry.partOfSpeech}
          </div>
          <div className="reading-lookup-meaning">{entry.meaning}</div>
          <div className="reading-lookup-sentence">
            {entry.sentence}
            <small>{entry.sentenceTranslation}</small>
          </div>
          <button
            className="exercise-button"
            disabled={saved}
            onClick={() => onAdd(wordKey)}
          >
            {saved ? (
              <>
                <BookmarkCheck size={18} />
                已加入生词
              </>
            ) : (
              <>
                <BookmarkPlus size={18} />
                加入生词
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="reading-lookup-missing">
          这篇示例文章暂未收录该词的释义。阅读即收获，继续往下读吧。
        </div>
      )}
    </LessonDialog>
  );
}
