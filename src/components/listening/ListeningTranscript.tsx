"use client";
import type { ListeningMaterial } from "@/types/listening";

const kindLabel: Record<string, string> = {
  sentence: "短句",
  dialogue: "短对话",
  passage: "短篇听力",
};
const difficultyLabel: Record<string, string> = {
  easy: "基础",
  normal: "进阶",
  hard: "挑战",
};

function tokenize(text: string): { text: string; wordKey?: string }[] {
  const tokens: { text: string; wordKey?: string }[] = [];
  const regex = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  let last = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: text.slice(last, index) });
    tokens.push({ text: match[0], wordKey: match[0].toLowerCase() });
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last) });
  return tokens;
}

export function ListeningTranscript({
  material,
  onWordClick,
}: {
  material: ListeningMaterial;
  onWordClick?: (wordKey: string) => void;
}) {
  const paragraphs = material.transcript.split(/\n\n+/);
  return (
    <article className="listening-transcript">
      <div className="listening-meta">
        <span>{kindLabel[material.kind]}</span>·
        <span>{difficultyLabel[material.difficulty]}</span>·
        <span>约 {material.estimatedMinutes} 分钟</span>
      </div>
      <h2>{material.title}</h2>
      {paragraphs.map((paragraph, index) => {
        const isKey = material.keySentences.some((s) =>
          paragraph.includes(s),
        );
        return (
          <p
            key={index}
            className={isKey ? "transcript-key-sentence" : undefined}
          >
            {tokenize(paragraph).map((token, i) =>
              token.wordKey && material.vocabulary[token.wordKey] ? (
                <span
                  key={i}
                  className="listening-token"
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
        );
      })}
    </article>
  );
}
