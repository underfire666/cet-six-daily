# V14 Phase 0 — Source Research Raw（5 类来源研究原始数据）

> 目的：在任何 REAL 真题进入产品前，记录每类来源的 metadata、权利证据与保守决策。
> **本文件不是法律意见。** 所有结论时间敏感（retrievedAt = 2026-09-29），production 前须重新核对。
> 硬约束遵守：未下载任何真题正文/音频；未复制真题内容；未把来源不清内容标记为 REAL/cleared。
>
> 决策取值（严格）：`PUBLIC_CANDIDATE` / `RESEARCH_ONLY` / `PRIVATE_ONLY` / `REJECT`。
> 说明：`PUBLIC_CANDIDATE` 必须存在**明确再分发授权证据**；本次调查 `PUBLIC_CANDIDATE = 0`。
>
> retrievedAt（统一）: `2026-09-29T19:14:00+08:00`

---

## 汇总（Decision by category）

| 类别 | 代表来源 | 本类 decision（保守结论） |
| --- | --- | --- |
| A. 官方页面 | cet.neea.edu.cn / neea.edu.cn | RESEARCH_ONLY（仅结构事实，无内容再分发） |
| B. 出版社 | 外教社 / 高教社 / 外研社 | RESEARCH_ONLY（潜在授权渠道，当前无公开再分发证据） |
| C. 教育内容合作方 | 新东方 / 有道 | RESEARCH_ONLY（第三方自有版权，无对外再分发授权） |
| D. 开放许可数据集 | Gitee dump / 题库站 / HF 检索 | REJECT（来源不清 dump）；未发现 CC0/MIT/Apache CET6 数据集 |
| E. 商业授权/API | 练题狗题库 API / Learnosity / 有道智云 | RESEARCH_ONLY（底层 CET6 权利未核实，需商业尽调） |

**CLEARED_REAL_SOURCE_COUNT = 0**
**UNVERIFIED_SOURCE_COUNT（记录在案、不可 production）= 见下表各 RESEARCH_ONLY / REJECT 行。**

---

## A. 教育部教育考试院 / CET 官方页面

| 字段 | 记录 A1 | 记录 A2 |
| --- | --- | --- |
| source | 中国教育考试网·CET 栏目 https://cet.neea.edu.cn/ （CET笔试说明 https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm ；分数解释 https://cet.neea.edu.cn/html1/folder/19081/5124-1.htm ） | 教育部教育考试院官网 https://www.neea.edu.cn/ （六级笔试说明 https://www.neea.edu.cn/html1/report/16123/201-1.htm ） |
| owner/operator | 教育部教育考试院（原教育部考试中心） | 教育部教育考试院 |
| what it provides | 考试介绍、笔试/口试结构说明、大纲 PDF、报名入口、成绩查询/电子成绩单、当次考试安排与公告 | 同上（总院门户），考试项目介绍页 |
| official or third-party | official | official |
| terms URL | 未在栏目中检索到面向第三方再分发的使用许可条款；官网为信息公开页 | 同左 |
| license statement | 官方公开的是考试信息与结构事实；未发现对历年真题正文/音频的公开再分发授权声明 | 同左 |
| redistribution evidence | 无（未提供真题下载，也未授权第三方再发布） | 无 |
| commercial use evidence | 不明确（官方未就真题内容对外商用授权作出公开说明） | 不明确 |
| download availability | 结构表/大纲 PDF 可在线查看；**历年真题正文与官方音频未提供下载** | 同左 |
| confidence | 高 | 高 |
| decision | RESEARCH_ONLY | RESEARCH_ONLY |
| retrievedAt | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 |
| notes | 可用于 examSpec/metadata/validation；不得用于原文复制或真题再发布。第三方文章曾称"可在 cet.neea.cn 下载真题"，但本次在官方栏目中未发现该下载入口，该说法视为第三方未证实主张，不采信。 | 与 A1 同一主管单位，互为印证。 |

---

## B. 可能持有合法出版/发行权的出版社

