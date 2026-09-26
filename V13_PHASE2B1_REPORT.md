# V13 Phase 2B.1 Report — Paper Identity / Spec Binding / Rights Hardening

> 分支：`feature/v13-real-content` · 阶段：V13 Phase 2B.1
> PHASE2B1_BEFORE_HEAD：`0844adab424b9f98fc669a8464cd2bba75f0f8c0`（docs: add V13 Phase 2B report）
> 按 v13.2.2.txt 规格执行：MOCK namespace 独立 + real/fixture/mock 三向交叉校验 + Paper 001 改 mock ID + TEST FIXTURE 语义去污染 + production Paper 显式 examSpecId 强绑定 + public_domain 必须 evidence。

---

## 1. 执行摘要

Phase 2B.1 解决核心问题：**Paper 001 早期预留 ID `cet6:2026-6:set1` 与真实 administered paper 身份冲突** —— 原创 mock 不应占用 REAL date namespace。本轮完成：

1. **MOCK 命名空间**：`cet6:mock:<mockId>`（第二段保留字 `mock`），`mockPaperStableId` / `isMockStableId` / `SECTION_MOCK_RE` / `MOCK_PAPER_RE`。
2. **三向交叉校验**（`validatePaper`）：fixture=true↔FIXTURE；original/practice↔MOCK；past_exam↔REAL；fixture 与 past_exam 互斥。
3. **Paper 001 改 ID**：`cet6:2026-6:set1` → `cet6:mock:paper-001`（旧 ID 不再使用、不建 alias；未进入任何 production 用户数据，Review/DailyPlan/Session/CloudSync 无依赖）。
4. **TEST FIXTURE 语义去污染**：`cet6:fixture:*`（测试夹具）≠ staging 原创卷（`cet6:mock:*`），命名空间与语义双重区分。
5. **examSpecId 强绑定**：`requiresExplicitExamSpecId` —— past_exam / licensed / active·published / 完整 original·practice mock 必须显式绑定；`KNOWN_EXAM_SPEC_IDS` 改为显式历史列表（旧绑定不受未来 current 改变影响）。
6. **public_domain 收紧**：必须有 evidence（licenseName / permissionEvidence / licenseUrl 任一）且 redistribution=true → allowed；无 evidence → unknown（不静默放行）。
7. 新增 Phase 2B.1 专项测试（§7 清单 11 项全覆盖）；7 项 gates 全部通过；三份 docs 同步；代码 + docs 双 commit 已 push。

**核心结论**：real / fixture / mock 三 namespace 结构上不可碰撞；production Paper 必须显式绑定 spec；public_domain 无证据不放行；未导入任何真实真题/音频；未改 Prisma/Auth/Sync/UI；未开始 Phase 2C。

---

## 2. 代码实现清单

### 2.1 修改的源文件（commit `fix: harden V13 paper identity and spec binding`）

| 文件 | 变更 |
| --- | --- |
| `src/content/stable-id.ts` | +`MOCK_PREFIX`（`cet6:mock`）、+`mockPaperStableId(mockId)`、+`MOCK_PAPER_RE` / `SECTION_MOCK_RE`、`StableIdNamespace` +`"mock"`、`stableIdNamespace` 三向判别、+`isMockStableId`、头注释三 namespace 说明 |
| `src/content/exam-spec.ts` | `KNOWN_EXAM_SPEC_IDS` 改为**显式历史列表**（`["cet6-current-2026", …未来追加]`，禁止删除历史条目）——旧 Paper 冻结绑定旧 spec，不受 future current 改变影响 |
| `src/content/papers.ts` | +import `MOCK_PREFIX` / `KNOWN_EXAM_SPEC_IDS`；namespace↔authenticity/fixture 交叉校验（original/practice→MOCK、past_exam→REAL、fixture↔FIXTURE、fixture 与 past_exam 互斥）；+`requiresExplicitExamSpecId`（production-capable 缺 examSpecId → `must explicitly bind examSpecId` error）；错误消息用 `KNOWN_EXAM_SPEC_IDS.join(", ")` |
| `src/content/rights.ts` | header 原则 +D 条；public_domain 收紧：`redistribution=true` **且** `hasEvidence` → allowed；无 evidence → unknown；redistribution=false → blocked |
| `tests/v13-content.test.ts` | +imports（mockPaperStableId/isMockStableId/MOCK_PREFIX/KNOWN_EXAM_SPEC_IDS）；`makeRealPaper` 显式 `examSpecId`；`makeCompletePaper` 改 MOCK namespace（`(mockId, rights, status)`，完整卷仍 writing 1/listening 25/reading 30/translation 1）；public_domain 测试改 4 项；**+10 项 Phase 2B.1 专项测试** |

### 2.2 测试改造说明（不伪造 PASS，均为真实逻辑断言）

- `makeRealPaper`：past_exam + REAL 语义，显式补 `examSpecId`（避免既有 425 项用例被新强绑定规则误伤）。
- `makeCompletePaper`：authenticity=original + isPartial=false，**必须 MOCK namespace** —— 旧 REAL date namespace 用法已全局替换为 `makeCompletePaper("complete-2026-6-set1", …)`；audio asset 测试的 audioId 同步改 `cet6:mock:complete-2026-6-set1:…`。

---

## 3. 新增专项测试（v13.2.2 §7 清单 11 项）

