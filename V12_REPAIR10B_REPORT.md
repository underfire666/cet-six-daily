# V12 Repair 10B：Offline Learning + Reconnect Sync

## 结论与 Git 基线

**REPAIR 10B PASSED**。已在线加载的专项页面可在真实 Chrome 断网后进入当前任务；离线完成写入现有本地仓库和账号专属待同步队列。恢复网络时，无需刷新或手动操作，即自动 push → pull → hydrate，核心浏览器场景和数据库核对均通过。听力音频离线重播与离线硬刷新页面为下述明确边界，不计作完整可用。

| 项目 | 值 |
| --- | --- |
| Branch | `feature/v12-cloud-sync` |
| Before HEAD | `ff83b53b8f177bb9515386b09b2cb4ce3bf62f50` |
| After HEAD（产品修复） | `55f818401540d05bdc25e189a372f0ecb90c8ca3` |
| 产品 commit | `fix: complete V12 offline learning and reconnect sync` |
| 数据库 | PostgreSQL `cet_six_v12_test` |

本报告单独提交，因此最终分支 SHA 会晚于产品修复 SHA；以交付后的 `git rev-parse HEAD` 核对值为准。未合并 main、打 tag、发布 Release，也未开始 Repair 10C 或 V13。

## Root Causes

1. 五专项首页使用 `router.push`/新路由进入 Session。即使首页与内容已加载，断网后新路由仍会请求 Next.js 页面数据，Chrome 转到 `chrome-error://chromewebdata/`。
2. 五专项完成后的本地学习成果已有 Store，但 Session 上云 mutation 不完整；每日计划只在整日完成时入队，单项任务完成没有同步对应 `completedTaskIds`。
3. 原后台同步没有把重连状态完整呈现给账号页，也缺少同账号并发 push 的去重和账号切换期间的请求归属保护。pull 期间发生的新本地修改还需要在 hydrate 前再次检查。

## Fixes / Modified Files

| 文件 | 作用 |
| --- | --- |
| `src/lib/offline/practice-route.ts`、`src/components/practice/useLocalPracticeRoute.ts` | 在已加载的专项页面内用浏览器 History API 切换 `?session=`/`?complete=`，并保留返回、前进和刷新后的 URL 状态；切换本身不发起新路由请求。 |
| `src/components/{vocabulary,reading,listening,translation,writing}/`、`src/components/vocabulary/VocabularyHeading.tsx`、`src/app/review/`、`src/components/AppShell.tsx` | 五专项和 Review 入口、学习页、完成页接入同页切换；完成时保留本地 Store，并将 Session mutation 加入队列；学习时隐藏底部导航。 |
| `src/lib/sync/client.ts`、`src/components/sync/SyncProvider.tsx` | 账号固定的队列读写、稳定 mutationId 重试、同账号 in-flight push 去重、在线重连状态事件，以及 push → pull → hydrate 顺序；push 失败或 pull 期间又有新 mutation 时不使用旧云端快照覆盖本地数据。 |
| `src/app/me/account/page.tsx` | 显示离线、待同步、同步中、已同步或失败，实时刷新账号专属队列；保留 Repair 10A.1 的手动同步生命周期。 |
| `src/components/dailyPlan/DailyPlanProvider.tsx` | 每个已完成任务入队；远端 hydrate 建立完成任务基线，避免回声，同时保留之后的新本地完成。 |
| `tests/offline-practice-route.test.ts`、`tests/v12-offline-sync.test.ts` | 同页路由、队列持久性、失败重试、并发去重、A/B 隔离、自动同步顺序与 DailyPlan 基线回归。 |

共 30 个产品与测试文件；没有 Prisma schema 或 migration 改动。

## Offline Architecture / Cache Boundary / Security Boundary

当前离线能力基于**已在线加载的页面和内容**、现有账号隔离的 LocalStorage 仓库，以及 LocalStorage 中的 pending mutation queue。内容仍从 V10 Content Repository 的已加载 Mock 内容取得；离线完成先写本地，再等待重连上传。没有引入 Service Worker、PWA 框架或第二套用户数据存储。

