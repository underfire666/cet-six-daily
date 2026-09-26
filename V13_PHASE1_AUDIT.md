# V13 PHASE 1 AUDIT — 现有 V10 Content System 审计

- 日期：2026-09-26
- 基线：main `8eae610e`（Local == origin/main）
- 分支：feature/v13-real-content
- 说明：本文件只审计，不修改代码。V13 在 V10 Content System 之上演进，不建立平行体系。

---

## 1. 审计范围

| 文件 | 职责 |
|---|---|
| `src/content/types.ts` | 统一内容层基础类型（ContentMeta / ContentPack / ContentSource / ContentAlias） |
| `src/content/sources.ts` | 内置来源注册（MOCK_SOURCE） |
| `src/content/packs.ts` | 内置 5 个 Mock Pack 注册 |
| `src/content/registry.ts` | ContentPack 注册表（pack → {pack, source}） |
| `src/content/repositories.ts` | 五专项 Repository（经 Registry 读取 active 内容） |
| `src/content/learning.ts` | 应用层 Adapter（页面直接消费） |
| `src/content/selector.ts` | 确定性内容选择（seed 洗牌，同日稳定） |
| `src/content/validator.ts` | validatePack / validateAll（逐 item + 跨 pack 去重） |
| `src/content/importer.ts` | Raw JSON → Parse → Normalize → Validate → Pack → Registry |
| `src/content/normalize.ts` | normalizeWord / canonicalContentId / hashString |
| `src/content/aliases.ts` | 旧 ID → 新 stable ID 映射（当前为空表） |
| `src/content/difficulty.ts` | 模块难度 → 统一枚举（vocabulary 1–5 → easy/normal/hard） |
| `src/content/papers.ts` | V10 ExamPaper 简化 schema + validatePaper |
| `scripts/content-validate.ts` | `npm run content:validate` |
| `scripts/content-stats.ts` | `npm run content:stats` |
| `src/data/mock*.ts` | 5 专项 Mock 数据（59 条） |

---

## 2. 十二问审计结论

### Q1. 当前 ContentItem 有哪些类型？
`ContentMeta.type` 枚举：`"vocabulary" | "reading" | "listening" | "translation" | "writing" | "paper"`（types.ts:49）。其中 paper 类型已有枚举位但当前无注册 pack；内置 pack 仅 vocabulary / reading / listening / translation / writing 五种。

### Q2. Stable ID 怎么生成？
**没有统一生成器，沿用内容自身 id。**
- vocabulary：`word_<word>`（如 `word_sustain`，mockVocabulary.ts:21）
- reading：`r-<slug>`（如 `r-ai-screening`）
- listening：`l-<slug>`（如 `l-campus-meeting`）
- translation：`t-<slug>`（如 `t-trad-festival`）
- writing：`w-<slug>`（如 `w-ai-impact`）
- 文章/材料内 question：`q1…qN`；option：`a/b/c/d`（**作用域在文章内，不全局唯一**）
- 辅助 ID 稳定性函数：`canonicalContentId(raw)`（normalize.ts:12，trim + 小写 + 空白→下划线）—— 仅用于规范化，不生成新 ID
- Registry 以 `item.id` 跨 pack 去重（validator.ts:95-97）

### Q3. ContentSource 当前有哪些字段？
`{ id, name, type, licenseType, sourceUrl?, publisher?, year?, notes? }`（types.ts:28-37）。
- `type`：`original | official | licensed | user_provided | mock`
- `licenseType`：`original | public | licensed | unknown`

### Q4. license metadata 当前有哪些字段？
仅 `licenseType` 单字段 + 可选 `sourceUrl / publisher / year / notes`。**没有**：rightsHolder、licenseName、licenseUrl、permissionEvidence、allowedUses、attribution、commercialUseAllowed、redistributionAllowed、derivativeAllowed、verifiedAt。V13 需最小扩展。

