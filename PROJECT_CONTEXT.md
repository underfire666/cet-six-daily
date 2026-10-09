# 六级日常项目上下文

## 当前开发版本：V14.10.1 真题学习记录修补版（14.10.1，本地验收 PASS，2026-10-09）

应用版本：14.10.1；阶段：V14.10.1 CET-6 Practice Records Fix。package 与锁文件同步，关于页读取同一版本；不表示已发布 GitHub Release。

- V14.10.1 修复 V14.10.0 验收审计发现的 7 个问题：未完成练习回顾泄露答案、返回链路丢失筛选、复测结果标签错误、共享题目套卷标识不全、详细解析未展示、回顾音频暂停后重播归零、触控区域不足 44px。
- 新增 `safeRecordsReturnUrl()` / `sessionExitHref()` / `completeExitHref()` 安全返回地址验证，记录页筛选状态通过 `returnTo` 参数传递到 session 和回顾页，退出后正确返回带筛选的记录页。
- `ExamRecordReview` 未完成 session 只显示进度和继续练习入口，不渲染答案/解析；完成后显示全部作答记录（初答/重试/复测）、最终结果标签、正确答案标记、短解析+详细解析。
- 回顾页音频改为始终渲染 `<audio>` 元素 + `useRef` + `play()/pause()` 控制，暂停后重播保留进度；页面卸载时自动暂停。
- `buildContentLookup()` 重构为两阶段收集所有共享套卷，`PracticeRecord.sharedSets: string[]` 替代 `sharedWith`，历史 session 标记 `originalSetKnown=false`。
- 新增 27 个回归测试（`tests/v14-exam-records-fix.test.ts`），覆盖安全 URL 验证、returnTo 编码、共享套卷、结果标签逻辑、数据不变性。
- 1313/1313 tests PASS，8/8 gates PASS（test/typecheck/lint/build/content:validate/content:stats/content:rights/content:audio-validate）。

- 新增统一学习记录入口 `/practice/exams/records`，从听力、阅读、翻译、写作四项 store 聚合所有 `mode="selected"` 的真题选练会话。
- 记录列表支持未完成/已完成状态筛选和四项专项筛选，筛选状态通过 URL query 保存。未完成按开始时间倒序，已完成按完成时间倒序。
- 记录卡片显示专项、题组名称、试卷信息（年份/考期/套卷）、开始/完成时间（Asia/Shanghai）、答题进度、已获得 XP。未完成显示"继续练习"，已完成显示"查看记录"。
- 继续未完成练习直接跳转到原模块 session 页面，恢复原阶段（听力答题位置/答案/倍速、阅读阶段/答案、翻译写作草稿/待结算结果），不创建替代会话。
- 已完成记录只读回顾 `/practice/exams/records/{module}/{sessionId}`：客观题展示原文/音频/题目/选项/用户答案/正确答案/解析/作答记录（首次/重试/复测）；主观题展示题目/提交文本/反馈估分/主要问题/详细分析/参考答案/解析。全部只读，不提交/重算/改时间/改 XP。
- 历史兼容：从现有 selected 会话生成记录，无需迁移；每次重新练习独立 session；账号隔离；无效 module/sessionId/非 selected 会话均有友好错误页。
- 本轮保持浏览器本地存档，不新增未完成会话云同步；不新增数据库迁移；不增加题库内容、整卷考试、OCR、AI评分或新复习调度。

### 验收与交付

- 1286/1286 tests、typecheck、lint 0/0、build、四项 content gates PASS；保留原 fixture placeholder warning。新增 23 项回归测试，覆盖聚合、筛选、排序、URL 状态、已答题统计、空 store、未 applied XP 等。
- 分支 feature/v14-real-content-rights；本轮修改尚未提交，未推送/合并/tag/Release/部署。仅 Chrome 模拟宽度。完成后等待用户检查 UI，停止扩展。

## 历史版本：V14 真题浏览与选练（14.9.0，本地验收 PASS，2026-10-08）

应用版本：14.9.0；阶段：V14 CET-6 Exam Browser and Selected Practice。package 与锁文件同步，关于页读取同一版本；不表示已发布 GitHub Release。

- 首页新增“真题题库”入口，地址 `/practice/exams`。保留五项专项、原模拟卷与三项底部导航。
- 浏览 2022—2026 年 33 套试卷，按年份、考期和套卷筛选。包含 2022 年 9 月、2023 年 3 月考期；空筛选与不存在的套卷有明确返回入口。
- 每套可选择听力 7 组、阅读 4 组、翻译 1 项、写作 1 项。目录引用既有 manifest 与规范内容 ID；共用套卷共用内容和进度。仍为 311 个独立题组/任务、1381 道题/任务，没有新增或重复导入内容。
- 四项专项增加 `selected` 会话模式，精确选择当前题组，未完成时继续同一会话。选练绕过每日完成门槛，独立于每日/额外计数；原存档、计划、草稿、XP、生词与学习流程保留。
- URL 保存筛选、套卷与专项。退出/结算返回原选择，刷新及浏览器后退/前进保持状态。旧格式直接学习/结算链接的选练返回题库；非法或缺失会话可安全返回。
- 本地保存现有答题阶段、答案、听力速度和主观题草稿。共用题目采用同一个规范 ID，避免重复生成学习记录。完成沿用原 XP 账本：同一天同组题重复练习不再奖励；+0 XP 有原因说明。
- 保留绿色 Design Tokens、44px 操作区、键盘焦点和减少动态效果支持。浏览页显示保存失败提示，保存失败时不宣称“进度已保存”。底部导航固定，内容预留安全区。
- `package.json`、锁文件根版本、关于页统一 `14.9.0`，阶段 `V14 CET-6 Exam Browser and Selected Practice`。应用版本不等于内容 schema/contentVersion。

### 验收与交付

- 1263/1263 tests、typecheck、lint 0/0、build、四项 content gates PASS；保留原 fixture placeholder warning。新增 43 项回归，含目录、进度恢复、XP 去重、每日隔离、同步恢复与账号存储隔离。
- Chrome 248 项检查 PASS（主流程 226 + 补充 22）；375/390/430/768/1440px 无横向溢出，末尾按钮可滚动到导航上方。0 条未预期页面/控制台错误；独立访客测试数据已清空。
- 本地生产预览 http://127.0.0.1:3033，入口 /practice/exams。报告 V14_CET6_EXAM_BROWSER_REPORT.md，证据与截图留在 output/playwright/exams/。
- 未完成选练仍以当前浏览器存档为主，不新增跨设备草稿同步；完成会话复用既有同步路径，本轮回归验证恢复，不重新宣称登录云同步实测。没有新内容导入、整卷考试、迁移、OCR 或 AI。
- 分支 feature/v14-real-content-rights，HEAD fe56fc446fc146c2c76046c842ff2d38cf16bbf5；既有与本轮修改尚未提交，未推送/合并/tag/Release/部署。仅 Chrome 模拟宽度。完成后等待用户检查 UI，停止扩展。

## 历史版本：V14 真题听力练习（14.8.0，本地验收 PASS，2026-10-06）

应用版本：`14.8.0`；阶段：`V14 CET-6 Real Listening Practice`。`package.json` 与锁文件已同步，“我的 → 关于”读取同一版本。不是内容 schema/contentVersion，也不表示已发布 GitHub Release。

### 本轮交付

- 用户选择下一版优先补齐听力原录音并接入练习。2022–2026 年的 19 份不同原录音已下载，按页面起止时间拆为 133 个本地 MP3 篇章，包含 475 道选择题、英文原文、正确答案和中文解析。总音频 212,109,419 字节（约 202.3 MiB）。
- 33 套试卷共用关系按原卷逐项核对；2024 年 6 月、12 月和 2025 年 6 月第三套共用第二套，其余共用关系也记录在新听力 manifest。475 道题的选项与原始试卷页独立对照通过。
- 新生成的每日 3 组听力及额外练习优先真题；已有 Mock 计划、会话、ID 和学习进度保留，可继续。可听原录音、查看原文、答题、阅读解析、错题复测及结算 XP。刷新保留倍速、答案、播放次数、任务进度和奖励；刷新后需主动重新播放音频。
- 播放中的 0.8×/1.0× 切换使用原生 playbackRate，保持当前播放位置；暂停时变速保持暂停。倍速按钮增加状态说明和 44px 点击范围；真题显示长对话/听力篇章/讲座与讲话，题页标注听力理解，不提示不存在的查词能力。
- `scripts/import-cet6-listening.py`：从公开未加密 HLS 缓存录音，生成本地 MP3/内容 pack/审计 manifest。临时工具及缓存留在忽略的 output/。TypeScript 已排除 output/ 和浏览器产物，防止 MPEG-TS 的 .ts 扩展名被当成源码。
- 当前共享练习合计 311 组/任务：112 组阅读（840 题）、133 组听力（475 题）、33 翻译、33 写作；共 1381 道题/任务。原 59 个 Mock、Paper 001 和 PRIVATE 功能未改动。题目页面不显示来源文件名/站点，内部指纹、链接及 unknown/unverified 元数据保持真实，正式 production Paper guard 未放宽。
- 全部测试 1220/1220、typecheck、lint 0/0、生产 build、四项 content gates 已通过；音频检查仅有旧 synthetic fixture 的允许 placeholder warning。19 份录音指纹、3043 个 MPEG-TS 片段的同步字节、133 个 MP3 解码与 HTTP 206/MIME/header 检查通过。浏览器 727 项检查通过（全量音频/解析/倍速/重播/错误重试/刷新/复测/每日三组→额外练习/版本显示）。375/390/430/768/1440px 的音频及答题/展开解析无横向滚动，底部入口可用且无导航覆盖。播放 0.8× 实测时间比约 0.8；零未预期页面/控制台错误，故意阻断音频的 1 条网络错误属于已验证的重试场景。
- 当前状态仅本地，工作树包含此前及本轮变更；未 push/merge/tag/Release/部署，不声称 Git FINALIZED。预览地址 `http://127.0.0.1:3033`，报告 `V14_CET6_LISTENING_REPORT.md`。完成本轮验收后停止。

### 历史快照说明

旧 PDF 阅读导入 manifest 的 listeningEnabled=false/pendingListeningQuestions 记录导入当时状态；现在以 cet6-listening-manifest.json 为准。下面旧报告/阶段内容作为历史保留。

## 历史版本：V14 五年共享六级题库（本地验收 PASS，8/8 gates + 752 项浏览器检查，2026-10-06）

应用版本：`14.7.1`（`V14 CET-6 Five-Year Shared Practice`）。版本与阶段统一配置于 `package.json` 的 `version` / `appPhase`；“关于”页面直接读取，`package-lock.json` 根版本同步。后续版本迭代须及时更新这两项配置和锁文件，保持页面与当前工作版本一致。应用版本不等于题目 contentVersion 或存储 schemaVersion，也不代表已创建 GitHub Release。

### 当前交付：2022—2026 年 33 套 PDF 的共享练习

