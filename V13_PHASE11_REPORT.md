# V13 PHASE 1.1 REPORT — Content Identity + Rights Hardening

- 日期：2026-09-26
- 分支：`feature/v13-real-content`
- Before HEAD（PHASE11_BEFORE_HEAD）：`1bb6910313e17cb023682fff4be41e53964b2a94`（V13 Phase 1 commit，Local == Remote）
- After HEAD（PHASE11_AFTER_HEAD）：见文末 Git State（本轮 commit 后）
- 结论：**V13 PHASE 1.1 PASSED**

---

## 1. 目标与边界

进入第一批真实内容之前的小型架构硬化：
1. **Identity**：synthetic fixture 不再占用真实试卷命名空间（`cet6:2025-12:set1` → 独立 FIXTURE namespace），
   REAL 与 FIXTURE 结构上可区分，未来导入真实 2025-12 set1 零冲突。
2. **Rights**：official_public_material 不再无条件 allowed；production publish verdict 明确 fail closed。

不扩大范围、不导入真实真题/真实音频、不修改学习 UI、不开始 V13 Phase 2。

---

## 2. Fixture Namespace（新）

```
paper   : cet6:fixture:synthetic-001
section : cet6:fixture:synthetic-001:reading
group   : cet6:fixture:synthetic-001:reading:careful:g3
question: cet6:fixture:synthetic-001:reading:careful:g3:q2
asset   : cet6:fixture:synthetic-001:listening:lecture:g2:audio1
```

- 前缀 `cet6:fixture:` 为 FIXTURE 保留字；`<fixtureId>` 仅允许 `[a-z0-9][a-z0-9-]*`（如 `synthetic-001`）。
- 生成：`fixturePaperStableId(fixtureId)`；子段用通用 `extendStableId(base, ...segments)`。
- synthetic fixture 已从 `cet6:2025-12:set1` 迁移到 `cet6:fixture:synthetic-001`（无任何生产数据依赖旧 ID：
  fixture 从未进入 production/学习页；仓库内 Review/Session/DailyPlan 无 paper ID 引用；仅 tests/scripts 引用，已随本轮更新）。

## 3. Real Paper Namespace（保留）

```
paper   : cet6:2025-12:set1
section : cet6:2025-12:set1:reading
group   : cet6:2025-12:set1:reading:careful:g3
question: cet6:2025-12:set1:reading:careful:g3:q2
asset   : cet6:2025-12:set1:listening:lecture:g2:audio1
```

- REAL 与 FIXTURE 由 `stableIdNamespace(id)` 判别（`"real" | "fixture" | "invalid"`），
  `isRealStableId` / `isFixtureStableId` 供交叉校验与 duplicate 检测使用。

## 4. Stable ID Rules

- REAL：`cet6:<year>-<session>:set<N>[:<section>[:<subsection>:<group>[:<question|asset>]]]`（year=4 位，session=6|12，set≥1）。
- FIXTURE：`cet6:fixture:<fixtureId>[:<section>[:<subsection>:<group>[:<question|asset>]]]`。
- 交叉校验（papers.ts validatePaper，新增）：
  - `fixture=true` → 必须使用 fixture namespace（否则 error）；
  - `fixture=false/undefined`（real/past_exam）→ 禁止使用 fixture namespace（否则 error）；
  - section/group/question/asset ID 必须与 paperId 同 namespace（否则 error）。
- REAL paper 的 paperId 与 year/session/set 一致性检查仅对 REAL 生效。
- Duplicate 检测：paper identity（exam:year-session:set）duplicate 仅对 REAL 生效；FIXTURE 不参与 real identity 判重。

## 5. Rights Decision Rules（production publish verdict）

| licenseStatus | 条件 | verdict |
|---|---|---|
| owned | 默认 | allowed |
| owned | redistributionAllowed=false | blocked |
| licensed | 无 evidence（licenseName/permissionEvidence/licenseUrl 均无） | blocked |
| licensed | evidence 有，redistributionAllowed != true | unknown（NOT publishable） |
| licensed | evidence 有，redistributionAllowed=true | allowed（warning 发布前复核） |
| official_public_material | redistributionAllowed=false | blocked |
| official_public_material | 无 evidence 或 redistributionAllowed != true | unknown（NOT publishable） |
| official_public_material | evidence 有 且 redistributionAllowed=true | allowed（warning 发布前复核） |
| permission_required | — | blocked |
| 缺失 / 其他 | — | unknown |

