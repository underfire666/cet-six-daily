# V14 Phase 0 — REAL Content Source Matrix（真实内容来源矩阵）

> 生成日期：2026-09-29
> 数据来源：`notes/v14-source-research-raw.md`（retrievedAt = 2026-09-29T19:14:00+08:00）
> 本文件不是法律意见。所有结论时间敏感，production 前须重新核对。

---

## 摘要

- **CLEARED_REAL_SOURCE_COUNT = 0**
- **PUBLIC_CANDIDATE = 0**（不存在任何一条具备"明确再分发授权 + 可商用 + 覆盖真题正文与音频"证据的来源）
- 本矩阵共登记 **13 条具体来源记录**（A1–A2、B1–B3、C1–C2、D1–D3、E1–E3）。

按 Decision 汇总：

| Decision | 条数 | 记录 |
| --- | --- | --- |
| PUBLIC_CANDIDATE | 0 | — |
| RESEARCH_ONLY | 11 | A1, A2, B1, B2, B3, C1, C2, D3, E1, E2, E3 |
| PRIVATE_ONLY | 0 | （概念类别 SOURCE_D_PRIVATE_USER_IMPORT 在 Phase 0 仅定义 contract，未对任何具体用户上传内容建档） |
| REJECT | 2 | D1, D2 |
| **合计** | **13** | |

按 Source 类别汇总：

| 类别 | 条数 | 本类 decision |
| --- | --- | --- |
| A. 教育部教育考试院 / CET 官方页面 | 2 | RESEARCH_ONLY |
| B. 可能持有合法出版/发行权的出版社 | 3 | RESEARCH_ONLY |
| C. 正规教育内容合作方 | 2 | RESEARCH_ONLY |
| D. 开放许可数据集 | 3 | REJECT（D1/D2）；RESEARCH_ONLY（D3 负面结论） |
| E. 商业授权 / API / 内容合作 | 3 | RESEARCH_ONLY |

---

## 主表：13 条具体来源记录

