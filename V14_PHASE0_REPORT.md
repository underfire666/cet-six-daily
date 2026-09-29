# V14 Phase 0 — Report（阶段报告）

> 生成日期：2026-09-29
> 分支：`feature/v14-real-content-rights`
> 项目：CET-6 Daily
> 本报告不是法律意见。

---

## 基本字段

- **V14_PHASE0_BEFORE_HEAD**: `117aff218b6c817e64ddebca10682360a24fd402`

- **OFFICIAL_CET_STRUCTURE_SOURCE**:
  - https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm （CET 笔试结构说明）
  - https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf （考试大纲 2016 修订版）

- **OFFICIAL_CET_TERMS_SOURCE**: 官方站点未发现面向第三方再分发的使用许可条款；官方公开结构事实 ≠ 真题再分发授权（retrievedAt=2026-09-29）

- **REAL_NAMESPACE_REUSED**: yes（`cet6:<year>-<session>:set<N>`，V13 namespace 不变）

- **SECOND_CONTENT_REPOSITORY_CREATED**: no（所有工作扩展现有 content layer，fixtures 未注册）

- **RIGHTS_STATES**: `unknown` / `researching` / `unverified` / `restricted` / `cleared` / `expired` / `revoked`（production eligible only: `cleared`；缺字段 fail closed）

- **PRIVATE_MODEL_DEFINED**: yes（`src/content/private-content.ts`）

- **PRIVATE_OWNER_SCOPED**: yes（`private:<owner-scoped-id>:<paper-id>`，server 从 auth session 派生 ownerId）

- **PRIVATE_IN_PRODUCTION_SELECTOR**: no（`PRIVATE_NEVER_IN_GLOBAL_SELECTOR=true`）

- **AUDIO_RIGHTS_SEPARATE**: yes（`paperTextRights` / `listeningScriptRights` / `audioRecordingRights` 三分）

- **EXPLANATION_RIGHTS_SEPARATE**: yes（`explanationAuthenticity`: `official_answer` / `project_authored` / `licensed_third_party`）

- **REAL_CONTENT_IMPORTED**: 0

- **REAL_AUDIO_IMPORTED**: 0

- **CLEARED_REAL_SOURCE_COUNT**: 0

- **UNVERIFIED_SOURCE_COUNT**: 13（记录在案的 RESEARCH_ONLY / REJECT 来源，均不可 production）

- **SOURCE_A_DECISION**: RESEARCH_ONLY

- **SOURCE_B_DECISION**: RESEARCH_ONLY

- **SOURCE_C_DECISION**: RESEARCH_ONLY

- **SOURCE_D_DECISION**: REJECT（开放数据集检索结果；未发现 CC0 / MIT / Apache CET6 真题数据集）

- **SOURCE_E_DECISION**: RESEARCH_ONLY

---

## PUBLIC_REAL_REQUIREMENTS（REAL 发布 8 项准入条件）

一道 `authenticity=past_exam` 的 Paper 要进入 production（`status=active` / `published`），必须同时满足：

1. `authenticity === "past_exam"`
2. `stableIdNamespace(paperId) === "real"`（paperId 形如 `cet6:<year>-<session>:set<N>`，与 year/session/set 一致）
3. `rights.rightsStatus === "cleared"`（且通过 `isRightsCleared()`：未过期、未吊销）
4. `rights.redistributionAllowed === true`（明确布尔值，不接受 undefined）
5. `rights.commercialUseAllowed === true`（明确布尔值，production 必须可商用）
6. 权利证据存在（`permissionEvidence` / `licenseName` / `licenseUrl` 至少一个非空）
7. `effectiveAt` 存在且 ≤ 当前日期；`expiresAt` 若存在则 ≥ 当前日期
8. 内容结构校验 PASS（`validatePaper` 返回 0 errors）

任一不满足 → `validatePaper` FAIL + `npm run content:rights` FAIL + production selector 排除。

---

## Gate 结果（8/8 PASS，已独立验证）

- **TESTS**: PASS（527/527 = 513 V13 + 14 V14）
- **TYPECHECK**: PASS
- **LINT**: PASS（0 errors 0 warnings，`--max-warnings 0`）
- **BUILD**: PASS
- **CONTENT_VALIDATE**: PASS（0 errors，production pool = Paper 001 only）
- **CONTENT_RIGHTS**: PASS
- **CONTENT_STATS**: PASS
- **CONTENT_AUDIO_VALIDATE**: PASS（0 errors，1 个允许的 fixture placeholder warning）
- **package.json version**: 13.0.2（未修改）

---

## 7 个 Synthetic Fixtures 清单

全部位于 `src/content/fixture/v14-rights-fixtures.ts`，原创占位内容，未注册进 global registry，不含任何真实真题正文/音频。