- 本地 `cet6题库` 的 33 份整卷解析版均已处理。去除文档中共用题型后，共享池共 112 组阅读（840 道选择题）、33 道翻译、33 道写作，合计 178 组练习、906 道题/任务。比 14.7.0 新增 100 组阅读/750 道选择题、30 道翻译、30 道写作；原 2026 年 6 月三套数据文件保持不变。
- 五份文档的阅读与同考期第一套共用，清单引用对应的既有题目 ID，不创建重复练习。其余文章全文与词库也独立对照原卷，防止正文里的“30 秒”误判为第 30 题空位、括号中文释义导致丢行、不同选项排版导致漏项；某题解析题面仅为一个空位时，从原文提取对应句子作为题面。
- 新增转换脚本 `scripts/import-cet6-history.py` 和三个 2022–2025 pack、`cet6-history-manifest.json`；旧转换脚本只处理 2026 年 6 月三套，可在扩充后的目录继续使用。两个脚本重复导入后 8 个数据文件逐字节不变，内容 ID/历史存档不迁移、不覆盖。
- 无需登录可使用共享练习；新生成的每日阅读、翻译、写作从五年导入池优先选题，既有计划原样保留。参考答案与原 PDF 解析提交后展示，翻译/写作继续使用现有规则估分。既有界面样式和 Paper 001 不变，正式整卷 Paper 发布入口未新增。
- 19 套独立听力文本共 475 道题已保存本地待接入文件，因无配套音频未启用播放。其余听力注明共用；词汇专项仍用原内容。内部来源/文档指纹与授权 unknown/unverified 字段保持真实，页面不展示 PDF 文件名、出版方或页脚网址。
- 本轮新增 164 项回归测试，1084/1084 tests、typecheck、lint 0/0、生产 build、四项 content checks 全部 PASS；音频仅保留既有 fixture placeholder warning。独立原卷对照 738/738 PASS（560 个题干/选项、112 个全文/词库、66 个翻译/写作题面）。
- Chrome 浏览器 752 项 PASS：112 组阅读首题的作答/解析/刷新、全部 66 个翻译/写作任务的草稿/提交/原 PDF 分析、三种阅读题型与主观题的五种宽度、原文弹窗、完整结算、正常每日入口、版本与控制台。26 张截图在 `output/playwright/cet6-history/`。仅模拟尺寸，未实测实体手机/其他浏览器。
- 最新报告 `V14_CET6_HISTORY_IMPORT_REPORT.md`；本地生产预览 `http://127.0.0.1:3033`，版本 14.7.1。分支/HEAD 仍为 `feature/v14-real-content-rights` / `fe56fc446fc146c2c76046c842ff2d38cf16bbf5`，本轮和已有修改尚未提交/推送；没有 merge/tag/Release/线上部署，不宣称远程同步或 FINALIZED。下方章节为历史快照。

### 前次交付：三套用户提供 PDF 的共享文字练习（14.7.0）

- 由本地确定性转换脚本 `scripts/import-cet6-pdfs.py` 提取用户提供的三套 2026 年 6 月六级 PDF。保留原题、选项、答案、解析、参考译文及范文；页面不展示 PDF 图片、文件名、页脚网址或出版方。内部清单保存文档指纹与章节位置，未将文件内文本当作开发指令。
- 已接入共享练习池：12 组阅读（90 道选择题，其中选词填空 30、信息匹配 30、仔细阅读 30）、3 道翻译、3 道写作。共 18 组练习、96 道题/任务。无需登录可练习；新生成的每日阅读、翻译、写作优先选择导入内容。既有今日计划、历史、XP 与草稿保留，不强行覆盖为新题。
- 阅读支持原题类型说明、判分、逐题解析和刷新恢复；翻译/写作在提交后提供原 PDF 的参考答案与详细分析，沿用现有规则估分，并非官方评分。题目 ID 全局唯一，旧 Mock 内容仍可解析旧学习记录。
- 未提供配套听力音频；两套共 50 道独立听力题及文本已整理至本地待接入文件，第 3 套与第 1 套共用。暂不加入听力播放池，听力继续使用原内容。
- 导入数据的授权字段保持真实的 `unknown` / `unverified`，没有伪造授权凭证。按用户明确要求接入现有共享练习路径；正式 Paper 的 `getPublishableItems()`、Paper 001、PRIVATE owner 隔离及数据同步契约未改动。本轮不是整卷 Paper 发布或新的上传 UI。
- 新增 17 项回归测试；920/920 tests、typecheck、lint 0/0、生产 build、四项 content checks 全部通过。音频检查仅保留原 synthetic fixture placeholder warning。原试卷题面与解析题面独立比较 60/60 通过；选词填空另检查空位、15 个选项与答案映射。
- Chrome 浏览器 91 项 PASS：12 组阅读作答/解析/刷新、完整阅读结算、翻译/写作草稿恢复与提交后解析、版本显示；375/390/430/768/1440px 无横向溢出，阅读主操作可见且至少 44px。17 张练习截图保留在 `output/pdf/cet6-2026-06-import/`。仅模拟宽度，未实测实体手机或其他浏览器。
- 本地生产预览：`http://127.0.0.1:3033`；启动命令 `npm run start -- --port 3033`（先构建）。报告 `V14_CET6_IMPORT_REPORT.md`；完整证据仅保留本地 `output/`。
- Git：分支 `feature/v14-real-content-rights`，HEAD `fe56fc446fc146c2c76046c842ff2d38cf16bbf5`；本轮及已有 E2 修复尚未提交，worktree 有修改。未 push / merge / tag / Release / 线上部署，不宣称远程同步或 FINALIZED。

### 之前版本：V14 Phase 1E.2（14.6.6）

工作分支 feature/v14-real-content-rights。在 Phase 1D.3 私有错题手动复习（仅 localStorage）基础上，增加服务端持久化与跨浏览器云同步：同一账号在另一个浏览器打开同一私有卷错题复习页，可恢复当前批次、答案、题号及已提交结果。新增 PrivateReviewProgress 表、4 个 Store 函数、2 个 API 路由、客户端云同步 Hook 重写、同步状态徽章与冲突对话框。复习操作不修改错题次数、学习进度或 XP。

### Phase 1D.2 最终修复与验收

- PRIVATE 选择题错题与提交进度同事务写入，服务端判分；未作答明确记录，草稿不收集，不回填旧历史。同 attempt 重试不重复，新 attempt 同版本再次答错累计，答对不删除历史。
- 唯一键 userId + paperId + contentHash + questionId；无损迁移保留旧记录。内容更新保留失效历史，新版本独立次数，旧详情链接携带 contentHash，不解释成新题目。有效数量不包含失效历史。
- 详细解析仅作为文本显示；列表和详情安全处理无 question 的失效记录。共享请求加载、取消、请求序号、身份代次及响应 owner 校验保护旧响应和账号切换；聚焦恢复时刷新有效性。
- 已提交同一轮答案不可改写或恢复草稿；冲突可采用云端或显式新轮次。服务端提交标记阻止已提交 attempt 重用，原 mutation 回执幂等。内容更新、提交、删除使用同一试卷锁协调，错题写入失败回滚进度和回执。
- 本轮错题提示绑定 attempt/contentHash，包含重复答错；重新开始或全对不会沿用旧数量，刷新/独立浏览器从服务端恢复，同步失败不宣称已云端收集。
- 816/816 tests（私有错题 25/25，新增 10 项）、typecheck、lint 0/0、生产 build、四项 content gates 全部通过。音频仅有允许的 synthetic fixture placeholder warning。
- 66 项 Chrome 浏览器检查通过，覆盖两个独立同账号 context、B 用户/未登录、网络异常、重复请求、XSS 文本显示、失效历史、账号切换迟到响应、删除与全局数据隔离。375/390/430/768/1440px 的列表/详情/结果无溢出或导航遮挡；16 张截图。
- 两个测试用户及关联数据按精确 id/email 清理。报告 V14_PHASE1D2_REPORT.md；截图、日志、最终 Git SHA 与 remote/worktree 核对保留 output/ 本地，不作为公开附件上传。
- 已知边界：未回填旧历史；旧实现已覆盖的跨版本历史无法推测重建；不包含实体手机或其他浏览器实测。以下旧章节保留为历史，当前状态以本节和最新报告为准。

### Phase 1D.3 私有错题本手动复习 MVP

- Store 层新增 `selectReviewItems`（选择当前内容版本有效错题，按 lastSeenAt desc + questionId asc 确定性排序，最多 5 道，无有效错题抛 VALIDATION_ERROR，返回题目不含正确答案/解析）和 `gradeReviewItems`（只读判分，验证 owner/paper/contentHash/题目归属/去重，返回逐题结果+统计，不修改 wrongCount/progress/XP，幂等）。
- API 路由 `POST review/start` 和 `POST review/grade`，均使用 privateRequest + safeAuth 包装，owner 从 session 派生。
- 严格校验存档版本、完整题目和答案集合、唯一选项、位置、提交时间和结果一致性；拒绝空结果、未知选项、负数/不一致统计。使用最新批次指针与 updatedAt，不按旧版本 submittedAt 误恢复。
- 刷新、聚焦和可见性恢复先通过现有 owner-scoped 错题 GET 验证访问权限、contentHash 和题目；已提交结果重新执行服务端只读判分。验证期间隐藏题目；更新/删除/权限失效显示明确状态，不能继续旧批次。
- 请求取消、序号、scope、身份代次及批次保护位于所有存档写入之前；scope 变化也取消请求。状态更新函数内不执行存储副作用；提交失败保留答案并提示未确认，存储错误独立显示。失败的重新复习不提前清除原批次。
- API 开始接口严格拒绝非法 limit/JSON，服务层最多 5 道；UUID 批次避免碰撞。判分拒绝异常答案类型和未知选项，响应绑定 owner/paper/hash/batch。服务端批次仍为只读无状态模式，没有持久化批次注册表。
- 原生 dialog + 显式 Tab/Shift+Tab 首尾循环、Escape、关闭后焦点恢复；选项提供 aria-pressed、题号提供 aria-current；按钮触控区域至少 44px，题号圆形外观仍为 28px。
- 私有复习回归 29/29（13 项真实 Prisma 服务测试 + 16 项纯解析/存档测试；本轮增加 4 项并加强现有排序/limit 测试）。完整测试 845/845；typecheck、lint 0/0、生产 build、四项 content gates 全部通过。音频仅有允许的 synthetic fixture placeholder warning。
- 80 项真实 Chrome 浏览器检查通过（完整流程 70 + 迟到响应/账号切换 10），包括刷新、未答确认、断网重试、存储失败、损坏结果、跨 owner、更新/删除、无全局副作用、迟到成功不覆盖新批次。375/390/430/768/1440px 答题与结果无横向溢出或导航遮挡，10 张截图。
- 两个隔离测试用户按精确 id/email 清理，关联试卷/进度/错题/回执均为 0。报告 V14_PHASE1D3_REPORT.md；日志、结果、截图仅保留本地 output/。本地生产预览 http://127.0.0.1:3019 已确认可访问。
- Git 历史：D3 修复已包含在 ff5fbd8 提交中，当前本地基线为后续 D4 提交；本轮未重新核对该历史提交的远程状态。
- 边界：只读判分、浏览器本地存档、不跨设备同步，不接入 XP/Review/Daily Plan/复习调度；仅 Chrome 模拟宽度，未做实体手机或其他浏览器实测。