| 字段 | 记录 B1 | 记录 B2 | 记录 B3 |
| --- | --- | --- | --- |
| source | 上海外语教育出版社（外教社） https://www.sflep.com/ ；历史样卷/大纲出版页 https://www.sflep.com/show-20-115-1.html ；WE Learn 平台 https://welearn.sflep.com/ | 高等教育出版社 选书平台 https://xuanshu.hep.com.cn/ （如《大学英语四级考试真题详解(2024.12–2025.12)》） | 外语教学与研究出版社（外研社）HEEP https://heep.fltrp.com/book/detail?id=4270 （《大学英语六级考试真题全解+标准预测》） |
| owner/operator | 上海外语教育出版社（教育部主管、上海外国语大学主办） | 高等教育出版社 | 外语教学与研究出版社 |
| what it provides | 历史上由"全国大学英语四、六级考试委员会"编写、外教社独家出版样卷/大纲；现售《Level Up 六级真题精讲》等图书与数字课程 | 商业图书：收录历年真题试卷与解析、听力 MP 等数字资源（试题册+解析册） | 商业图书：精选历年真题+预测，附解析/听力原文；VEP 平台另载真题听力文本与参考答案 PDF |
| official or third-party | third-party（出版社；与考委会有历史编写/出版关系） | third-party | third-party |
| terms URL | 出版社官网未见面向 App 再分发的公开授权条款 | 选书平台未见面向第三方 App 的内容再分发授权条款 | HEEP/VEP 未见面向第三方 App 的内容再分发授权条款 |
| license statement | 出版物为受版权保护的图书产品；外教社获"全国版权示范单位"称号，说明其重视版权，但这是其**自有图书**的版权，不等于对外授权 | 图书为出版社/编写方版权作品；未声明允许第三方 App 再分发真题原文 | 图书为出版社/编写方版权作品；未声明允许第三方 App 再分发真题原文 |
| redistribution evidence | 无（销售图书≠授权 App 再分发） | 无 | 无 |
| commercial use evidence | 不明确（无公开再授权报价/terms；机构合作需直接洽谈） | 不明确 | 不明确 |
| download availability | 图书/课程需购买；未开放真题原文批量下载 | 图书需购买 | 图书需购买；VEP PDF 为其教材配套资源 |
| confidence | 中 | 中 | 中 |
| decision | RESEARCH_ONLY | RESEARCH_ONLY | RESEARCH_ONLY |
| retrievedAt | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 |
| notes | 外教社与考委会历史关系最密切，是**潜在**正式授权洽谈对象；但当前未找到任何允许本产品再分发真题/音频的公开证据。结论：需获得明确授权或进一步法律审查后才可升级。 | 商业真题详解书，不构成 App 内容授权。 | 外研社同时运营 Unipus 等 B2B 教学测评平台（见 E/C），但其图书内容不对外再分发。 |

---

## C. 正规教育内容合作方