### Q5. Pack 怎么组织？
`ContentPack<T>`：`{ id, name, version, contentType, sourceId, items, createdAt, updatedAt }`（types.ts:65-74）。
- 内置 5 个 Pack：`pack-vocabulary-mock` / `pack-reading-mock` / `pack-listening-mock` / `pack-translation-mock` / `pack-writing-mock`（packs.ts）
- 每个 Pack 单一 contentType，全部挂在 `src-mock-original` 来源

### Q6. Registry 怎么查找？
`packs: Map<packId, {pack, source}>`（registry.ts）。
- `getContentPack(id)`：按 packId
- `listContentPacks()`：全部 pack
- `getItems(type?)`：按 contentType 拉全部 item（含非 active）
- `getActiveItems(type?, mode)`：默认 demo 模式；production 模式排除 `source.type === "mock" || licenseType === "unknown"`，再按 `item.status === "active"` 过滤
- `getPackSource(packId)`
- `resetRegistry()`：测试用

### Q7. Deprecated ID 怎么 resolve？
`aliases.ts`：`ALIASES: ContentAlias[]`（当前为空数组）+ `resolveAlias(legacyId) → map.get(legacyId) ?? legacyId`。Repository 的 `byId` 在查 Registry 前先 `resolveAlias(id)`（repositories.ts:17）。V10 阶段 identity mapping。

### Q8. Import Pipeline 当前支持什么输入？
`importer.ts`：
- `importContentPackFromJson(raw: string)`：parseJson → normalizeImportedPack → validatePack（error 级即抛 `ContentImportError`）
- `importAndRegisterContentPack(raw, {strict})`：再 registerContentPack
- 只支持 **单个 ContentPack 的 JSON 文本**（顶层 `{id,name,version,contentType,sourceId,items}`）
- 拒绝：invalid JSON / missing pack field / invalid contentType / items 非数组 / 校验错误
- **没有 batch identity**（batchId / importedAt / importerVersion / inputFingerprint / itemCount / warnings / errors），V13 需补 Import Batch。

### Q9. Validator 当前验证什么？
`validatePack(pack)` 逐 item（validator.ts）：
- pack 层：id/name/version/contentType/sourceId 存在、source 已知
- item 层（公共）：id 非空且 pack 内唯一、status ∈ draft/active/deprecated、version/sourceId、时间戳可解析、type == pack.contentType、authenticity ∈ original/practice/past_exam、tags 字符串数组、非 vocabulary 需 title
- vocabulary：word/meaning/partOfSpeech/example/exampleTranslation 非空、secondaryMeanings 数组、phonetic 字符串、difficulty 1–5
- reading/listening：difficulty 枚举、estimatedMinutes>0、passage/transcript 非空、vocabulary 查词表结构、questions 非空、每题（id 唯一、prompt/shortExplanation/detailedExplanation/hint 非空、options ≥2 且 id 唯一、answerId 命中选项）；listening 附加 audio 结构 + keySentences
- translation/writing：prompt/reference 非空、keywords/scoringPoints 等数组、mockFeedback 结构、word range、outline
- paper：调用 `validatePaper`（papers.ts，见下）
- `validateAll(packs)`：跨 pack id 去重、重复 packId、counts 统计

### Q10. 五专项如何消费 Content Repository？
- UI/Provider → `@/content/learning` adapters（`getVocabulary()`、`getReadingArticles()`…）→ 各 `*Repository.all()/getById()` → `getActiveItems(type)`（demo 模式）→ Registry → Pack
- `registerBuiltinPacks()` 幂等（已有 pack 即跳过，packs.ts:12）
- 阅读/听力在 `learning.ts` 用 lookupWords 生成 `rw_<word>` / `lw_<word>` 生词（复用统一生词本，ID 规则独立于 Registry）
- DailyPlan 模块选择 → `selectContent`（确定性 seed 洗牌）

