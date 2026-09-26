"use client";
import { wordById } from "@/content/learning";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookMarked } from "lucide-react";

import { useVocabulary } from "./VocabularyProvider";
import { WordCard, WordAudioButton } from "./WordCard";
import { VocabularyHeading } from "./VocabularyHeading";
import { LessonDialog } from "../lesson/LessonDialog";
import { useLocalPracticeRoute } from "@/components/practice/useLocalPracticeRoute";
import { VocabularyPlayer } from "./VocabularyPlayer";
import { VocabularyComplete } from "./VocabularyComplete";
export const masteryLabels = {
  new: "尚未学习",
  learning: "学习中",
  weak: "需要加强",
  reviewing: "复习中",
  mastered: "基本掌握",
};
export const sourceLabels = {
  vocabulary: "词汇",
  reading: "阅读",
  listening: "听力",
};
export function WordbookList({ onSession, onHome }: { onSession?: (id: string) => void; onHome?: () => void } = {}) {
  const route = useLocalPracticeRoute("vocabulary", "/practice/vocabulary/wordbook");
  const router = useRouter();
  if (!onSession && route.stage.kind === "session") {
    const id = route.stage.id;
    return <VocabularyPlayer id={id} onComplete={() => route.openComplete(id)} onExit={route.goHome} />;
  }
  if (!onSession && route.stage.kind === "complete")
    return <VocabularyComplete id={route.stage.id} onSession={route.openSession} onHome={route.goHome} onWordbook={route.goHome} />;
  return <WordbookHome onSession={onSession ?? route.openSession} onHome={onHome ?? (() => router.push("/practice/vocabulary"))} />;
}

function WordbookHome({ onSession, onHome }: { onSession: (id: string) => void; onHome: () => void }) {
  const { ready, store, wordbook, start, toggleWordbook, notice } =
    useVocabulary();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const words = wordbook
    .map((s) => wordById(s.wordId)!)
    .filter(
      (w) =>
        w.word.toLowerCase().includes(search.trim().toLowerCase()) ||
        w.meaning.includes(search.trim()),
    );
  const word = selected ? wordById(selected) : undefined,
    state = selected ? store.states[selected] : undefined;
  const begin = (id?: string) => {
    const session = start(id ? "single_review" : "wordbook_review", id);
    if (session) onSession(session);
  };
  return (
    <main className="vocabulary-page">
      <VocabularyHeading title="我的生词" onBack={onHome} />
      {notice && <p className="exercise-notice">{notice}</p>}
      <div className="wordbook-summary">
        <p>{wordbook.length} 个生词</p>
        <button
          className="vocabulary-link"
          disabled={!ready || !wordbook.length}
          onClick={() => begin()}
        >
          复习生词 →
        </button>
      </div>
      <label className="wordbook-search">
        <Search size={20} />
        <input
          aria-label="搜索单词"
          placeholder="搜索单词或释义"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="wordbook-list">
        {words.map((w) => (
          <article key={w.id} className="wordbook-item">
            <div className="wordbook-item-top">
              <button
                onClick={() => setSelected(w.id)}
                className="wordbook-word"
                aria-label={`查看 ${w.word} 详情`}
              >
                <strong lang="en">{w.word}</strong>
                <span>
                  {w.phonetic} · {w.partOfSpeech}
                </span>
              </button>
              <WordAudioButton word={w} />
            </div>
            <p>{w.meaning}</p>
            <div className="wordbook-item-bottom">
              <span>来源：{sourceLabels[store.states[w.id].source]}</span>
              <button
                onClick={() => toggleWordbook(w.id)}
                aria-label={`将 ${w.word} 移出生词本`}
              >
                移出生词本
              </button>
            </div>
          </article>
        ))}
      </div>
      {!words.length && (
        <div className="vocabulary-empty">
          <BookMarked size={30} />
          <h2>
            {wordbook.length ? "没有找到这个单词" : "把想记住的词，留在这里"}
          </h2>
          <p>
            {wordbook.length
              ? "换个关键词试试。"
              : "学习词卡时，点击“加入生词本”。"}
          </p>
        </div>
      )}
      {word && state && (
        <LessonDialog title="生词详情" onClose={() => setSelected(null)}>
          <WordCard
            word={word}
            saved={state.addedToWordbook}
            onBookmark={() => toggleWordbook(word.id)}
          />
          <dl className="word-detail-meta">
            <div>
              <dt>掌握状态</dt>
              <dd>{masteryLabels[state.masteryStatus]}</dd>
            </div>
            <div>
              <dt>来源</dt>
              <dd>{sourceLabels[state.source]}</dd>
            </div>
            <div>
              <dt>下次复习</dt>
              <dd>
                {state.nextReviewAt
                  ? new Intl.DateTimeFormat("zh-CN", {
                      timeZone: "Asia/Shanghai",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(state.nextReviewAt))
                  : "学习后安排"}
              </dd>
            </div>
          </dl>
          <button className="exercise-button" onClick={() => begin(word.id)}>
            复习这个单词
          </button>
        </LessonDialog>
      )}
    </main>
  );
}
