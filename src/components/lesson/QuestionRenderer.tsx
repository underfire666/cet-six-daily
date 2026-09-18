import type { Question } from "@/types/question";
interface Props {
  question: Question;
  selected: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}
function Choices({ question, selected, disabled, onSelect }: Props) {
  return (
    <fieldset className="exercise-options" disabled={disabled}>
      <legend className="exercise-sr-only">选择答案</legend>
      {question.options.map((option, index) => (
        <label
          key={option.id}
          className={`exercise-option ${selected === option.id ? "is-selected" : ""}`}
        >
          <input
            type="radio"
            name={question.id}
            value={option.id}
            checked={selected === option.id}
            onChange={() => onSelect(option.id)}
          />
          <span className="exercise-option-letter" aria-hidden="true">
            {String.fromCharCode(65 + index)}
          </span>
          <span lang="en">{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
export function ChoiceQuestion(props: Props) {
  return (
    <>
      <span className="exercise-eyebrow">
        {props.question.module === "reading" ? "阅读理解" : "词汇理解"}
      </span>
      <h1 className="exercise-prompt">{props.question.prompt}</h1>
      <Choices {...props} />
    </>
  );
}
export function ReadingQuestion(
  props: Props & { question: Extract<Question, { type: "reading" }> },
) {
  return (
    <>
      <span className="exercise-eyebrow">短篇阅读</span>
      <article className="exercise-passage" lang="en">
        <h2>{props.question.passageTitle}</h2>
        <p>{props.question.passage}</p>
      </article>
      <h1 className="exercise-prompt reading-prompt">
        {props.question.prompt}
      </h1>
      <Choices {...props} />
    </>
  );
}
export function QuestionRenderer(props: Props) {
  switch (props.question.type) {
    case "choice":
      return <ChoiceQuestion {...props} />;
    case "reading":
      return <ReadingQuestion {...props} question={props.question} />;
    case "fill_blank":
      return (
        <>
          <span className="exercise-eyebrow">句子填空</span>
          <h1 className="exercise-prompt">{props.question.prompt}</h1>
          <p className="exercise-sentence" lang="en">
            {props.question.sentence}
          </p>
          <Choices {...props} />
        </>
      );
  }
}
