/**
 * V13 Phase 2E: Paper 业务逻辑层。
 *
 * 与 storage.ts（单 session 存储 + V12 sync）配合：
 * - session.ts: 纯函数 reducer
 * - storage.ts: localStorage 持久化 + sync queue
 * - store.ts（本文件）: 业务逻辑（start/resume/answer/complete/XP/错题）
 *
 * XP 账本独立存储（cet-daily:v13:paper-xp-ledger），deterministic event ID 保证幂等。
 */
import type { CET6Paper, PaperQuestion, PaperSection, PaperSectionKind } from "@/content/papers";
import type { PaperResultSnapshot, PaperSessionAction, PaperSessionState } from "@/types/paper";
import {
  calculatePaperResult,
  createPaperSession,
  getWrongQuestionIds,
  isPaperCompletable,
  reducePaperSession,
} from "./session";
import {
  findInProgressSession,
  loadPaperSession,
  saveAndSyncPaperSession,
} from "./storage";
import { todayInShanghai } from "@/lib/dates";

/* ============================================================
 * Paper 内容辅助函数
 * ============================================================ */

export function extractSectionQuestionIds(paper: CET6Paper): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const sec of paper.sections) {
    const qids: string[] = [];
    for (const g of sec.groups) {
      if (g.questions) for (const q of g.questions) qids.push(q.questionId);
    }
    map[sec.sectionId] = qids;
  }
  return map;
}

export function extractCorrectAnswers(paper: CET6Paper): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const sec of paper.sections) {
    for (const g of sec.groups) {
      if (g.questions) {
        for (const q of g.questions) {
          if (q.type === "choice" && q.answerId) map[q.questionId] = q.answerId;
        }
      }
    }
  }
  return map;
}

export function extractAllQuestions(paper: CET6Paper): PaperQuestion[] {
  const out: PaperQuestion[] = [];
  for (const sec of paper.sections) {
    for (const g of sec.groups) {
      if (g.questions) out.push(...g.questions);
    }
  }
  return out;
}

export function findSectionByType(paper: CET6Paper, type: PaperSectionKind): PaperSection | undefined {
  return paper.sections.find((s) => s.type === type);
}

/* ============================================================
 * Session ID
 * ============================================================ */

export function generatePaperSessionId(paperId: string): string {
  return `paper:${paperId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

/* ============================================================
 * XP 账本（独立 localStorage key）
 * ============================================================ */

const XP_LEDGER_KEY = "cet-daily:v13:paper-xp-ledger";

export function loadPaperXpLedger(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(XP_LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function savePaperXpLedger(ledger: Record<string, number>): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(XP_LEDGER_KEY, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

export const PAPER_COMPLETION_BASE_XP = 50;

export function paperCompletionXp(
  paperId: string,
  accuracy: number,
  ledger: Record<string, number>,
  now: string,
): { xp: number; ledger: Record<string, number>; eventId: string } {
  const next = { ...ledger };
  const day = todayInShanghai(new Date(now));
  const eventId = `paper:complete:${paperId}:${day}`;
  if (next[eventId] !== undefined) return { xp: 0, ledger: next, eventId };
  const performance = Math.round((accuracy / 100) * 30);
  const xp = PAPER_COMPLETION_BASE_XP + performance;
  next[eventId] = xp;
  return { xp, ledger: next, eventId };
}

/* ============================================================
 * 业务操作
 * ============================================================ */

export function startOrResumePaperSession(
  paper: CET6Paper,
  ownerNamespace: string,
  now: string,
  isLoggedIn: boolean,
  forceNew = false,
): { session: PaperSessionState; isNew: boolean; saved: boolean } {
  if (!forceNew) {
    const existing = findInProgressSession(paper.paperId, ownerNamespace);
    if (existing) return { session: existing, isNew: false, saved: true };
  }
  const sectionIds = paper.sections.map((s) => ({
    sectionId: s.sectionId,
    type: s.type,
    totalQuestions: s.groups.reduce((n, g) => n + (g.questions?.length ?? 0), 0),
  }));
  const session = createPaperSession({
    sessionId: generatePaperSessionId(paper.paperId),
    paperId: paper.paperId,
    paperContentVersion: paper.contentVersion ?? "1.0.0",
    examSpecId: paper.examSpecId ?? "cet6-current-2026",
    ownerNamespace,
    now,
    sectionIds,
  });
  const result = saveAndSyncPaperSession(session, isLoggedIn);
  return { session, isNew: true, saved: result.ok };
}

export function applyAndSaveAction(
  session: PaperSessionState,
  action: PaperSessionAction,
  sectionQuestionIds: Record<string, string[]>,
  isLoggedIn: boolean,
): { session: PaperSessionState; saved: boolean; issue?: string } {
  const updated = reducePaperSession(session, action, sectionQuestionIds);
  if (updated === session) return { session, saved: true };
  const result = saveAndSyncPaperSession(updated, isLoggedIn);
  return { session: updated, saved: result.ok, issue: result.issue };
}

export function completePaperSession(
  session: PaperSessionState,
  paper: CET6Paper,
  now: string,
  isLoggedIn: boolean,
): {
  session: PaperSessionState;
  result: PaperResultSnapshot;
  wrongQuestionIds: string[];
  xp: number;
  xpEventId: string;
  saved: boolean;
  issue?: string;
} {
  const sectionQuestionIds = extractSectionQuestionIds(paper);
  const correctAnswers = extractCorrectAnswers(paper);

  if (session.phase === "completed" && session.result) {
    const wrong = getWrongQuestionIds(session, correctAnswers);
    const ledger = loadPaperXpLedger();
    const xpResult = paperCompletionXp(session.paperId, session.result.overallAccuracy, ledger, now);
    if (xpResult.xp > 0) savePaperXpLedger(xpResult.ledger);
    return { session, result: session.result, wrongQuestionIds: wrong, xp: xpResult.xp, xpEventId: xpResult.eventId, saved: true };
  }

  if (!isPaperCompletable(session, sectionQuestionIds)) {
    throw new Error("Paper not completable: not all questions answered");
  }

  const result = calculatePaperResult(session, correctAnswers, sectionQuestionIds, now);
  let updated = reducePaperSession(session, { type: "submit_paper", result, now }, sectionQuestionIds);

  const ledger = loadPaperXpLedger();
  const xpResult = paperCompletionXp(updated.paperId, result.overallAccuracy, ledger, now);
  if (xpResult.xp > 0) {
    savePaperXpLedger(xpResult.ledger);
    updated = reducePaperSession(updated, { type: "mark_xp_settled", now }, sectionQuestionIds);
  }

  const wrongQuestionIds = getWrongQuestionIds(updated, correctAnswers);
  const saveResult = saveAndSyncPaperSession(updated, isLoggedIn);

  return { session: updated, result, wrongQuestionIds, xp: xpResult.xp, xpEventId: xpResult.eventId, saved: saveResult.ok, issue: saveResult.issue };
}

export function loadSession(sessionId: string): PaperSessionState | null {
  const { session } = loadPaperSession(sessionId);
  return session;
}
