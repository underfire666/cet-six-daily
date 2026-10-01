/**
 * V14 Phase 1D.1 — Private Paper Learning Readiness
 *
 * 独立、可测试的 readiness 判定。详情页与学习页共用。
 * 第一批仅支持：reading section + careful_reading group + 内联 choice question。
 */

export interface PrivateChoiceOption {
  id: string;
  text: string;
}

export interface PrivateFlatQuestion {
  /** 全局稳定序号（跨 section/group 展开后） */
  index: number;
  sectionId: string;
  sectionOrder: number;
  groupId: string;
  groupOrder: number;
  /** group 级阅读材料（passage） */
  passage?: string;
  questionId: string;
  questionOrder: number;
  prompt: string;
  options: PrivateChoiceOption[];
  answerId: string;
  shortExplanation?: string;
  detailedExplanation?: string;
}

export interface PrivateReadinessResult {
  ready: boolean;
  /** 不 ready 时的具体原因（用户可见） */
  reason?: string;
  /** 展开后的可作答题列表（ready=true 时非空） */
  questions: PrivateFlatQuestion[];
  /** 内容指纹（用于 sessionStorage 进度校验） */
  contentHash: string;
}

const SUPPORTED_SECTION_TYPE = "reading";
const SUPPORTED_GROUP_TYPE = "careful_reading";
const SUPPORTED_QUESTION_TYPE = "choice";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * 计算内容指纹。只包含影响答题的字段：section/group/question 的 id、order、type、
 * prompt、options、answerId、passage。不包含标题、元信息、解析（解析变化不影响进度）。
 */
export function computePrivateContentHash(content: Record<string, unknown>): string {
  const parts: string[] = [];
  const sections = Array.isArray(content.sections) ? content.sections : [];
  for (const secRaw of sections) {
    if (!isRecord(secRaw)) continue;
    parts.push(`S:${secRaw.sectionId ?? ""}:${secRaw.order ?? ""}:${secRaw.type ?? ""}`);
    const groups = Array.isArray(secRaw.groups) ? secRaw.groups : [];
    for (const grpRaw of groups) {
      if (!isRecord(grpRaw)) continue;
      parts.push(`G:${grpRaw.groupId ?? ""}:${grpRaw.order ?? ""}:${grpRaw.type ?? ""}:${(grpRaw.passage ?? "").toString().slice(0, 200)}`);
      const questions = Array.isArray(grpRaw.questions) ? grpRaw.questions : [];
      for (const qRaw of questions) {
        if (!isRecord(qRaw)) continue;
        const opts = Array.isArray(qRaw.options) ? qRaw.options : [];
        const optStr = opts.map((o) => isRecord(o) ? `${o.id ?? ""}:${(o.text ?? "").toString().slice(0, 100)}` : "").join("|");
        parts.push(`Q:${qRaw.questionId ?? ""}:${qRaw.order ?? ""}:${qRaw.type ?? ""}:${(qRaw.prompt ?? "").toString().slice(0, 200)}:${optStr}:${qRaw.answerId ?? ""}`);
      }
    }
  }
  // simple djb2-like hash
  let hash = 5381;
  const str = parts.join(";");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return `h${hash >>> 0}`;
}

/**
 * 判定私有卷是否可以开始本阶段的最小学习闭环。
 * 不静默跳过不支持的题目——只要存在不支持的内容就拒绝。
 */
