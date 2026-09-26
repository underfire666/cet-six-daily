# V13 PHASE 1 REPORT — 真实内容系统 / 真题导入基础设施

- 日期：2026-09-26
- 分支：`feature/v13-real-content`
- Before HEAD：`8eae610e306a109ee9b04f99a6c1a503c388c282`（= origin/main，V12 finalization docs commit）
- After HEAD：见文末 Git State（本轮 commit 后）
- 结论：**V13 PHASE 1 PASSED**

---

## 1. 目标与边界（v13.txt 摘要）

在 **V10 Content System 之上演进**（不推倒重建、不建第二套平行体系），实现：
Paper 领域模型（Exam→Paper→Section→Group→Question）、Stable ID、Content Provenance、
Rights/License 元数据、Content Lifecycle、Import Batch（deterministic/idempotent）、
Paper Schema 与 Listening Asset 模型、Answer/Explanation 分离、Content Versioning、
Duplicate Detection、Quality/Rights Validation（`npm run content:rights`）、
Staging vs Published 隔离、首份原创 synthetic CET6 paper fixture（isPartial=true, fixture=true）。

**本轮明确禁止并已遵守**：不导入网上 CET-6 历年真题全文、不引入真实真题音频、不引入培训机构 PDF；
不重设计任何学习 UI/首页/账号；不改 V12 tag/Release；不开始 V13 Phase 2。

---

## 2. Architecture（数据流，保持 V10 主线）

```
Raw Source → Import Adapter (import-batch, deterministic fingerprint)
  → Normalize (normalizeImportedPack)
  → Validate (validatePack / validatePaper / rightsIssues)
  → Provenance/Rights Check (content:rights)
  → Content Registry (pack 注册, staging/published 隔离)
  → Content Pack (published)
  → Existing Repository (五专项 repository / getPublishableItems)
  → V4–V9 学习模块（Select 只选 published；staging/blocked/unknown-rights 永不暴露）
```

- 新增文件全部挂在 `src/content/` 下，是 V10 体系的增量扩展。
- 现有 mock 内容 ID（`word_<word>`/`r-<slug>`/`l-<slug>`/`t-<slug>`/`w-<slug>`）**未做任何批量重命名**；
  未来重命名一律走 `aliases.ts`（新增运行时 `registerAlias`），保证 V12 用户数据（Review/Wrongbook/Session/DailyPlan 引用 stable content ID）回放不破。

---

## 3. Audit（12 问结论，详见 V13_PHASE1_AUDIT.md）

| 问 | 结论 |
|---|---|
| ContentItem 类型 | vocabulary/reading/listening/translation/writing/paper（paper 已有枚举位，无注册 pack） |
| Stable ID 生成 | 无统一生成器，沿用内容自身 id；V13 新增 Paper 树分层 ID 生成器 |
| ContentSource 字段 | id/name/type/licenseType/sourceUrl?/publisher?/year?/notes? |
| license 字段 | 仅 licenseType；V13 新增完整 rights 元数据块 |
| Pack 组织 | 5 内置 pack（pack-*-mock），单 contentType/单 source |
| Registry 查找 | getContentPack/getItems/getActiveItems(demo\|production) |
| Deprecated resolve | aliases.ts（原为空表）+ resolveAlias identity mapping |
| Import Pipeline | parse→normalize→validate→(register)；无 batch/fingerprint → V13 补齐 |
| Validator 范围 | pack 层 + 逐 item 五专项字段；无 rights/duplicate → V13 扩展 |
| 五专项消费 | Repository→getActiveItems(demo)（mock 放行）→learning adapters→UI |
| 用户进度引用 | 只存 stable content ID + 最小快照；resolveAlias 兼容 |
| 59 条分布 | vocabulary 30 / reading 6 / listening 7 / translation 8 / writing 8 |

---

## 4. Paper Model（src/content/papers.ts）