| 字段 | 记录 C1 | 记录 C2 |
| --- | --- | --- |
| source | 新东方在线 / 新东方网（cet4.koolearn.com、cet4-6.xdf.cn、www.xdf.cn） | 网易有道（youdao.com；版权声明 https://c.youdao.com/article/index.html?pid=598 ；有道智云 https://ai.youdao.com/new/ ） |
| owner/operator | 新东方教育科技集团（新东方在线） | 网易有道 |
| what it provides | 自行整理的历年真题及答案/解析、网课、模考；考后第一时间发布"真题完整版"文章 | 四六级网课/词典笔、题库搜索（识别）服务；对外有 ETS 托福官方合作（非 CET） |
| official or third-party | third-party | third-party |
| terms URL | 新东方网站通用版权声明（具体页面未逐一抓取） | https://c.youdao.com/article/index.html?pid=598 |
| license statement | 新东方对其"真题及解析/课程"内容主张权利；其内容多为面向自身学员的产品，未声明对外开放再授权 | 有道精品课版权声明原文要点：对官网课程及网页视频/文字/图片等享有著作权，**未经授权不得复制、改编、传播、交易、上传至其他平台（不论商业或非商业）** |
| redistribution evidence | 无 | 无（且其声明**禁止**未经授权再传播） |
| commercial use evidence | 有商业分发事实（卖课/卖库），但为**自有渠道**；存在 B2B 采购合同样例（新东方在线多媒体学习库经政府采购售予机构），说明机构授权模式存在，但非开放、非自动 | 有商业事实（词典笔/网课），但未发现对第三方 App 的 CET 内容再分发授权 |
| download availability | 网页可在线查看其整理的真题/解析；未开放授权批量下载 | 不提供真题原文下载授权；有道智云"精品题库"为题目识别/搜索服务 |
| confidence | 中 | 中 |
| decision | RESEARCH_ONLY | RESEARCH_ONLY |
| retrievedAt | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 |
| notes | 新东方网站公开展示真题≠授权我们使用；其"整理/解析"本身也是第三方加工品，不得抓取。B2B 机构授权是未来可洽谈路径，但当前证据不支持进入 production。 | 有道明确禁止未经授权再传播，直接排除作为内容来源；有道智云题库是"识别服务"不是"内容再分发授权"。 |

---

## D. 是否存在明确开放许可的数据集

| 字段 | 记录 D1 | 记录 D2 | 记录 D3 |
| --- | --- | --- | --- |
| source | Gitee 个人仓库 english-data-download https://gitee.com/longweihua/english-data-download | 第三方题库站合集：CET通 https://www.cettong.cn/library/cet6 ；懒笔记 https://english-exam.lazynote.cn/cet6/ ；WeHUSTER https://www.wehuster.com/cet6 ；过级鸭 https://www.guojiya.cn/exam/cet6/listening ；iTestAbc http://www.itestabc.com/cetexam/79 | GitHub / HuggingFace 检索（关键词 CET6 / 六级真题 / corpus） |
| owner/operator | 个人开发者 longweihua | 各商业/个人网站运营方（未公开权利信息） | 检索结果中命中的是 CLUE、MTEB、UniversalCEFR 等通用 NLP 数据集，**非** CET6 历年真题 |
| what it provides | 个人打包上传的 CET6 PDF + 听力 MP3（2021–2022 等） | 在线/下载的历年真题整卷 PDF、答案、听力 MP3、解析 | 未发现任何以 CET6 历年真题为内容、且以 CC0/MIT/Apache 明确许可发布的数据集 |
| official or third-party | third-party（来源不明 dump） | third-party（来源不明题库站） | third-party / 无对应命中 |
| terms URL | 仓库未见 LICENSE / 权利声明 | 未见面向再分发的许可条款 | n/a |
| license statement | 无 LICENSE；未说明真题/音频权利来源与授权 | 无明确开放许可；网站自身"提供下载"不等于有权授权他人再分发 | 未检索到 CC0/MIT/Apache 的 CET6 真题数据集 |
| redistribution evidence | 无 | 无 | 不适用（未命中） |
| commercial use evidence | 无 | 不明确 | 不适用 |
| download availability | 可下载（PDF/MP3） | 可在线/下载 | n/a |
| confidence | 高（对"来源不清"这一判断） | 高 | 中（检索覆盖度有限，不能排除未来出现） |
| decision | REJECT | REJECT | RESEARCH_ONLY（记录"当前未找到开放许可 CET6 数据集"这一负面结论） |
| retrievedAt | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 |
| notes | 禁止下载/commit；典型 SOURCE_E_UNVERIFIED_WEB。即使仓库带了 GPL 之类代码许可，也**不能**覆盖其上传的、权利不属于上传者的真题与音频。 | 典型 SOURCE_E_UNVERIFIED_WEB：题库网站/网盘/个人站。默认 REJECT_PUBLICATION，只记录 metadata。 | 负面结论需定期复查；任何人自行上传的"MIT/CCO 真题包"都应视为权利存疑——上传者通常不是版权方。 |

---