可用边界是 **A：已加载模块内的 SPA 导航**。已加载的五专项均可在断网后打开准备好的 Session。**B：离线硬刷新页面**没有缓存支持，真实 Chrome 返回 `ERR_INTERNET_DISCONNECTED`；这不是本轮的 PASS。失败刷新后浏览器存储快照仍见 1 条待同步记录，联网后原 Session/生词本可恢复；测试中一条对 localhost 的在途 push 先于“重新联网”检查点到达数据库，因此不能把该次实验写成严格的“服务器直到恢复联网才收到 mutation”。

听力页面及题目离线可打开。登录账号主 E2E 中，音频在线预载且播放成功，但断网重播没有推进播放位置，记为 **PARTIAL**；一次独立访客测试在完整加载音频后可离线重播，只能证明浏览器缓冲可能奏效，不能保证每次可用。未加载过的模块或资源也不保证离线进入。

没有缓存 `/api/auth/*`、`/api/sync/*`、个人 Profile、认证响应、Cookie 或写请求。用户数据仍以 Existing Scoped Local Repository + account-scoped queue 为本地来源。A 的 mutation 不会以 B 的身份发送；重新登录 A 后才能恢复上传。

## Automated Regression

| 检查 | 结果 |
| --- | --- |
| 本地路由、Session URL 和生词本入口 | **PASS**：新增 4 项路由测试；五专项真实浏览器入口复测。 |
| 离线入队、稳定 ID、失败后保留与重试、账号作用域 | **PASS**：新增队列测试覆盖 A/B 切换、失败尝试、原 ID 重试。 |
| 重连顺序、最终 `synced`、并发 push、pull 期间新 mutation | **PASS**：新增同步测试；在 hydrate 前有新 mutation 时先重试 push。 |
| 本地 Session、XP、生词本、Review、翻译和写作存储 | **PASS**：现有领域存储/幂等回归 + 本轮真实断网完成；登录后 PostgreSQL 和 Device B 恢复核对。 |
| DailyPlan 部分完成、completed-wins、remote hydrate 无 echo | **PASS**：新增基线测试、既有合并测试、浏览器阅读任务完成及无回声观察。 |
| `npm test` | **PASS**，370/370。 |
| `npm run typecheck` / `npm run lint` / `npm run build` | **PASS**。 |
| `npm run content:validate` / `content:stats` | **PASS**，0 错误、0 警告；59 条内容。 |
| `npx prisma validate` / `generate` / `migrate status` | **PASS**，2 个既有 migration，测试库最新。 |

## Real Browser Evidence

真实 Chrome + Playwright 使用 `context.setOffline(true/false)`、真实 Next.js HTTP 和新建一次性账号。主运行结果 **49 PASS、2 PARTIAL、0 FAIL**。本地证据：`output/playwright/repair10b-2026-09-26T01-26-46-007Z-49df2369.json`；独立账号隔离 8/8 PASS：`output/playwright/v12r10b-account-isolation.json`。这些浏览器原始文件位于被忽略的 `output/playwright/`，未提交到仓库。

