/** Client-side validation helpers for private paper import.
 *  These mirror the server-side checks but provide early feedback.
 *  The server remains the final validation boundary.
 */

import { validatePrivateDraft } from "@/content/private-paper-validation";
export const IMPORT_BODY_LIMIT = 1024 * 1024; // 1 MiB

/** Serialize once; use the same string for byte validation and the actual request. */
export function serializeImport(draft: ImportDraft): { body: string; bytes: number } {
  const body = JSON.stringify({ localPaperId: draft.localPaperId, title: draft.title,
    content: draft.content, rightsAcknowledgement: { acknowledged: draft.acknowledged, statementVersion: "1.0" } });
  return { body, bytes: new TextEncoder().encode(body).byteLength };
}

export interface ImportValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

export interface ImportDraft {
  localPaperId: string;
  title: string;
  content: Record<string, unknown> | null;
  parseError: string;
  acknowledged: boolean;
}

export function validateLocalPaperId(id: string): string | null {
  if (!id.trim()) return "localPaperId 不能为空";
  if (id.length > 128) return "localPaperId 不能超过 128 字符";
  if (/[:\x00-\x1f\x7f]/.test(id)) return "localPaperId 不能包含冒号或控制字符";
  return null;
}

/** This installed Next.js supplies encoded page params (API route params are decoded).
 * Decode a page question segment exactly once; literal % and %25 remain distinct. */
export function privateQuestionIdFromPageRoute(segment: string): string {
  const decoded = decodeURIComponent(segment);
  if (!decoded.trim() || decoded.length > 200 || /[\x00-\x1f\x7f]/.test(decoded)) throw new Error("invalid question route");
  return decoded;
}

export function validateTitle(title: string): string | null {
  if (!title.trim()) return "标题不能为空";
  if (title.length > 200) return "标题不能超过 200 字符";
  return null;
}

export function parseJsonContent(text: string): { content: Record<string, unknown> | null; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { content: null, error: "" };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { content: parsed as Record<string, unknown>, error: "" };
    }
    return { content: null, error: "JSON 必须是对象（object），不能是数组或其他类型" };
  } catch {
    return { content: null, error: "JSON 格式错误，请检查语法" };
  }
}

export function validateImportDraft(draft: ImportDraft): ImportValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  const idErr = validateLocalPaperId(draft.localPaperId);
  if (idErr) errors.push({ field: "localPaperId", message: idErr });

  const titleErr = validateTitle(draft.title);
  if (titleErr) errors.push({ field: "title", message: titleErr });

  if (!draft.content) {
    if (draft.parseError) {
      errors.push({ field: "content", message: draft.parseError });
    } else {
      errors.push({ field: "content", message: "请提供 JSON 内容" });
    }
  }

  if (!draft.acknowledged) {
    errors.push({ field: "acknowledgement", message: "请确认权利声明" });
  }

  if (draft.content) {
    for (const message of validatePrivateDraft(draft.content)) errors.push({ field: "content", message });
    if (draft.content.title !== undefined && draft.content.title !== draft.title) errors.push({ field: "title", message: "标题与 JSON 内的 title 不一致" });
  }
  if (serializeImport(draft).bytes > IMPORT_BODY_LIMIT) errors.push({ field: "content", message: "完整请求超过 1 MiB，请减少 JSON 内容" });

  return { valid: errors.length === 0, errors };
}

export interface ContentStats {
  sections: number;
  groups: number;
  questions: number;
  isPartial: boolean;
  schemaVersion: string;
}

export function countContentStats(content: Record<string, unknown>): ContentStats {
  let sections = 0;
  let groups = 0;
  let questions = 0;

  const secs = content.sections;
  if (Array.isArray(secs)) {
    sections = secs.length;
    for (const sec of secs) {
      if (sec && typeof sec === "object" && Array.isArray((sec as Record<string, unknown>).groups)) {
        const grps = (sec as Record<string, unknown>).groups as unknown[];
        groups += grps.length;
        for (const grp of grps) {
          if (grp && typeof grp === "object" && Array.isArray((grp as Record<string, unknown>).questions)) {
            questions += ((grp as Record<string, unknown>).questions as unknown[]).length;
          }
          if (grp && typeof grp === "object" && Array.isArray((grp as Record<string, unknown>).questionRefs)) questions += ((grp as Record<string, unknown>).questionRefs as unknown[]).length;
        }
      }
    }
  }

  return {
    sections,
    groups,
    questions,
    isPartial: content.isPartial === true,
    schemaVersion: content.schemaVersion === 1 ? "1（兼容格式）" : typeof content.schemaVersion === "string" ? content.schemaVersion : "未知",
  };
}

/** Check if a paperId contains special characters that need encoding. */
export function hasSpecialPaperIdChars(paperId: string): boolean {
  return /[%\s中文]/.test(paperId) || /[\u4e00-\u9fff]/.test(paperId);
}

/** Encode a paperId for use in a URL path segment. */
export function encodePaperIdForUrl(paperId: string): string {
  return encodeURIComponent(paperId);
}

/** Normalize the route boundary, never decode literal escapes inside a raw ID. */
export function privatePaperIdFromRoute(value: string): string {
  if (value.startsWith("private:")) return value;
  if (!/^private%3a/i.test(value)) throw new Error("invalid private paper route");
  const decoded = decodeURIComponent(value);
  if (!decoded.startsWith("private:")) throw new Error("invalid private paper route");
  return decoded;
}