| # | 场景 | 断言 | 结果 |
| --- | --- | --- | --- |
| 1 | original mock 用 REAL namespace | `original/practice mock must use MOCK namespace` error | ✅ |
| 2 | original mock 用 MOCK namespace | validatePaper 无 error | ✅ |
| 3 | past_exam 用 MOCK namespace | `past_exam must use REAL namespace` error | ✅ |
| 4 | 三 namespace 结构互不碰撞 | real/fixture/mock 判别互斥；Set 大小=3；mock 树 section/group/asset ID 合法；`cet6:mock:2026-6:set1` 与 `cet6:mock:fixture:x` 非法 | ✅ |
| 5 | Paper 001 mock ID 与真实 2026-6 set1 共存 | 两 ID 分别可查；`validateAll` 无 duplicate paper identity / duplicate id | ✅ |
| 6 | production paper 缺 examSpecId | `must explicitly bind examSpecId` error（完整 original mock active / published past_exam 两种） | ✅ |
| 7 | fixture/legacy 兼容规则 | `cet6:fixture:synthetic-001` 删除 examSpecId 后仍通过（fixture 豁免） | ✅ |
| 8 | 显式旧 examSpecId 不受 future current 影响 | `KNOWN_EXAM_SPEC_IDS` 为显式列表且含 `cet6-current-2026`；`isKnownExamSpecId("cet6-current-2026")`；显式绑定旧 spec 的 Paper 无 unknown spec error | ✅ |
| 9 | public_domain no-evidence | verdict=unknown，不可发布 | ✅ |
| 10 | public_domain + evidence | verdict=allowed（带 warning），可发布 | ✅ |
| 11 | public_domain redistribution=false | verdict=blocked，不可发布 | ✅ |

---

## 4. Gates 结果（7 项）

| Gate | 结果 |
| --- | --- |
| `npm test` | **435/435 PASS**（基线 425 + 新增 10） |
| `npm run typecheck` | **PASS**（tsc --noEmit） |
| `npm run lint` | **PASS**（eslint .） |
| `npm run build` | **PASS**（production build，全部路由生成） |
| `npm run content:validate` | **PASS**（Errors 0 / Warnings 0；Paper 1） |
| `npm run content:stats` | **PASS**（Paper sections 4 / groups 7 / questions 10） |
| `npm run content:rights` | **PASS**（production pool 为空，fail-closed） |

---

## 5. 文档更新（commit `docs: finalize V13 paper contract hardening`）

| 文件 | 更新 |
| --- | --- |
| `V13_CONTENT_SPECIFICATION.md` | 阶段标注 2B/2B.1；§3 结构版本化补强绑定规则（`requiresExplicitExamSpecId` 四类）；新增 §4.5 三命名空间表格 + 交叉校验规则 + TEST FIXTURE ≠ staging；§5.1 Paper 001 正式 ID `cet6:mock:paper-001`（旧 ID 弃用说明）；§6 REAL/FIXTURE/MOCK 三 namespace |
| `V13_PAPER_CONTENT_CONTRACT.md` | 阶段标注 2B/2B.1；§1 examSpecId 强绑定；§2 / §3 public_domain 收紧（evidence 列）；§5.1 三 namespace 命名表 + 规则；§8 Validation 清单补三向约束与强绑定 |
| `V13_PHASE2B_REPORT.md` | §7 注明 Phase 2B.1 修正（Paper 001 ID / 三 namespace / 强绑定 / public_domain），冲突处以 2B.1 为准 |

---

## 6. 13 字段

| 字段 | 值 |
| --- | --- |
| MOCK_NAMESPACE_CREATED | YES（`cet6:mock:<mockId>`，含生成/判别/正则） |
| REAL_FIXTURE_MOCK_DISTINCT | YES（三向判别互斥 + 交叉校验强制） |
| PAPER001_ID_CHANGED | YES（`cet6:2026-6:set1` → `cet6:mock:paper-001`，旧 ID 弃用、不建 alias） |
| TEST_FIXTURE_REMOVED_FROM_PRODUCTION_SPEC | YES（`cet6:fixture:*` 仅测试夹具，≠ staging 原创卷；文档 + 校验双重区分） |
| PRODUCTION_EXAMSPEC_REQUIRED | YES（past_exam / licensed / active·published / 完整 original·practice mock 必绑） |
| OLD_PAPER_SPEC_BINDING_STABLE | YES（KNOWN_EXAM_SPEC_IDS 显式历史列表，旧绑定不受 future current 影响） |
| PUBLIC_DOMAIN_REQUIRES_EVIDENCE | YES（无 evidence → unknown，不放行） |
| RIGHTS_FAIL_CLOSED | YES（content:rights production pool 为空） |
| REAL PAST PAPERS IMPORTED | NO |
| REAL CET6 AUDIO COMMITTED | NO |
| PRODUCT CODE CHANGED | YES（仅 `src/content` 契约层 + 测试，规格 §2–§5 要求；UI/Auth/Sync/V8/V9 产品代码未动） |
| PRISMA CHANGED | NO |
| PHASE 2C STARTED | NO |

---

## 7. Git 状态

| 项 | 值 |
| --- | --- |
| 分支 | `feature/v13-real-content` |
| PHASE2B1_BEFORE_HEAD | `0844adab424b9f98fc669a8464cd2bba75f0f8c0` |
| Commit 1（fix） | `fix: harden V13 paper identity and spec binding` |
| Commit 2（docs） | `docs: finalize V13 paper contract hardening` |
| v12.0 tag | `697772d9412d9d1a4253e099a001734a5230e264`（未动） |
| 禁止项 | 未 force push / rebase / reset / squash；未 merge main；未打 tag；未建 Release |

---

## 8. 最终结论

**V13 PHASE 2B.1 PASSED** — 11/11 专项测试 + 435/435 全量测试通过，7 项 gates 全绿，三份 docs 同步，代码 + docs 已 commit + push 至 `feature/v13-real-content`。停止，等待独立验收，不开始 Phase 2C / V14。
