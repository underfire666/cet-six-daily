# V12 Round 9：真实浏览器最终验收报告

- 日期：2026-09-23（Asia/Shanghai）
- 分支：`feature/v12-cloud-sync`；基线 `6ac1b55`
- 环境：Next.js 16.3.5、PostgreSQL 18.6、`cet_six_v12_test`、Chrome 隔离 Browser Context
- 测试账号：新建 User A 与 User B；口令、`AUTH_SECRET`、`DATABASE_URL` 均不写入报告。
- 方法：通过真实 UI 完成学习；两个独立 Browser Context 登录同一账号测试恢复；再核对 HTTP pull 和 PostgreSQL 行数。项目旧的模拟数据不算作通过证据。

## Round 8 更正

原 Round 8 表格共 25 行，原报告声称的 PASS 14 / PARTIAL 5 / NOT VERIFIED 6 与表格不符。单按原表逐行是 13 / 4 / 8；按证据强度将 Guest、迁移事务、Wordbook re-add、DailyPlan union 四项从 PASS 调整为 PARTIAL 后，正确结果为 **PASS 9 / PARTIAL 8 / NOT VERIFIED 8 / FAIL 0**。已同步更正原报告。

## Round 9 逐项结果

| # | 场景 | 结果 | 浏览器与数据证据 |
|---|---|---|---|
| 1 | PostgreSQL 与迁移基线 | PASS | 真实数据库可连；`prisma migrate status` 显示 1 个迁移且 schema 最新。 |
| 2 | Device A/B 隔离 | PASS | Playwright 使用两个独立 `browser.newContext()`；B 为空存储注册/登录，未复制 A 的 cookie 或 localStorage。 |
| 3 | 创建独立 User A/B | PASS | 两个新账号经注册 UI 创建；B 随后可登录；报告不保存口令。 |
| 4 | Guest 完整学习与刷新 | PARTIAL | Guest UI 真正完成 5 词组，结算 +10 XP，收藏 1 词；刷新后记录仍在。未产生 Review item，也未完成整日 DailyPlan，故不能判 Guest 完整 PASS。 |
| 5 | Guest 不上传 | PASS | Guest 学习前后无待上传队列，也没有登录用户；DB 中的测试账号和数据均在后续注册后产生。 |
| 6 | Guest→Account Migration Preview | FAIL | 用上述 Guest 数据注册 A，进入“账号与同步”后未出现“把本机学习记录合并到账号”；页面只显示同步与退出。当前检测逻辑读取旧键/旧字段，实际数据在 V2/V3 存储中。 |
| 7 | Migration“稍后处理” | NOT VERIFIED | Preview 不出现，无法真实点击。Guest 原数据仍保留。 |
| 8 | Migration Confirm 与云端写入 | NOT VERIFIED | 入口缺失；A 云端没有 Guest 的 5 词会话/XP/生词迁移记录。不能把未执行写成事务成功。 |
| 9 | 重复 Migration 幂等 | NOT VERIFIED | 首次迁移无法触发。Round 8 的 mutationId 跳过与此不是同一个场景。 |
| 10 | Migration transaction rollback | NOT VERIFIED | 无安全的失败注入方式，且迁移入口缺失；未以 mutationId 幂等代替回滚。 |
| 11 | Device A 五专项真实完成 | PASS | A 通过 UI 完成词汇、阅读、听力、翻译、写作各至少一次。听力播放中切到 0.8×，UI 提示播放位置保持。 |
| 12 | A 创建 2 翻译＋2 写作历史 | PASS | A 两个历史 UI 各显示“最近 2 次”；PostgreSQL 对 A 各有 2 行。 |
| 13 | B 恢复 Target Score | FAIL | A 改成 600 并同步，B 的 HTTP pull 为 600；B 页面仍是 500，刷新后仍 500。 |
| 14 | B 恢复 XP / StudyStats | FAIL | A 云端已有 XP 和 5 条已完成会话；全新 B 的“我的”仍显示总 XP 0、学习天数 0；学习数据页时长、正确率、作答数均为 0。 |
| 15 | B 恢复 Wordbook / Review | FAIL | A 有 1 个收藏词和 5 道真实错题，B 生词本看不到该词，B“我的”相关计数为 0。 |
| 16 | B 翻译/写作历史 UI | FAIL | DB 各 2 行，B 两个历史 UI 都没有“最近 N 次”；pull 响应也没有两类 history 字段。 |
| 17 | B 离线进入词汇学习 | FAIL | B 在词汇首页切离线后点击“开始学习”，浏览器跳到 `chrome-error://chromewebdata/` 并显示 `ERR_INTERNET_DISCONNECTED`；无学习主页面。 |
| 18 | 离线完成→上线自动同步 | NOT VERIFIED | 离线时无法进入练习，无法产生真实离线完成事件。 |
| 19 | Sync Echo | PARTIAL | 全新 B pull 前队列为空；pull 写入云端 XP 缓存后待上传队列仍为 0。覆盖一次实际 pull，未覆盖多轮冲突/自动重试。 |
| 20 | 双设备离线 XP 不丢不重 | NOT VERIFIED | 离线学习被第 17 项阻断。 |
| 21 | Wordbook 双端 add/remove/stale/re-add | NOT VERIFIED | 单端 add 并上传已见；四阶段双端冲突未走完，不能判 PASS。 |
| 22 | Review v1→v2、stale v1、再 v3 | NOT VERIFIED | A 可产生并完成 5 题复习；双端版本冲突未执行。 |
| 23 | DailyPlan 双端真实 union | NOT VERIFIED | 未由 A/B 各完成不同任务；Round 8 的 merge 函数调用不能作为证据。 |
| 24 | Profile / Preferences LWW 冲突 | NOT VERIFIED | A 的 targetScore 到云端；B UI 恢复失败，无法再可靠判断偏好冲突。 |
| 25 | B→Guest→A 账号切换 | PARTIAL | 新 B 开始词汇会话后写入 B 专属存储；退出后的 Guest 进度为 0。切到 A 后未恢复 A 原有词汇进度，故完整切换失败。 |
| 26 | A pending queue 切到 B 的隔离 | NOT VERIFIED | 未在 A 离线产生 pending mutation，无法按要求证明队列归属。 |
| 27 | A/B/Guest 最终隔离 | PARTIAL | 本地 B/Guest 存储隔离已观察；A 数据在 B 的页面缺失，无法完成跨账号可见性全量验收。 |
| 28 | 手机 375/390/430px | PARTIAL | 24 组页面检查涵盖登录、注册、首页、我的、账号、词汇入口、真实翻译和写作输入；无横向溢出，导航贴视口底部。Migration Preview 不存在，软键盘遮挡未能真机验证。 |
| 29 | V4–V11 Browser Regression | PARTIAL | 五专项和 5 题手动复习均真实完成；每日总关卡未完成。阅读/听力新错题的原题回放曾失败，已局部修复并浏览器重测。 |
| 30 | 阅读/听力 Review 回放 | PASS | 修复 `rq:`/`lq:` 题号转换后，重新打开同一来源错题，显示原题、选项、正确答案和用户作答。 |
| 31 | 专项 Session 上传 | PARTIAL | 词汇新会话完成后队列出现 `session`，推送后 DB/pull 有记录；五专项都补了完成事件入队，其他四个模块没有逐一验证入队时机。 |
| 32 | A 复习结算刷新保留 | FAIL | A 真实完成 5 题，结算显示“已掌握 5”；重开错题本仍为“需加强 5”。浏览器本地 `cet-daily:v1:review` 被云端 hydrate 写成 `items` 数组且缺 `schemaVersion`，现有 ReviewStore 不能按此恢复。 |