| Source | Owner | Content Type | Official? | Rights Evidence | Redistribution Evidence | Commercial Evidence | Status | Decision | RetrievedAt | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1. 中国教育考试网·CET 栏目（https://cet.neea.edu.cn/ ；CET笔试说明 https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm ；分数解释 https://cet.neea.edu.cn/html1/folder/19081/5124-1.htm ） | 教育部教育考试院（原教育部考试中心） | 考试介绍 / 试卷结构表 / 大纲 PDF / 分数解释 / 报名入口 / 成绩查询 | official | 未在栏目中检索到面向第三方再分发的使用许可条款；官方公开的是考试信息与结构事实，未发现对历年真题正文/音频的公开再分发授权声明 | 无（未提供真题下载，也未授权第三方再发布） | 不明确（官方未就真题内容对外商用授权作出公开说明） | 仅结构事实可参考；未提供真题正文/音频下载 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 可用于 examSpec/metadata/validation；不得用于原文复制或真题再发布。第三方文章称"可在 cet.neea.cn 下载真题"，本次在官方栏目中未发现该下载入口，视为第三方未证实主张，不采信。 |
| A2. 教育部教育考试院官网（https://www.neea.edu.cn/ ；六级笔试说明 https://www.neea.edu.cn/html1/report/16123/201-1.htm ） | 教育部教育考试院 | 总院门户 / 考试项目介绍页 | official | 同 A1：未发现面向第三方再分发的许可条款 | 无 | 不明确 | 与 A1 互为印证 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 与 A1 同一主管单位。 |
| B1. 上海外语教育出版社（外教社）https://www.sflep.com/ ；历史样卷/大纲出版页 https://www.sflep.com/show-20-115-1.html ；WE Learn 平台 https://welearn.sflep.com/ | 上海外语教育出版社（教育部主管、上海外国语大学主办） | 商业图书 / 数字课程（历史上由全国大学英语四、六级考试委员会编写样卷/大纲） | third-party | 出版社官网未见面向 App 再分发的公开授权条款；外教社获"全国版权示范单位"称号，但其保护的是自有图书版权，不等于对外授权 | 无（销售图书 ≠ 授权 App 再分发） | 不明确（无公开再授权报价/terms；机构合作需直接洽谈） | 图书/课程需购买；未开放真题原文批量下载 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 外教社与考委会历史关系最密切，是潜在正式授权洽谈对象；但当前未找到任何允许本产品再分发真题/音频的公开证据。需获得明确授权或进一步法律审查后才可升级。 |
| B2. 高等教育出版社 选书平台 https://xuanshu.hep.com.cn/ （如《大学英语四级考试真题详解(2024.12–2025.12)》） | 高等教育出版社 | 商业图书：历年真题试卷+解析+听力 MP 等数字资源 | third-party | 选书平台未见面向第三方 App 的内容再分发授权条款；图书为出版社/编写方版权作品 | 无（未声明允许第三方 App 再分发真题原文） | 不明确 | 图书需购买 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 商业真题详解书，不构成 App 内容授权。 |
| B3. 外语教学与研究出版社（外研社）HEEP https://heep.fltrp.com/book/detail?id=4270 （《大学英语六级考试真题全解+标准预测》） | 外语教学与研究出版社 | 商业图书：精选历年真题+预测+解析/听力原文；VEP 平台另载真题听力文本与参考答案 PDF | third-party | HEEP/VEP 未见面向第三方 App 的内容再分发授权条款；图书为出版社/编写方版权作品 | 无（未声明允许第三方 App 再分发真题原文） | 不明确 | 图书需购买；VEP PDF 为其教材配套资源 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 外研社同时运营 Unipus 等 B2B 教学测评平台，但其图书内容不对外再分发。 |
| C1. 新东方在线 / 新东方网（cet4.koolearn.com、cet4-6.xdf.cn、www.xdf.cn） | 新东方教育科技集团（新东方在线） | 自行整理的历年真题及答案/解析、网课、模考；考后发布"真题完整版"文章 | third-party | 新东方网站通用版权声明（具体页面未逐一抓取）；新东方对其"真题及解析/课程"内容主张权利，未声明对外开放再授权 | 无 | 有商业分发事实（卖课/卖库），但为自有渠道；存在 B2B 政府采购样例，说明机构授权模式存在，但非开放、非自动 | 网页可在线查看其整理的真题/解析；未开放授权批量下载 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 新东方公开展示真题 ≠ 授权我们使用；其"整理/解析"本身是第三方加工品，不得抓取。B2B 机构授权是未来可洽谈路径，但当前证据不支持进入 production。 |
| C2. 网易有道（youdao.com；版权声明 https://c.youdao.com/article/index.html?pid=598 ；有道智云 https://ai.youdao.com/new/ ） | 网易有道 | 四六级网课/词典笔、题库搜索（识别）服务；对外有 ETS 托福官方合作（非 CET） | third-party | 有道精品课版权声明原文要点：对官网课程及网页视频/文字/图片等享有著作权，未经授权不得复制、改编、传播、交易、上传至其他平台（不论商业或非商业） | 无（且其声明禁止未经授权再传播） | 有商业事实（词典笔/网课），但未发现对第三方 App 的 CET 内容再分发授权 | 不提供真题原文下载授权；有道智云"精品题库"为题目识别/搜索服务 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 有道明确禁止未经授权再传播，直接排除作为内容来源；有道智云题库是"识别服务"不是"内容再分发授权"。 |
| D1. Gitee 个人仓库 english-data-download https://gitee.com/longweihua/english-data-download | 个人开发者 longweihua | 个人打包上传的 CET6 PDF + 听力 MP3（2021–2022 等） | third-party（来源不明 dump） | 仓库未见 LICENSE / 权利声明；未说明真题/音频权利来源与授权 | 无 | 无 | 可下载（PDF/MP3） | REJECT | 2026-09-29T19:14:00+08:00 | 禁止下载/commit；典型 SOURCE_E_UNVERIFIED_WEB。即使仓库带 GPL 之类代码许可，也不能覆盖其上传的、权利不属于上传者的真题与音频。 |
| D2. 第三方题库站合集：CET通 https://www.cettong.cn/library/cet6 ；懒笔记 https://english-exam.lazynote.cn/cet6/ ；WeHUSTER https://www.wehuster.com/cet6 ；过级鸭 https://www.guojiya.cn/exam/cet6/listening ；iTestAbc http://www.itestabc.com/cetexam/79 | 各商业/个人网站运营方（未公开权利信息） | 在线/下载的历年真题整卷 PDF、答案、听力 MP3、解析 | third-party（来源不明题库站） | 未见面向再分发的许可条款；网站自身"提供下载"不等于有权授权他人再分发 | 无 | 不明确 | 可在线/下载 | REJECT | 2026-09-29T19:14:00+08:00 | 典型 SOURCE_E_UNVERIFIED_WEB：题库网站/网盘/个人站。默认 REJECT_PUBLICATION，只记录 metadata。 |
| D3. GitHub / HuggingFace 检索（关键词 CET6 / 六级真题 / corpus） | 检索结果命中 CLUE、MTEB、UniversalCEFR 等通用 NLP 数据集，非 CET6 历年真题 | 通用 NLP 数据集（非 CET6 真题） | third-party / 无对应命中 | 未检索到 CC0/MIT/Apache 的 CET6 真题数据集 | 不适用（未命中） | 不适用 | n/a | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 负面结论需定期复查；任何人自行上传的"MIT/CC0 真题包"都应视为权利存疑——上传者通常不是版权方。 |
| E1. 练题狗·机构服务 https://www.liantigou.com/business.html | 练题狗（题库 SaaS / 机构方案商） | RESTful 题库 API（号称 3000万+ 题，含答案/解析/考点标注），可嵌入第三方 App | third-party | 提供"内容能力嵌入"，但其题库中 CET6 真题的底层权利来源未公开说明 | 不明确（API 调用授权 ≠ 真题版权再授权；底层 CET6 权利未核实） | 有商业 API 商业模式（企业付费嵌入），但未公开是否覆盖 CET6 真题再分发 | API 调用，非文件下载 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 未来若走商业题库 API，必须要求服务商提供 CET6 真题的权利链条证明（版权方→服务商→本产品），否则即使付费也不满足 production 准入。 |
| E2. Learnosity Assessment APIs https://learnosity.com/ | Learnosity（海外测评基础设施商） | 组卷/交付/评分/报告的 assessment API 基础设施（50+ 题型，signed-request） | third-party | 提供的是组卷/交付/评分工具，不是 CET6 真题内容授权 | 不适用（工具层） | 有商业模式（企业订阅/white-label） | API 调用 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 可作为未来"组卷/答题引擎"基础设施参考；不解决真题内容权利。 |
| E3. 有道智云 AI 开放平台（精品题库）https://ai.youdao.com/new/ | 网易有道 | 题目识别、精品题库搜索匹配等 AI 能力 | third-party | 提供识别/搜索服务，不授予真题原文再分发权 | 无（不授予内容） | 有商业模式（按量计费 AI 服务） | API 调用 | RESEARCH_ONLY | 2026-09-29T19:14:00+08:00 | 不能作为内容来源。 |

