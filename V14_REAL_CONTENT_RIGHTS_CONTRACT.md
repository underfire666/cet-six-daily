# V14 Phase 0 — REAL Content Rights Contract（真实内容权利合同）

> 生成日期：2026-09-29
> 适用仓库：CET-6 Daily，分支 `feature/v14-real-content-rights`
> 代码落点：`src/content/types.ts` / `src/content/rights.ts` / `src/content/papers.ts` / `src/content/private-content.ts`
> 本文件是产品/工程内部 contract，**不是法律意见**。所有权利判断时间敏感，production 前须经专业法律审查并重新核对条款。

---

## 1. Source Classification（五类来源分类）

本项目把任何"真题/真题解析/真题音频"内容按其来源划入以下五类之一。每类有独立的允许用途与禁止用途。

| 类别 ID | 名称 | 定义 | 允许用途 | 禁止用途 |
| --- | --- | --- | --- | --- |
| SOURCE_A_OFFICIAL_FACT | 官方事实 | 教育部教育考试院 / CET 官方站点公开发布的**结构事实**（试卷结构表、题量、分值比例、考试时间、官方题型名称、考试机制），**不包含**历年真题正文与官方音频 | 硬编码进 `examSpec`、metadata、结构校验、原创 mock 设计参考；在产品"考试说明"类页面中性引用官方结构事实 | 不得据此复制任何一年真题原文；不得抓取官方/第三方听力音频；不得在产品中再发布试卷内容；不得把"官方公开结构事实"表述为"官方授权再分发" |
| SOURCE_B_LICENSED_REAL | 出版社授权真实内容 | 由出版社（如外教社/高教社/外研社）出版的真题图书/数字课程中，经**书面授权**后可再分发到本产品的真题正文/解析/音频 | 在授权合同约定的地域、期限、渠道、媒介内再分发真题正文与（如授权覆盖）音频；按合同署名/署名方式 | 超出合同约定的地域/期限/渠道/媒介；把图书销售事实误读为 App 再分发授权；把"全国版权示范单位"等荣誉误读为对外授权 |
| SOURCE_C_PARTNER_LICENSED | 教育合作方授权内容 | 由正规教育内容合作方（B2B 机构采购合同、题库 API 商业授权）提供的、权利链条清晰的真题/解析内容 | 在合同约定范围内嵌入产品；要求服务商提供完整权利链条证明（版权方→服务商→本产品） | 无权利链条证明即接入；把 API 调用授权误读为真题版权再授权；抓取合作方面向自有学员的网页内容 |
| SOURCE_D_PRIVATE_USER_IMPORT | 用户个人导入内容 | 用户自行上传的、仅用于个人学习的 PDF/图片/文本/音频 | 仅在上传者本人 private workspace 内用于练习、Wrongbook、Review、个人学习统计 | 不得进入公共模拟卷列表/公共 REAL 列表/其他用户 sync snapshot；不得公开分发；不得进入 global selector；上传内容不自动加入公共题库 |
| SOURCE_E_UNVERIFIED_WEB | 未核实网络来源 | 题库站、网盘、个人 Gitee/GitHub dump、论坛帖子、培训机构网页上的"真题合集" | **仅记录 metadata 做 reference manifest**（contentIncluded:false），用于研究/追溯 | 禁止下载/commit/收录 question text/reading passages/listening transcript/official audio；即使仓库带 GPL/CC0 代码许可，也不能覆盖其上传的、权利不属于上传者的真题与音频 |

**当前状态（2026-09-29 快照）**：SOURCE_B / SOURCE_C 均无公开再分发证据，全部记为 RESEARCH_ONLY；SOURCE_D 在 Phase 0 仅定义 contract，无任何具体用户上传内容建档；SOURCE_E 当前证据下一律 REJECT。

---

## 2. REAL Namespace Contract（REAL 命名空间合同）

- REAL Paper 继续使用 V13 既有 stable ID namespace：`cet6:<year>-<session>:set<N>`（例：`cet6:2023-06:set1`）。
- `namespace=real` **仅表示**"这是一次真实 administered exam 的试卷身份"，**不等于** rights cleared。
- 一道真题要进入 production pool，必须同时满足 namespace=real **和** rightsStatus=cleared（见 §5）。
- 反向规则：`authenticity=past_exam` 强制 namespace=real；`authenticity=original/practice`（mock）强制 namespace=mock，禁止用真实考试日期命名原创模拟卷（见 `validatePaper` 交叉校验）。
- fixture（合成仿真 fixture）使用 `fixture:` namespace，与 past_exam 语义互斥。

---

## 3. Rights State Machine（权利状态机）

`ContentRights.rightsStatus` 为 7 态：