统计：**PASS 7 / PARTIAL 7 / FAIL 7 / NOT VERIFIED 11，共 32 项**。FAIL 与未验证项保留原状，不因代码存在、数据库有行或辅助函数通过而升级。

## 已确认 Bug 与处理

| Bug | 预期与实际 | 根因 / 最小处理 | 回归证据 |
|---|---|---|---|
| 登录后首个词汇会话无法恢复 | 用户会话应写入账号区域；首次登录后曾写进 Guest 区域并显示“无法恢复”。 | Session 状态尚在 loading 时 Provider 已挂载 Guest 存储。AccountResetGate 等待认证结果后挂载。 | 新 User B 登录后立即开始词汇，卡片可见；仅 B 专属存储出现会话，Guest 无 B 会话。 |
| 专项 Session 未上云 | A 完成词汇后云端 XP/生词有值，但 session=0。 | 五专项 Provider 完成状态转换时补用现有 `enqueueSession`，仅首次 `applied` 入队。 | 新词汇组完成后队列出现 session，push 后云端 session=1；其他专项已通过类型/构建，仍需逐模块浏览器验证。 |
| 错题原题不可用 | 新阅读/听力错题复习页显示“原题内容已不可用”。 | 会话题号带 `rq:`/`lq:`，仓库内容题号无前缀。查找时去前缀，保留存档 ID。 | 新增回归测试；真实复习页重开显示原题、正确答案、用户答案。 |
| 复习结束 React 警告 | 结算时控制台提示在渲染中更新 Router。 | 页面 render 直接执行 `router.replace`；改在 effect 中结算与跳转。 | 同一账号再次完成 5 题，进入完成页；新日志无该警告。 |
| Guest 迁移、B 恢复、离线学习及复习刷新 | 迁移入口缺失；B 云端有数据但 UI 为空；离线点击进入错误页；A 复习结算后刷新退回需加强。 | 迁移读取旧数据结构；云端 hydrate 写入与现有 Provider 不一致的键/结构且未更新已挂载页面；离线路由缺资源。依文档“当前不要修改 Sync Engine/新增架构”约束，本轮只记录失败，不用局部 UI 假修复掩盖数据问题。 | Guest→A、A→B、B 离线、A 复习刷新均由真实浏览器重现；DB、HTTP、UI 三方对照。 |