### Phase 1D.4 私有错题本手动移出/恢复：修复与本地验收

- 沿用 D4 的 removedAt/revision/schema/migration；本轮没有新功能或新迁移。手动移出保留历史，新一轮原卷再次答错可重新激活；同一已接受 mutation 重试不撤销移出或重复累计。
- 管理操作使用试卷 FOR UPDATE 与学习提交/内容更新/删除协调，并以 owner/paper/hash/revision 条件原子更新。重复请求只在目标状态一致且 revision 为请求值或请求值加一时确认；过期请求不能覆盖恢复、再次移出或重新激活。
- 列表和 counts 从同一锁定快照推导，active/removed/contentChanged 互斥且相加为 total。已移出失效历史只计 removed；找不到当前题目的物理 active 记录展示为失效并禁止恢复。
- 解析所有记录，含已移出有效题目；严格验证题目、唯一选项、答案归属、日期、revision、重复 ID 和数量一致性。管理响应绑定 owner/记录/版本/目标状态，验证不应改变的历史字段。
- API 请求实际超过 1MiB 返回 413，非法 JSON/非对象 400、非法 revision 422。session 派生 owner；401/404/409/422 一致。API 参数不重复解码，页面参数解码一次，百分号与中文 ID 的链接/直访/刷新保持原题目身份。
- 列表/详情共享取消、请求序号、scope、身份代次及同步 pending 锁；所有成功、失败、finally 检查当前请求。旧成功不能关闭新弹窗、解锁新操作或在账号切换后显示旧内容。弹窗内显示错误，失败可重试，冲突刷新权威状态。
- 已移出有效题目支持详情；共享原生 dialog 支持 Tab/Shift+Tab/Escape 和焦点恢复；管理按钮至少 44px。padding 样式仅作用于移出弹窗，保留原视觉并避免影响 D3 复习弹窗。
- 移出后固定复习批次失效，旧批次不能判分。移出/恢复不修改原答案、wrongCount、attemptId、历史时间、学习进度、回执、XP 或全局收藏。
- 870/870 tests，专项 25/25（原 15 项 + 新增 10 项）；typecheck、lint 0/0、生产 build、四项 content gates 全部 PASS。音频仅有允许的 synthetic fixture placeholder warning。
- 真实 Chrome 浏览器 103 项 PASS（主流程 84 + 异常/竞争 19）：涵盖双 owner/未登录、独立 context、异常请求、损坏响应、失效/删除、迟到响应、账号切换、网络失败、响应丢失重试、复习失效和无全局副作用。375/390/430/768/1440px 列表/详情/弹窗检查无横向溢出、按钮和导航遮挡问题；15 张组合截图及失效/实际视口预览。
- 两个隔离用户按精确 id/email 清理，用户/试卷/进度/错题/回执均为 0；测试密码文件删除、日志密码替换。报告 V14_PHASE1D4_REPORT.md，结果与截图仅保留本地 output/，不上传公开附件。生产预览 http://127.0.0.1:3020 可访问，测试卷已清理。
- Git：基线及当前 HEAD 782b799ef59ee4f7a96b1b13a29b28a6d4872a49；本轮修复尚未提交/推送，worktree 有修改。未重新核对远程，不宣称同步或 FINALIZED；未 merge main/tag/Release。
- 边界：只 Chrome 模拟宽度，未实测实体手机/其他浏览器；不开发自动移出、掌握评分、复习调度、XP 或下一阶段。

### Phase 1E.1 最终硬化验收

- 独立 owner-scoped PRIVATE 队列，旧共享队列安全迁移；全局 push/pending/手动同步不再被 PRIVATE 阻塞。立即持久化草稿/队列，仅对网络发送作 500ms 合并。
- 数据库事务锁定试卷行，串行检查 readiness/hash/revision/attempt；并发同版本只成功一个。删除试卷和进度同事务。GET 净化只读，不覆盖较新写入。
- mutationId + SyncMutation 请求回执实现重放幂等；mode=restart 条件切换轮次，旧轮次拒绝；内容更新提供 revision 供新进度重启。
- 未上传本地/队列优先保留，关闭标签页可恢复队列草稿。确认失败读取与无云端记录，空队列不再误报已同步；账号代次保护迟到响应。
- 自动检查：791/791 tests、typecheck、lint 0/0、build、四项 content gates 全部通过。
- 55 项浏览器检查通过；两个独立 Chrome context；375/390/430/768/1440px 学习/冲突/结果页，无横向溢出或最后按钮遮挡；15 张截图。测试用户及关联数据均按精确 id/email 清理。
- 最新报告 V14_PHASE1E1_REPORT.md；截图/日志及最终 Git SHA 留在 output/ 本地，不作为公开附件上传。旧章节保留为历史，当前状态以本节及最新报告为准。

### Phase 1E.2 私有错题复习进度云同步：修复与本地验收

- 沿用 PrivateReviewProgress 表和 migration `20261002064622_add_private_review_progress`；本轮无新表/迁移。每 owner/paper 只保留最新批次，不新增云端历史。
- 修复开始响应 revision 丢失和第二批次保存冲突；已提交刷新从 GET 恢复验证后的持久化结果，不再 POST 重判。相同提交重试幂等返回原结果，改变已提交答案被拒绝。
- 单一试卷 FOR UPDATE 事务内检查 owner/readiness/hash/批次/revision、选题和判分。共享 TransactionClient 避免嵌套死锁及事务外检查的竞争窗口；保存/提交拒绝失效或已移出批次。
- 严格验证答案对象、题目/选项归属、索引、revision 和存储结果；读到损坏数据只返回失效，不删除/覆盖记录。GET 错误不当作无记录，不宣称已同步。
- usePrivateReviewSession 委托独立 PrivateReviewController；本地立即持久化 syncDirty/syncRevision/答案/题号，网络发送防抖 800ms，单个在途保存串行处理新编辑。迟到回复不回滚当前答案，提交等待保存队列。
- 响应验证 owner/paper/hash/batch/revision/结果；取消、操作序号和身份代次保护账号及路由切换后的旧响应。focus/visibility/online 核对并恢复，失败保留草稿，可“重试同步”。
- 冲突两种选择均先读最新快照；相同批次按最新 revision 保存本地。云端已提交/换批次时，服务端验证 resume 的 CAS/hash/有效题目，另开新批次保留答案，不改写已提交结果。Escape 只关闭弹窗，不丢弃草稿，可“处理冲突”重开。
- 复习不修改原卷答案、学习进度、错题次数、XP 或全局 sync/Review/Daily Plan。现有视觉保留，仅补充必要提示和重试入口。
- 903/903 tests（新增 18，专项 33/33）、typecheck、lint 0/0、生产 build、四项 content gates 全部 PASS；音频仅有允许的 synthetic fixture placeholder warning。
- 84 项真实 Chrome 检查 PASS（主流程 74 + 异常/账号切换 10）：同账号独立 context、B owner/未登录、快速编辑/慢速保存/提交、刷新草稿/结果、失败重试、断网恢复、两种冲突选择、云端提交后的恢复、异常响应、账号切换迟到保存、无全局副作用。375/390/430/768/1440px 复习/结果/弹窗无横向溢出或导航遮挡，主要按钮至少 44px，15 张截图。
- 两个随机隔离用户按精确 id/email 清理，用户及 16 类关联数据全部为 0。凭据/生成运行脚本删除，日志测试密码替换。结果/截图/日志仅保留本地 output/reviews/v14-phase1e2/。
- 报告 V14_PHASE1E2_REPORT.md、设计 V14_PHASE1E2_DESIGN.md 已更新；关于页显示 14.6.6。本地生产预览 http://127.0.0.1:3032 已确认可访问，测试卷已清理。
- Git：本轮基线 HEAD fe56fc446fc146c2c76046c842ff2d38cf16bbf5；修复尚未提交/推送，worktree 有修改。基线远程核对一致不能代表新修复已交付；不宣称发布 FINALIZED。v12.0 保持 697772d9412d9d1a4253e099a001734a5230e264；未 merge main/tag/Release。
- 边界：离线硬刷新不保证；未实测实体手机/软键盘/其他浏览器，不接全局复习、调度或自动移出；不增加真实题库。完成本阶段修复后停止。

### Phase 1D.1 最终收尾

- 每次提交、未答题确认及重新练习都等待本次服务器验证结果；检查 session owner、内容指纹及 readiness。焦点/可见性恢复也验证已提交结果；请求序号与取消保护阻止旧响应覆盖新结果。
- session 用户与页面 owner 不一致时立即隐藏旧试卷，禁止恢复、写入或继续提交。
- 三级排序统一为 order + 稳定 ID；指纹 v3 / 存档 version=3，旧格式失效并明确提示重新作答。严格校验版本、答案对象/选项、提交布尔值及整数索引；读取与写入失败分别提示。
- 原生 dialog、显式 Tab / Shift+Tab 循环、Escape 关闭及提交按钮焦点恢复。
- 验证：748/748 tests；typecheck、lint（0/0）、build、四项 content gates 通过。56 项隔离浏览器检查；375/390/430/768/1440px 学习页、弹窗、结果页，无横向溢出；包含双账号、刷新、存储配额失败、401/404/500、坏响应及迟到响应检查。两个测试账号均已清理。
- 报告：V14_PHASE1D1_REPORT.md。截图及完整验证日志仅保留 output/ 本地。最终 Git closure 记录在 output/v14d1-git-closure.md；不上传报告附件。以下旧章节为历史记录，当前状态以本节及最新报告为准。

### V13.0.1 发布收尾

- V13 Final Acceptance 已通过；Paper 001 为原创模拟卷，非官方 CET6 真题，ID 为 `cet6:mock:paper-001`，status=active（canonical lifecycle=published），contentVersion=1.1.0。
- 已有 V13 合并提交 `947f84649abdc8ae980fca5b05d674c5d61e3249`；原 `v13.0` 保留在 `fd70023f74c6ac3fd2609a291d1a7f59439f0c99`。
- 2026-09-29 收尾实测发现两个未使用导入的 lint warning。用户选择保留 `v13.0` 并发布 `v13.0.1` 修补版；仅修复这两个测试导入，并统一 package.json / package-lock.json 根版本为 13.0.1。
- 主分支发布门禁 8/8 PASS：506/506 tests、typecheck、lint 0 errors / 0 warnings、build、content:validate、content:stats、content:rights、content:audio-validate。音频校验仅有允许的 synthetic fixture placeholder warning，生产音频无错误。
- 生产 selector 仅包含 Paper 001（count=1），fixture / staging / 未授权 real 内容均为 0。
- 发布说明沿用并更新 `V13_RELEASE_NOTES.md`，不另建一套说明。完整 Git SHA、生产浏览器 smoke 证据和最终发布状态记录在 `output/release-closure/V13_RELEASE_CLOSURE_REPORT.md`（本地生成报告，不进入发布提交以避免报告内提交哈希自引用）。
- `v12.0` 保持 `697772d9412d9d1a4253e099a001734a5230e264`。未新增 Paper 002，未导入真实真题或官方音频，未开始 V14 或 AI 功能。完成本次收尾后停止。

### v11.0 发布（2026-09-23）

