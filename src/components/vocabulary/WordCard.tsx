"use client";
import { useEffect, useState } from "react";
import { Volume2, Bookmark, Check } from "lucide-react";
import type { Word } from "@/types/vocabulary";
import { speakWord, stopWordAudio } from "@/lib/vocabulary/wordAudio";
export function WordAudioButton({ word }: { word: Word }) {
  const [notice, setNotice] = useState("");
  useEffect(() => () => stopWordAudio(), []);
  return (
    <div className="word-audio">
      <button
        className="exercise-icon-button"
        aria-label={`播放 ${word.word} 发音`}
        onClick={() => {
          setNotice("");
          void speakWord(word.word, word.audio).then((ok) => {
            if (!ok) setNotice("当前发音不可用，请稍后再试。");
          });
        }}
      >
        <Volume2 size={22} />
      </button>
      {notice && <span role="status">{notice}</span>}
    </div>
  );
}
export function WordCard({
  word,
  saved,
  onBookmark,
}: {
  word: Word;
  saved: boolean;
  onBookmark: () => void;
}) {
  return (
    <article className="word-card">
      <div className="word-card-heading">
        <div>
          <span className="exercise-eyebrow">记住这个单词</span>
          <h1 lang="en">{word.word}</h1>
        </div>
        <WordAudioButton word={word} />
      </div>
      <p className="word-phonetic">
        {word.phonetic} <span>{word.partOfSpeech}</span>
      </p>
      <h2>{word.meaning}</h2>
      <div className="word-example">
        <span>例句</span>
        <p lang="en">{word.example}</p>
        <p>{word.exampleTranslation}</p>
      </div>
      {word.secondaryMeanings.length > 0 && (
        <p className="exercise-subtle">
          其他常见义：{word.secondaryMeanings.join("；")}
        </p>
      )}
      <button className="word-bookmark" onClick={onBookmark}>
        {saved ? <Check size={17} /> : <Bookmark size={17} />}{" "}
        {saved ? "已加入生词本" : "加入生词本"}
      </button>
    </article>
  );
}
