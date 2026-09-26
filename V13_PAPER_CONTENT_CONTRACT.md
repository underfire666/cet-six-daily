# V13 Paper Content Contract — Paper / Rights / Provenance / Assets / Stable IDs / Validation / 兼容

> 分支：`feature/v13-real-content` · 阶段：V13 Phase 2B
> 本契约定义 CET6 Paper 内容从生产到进入 production 的完整规则：领域模型、权利、来源、资产、稳定 ID、校验与 V8/V9/V10 兼容。
> 代码依据：`src/content/papers.ts`、`types.ts`、`rights.ts`、`stable-id.ts`、`validator.ts`、`exam-spec.ts`、`difficulty.ts`。

---

## 1. Paper 领域模型（CET6Paper）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `paperId` | string | 稳定 ID（见 §5） |
| `type` | `"paper"` | 内容系统公共字段（paper 也是 content item） |
| `examSpecId?` | string | 遵守的考试结构版本（缺省 = 当前 spec） |
| `exam` / `level` | `"CET6"` | 固定 |
| `year` / `session` / `set` | number / 6\|12 / number | 场次与套别（如 2026-6 set1） |
| `title` | string | 卷名 |
| `sourceId` | string | 指向 ContentSource（含 provenance） |
| `rights` | ContentRights | 卷级权利（fail-closed） |
| `sections` | PaperSection[] | writing/listening/reading/translation，order 1..N |
| `assets?` | PaperAsset[] | 音频/图片/脚本/文档资产 |
| `schemaVersion` | string | 结构版本（不匹配时按 V10 规则重置） |
| `contentVersion?` | string | 内容版本（内容更新时 bump） |
| `isPartial?` | boolean | 完整卷=false；fixture/样卷=true（豁免题量 conformance） |
| `fixture?` | boolean | 合成/仿真标记（与真实真题互斥） |
| `status` | raw/draft/staging/active/published/deprecated | lifecycle 状态 |
| `authenticity` | original/practice/past_exam | 原创/仿真练习/真题 |

---

## 2. Paper 类型与 rights 映射（V13 Phase 2B 概念 → 现有类型风格）

| V13 概念 | 代码表达（authenticity + rights + status） | production 资格 |
| --- | --- | --- |
| `original_mock` | authenticity=`original` + licenseStatus=`owned` + status=`staging→active/published` | ✅ allowed |
| `licensed_official` | licenseStatus=`licensed` + 有效 evidence + `redistributionAllowed=true` | ✅ allowed（带 warning，发布前复核） |
| `official_sample` | licenseStatus=`official_public_material` + 明确再利用 evidence + `redistributionAllowed=true` | ✅ allowed（带 warning） |
| `public_domain` | licenseStatus=`public_domain` + `redistributionAllowed=true`（CC0/已过保护期，需复核） | ✅ allowed（带 warning） |
| `internal_reference` | authenticity=`past_exam` + licenseStatus=`permission_required`/`unknown` + status=`raw`/`staging` | ❌ 永不 production |
| `restricted` | licenseStatus=`permission_required` | ❌ blocked |
| 未知 | licenseStatus=`unknown` / 缺 rights | ❌ unknown → 不 production |

> 说明：`restricted`、`internal_reference_only` 不新增独立 licenseStatus——由现有 `permission_required`/`unknown` + `raw`/`staging` 状态表达，避免扩大权利状态集。

---

## 3. Rights Contract（fail-closed，`src/content/rights.ts`）

`rightsVerdict(rights)` 判定规则：

| licenseStatus | redistributionAllowed | 结果 |
| --- | --- | --- |
| `owned` | 任意（false 除外） | allowed |
| `owned` | `false` | blocked |
| `public_domain` | `true` | allowed（warning：发布前复核 CC0/过期证据） |
| `public_domain` | 缺省 / ≠ true | unknown（不静默放行） |
| `public_domain` | `false` | blocked |
| `licensed` | `true` + 有 evidence | allowed（warning） |
| `licensed` | 无 evidence | blocked |
| `licensed` | 有 evidence 但 redistribution ≠ true | unknown |
| `official_public_material` | `true` + 有 evidence | allowed（warning） |
| `official_public_material` | 无依据 / redistribution ≠ true | unknown |
| `official_public_material` | `false` | blocked |
| `permission_required` | — | blocked |
| 缺失 / 其他 | — | unknown |

**Production 唯一出口**：`registry.getPublishableItems()` —— 仅 `allowed` + `active/published` + 非 mock/unknown。staging/fixture/blocked/unknown 一律不进。

---

## 4. Provenance Contract（来源可审计）

每个 production Paper 必须能回答五问（通过 `ContentSource.provenance` + `importBatchId` + rights 元数据）：

| 问题 | 字段 |
| --- | --- |
| 谁写的？ | `provenance.author`（原创自研标注）/ `rights.rightsHolder` |
| 来自哪里？ | `provenance.sourceTitle` / `sourceUrl` / `sourceType` |
| 什么时候？ | `provenance.publishedAt` / `retrievedAt` / `createdAt` |
| 基于什么 spec？ | `paper.examSpecId`（+ `provenance` 中记录的依据文档 URL） |
| 是否第三方资产？ | `rights.licenseStatus` + `provenance.sourceType`（第三方必须 licensed/许可证据） |
| 为什么允许 production？ | `rightsVerdict=allowed` 的证据链（`permissionEvidence` / `licenseUrl` / redistribution 确认） |

导入批次：`importBatchId`（`import-batch.ts` 幂等），同一内容重复导入不产生重复记录。

