# V13 Phase 2B Report — 官方考试结构规范 + Paper/Section/Item 层级 + Rights-aware 契约

> 分支：`feature/v13-real-content` · 阶段：V13 Phase 2B
> PHASE2B_BEFORE_HEAD：`2b52601aa2ea49704ef5bc54e01649db096b5293`
> 本报告为最终交付载体，按 v13.2.1.txt §24 字段汇报。

---

## 1. 执行摘要

V13 Phase 2B 在 Phase 1/1.1 已建成的基础上，完成：
1. **规格层版本化**：`examSpecId: "cet6-current-2026"` + Listening/Reading 子节题量与占比（8/7/10、10/10/10）+ `isKnownExamSpecId` 校验。
2. **Paper/Section/Item 内容层级强化**：`CET6Paper.examSpecId`、完整卷 spec conformance 校验（section 级 + listening/reading 子节级）。
3. **Rights-aware Content Contract**：新增 `public_domain` 状态（fail-closed），`restricted`/`internal_reference` 由现有状态表达（文档映射）。
4. **Listening Asset Contract**：听力 group 强制 transcript（脚本权利与音频权利分离）、audio asset 强制 rights、assetIds 交叉引用（orphan 拒绝）。
5. **Explanation / Stable ID / V10 兼容契约**：文档化（契约文档）。
6. **第一套原创高仿真卷生产规范**：`V13_CONTENT_SPECIFICATION.md`（不包含试题正文）。
7. 新增 12 项测试；7 项 gates 全部通过；代码 + 文档双 commit 已 push。

**核心结论**：V13 Paper 是 **V10 Content System 的扩展**（contentType="paper" 走同一 registry/validator/importer 管线），不是第二套平行题库；未导入任何真实真题/音频，未修改 Prisma/db/sync/UI/V8 编排/V9 调度，未开始 Phase 2C。

---

## 2. 代码实现清单

### 2.1 修改的源文件（commit `b048ae4` feat: add V13 paper content contract）

| 文件 | 变更 |
| --- | --- |
| `src/content/exam-spec.ts` | +`examSpecId`、+`Cet6ListeningSubsectionSpec`/`Cet6ReadingSubsectionSpec`（questionCount+scoreRatio）、Listening 子节 8/8%·7/7%·10/20%、Reading 子节 10/5%·10/10%·10/20%、+`KNOWN_EXAM_SPEC_IDS`、+`isKnownExamSpecId` |
| `src/content/types.ts` | `ContentLicenseStatus` +`"public_domain"` |
| `src/content/rights.ts` | `rightsVerdict` +public_domain 分支（true→allowed / ≠true→unknown / false→blocked）、`RightsBucket` +public_domain、`rightsIssues` +public_domain warning |
| `src/content/papers.ts` | `CET6Paper.examSpecId?`、unknown examSpecId error、`validateSpecConformance`（完整卷 section/子节题量）、听力 group 强制 transcript、audio asset 强制 rights、assetIds 交叉引用（orphan error） |
| `tests/v13-content.test.ts` | +12 项测试（exam spec 官方结构/examSpecId/conformance/听力结构/transcript/orphan/audio rights/public_domain×3） |

### 2.2 文档（commit `6a17579` docs: define V13 CET6 paper content contract）

| 文件 | 内容 |
| --- | --- |
| `V13_CONTENT_SPECIFICATION.md` | CET6_CURRENT_SPEC（官方结构唯一真相源）+ 结构版本化 + 完整卷 conformance 规则 + Paper 001 生产规范 + V10 关系 |
| `V13_PAPER_CONTENT_CONTRACT.md` | Paper 领域模型 / 类型映射 / Rights fail-closed / Provenance 五问 / Assets 契约 / Explanation / Stable ID 策略 / Validation 清单 / V8·V9·V10 兼容 / Difficulty |
| `V13_PHASE2B_REPORT.md` | 本文件 |