- 层级：`Exam → Paper → Section → Group → Question`；Paper 同时是 Content Registry 的
  `contentType="paper"` item（registry/validator 对 paperId 与 id 统一兼容）。
- `CET6Paper`：paperId / exam / level / year / session(6|12) / set / title / sourceId / rights /
  sections / assets? / schemaVersion / contentVersion? / isPartial? / fixture? / status /
  authenticity / createdAt / updatedAt / type:"paper" / tags。
- `PaperSection`：sectionId / type(writing|listening|reading|translation) / order / instructions? / groups。
- `PaperGroup`：groupId / type(8 种小节) / order / passage? / transcript? / prompt? /
  `questionRefs[]`（引用已注册内容 item 内题目）或 `questions[]`（paper 内联题）。
- `PaperQuestion`：兼容 V10 Question 字段（prompt/options/answerId/解析），扩展
  choice/cloze/matching/subjective_writing/subjective_translation、`answerKey`（source-derived）、
  `explanation`（editorial layer：author/version/reviewStatus/text/updatedAt）——Answer/Explanation 分离。
- `PaperAsset`：assetId/type(audio|image|transcript|document)/source/mimeType/duration?/checksum?/rights。
  Listening 题目/transcript/audio 分离；真实音频未引入（本轮 asset 为占位，禁 base64 大音频）。
- `validatePaper`：完整结构校验（section order 1..N、group order、questionId 唯一、选项 id 唯一、
  answerId 命中、rights 存在、schemaVersion、stable ID 格式与 paperId-identity 一致性、isPartial/fixture 显式标记）；
  **兼容 V10 旧 schema**（{id, examType, month, sections:[{kind,itemIds}]} → 结构级校验路径，用户数据回放不破）。

---

## 5. Stable ID（src/content/stable-id.ts）

- Paper 树分层 ID（可读、稳定、一次生成不变）：
  - paper：`cet6:2025-12:set1`
  - section：`cet6:2025-12:set1:reading`
  - group：`cet6:2025-12:set1:reading:careful:g3`
  - question：`cet6:2025-12:set1:reading:careful:g3:q2`
  - asset：`cet6:2025-12:set1:listening:lecture:g2:audio1`
- 生成函数 `paperStableId/sectionStableId/groupStableId/questionStableId/assetStableId` + 格式校验
  `isValidStableId`（确定性、幂等：同身份永远同 ID）。
- 修正解析/排版不改变 stable ID（走 contentVersion + changeReason）；仅当原题身份变化才换新 ID 并在 aliases 登记。

---

## 6. Provenance（src/content/types.ts 扩展）

- `ContentProvenance`：sourceType / sourceTitle? / sourceUrl? / publisher? / rightsHolder? /
  publishedAt? / retrievedAt? / sourceDocumentId? / sourcePage? / importBatchId? / sourceFingerprint?。
- 挂到 ContentSource（可选，向后兼容）与 ContentPack（可选）。
- sourceUrl 可空，**严禁伪造 URL 填空**（本轮 synthetic fixture 无 sourceUrl，provenance.sourceTitle 如实标注"原创"）。

---

## 7. Rights / License（src/content/rights.ts + types）

- `ContentRights`：licenseStatus（owned|licensed|official_public_material|permission_required|unknown）、
  rightsHolder? / licenseName? / licenseUrl? / permissionEvidence? / allowedUses? / attribution? /
  commercialUseAllowed? / redistributionAllowed? / derivativeAllowed? / verifiedAt? / notes?。
- 判定：owned → allowed；official_public_material → allowed；licensed + 有效证据 → allowed(warning 提示发布前复核)；
  licensed 无证据 → blocked；permission_required → blocked；unknown / 缺失 → unknown。