---

## 5. Stable ID 策略（`src/content/stable-id.ts`）

### 5.1 命名

| 实体 | REAL | FIXTURE |
| --- | --- | --- |
| Paper | `cet6:2026-6:set1` | `cet6:fixture:synthetic-001` |
| Section | `cet6:2026-6:set1:writing` | 同前，追加小节段 |
| Group | `...:listening:long_conversation:g1` | 同上 |
| Question | `...:g1:q1` | 同上 |
| Asset | `...:lecture:g3:audio1` | 同上 |

规则：
- `fixture=true` 必须用 FIXTURE namespace；real/past_exam 禁止 FIXTURE namespace。
- REAL paperId 必须等于 `paperStableId({exam:"CET6",year,session,set})` 的确定性输出。
- 命名空间一致性：paper 内所有 section/group/question/asset 的 namespace 必须与 paperId 一致（校验强制）。

### 5.2 何时保留 / bump / 新 ID / deprecated

| 场景 | 规则 |
| --- | --- |
| 内容修复（错字、解析补充） | **保留 ID**，bump `contentVersion` |
| 结构性修改（改题量/换题） | **bump `contentVersion`**，保留 ID（历史引用不失效） |
| 与原题语义不同的新题 | **新 questionId**（不回收旧 ID） |
| 下架 | status=`deprecated`（不删除，`getPublishableItems` 自动排除） |
| alias | 旧 ID → 新 ID 用 `registerAlias` 迁移，Repository 先 resolveAlias 再查 |

---

## 6. Listening Asset Contract（脚本与音频权利分离）

V13 Phase 2B 强制规则（`validatePaper` 执行）：

1. **听力 group 必须携带脚本**：`long_conversation` / `passage` / `lecture` 类型 group 缺 `transcript` → error。
   - 脚本权利（script rights）**单独追踪**，与音频权利分离。
2. **音频 asset 必须携带 rights**：`assets[]` 中 `type="audio"` 的 asset 缺 `licenseStatus` → error。
3. **assetIds 交叉引用**：group.assetIds 中每个 ID 必须存在于 `paper.assets`（orphan 引用 → error）。

建议字段（自研音频生产时）：
- `voiceProvider` / `voiceModel`（合成语音提供商与模型）
- `generatedAt`（音频生成时间）
- `termsCheckedDate`（提供商条款复核日期）
- 商业使用、输出再分发、署名、音色/合成语音限制、输入文本权利等由 `ContentRights` 记录（Phase 2B 不选择 provider、不生成音频，选择时按 Phase 2A.1 重新核对官方条款）。

---

## 7. Explanation Contract

每题答案与解析：

| 题型 | 必填 |
| --- | --- |
| choice / cloze / matching | `answerId` + 正确选项文本 + `shortExplanation`（建议 `detailedExplanation`） |
| subjective_writing / subjective_translation | `answerText` 或 `answerKey` + `shortExplanation` |

`EditorialExplanation` 保留 `whyCorrect` / `whyWrong` 结构（对主观题可省略 whyWrong 但需 whyCorrect）。校验器对缺失 answer/explanation 报 error。

---

## 8. Validation 规则总清单（`validatePaper` / `validatePack` / `validateAll`）

| 类别 | 规则 |
| --- | --- |
| Identity | paperId 必填、合法 stable ID、namespace 一致性、REAL/FIXTURE 约束 |
| Spec | examSpecId 已知（缺省=current）；完整卷 section/子节题量符合 `CET6_EXAM_SPEC` |
| Section/Group | kind/type/order 合法；section order 1..N 唯一；group 至少一个题或引用 |
| Listening | 听力 group 必须有 transcript |
| Question | prompt/order 合法；choice 有 options+answerId；非 choice 有 answerText/answerKey |
| Assets | assetId 合法且 namespace 一致；type 合法；audio 必须有 rights；assetIds 交叉引用 |
| Rights | 卷级 rights 存在；production 资格按 rightsVerdict fail-closed |
| Lifecycle | status 合法；fixture=true 必须 staging/raw；fixture 与真实真题互斥 |
| Cross-pack | `validateAll`：跨 pack 去重、paper identity 查重、normalized 文本 hash warning |

---

## 9. V8 / V9 / V10 兼容（不破坏既有用户数据）

| 系统 | 兼容方式 |
| --- | --- |
| V8 Daily Plan | task id = `${date}:${module}`（模块级，不引用 content ID）——Paper 加入不影响 |
| V9 Review | ReviewItem.id = `${sourceModule}:${sourceActivityId}:${questionId}` 或 `word:${wordId}`；paper question ID 可作 questionId 直接复用 |
| V10 Content | Paper 是 ContentPack subtype（contentType="paper"），registry/validator/importer 统一；旧 mock id（`word_`/`r-`/`l-`/`t-`/`w-` 前缀）不重命名；`validatePaper` 保留 V10 legacy schema 结构级校验路径 |
| 调度稳定性 | `selector.selectContent` 用 `hashString(seed)` 确定性洗牌——同日计划稳定，不因 Paper 加入变化 |

---

## 10. Difficulty / Quality Contract

- `difficulty.ts` → `unifiedDifficulty`（easy/normal/hard；词汇 1–5 映射）为唯一难度口径。
- 题目/篇章可复用 CEFR 等级、topic 标签、skill 标签作为辅助质量元数据（不改变 unifiedDifficulty 语义）。
- 生产门槛：content:validate Errors=0；每题有答案+解析；每篇有难度；Listening 有脚本与音频 rights。