- main = `f8c9f40`（Merge feature/v11-profile-center into main，含 73658db 修复 + 68980b9 文档 + 67e2e4f 程序体检）。
- 已在 main 复跑：npm test 300/300、typecheck、lint 0/0、build 通过。
- 已 push main 与 v11.0 tag；GitHub Release v11.0（Latest）已创建：https://github.com/underfire666/cet-six-daily/releases/tag/v11.0
- feature/v11-profile-center 分支保留未删。V12 未开始。

### 程序体检与修复（2026-09-23）

- 基于 V11 当前版本，未新增学习模块、未提交或上传 GitHub。
- 学习统计：合并专项和复习实际完成日；补全专项、本周复习及每日计划奖励 XP；修复总 XP 升级后回落为级内 XP；补计新版每日计划 Streak；历史每日关卡客观题纳入正确率。
- 日期：周起点与最近 7 天星期标签固定按上海日历，不再依赖设备时区。
- 复习：专项错题收录新增持久化事件去重；旧存档首次迁移保留已有掌握/移除状态，缺失错题仍补入。新会话再次答错可重新激活。增加作答顺序保护与已结算 XP 幂等补发；到期总数不再被每日批量上限截断。
- 偏好：逐项验证提醒开关类型，避免字符串等异常值变成开启；保存移出 React 状态更新函数，连续更新使用最新值；存储失败显示提示。统计等待所有相关存档加载完毕。
- 自动检查：300/300 测试通过；TypeScript、ESLint、内容校验（0 错误/0 警告）、生产构建通过。
- 浏览器检查：隔离资料，在 375/390/430/1440px 下访问首页、我的、学习数据、错题本和听力入口，共 20 组检查；无横向溢出，导航固定视口底部，无 pageerror。提醒关闭后刷新保留；模拟存储配额失败显示提示。
- 截图：`output/playwright/health23-mobile.png`、`output/playwright/health23-desktop.png`；本地地址 http://127.0.0.1:3000。
- 范围限制：本次没有逐题重跑五个专项全流程或实测所有设备音频；旧版无法还原每次作答时刻，迁移已有错题采用保留用户复习成果的策略。

### V11 修复（2026-09-22）

- V11 = 「我的」+「设置」+「学习数据中心」1.0：`/me`（目标分/考试倒计时/核心指标）、`/me/stats`（总学习天数/真实学习时长/总 XP/整体正确率/本周/近 7 天）、`/me/settings/sound`（声音/震动/庆祝动画）、`/me/settings/reminders`（每日提醒）。
- 按《V11 独立验收审计报告》8 个核心问题完成修复：
  1. 移除生产环境 mock 学习基线：`mockUser` 已删，`userFor` 基线为 0，`streakFor` 只按真实完成日计算，等级由真实 XP 推导（阈值 1500，6 档称号）。新用户显示 XP 0 / Streak 0 / Lv.1「新手」。
  2. Sound/Haptic/Celebration 收敛单一 Source of Truth：删除 `profile.sound`，设置页直接操作 `FeedbackSettings`（`cet-daily:v2:settings`），学习组件 `playFeedback`/庆祝动画共用同一对象，设置立即生效。
  3. 正确率修复：按 attempt 数组逐次计数（不再对首轮双错重复计 3 次），覆盖词汇/阅读/听力/复习，翻译/写作主观题排除；新增 `summarizeReviewAnswers`。
  4. 真实学习时长：`summarizeDurations` 聚合 V2 daily + 五专项 + 复习的真实 `startedAt→completedAt`；历史无记录不伪造；完成日按 Asia/Shanghai。
  5. 移除 weekly.completedTasks（实为天数且无时间戳），改为「本周学习天数 / 学习时长 / XP」。
  6. 过去考试日期显示「本次目标日期已结束，请更新考试日期」（countdownText）。
  7. 新增 profile 三件套测试（stats/store/integration），更新 lesson 断言，总计 294/294 通过。
  8. lint 0 error 0 warning。
- 验证：npm test 294/294、typecheck、lint（0/0）、build、content:validate（0/0）、content:stats 全绿。
- 文档：`V11交付说明.md`。未 merge main、未打 v11.0、未建 Release（等人工验收）。

### V10 Content System 1.0（2026-09-22，已 merge main + v10.0 tag + GitHub Release）

- V10 = 统一 Content Layer：页面（词汇/阅读/听力/翻译/写作）不再直读 Mock 数组，全部经 `@/content/learning`（application adapters）→ Content Repository → Registry → ContentPack。Mock 数据注册为 5 个内置 Pack（`pack-*-mock`），来源 `src-mock-original`（type=mock, license=unknown）。
- Review Repository Replay：`/review/session/[id]` 经 Content Repository 回放原题（题干/选项/正确答案/用户作答/短解析），Reading 关联原文、Listening 关联材料与 Transcript；ReviewItem 只存稳定 ID + 可选最小快照 `lastWrongOptionId`；旧数据/缺失内容优雅降级不白屏。
- Content Importer：`src/content/importer.ts` 实现 Raw JSON → Parse → Normalize → Validate → Duplicate Check → Pack → Registry 流水线（`importContentPackFromJson` / `importAndRegisterContentPack`），拒绝 invalid JSON / missing id / unknown source / duplicate id / invalid correctAnswer / invalid contentType；纯元数据补默认，关键字段严格校验。
- Schema 补齐：`skillTags` 已支持；`PassageQuestion.evidence` / `ListeningQuestion.evidence`（可选 `{paragraphId?, sentenceId?}`）新增，Mock 内容不伪造。
- Difficulty 统一：`src/content/difficulty.ts` 的 `unifiedDifficulty()` 把词汇 1–5 映射 easy/normal/hard，阅读/听力原值，翻译/写作注册时补 normal；`content:stats` 不再出现 `unspecified`。
- DailyPlan 分层保持：V8 PlanGenerator 只选模块/数量，专项经 ContentSelector + Repository 取内容（集成测试证明五专项计划 ID 均可经 Repository 解析，同日刷新结果稳定）。
- 文档：新增 `V10交付说明.md`；lint 0 error 0 warning（清理 ReviewProvider/review 页未用变量，不用 eslint-disable）。
- 验证：263/263 测试通过，typecheck / lint / build / content:validate(0 error) / content:stats 全绿。
- 未 merge main、未打 v10.0、未建 Release、未开始 V11（等人工验收）。

### V9 数据层与完整学习闭环（2026-09-21，已 merge main + v9.0 tag）

- V9 完整实现错题本/生词本/自动复习 2.0：ReviewProvider 自动收录阅读/听力答题记录（首错+复测错→wrong，首错+复测对→second_try_correct；词汇由 V4 自己管），错题本列表/筛选/收藏/移除/重新激活，手动复习、每日到期复习、当天末尾复测（每题每日最多一次），复习答题页 + 结果页 + 刷新恢复；XP 复用全局机制，单题同日上限 2、单 session 上限 20，`completeReview` 原子提交。
- 生词本 2.0：词汇/阅读/听力来源合并，同词不重复建档，复用 V4 掌握状态体系；错题本与生词本独立入口。
- 存储 `cet-daily:v1:review`（schemaVersion=1），坏记录单独隔离不清空；日期统一 Asia/Shanghai；保存失败明确提示。

### V8 个性化每日计划修复（2026-09-21）

- “仅修改今天”只更新当天计划及其独立 preferences，不改全局偏好或未来计划；“保存并调整后续计划”更新当天、全局偏好及未自定义的未来计划。保留已完成任务，已完成整日计划不被重写。
- 设置表单等待本地数据加载后挂载；当天独立设置刷新后恢复。保存失败显示明确提示，不宣称已持久化。
- 轻量安排 2 个模块（总计划词汇 10 个），标准 3 个模块，加强 4 个模块；估时由实际任务相加。各专项原每日额度保持不变，总计划为最低学习目标。
- 总计划按任务目标数量判断完成：阅读 1 篇、听力 1 组即可完成对应计划任务，不要求专项全部 3 项；同模块多项按顺序累计所需数量，额外练习不抵扣每日计划。
- 读取各专项对应计划日期的记录，等待所有存储载入后同步；完成奖励 +10 XP 幂等，刷新不重复奖励。
- 首页关卡摘要、月历完成状态与新计划共用数据；没有 V8 记录的历史日期仍进入旧版 `/lesson/[date]` 关卡。未来日期可预览但不能开始。
- 新增 5 项回归测试（总计 152 项）；浏览器验证两种设置保存、刷新恢复、历史关卡入口。使用隔离测试记录确认阅读/听力各完成 1 项后总计划达标、首页同步完成及奖励去重；375/390/430/1440px 首页与设置页无横向溢出。
- 当前仍为本地 Mock；未增加新专项或外部服务，未提交或上传本轮修复。

### V7 翻译 + 写作专项（2026-09-20，feature/v7-writing-translation 待验收）

- 新增翻译、写作两个主观题专项，共享 `src/types/subjective.ts` 的 `SubjectiveFeedback` 结构（score/maxScore/summary/issues/details/referenceAnswer/provider/createdAt），当前 provider 固定 `"mock"`，V8 接真实 AI 时前端结果页不用改。
- 每日任务各 1 篇（`DAILY_TRANSLATION_COUNT=1` / `DAILY_WRITING_COUNT=1`），按 epochDay 确定性轮换；完成后可"再练一篇"，额外练习独立计数，不挤占今日 0/1。
- 草稿自动保存到 session.draft，退出/刷新可恢复；提交前参考译文/范文隐藏，提交后才展开；字数偏少弹"仍然提交"确认但不阻止。
- Mock 批改：翻译按关键词覆盖 + 长度，写作按字数 + 段落数 + 连接词 + 关键词，满分 15；结果页先简后详（估分 → 主要问题 → 参考译文/范文 → 详细分析）。
- 历史记录存在各自 store.history，首页底部显示最近 3 次，可删除。
- LocalStorage：`cet-daily:v1:translation`、`cet-daily:v1:writing`（schemaVersion=1），未改 v3:vocabulary / v1:reading / v1:listening。
- XP：基础 12 + 表现分（0–3），首次完成给基础分，跨日重复仅表现分，同日重复同题 +0；账本 key `translation:first:<taskId>` / `writing:first:<taskId>`。
- 自动测试 107/107（V6 基线 77 + V7 新增 30），typecheck/lint/build 全绿。
- 五大专项全部开放：词汇 / 阅读 / 听力 / 翻译 / 写作。

### V6 本地听力修复记录（2026-09-20，已发布 v6.0）

- 本地已接入听力专项；V5 仍为已发布稳定版本，下列改动尚未发布。
- 7 组现有 Mock 材料使用本地生成的英文 WAV 音频（`public/audio/listening/`），由原有文本通过本机 Microsoft Zira 生成，不接入外部服务或真实题库。
- 首次播放和结束后再次播放正常；音频实际播放后累计次数，暂停恢复不重复计数。
- 播放中切换 0.8× / 1.0× 使用原生 audio.playbackRate，即时变速并保持 currentTime；暂停时切换仍保持暂停，不重播、不重复计数。
- 播放异常或 10 秒内未启动时显示失败原因与重试指引；离开页面时停止音频。
- 今日主入口仅恢复今日任务，昨天未完成任务和额外听力使用独立入口，不再挤占今日 0/3 任务。
- 浏览器使用真实本地音频验证即时变速、暂停时变速、恢复与播放计数、结束重播；切到 0.8× 时位置保持在约 2 秒，没有回到开头。自动测试新增所有音频文件完整性检查。
- 真实设备听感仍需人工试听；本地音频不依赖浏览器安装的语音。

