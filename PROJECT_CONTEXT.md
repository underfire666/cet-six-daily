# 六级日常项目上下文

## 当前工作版本：V11 Profile & Study Center（修复完成，待人工验收，feature/v11-profile-center）

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