export function checkPrivatePaperReadiness(content: Record<string, unknown>): PrivateReadinessResult {
  const questions: PrivateFlatQuestion[] = [];

  // 1. isPartial
  if (content.isPartial === true) {
    return { ready: false, reason: "当前为草稿（isPartial=true），暂不能开始学习。请先补全内容并标记为完整。", questions: [], contentHash: computePrivateContentHash(content) };
  }

  // 2. sections 存在且非空
  if (!Array.isArray(content.sections) || content.sections.length === 0) {
    return { ready: false, reason: "内容中没有任何 section，无法开始学习。", questions: [], contentHash: computePrivateContentHash(content) };
  }

  let globalIndex = 0;

  for (let si = 0; si < content.sections.length; si++) {
    const secRaw = content.sections[si];
    if (!isRecord(secRaw)) {
      return { ready: false, reason: `第 ${si + 1} 个 section 结构非法（不是对象）。`, questions: [], contentHash: computePrivateContentHash(content) };
    }

    // 3. 仅支持 reading section
    if (secRaw.type !== SUPPORTED_SECTION_TYPE) {
      return { ready: false, reason: `本阶段仅支持 reading section，发现「${String(secRaw.type)}」section。请移除或等待后续版本支持。`, questions: [], contentHash: computePrivateContentHash(content) };
    }

    if (!Array.isArray(secRaw.groups)) {
      return { ready: false, reason: `reading section「${String(secRaw.sectionId ?? si + 1)}」缺少 groups 数组。`, questions: [], contentHash: computePrivateContentHash(content) };
    }

    for (let gi = 0; gi < secRaw.groups.length; gi++) {
      const grpRaw = secRaw.groups[gi];
      if (!isRecord(grpRaw)) {
        return { ready: false, reason: `第 ${si + 1} section 第 ${gi + 1} group 结构非法。`, questions: [], contentHash: computePrivateContentHash(content) };
      }

      // 4. 仅支持 careful_reading group
      if (grpRaw.type !== SUPPORTED_GROUP_TYPE) {
        return { ready: false, reason: `本阶段仅支持 careful_reading group，发现「${String(grpRaw.type)}」group。请移除或等待后续版本支持。`, questions: [], contentHash: computePrivateContentHash(content) };
      }

      // 5. 不支持 questionRefs（依赖已注册内容 item）
      if (Array.isArray(grpRaw.questionRefs) && grpRaw.questionRefs.length > 0) {
        return { ready: false, reason: `group「${String(grpRaw.groupId ?? gi + 1)}」使用了 questionRefs（引用外部内容），本阶段仅支持内联题目。`, questions: [], contentHash: computePrivateContentHash(content) };
      }

      // 6. 不支持 assetIds（音频等）
      if (isStringArray(grpRaw.assetIds) && grpRaw.assetIds.length > 0) {
        return { ready: false, reason: `group「${String(grpRaw.groupId ?? gi + 1)}」关联了 assetIds（音频/图片等），本阶段不支持。`, questions: [], contentHash: computePrivateContentHash(content) };
      }

      if (!Array.isArray(grpRaw.questions) || grpRaw.questions.length === 0) {
        return { ready: false, reason: `careful_reading group「${String(grpRaw.groupId ?? gi + 1)}」没有内联题目。`, questions: [], contentHash: computePrivateContentHash(content) };
      }

      for (let qi = 0; qi < grpRaw.questions.length; qi++) {
        const qRaw = grpRaw.questions[qi];
        if (!isRecord(qRaw)) {
          return { ready: false, reason: `第 ${qi + 1} 题结构非法。`, questions: [], contentHash: computePrivateContentHash(content) };
        }

        // 7. 仅支持 choice 题
        if (qRaw.type !== SUPPORTED_QUESTION_TYPE) {
          return { ready: false, reason: `本阶段仅支持 choice 选择题，第 ${qi + 1} 题类型为「${String(qRaw.type)}」。`, questions: [], contentHash: computePrivateContentHash(content) };
        }

        // 8. options 必须存在且至少 2 个
        if (!Array.isArray(qRaw.options) || qRaw.options.length < 2) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少有效选项（至少需要 2 个）。`, questions: [], contentHash: computePrivateContentHash(content) };
        }

        const options: PrivateChoiceOption[] = [];
        for (const optRaw of qRaw.options) {
          if (!isRecord(optRaw) || typeof optRaw.id !== "string" || typeof optRaw.text !== "string") {
            return { ready: false, reason: `第 ${qi + 1} 题存在格式非法的选项。`, questions: [], contentHash: computePrivateContentHash(content) };
          }
          options.push({ id: optRaw.id, text: optRaw.text });
        }

        // 9. answerId 必须存在且匹配某个选项
        if (typeof qRaw.answerId !== "string" || !qRaw.answerId) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少答案（answerId）。`, questions: [], contentHash: computePrivateContentHash(content) };
        }
        if (!options.some((o) => o.id === qRaw.answerId)) {
          return { ready: false, reason: `第 ${qi + 1} 题的答案「${qRaw.answerId}」不在选项中。`, questions: [], contentHash: computePrivateContentHash(content) };
        }

        if (typeof qRaw.prompt !== "string" || !qRaw.prompt.trim()) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少题干（prompt）。`, questions: [], contentHash: computePrivateContentHash(content) };
        }

        questions.push({
          index: globalIndex++,
          sectionId: String(secRaw.sectionId ?? ""),
          sectionOrder: typeof secRaw.order === "number" ? secRaw.order : si,
          groupId: String(grpRaw.groupId ?? ""),
          groupOrder: typeof grpRaw.order === "number" ? grpRaw.order : gi,
          passage: typeof grpRaw.passage === "string" ? grpRaw.passage : undefined,
          questionId: String(qRaw.questionId ?? ""),
          questionOrder: typeof qRaw.order === "number" ? qRaw.order : qi,
          prompt: qRaw.prompt,
          options,
          answerId: qRaw.answerId,
          shortExplanation: typeof qRaw.shortExplanation === "string" ? qRaw.shortExplanation : undefined,
          detailedExplanation: typeof qRaw.detailedExplanation === "string" ? qRaw.detailedExplanation : undefined,
        });
      }
    }
  }

  // 10. 至少一道可作答题
  if (questions.length === 0) {
    return { ready: false, reason: "没有可作答的题目。", questions: [], contentHash: computePrivateContentHash(content) };
  }

  return { ready: true, questions, contentHash: computePrivateContentHash(content) };
}

/**
 * 判分：返回正确数、总题数、正确率百分比（0-100，保留 1 位小数）。
 */
export function scorePrivateAnswers(
  questions: PrivateFlatQuestion[],
  answers: Record<number, string>,
): { correct: number; total: number; accuracy: number } {
  const total = questions.length;
  let correct = 0;
  for (const q of questions) {
    if (answers[q.index] === q.answerId) correct++;
  }
  const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return { correct, total, accuracy };
}
