import { validDate } from "@/lib/dates";
import { mockLesson } from "@/data/mockLesson";
import type {
  FeedbackSettings,
  LessonSession,
  StudyProfile,
} from "@/types/session";
import { createProfile } from "./profile";
import { firstSubmissionAccuracy } from "./session";

export const PREFIX = "cet-daily:v2:";
export const defaultSettings: FeedbackSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  celebrationEnabled: true,
};
export interface SavedStudy {
  profile: StudyProfile;
  sessions: Record<string, LessonSession>;
  settings: FeedbackSettings;
}
export interface KeyStorage {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const results = [
  "first_try_correct",
  "second_try_correct",
  "ai_hint_correct",
  "wrong",
  "unmastered",
];
export function validSession(v: unknown): v is LessonSession {
  if (
    !object(v) ||
    v.schemaVersion !== 1 ||
    v.lessonId !== mockLesson.id ||
    v.lessonVersion !== mockLesson.version ||
    typeof v.id !== "string" ||
    typeof v.date !== "string" ||
    !validDate(v.date) ||
    !["daily", "review"].includes(String(v.mode)) ||
    !["initial", "retest"].includes(String(v.round)) ||
    !["answering", "retry", "feedback", "review_intro", "complete"].includes(
      String(v.phase),
    ) ||
    typeof v.startedAt !== "string" ||
    typeof v.celebrationSeen !== "boolean" ||
    !object(v.records) ||
    !Array.isArray(v.retestQueue) ||
    typeof v.index !== "number" ||
    !Number.isInteger(v.index) ||
    v.index < 0
  )
    return false;
  const ids = mockLesson.questions.map((q) => q.id);
  if (
    v.retestQueue.some((id) => typeof id !== "string" || !ids.includes(id)) ||
    new Set(v.retestQueue).size !== v.retestQueue.length
  )
    return false;
  const q =
    v.round === "initial"
      ? mockLesson.questions[v.index]
      : mockLesson.questions.find(
          (q) => q.id === (v.retestQueue as unknown[])[v.index as number],
        );
  if (
    !q ||
    (v.selected !== null && !q.options.some((o) => o.id === v.selected))
  )
    return false;
  for (const [id, record] of Object.entries(v.records)) {
    const question = mockLesson.questions.find((q) => q.id === id);
    if (!question || !object(record) || typeof record.hintUsed !== "boolean")
      return false;
    for (const round of ["initial", "retest"]) {
      const attempts = record[round];
      if (
        !Array.isArray(attempts) ||
        attempts.length > (round === "initial" ? 2 : 1) ||
        attempts.some(
          (a) =>
            !object(a) ||
            !question.options.some((o) => o.id === a.optionId) ||
            typeof a.correct !== "boolean" ||
            a.correct !== (a.optionId === question.answerId) ||
            typeof a.hinted !== "boolean",
        )
      )
        return false;
      const result = record[`${round}Result`];
      if (
        result !== undefined &&
        (!results.includes(String(result)) || attempts.length === 0)
      )
        return false;
    }
  }
  if (
    v.phase === "complete" &&
    (!object(v.reward) ||
      typeof v.completedDay !== "string" ||
      !validDate(v.completedDay) ||
      typeof v.completedAt !== "string" ||
      ids.some(
        (id) =>
          !object((v.records as Record<string, unknown>)[id]) ||
          !(v.records as Record<string, Record<string, unknown>>)[id]
            .initialResult,
      ) ||
      v.retestQueue.some(
        (id) =>
          !(v.records as Record<string, Record<string, unknown>>)[String(id)]
            .retestResult,
      ))
  )
    return false;
  if (
    v.reward !== undefined &&
    (!object(v.reward) ||
      ![0, 45].includes(Number(v.reward.xp)) ||
      typeof v.reward.accuracy !== "number" ||
      v.reward.accuracy < 0 ||
      v.reward.accuracy > 100 ||
      typeof v.reward.streak !== "number" ||
      v.reward.streak < 0)
  )
    return false;
  return consistentSession(v as unknown as LessonSession);
}
function consistentSession(s: LessonSession) {
  for (const q of mockLesson.questions) {
    const r = s.records[q.id];
    if (!r) continue;
    for (const round of ["initial", "retest"] as const) {
      const attempts = r[round];
      if (
        attempts.slice(0, -1).some((a) => a.correct) ||
        attempts.some(
          (a, i) =>
            (a.hinted && !r.hintUsed) ||
            (i > 0 && attempts[i - 1].hinted && !a.hinted),
        )
      )
        return false;
      const last = attempts.at(-1);
      const terminal =
        last && (last.correct || round === "retest" || attempts.length === 2);
      const expected = terminal
        ? last.correct
          ? last.hinted
            ? "ai_hint_correct"
            : attempts.length === 1
              ? "first_try_correct"
              : "second_try_correct"
          : round === "initial"
            ? "wrong"
            : "unmastered"
        : undefined;
      if (
        r[round === "initial" ? "initialResult" : "retestResult"] !== expected
      )
        return false;
      if (round === "retest" && attempts.length && r.initialResult !== "wrong")
        return false;
    }
  }
  const expectedQueue = mockLesson.questions
    .filter((q) => s.records[q.id]?.initialResult === "wrong")
    .map((q) => q.id);
  if (JSON.stringify(expectedQueue) !== JSON.stringify(s.retestQueue))
    return false;
  const order =
    s.round === "initial"
      ? mockLesson.questions.map((q) => q.id)
      : s.retestQueue;
  const resultKey = s.round === "initial" ? "initialResult" : "retestResult";
  for (let i = 0; i < order.length; i++) {
    const r = s.records[order[i]];
    if (i < s.index && !r?.[resultKey]) return false;
    if (i > s.index && r && (r[s.round].length || r[resultKey])) return false;
  }
  if (
    s.round === "retest" &&
    mockLesson.questions.some((q) => !s.records[q.id]?.initialResult)
  )
    return false;
  if (
    s.round === "initial" &&
    Object.values(s.records).some((r) => r.retest.length)
  )
    return false;
  const current = s.records[order[s.index]];
  if (s.phase === "answering" && current?.[s.round].length) return false;
  if (
    s.phase === "retry" &&
    (s.round !== "initial" ||
      current?.initial.length !== 1 ||
      current.initial[0].correct)
  )
    return false;
  if (
    s.phase === "feedback" &&
    (!current?.[resultKey] || s.selected !== current[s.round].at(-1)?.optionId)
  )
    return false;
  if (
    s.phase === "review_intro" &&
    (s.round !== "initial" ||
      s.index !== mockLesson.questions.length - 1 ||
      !s.retestQueue.length ||
      !current?.initialResult)
  )
    return false;
  if (
    s.phase === "complete" &&
    (s.index !== order.length - 1 ||
      s.selected !== null ||
      (s.round === "initial" && s.retestQueue.length))
  )
    return false;
  if (
    s.reward &&
    (s.phase !== "complete" ||
      s.reward.accuracy !== firstSubmissionAccuracy(s, mockLesson))
  )
    return false;
  return true;
}
function validProfile(v: unknown): v is StudyProfile {
  return (
    object(v) &&
    v.schemaVersion === 1 &&
    typeof v.anchorDate === "string" &&
    validDate(v.anchorDate) &&
    object(v.completedLessons) &&
    Object.entries(v.completedLessons).every(
      ([date, id]) => validDate(date) && typeof id === "string",
    ) &&
    object(v.rewardsByDay) &&
    Object.entries(v.rewardsByDay).every(
      ([date, r]) =>
        validDate(date) &&
        object(r) &&
        r.xp === 45 &&
        typeof r.sessionId === "string",
    )
  );
}
export function createStudyStorage(
  storage: KeyStorage | undefined,
  onIssue: (message: string) => void,
) {
  const memory = new Map<string, string>();
  let persistent = !!storage;
  const fail = () => {
    persistent = false;
    onIssue(
      "浏览器暂时无法保存，当前页面内可继续学习；关闭或刷新后进度可能丢失。",
    );
  };
  const read = (key: string) => {
    try {
      if (persistent) {
        const value = storage!.getItem(key);
        if (value !== null) memory.set(key, value);
        return value;
      }
    } catch {
      fail();
    }
    return memory.get(key) ?? null;
  };
  const write = (key: string, value: unknown) => {
    const text = JSON.stringify(value);
    memory.set(key, text);
    try {
      if (persistent) storage!.setItem(key, text);
    } catch {
      fail();
    }
  };
  function load(today: string): SavedStudy {
    if (!storage) fail();
    const parse = (key: string): unknown => {
      const raw = read(key);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    const p = parse(`${PREFIX}profile`);
    const profile = validProfile(p) ? p : createProfile(today);
    if (p !== undefined && !validProfile(p))
      onIssue("本地学习资料无法读取，已恢复默认资料。");
    const settingsValue = parse(`${PREFIX}settings`);
    const settings =
      object(settingsValue) &&
      Object.keys(defaultSettings).every(
        (k) => typeof settingsValue[k] === "boolean",
      )
        ? (settingsValue as unknown as FeedbackSettings)
        : defaultSettings;
    const sessions: Record<string, LessonSession> = {};
    let keys = [...memory.keys()];
    try {
      if (persistent)
        keys = Array.from({ length: storage!.length }, (_, i) =>
          storage!.key(i),
        ).filter((k): k is string => !!k);
    } catch {
      fail();
    }
    for (const key of keys.filter((k) => k.startsWith(`${PREFIX}session:`))) {
      const session = parse(key);
      if (
        validSession(session) &&
        key === `${PREFIX}session:${session.date}:${session.mode}`
      )
        sessions[`${session.date}:${session.mode}`] = session;
      else
        onIssue(
          "一份本地练习记录已失效，进入该练习时会重新开始；其他记录保留。",
        );
    }
    write(`${PREFIX}profile`, profile);
    return { profile, settings, sessions };
  }
  return {
    load,
    saveProfile: (p: StudyProfile) => write(`${PREFIX}profile`, p),
    saveSession: (s: LessonSession) =>
      write(`${PREFIX}session:${s.date}:${s.mode}`, s),
    saveSettings: (s: FeedbackSettings) => write(`${PREFIX}settings`, s),
  };
}
