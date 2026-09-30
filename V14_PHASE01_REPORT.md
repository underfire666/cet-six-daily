# V14 Phase 0.1 — Rights Contract Normalization 报告

> 生成日期：2026-09-30
> 分支：`feature/v14-real-content-rights`
> 基线：V14 Phase 0（HEAD `6b98293`）
> 需求来源：v14.1.2.txt
> 状态：开发完成，8/8 gates PASS，等待用户验收

---

## 1. 本轮目标

V14 Phase 0 验收判定为 PARTIAL，原因是 rights/source contract 存在 4 个语义问题。Phase 0.1 修正这些问题：

1. **统一 source taxonomy**：5 类 canonical（A=官方事实, B=出版社授权, C=合作方授权, D=PRIVATE_USER_IMPORT, E=UNVERIFIED_WEB）
2. **授权期限 fail-closed**：`termType` 显式声明（fixed/perpetual），缺失不得推断为永久
3. **三类 rights 独立校验**：paperTextRights / listeningScriptRights / audioRecordingRights 各自必须满足 production 准入
4. **permissionBasis 限制**：`implied_by_terms` 单独不足，必须为明确授权依据（signed_contract/written_permission/explicit_license）

---

## 2. 代码变更清单

### 2.1 `src/content/types.ts`

- `ContentRights` 新增 `termType?: "fixed" | "perpetual"` 字段
- 注释明确：缺省 = 未声明（REAL production fail closed），不得根据缺失推断永久

### 2.2 `src/content/rights.ts`

- 新增 `CANONICAL_PERMISSION_BASIS` 常量集合（signed_contract / written_permission / explicit_license）
- 新增 `checkRightsProductionReady(rights, label)` 辅助函数：统一检查单个 rights 对象的 production 准入
  - rights 对象存在
  - rightsStatus === "cleared"
  - permissionBasis 存在且为 canonical（implied_by_terms 拒绝，非 canonical 拒绝）
  - termType 存在（fixed 需 effectiveAt+expiresAt 且未过期；perpetual 需 effectiveAt+permissionEvidence 非空）
  - redistributionAllowed === true
  - commercialUseAllowed === true
  - 权利证据存在（permissionEvidence/licenseName/licenseUrl 至少一个）
- 新增 `hasListeningSections(paper)`：判断 Paper 是否含听力小节（long_conversation/passage/lecture）
- 新增 `hasAudioAssets(paper)`：判断 Paper 是否含 type=audio asset
- 重写 `realProductionEligible()`：
  - 仅对 `authenticity === "past_exam"` 执行三类 rights 维度检查（MOCK/original 不触发）
  - paperTextRights 始终检查（缺省继承 paper.rights）
  - listeningScriptRights 当有听力小节时检查（缺省继承 paper.rights）
  - audioRecordingRights 当有音频 asset 时检查（缺省继承 paper.rights）
  - 每类 rights 通过 `checkRightsProductionReady()` 校验

### 2.3 `src/content/fixture/v14-rights-fixtures.ts`

- `CLEARED_RIGHTS` 模板新增 `termType: "fixed"`（配合已有 effectiveAt/expiresAt）

### 2.4 `tests/v14.1-rights-normalization.test.ts`（新增）

23 个 contract 测试，覆盖：
- canonical source taxonomy（D=PRIVATE_USER_IMPORT, E=UNVERIFIED_WEB）
- termType fail-closed（missing / fixed-no-expiresAt / expired / perpetual-no-evidence / perpetual-with-evidence）
- 三类 rights 独立（text/script/audio 各自 unverified→reject、audio redistribution=false→reject、audio evidence missing→reject、all 3 cleared→eligible）
- permissionBasis 限制（implied_by_terms→reject、non-canonical→reject、missing→reject、3 canonical basis→allowed）
- MOCK 行为不回归、PRIVATE 行为不回归
- missing rights object、wrong namespace

### 2.5 测试回归修复

- `tests/v13-content.test.ts`：测试 394 "production pool: fail-closed matrix" 中两个 published past_exam paper 的 rights 对象补充 `permissionBasis`/`termType`/`expiresAt`（V14.1 更严格的 REAL guard 要求）
- `tests/v14-rights.test.ts`：测试 13 "realProductionEligible 返回所有不满足原因" 中 broken paper 保持 `authenticity: "past_exam"`（原为 "original"，导致 rights 维度检查被跳过）

---

## 3. 8/8 Gates 验证结果