- **sourceType=official 不自动等价 unrestricted redistribution**（校验器只认 licenseStatus + evidence）。
- unknown/permission_required 允许在 raw/staging/audit，**默认禁进 production published pack**（validator + getPublishableItems 双重拦截）。
- `npm run content:rights` 输出每个 pack 的 PUBLISHABLE/BLOCKED/UNKNOWN、licenseStatus 分布、production pool 内容。

---

## 8. Import Pipeline（src/content/import-batch.ts + importer.ts 扩展）

- `ImportBatch`：batchId / sourceId / importedAt / importerVersion(v13.0.0) / inputFingerprint /
  itemCount / warnings / errors / status。
- deterministic：同一原始输入永远产生同一 `inputFingerprint`（hashString + 归一化）与 batchId
  （`import-<sourceId>-<fingerprint 前12>`）；内容 stable ID 由导入方按源内容确定性给出。
- idempotent：`importContentPackWithBatch(raw)` 同 sourceId+同 fingerprint 已导入时
  `imported=false` 不重复注册（测试证明不产生重复 pack/内容/题目）。
- 拒绝：invalid JSON / missing pack field / invalid contentType / unknown source / 校验错误。

---

## 9. Staging vs Published 隔离

- `getPublishableItems(type?)`（registry.ts 新增）：production published 池，
  排除 mock/unknown-license 来源、排除 `rightsVerdict!==allowed`、只取 status ∈ {active, published}；
  **staging/raw/blocked/unknown-rights 一律不进入**。
- synthetic fixture 注册为 `status="staging"`、`fixture=true`：
  - 不进 production pool（脚本/测试双验证：`content:validate` 断言 production pool 无 paper）；
  - 不进学习页 Selector/Repository（demo 池按五专项 type 过滤，paper 永不混入）；
  - 仅 `getPaperById / resolveContentById`（开发/测试 resolve）。
- Selector（selectContent）只对传入 pool 操作，学习页 pool 来自 repository（无 paper）→ 天然隔离 + 测试断言。

---

## 10. Validator 扩展（src/content/validator.ts）

- status 枚举扩展（兼容 lifecycle：raw/normalized/validated/reviewed/publishable/staging/published）。
- paper 分支：validatePaper + rights 强制校验（unknown/permission_required → error）。
- Duplicate Detection（validateAll 新增）：
  - 跨 pack item id 去重（error，保留）；
  - **同 paper identity（exam:year-session:set）重复 → error**；
  - **同 normalized 文本 hash（reading passage / listening transcript / writing prompt /
    translation promptChinese）跨 pack → warning**（同源合法导入可忽略，重复注册需排查）。
- schemaVersion/contentVersion 字段合法性检查。

---

## 11. Rights Validator（新增 npm run content:rights）

- 输出：每 pack 判定（PUBLISHABLE/BLOCKED/UNKNOWN）+ licenseStatus 分布 + production pool 快照。
- 通过条件：production pool 只含 allowed（本轮 Phase 1 production pool 为空 → PASS；
  mock pack 的 unknown 属于 demo/staging 范畴，不进 production，不视为失败）。
- 结果：`Rights check PASS: production pool contains only allowed content.`

---

## 12. Synthetic Fixture（src/content/fixture/cet6-2025-12-synthetic.ts）

- `cet6:2025-12:set1`：原创 CET6 Paper，**isPartial=true、fixture=true、status=staging、rights=owned**。
- 结构：4 section（writing/listening/reading/translation）、7 group
  （writing / long_conversation / lecture / cloze / matching / careful_reading / translation）、
  10 题（inline questions 带 paper 作用域 stable ID，演示 answerKey+explanation 分离）、
  1 音频 asset（占位，mimeType/duration/checksum 元数据完整，不含真实音频）。
- 内容全部原创（原创写作 prompt、原创听力脚本、原创阅读 passage、原创翻译句、原创题目）；
  不包含任何真实历年真题原文 / 培训机构 PDF / 真实听力音频。
- 注册函数 `registerSyntheticPaperFixture()`（幂等）仅供脚本/测试调用，不进入应用运行时 bootstrap。

