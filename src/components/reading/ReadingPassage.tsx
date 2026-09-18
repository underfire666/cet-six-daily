"use client";
import type { ReadingArticle } from "@/types/reading";

const difficultyLabel: Record<string, string> = {
  easy: "基础",
  normal: "进阶",
  hard: "挑战",
};

function tokenize(passage: string): { text: string; wordKey?: string }[] {
  const tokens: { text: string; wordKey?: string }[] = [];
  const regex = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  let last = 0;
  for (const match of passage.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: passage.slice(last, index) });
    tokens.push({ text: match[0], wordKey: match[0].toLowerCase() });
    last = index + match[0].length;
  }
  if (last < passage.length) tokens.push({ text: passage.slice(last) });
  return tokens;
}

export function ReadingPassage({
  article,
  onWordClick,
}: {
  article: ReadingArticle;
  onWordClick?: (wordKey: string) => void;
}) {
  const paragraphs = article.passage.split(/\n\n+/);
  return (
    <article className="reading-passage">
      <div className="reading-meta">
        <span>mock 文章</span>·<span>{difficultyLabel[article.difficulty]}</span>·
        <span>约 {article.estimatedMinutes} 分钟</span>·
        <span>点击单词可查释义</span>
      </div>
      <h2>{article.title}</h2>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {tokenize(paragraph).map((token, i) =>
            token.wordKey && article.vocabulary[token.wordKey] ? (
              <span
                key={i}
                className="reading-token"
                role="button"
                tabIndex={0}
                onClick={() => onWordClick?.(token.wordKey!)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onWordClick?.(token.wordKey!);
                  }
                }}
              >
                {token.text}
              </span>
            ) : (
              <span key={i}>{token.text}</span>
            ),
          )}
        </p>
      ))}
    </article>
  );
}