## 自动检查与仓库状态

- 变更后：`npm test`、`npm run typecheck`、`npm run build`、`npm run content:validate`、`npm run content:stats`、`npx prisma validate`、`npx prisma migrate status` 通过。`npx prisma generate` 初次因运行中开发服务锁定 DLL 报 EPERM；暂时停止服务后重跑通过，服务已在 `http://127.0.0.1:3000` 重新启动。
- 标准 `npm run lint` 初次被本轮开始前已有的未跟踪 `.db-check.cjs` 的 `require()` 写法挡住；将该脚本及其他 Round 8 临时脚本/日志原样移至忽略目录 `output/round8-artifacts/` 后，标准 `npm run lint` 通过。
- Git 提交、推送与工作区状态以最终交付时的核对结果为准；代码入库不构成 V12 功能验收通过。

## 最终 12 问

| 问题 | 回答 |
|---|---|
| 1 Guest 是否完整可学并刷新保留？ | PARTIAL：词汇及生词保留，Review 和整日任务未验证。 |
| 2 Guest→Cloud 是否真实 E2E？ | NO：Preview 缺失。 |
| 3 Migration 是否幂等且 transaction-safe？ | NO：迁移未触发，无法验收。 |
| 4 Device A→B 是否恢复全部核心数据？ | NO：B 的目标、XP、历史和生词均未恢复。 |
| 5 Offline→Online 是否自动同步？ | NO：离线无法进入练习。 |
| 6 Dual-device XP 是否不丢不重？ | PARTIAL：单端 XP 上云；双端离线冲突未验证。 |
| 7 Wordbook tombstone/stale/re-add 是否正确？ | PARTIAL：单端添加见到，完整冲突未验证。 |
| 8 Review version conflict 是否正确？ | PARTIAL：单端复习可用，双端版本冲突未验证。 |
| 9 DailyPlan union 是否正确？ | PARTIAL：未走双端真实任务 union。 |
| 10 A/B/Guest 是否完全隔离？ | PARTIAL：本地 B/Guest 隔离；跨设备恢复失败。 |
| 11 Streak/StudyStats 是否真实跨设备恢复？ | NO：B 数据中心为 0。 |
| 12 V4–V11 是否真实浏览器无回归？ | PARTIAL：五专项与复习已走通；整日任务未完成。 |

## 结论

**V12 NEEDS FIX。** 当前不能宣称 V12 通过最终验收。按本轮范围不 merge main、不打 v12.0 tag、不创建 Release、不开始 V13。下一轮优先解决真实数据的 Guest 迁移、云端还原到现有学习 Store、翻译/写作历史拉取，以及离线进入学习页；随后重跑失败和未验证场景。