专项状态：
- 词汇：已开放
- 阅读：已开放
- 听力：已开放
- 翻译：已开放（V7）
- 写作：已开放（V7）

V5 已正式开放并验收通过“阅读”专项：每日固定 3 篇阅读、完成页展示首次答对 / 重试掌握 / 仍需加强 / 本篇生词四栏真实统计、生词点击查义并加入统一生词本（跨专项去重）、当日 3 篇完成即阅读专项完成。已合并 main、打 v5.0 tag 并发布 GitHub Release。后续开发须由用户明确提出，不自行开始 V6。

### V5 实现与自测记录（2026-09-18）

- 新增 6 篇原创 B2 英文文章（250–450 词、每篇 4 题、7 个查词条目），每日任务固定 3 篇且同日结果稳定。
- 阅读答题复用 V2 通用答题状态机（一次重试、末尾复测、AI 提示、解析）；完成页四栏统计：首次答对（首轮即对）、重试掌握（二次或 AI 提示后对）、仍需加强（复测仍未掌握）、本篇生词（本篇新收藏数），并展示 XP。
- 生词点击查义并加入统一生词本（`source: "reading"`，与词汇生词共用一套系统，已收藏去重）。
- 51 项自动测试通过（29 项 V4 存量 + 22 项新增阅读），typecheck / lint / build 通过，dev 冒烟 `/practice/reading`、`/practice/reading/session/[id]`、`/practice/reading/complete/[id]` 均 200。
- V5 保留现有视觉设计、词库与功能范围；全部改动提交于 `feature/v5-reading` 分支。

### V4 收尾验收（2026-09-18）

- 数量弹窗说明统一为“选择本次额外学习数量，学习过程中可随时退出，下次接着学。”，消除小组数量与本次数量的文案冲突。
- 小组或批次结算为 +0 XP 时，明确说明相关单词今日已获得 XP，已学词巩固不重复奖励；原奖励规则保持不变。
- 29 项自动测试通过。浏览器再次验证额外数量从 39 累加到 49，刷新后每日 20/20、额外数量、生词、XP 及未完成额外会话保留，未发现页面运行错误。
- 本次收尾仅调整文案与状态说明，保留现有视觉设计、示例词库和功能范围。V4 已完成，等待用户下一步要求，不开始 V5。

## 运行与架构

- 项目目录：`E:\The king of CET`；`npm run dev`，默认 http://127.0.0.1:3000 。也可双击 `启动网站.cmd`。
- Next.js 16.3.5 App Router、React、TypeScript、Tailwind CSS、Lucide；依赖版本固定。
- 编写 Next.js 代码前，按 AGENTS.md 阅读 `node_modules/next/dist/docs/` 内相关文档。
- UI 在 `src/components/`，静态内容在 `src/data/`，类型在 `src/types/`，日期与学习逻辑在 `src/lib/`。
- 延续绿色浅色主题与 Design Tokens、移动端优先、固定底部导航及安全区，不随意重写首页和日历。

## 已有功能

- 首页：完整月历、日期联动关卡、倒计时、XP、Streak、五项专项入口。
- 每日总关卡：通用答题、一次重试、末尾一次复测、Mock AI 提示、解析、未掌握详情、完成奖励及断点续学。
- 词汇：30 个示例词、卡片、浏览器发音、三类巩固题、掌握状态、简单间隔复习、生词本与本地持久化。
- 阅读：6 篇原创文章、每日 3 篇、阅读→答题→复测流程、生词点击查义并加入统一生词本、完成页正确率与 XP。
- 听力/翻译/写作：听力 7 组本地音频、每日任务、即时变速；翻译/写作每日各 1 篇、草稿恢复、Mock 批改。
- V10 内容层：所有专项内容经统一 Content Layer（ContentSource/Pack/Registry/Repository/Selector/Validator/Importer）获取；内容仍为 Mock，未接真实题库。没有数据库、真实登录、真实 AI API、真实 CET-6 词库。

## V4 规则

- 每日系统词汇任务目标 20，额外学习不计入分子，完成后保持 20/20。
- 新词优先；30 词 Mock 池不足时使用已学词巩固，页面明确提示。次日仍有 20 个任务词，保留真实掌握记录。
- 额外学习可选 10、20、自定义正整数，没有每日累计上限。一个批次按需创建最多 5 词的小组，组内不重复，复用原有答题系统。
- 每个完整小组提交后计入额外数量；卡片浏览本身不计完成。统计为学习词次数，包含重复巩固。
- 每日任务归属原计划日期；额外学习和词汇 XP 按完成时的 Asia/Shanghai 日期归属。跨日旧会话可恢复，新日任务可独立开始。
- 首次完成每词 +2 XP，其他日复习 +1，同词同日再次练习 +0。刷新或重复点击不重复奖励。词汇操作不修改每日总关卡完成状态和 Streak。
- 生词本、词汇掌握状态、复习计划与声音／触觉设置共用 V3 的数据和服务。

## V5 规则

- 每日固定 3 篇阅读（`DAILY_ARTICLE_COUNT=3`），`pickDailyArticles` 按 epochDay 确定性轮换，同一天结果稳定；当日 3 篇完成即阅读专项完成。
- 每篇文章 3–5 题（当前 4 题），复用 V2 通用答题流程：一次重试、两次答错进入末尾复测、AI 提示与解析；答题状态机 phase 取值 answering/retry/feedback/review_intro/complete。
- 阅读生词点击查义并加入统一生词本（id `rw_<词>`、`source: "reading"`），与词汇生词共用一套系统，已收藏去重；完成页统计本篇新加入生词数。
- 完成一篇展示四栏真实统计：首次答对数（首轮即对）、重试掌握数（二次或 AI 提示后对）、仍需加强数（复测仍未掌握）、本篇新加入生词数与 XP；XP = 基础 15 + 每题表现分（首轮答对 2、二次答对或 AI 提示后答对 1、其余 0）。
- XP 账本：`reading:first:<articleId>`（首次）+ `reading:day:<date>:<articleId>`（当日）；首次 = 基础 + 表现分，跨日重复仅表现分，同日重复同篇 +0（防刷分）。刷新或重复点击不重复奖励。
- 阅读操作不修改每日总关卡完成状态和 Streak；额外阅读需当日任务完成，优先选非计划且当日未完成的文章。

## 数据与存储

- 阅读存储键 `cet-daily:v1:reading`（schemaVersion=1），镜像词汇层：载入版本与结构校验、坏记录隔离、存储不可用时内存降级。词汇册仍为 `cet-daily:v3:vocabulary`（V4 升级为 2 后保持）。
- `ReadingStore`：`daily`（按日期计划与完成）、`sessions`（reading/quiz/complete 三阶段）、`xpLedger`；`collectedWordIds` 记录本篇新收藏。
- 每日任务归属原计划日期（跨日完成仍记入计划日），额外阅读与 XP 按完成时的 Asia/Shanghai 日期归属。
- 阅读词 `readingVocabulary.ts` 生成统一 `Word[]`，`wordById`（mockVocabulary）已扩展可检索阅读词。
- 载入验证版本和结构，隔离损坏记录；存储不可用时提示并使用内存。数据仅属于当前浏览器和站点地址，不支持跨设备同步或多标签并发合并。

## V4 数据与存储

- `VocabularySessionMode` 增加 `extra`；会话增加可选 `batchId`、`completedAt`。
- `ExtraVocabularyBatch`：`id`、`target`、`createdAt`、`sessionIds`。从关联会话计算完成数量和奖励，避免重复维护计数。
- `VocabularyStore` 增加 `batches`，存储版本升级为 2；继续使用原键 `cet-daily:v3:vocabulary` 以兼容既有记录，读取版本 1 时补充空批次。
- 保留 daily、states、sessions、xpLedger；每日额外数量由已完成会话及完成时间推导，今日 XP 从按日期去重的奖励账本推导。
- V2 profile / session / settings 保持兼容；全局词汇奖励按会话 ID 去重。
- 载入验证版本和结构，隔离损坏记录；存储不可用时提示并使用内存。数据仅属于当前浏览器和站点地址，不支持跨设备同步或多标签并发合并。

## 检查命令

`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run content:validate`、`npm run content:stats`。

重点验收：每日 20→额外 10→再额外 20，仍保持每日 20/20、额外累计 30；刷新恢复、收藏、XP 去重、跨日、375/390/430px 与桌面布局，以及原每日关卡回归。阅读：每日 3 篇进度与完成态、阅读→答题→复测全流程、生词点击查义加入统一生词本且与词汇生词去重、XP 首次/跨日/同日重复规则、刷新恢复、`/practice/reading` 系列路由 200。V10：错题复习页回放原题（题干/选项/用户作答/答案/解析）、阅读/听力原文关联、缺失内容降级、Importer 拒绝坏 JSON、content:stats 无 unspecified。

## V13 Phase 1（2026-09-26，分支 feature/v13-real-content，尚未 merge main）

### 状态

- **已完成并验证**（本轮真实实现 + 10 项 gates + 浏览器 smoke 全部通过）：
  - Paper 领域模型 `src/content/papers.ts`：Exam → Paper → Section → Group → Question 完整层级，兼容 V10 旧 paper schema（legacy 结构级校验路径），V13 新 schema 完整校验（稳定 ID、rights、schemaVersion、isPartial/fixture、section/group/question/asset 结构）。
  - Stable ID `src/content/stable-id.ts`：`cet6:2025-12:set1[:reading[:careful:g1[:q1]]]` 分层 ID 生成 + 格式校验；现有 mock ID（word_/r-/l-/t-/w-）不批量重命名。
  - Rights/License `src/content/rights.ts`：owned/official_public_material → allowed；licensed+evidence → allowed(warning)；licensed 无证据 / permission_required / unknown → blocked/unknown（禁进 production）。
  - Content Lifecycle `src/content/lifecycle.ts`：raw→normalized→validated→reviewed→publishable→published→deprecated 状态机 + V10 status 映射。
  - Import Batch `src/content/import-batch.ts` + `importer.ts` 扩展：inputFingerprint/batchId deterministic，同源同输入幂等（不重复注册）。
  - Duplicate Detection（validator.ts）：跨 pack id 去重、paper identity（exam:year-session:set）重复 → error、同 normalized 文本 hash 跨 pack → warning。
  - Staging vs Published 隔离：`getPublishableItems()`（production pool）只含 allowed + active/published；synthetic fixture 注册为 staging，学习页 Selector/Repository 绝不暴露；`resolveContentById/getPaperById` 仅开发/测试 resolve。
  - 首份原创 synthetic CET6 Paper fixture `src/content/fixture/cet6-2025-12-synthetic.ts`：isPartial=true、fixture=true、status=staging、rights=owned；4 section / 7 group / 10 题 / 1 音频 asset（占位）；全部内容原创，不含真实真题与真实音频。
  - 新增 `npm run content:rights`；content:validate / content:stats 扩展（paper counts、rights bucket、section/group/question 统计）。
  - 新增测试 `tests/v13-content.test.ts`（29 项：paper 模型、stable ID、rights、lifecycle、import batch、duplicate、隔离、59 mock 回归、deprecated ID alias、exam spec、importer 拒收）。
  - Deprecated ID 兼容：`aliases.ts` 增加运行时 `registerAlias`，旧 ID → Registry resolve → replay 测试通过。
  - Exam Specification `src/content/exam-spec.ts`：CET6 官方公开结构元数据（official_public_material），validator 参考，不硬编码在 UI。

