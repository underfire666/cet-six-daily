# V13 Content Specification — CET6 官方考试结构规范 + 第一套原创高仿真卷生产规范

> 分支：`feature/v13-real-content` · 阶段：V13 Phase 2B
> 范围：本文件描述 **CET6 官方公开考试结构**（结构信息，非真题内容）与 **Paper 001（第一套原创高仿真卷）的生产规范**。
> 依据：`src/content/exam-spec.ts`、`src/content/papers.ts`、`V13_SOURCE_ACQUISITION_MATRIX.md`（Phase 2A/2A.1 结论）。

---

## 1. 唯一真相源（Single Source of Truth）

CET6 当前官方考试结构（中国教育考试网）：

| 官方来源 | URL |
| --- | --- |
| CET6 考核内容说明 | https://cet.neea.edu.cn/xhtml1/report/16123/201-1.htm |
| CET6 考试大纲（样题/结构） | https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm |

**代码实现**：`src/content/exam-spec.ts` → `CET6_EXAM_SPEC`（`examSpecId: "cet6-current-2026"`）。

**禁止重新引入的旧结构**（Phase 2A.1 已全文件清理，提交前 grep 复查）：
- `short conversation(s)` / `短对话`
- `8 short conversations + 2 long conversations`
- `3 passages` / `three passages`

---

## 2. CET6_CURRENT_SPEC（当前官方结构）

### 2.1 Section 级

| Section | kind | 题数 | 时长 | 分值占比 |
| --- | --- | --- | --- | --- |
| Writing | writing | 1 | 30 min | 15% |
| Listening Comprehension | listening | 25 | 30 min | 35% |
| Reading Comprehension | reading | 30 | 40 min | 35% |
| Translation (C-E) | translation | 1 | 30 min | 15% |
| **总计** | — | **57** | **130 min** | **100%** |

### 2.2 Listening 子节（25 题 / 30 分钟）

| 子节 kind | 官方名称 | 题数 | 占比 |
| --- | --- | --- | --- |
| `long_conversation` | 长对话 | 8 | 8% |
| `passage` | 听力篇章 | 7 | 7% |
| `lecture` | 讲话 / 报道 / 讲座 | 10 | 20% |

> Listening 结构已按当前官方结构修正；这是 V13 Phase 2B 校验完整卷（非 partial）的唯一依据。

### 2.3 Reading 子节（30 题 / 40 分钟）

| 子节 kind | 官方名称 | 题数 | 占比 |
| --- | --- | --- | --- |
| `cloze` | 选词填空（词汇理解） | 10 | 5% |
| `matching` | 长篇阅读（匹配） | 10 | 10% |
| `careful_reading` | 仔细阅读 | 10 | 20% |

---

## 3. 结构版本化（Spec Versioning）

考试结构可以随改革变化。为避免破坏既有 Paper 数据，结构层引入版本 ID：

- `CET6_EXAM_SPEC.examSpecId = "cet6-current-2026"` —— 当前生效结构的稳定 ID。
- `KNOWN_EXAM_SPEC_IDS` —— 已知 spec ID 列表（未来新增版本时追加，不修改旧条目）。
- `isKnownExamSpecId(id)` —— Paper 引用的 spec ID 校验函数：
  - `undefined`（Paper 未声明）→ 视为当前 spec（`cet6-current-2026`），合法；
  - 已知 ID → 合法；
  - 未知 ID → Paper 校验报错（`unknown examSpecId`）。
- `CET6Paper.examSpecId?: string` —— Paper 可显式声明其遵守的规范版本；缺省即当前版。

**迁移规则**：官方改革推出新结构时，新增一个 spec 版本（如 `cet6-current-2027`），旧 Paper 保留旧 `examSpecId` 不被破坏；新 Paper 引用新版本。

---

## 4. 结构符合性校验（Spec Conformance）

`src/content/papers.ts` → `validateSpecConformance(paper, errors)`，在 `validatePaper` 内对每个 Paper 执行：