| 状态 | 含义 | 可进入 production? |
| --- | --- | --- |
| `unknown` | 尚未开始审查 | 否（fail closed） |
| `researching` | 正在检索来源/条款/授权方 | 否 |
| `unverified` | 已找到来源但未核实权利链条 | 否 |
| `restricted` | 权利存在但明确限制（地域/渠道/媒介/禁止再分发） | 否 |
| `cleared` | 权利审查通过，证据齐全，授权有效 | **是（唯一）** |
| `expired` | 授权已过期（expiresAt < 当前日期） | 否 |
| `revoked` | 授权已被撤回/吊销 | 否 |

**Fail-closed 原则**：
- 缺 `rightsStatus` 字段 = 未审查 = 不允许 production。
- `rightsStatus=cleared` 必须伴随权利证据（permissionEvidence / licenseName / licenseUrl 至少一个非空），否则 `validatePaper` 报 "cleared-without-evidence" error。
- `expiresAt` 早于当前日期 → `validatePaper` 报 "authorization expired" error。
- `expiresAt` 缺省 = 永久有效；`effectiveAt` 必须存在且不晚于当前日期。
- `isRightsCleared()` 是唯一的 cleared 判定函数：要求 `rightsStatus==="cleared"` 且未过期。

---

## 4. Rights Evidence Contract（权利证据合同）

`ContentRights` 字段清单（V13 现有 + V14 新增）：

**V13 现有字段：**
- `licenseStatus`: `owned` / `licensed` / `official_public_material` / `permission_required` / `unknown` / `public_domain`
- `rightsHolder?`：权利方名称
- `licenseName?` / `licenseUrl?`：许可名称/链接
- `permissionEvidence?`：授权证据引用（metadata ref / 文件路径 / document ID / 合同引用编号）
- `allowedUses?`: string[]
- `attribution?`：署名方式
- `commercialUseAllowed?`: boolean
- `redistributionAllowed?`: boolean
- `derivativeAllowed?`: boolean
- `verifiedAt?`：审查日期
- `notes?`
- `territory?`：适用地域（如 "China mainland only"）
- `restrictions?`: string[]（如 "standalone audio sublicense not granted"）

**V14 新增字段：**
- `rightsStatus?`：见 §3 七态状态机
- `permissionBasis?`：授权依据类别（如 `signed_contract` / `official_license` / `implied_by_terms`）
- `effectiveAt?`：授权生效日期（ISO 8601）
- `expiresAt?`：授权到期日期（ISO 8601），缺省 = 永久
- `sourceRetrievedAt?`：来源条款检索日期（条款时效敏感，发布前须复核）
- `reviewedAt?`：权利审查日期
- `reviewNote?`：审查备注

**存储纪律：**
- `permissionEvidence` 存的是**引用**（metadata ref / 文件路径 / document ID / 合同引用编号），**不是**敏感合同正文。
- 不在客户端暴露合同正文、价格条款、NDA 内容。
- 不存 secret / API key / token。
- `reviewNote` 只写中性审查结论，不写可识别第三方商业敏感信息。

---

## 5. REAL Publication Guard（REAL 发布准入条件）

一道 `authenticity=past_exam` 的 Paper 要进入 production（`status=active` 或 `status=published`），必须**同时**满足以下 8 项；任一不满足 → `validatePaper` FAIL + `npm run content:rights` FAIL + production selector 排除：

1. **authenticity = past_exam**（不是 original / practice）
2. **namespace = real**（paperId 形如 `cet6:<year>-<session>:set<N>`，与 year/session/set 一致）
3. **rights.rightsStatus = cleared**（且通过 `isRightsCleared()`：未过期、未吊销）
4. **rights.redistributionAllowed = true**（明确布尔值，不接受 undefined）
5. **rights.commercialUseAllowed = true**（明确布尔值，production 必须可商用）
6. **权利证据存在**（permissionEvidence / licenseName / licenseUrl 至少一个非空）
7. **effectiveAt / expiresAt 合法**（effectiveAt 存在且 ≤ 当前日期；expiresAt 若存在则 ≥ 当前日期）
8. **内容结构校验 PASS**（`validatePaper` 返回 0 errors，含 examSpec 题量结构、section/group/question 完整性、asset 交叉引用等）

实现：`realProductionEligible(paper, structuralErrors)` 返回 `{eligible, reasons[]}`，`reasons` 列出所有不满足原因。`validatePaper` 对 `past_exam + active/published` 强制调用该 guard。

---

## 6. Audio Rights Separation（音频权利三分）

Paper 上三个权利字段**独立追踪**，不互相继承：

- `paperTextRights?`：试卷文本权利（题干、阅读篇章、写作 prompt、翻译题干）
- `listeningScriptRights?`：听力脚本 / transcript 权利（听力原文文字）
- `audioRecordingRights?`：音频录制权利（官方原音频 vs project-generated TTS / licensed re-recording）