- **未做（V13 Phase 1 边界内明确不做）**：不导入网上 CET-6 历年真题全文、不引入真实真题音频、不引入培训机构 PDF；不建立第二套平行 Content System；不改任何学习 UI/首页/账号；不改 V12 tag/Release；不 merge main、不开始 V13 Phase 2。

### Gates（全部通过）

`npm test` 399/399（新增 29 + 既有 370）｜`npm run typecheck` PASS｜`npm run lint` 0 errors｜`npm run build` PASS｜`npm run content:validate` 0 errors（59 mock + 1 paper）｜`npm run content:stats` PASS（vocabulary 30/reading 6/listening 7/translation 8/writing 8/paper 1；rights: unknown 5 / owned 1；paper sections 4/groups 7/questions 10）｜`npm run content:rights` PASS（production pool 为空，仅 allowed 可进入）｜`npx prisma validate` PASS｜`npx prisma generate` PASS｜`npx prisma migrate status` 2 migrations up to date。

### 浏览器 smoke（真实浏览器）

- `/practice/vocabulary` 词汇首页渲染正常（今日 0/20、开始学习、生词本），点击"开始学习"真实进入会话（sustain → feasible 推进）。
- `/practice/reading` 阅读首页渲染正常（今日 0/3）。
- `/review`、`/me`、`/plan/settings`、听力/翻译/写作路由均 200。
- 学习页面无任何 paper/真题入口；fixture 仅开发/测试 resolve。
- 无 runtime console error（仅有 Next dev data-inspector-id hydration 差异 warning，非产品缺陷）。

### 检查命令（新增 content:rights）

`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run content:validate`、`npm run content:stats`、`npm run content:rights`、`npx prisma validate`、`npx prisma generate`、`npx prisma migrate status`。

## V13 Phase 1.1（2026-09-26，分支 feature/v13-real-content，尚未 merge main）

### 目标

Content Identity + Rights Hardening：进入第一批真实内容之前的小型架构硬化。不扩大范围、不导入真实真题/音频、不改学习 UI。

### 已完成并验证

- **Fixture 命名空间隔离（Identity）**：synthetic fixture 从 `cet6:2025-12:set1` 迁移到独立 FIXTURE namespace `cet6:fixture:synthetic-001`（`fixturePaperStableId`/`extendStableId`，`stableIdNamespace` 判别 real/fixture/invalid）。REAL（`cet6:<year>-<session>:set<N>`）与 FIXTURE namespace 结构上可区分，未来导入真实 2025-12 set1 与 fixture 无 stable-ID / identity / duplicate-detector / alias 冲突。
- **交叉校验（papers.ts validatePaper）**：fixture=true 必须使用 fixture namespace；real/past_exam 禁止使用 fixture namespace；section/group/question/asset ID 必须与 paperId 同 namespace。
- **Rights fail-closed（rights.ts）**：official_public_material 不再无条件 allowed——必须有明确再利用依据（permissionEvidence/licenseName/licenseUrl）且 `redistributionAllowed=true` 才 allowed；无依据/未确认 → unknown；redistributionAllowed=false → blocked。owned 显式禁再分发 → blocked；licensed 需 evidence + redistribution=true；commercialUseAllowed 未确认在 rights report 明确显示限制。
- **Validator 分层（validator.ts）**：validatePack 只做结构校验（schema validity）；production 发布权由 rightsVerdict / rightsIssues(scope=production) / getPublishableItems 把关；unknown/permission_required 允许进入 staging/raw/audit 人工审查，但绝不进入生产 Selector。
- **Duplicate 检测修正**：paper identity duplicate 仅对 REAL namespace 生效；fixture 与 real 可共存于 Registry 无冲突；两个真实同 identity paper 仍 duplicate ERROR。
- **59 mock 不受影响**：demo pool 与 production pool 继续明确区分，mock 保持可学习。
- **测试新增 14 项**（v13-content.test.ts 29 → 43）：fixture namespace 生成/判别、real/fixture 交叉校验、official 四场景、production pool fail-closed matrix（7 场景）、fixture+real 共存、两个 real 冲突、staging 可导入 + production 隔离、licensed 无 redistribution → unknown。

### Gates（全部通过）

`npm test` 413/413（新增 14 + 既有 399）｜`npm run typecheck` PASS｜`npm run lint` 0 errors｜`npm run build` PASS｜`npm run content:validate` 0 errors（59 mock + 1 paper，fixture=cet6:fixture:synthetic-001）｜`npm run content:stats` PASS｜`npm run content:rights` PASS（PUBLISHABLE 1 / BLOCKED 0 / UNKNOWN 5；production pool 空）｜`npx prisma validate` PASS｜`npx prisma generate` PASS｜`npx prisma migrate status` 2 migrations up to date。

### 浏览器 smoke（真实浏览器）

- Vocabulary/Reading/Listening/Translation/Writing/Review 六模块全部正常渲染，mock 内容可学习（词汇会话真实推进 feasible → significant）。
- 学习页面无任何 paper/真题/fixture 入口（fixture/blocked/unknown-rights 不出现在学习 Selector）。
- 无 runtime console error（仅有 Next dev data-inspector-id hydration 差异 warning，非产品缺陷）。

### 未做（保持 Phase 1.1 边界）

不导入真实真题/音频/培训机构材料；不改学习 UI/首页/账号；不改 V12 tag/Release；不开始 V13 Phase 2。

## V13 Phase 2B / 2B.1（2026-09-28，分支 feature/v13-real-content）

- **Phase 2B**（commit b048ae4 / 6a17579 / 0844ada）：Paper 内容契约（V13_PAPER_CONTENT_CONTRACT.md）+ Content Specification 的 Paper 001 生产规范（V13_CONTENT_SPECIFICATION.md）+ Phase 2B 报告。
- **Phase 2B.1**（commit 91f4567 code + 2a190b2 docs）：三 namespace（real/fixture/mock）结构隔离；production Paper 显式 examSpecId 强绑定（KNOWN_EXAM_SPEC_IDS 历史列表稳定）；Paper 001 正式 ID 定为 `cet6:mock:paper-001`（弃用 `cet6:2026-6:set1`，不建 alias）；public_domain 必须有 evidence。
- **验证**：npm test 435/435、typecheck/lint/build PASS、content:validate/stats/rights PASS、production pool 空。PHASE2B1 FINAL HEAD = `2a190b2`（Local == Remote）。

## V13 Phase 2C（2026-09-28，分支 feature/v13-real-content）

### 目标

生产第一套完整原创高仿真模拟卷 Paper 001（`cet6:mock:paper-001`，57 题/任务，`cet6-current-2026` 显式绑定），全部内容原创、不导入真实真题/音频/第三方解析，status=staging 保持生产隔离。

### 已完成并验证

- **Paper 001 完整落盘**：`src/content/papers/cet6-mock-paper-001.ts`（Writing 1 / Listening 25（长对话 8+篇章 7+讲话·报道·讲座 10）/ Reading 30（cloze 10+matching 10+careful 10）/ Translation 1；每题 short+detailed 解析，听力 4 组全 transcript，3 个音频为明确 staging placeholder（未生成真实音频））；`sources.ts` 新增 `MOCK_PAPER_001_SOURCE`（original/owned）；三个内容脚本注册 + content-validate 断言。
- **身份**：authenticity=original、fixture=false、isPartial=false、status=staging、rights=owned、namespace=MOCK（section/group/question/asset 全部由 `cet6:mock:paper-001` 确定性派生）。
- **专项测试 12 项**（v13-content.test.ts 435 → 447）：身份/57 题 conformance/section 结构/listening 25/reading 30/答案完整/解析完整/transcript+audio placeholder/asset 无 orphan/rights+provenance/staging 不进 production/全库 duplicate=0。
- **Gates**：npm test 447/447、typecheck PASS、lint 0 errors 0 warnings、build PASS、content:validate 0 errors 0 warnings、content:stats PASS、content:rights PASS（owned 2 / unknown 5；production pool 空）。
- **Whole-paper editorial QA（§15/§16）**：结构 conformance PASS、每题答案+解析 PASS、transcript+asset 引用 PASS、stable ID 唯一 PASS；答案分布 choice 45 → a=13/b=21/c=9/d=2，matching → E,F,A,G,D,I,J,C,H,B（b 略多，如实记录）。
- **提交**：`feat: add V13 original mock paper 001`（+ docs 独立 commit），已 push `feature/v13-real-content`；v12.0 tag 未动。

### 未做（保持 Phase 2C 边界）

未开始 Phase 2D；未生成正式音频；Paper 001 保持 staging 未转 active/published；未开始 V14；未 merge main / 打 tag / 建 Release。
## V13 Phase 2C.1（2026-09-28，分支 feature/v13-real-content）

### 目标

对 Paper 001 做真正的内容级独立 Editorial Acceptance（57 题逐题语义审查）、清理 "TEST FIXTURE" 文档残留、核查 fixture 目录语义、修正答案分布生成偏差，并做 Git 收尾。

### 已完成并验证

- **独立 Editorial Review**：Writing / Listening / Reading / Translation / Explanation / Language / Difficulty 七项全部 PASS（难度口径为 "editorially calibrated to CET6 specification"，不宣称与官方真实难度等值）。
- **修复内容缺陷**：cloze q5 双解（选项 B close→cross，消除 bridge/close 双解，讲解同步）；答案位置分布偏差（修订前 a13/b21/c9/d2 → 修订后 a14/b10/c11/d10，重排 15 题选项顺序，题目内容与干扰项语义不变，讲解字母引用同步）。
- **TEST FIXTURE 文档残留**："V13_CONTENT_SPECIFICATION.md" 两处旧表述修正为 self-authored/original/owned/staging/complete provenance（L104/L114 正确语义保留）。
- **fixture 目录语义**：Paper 001 自 "src/content/fixture/" 迁移至 "src/content/papers/cet6-mock-paper-001.ts"（fixture/ 仅保留 TEST FIXTURE），脚本/测试/文档 import 路径同步；contentVersion 1.0.0 → 1.0.1。
- **Gates**：npm test 447/447、typecheck PASS、lint 0 errors 0 warnings、build PASS、content:validate 0 errors 0 warnings（Paper 001 仍 staging）、content:stats PASS、content:rights PASS（production pool 空）。
- **提交**："fix: refine V13 mock paper 001 editorial quality" + docs commit，已 push "feature/v13-real-content"；v12.0 tag 未动。

### 未做（保持 Phase 2C.1 边界）

