import type { ReviewStore } from "@/types/review";
import { recordWrong, reviewItemId } from "./scheduler";

interface SourceSession {
  startedAt?: string;
  completedAt?: string;
  articleId?: string;
  materialId?: string;
  lesson?: { records?: Record<string, {
    initialResult?: string;
    initial?: { optionId?: string; correct?: boolean }[];
    retest?: { optionId?: string; correct?: boolean }[];
  }> };
}

/** 同一会话的同一次作答只收录一次；刷新不重置掌握状态或重新激活已移除题目。 */
export function importReviewEvents(store: ReviewStore, sources: { module: "reading" | "listening"; sessions: Record<string, SourceSession> }[], now: string): ReviewStore {
  let next = store;
  const legacy = store.importedEvents === undefined;
  for (const { module, sessions } of sources) {
    for (const [sessionId, session] of Object.entries(sessions)) {
      for (const [questionId, record] of Object.entries(session.lesson?.records ?? {})) {
        if (questionId.startsWith("vq:") || record.initialResult !== "wrong" || !record.retest?.length) continue;
        const eventId = JSON.stringify([module, sessionId, questionId, record.retest.length]);
        if (next.importedEvents?.[eventId]) continue;
        const activityId = session.articleId ?? session.materialId ?? "daily";
        const existing = next.items[reviewItemId(module, activityId, questionId)];
        // 旧版已经扫描过的历史作答只登记，不再改变用户后续复习成果。
        const alreadyImported = legacy && existing && (!session.startedAt || session.startedAt <= existing.updatedAt);
        const wrongOptionId = [...(record.initial ?? []), ...record.retest].find(a => a.correct === false)?.optionId;
        next = {
          ...next,
          importedEvents: { ...next.importedEvents, [eventId]: true },
          items: alreadyImported ? next.items : recordWrong(next.items, module, activityId, questionId, session.completedAt ?? now,
            record.retest.some(a => a.correct === false) ? "wrong" : "second_try_correct", wrongOptionId),
        };
      }
    }
  }
  return next;
}