| Gate | 命令 | 结果 |
| --- | --- | --- |
| 1. 单元测试 | `npm test` | **550/550 PASS**（V14 Phase 0 为 527，新增 23 个 V14.1 测试） |
| 2. TypeScript | `npm run typecheck` | **PASS** |
| 3. ESLint | `npm run lint -- --max-warnings 0` | **PASS**（0 errors / 0 warnings） |
| 4. Production Build | `npm run build` | **PASS** |
| 5. Content Validate | `npm run content:validate` | **PASS**（0 errors / 0 warnings） |
| 6. Content Stats | `npm run content:stats` | **PASS** |
| 7. Content Rights | `npm run content:rights` | **PASS**（production pool 仅含允许内容） |
| 8. Content Audio Validate | `npm run content:audio-validate` | **PASS**（0 errors，1 expected warning for fixture placeholder） |

**8/8 GATES PASS**

---

## 4. 关键设计决策

### 4.1 为什么 termType 缺失 = fail closed？

V14 Phase 0 的规则是 "expiresAt 缺省 = 永久有效"，这过于宽松。在真实版权场景中，"没有写明到期日"不等于"永久授权"。V14.1 要求显式声明 `termType`，缺省一律拒绝进入 REAL production。这是 fail-closed 原则的延伸。

### 4.2 为什么 implied_by_terms 不足？

服务条款/使用协议中的"允许使用"通常是面向报名网站用户的个人使用许可，不等于授权第三方产品再分发真题内容。REAL production 需要明确的、可追溯的授权依据（签署的合同、书面许可、明确许可）。

### 4.3 为什么三类 rights 独立校验？

文本权利、听力脚本权利、音频录制权利是三种不同的权利客体，权利方可能不同。文本获权不自动意味着音频获权。V14.1 确保每类权利在进入 production 前都独立通过准入检查。

### 4.4 为什么 MOCK/original 不触发 rights 检查？

`realProductionEligible()` 是 REAL Paper（past_exam）的专属准入 guard。MOCK/original Paper 的 authenticity 检查已经失败，不需要再叠加 rights 维度的噪音。这保持了错误信息的精确性。

---

## 5. 不变项确认

| 项目 | 状态 |
| --- | --- |
| Paper 001 正文 | 未修改 |
| answer keys | 未修改 |
| audio | 未修改 |
| rights metadata（Paper 001） | 未修改 |
| PaperSession | 未修改 |
| sync | 未修改 |
| database / Prisma | 未修改 |
| contentVersion 1.1.0 | 未修改 |
| V14 21-Day UI | 未开始 |
| AI 功能 | 未开始 |
| 真实真题导入 | 未导入 |
| 真实音频导入 | 未导入 |
| package.json version | 保持 13.0.2 |
| v12.0 / v13.0 / v13.0.1 / v13.0.2 tags | 未移动 |

---

## 6. 最终字段

```
CANONICAL_SOURCE_CLASSES: 5
SOURCE_D_MEANING: PRIVATE_USER_IMPORT
SOURCE_E_MEANING: UNVERIFIED_WEB
TERM_MODEL: EXPLICIT (fixed | perpetual)
MISSING_TERM_FAIL_CLOSED: YES
THREE_RIGHTS_INDEPENDENT: YES
IMPLIED_BY_TERMS_PRODUCTION_ELIGIBLE: NO
CANONICAL_PERMISSION_BASIS: signed_contract | written_permission | explicit_license
OFFICIAL_TERMS_SOURCE_ADDED: YES (Phase 0 已记录，Phase 0.1 未扩张解释)
REAL_CONTENT_IMPORTED: 0
REAL_AUDIO_IMPORTED: 0
CLEARED_REAL_SOURCE_COUNT: 0
TESTS_TOTAL: 550
TESTS_NEW_V14_1: 23
GATES: 8/8 PASS
V14_21_DAY_UI_STARTED: NO
AI_STARTED: NO
V14_PHASE_0_1_COMPLETE: YES
```

---

## 7. 已知限制 / 后续工作

- **V14 Phase 0.1 仅修正 contract 语义**，不导入任何真实真题/音频
- **per-explanation 粒度的 rights record** 仍 deferred（V14 Phase 0 已记录）
- **TTS provider 选择** deferred 到后续阶段（本轮未选择 provider，未生成 audio）
- **V14 21-Day UI / AI 功能** 未开始
- **V13.0.2 GitHub push** 仍未完成（本地 commit + tag 已创建，网络间歇性不可达），与 V14 独立

---

## 8. Git 状态

- 分支：`feature/v14-real-content-rights`
- 变更文件：
  - `src/content/types.ts`（修改）
  - `src/content/rights.ts`（修改）
  - `src/content/fixture/v14-rights-fixtures.ts`（修改）
  - `tests/v14.1-rights-normalization.test.ts`（新增）
  - `tests/v13-content.test.ts`（修改 — fixture 补充 V14.1 字段）
  - `tests/v14-rights.test.ts`（修改 — test 13 broken paper authenticity）
  - `V14_REAL_CONTENT_RIGHTS_CONTRACT.md`（修改 — 追加 V14.1 附录）
- 未 commit / 未 push（待执行）

---

*V14 Phase 0.1 — Rights Contract Normalization 完成，等待用户验收。*
