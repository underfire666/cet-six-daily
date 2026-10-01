/**
 * V14 Phase 1D.1 — Private Paper Learning Readiness
 *
 * 独立、可测试的 readiness 判定。详情页与学习页共用。
 * 第一批仅支持：reading section + careful_reading group + 内联 choice question。
 */

import { validatePrivateDraft } from "@/content/private-paper-validation";

export interface PrivateChoiceOption {
  id: string;
  text: string;
}

export interface PrivateFlatQuestion {
  /** 全局稳定序号（跨 section/group 展开后，按 order 排序后重新生成） */
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

/** 存档版本号，用于未来格式迁移时识别旧存档 */
export const PRIVATE_STUDY_PROGRESS_VERSION = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * FNV-1a 64-bit hash（使用 BigInt，避免 32 位碰撞）。
 * 对结构化序列化后的字符串计算指纹。
 */
function fnv1a64(str: string): string {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * 计算内容指纹。
 *
 * 设计原则：
 * - 只包含影响答题的字段：section/group/question 的 id、order、type、
 *   prompt、options(id+text 完整不截断)、answerId、passage(完整不截断)。
 * - 不包含标题、元信息、解析（解析变化不影响作答进度）。
 * - 使用 JSON.stringify 结构化序列化，避免拼接分隔符歧义。
 * - 使用 FNV-1a 64-bit 哈希，不使用简单 32 位 djb2。
 * - 排序后再序列化，保证相同内容不同数组顺序产生相同指纹。
 */
export function computePrivateContentHash(content: Record<string, unknown>): string {
  const fingerprint: Array<{
    sectionId: string;
    sectionOrder: number;
    sectionType: string;
    groups: Array<{
      groupId: string;
      groupOrder: number;
      groupType: string;
      passage: string;
      questions: Array<{
        questionId: string;
        questionOrder: number;
        questionType: string;
        prompt: string;
        options: Array<{ id: string; text: string }>;
        answerId: string;
      }>;
    }>;
  }> = [];

  const sections = Array.isArray(content.sections) ? content.sections : [];
  for (const secRaw of sections) {
    if (!isRecord(secRaw)) continue;
    const secOrder = typeof secRaw.order === "number" ? secRaw.order : 0;
    const groups: typeof fingerprint[0]["groups"] = [];
    const grpList = Array.isArray(secRaw.groups) ? secRaw.groups : [];
    for (const grpRaw of grpList) {
      if (!isRecord(grpRaw)) continue;
      const grpOrder = typeof grpRaw.order === "number" ? grpRaw.order : 0;
      const questions: typeof fingerprint[0]["groups"][0]["questions"] = [];
      const qList = Array.isArray(grpRaw.questions) ? grpRaw.questions : [];
      for (const qRaw of qList) {
        if (!isRecord(qRaw)) continue;
        const qOrder = typeof qRaw.order === "number" ? qRaw.order : 0;
        const opts: Array<{ id: string; text: string }> = [];
        const optList = Array.isArray(qRaw.options) ? qRaw.options : [];
        for (const optRaw of optList) {
          if (isRecord(optRaw) && typeof optRaw.id === "string" && typeof optRaw.text === "string") {
            opts.push({ id: optRaw.id, text: optRaw.text });
          }
        }
        questions.push({
          questionId: String(qRaw.questionId ?? ""),
          questionOrder: qOrder,
          questionType: String(qRaw.type ?? ""),
          prompt: typeof qRaw.prompt === "string" ? qRaw.prompt : "",
          options: opts,
          answerId: typeof qRaw.answerId === "string" ? qRaw.answerId : "",
        });
      }
      // 按 order 排序后再序列化
      questions.sort((a, b) => a.questionOrder - b.questionOrder || a.questionId.localeCompare(b.questionId));
      groups.push({
        groupId: String(grpRaw.groupId ?? ""),
        groupOrder: grpOrder,
        groupType: String(grpRaw.type ?? ""),
        passage: typeof grpRaw.passage === "string" ? grpRaw.passage : "",
        questions,
      });
    }
    groups.sort((a, b) => a.groupOrder - b.groupOrder || a.groupId.localeCompare(b.groupId));
    fingerprint.push({
      sectionId: String(secRaw.sectionId ?? ""),
      sectionOrder: secOrder,
      sectionType: String(secRaw.type ?? ""),
      groups,
    });
  }
  fingerprint.sort((a, b) => a.sectionOrder - b.sectionOrder || a.sectionId.localeCompare(b.sectionId));

  const serialized = JSON.stringify(fingerprint);
  return `v2:${fnv1a64(serialized)}`;
}

/**
 * 判定私有卷是否可以开始本阶段的最小学习闭环。
 * 不静默跳过不支持的题目——只要存在不支持的内容就拒绝。
 *
 * 校验流程：
 * 1. 复用 validatePrivateDraft 做结构校验（schemaVersion、ID 唯一性、order、类型、数组、字段类型）
 * 2. isPartial 检查
 * 3. 仅支持 reading + careful_reading + 内联 choice
 * 4. questionRefs / assetIds 不能被静默忽略（存在即拒绝）
 * 5. 重复 option.id / 重复 questionId / 空 ID / 非法答案 拒绝
 * 6. 按 order 排序（不修改原始输入），重新生成连续 index
 */
export function checkPrivatePaperReadiness(content: Record<string, unknown>): PrivateReadinessResult {
  const contentHash = computePrivateContentHash(content);

  // 0. 复用现有 PRIVATE 结构校验，避免两套规则漂移
  const structuralErrors = validatePrivateDraft(content);
  if (structuralErrors.length > 0) {
    return {
      ready: false,
      reason: `内容结构校验未通过（${structuralErrors.length} 项错误）：${structuralErrors.slice(0, 3).join("；")}${structuralErrors.length > 3 ? "…" : ""}`,
      questions: [],
      contentHash,
    };
  }

  // 1. isPartial
  if (content.isPartial === true) {
    return { ready: false, reason: "当前为草稿（isPartial=true），暂不能开始学习。请先补全内容并标记为完整。", questions: [], contentHash };
  }

  // 2. sections 存在且非空
  if (!Array.isArray(content.sections) || content.sections.length === 0) {
    return { ready: false, reason: "内容中没有任何 section，无法开始学习。", questions: [], contentHash };
  }

  const sectionsArr = content.sections as unknown[];

  // 收集所有 questionId 用于全局重复检测
  const globalQuestionIds = new Set<string>();

  // 3. 按 section.order 排序（不修改原始数组，创建排序后的索引）
  const sectionIndices: number[] = sectionsArr
    .map((_, i) => i)
    .sort((a, b) => {
      const orderA = isRecord(sectionsArr[a]) ? Number(sectionsArr[a].order) || 0 : 0;
      const orderB = isRecord(sectionsArr[b]) ? Number(sectionsArr[b].order) || 0 : 0;
      return orderA - orderB;
    });

  const questions: PrivateFlatQuestion[] = [];
  let globalIndex = 0;

  for (const si of sectionIndices) {
    const secRaw = sectionsArr[si];
    if (!isRecord(secRaw)) {
      return { ready: false, reason: `第 ${si + 1} 个 section 结构非法（不是对象）。`, questions: [], contentHash };
    }

    // 4. 仅支持 reading section
    if (secRaw.type !== SUPPORTED_SECTION_TYPE) {
      return { ready: false, reason: `本阶段仅支持 reading section，发现「${String(secRaw.type)}」section。请移除或等待后续版本支持。`, questions: [], contentHash };
    }

    if (!Array.isArray(secRaw.groups)) {
      return { ready: false, reason: `reading section「${String(secRaw.sectionId ?? si + 1)}」缺少 groups 数组。`, questions: [], contentHash };
    }

    const groupsArr = secRaw.groups as unknown[];

    // 5. 按 group.order 排序
    const groupIndices: number[] = groupsArr
      .map((_, i) => i)
      .sort((a, b) => {
        const orderA = isRecord(groupsArr[a]) ? Number(groupsArr[a].order) || 0 : 0;
        const orderB = isRecord(groupsArr[b]) ? Number(groupsArr[b].order) || 0 : 0;
        return orderA - orderB;
      });

    for (const gi of groupIndices) {
      const grpRaw = groupsArr[gi];
      if (!isRecord(grpRaw)) {
        return { ready: false, reason: `section「${String(secRaw.sectionId ?? "")}」第 ${gi + 1} group 结构非法。`, questions: [], contentHash };
      }

      // 6. 仅支持 careful_reading group
      if (grpRaw.type !== SUPPORTED_GROUP_TYPE) {
        return { ready: false, reason: `本阶段仅支持 careful_reading group，发现「${String(grpRaw.type)}」group。请移除或等待后续版本支持。`, questions: [], contentHash };
      }

      // 7. questionRefs 不能被静默忽略——存在即拒绝（本阶段仅支持内联题目）
      if (Array.isArray(grpRaw.questionRefs) && grpRaw.questionRefs.length > 0) {
        return { ready: false, reason: `group「${String(grpRaw.groupId ?? gi + 1)}」使用了 questionRefs（引用外部内容），本阶段仅支持内联题目。`, questions: [], contentHash };
      }

      // 8. assetIds 不能被静默忽略——存在即拒绝（本阶段不支持音频/图片）
      if (Array.isArray(grpRaw.assetIds) && grpRaw.assetIds.length > 0) {
        return { ready: false, reason: `group「${String(grpRaw.groupId ?? gi + 1)}」关联了 assetIds（音频/图片等），本阶段不支持。`, questions: [], contentHash };
      }

      if (!Array.isArray(grpRaw.questions) || grpRaw.questions.length === 0) {
        return { ready: false, reason: `careful_reading group「${String(grpRaw.groupId ?? gi + 1)}」没有内联题目。`, questions: [], contentHash };
      }

      const questionsArr = grpRaw.questions as unknown[];

      // 9. 按 question.order 排序
      const questionIndices: number[] = questionsArr
        .map((_, i) => i)
        .sort((a, b) => {
          const orderA = isRecord(questionsArr[a]) ? Number(questionsArr[a].order) || 0 : 0;
          const orderB = isRecord(questionsArr[b]) ? Number(questionsArr[b].order) || 0 : 0;
          return orderA - orderB;
        });

      for (const qi of questionIndices) {
        const qRaw = questionsArr[qi];
        if (!isRecord(qRaw)) {
          return { ready: false, reason: `第 ${qi + 1} 题结构非法。`, questions: [], contentHash };
        }

        // 10. 仅支持 choice 题
        if (qRaw.type !== SUPPORTED_QUESTION_TYPE) {
          return { ready: false, reason: `本阶段仅支持 choice 选择题，第 ${qi + 1} 题类型为「${String(qRaw.type)}」。`, questions: [], contentHash };
        }

        // 11. 全局 questionId 重复检测（validatePrivateDraft 已检测单卷内唯一，这里双重确认）
        const qid = String(qRaw.questionId ?? "");
        if (!qid) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少 questionId。`, questions: [], contentHash };
        }
        if (globalQuestionIds.has(qid)) {
          return { ready: false, reason: `题目 ID「${qid}」重复，题目 ID 必须全局唯一。`, questions: [], contentHash };
        }
        globalQuestionIds.add(qid);

        // 12. options 必须存在且至少 2 个
        if (!Array.isArray(qRaw.options) || qRaw.options.length < 2) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少有效选项（至少需要 2 个）。`, questions: [], contentHash };
        }

        const options: PrivateChoiceOption[] = [];
        const optionIds = new Set<string>();
        for (const optRaw of qRaw.options) {
          if (!isRecord(optRaw) || typeof optRaw.id !== "string" || typeof optRaw.text !== "string") {
            return { ready: false, reason: `第 ${qi + 1} 题存在格式非法的选项。`, questions: [], contentHash };
          }
          if (!optRaw.id.trim()) {
            return { ready: false, reason: `第 ${qi + 1} 题存在空选项 ID。`, questions: [], contentHash };
          }
          if (optionIds.has(optRaw.id)) {
            return { ready: false, reason: `第 ${qi + 1} 题存在重复选项 ID「${optRaw.id}」。`, questions: [], contentHash };
          }
          optionIds.add(optRaw.id);
          options.push({ id: optRaw.id, text: optRaw.text });
        }

        // 13. answerId 必须存在且匹配某个选项
        if (typeof qRaw.answerId !== "string" || !qRaw.answerId) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少答案（answerId）。`, questions: [], contentHash };
        }
        if (!options.some((o) => o.id === qRaw.answerId)) {
          return { ready: false, reason: `第 ${qi + 1} 题的答案「${qRaw.answerId}」不在选项中。`, questions: [], contentHash };
        }

        if (typeof qRaw.prompt !== "string" || !qRaw.prompt.trim()) {
          return { ready: false, reason: `第 ${qi + 1} 题缺少题干（prompt）。`, questions: [], contentHash };
        }

        questions.push({
          index: globalIndex++,
          sectionId: String(secRaw.sectionId ?? ""),
          sectionOrder: typeof secRaw.order === "number" ? secRaw.order : si,
          groupId: String(grpRaw.groupId ?? ""),
          groupOrder: typeof grpRaw.order === "number" ? grpRaw.order : gi,
          passage: typeof grpRaw.passage === "string" ? grpRaw.passage : undefined,
          questionId: qid,
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

  // 14. 至少一道可作答题
  if (questions.length === 0) {
    return { ready: false, reason: "没有可作答的题目。", questions: [], contentHash };
  }

  return { ready: true, questions, contentHash };
}

/**
 * 判分：返回正确数、总题数、正确率百分比（0-100，保留 1 位小数）。
 * 只计算当前有效题目的合法答案，多余答案（index 超出范围）不影响。
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

/**
 * 计算已答题数量。只计算当前有效题目 index 范围内的合法（非空字符串）答案。
 */
export function countValidAnswers(
  questions: PrivateFlatQuestion[],
  answers: Record<number, string>,
): number {
  let count = 0;
  for (const q of questions) {
    const v = answers[q.index];
    if (typeof v === "string" && v.length > 0) count++;
  }
  return count;
}
