"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { mockLesson } from "@/data/mockLesson";
import {
  calendarLesson,
  createProfile,
  finishSession,
  userFor,
} from "@/lib/lesson/profile";
import {
  createStudyStorage,
  defaultSettings,
  type SavedStudy,
} from "@/lib/lesson/storage";
import { createSession, reduceSession } from "@/lib/lesson/session";
import { getScopedStorage } from "@/lib/storage/scoped";
import { enqueueXpEvent, enqueueSession, enqueueSettings } from "@/lib/sync/adapters";
import type {
  FeedbackSettings,
  SessionAction,
  SessionMode,
} from "@/types/session";
import { useToday } from "./StudyProvider";

function useLearningState() {
  const today = useToday();
  const [saved, setSaved] = useState<SavedStudy>(() => ({
    profile: createProfile(today),
    sessions: {},
    settings: defaultSettings,
  }));
  const latest = useRef(saved);
  const storage = useRef<ReturnType<typeof createStudyStorage> | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const commit = useCallback((next: SavedStudy) => {
    latest.current = next;
    setSaved(next);
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let local: Storage | undefined;
      try {
        local = getScopedStorage() as Storage | undefined;
      } catch {
        /* Storage can be denied in private browsing. */
      }
      storage.current = createStudyStorage(local, setNotice);
      commit(storage.current.load(today));
      setReady(true);
    });
    return () => {
      active = false;
    };
    // The profile anchor must remain the first use date across midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);
  const start = useCallback(
    (date: string, mode: SessionMode) => {
      if (!storage.current) return;
      const key = `${date}:${mode}`;
      const previous = latest.current.sessions[key];
      if (previous && (mode === "daily" || previous.phase !== "complete"))
        return previous.id;
      const session = createSession(
        date,
        mode,
        mockLesson,
        crypto.randomUUID(),
        new Date().toISOString(),
      );
      storage.current.saveSession(session);
      commit({
        ...latest.current,
        sessions: { ...latest.current.sessions, [key]: session },
      });
      return session.id;
    },
    [commit],
  );
  const dispatch = useCallback(
    (key: string, action: SessionAction) => {
      const previous = latest.current.sessions[key];
      if (!previous) return;
      const next = reduceSession(previous, action, mockLesson);
      const result = finishSession(latest.current.profile, next);
      storage.current?.saveSession(result.session);
      storage.current?.saveProfile(result.profile);
      commit({
        ...latest.current,
        profile: result.profile,
        sessions: { ...latest.current.sessions, [key]: result.session },
      });
      enqueueSession({
        sessionId: result.session.id,
        module: "daily",
        activityId: key,
        planDate: result.session.date,
        startedAt: result.session.startedAt,
        completedAt: result.session.phase === "complete" ? new Date().toISOString() : undefined,
        status: result.session.phase === "complete" ? "completed" : "in_progress",
      });
    },
    [commit],
  );
  const markCelebration = useCallback(
    (key: string) => {
      const session = latest.current.sessions[key];
      if (!session || session.celebrationSeen) return;
      const next = { ...session, celebrationSeen: true };
      storage.current?.saveSession(next);
      commit({
        ...latest.current,
        sessions: { ...latest.current.sessions, [key]: next },
      });
    },
    [commit],
  );
  const setSettings = useCallback(
    (settings: FeedbackSettings) => {
      storage.current?.saveSettings(settings);
      commit({ ...latest.current, settings });
      enqueueSettings({ feedback: settings });
    },
    [commit],
  );
  const awardXp = useCallback(
    (eventId: string, xp: number) => {
      if (latest.current.profile.bonusXpEvents?.[eventId] !== undefined) return;
      const profile = {
        ...latest.current.profile,
        bonusXpEvents: {
          ...(latest.current.profile.bonusXpEvents ?? {}),
          [eventId]: xp,
        },
      };
      storage.current?.saveProfile(profile);
      commit({ ...latest.current, profile });
      // eventId looks like "vocabulary:<id>", "reading:<id>", etc.
      const source = eventId.split(":")[0] ?? "bonus";
      enqueueXpEvent({
        eventId,
        source: ["vocabulary", "reading", "listening", "review", "translation", "writing", "daily_lesson", "achievement", "bonus"].includes(source)
          ? source
          : "bonus",
        sourceId: eventId,
        amount: xp,
      });
    },
    [commit],
  );
  return {
    ...saved,
    ready,
    notice,
    start,
    dispatch,
    markCelebration,
    setSettings,
    awardXp,
    user: userFor(saved.profile, today),
    getLesson: (date: string) =>
      calendarLesson(date, today, saved.profile, saved.sessions),
  };
}
const Context = createContext<ReturnType<typeof useLearningState> | null>(null);
export function LearningProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useLearningState()}>{children}</Context.Provider>
  );
}
export function useLearning() {
  const value = useContext(Context);
  if (!value) throw new Error("LearningProvider is required");
  return value;
}