| 规则 | 完整卷（isPartial ≠ true） | partial（fixture / 样卷节选） |
| --- | --- | --- |
| Section 题数 = spec（writing 1 / listening 25 / reading 30 / translation 1） | 强制 | 豁免 |
| Listening 子节 = 长对话 8 / 篇章 7 / 讲话·报道·讲座 10 | 强制 | 豁免 |
| Reading 子节 = 选词填空 10 / 长篇阅读 10 / 仔细阅读 10 | 强制 | 豁免 |
| 字段级校验（stable ID、rights、answer、explanation 等） | 强制 | 强制 |

**结论**：fixture / 样卷（`isPartial=true`）只要求结构与字段合法；**完整卷**必须与当前官方结构逐项一致，否则拒绝注册。

---

## 5. Paper 001 — 第一套原创高仿真卷生产规范

> 本文件只定义生产规范（结构、数量、来源、权利、质量门槛），**不包含任何试题正文**。试题正文由 Phase 2B 之后的原创生产流程产出，全部带 `TEST FIXTURE`/自研标记。

### 5.1 目标

生产 CET-6 Daily 第一套**自研原创高仿真卷**（Paper 001，`cet6:2026-6:set1` 命名空间预留），完整卷（`isPartial: false`），满足 2.1–2.3 全部题量与结构约束。

### 5.2 各 Section 内容策略（继承 Phase 2A 结论，不导入真实真题）

| Section | 内容策略 | 权利模型 |
| --- | --- | --- |
| Writing | 自研 original prompt + 官方体裁事实（书信/议论文/图表等公开描述） | owned |
| Listening | 自写 scripts（长对话 8 题 / 篇章 7 题 / 讲话·报道·讲座 10 题）+ 自制或合法授权音频 | script owned；audio 单独 rights（见契约 §7） |
| Reading | 自研 original passages + questions（cloze 10 / matching 10 / careful 10） | owned |
| Translation | 自研 original C-E prompts（段落汉译英） | owned |
| Explanations | 自研 editorial content（short + detailed + why correct/why wrong） | owned |

### 5.3 质量门槛（生产前逐项自检）

1. `npm run content:validate` → Errors 0。
2. `validatePaper` 完整通过（含 spec conformance）。
3. 每题有 answerText/answerKey（非 choice）或 answerId（choice）+ 正确选项文本。
4. 每题有 short + detailed explanation；每篇 passage/script 标注难度（unifiedDifficulty）。
5. Listening 每个 group 有 transcript；每个 audio asset 有独立 rights。
6. 全部题目带 `TEST FIXTURE` 标记与完整 provenance（作者/来源/时间/依据 spec）。
7. `status: "staging"` 先行；人工验收后按 lifecycle 转 `active/published`。

### 5.4 明确禁止

- 导入真实历年真题正文 / 真实 CET6 音频 / 来源不明 PDF（Phase 2A：`REAL PAST PAPERS IMPORTED: NO` 保持）。
- 无明确书面授权的内容进入 production（fail-closed）。
- 把翻译/写作强行塞入传统客观错题本；新建第二套平行题库。

---

## 6. 与 V10 Content System 的关系

V13 Paper 是 **V10 Content System 的扩展，而非平行系统**：

- Paper 作为 `contentType="paper"` 的 ContentPack item 注册（`packs.ts` 同一管线）。
- 复用同一 `registry.ts`（`getPublishableItems` 只放行 allowed + active/published + 非 mock/unknown）。
- 复用同一 `validator.ts`（跨 pack 去重、paper identity 查重）。
- 复用同一 `importer.ts` / `import-batch.ts`（确定性 + 幂等导入）。
- 复用 `stable-id.ts`（REAL / FIXTURE 双 namespace）。
- 复用 `rights.ts` / `lifecycle.ts` / `aliases.ts` / `difficulty.ts`。

**不新建** PaperRepository / 第二套注册表 / 第二套校验器。