**关键规则：**
- text cleared ≠ audio cleared。文本获权不自动意味着音频获权。
- 听力脚本权利与音频录制权利也分离：脚本是文字作品，音频是录音制品，权利方可能不同。
- `past_exam` 且含 audio asset 时，必须独立提供 `audioRecordingRights`（带 `licenseStatus`），否则 `validatePaper` FAIL。
- **不能通过"重新 TTS 朗读真题"绕过原文权利问题**：TTS 朗读的仍是受保护的真题原文/脚本文本，文本权利未清结时，TTS 合成音频同样不能 production。TTS 生成的音频资产须在 `PaperAsset.generated=true` 并显著标注 "AI 合成语音"（V13 Phase 2D.1 已有约定）。

---

## 7. Explanation Rights（解析权利）

`explanationAuthenticity` 三态：

| 值 | 含义 | 权利要求 |
| --- | --- | --- |
| `official_answer` | 直接采用官方标准答案/官方解析 | 必须有权利证据支持（permissionEvidence/licenseName/licenseUrl），否则 `validatePaper` FAIL |
| `project_authored` | 本项目自行原创撰写解析（默认推荐） | 自有版权，按 project owned 处理 |
| `licensed_third_party` | 采用第三方培训机构/出版社授权解析 | 必须有第三方书面授权 |

**默认推荐 `project_authored`**：
- 不抓取新东方/有道/其他培训机构网页上的解析。
- 培训机构网页公开展示 ≠ 授权我们再分发；有道版权声明明确禁止未经授权再传播。
- 未来若要采用第三方解析，必须走 SOURCE_C_PARTNER_LICENSED 书面授权路径。

> 当前 Phase 0 未实现 per-explanation 粒度的 rights record（仅 Paper 级 `explanationAuthenticity` 标记），per-explanation rights 记录 deferred 到后续阶段。

---

## 8. REAL Content Without Rights（无权利 REAL 内容的 reference manifest）

对于尚未获得再分发授权、但希望"记录存在性以便未来追溯"的真题卷：

- 只记录 **metadata**（年份、场次、set、标题、来源 URL、权利状态=unverified/restricted、retrievedAt）。
- **contentIncluded:false**：不塞 question text、不塞 reading passages、不塞 listening transcript、不塞 official audio。
- 这种卷不进入 production pool，不进入 global selector，UI 不向普通用户展示可答题内容。
- 用途：内部研究台账、未来授权洽谈时的清单、reference 追溯。

---

## 9. V14 Content Supply Strategy（内容供给策略 / 21-Day Sprint fallback）

21-Day Sprint 上线时内容供给按以下优先级 fallback，**绝不能在 REAL 不够时自动抓取网络真题**：

| Priority | 内容池 | 说明 |
| --- | --- | --- |
| Priority 1 | cleared REAL（`rightsStatus=cleared` 的 past_exam 卷） | 当前 = 0 卷（CLEARED_REAL_SOURCE_COUNT=0） |
| Priority 2 | published MOCK（`authenticity=original/practice` 的原创高仿真模拟卷） | 当前 = Paper 001（`cet6:mock:paper-001`），production 可用 |
| Priority 3 | user PRIVATE（用户本人上传的卷，仅 owner 可见） | Phase 0 仅 contract，无 UI/存储/服务端实现 |

**硬规则：**
- REAL 不够时，宁可上线更少的 mock 卷，也**不得**自动从题库站/网盘/个人 dump 抓取真题。
- 不得用"网上找到的真题"填充 21-Day Sprint 的题量缺口。
- UI 标签严格区分三类内容（见 §10）。

---

## 10. UI Label Contract（UI 标签合同）

| 内容类别 | 允许标签 | 禁止标签 |
| --- | --- | --- |
| REAL cleared 真题 | "历年真题"（须明确标注年份/场次，如 "2023 年 6 月六级真题（第 1 套）"） | — |
| 原创 mock | "原创模拟" / "原创高仿真模拟卷" | "真题模拟"、"官方同款"、"官方真题风格" |
| 用户导入 | "我的导入" / "我的试卷" | 任何暗示公共题库收录的措辞 |

**Paper 001 当前标签**："原创高仿真模拟卷 / 非官方真题"——必须保持，不得改为"真题"或"官方同款"。

**禁止措辞清单（全产品）：**
- "真题模拟"
- "官方同款"
- "官方真题风格"
- "百分百真题"
- "与真题完全一致"

---

## 11. No Legal Overclaim（措辞纪律）

**禁止使用的措辞：**
- "绝对合法"
- "百分百没版权"
- "网上的真题都可以用"
- "考试题不受著作权保护"
- "官方公开了所以可以随便用"

**推荐使用的措辞：**
- "当前未找到足够再分发权证据"
- "当前证据不支持进入 production"
- "需获得明确授权或进一步法律审查"
- "本卷为原创高仿真模拟卷，非官方真题"
- "官方结构事实来自中国教育考试网，真题正文权利另行认定"

**声明：本文件不是法律意见。** 所有权利判断基于 2026-09-29 的公开信息快照，授权状态/条款时间敏感，production 上线前须经专业法律审查并重新核对每一条授权证据。