- “官方公开”只说明来源/公开状态，不能自动证明 redistribution/commercial/derivative 权限；
  官方/政府/考试机构/学校 URL 不构成自动发布许可。
- commercialUseAllowed 未确认 → rights report 明确显示限制（warning），不静默当作 unrestricted。

## 6. Staging Validation（可保存/审计）

- `validatePack` 只做**结构校验**（schema validity）：rights 字段存在、格式合法、namespace 一致、结构完整。
- unknown / permission_required / unverified official 材料允许以 raw/staging 状态进入系统做人工审查。
- Import 管线：结构合法即注册（可进 staging/audit）。

## 7. Production Validation（可发布）

- `rightsIssues(scope="production")`：blocked/unknown/missing → error（不能进 production pool）；
  allowed 且 licensed/official → warning（发布前复核）；commercialUseAllowed 未确认 → warning。
- `content:rights`：production pool 混入非 allowed → 退出码 1（FAIL）。
- `getPublishableItems`：最终双重保护（见下）。

## 8. Production Fail-Closed Rules

以下情况默认**不能进入 production pool**（`getPublishableItems` 不返回）：
- rights 缺失 / licenseStatus unknown / permission_required；
- official_public_material 无明确再利用依据；
- redistributionAllowed != true；
- licensed 但 evidence 缺失；
- status 非 active/published（staging/raw 等）；
- source 为 mock / licenseType=unknown；
- verdict != allowed 的内容，即使 status=published 也不返回（blocked content fail closed）。

## 9. Validator 分层（结构 vs 发布权）

```
validatePack / validatePaper        → 结构校验（schema validity；staging 允许 unknown rights）
rightsVerdict / rightsIssues(production) → 权利判定（发布权）
content:rights                      → 全 pack 审计报告 + production pool 校验
getPublishableItems                 → production pool 最终 fail-closed（学习页 Selector 唯一来源之一）
学习页 repository / Selector       → 只取五专项 pool；paper/fixture/blocked/unknown-rights 永不出现
```

“可以被系统保存/审计” ≠ “可以被产品发布”。

## 10. Tests（v13-content.test.ts 29 → 43，新增 14 项）

- fixture namespace：生成/格式/判别（`stableIdNamespace`/`isRealStableId`/`isFixtureStableId`），REAL 与 FIXTURE 永不生成相同 ID。
- 交叉校验：fixture=true + real ID → error；real + fixture ID → error。
- official_public_material 四场景：no evidence → unknown；redistribution undefined → unknown；
  redistribution=false → blocked；evidence + redistribution=true → allowed（带 warning）。
- licensed：evidence + redistribution=true → allowed；evidence 但 redistribution 未确认 → unknown；无 evidence → blocked。
- owned：默认 allowed；redistribution=false → blocked。
- commercialUseAllowed 未确认 → rights report 显示限制。
- Production pool fail-closed matrix（7 场景）：staging fixture / unknown / permission_required /
  official-no-evidence → 不可见；licensed+evidence / owned → 可见；blocked 即使 published → 不可见。
- Identity regression：fixture + real 2025-12 set1 共存无 stable-ID collision、无 duplicate identity；
  两个真实 2025-12 set1 仍 duplicate ERROR（registerContentPack throws）。
- Import：unknown-rights paper 可进 staging（audit 路径）；published + unknown-rights 注册但 production 隔离；
  deterministic / idempotent 回归保持。

## 11. Gates（全部通过）

| Gate | 结果 |
|---|---|
| npm test | 413/413 PASS（既有 399 + 新增 14） |
| npm run typecheck | PASS |
| npm run lint | 0 errors |
| npm run build | PASS |
| npm run content:validate | 0 errors / 0 warnings（59 mock + 1 paper，fixture=cet6:fixture:synthetic-001） |
| npm run content:stats | PASS（vocabulary 30/reading 6/listening 7/translation 8/writing 8/paper 1；rights unknown 5/owned 1；paper sections 4/groups 7/questions 10） |
| npm run content:rights | PASS（PUBLISHABLE 1 / BLOCKED 0 / UNKNOWN 5；production pool {}） |
| npx prisma validate | PASS（schema valid） |
| npx prisma generate | PASS（Prisma Client v6.19.3） |
| npx prisma migrate status | PASS（2 migrations found, up to date） |