| 浏览器场景 | 结果 | 证据要点 |
| --- | --- | --- |
| Offline Vocab | **PASS** | 断网进入真实题目并完成一组；本地 XP 0→10、Session、队列立即存在。 |
| Offline Wordbook | **PASS** | 断网收藏，生词本立即显示；重连入库，Device B pull 后可见。 |
| Offline Review | **PASS** | 离线按原题复习；本地 version 1→2、reviewCount 1→2；重连后云端及 Device B 均为 v2。 |
| Offline Translation | **PASS** | 断网提交并立即出现本地 history；重连后云端 1 条、Device B 可见。 |
| Offline Writing | **PASS** | 同上，云端 1 条、Device B 可见。 |
| Offline DailyPlan | **PASS** | 阅读 1 篇完成今日阅读任务，云端 `completedTaskIds` 含 `2026-09-26:reading`；pull 后未回退。整日计划仍为 `in_progress`，没有声称浏览器完成了全天计划。 |
| Reconnect Auto Sync | **PASS** | 五个离线完成场景均无 F5/手动同步，自动 push 200 → pull 200，队列归零，账号页“已同步”。 |
| Reconnect Idempotency | **PASS** | PostgreSQL XP/Session/历史记录无重复；hydrate 后等待 3 秒无额外 push。 |
| Pending Queue Persistence | **PASS**（数据）/ **PARTIAL**（硬刷新页面） | 队列写入 LocalStorage，失败硬刷新后存储快照仍有 1 条；离线页面本身无法重新加载。 |
| Account Queue Isolation | **PASS** | A 1 条 pending、B 队列和云端均 0；回 A 后上传归 A。独立脚本在恢复网络后拦截正常 push，确保测试切换期间 A 队列仍在。 |
| Five-module Offline Smoke | **PASS**（页面）/ **PARTIAL**（音频） | 词汇、阅读、听力、翻译、写作的已准备 Session 页面均能进入；听力文本/题目可用，离线音频重播不稳定。 |

## HTTP Evidence / PostgreSQL Evidence

主浏览器运行记录 `POST /api/sync/push` **200 ×7**、`GET /api/sync/pull` **200 ×24**；没有观察到 401 或 500。浏览器有 23 次断网引起的预期 `ERR_INTERNET_DISCONNECTED`，以及 2 次测试刻意阻断 push 的 `ERR_FAILED`；**0 个未捕获 pageerror、0 个 React warning**。断网期间的资源失败与应用页面进入/完成结果分开判定。

主测试 A 在 `cet_six_v12_test`：XP Event **5/5 唯一、合计 59 XP**；LearningSession **5/5 唯一**；Wordbook **2/2**；ReviewItem **1/1**，version 2、reviewCount 2；TranslationHistory **1/1**、WritingHistory **1/1**；SyncMutation **18/18 唯一**。DailyPlan 远端保留阅读完成任务。Device B 经正常 pull/hydrate 恢复 XP 59、生词本、Review v2 和两类历史。

## 最终问题

| # | 回答 |
| --- | --- |
| 1 | **是**，已加载模块内可真实断网进入学习。 |
| 2 | **是**，Offline Vocab 完成。 |
| 3 | **是**，XP 立即本地增加。 |
| 4 | **是**，Session 立即本地存在。 |
| 5 | **是**，pending queue 写入持久存储；离线硬刷新页面本身不可用。 |
| 6 | **是**，重连无需 F5 自动 push。 |
| 7 | **是**，自动 pull/hydrate。 |
| 8 | **是**，测试账号云端 XP/Session 唯一。 |
| 9 | **是**，Wordbook 上云并在 Device B 恢复。 |
| 10 | **是**，Review v2 没有被旧远端状态覆盖。 |
| 11 | **是**，翻译/写作离线完成并上云。 |
| 12 | **是**，阅读任务的 DailyPlan progress 未回退；整日 completed-wins 由自动测试覆盖。 |
| 13 | **是**，A pending mutation 未由 B 上传；独立账号切换 8/8 PASS。 |
| 14 | **是**，remote hydrate 后队列 0，3 秒内无回声 push。 |
| 15 | **是**，五专项已准备任务的离线页面可进入；听力音频离线重播为 PARTIAL。 |

## Git Final State

产品修复已提交至 `55f818401540d05bdc25e189a372f0ecb90c8ca3`。本报告作为后续文档提交交付；最终已推送的分支 SHA、`Local HEAD == Remote HEAD` 和工作区 clean 状态以交付后的实际 Git 核对为准。

本结论仅为 **Repair 10B**。真正的双设备冲突矩阵与 V12 最终验收属于后续工作。