| Fixture | 身份 | 场景 | 预期 |
| --- | --- | --- | --- |
| A. `V14_FIXTURE_REAL_CLEARED` | `cet6:2024-12:set1`，past_exam，published，rightsStatus=cleared，证据齐全，effectiveAt/expiresAt 合法 | REAL + cleared → 结构合法 + `realProductionEligible().eligible=true` | allowed（synthetic 示范，非真实可发布卷） |
| B. `V14_FIXTURE_REAL_UNVERIFIED` | 同 A，但 `rightsStatus=unverified` | REAL + unverified → 权利审查未完成 | rejected |
| C. `V14_FIXTURE_REAL_NO_REDISTRIBUTION` | 同 A，但 `redistributionAllowed=false` | REAL + 不可再分发 | rejected |
| D. `V14_FIXTURE_REAL_MISSING_EVIDENCE` | 同 A，但 licenseName/licenseUrl/permissionEvidence 全部清空 | REAL + cleared 但无证据（cleared-without-evidence） | rejected |
| E. `V14_FIXTURE_PRIVATE_OWNER_A` | `private:user-a:imported-paper-001`，owner=user-a | PRIVATE owner A 自己访问 | accessible by A |
| F.（同 E meta，被 B 用户访问） | 同 E | PRIVATE owner A 的卷被 user-b 访问 | rejected（assertPrivateAccess=false） |
| G. `V14_FIXTURE_MOCK_UNCHANGED` | `cet6:mock:v14-regression-001`，original，staging，owned rights | MOCK 回归：不触发 REAL guard，行为不变 | unchanged |

---

## 测试覆盖清单（14 个新测试，`tests/v14-rights.test.ts`）

1. REAL namespace validation：past_exam 必须用 REAL namespace；past_exam 却用 mock namespace → validatePaper 报错
2. REAL production requires rights cleared：rightsStatus != cleared → rejected
3. rights evidence missing → fail（realProductionEligible + validatePaper 双路断言）
4. redistribution=false → fail
5. expired / revoked → fail（isRightsCleared + validatePaper 过期报错）
6. unknown / researching / unverified / restricted / expired / revoked 全部 fail closed；rightsIssues production scope 对非 cleared 报 error
7. MOCK behavior unchanged：Paper 001 仍在 publishable pool；owned rights verdict 仍 allowed
8. FIXTURE behavior unchanged：现有 synthetic fixture 仍 staging，不进 pool
9. PRIVATE never in global production selector：PRIVATE_NEVER_IN_GLOBAL_SELECTOR=true；private id namespace 识别正确，不被误判为 real/mock/fixture
10. PRIVATE owner isolation contract：A accessible / B rejected / 空 session rejected；meta 字段（visibility/productionEligible/globalSelectorEligible/redistributable/shareEligible）全部符合 contract
11. audio rights independent from text rights：past_exam + audio asset 缺 audioRecordingRights → validatePaper 报错
12. rightsStatus state machine transitions：cleared/永久/未来 expiresAt → true；过期/expired/revoked → false
13. realProductionEligible 返回所有不满足原因：合法卷 reasons=0；同时改坏多维度 → reasons 收集 ≥4 条
14. 7 个 fixtures 各自预期行为汇总（A allowed / B,C,D rejected / E,F private isolation / G mock unchanged）

另：`tests/v13-content.test.ts` 中 2 个测试迁移到 V14 lifecycle（uncleared REAL → staging；allowed → explicit cleared）。

---

## Git 状态

- **Branch**: `feature/v14-real-content-rights`
- **V14_PHASE0_BEFORE_HEAD**: `117aff218b6c817e64ddebca10682360a24fd402`
- 未 merge main
- 未创建 v14.0 tag
- Paper 001（`cet6:mock:paper-001`）仍然 production 可用

---

## V14_21_DAY_UI_STARTED: no

## AI_STARTED: no

---

## KNOWN_LIMITATIONS（已知限制）

- PRIVATE import 目前为 **contract-only**：仅有类型 + 断言函数，无 UI、无存储、无服务端鉴权中间件实现。
- 无任何真实真题 / 真实音频导入（REAL_CONTENT_IMPORTED=0，REAL_AUDIO_IMPORTED=0）。
- `official_answer` per-explanation rights record deferred：当前仅 Paper 级 `explanationAuthenticity` 标记，未实现逐题解析粒度的 rights 记录。
- 研究结论时间敏感：SOURCE A–E 的条款/授权状态基于 2026-09-29 快照，production 前须重新核对官方页面与授权方。
- 本报告**不是法律意见**。
- SOURCE_D（开放数据集）检索覆盖度有限，不能排除未来出现新的"CC0/MIT 真题包"；任何人自行上传的开放许可真题包都应视为权利存疑（上传者通常不是版权方）。
- 21-Day Sprint 上线时 Priority 1（cleared REAL）为空，只能依赖 Priority 2（published MOCK，当前仅 Paper 001）。

---

## 后续阶段边界（本阶段不做，等待独立验收）

- 不开始 21-Day Sprint UI 实现
- 不开始 AI 生成题目 / AI TTS 流水线
- 不导入任何未授权真题 / 官方音频
- 不发布 V14（不打 v14.0 tag）
- 不 merge main
- 不接入 SOURCE B / C / E 的商业授权洽谈（待独立验收后另起阶段）

等待独立验收。
