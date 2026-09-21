import type { ContentPack } from "./types";
import { getSource } from "./sources";

export interface ValidationIssue {
  level: "error" | "warning";
  packId: string;
  itemId?: string;
  message: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  counts: {
    vocabulary: number;
    reading: number;
    listening: number;
    translation: number;
    writing: number;
    paper: number;
  };
}

function err(packId: string, message: string, itemId?: string): ValidationIssue {
  return { level: "error", packId, itemId, message };
}
function warn(packId: string, message: string, itemId?: string): ValidationIssue {
  return { level: "warning", packId, itemId, message };
}

/**
 * 验证一个 ContentPack：ID 重复 / 必填字段 / correctAnswer 有效 / source 存在。
 * 不抛错，返回 report。开发模式下调用方可据此让测试失败。
 */
export function validatePack(pack: ContentPack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!getSource(pack.sourceId)) {
    issues.push(err(pack.id, `unknown sourceId: ${pack.sourceId}`));
  }
  const seen = new Set<string>();
  for (const raw of pack.items) {
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) {
      issues.push(err(pack.id, "item missing id"));
      continue;
    }
    if (seen.has(id)) {
      issues.push(err(pack.id, `duplicate id: ${id}`, id));
    }
    seen.add(id);

    // 通用（vocabulary 用 word 字段，不强制 title）
    if (pack.contentType !== "vocabulary") {
      if (typeof item.title !== "string" || !item.title.trim()) {
        issues.push(warn(pack.id, `item missing title`, id));
      }
    }

    // 词汇
    if (pack.contentType === "vocabulary") {
      const w = item as { word?: string };
      if (!w.word || !String(w.word).trim()) {
        issues.push(err(pack.id, `vocabulary empty word`, id));
      }
    }

    // 阅读
    if (pack.contentType === "reading") {
      const a = item as { passage?: string; questions?: { id?: string; options?: { id: string }[]; answerId?: string }[] };
      if (!a.passage || !String(a.passage).trim()) {
        issues.push(err(pack.id, `reading empty passage`, id));
      }
      for (const q of a.questions ?? []) {
        if (!q.id) {
          issues.push(err(pack.id, `reading question missing id`, id));
          continue;
        }
        const optIds = (q.options ?? []).map((o) => o.id);
        if (!q.answerId || !optIds.includes(q.answerId)) {
          issues.push(err(pack.id, `reading question ${q.id} has invalid answerId`, id));
        }
      }
    }

    // 听力
    if (pack.contentType === "listening") {
      const m = item as { audio?: { type?: string; src?: string; text?: string }; transcript?: string; questions?: { options?: { id: string }[]; answerId?: string }[] };
      if (!m.audio || (!m.audio.src && !m.audio.text)) {
        issues.push(err(pack.id, `listening missing audio source`, id));
      }
      if (!m.transcript || !String(m.transcript).trim()) {
        issues.push(warn(pack.id, `listening empty transcript`, id));
      }
      for (const q of m.questions ?? []) {
        const optIds = (q.options ?? []).map((o) => o.id);
        if (!q.answerId || !optIds.includes(q.answerId)) {
          issues.push(err(pack.id, `listening question invalid answerId`, id));
        }
      }
    }

    // 翻译
    if (pack.contentType === "translation") {
      const t = item as { promptChinese?: string };
      if (!t.promptChinese || !String(t.promptChinese).trim()) {
        issues.push(err(pack.id, `translation empty promptChinese`, id));
      }
    }

    // 写作
    if (pack.contentType === "writing") {
      const w = item as { prompt?: string };
      if (!w.prompt || !String(w.prompt).trim()) {
        issues.push(err(pack.id, `writing empty prompt`, id));
      }
    }
  }
  return issues;
}

export function validateAll(packs: ContentPack[]): ValidationReport {
  const counts = { vocabulary: 0, reading: 0, listening: 0, translation: 0, writing: 0, paper: 0 };
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 跨 pack 重复 ID
  const global = new Map<string, string>();
  for (const pack of packs) {
    counts[pack.contentType] += pack.items.length;
    for (const raw of pack.items) {
      const id = (raw as { id?: string }).id;
      if (typeof id !== "string") continue;
      if (global.has(id)) {
        errors.push({ level: "error", packId: pack.id, itemId: id, message: `duplicate id across packs: ${id} (also in ${global.get(id)})` });
      } else {
        global.set(id, pack.id);
      }
    }
  }

  for (const pack of packs) {
    for (const issue of validatePack(pack)) {
      if (issue.level === "error") errors.push(issue);
      else warnings.push(issue);
    }
  }
  return { errors, warnings, counts };
}