未开始 Phase 2D；未生成正式音频；Paper 001 保持 staging；未开始 V14；未 merge main / 打 tag / 建 Release。

## V13 Final Acceptance（2026-09-29，Content 1.0 → Production Release）

### 状态
- **V13 FINAL ACCEPTANCE: PASS**
- **Paper 001: PUBLISHED**（status=active → lifecycle=published）
- **分支**: feature/v13-real-content → main
- **Tag**: v13.0

### 核心交付
- 原创高仿真模拟卷 Paper 001（cet6:mock:paper-001，57 题/任务，7 个 AI 合成语音 MP3）
- Production entry：/practice/paper（列表）+ /practice/paper/[paperId]（答题）
- Rights-aware content architecture + namespace isolation + lifecycle management
- 完整 PaperSession / Result / Review / Wrongbook / XP / Cloud Sync / Multi-device conflict merge

### 验证
- 8/8 gates PASS（test 504/504, typecheck, lint 0/0, build, content 4/4）
- 浏览器 production smoke：Writing/Listening(audio)/Reading/Translation 全部通过
- 14/14 publication eligibility PASS
- v12.0 tag 未动（697772d）
- 无 Prisma 变更，无真实真题/音频导入

### 边界
- 未开始 V14；未开始 V15 AI；未新增 Paper 002
- Paper 001 为原创模拟卷，非官方 CET6 真题

## V14 Phase 0/0.1（2026-09-30，分支 feature/v14-real-content-rights）

### 目标
Real Content Source & Rights Strategy：ContentRights 扩展、REAL Production Guard、Audio Rights 三分、Explanation Rights、PRIVATE 导入合约、7 个 synthetic fixtures、14 个新测试；Phase 0.1 统一 source taxonomy、授权期限 fail-closed、三类 rights 独立校验、permissionBasis 限制。

### 已完成
- ContentRights 扩展（rightsStatus 7态、permissionBasis、effectiveAt/expiresAt、termType）
- REAL Production Guard（realProductionEligible()）
- PRIVATE 导入合约（private-content.ts：owner-scoped stable ID、assertPrivateAccess）
- 550/550 tests PASS，8/8 gates PASS
- 提交：2aca1cb（Phase 0.1），已 push

## V14 Phase 1A（2026-09-30，分支 feature/v14-real-content-rights）

### 目标
Private Content Import MVP Design：数据模型扩展（authenticity=user_import、visibility?、ownerId?）、validatePrivatePaper() 8 项校验、isPrivateContent() 检测、getPublishableItems() 排除 PRIVATE、29 个隔离测试；Contract Normalization 统一 authenticity=user_import_only，修正文档过度表述。

### 已完成
- 数据模型：ContentMeta + CET6Paper 新增 authenticity="user_import"、visibility?、ownerId?
- validatePrivatePaper()：authenticity 固定 user_import_only（拒绝 past_exam/original/practice）
- getPublishableItems()：PRIVATE 内容双重过滤（visibility + namespace）
- 29/29 隔离测试 PASS
- 579/579 tests PASS，8/8 gates PASS
- 最终字段：PRIVATE_AUTHENTICITY=user_import_only、SYNC_SCOPE=DESIGNED_ONLY、SERVER_OWNER_AUTHORIZATION=CONTRACT_DEFINED_NOT_IMPLEMENTED、PRIVATE_STORAGE/SYNC/LEARNING_FLOW=NOT_IMPLEMENTED
- 提交：797240b（Phase 1A Final），已 push

## V14 Phase 1B（2026-10-01，分支 feature/v14-real-content-rights）

### 目标
Private Storage Layer：Prisma PrivatePaper 表 + migration、CRUD 服务层（create/get/list/update/delete）、Next.js API 路由（server 从 session 派生 owner）、24 个回归测试、8/8 gates。

### 已完成并验证
- **Prisma PrivatePaper 表**：userId 外键（ON DELETE CASCADE）、paperId TEXT、title TEXT、content JSONB、@@unique([userId, paperId])、@@index([userId])
- **Migration**：20261001002437_private_paper（CREATE TABLE + INDEX + UNIQUE INDEX + FOREIGN KEY），不清空现有数据
- **CRUD 服务层**（src/content/private-paper-store.ts）：createPrivatePaper/getPrivatePaper/listPrivatePapers/updatePrivatePaper/deletePrivatePaper
- **安全设计**：server 派生 ownerId/paperId/authenticity/visibility 等身份字段，覆盖客户端伪造；update 禁止修改身份字段；不存在与他人记录返回一致 NOT_FOUND
- **API 路由**：GET/POST /api/private-papers，GET/PUT/DELETE /api/private-papers/[paperId]，全部 401 未登录拦截
- **内容校验**：create/update 均调用 validatePrivatePaper() 8 项校验
- **测试**：24/24 PASS（未登录拒绝、CRUD 持久化、跨 owner 隔离、伪造 ownerId、禁止更新身份字段、非法内容、重复 ID、production selector 排除、Paper001 无回归）
- **Gates**：npm test 603/603、typecheck PASS、lint 0 errors 0 warnings、build PASS、content:validate 0 errors 0 warnings、content:stats PASS、content:rights PASS、content:audio-validate PASS
- **新增 prisma CLI**：prisma@6.19.3 devDependency（用于 migration，与 @prisma/client 版本匹配）

### 未做（保持 Phase 1B 边界）
- 未开始 Phase 1C（导入/管理 UI；学习流程属于 Phase 1D）
- 未实现 PRIVATE_SYNC（Phase 1E 将复用 V12 account-scoped queue）
- 未实现 PDF/图片/音频上传、OCR/AI；JSON 本地文件导入见 Phase 1C.1
- 未修改 Paper 001 正文/答案/音频/内容版本
- 未 merge main / 打 tag / 建 Release

## V14 Phase 1B.1 / v14.3.2（2026-10-01）

- 修复 PRIVATE 结构校验、server 权利确认时间、实际字节请求大小限制、特殊字符 ID 二次解码、标题不一致、owner namespace 明文以及数据库错误状态码。
- 新 ID 使用固定域分隔的完整 SHA-256 owner 摘要；旧 ID/namespace 保留，旧 sections 草稿更新兼容，不修改数据库 schema、不清空数据。
- 634/634 tests、typecheck、lint 0/0、build、4 个 content gates PASS；真实生产 HTTP 登录/API 验证 44/44 PASS。测试用户按 exact ID 清理。
- PRIVATE_STORAGE_IMPLEMENTED=YES；SERVER_OWNER_AUTHORIZATION=IMPLEMENTED_FOR_CRUD；PRIVATE_SYNC_IMPLEMENTED=NO；PRIVATE_LEARNING_FLOW_IMPLEMENTED=NO。
- 详情：V14_PHASE1B1_REPORT.md；最终 Git SHA 与远程相等/clean/tag 不变证据保存在本地 output/v14-phase1b1-git-closure.md。
- 未开始 Phase 1C；未修改 Paper 001；未 merge main、tag 或 Release。完成后停止等待检查。

## V14 Phase 1C.1（2026-10-01，分支 feature/v14-real-content-rights）

### 目标
Private Paper Management + JSON Import UI：私有卷列表页、JSON 导入页（粘贴/文件双模式）、私有卷详情页（内容概览/元信息/修改标题/删除确认）、"我的"页面入口、共享校验模块、33 个回归测试、8/8 gates、浏览器 E2E。

### 已完成并验证
- **列表页** `/me/private-papers`：useSession 鉴权，未登录重定向登录页，空状态引导，导入按钮，按更新时间排序
- **导入页** `/me/private-papers/import`：粘贴 JSON / 选择文件双模式 tab，localPaperId + 标题 + JSON textarea + 权利确认 checkbox（默认不勾选），实时预览（section/group/question 数量 + 草稿提示），1MiB 限制，客户端校验 + 服务端最终校验，失败保留输入，成功跳转详情页
- **详情页** `/me/private-papers/[paperId]`：内容概览（Section/Group/题目/草稿状态）、元信息（paperId/authenticity/visibility/创建/更新时间）、修改标题（保持 DB title 与 content.title 一致）、删除两步确认、404 处理、paperId 编码归一化（修复 useParams 双重编码 Bug）
- **"我的"页面入口**：在 /me 新增"内容"section，包含"我的私有卷"链接（FileText 图标）
- **共享校验模块** `src/lib/private-papers/validation.ts`：validateLocalPaperId/validateTitle/parseJsonContent/validateImportDraft/countContentStats/encodePaperIdForUrl/hasSpecialPaperIdChars/IMPORT_BODY_LIMIT
- **CSS**：globals.css 追加 pp-* 系列样式（列表卡片、导入表单、预览网格、详情 section、危险操作区、移动端响应式 @media max-width:430px）
- **测试**：33/33 PASS（客户端校验 18 + store 集成 15）
- **Gates**：npm test 667/667、typecheck PASS、lint 0 errors 0 warnings、build PASS、content:validate/stats/rights/audio-validate 全部 PASS
- **浏览器 E2E**：未登录重定向、注册登录、列表空状态、导入创建、详情显示、修改标题+刷新持久化、删除取消/确认、移动端布局，全部通过
- **Bug 修复**：详情页 paperId 双重编码导致 404（useParams 返回编码值 + fetch 再次 encodeURIComponent），增加归一化解码逻辑

### 未做（保持 Phase 1C 边界）
- 未开始 Phase 1D（私有卷答题/学习流程）
- 未开始 Phase 1E（私有卷云同步）
- 未实现 PDF/图片/音频上传、OCR/AI；JSON 本地文件导入见 Phase 1C.1
- 未修改 Paper 001 正文/答案/音频/内容版本
- 未 merge main / 打 tag / 建 Release
- 文件导入模式浏览器 E2E 已在收尾补齐（见下方）
- 真机移动端软键盘未验证
- 跨 owner 浏览器隔离已在收尾补齐（见下方）

### 关键文件
- 新增：`src/app/me/private-papers/page.tsx`、`src/app/me/private-papers/import/page.tsx`、`src/app/me/private-papers/[paperId]/page.tsx`、`src/lib/private-papers/validation.ts`、`tests/v14-private-papers-ui.test.ts`、`V14_PHASE1C1_REPORT.md`
- 修改：`src/app/me/page.tsx`、`src/app/globals.css`
- 截图：`output/v14c1-screenshots/`（8 张）

### Phase 1C.1 收尾修补与最终验收

- 三个页面增加服务端 auth()；交互拆分为 Client 组件。详情 ID 仅按 namespace 前缀规范化一次，保留字面 %25/%3A；真实导入、列表跳转、刷新通过。
- 导入共用服务端结构校验器，检查完整 UTF-8 请求字节限额；未确认禁用提交，同步 ref 阻止重复提交，失败保留输入，文件读取乱序与提交旧内容保护。
- 修复登录页忽略 callbackUrl，允许站内返回路径，拒绝外部跳转；修正详情删除文案与 questionRefs 计数。
- 674/674 tests、8/8 gates PASS；44/44 真实 HTTP；64/64 Chrome 浏览器检查 PASS。
- 375/390/430/768/1440px × 列表/导入/详情共 15 组检查：无横向滚动或导航覆盖末尾正文，15 张截图保存于 output/playwright/v14c1-closure/。
- 初版编码归一化、共享校验、按钮禁用和未完成验收的历史描述以上述修补为准。旧章节测试数量保留为历史记录。
- PRIVATE_MANAGEMENT_UI / PRIVATE_JSON_IMPORT_UI=YES；PRIVATE_LEARNING_FLOW / PRIVATE_SYNC=NO；无 Prisma 变更，无 Paper 001 内容变更。
- 详情：V14_PHASE1C1_REPORT.md；最终 Git closure：本地 output/v14c1-git-closure.md。只普通推送当前 feature，不 merge main/tag/Release/force push。完成后停止，不开始 Phase 1D/1E。