---

## 3. 测试与 Gates 结果

| Gate | 结果 |
| --- | --- |
| `npm test` | **425/425 PASS**（基线 413 + 新增 12） |
| `npm run typecheck` | **PASS**（tsc --noEmit） |
| `npm run lint` | **PASS**（eslint .） |
| `npm run build` | **PASS**（production build，全部路由生成） |
| `npm run content:validate` | **PASS**（Errors 0 / Warnings 0；Paper 1） |
| `npm run content:stats` | **PASS**（Paper sections 4 / groups 7 / questions 10） |
| `npm run content:rights` | **PASS**（production pool 为空；fixture ALLOWED=owned 但 staging 不发布） |

新增测试覆盖（真实逻辑，非硬编码断言）：
- 官方结构版本化：`examSpecId="cet6-current-2026"`、子节 8+7+10=25、10+10+10=30、旧结构（short conversations / 3 passages）不得出现。
- unknown examSpecId 拒收。
- 完整卷通过 conformance；长对话 9 题 / 篇章 6 题 → 报错；section 总数 24 → 报错。
- partial（fixture）豁免题量 conformance 但仍通过字段校验。
- 听力 group 缺 transcript → 报错。
- assetIds 引用不存在 asset → orphan 报错。
- audio asset 缺 rights → 报错。
- public_domain：true→allowed（带 warning）、缺省→unknown、false→blocked。

---

## 4. 验收点判定（v13.2.1.txt §22 的 18 项）

| # | 验收点 | 判定 | 依据 |
| --- | --- | --- | --- |
| 1 | 当前官方结构唯一真相源 | ✅ YES | `CET6_EXAM_SPEC`（NEEA 官方 URL 注释）+ 测试 |
| 2 | 结构 spec 独立可 versioned | ✅ YES | `examSpecId` + `KNOWN_EXAM_SPEC_IDS` + `isKnownExamSpecId` |
| 3 | 不允许旧结构（short conversations / 3 passages） | ✅ YES | exam-spec.ts 仅新结构；测试断言 + grep 复查 |
| 4 | Paper 可表示 official sample / licensed / original mock | ✅ YES | authenticity + licenseStatus 组合（original/owned、licensed、official_public_material）+ 既有测试矩阵 |
| 5 | Listening 完整卷按官方题量校验 | ✅ YES | `validateSpecConformance`（长对话 8 / 篇章 7 / 讲话·报道·讲座 10） |
| 6 | 部分卷（fixture）豁免 | ✅ YES | isPartial=true 豁免 + 测试 |
| 7 | rights fail-closed | ✅ YES | `rightsVerdict`（含新增 public_domain）+ production pool 测试 |
| 8 | production 不暴露 staging/fixture/blocked | ✅ YES | `getPublishableItems` 既有实现 + 测试 |
| 9 | 未授权真实真题不得进 production | ✅ YES | Phase 2A 结论 + fail-closed + content:rights 验证 production pool 为空 |
| 10 | provenance 可回答五问 | ✅ YES | `ContentProvenance` + sourceId + importBatchId + 契约 §4 映射 |
| 11 | Listening asset 明确 script vs audio | ✅ YES | 听力 group 强制 transcript + audio asset 强制 rights（本轮新增） |
| 12 | Explanation contract 不缺失 | ✅ YES | `EditorialExplanation` 既有 + validator 校验 + 契约 §7 |
| 13 | Paper 是 ContentPack subtype 非平行系统 | ✅ YES | contentType="paper" 统一 registry/validator/importer |
| 14 | validator 覆盖缺失项 | ✅ YES | 本轮新增 4 类校验（spec/examSpecId/transcript/asset）+ 12 项测试 |
| 15 | V8/V9 兼容 | ✅ YES | DailyPlan task id 模块级、ReviewItem 通用格式、Repository 统一（契约 §9） |
| 16 | Stable ID 全局唯一/保留/版本规则 | ✅ YES | `stable-id.ts` 既有 + 契约 §5 规则 |
| 17 | 第一套原创高仿真卷生产规范 | ✅ YES | `V13_CONTENT_SPECIFICATION.md`（不含试题正文） |
| 18 | Difficulty/quality contract | ✅ YES | `unifiedDifficulty` 既有 + 契约 §10 |