补充观察（B2B 机构平台，非开放授权，仅记录为 RESEARCH_ONLY，未单列成行）：
- 外研社 Unipus / 高校在线测试系统：面向高校的 B2B 教学测评平台，含四六级题库，机构订阅模式，不对第三方 App 开放内容再分发。
- OneClass 一课英语、MET 世界语言学习馆等：机构/图书馆渠道，受控订阅环境，非开放授权。

概念类别（非具体来源）：
- **SOURCE_D_PRIVATE_USER_IMPORT（PRIVATE_ONLY）**：用户自行上传的 PDF/图片/文本/音频。Phase 0 仅定义 contract，未对任何具体用户上传内容建档。

---

## 措辞纪律声明

- 当前未找到任何来源具备"明确再分发授权 + 可商用 + 覆盖真题正文与（如涉及）音频"的证据。
- 当前证据不支持任何 REAL 历年真题进入 production。
- 后续若推进 B/C/E 任一路径，需获得明确书面授权（权利链条：全国大学英语四、六级考试委员会 / 教育部教育考试院 → 出版社或合作方 → 本产品），并经进一步法律审查。
- 本矩阵不使用"绝对合法""百分百没版权""网上的真题都可以用""考试题不受著作权保护"等表述。
- 本文件**不是法律意见**。所有结论基于 2026-09-29 的公开页面快照，条款/授权状态时间敏感，production 使用前须重新核对官方页面并经专业法律审查。