### Q11. 用户进度如何只引用 stable content ID？
- ReviewItem / Session / XP ledger 只存内容稳定 ID（如 `r-ai-screening`、question `q1`、`word_sustain`），并带最小快照（如 lastWrongOptionId）
- 读取回放时经 `resolveAlias(id)` → Registry `byId` 解析；旧数据/缺失内容优雅降级
- V12 PostgreSQL 数据（Review/Wrongbook/Session/DailyPlan）同样只引用 stable content ID —— **V13 不得批量重命名现有 ID，必须走 aliases mapping**（对应 v13.txt §21）

### Q12. 当前 59 条 mock 内容具体怎么分布？
| 专项 | 条数 | ID 样式 | Pack |
|---|---|---|---|
| vocabulary | 30 | `word_sustain` 等 | pack-vocabulary-mock |
| reading | 6 | `r-ai-screening` 等（每题 q1…q4） | pack-reading-mock |
| listening | 7 | `l-campus-meeting` 等 | pack-listening-mock |
| translation | 8 | `t-trad-festival` 等 | pack-translation-mock |
| writing | 8 | `w-ai-impact` 等 | pack-writing-mock |
| **合计** | **59** | | 5 个内置 pack |

---

## 3. 关键差距（V13 Phase 1 要补的）

| # | 差距 | V13 设计 |
|---|---|---|
| 1 | Paper schema 过简（papers.ts 只有 kind + itemIds 引用） | 完整领域层级 Exam → Paper → Section → Group → Question，含 subsection/group/questionOrder/paperSet、isPartial/complete 校验 |
| 2 | 无统一 Stable ID 生成器 | 新增 stableId 工具（`cet6:2025-12:set1:…` 风格 + 兼容现有 convention），含 Paper/Section/Group/Question/Asset ID 类型 |
| 3 | Provenance 字段不足 | 扩展 ContentSource（sourceType 语义已够用）→ 新增 importBatchId / sourceFingerprint / sourceDocumentId / sourcePage / retrievedAt 等 |
| 4 | 无 Rights/License 元数据 | 新增 rights 元数据块（licenseStatus/rightsHolder/licenseName/licenseUrl/permissionEvidence/allowedUses/attribution/commercialUseAllowed/redistributionAllowed/derivativeAllowed/verifiedAt/notes），Validator 拦截 unknown/permission_required 进 production |
| 5 | 无 Content Lifecycle | raw/normalized/validated/reviewed/publishable/published/deprecated（兼容现有 draft/active/deprecated） |
| 6 | 无 Import Batch | batchId/importedAt/importerVersion/inputFingerprint/itemCount/warnings/errors；deterministic + idempotent（重复导入同源同 ID） |
| 7 | Listening Asset 模型缺失 | Asset metadata（assetId/type/source/rights/mimeType/duration/checksum/storage reference），题目/transcript/audio 分离 |
| 8 | Answer/Explanation 未分离 | question/answerKey/explanation（editorial layer 带 author/source/version/reviewStatus） |
| 9 | 无 contentVersion | schemaVersion + contentVersion + changeReason + updatedAt（修正内容不改变 stable ID） |
| 10 | 无 Duplicate Detection | 同 ID → ERROR（已有）；同 sourceFingerprint → ERROR/WARNING；同 year/session/set/section/order 双题 → ERROR；normalized text hash 重复检测 |
| 11 | content:rights 不存在 | 新增 `npm run content:rights`（PUBLISHABLE/BLOCKED/UNKNOWN 统计） |
| 12 | content:validate / stats 未覆盖 paper/rights | 扩展两项脚本 |
| 13 | 无 staging/published 分离 | content/staging 与 content/published 边界；Selector 默认只选 published；学习页绝不抽到 staging/blocked/unknown-rights |
| 14 | 无 synthetic fixture | 原创 CET6 Paper fixture（isPartial=true, fixture=true），验证全链路 |
| 15 | 无 exam specification metadata | CET6 官方公开结构元数据（题型/题量/时间/分值）供 validator，不硬编码在 UI |
| 16 | 无 deprecated-ID 兼容测试 | 新增 old content ID → Registry resolve → replay 测试 |