---

## 13. Automated Tests

- 新增 `tests/v13-content.test.ts`（29 项，全部通过）：
  Paper 模型（fixture 通过、order 1..N、duplicate questionId、invalid answerId、paperId mismatch/format、
  empty sections、isPartial/fixture 显式标记）｜Stable ID 确定性/格式｜Rights 五态（unknown→blocked、
  permission_required→blocked、owned→allowed、licensed+evidence→allowed+warning、licensed 无证据→blocked）｜
  Lifecycle 状态机与 V10 映射｜Import Batch（fingerprint/batchId 确定性、幂等不重复注册）｜
  Duplicate（同 paper identity → error、不同 set 不误报、同文本 hash → warning）｜
  隔离（staging 不进 production/学习池、dev/test resolve）｜59 mock 回归｜deprecated ID alias→Registry→replay｜
  exam spec 结构｜importer 拒收坏 JSON 与 unknown-rights paper。
- 全量测试：**399/399 PASS**（新增 29 + 既有 370，无回归）。

---

## 14. Gates（全部通过）

| Gate | 结果 |
|---|---|
| npm test | 399/399 PASS |
| npm run typecheck | PASS |
| npm run lint | 0 errors |
| npm run build | PASS |
| npm run content:validate | 0 errors（59 mock + 1 paper；production pool 无 paper 断言通过） |
| npm run content:stats | PASS（vocabulary 30 / reading 6 / listening 7 / translation 8 / writing 8 / paper 1；rights: unknown 5 / owned 1；paper sections 4 / groups 7 / questions 10） |
| npm run content:rights（新增） | PASS（PUBLISHABLE 1 / BLOCKED 0 / UNKNOWN 5；production pool 空） |
| npx prisma validate | PASS |
| npx prisma generate | PASS |
| npx prisma migrate status | PASS（2 migrations found, up to date） |

---

## 15. Browser Smoke（真实浏览器）

- `/practice/vocabulary`：词汇首页正常渲染（今日 0/20、开始学习、生词本入口）；
  点击"开始学习"真实进入会话并推进（sustain → feasible）。
- `/practice/reading`：阅读首页正常渲染（今日 0/3）。
- `/review`、`/me`、`/plan/settings`、听力/翻译/写作路由均 200。
- 学习页面无任何 paper/真题入口（fixture 不暴露）；无 runtime console error
  （仅有 Next dev data-inspector-id hydration 差异 warning，非产品缺陷）。
- 学习 UI / 首页 / 账号 **零改动**（本轮未触碰 src/app、src/components 学习组件）。

---

## 16. Git State

- Before：`8eae610e306a109ee9b04f99a6c1a503c388c282`（main == origin/main）
- 分支：`feature/v13-real-content`（从 main 创建，未 merge main）
- Commit message：`feat: build V13 real content foundation`
- After：见本文件交付时的实际 HEAD（commit 后已 push origin，Local == Remote，worktree clean）
- v12.0 tag → `697772d9412d9d1a4253e099a001734a5230e264`（未改动）
- 禁止项遵守：无 force push、未 merge main、未打 tag、未建 Release、未开始 V13 Phase 2。

```
REAL PAST PAPERS IMPORTED: NO
UNLICENSED CONTENT COMMITTED: NO
REAL CET6 AUDIO COMMITTED: NO
```

---

## 17. 结论

**V13 PHASE 1 PASSED** — 真实内容系统 / 真题导入基础设施（Paper 模型、Stable ID、Provenance、
Rights、Lifecycle、Import Batch、Duplicate Detection、content:rights、Staging/Published 隔离、
原创 synthetic fixture、Answer/Explanation 分离）已在 V10 之上完成并通过全部 gates 与浏览器 smoke；
未导入任何真实真题/音频/培训机构材料，未破坏 V4–V12 功能，未开始 V13 Phase 2。