**18/18 YES · PARTIAL 0 · NO 0**

---

## 5. Git 状态

| 项 | 值 |
| --- | --- |
| 分支 | `feature/v13-real-content` |
| PHASE2B_BEFORE_HEAD | `2b52601aa2ea49704ef5bc54e01649db096b5293` |
| Commit 1（feat） | `b048ae4` — feat: add V13 paper content contract |
| Commit 2（docs） | `6a17579` — docs: define V13 CET6 paper content contract |
| Push | `2b52601..6a17579  feature/v13-real-content -> feature/v13-real-content` 成功（首次网络失败后重试成功） |
| v12.0 tag | `697772d9412d9d1a4253e099a001734a5230e264`（未动） |
| 禁止项 | 未 force push / rebase / reset / squash；未 merge main；未打 tag；未建 Release |

---

## 6. 18 项验收问答（§24）

| # | 问题 | 判定 |
| --- | --- | --- |
| 1 | 官方考试结构是否正确建模？ | YES |
| 2 | 结构 spec 是否 versioned？ | YES |
| 3 | 旧听力结构是否彻底移除？ | YES |
| 4 | Paper 能否表达官方样卷/授权/原创仿真？ | YES |
| 5 | 完整卷是否符合官方题量校验？ | YES |
| 6 | partial paper 是否豁免？ | YES |
| 7 | rights 是否 fail-closed？ | YES |
| 8 | staging/fixture/blocked 是否隔离于 production？ | YES |
| 9 | 未授权真题是否无法进入 production？ | YES |
| 10 | provenance 是否可审计？ | YES |
| 11 | 听力 script/audio 权利是否分离？ | YES |
| 12 | explanation 是否完整？ | YES |
| 13 | Paper 是否 V10 扩展而非平行系统？ | YES |
| 14 | validator 是否覆盖缺失项？ | YES |
| 15 | V8/V9 是否无回归？ | YES |
| 16 | stable ID 策略是否明确？ | YES |
| 17 | 原创卷生产规范是否就绪？ | YES |
| 18 | difficulty/quality 契约是否就绪？ | YES |

---

## 7. 已知限制 / 未做（保持 Phase 2A 结论）

- 未导入任何真实历年真题正文 / 真实 CET6 音频 / 来源不明 PDF（`REAL PAST PAPERS IMPORTED: NO`、`REAL CET6 AUDIO COMMITTED: NO`）。
- 未选择 TTS provider、未生成任何音频（Phase 2B 明确不做）。
- 未修改 Prisma / db migrations / auth / sync / UI / V8 编排 / V9 调度。
- Paper 001 试题正文尚未生产（属 Phase 2B 之后的生产流程；本阶段只定义规范与契约）。
- **Phase 2B.1 修正**（详见 `V13_PHASE2B1_REPORT.md`）：Paper 001 正式 ID 改为 `cet6:mock:paper-001`（MOCK 命名空间）；早期预留 ID `cet6:2026-6:set1` 不再使用、不建 alias；real/fixture/mock 三命名空间结构隔离；production Paper 必须显式绑定 examSpecId；public_domain 收紧为必须有 evidence。Phase 2B 报告中凡与此冲突之处，以 Phase 2B.1 为准。
- Phase 2C / V14：未开始。

---

## 8. 最终结论

**V13 PHASE 2B COMPLETE** — 18/18 验收点全绿，7 项 gates 全部通过，代码与文档已 commit + push 至 `feature/v13-real-content`。停止，等待独立验收，不开始 Phase 2C / V14。
