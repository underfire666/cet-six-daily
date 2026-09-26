import type { ContentPack } from "./types";
import { getSource } from "./sources";
import { validatePaper } from "./papers";
import { isRealStableId } from "./stable-id";
import { hashString } from "./normalize";

export interface ValidationIssue { level: "error" | "warning"; packId: string; itemId?: string; message: string }
export interface ValidationReport {
  errors: ValidationIssue[]; warnings: ValidationIssue[];
  counts: Record<ContentPack["contentType"], number>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === "string");
const types = ["vocabulary", "reading", "listening", "translation", "writing", "paper"];

/** Runtime validation also handles malformed imported JSON; it never dereferences unchecked content. */
export function validatePack(pack: ContentPack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (message: string, itemId?: string) => issues.push({level:"error", packId: pack?.id ?? "unknown", itemId, message});
  if (!object(pack)) { error("invalid pack"); return issues; }
  if (!text(pack.id) || !text(pack.name) || !text(pack.version) || !types.includes(pack.contentType)) error("invalid pack metadata");
  if (!getSource(pack.sourceId)) error(`unknown sourceId: ${pack.sourceId}`);
  if (!Array.isArray(pack.items)) { error("items must be an array"); return issues; }
  const seen = new Set<string>();
  for (const item of pack.items) {
    const questions = new Set<string>();
    if (!object(item)) { error("item missing id"); continue; }
    // paper item 以 paperId 为稳定 id（registry/validator 统一兼容，模型保持 paperId 单字段）
    const id = (item as { id?: string }).id ?? (pack.contentType === "paper" ? (item as { paperId?: string }).paperId : undefined);
    if (!text(id)) { error("item missing id"); continue; }
    const check = (ok: unknown, message: string) => { if (!ok) error(message,id); };
    if (seen.has(id)) error(`duplicate id: ${id}`,id);
    seen.add(id);
    check(["draft","active","deprecated","raw","normalized","validated","reviewed","publishable","staging","published"].includes(String(item.status)), "invalid or missing status");
    check(text(item.version) || (pack.contentType === "paper" && text(item.contentVersion)), "missing version");
    check(text(item.sourceId) && !!getSource(item.sourceId), "missing or unknown item sourceId");
    check(item.sourceId === pack.sourceId, "item source differs from pack");
    check([item.createdAt,item.updatedAt].every(x => typeof x === "string" && Number.isFinite(Date.parse(x))), "invalid timestamps");
    check(item.type === pack.contentType, "item type differs from pack");
    check(["original","practice","past_exam"].includes(String(item.authenticity)), "invalid authenticity");
    check(strings(item.tags), "invalid tags");
    if (pack.contentType !== "vocabulary") check(text(item.title), "item missing title");
    if (pack.contentType === "vocabulary") {
      for (const field of ["word","meaning","partOfSpeech","example","exampleTranslation"]) check(text(item[field]), `vocabulary empty ${field}`);
      check(strings(item.secondaryMeanings), "invalid secondaryMeanings");
      check(typeof item.phonetic === "string", "invalid phonetic");
      check(Number.isInteger(item.difficulty) && Number(item.difficulty)>=1 && Number(item.difficulty)<=5, "invalid vocabulary difficulty");
    }
    if (pack.contentType === "reading" || pack.contentType === "listening") {
      check(["easy","normal","hard"].includes(String(item.difficulty)), "invalid difficulty");
      check(typeof item.estimatedMinutes === "number" && item.estimatedMinutes > 0, "invalid estimatedMinutes");
      check(text(item[pack.contentType === "reading" ? "passage" : "transcript"]), "missing passage/transcript");
      check(object(item.vocabulary), "missing vocabulary lookup map");
      if (object(item.vocabulary)) for (const entry of Object.values(item.vocabulary)) check(object(entry) && ["word","phonetic","partOfSpeech","meaning","sentence","sentenceTranslation"].every(k => typeof entry[k] === "string"), "invalid vocabulary lookup entry");
      check(Array.isArray(item.questions) && item.questions.length > 0, "missing questions");
      if (Array.isArray(item.questions)) for (const q of item.questions) {
        if (!object(q)) { error("invalid question",id); continue; }
        check(text(q.id) && !questions.has(q.id), "missing or duplicate question id");
        if (text(q.id)) questions.add(q.id);
        for (const field of ["prompt","shortExplanation","detailedExplanation","hint"]) check(text(q[field]), `question missing ${field}`);
        const options = Array.isArray(q.options) ? q.options : [];
        check(options.length >= 2 && options.every(o => object(o) && text(o.id) && text(o.text)), "incomplete options");
        const ids = options.filter(object).map(o=>o.id);
        check(new Set(ids).size === ids.length, "duplicate option id");
        check(text(q.answerId) && ids.includes(q.answerId), "invalid answerId");
      }
      if (pack.contentType === "listening") {
        check(object(item.audio) && (item.audio.type === "file" ? text(item.audio.src) : item.audio.type === "mock-tts" && text(item.audio.text)), "listening missing audio source");
        check(strings(item.keySentences), "invalid keySentences");
      }
    }
    if (pack.contentType === "translation" || pack.contentType === "writing") {
      const translation = pack.contentType === "translation";
      check(text(item[translation ? "promptChinese" : "prompt"]), "empty prompt");
      check(text(item[translation ? "referenceTranslation" : "referenceEssay"]), "missing reference answer");
      for (const field of translation ? ["keywords","scoringPoints"] : ["requirements","suggestedWords","scoringPoints"]) check(strings(item[field]), `invalid ${field}`);
      check(object(item.mockFeedback) && text(item.mockFeedback.summary) && Array.isArray(item.mockFeedback.issues) && item.mockFeedback.issues.every(x => object(x) && ["type","title","description","severity"].every(k=>text(x[k]))) && Array.isArray(item.mockFeedback.details) && item.mockFeedback.details.every(x => object(x) && ["excerpt","userExpression","referenceExpression","note"].every(k=>typeof x[k] === "string")), "invalid mockFeedback");
      if (!translation) {
        check(Array.isArray(item.suggestedWordsRange) && item.suggestedWordsRange.length === 2 && item.suggestedWordsRange.every(n => Number.isInteger(n) && Number(n)>0) && item.suggestedWordsRange[0] <= item.suggestedWordsRange[1], "invalid word range");
        check(Array.isArray(item.outline) && item.outline.every(x => object(x) && text(x.type) && text(x.content)), "invalid outline");
      }
    }
    if (pack.contentType === "paper") {
      // V13 Phase 1.1：validatePack 只做结构校验（schema validity）。
      // rights unknown / permission_required / unverified official 允许以 staging/raw 状态
      // 进入系统做人工审查（“可以被系统保存/审计”）；production 发布权由
      // rightsVerdict / rightsIssues(scope="production") / getPublishableItems 分层把关
      // （“可以被产品发布”），学习页 Selector 永远抽不到非 allowed 内容。
      for (const message of validatePaper(item)) error(message,id);
    }
    if (item.schemaVersion !== undefined && !text(item.schemaVersion)) error("invalid schemaVersion",id);
    if (item.contentVersion !== undefined && !text(item.contentVersion)) error("invalid contentVersion",id);
  }
  return issues;
}

