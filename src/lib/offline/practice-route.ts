export type PracticeStage =
  | { kind: "home"; id: null }
  | { kind: "wordbook"; id: null }
  | { kind: "session" | "complete"; id: string };

const HOME: PracticeStage = { kind: "home", id: null };

/** Only an opaque local session ID may select a client-side practice screen. */
export function readPracticeStage(search: string): PracticeStage {
  const params = new URLSearchParams(search);
  const session = params.get("session");
  const complete = params.get("complete");
  const wordbook = params.get("wordbook");
  if (wordbook === "1" && !session && !complete)
    return { kind: "wordbook", id: null };
  if (session && !complete && /^[\w:-]{1,128}$/.test(session))
    return { kind: "session", id: session };
  if (complete && !session && /^[\w:-]{1,128}$/.test(complete))
    return { kind: "complete", id: complete };
  return HOME;
}

export function practiceStageHref(
  pathname: string,
  search: string,
  stage: PracticeStage,
): string {
  const params = new URLSearchParams(search);
  params.delete("session");
  params.delete("complete");
  params.delete("wordbook");
  if (stage.kind === "wordbook") params.set("wordbook", "1");
  else if (stage.kind !== "home") params.set(stage.kind, stage.id);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
