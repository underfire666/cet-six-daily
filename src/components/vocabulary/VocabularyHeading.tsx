"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function VocabularyHeading({
  title,
  back = "/practice/vocabulary",
  onBack,
}: {
  title: string;
  back?: string;
  onBack?: () => void;
}) {
  return (
    <header className="vocabulary-heading">
      {onBack ? (
        <button className="exercise-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
      ) : (
        <Link href={back} className="exercise-icon-button" aria-label="返回">
          <ArrowLeft size={22} />
        </Link>
      )}
      <h1>{title}</h1>
      <span>六级日常</span>
    </header>
  );
}
