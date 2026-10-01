/** Runtime validation for PRIVATE storage drafts, independent of the public registry. */
export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export const validTitle = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
export function validatePrivateDraft(content: Record<string, unknown>): string[] {
  const errors: string[] = [], ids = new Set<string>(), assets = new Set<string>(), assetRefs: string[] = [];
  const groupKinds: Record<string, string[]> = { writing: ["writing"], listening: ["long_conversation", "passage", "lecture"], reading: ["cloze", "matching", "careful_reading"], translation: ["translation"] };
  const types = { section: ["writing", "listening", "reading", "translation"], group: ["writing", "long_conversation", "passage", "lecture", "cloze", "matching", "careful_reading", "translation"], question: ["choice", "cloze", "matching", "subjective_writing", "subjective_translation"] };
  const fail = (path: string) => { if (errors.length < 40) errors.push(`invalid ${path}`); };
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  function node(value: unknown, kind: keyof typeof types, key: string, path: string) {
    if (!isRecord(value)) { fail(path); return null; }
    if (!text(value[key]) || ids.has(String(value[key]))) fail(`${path}.${key}`); else ids.add(String(value[key]));
    if (!types[kind].includes(String(value.type))) fail(`${path}.type`);
    if (!Number.isSafeInteger(value.order) || Number(value.order) < 0) fail(`${path}.order`);
    return value;
  }
  if (content.schemaVersion !== "1.0.0" && content.schemaVersion !== 1) fail("schemaVersion (supported: 1.0.0 or legacy 1)");
  if (content.isPartial !== undefined && typeof content.isPartial !== "boolean") fail("isPartial");
  if (content.title !== undefined && !validTitle(content.title)) fail("title");
  if (content.rights !== undefined && !isRecord(content.rights)) fail("rights");
  if (content.assets !== undefined) {
    if (!Array.isArray(content.assets)) fail("assets");
    else for (const asset of content.assets) {
      if (!isRecord(asset) || !text(asset.assetId) || assets.has(String(asset.assetId)) || !["audio", "image", "transcript", "document"].includes(String(asset.type)) || !text(asset.source) || !text(asset.mimeType)) fail("assets entry");
      else {
        assets.add(String(asset.assetId));
        if (asset.duration !== undefined && (typeof asset.duration !== "number" || !Number.isFinite(asset.duration) || asset.duration < 0)) fail("asset.duration");
        if (asset.sizeBytes !== undefined && (!Number.isSafeInteger(asset.sizeBytes) || Number(asset.sizeBytes) < 0)) fail("asset.sizeBytes");
        if (asset.rights !== undefined && !isRecord(asset.rights)) fail("asset.rights");
      }
    }
  }
  if (!Array.isArray(content.sections)) { fail("sections (array required)"); return errors; }
  for (const [si, rawSection] of content.sections.entries()) {
    const sp = `sections[${si}]`, section = node(rawSection, "section", "sectionId", sp);
    if (!section) continue;
    if (!Array.isArray(section.groups)) { fail(`${sp}.groups`); continue; }
    if (section.instructions !== undefined && typeof section.instructions !== "string") fail(`${sp}.instructions`);
    for (const [gi, rawGroup] of section.groups.entries()) {
      const gp = `${sp}.groups[${gi}]`, group = node(rawGroup, "group", "groupId", gp);
      if (!group) continue;
      if (!groupKinds[String(section.type)]?.includes(String(group.type))) fail(`${gp}.type incompatible with section`);
      for (const field of ["passage", "transcript", "prompt"]) if (group[field] !== undefined && typeof group[field] !== "string") fail(`${gp}.${field}`);
      if (group.assetIds !== undefined) {
        if (!Array.isArray(group.assetIds) || !group.assetIds.every(text)) fail(`${gp}.assetIds`); else assetRefs.push(...group.assetIds);
      }
      if (group.questionRefs !== undefined) {
        if (!Array.isArray(group.questionRefs)) fail(`${gp}.questionRefs`);
        else {
          const refs = new Set<string>();
          for (const ref of group.questionRefs) {
            if (!isRecord(ref) || !text(ref.contentId) || !Number.isSafeInteger(ref.order) || Number(ref.order) < 0 || (ref.questionId !== undefined && !text(ref.questionId))) { fail(`${gp}.questionRefs entry`); continue; }
            const key = `${ref.contentId}\0${ref.questionId ?? ""}`;
            if (refs.has(key)) fail(`${gp}.duplicate questionRef`);
            refs.add(key);
          }
        }
      }
      if (group.questions === undefined) continue; // Storage drafts may be incomplete.
      if (!Array.isArray(group.questions)) { fail(`${gp}.questions`); continue; }
      for (const [qi, rawQuestion] of group.questions.entries()) {
        const qp = `${gp}.questions[${qi}]`, question = node(rawQuestion, "question", "questionId", qp);
        if (!question) continue;
        if (typeof question.prompt !== "string") fail(`${qp}.prompt`);
        const options = new Set<string>();
        if (question.options !== undefined) {
          if (!Array.isArray(question.options)) fail(`${qp}.options`);
          else for (const option of question.options) {
            if (!isRecord(option) || !text(option.id) || typeof option.text !== "string" || options.has(String(option.id))) fail(`${qp}.options entry`); else options.add(String(option.id));
          }
        }
        if (question.answerId !== undefined && (!text(question.answerId) || !options.has(String(question.answerId)))) fail(`${qp}.answerId`);
        for (const field of ["answerText", "shortExplanation", "detailedExplanation", "hint"]) if (question[field] !== undefined && typeof question[field] !== "string") fail(`${qp}.${field}`);
        if (question.answerKey !== undefined && (!isRecord(question.answerKey) || !text(question.answerKey.value) || (question.answerKey.source !== undefined && typeof question.answerKey.source !== "string"))) fail(`${qp}.answerKey`);
        if (question.answerId !== undefined && isRecord(question.answerKey) && question.answerKey.value !== question.answerId) fail(`${qp}.conflicting answerKey`);
        if (question.explanation !== undefined) {
          const ex = question.explanation;
          if (!isRecord(ex) || !text(ex.author) || !text(ex.version) || !["draft", "reviewed", "approved"].includes(String(ex.reviewStatus)) || typeof ex.text !== "string" || !text(ex.updatedAt) || !Number.isFinite(Date.parse(String(ex.updatedAt)))) fail(`${qp}.explanation`);
        }
      }
    }
  }
  for (const ref of assetRefs) if (!assets.has(ref)) fail(`asset reference ${ref}`);
  return errors;
}
