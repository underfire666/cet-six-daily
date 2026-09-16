import type { ModuleKey } from "./study";
export interface Option {
  id: string;
  text: string;
}
interface QuestionBase {
  id: string;
  module: ModuleKey;
  prompt: string;
  options: Option[];
  answerId: string;
  explanation: string;
  details: string;
  hint: string;
}
export type Question =
  | (QuestionBase & { type: "choice" })
  | (QuestionBase & { type: "fill_blank"; sentence: string })
  | (QuestionBase & { type: "reading"; passage: string; passageTitle: string });
export interface LessonDefinition {
  id: string;
  version: number;
  title: string;
  minutes: number;
  questions: Question[];
}