## E. 商业授权 / API / 内容合作可能

| 字段 | 记录 E1 | 记录 E2 | 记录 E3 |
| --- | --- | --- | --- |
| source | 练题狗·机构服务 https://www.liantigou.com/business.html | Learnosity Assessment APIs https://learnosity.com/ | 有道智云 AI 开放平台（精品题库）https://ai.youdao.com/new/ |
| owner/operator | 练题狗（题库 SaaS / 机构方案商） | Learnosity（海外测评基础设施商） | 网易有道 |
| what it provides | RESTful 题库 API（号称 3000万+ 题，含答案/解析/考点标注），可嵌入第三方 App | 组卷/交付/评分/报告的 assessment API 基础设施（50+ 题型，signed-request） | 题目识别、精品题库搜索匹配等 AI 能力 |
| official or third-party | third-party | third-party | third-party |
| terms URL | https://www.liantigou.com/business.html （未见公开 CET6 专项内容授权条款/报价） | https://learnosity.com/ （企业方案，需商务洽谈） | https://ai.youdao.com/new/ （AI 能力服务，非内容版权授权） |
| license statement | 提供"内容能力嵌入"，但其题库中 CET6 真题的**底层权利来源未公开说明** | 提供的是组卷/交付/评分**工具**，不是 CET6 真题内容授权 | 提供识别/搜索服务，不授予真题原文再分发权 |
| redistribution evidence | 不明确（API 调用授权≠真题版权再授权；底层 CET6 权利未核实） | 不适用（工具层） | 无（不授予内容） |
| commercial use evidence | 有商业 API 商业模式（企业付费嵌入），但未公开是否覆盖 CET6 真题再分发 | 有商业模式（企业订阅/white-label） | 有商业模式（按量计费 AI 服务） |
| download availability | API 调用，非文件下载 | API 调用 | API 调用 |
| confidence | 中 | 中 | 中 |
| decision | RESEARCH_ONLY | RESEARCH_ONLY | RESEARCH_ONLY |
| retrievedAt | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 | 2026-09-29T19:14:00+08:00 |
| notes | 未来若走商业题库 API，必须要求服务商提供 CET6 真题的**权利链条证明**（版权方→服务商→本产品），否则即使付费也不满足 production 准入。 | 可作为未来"组卷/答题引擎"基础设施参考；不解决真题内容权利。 | 不能作为内容来源。 |

补充观察（B2B 机构平台，非开放授权，仅记录）：
- 外研社 Unipus / 高校在线测试系统（如西安工商学院采购案例）：面向高校的 B2B 教学测评平台，含四六级题库，为机构订阅模式，**不对第三方 App 开放内容再分发**。RESEARCH_ONLY。
- OneClass 一课英语、MET 世界语言学习馆等：机构/图书馆渠道，收录四六级听力真题，为受控订阅环境，非开放授权。RESEARCH_ONLY。

---

## 概念类别（非具体来源，按任务要求登记）

- **SOURCE_D_PRIVATE_USER_IMPORT（PRIVATE_ONLY）**：用户自行上传的 PDF/图片/文本/音频。概念决策为 `PRIVATE_ONLY`——仅属上传者本人 private workspace，不进入 global registry / 公共 production pool / 其他用户 sync。本次研究未对任何具体用户上传内容建档（Phase 0 仅定义 contract）。
- **本批次未将任何来源标记为 PUBLIC_CANDIDATE。**

---

## 结论与措辞纪律

- 当前未找到任何来源具备"明确再分发授权 + 可商用 + 覆盖真题正文与（如涉及）音频"的证据。
- 当前证据不支持任何 REAL 历年真题进入 production。
- 后续若推进 B/C/E 任一路径，需获得明确书面授权（权利链条：全国大学英语四、六级考试委员会/教育部教育考试院 → 出版社或合作方 → 本产品），并经进一步法律审查。
- 本研究不使用"绝对合法""百分百没版权""考试题不受著作权保护"等表述。
- 本文件不是法律意见。