export function validateAll(packs: ContentPack[]): ValidationReport {
  const report: ValidationReport = { errors:[], warnings:[], counts:{vocabulary:0,reading:0,listening:0,translation:0,writing:0,paper:0} };
  const ids = new Set<string>();
  const packIds = new Set<string>();
  // V13 duplicate detection：同 (exam,year,session,set) 的 paper 只能出现一次；
  // 同 passage/transcript 文本（normalized hash）跨 pack 重复 → warning（同源合法导入/疑似重复）。
  const paperIdentities = new Map<string, string>();
  const textHashes = new Map<string, string>();
  for (const pack of packs) {
    const issues = validatePack(pack);
    if (packIds.has(pack.id)) issues.push({level:"error",packId:pack.id,message:"duplicate pack id"});
    packIds.add(pack.id);
    if (Array.isArray(pack.items)) {
      if (types.includes(pack.contentType)) report.counts[pack.contentType] += pack.items.length;
      for (const item of pack.items) {
        if (!object(item)) continue;
        const itemId = (item as { id?: string }).id ?? (pack.contentType === "paper" ? (item as { paperId?: string }).paperId : undefined);
        if (text(itemId)) {
          if (ids.has(itemId)) issues.push({level:"error",packId:pack.id,itemId:itemId,message:`duplicate id across packs: ${itemId}`});
          ids.add(itemId);
        }
        // paper identity duplicate（仅 REAL namespace；FIXTURE namespace 结构上独立，
        // synthetic fixture 与真实 2025-12 set1 永不冲突）
        if (pack.contentType === "paper" && text(itemId) && isRealStableId(itemId)) {
          const yr = Number(item.year);
          const ses = Number(item.session);
          const st = Number(item.set);
          if (Number.isInteger(yr) && yr >= 2000 && [6, 12].includes(ses) && Number.isInteger(st) && st >= 1) {
            const key = `${String(item.exam)}:${yr}-${ses}:set${st}`;
            if (paperIdentities.has(key)) issues.push({level:"error",packId:pack.id,itemId:itemId,message:`duplicate paper identity: ${key} (already ${paperIdentities.get(key)})`});
            else paperIdentities.set(key, itemId);
          }
        }
        // normalized text duplicate（reading passage / listening transcript / writing prompt / translation promptChinese）
        const textField =
          pack.contentType === "reading" ? item.passage
          : pack.contentType === "listening" ? item.transcript
          : pack.contentType === "writing" ? item.prompt
          : pack.contentType === "translation" ? item.promptChinese
          : undefined;
        if (typeof textField === "string" && textField.trim().length > 20 && text(itemId)) {
          const h = hashString(textField.trim().toLowerCase().replace(/\s+/g," ")).toString(16);
          if (textHashes.has(h)) issues.push({level:"warning",packId:pack.id,itemId:itemId,message:`duplicate normalized text hash ${h} (also ${textHashes.get(h)}) — 同源合法导入可忽略，重复注册需排查`});
          else textHashes.set(h, itemId);
        }
      }
    }
    for (const issue of issues) report[issue.level === "error" ? "errors" : "warnings"].push(issue);
  }
  return report;
}