## 12. Browser Smoke（真实浏览器）

- Vocabulary / Reading / Listening / Translation / Writing / Review 六模块全部正常渲染；
  mock 内容可学习（词汇会话真实推进 feasible → significant）。
- 学习页面无任何 paper/真题/fixture 入口（fixture / blocked / unknown-rights 不出现在学习 Selector）。
- 无 runtime console error（仅有 Next dev data-inspector-id hydration 差异 warning，非产品缺陷）。

## 13. Git State

- Before：`1bb6910313e17cb023682fff4be41e53964b2a94`（Local == Remote == origin/feature/v13-real-content）
- Commit message：`fix: harden V13 content identity and rights`
- Commit（After HEAD，本地）：最终 commit 已包含本报告（message `fix: harden V13 content identity and rights`）；
  实际 SHA 以最终交付时 `git rev-parse HEAD` 输出为准（见最终回复）。
- **push 状态（如实记录）**：commit 已完成；`git push origin feature/v13-real-content` 连续 7 次尝试因
  `github.com:443 Failed to connect / Connection was reset`（约 10 分钟内）失败——github.com 域名/IP
  间歇不可达（api.github.com:443 与普通网络正常），属网络层阻塞而非代码问题；本地 worktree clean、
  HEAD=a59d6ca。已创建一次性定时任务（2026-09-26 15:29 Asia/Shanghai 触发）自动重试 push，
  成功后同步更新本节与 8 问结论；在 push 成功前，本报告第 14–15 节视为"本地已验证、推送待网络恢复"。
- v12.0 tag → `697772d9412d9d1a4253e099a001734a5230e264`（未改动）
- 禁止项遵守：无 force push、未 merge main、未打 tag、未建 Release、未开始 V13 Phase 2。

```
REAL PAST PAPERS IMPORTED: NO
UNLICENSED CONTENT COMMITTED: NO
REAL CET6 AUDIO COMMITTED: NO
```

---

## 14. 8 问回答

1. **Synthetic fixture 是否还能和真实 paper ID 冲突？** NO —— fixture 已迁到 `cet6:fixture:synthetic-001`，
   REAL（`cet6:2025-12:set1`）与 FIXTURE namespace 结构上可区分；fixture 与真实 2025-12 set1 共存测试通过，无 stable-ID / identity / duplicate 冲突。
2. **official_public_material 是否还会无条件 allowed？** NO —— 必须有明确再利用依据（evidence）且 redistributionAllowed=true 才 allowed；无依据/未确认 → unknown，redistribution=false → blocked。
3. **rights unknown 的内容能否进入 staging？** YES —— validatePack 只做结构校验，unknown/permission_required 允许以 raw/staging 状态进入系统做人工审查（importer 测试证明可导入）。
4. **rights unknown 的内容能否进入 production？** NO —— rightsVerdict=unknown → getPublishableItems / content:rights / 学习页 Selector 全部 fail closed，绝不进入。
5. **redistributionAllowed=false 能否进入 production？** NO —— 任何 licenseStatus 下 redistributionAllowed=false → blocked；redistribution 未确认（!= true）→ unknown，均不可发布。
6. **licensed 无 evidence 能否进入 production？** NO —— 无 evidence → blocked；有 evidence 但 redistribution 未确认 → unknown，均不可发布。
7. **59 mock 是否继续可用？** YES —— demo 学习池与 production pool 继续明确区分；六模块浏览器 smoke 真实可学习，59 mock 回归测试通过。
8. **production selector 是否 fail closed？** YES —— getPublishableItems 最终双重保护：source 非 mock、status active/published、verdict=allowed 才返回；blocked/unknown/staging/fixture 即使 status=published 也不返回。

---

## 15. 结论

**V13 PHASE 1.1 PASSED** — Content Identity + Rights Hardening 已完成：fixture 独立命名空间 + 交叉校验、
official_public_material 发布权收紧、production fail-closed、Validator 分层、duplicate 检测修正、
production pool 测试矩阵；10 项 gates 全绿、浏览器 smoke 通过、59 mock 无回归；未导入真实内容、未开始 V13 Phase 2。