## V14 Phase 1D.1（2026-10-01，分支 feature/v14-real-content-rights）

### 目标
Private Paper Learning MVP：让已导入的符合要求的私有卷完成详情页 → 开始学习 → 作答 → 提交 → 查看正确率/正确答案/解析 → 返回详情。仅支持 reading section + careful_reading group + 内联 choice questions。不奖励 XP/Streak/全局统计，不做服务端学习记录或跨设备同步，使用 sessionStorage 按 user.id+paperId 隔离本地进度。

### 已完成并验证
- **readiness 判定模块** `src/lib/private-papers/readiness.ts`：checkPrivatePaperReadiness(content) 检查 isPartial!==true、仅 reading section、仅 careful_reading group、无 questionRefs/assetIds、仅 choice 题、options>=2 且格式合法、answerId 存在且匹配、prompt 非空、至少 1 题；不静默跳过不支持内容。computePrivateContentHash（djb2）用于 sessionStorage 进度校验。scorePrivateAnswers 判分（correct/total/accuracy 保留1位小数）。
- **学习页服务端组件** `src/app/me/private-papers/[paperId]/study/page.tsx`：auth() 服务端 session 校验、privatePaperIdFromRoute 解码、getPrivatePaper 读取（owner-scoped）、checkPrivatePaperReadiness 判定、渲染 StudyClient。未登录重定向，NOT_FOUND 走 notFound()。
- **StudyClient** `src/app/me/private-papers/[paperId]/study/StudyClient.tsx`：作答状态管理（合并 StudyState 对象，与 PaperProvider 同构）、前后题导航、已答/未答计数、题号跳转 dots、未答题提交确认 modal、提交冻结、结算正确率、结果页（正确答案高亮+用户答案标记+解析/暂无解析）、重新练习（清空 sessionStorage 新建轮次）、sessionStorage 持久化（key=`private-study:`+userId+`:`+paperId）、恢复前验证身份+paperId+contentHash（内容变更则失效旧进度）、存储不可用/损坏容错、账号切换隔离。
- **详情页更新** `DetailClient.tsx`：新增"学习"section——ready 时显示题目数量+说明+"开始学习"按钮，不 ready 时显示具体原因+支持范围说明。
- **CSS**：globals.css 追加 pp-study-* 系列样式（进度条、阅读材料区、选项按钮、导航、题号 dots、modal、分数展示、答题回顾列表、正确/错误高亮、移动端响应式）。
- **lint 修复**：React 19 `react-hooks/set-state-in-effect` 严格禁止 effect 中同步 setState。最终方案将 answers/currentIndex/submitted 合并为单个 StudyState 对象，restore effect 中使用 `setStudyState(loadStudyStateFromStorage(...))` 单次调用（与 PaperProvider 完全同构），lint 通过。
- **测试**：35/35 PASS
- **Gates**：npm test 709/709、typecheck PASS、lint 0 errors 0 warnings、build PASS、content:validate/stats/rights/audio-validate 全部 PASS
- **浏览器 E2E**：导入合法卷 → 详情页"开始学习" → 学习页作答 → 提交 → 结果页正确率/解析 → 刷新 sessionStorage 恢复 → 重新练习重置 → 未答题确认 modal，全部通过

### 未做（保持 Phase 1D 边界）
- 未开始 Phase 1E（私有卷云同步）
- 未实现 XP/Streak/学习统计/Daily Plan/Review 奖励
- 未实现服务端学习记录持久化（仅 sessionStorage 标签页本地）
- 未支持 listening/translation/writing/cloze/matching 等题型
- 未修改 Paper 001 正文/答案/音频/内容版本
- 未 merge main / 打 tag / 建 Release

### 关键文件
- 新增：`src/lib/private-papers/readiness.ts`、`src/app/me/private-papers/[paperId]/study/page.tsx`、`src/app/me/private-papers/[paperId]/study/StudyClient.tsx`、`tests/v14-private-paper-study.test.ts`
- 修改：`src/app/me/private-papers/[paperId]/DetailClient.tsx`、`src/app/globals.css`
- 截图：`output/v14d1-screenshots/`（3 张）

### 最终字段
- PRIVATE_LEARNING_FLOW=LIMITED_READING_CHOICE_MVP
- PRIVATE_PROGRESS=TAB_LOCAL_ONLY
- PRIVATE_REVIEW=NOT_IMPLEMENTED
- PRIVATE_DAILY_PLAN=NOT_IMPLEMENTED
- PRIVATE_SYNC=NOT_IMPLEMENTED
- PRIVATE_XP=NOT_IMPLEMENTED
- 无 Prisma 变更，无 Paper 001 内容变更

## V14 Phase 1E.1（2026-10-01，分支 feature/v14-real-content-rights）

### 目标
Private Study Progress Cloud Sync MVP：同一账号在另一浏览器/设备打开同一私有卷，能恢复答案、当前题号及已提交结果；网络失败时保留本地作答，恢复后可重试。复用 V12 账号隔离队列/重试/同步状态机制，不重写现有同步系统。

### 已完成并验证
- **Prisma PrivatePaperProgress 模型**：owner-scoped，字段 paperId/attemptId/contentHash/answers(JSON)/currentIndex/submitted/revision/createdAt/updatedAt；@@unique([userId, paperId])；migration `20261001111004_add_private_paper_progress`
- **服务端存储层** `src/content/private-paper-progress-store.ts`：getPrivatePaperProgress（读取并净化非法答案、contentHash 不匹配返回 null）、putPrivatePaperProgress（事务内先查后写，attemptId/revision/contentHash 条件更新）；不存储分数，读取时按当前试卷重算
- **API 路由** `GET/PUT /api/private-papers/[paperId]/progress`：server session 派生 owner，不信任请求中的 userId；错误映射 NOT_FOUND->404、VALIDATION_ERROR->422、CONFLICT(revision_conflict/attempt_mismatch)->409、NOT_READY->409、CONTENT_CHANGED->409；revision_conflict 返回服务端最新进度供客户端决策
- **客户端同步适配器** `src/lib/private-papers/progress-sync.ts`：复用 V12 队列数据结构（enqueueMutation/loadQueue/saveQueue），entityType=privateProgress，合并策略 snapshot；独立推送 pushPrivateProgressQueue（逐个 PUT 专用端点，不走 /api/sync/push）；fetchRemoteProgress 拉取云端；clearPrivateProgressForPaper 清空队列；generateAttemptId 新练习轮次；账号切换保护 activeUserId() 校验
- **StudyClient 集成**：云端优先恢复（GET 云端有进度且 contentHash 匹配->采用云端，不入队；否则回退本地 sessionStorage，本地有效则 baseRevision=0 入队创建）；500ms debounce 入队推送（高频选答案合并，提交即时 flush）；4 种同步状态 local_saved/pending/synced/failed + conflict；revision 冲突弹窗三选项（采用云端/保留本地强制覆盖/重新开始）；重新练习生成新 attemptId 并清空队列；迟到响应保护（activeBinding + requestId）；账号切换立即隐藏
- **V12 sync/client.ts**：MERGE_POLICY 添加 privateProgress: "snapshot"（唯一修改）
- **CSS**：pp-sync-status-banner 4 状态配色 + pp-conflict-dialog 对比弹窗 + 移动端响应式
- **测试**：tests/v14-private-progress-api.test.ts（19 项，真实 Prisma）+ tests/v14-private-progress-sync.test.ts（14 项，mock fetch）
- **Gates**：npm test 781/781、typecheck PASS、lint 0 errors/0 warnings、build PASS、content:validate/stats/rights/audio-validate 全部 PASS
- **关键修复**：路由层 PrivatePaperProgressStoreError 映射（原实现返回 500，修复后返回正确 409/422/404，使客户端冲突检测正常工作）

### 恢复优先级
1. 云端进度优先（contentHash 匹配->采用，不入队）
2. 本地 sessionStorage（云端无进度时回退，有效则立即上传）
3. 全新开始（新 attemptId）

### 冲突规则
- revision 条件更新：PUT 携带 baseRevision，服务端校验 revision===baseRevision 才更新并递增
- 冲突时不自动合并 answers，弹窗提供采用云端/保留本地/重新开始
- 重新练习创建新 attemptId，旧轮次请求返回 attempt_mismatch 被拒绝
- 重复 mutation 幂等（V12 mutationId + 服务端 revision 递增）

### 隔离
- PRIVATE 进度不进入全局 LearningSession/XP/Review/Daily Plan
- 不调用 enqueueSession/enqueueXpEvent 等全局适配器
- 队列按 userId 分 key，A 的待同步队列不会作为 B 推送
- 私有练习不写 cet-* localStorage 全局学习记录

### 未做（保持 Phase 1E.1 边界）
- 未开始 Phase 1E.2
- 未接入 XP/Streak/全局学习统计/Review/Daily Plan
- 未支持 listening/translation/writing/cloze/matching 等题型
- 未实现 PDF/图片/音频上传、OCR/AI
- 未修改 Paper 001 正文/答案/音频/内容版本
- 未 merge main、打 tag、建 Release
- 同一练习 revision 冲突不自动合并 answers（需用户手动决策）
- 不支持多标签页同时作答同一篇卷

### 关键文件
- 新增：`src/content/private-paper-progress-store.ts`、`src/lib/private-papers/progress-sync.ts`、`src/app/api/private-papers/[paperId]/progress/route.ts`、`tests/v14-private-progress-api.test.ts`、`tests/v14-private-progress-sync.test.ts`、`prisma/migrations/20261001111004_add_private_paper_progress/`、`V14_PHASE1E1_DESIGN.md`、`V14_PHASE1E1_REPORT.md`
- 修改：`prisma/schema.prisma`、`src/lib/sync/client.ts`、`src/lib/private-papers/progress-storage.ts`、`src/content/private-paper-store.ts`、`src/app/me/private-papers/[paperId]/study/StudyClient.tsx`、`src/app/globals.css`、`PROJECT_CONTEXT.md`

### 最终字段
- PRIVATE_LEARNING_FLOW=LIMITED_READING_CHOICE_MVP
- PRIVATE_PROGRESS=CLOUD_SYNCED
- PRIVATE_SYNC=IMPLEMENTED（V12 队列复用 + 专用端点）
- PRIVATE_REVIEW=NOT_IMPLEMENTED
- PRIVATE_DAILY_PLAN=NOT_IMPLEMENTED
- PRIVATE_XP=NOT_IMPLEMENTED
- 无 Paper 001 内容变更
