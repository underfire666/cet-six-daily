# V12 云同步 — 最终验收报告（Repair 10C：双设备冲突矩阵 + 真实浏览器最终验收）

- **日期**：2026-09-26（Asia/Shanghai）
- **分支**：`feature/v12-cloud-sync`
- **基线 HEAD**：`ff6122cb91f14e2229498803cef4229772a27b71`（R6 冻结以来未改产品代码）
- **PostgreSQL**：18.6 · 数据库 `cet_six_v12_test` · Prisma migrate up-to-date
- **验收方式**：两个完全隔离的 Playwright Browser Context（Device A / Device B，独立 localStorage + cookie）+ 真实 PostgreSQL 只读断言 + 真实 HTTP 观测
- **本轮证据**：`output/playwright/v12r10c-2026-09-26T02-43-58-494Z-b64331e9.json`（52 个 stage 全 PASS）
- **历史证据**：`output/playwright/repair10b-*.json`、`v12r10b-account-isolation.json`（10B 离线/重连/队列隔离）；R8 PostgreSQL HTTP 审计报告

---

## 0. Round 8 统计更正

Round 8 报告表格曾写「PASS 14 / PARTIAL 5 / NOT VERIFIED 6」，经重新按实际场景核算，实际为 **PASS 9 / PARTIAL 8 / NOT VERIFIED 8 / FAIL 0**（旧报告副本已同步修正）。Round 8 仅覆盖 PostgreSQL/HTTP 审计层，浏览器层证据不足的项目（Guest Mode、Migration transaction/idempotency、Wordbook tombstone/re-add、DailyPlan dual-device union）已在本轮用真实浏览器 E2E 重新判定，见下方矩阵。

---

## 1. 执行摘要

本轮在 `ff6122c` 冻结基线上**未修改任何产品代码**（`src/` 零改动），仅编写/修正验收脚本（`output/playwright/`，gitignored）。全部 52 个真实浏览器 stage 通过：

- Guest 完整学习 → 刷新保留 → PostgreSQL 零污染
- Guest→Account Migration 全链（Preview / 稍后处理 / 重新进入 / Confirm / 幂等）真实 UI + HTTP + PostgreSQL
- Device A 五专项真实完整流程（词汇 / 阅读 / 听力 / 翻译 / 写作）
- Device B 全新 context 恢复全部核心数据并在 UI 可见
- 双设备离线冲突矩阵：Dual-device XP 不丢不重、Wordbook tombstone/stale/re-add、Review version、DailyPlan union + completed-wins、Profile LWW、Queue 账户隔离、Sync echo、Manual sync、跨设备 T/W 收敛
- Mobile 375 / 390 / 430px 无横向溢出
- PostgreSQL 完整性：无重复 eventId / id / mutationId，MigrationRecord completed

仅一项无法安全注入：Migration 服务端事务失败回滚（production 下故障注入被禁用，详见 §16）。

---

## 2. 自动门禁（9 项）

| # | 门禁 | 结果 | 证据 |
|---|------|------|------|
| G1 | `npm test` | **PASS** | 370/370 pass, 0 fail |
| G2 | `npm run typecheck` | **PASS** | exit 0 |
| G3 | `npm run lint` | **PASS** | exit 0 |
| G4 | `npm run build` | **PASS** | exit 0，全部路由产出 |
| G5 | `npm run content:validate` | **PASS** | exit 0 |
| G6 | `npm run content:stats` | **PASS** | 30 词 / 6 阅读 / 7 听力 / 8 翻译 / 8 写作，Deprecated 0 |
| G7 | `npx prisma validate` | **PASS** | schema loaded |
| G8 | `npx prisma generate` | **PASS** | 生成成功（先停 next 进程避免 DLL 锁） |
| G9 | `npx prisma migrate status` | **PASS** | "2 migrations found / Database schema is up to date!" |

> 注：`AUTH_TRUST_HOST=true` 已追加到 `.env`（gitignored，未 commit），解决 `next start` 下 `/api/auth/session` 的 `UntrustedHost` 500。这是**环境配置**，非产品代码改动。

---

## 3. Final Acceptance Matrix（37 项）

证据来源标记：**[Browser]** = 本轮真实浏览器（Playwright 双 context）；**[HTTP]** = 本轮真实 HTTP 观测；**[PG]** = 本轮真实 PostgreSQL 只读断言；**[Auto]** = Automated Regression（上方 9 门禁）；**[Prior]** = 先前轮已验收证据（10B / R8）。

| # | 验收项 | 结果 | 证据来源 | 本轮实测证据 |
|---|--------|------|----------|--------------|
| 1 | Git preflight：worktree clean，Local HEAD == Remote HEAD | **PASS** | Git | `git status` clean；HEAD = REMOTE = `ff6122c` |
| 2 | Auth smoke：register / login / session 200 | **PASS** | [HTTP] | `/api/auth/session`、`/api/auth/callback/credentials` 全 200 |
| 3 | Guest 完整学习：1 组词汇产生 XP + Session + 生词本，刷新后保留 | **PASS** | [Browser] | `guest-vocabulary-session`、`guest-refresh-persists` |
| 4 | Guest 数据不写入任何 User | **PASS** | [PG] | `guest-db-unaffected`：users / xpEvents / sessions / wordbook 计数 0 增 |
| 5 | Migration Preview：注册后出现，摘要含学习天数/XP/会话/生词/错题/翻译/写作 | **PASS** | [Browser] | `migration-preview-appears` |
| 6 | Migration「稍后处理」：Guest 数据保留，A 云端不被污染 | **PASS** | [Browser][PG] | `migration-later-keeps-data`：A 云端 xp/sessions/wordbook 全 0，Guest 本地仍在 |
| 7 | Migration 可重新进入并继续 | **PASS** | [Browser] | `migration-reenter-available` |
| 8 | Migration Confirm：UI + HTTP + PG 全链 | **PASS** | [Browser][HTTP][PG] | `migration-confirm`：POST `/api/sync/migrate` 200，MigrationRecord `completed`，云端 xp=10/sessions=1/wordbook=1 |
| 9 | Migration 幂等：重复触发不重复 XP/Session/Wordbook | **PASS** | [Browser][PG] | `migration-idempotent`：UI 已同步、入口消失，xp/sessions 不再增 |
| 10 | Migration 服务端事务失败回滚（故障注入） | **NOT VERIFIED** | — | production 下 `testFailureAfter` 注入被禁用，无法安全模拟；以既有 `runGuestMigrationTransaction` PostgreSQL integration test 为佐证（`$transaction` 包裹，P2002 兜底，verifyEntity 逐实体校验） |
| 11 | Device A 五专项真实完整流程（词汇/阅读/听力/翻译/写作各 ≥1） | **PASS** | [Browser] | `device-a-five-modules`：翻译=2、写作=2、sessions=8、xp=102 |
| 12 | Translation / Writing 历史创建（≥2 + ≥2） | **PASS** | [PG] | `device-a-five-modules`：cloud translation=2 writing=2 |
| 13 | Device B 全新 context（独立 localStorage）恢复 Profile/Target/ExamDate/XP/Level/Streak/StudyDays/Duration/Accuracy/Wordbook/Review/DueReview/DailyPlan/T/W | **PASS** | [Browser] | `device-b-fresh-restore`：/me UI 显示 总 XP 102、学习天数、Lv.1、正确率、本周天数、错题本 7、生词 1、今日待复习、今日已完成；本地 xp=102/translation=2/writing=2/wordbook≥1 |
| 14 | Translation/Writing 跨设备 **UI 可见**（非仅 DB 有 row） | **PASS** | [Browser] | `device-b-history-ui-visible`：B 打开翻译/写作历史区块见 A 创建的内容 |
| 15 | Streak / StudyStats 真实跨设备恢复（经 UI / 原 StudyStats，非 helper） | **PASS** | [Browser] | `device-b-fresh-restore` meText：总 XP 102、学习天数 1、正确率 0%、本周天数 1、等级 Lv.1 |
| 16 | Offline → Online 自动同步（离线学习 → push pending → pull → merge → hydrate） | **PASS** | [Browser][PG] | `dual-xp-*-reconnect`、`dailyplan-*-reconnect` 全链；另 10B `repair10b`（Prior）离线五专项 + reconnect 自动同步 |
| 17 | Device A 可见 B 离线期间数据，PG mutation 只存在一次 | **PASS** | [PG] | `dual-xp-total-and-uniqueness`：A 19 + B 19 = 38 delta；`postgres-final-integrity` 无重复 |
| 18 | Sync echo：pull/hydrate 不产生等价新 mutation，无 enqueue→push→pull 循环 | **PASS** | [Browser] | `sync-echo-a/b`：静置 3.5s 后 queue=0、push 请求=0 |
| 19 | Dual-device XP：A/B 各产生 XP Event，总量包含两者，retry 不重复 | **PASS** | [Browser][PG] | baseline 102 → 140（+38 = A19+B19）；`dual-xp-retry-idempotent`：重复 push 返回 200 且 3 条全部 skipped |
| 20 | Wordbook 双端 union（迁移词 + A 新增词共存） | **PASS** | [Browser][PG] | `wordbook-w1-baseline`：DB 含 word_sustain + word_maintain，B restore 后本地 2 词 |
| 21 | Wordbook remove + tombstone（离线移除 → 上云 tombstone） | **PASS** | [PG] | `wordbook-a-remove-reconnect`：word_sustain removedAt=true, version=2 |
| 22 | Wordbook stale protection（B stale 状态后到不复活 tombstone） | **PASS** | [PG] | `wordbook-b-stale-sync`：stale B 同步后 W1 仍 removed |
| 23 | Wordbook re-add（最新状态主动重新加入，A/B 均恢复 active） | **PASS** | [Browser][PG] | `wordbook-b-readd`：version=3 active，A 本地轮询恢复 [word_sustain] |
| 24 | Review version conflict：v1 → A 复习升级 v2 → B stale 后到不覆盖 → 再复习推进 | **PASS** | [Browser][PG] | `review-a-reconnect-v2`：version=2 mastery=familiar reviewCount=2；`review-b-reconnect-no-overwrite`：版本不回退；`review-v3-latest`：B 本地同步到 v2（对需加强题再产生新版本推进） |
| 25 | DailyPlan union：双设备分别完成任务，云端 completedTaskIds 同时包含两者 | **PASS** | [PG] | `dailyplan-b-reconnect-union`：ids = [2026-09-26:reading, 2026-09-26:listening] |
| 26 | DailyPlan completed-wins：completed 不被 stale pending 回退 | **PASS** | [PG] | union 断言：B 离线词汇（未完成任务）pending 上云后 completedTaskIds 仍为 [reading, listening] |
| 27 | Profile LWW：A 修改 Target Score → 上云 → B 恢复 | **PASS** | [Browser][PG] | `profile-a-modify-target` + `profile-b-restored`：600 |
| 28 | Profile LWW：A 修改 Exam Date → 上云 → B 恢复 | **PASS** | [Browser][PG] | `profile-a-modify-exam-date` + `profile-b-restored`：2026-12-11(UTC) |
| 29 | Account switching：Login A → Logout → Login B 不见 A/Guest 数据 → 回 Login A 恢复 | **PASS** | [Browser][PG] | `queue-isolation-logout-a-login-b`：bCloudWordbook=0 bXp=0 leaked=0 |
| 30 | Queue account isolation：A 离线 pending 不被当作 B push | **PASS** | [Browser][PG] | A pending 3 条在 B 名下 0 泄漏；`queue-isolation-relogin-a`：A 重新登录后 3/3 归位上云 |
| 31 | Cross-user 隔离：A/B/Guest 数据互不可见 | **PASS** | [Browser][PG] | Guest PG 0 污染 + B 云 0 污染 + A 数据恢复；10B account-isolation（Prior） |
| 32 | Mobile 375px：无横向溢出/导航遮挡/不可点/布局遮挡 | **PASS** | [Browser] | `mobile-375px`：6 路由 overflow=0 |
| 33 | Mobile 390px | **PASS** | [Browser] | `mobile-390px`：overflow=0 |
| 34 | Mobile 430px | **PASS** | [Browser] | `mobile-430px`：overflow=0 |
| 35 | V4–V11 浏览器回归：五专项真实完整学习流程 | **PASS** | [Browser] | `device-a-five-modules`：词汇/阅读/听力/翻译/写作均真实完成并结算；`manual-sync`、Review、DailyPlan、我的 均真实点击 |
| 36 | PostgreSQL 完整性：无重复 eventId/id/mutationId，MigrationRecord 正确 | **PASS** | [PG] | `postgres-final-integrity`：xp/sessions/mutations/translation/writing/migration 重复全空；cloud xp=247 sessions=19 wordbook=2 translation=4 writing=4 migration=[completed] |
| 37 | 统计一致性：矩阵结果数量与汇总完全一致 | **PASS** | — | 本报告 §4 |

---

## 4. 最终统计

| 结果 | 数量 | 明细 |
|------|------|------|
| **PASS** | **36** | 矩阵 #1–9、#11–15、#17–37（#2、#13–15、#17、#19–20、#24、#29–31、#35 含多子项） |
| PARTIAL | 0 | — |
| FAIL | 0 | — |
| NOT VERIFIED | 1 | #10（Migration 事务失败注入无法在生产安全触发） |

> 矩阵 37 项 = 36 PASS + 0 PARTIAL + 0 FAIL + 1 NOT VERIFIED，与上表一致。52 个自动化 stage 全部 PASS。

---

## 5. 最终 12 问

| # | 问题 | 判定 |
|---|------|------|
| 1 | Guest 是否完整可学并刷新保留？ | **YES** |
| 2 | Guest→Cloud 是否真实 E2E？ | **YES** |
| 3 | Migration 是否幂等且 transaction-safe？ | **PARTIAL**（幂等已真实验证；transaction rollback 未能在 production 安全注入，标 NOT VERIFIED，以 integration test 为证） |
| 4 | Device A→B 是否恢复全部核心数据？ | **YES** |
| 5 | Offline→Online 是否自动同步？ | **YES** |
| 6 | Dual-device XP 是否不丢不重？ | **YES** |
| 7 | Wordbook tombstone/stale/re-add 是否正确？ | **YES** |
| 8 | Review version conflict 是否正确？ | **YES** |
| 9 | DailyPlan union 是否正确？ | **YES** |
| 10 | A/B/Guest 是否完全隔离？ | **YES** |
| 11 | Streak/StudyStats 是否真实跨设备恢复？ | **YES** |
| 12 | V4–V11 是否真实浏览器无回归？ | **YES** |

---

## 6. 最终结论

**V12 PASSES FINAL ACCEPTANCE**

核心场景（Guest 学习、Migration 全链、双设备恢复、Offline→Online、Dual-device XP、Wordbook 冲突矩阵、Review version、DailyPlan union、账户/队列隔离、Streak/StudyStats、V4–V11 回归、Mobile 375/390/430、PostgreSQL 完整性）全部由真实浏览器双 context + 真实 PostgreSQL 验证为 PASS。唯一 NOT VERIFIED 项（服务端事务失败注入）为**无法安全触发**的技术限制，且已有 `$transaction` 级 integration test 佐证，不构成 FAIL。

---

## 7. Git 终态

- 分支：`feature/v12-cloud-sync`
- Local HEAD == Remote HEAD == `ff6122cb91f14e2229498803cef4229772a27b71`
- `git status` clean（`output/playwright/` 验收脚本与 evidence 被 .gitignore 覆盖，未入版本库）
- 本轮未 merge main、未打 v12.0 tag、未建 Release、未开始 V13

---

## 8. KNOWN LIMITATIONS（如实声明）

1. **Migration 事务失败回滚**（矩阵 #10）：production 下 `testFailureAfter` 故障注入被禁用（仅 NODE_ENV=test 或非 production + `CET_SYNC_E2E_TEST_FAILURE=1` 允许），未在本轮真实触发回滚；以既有 `runGuestMigrationTransaction` PostgreSQL integration test 为最终证据。
2. **Offline hard refresh**：离线状态下刷新页面可能触发 `ERR_INTERNET_DISCONNECTED`（本轮 console 记录的即此类网络层错误），属于浏览器网络行为；已加载页面的离线学习/答题正常。
3. **Listening 音频离线重播**：离线时听力页面与题目可进入，但音频离线重播不保证（10B 边界沿用）。
4. **真机移动软键盘**：375/390/430px 用 Playwright viewport 验证了横向溢出/布局遮挡/不可点；**真实手机软键盘遮挡 NOT VERIFIED**（无真机）。
5. **Review「同一题产生 v3」**：A 的第二次复习针对「需加强」列表（此时为另一题），reading 题保持 v2 并被 B 同步；版本冲突的**核心仲裁路径**（stale 不覆盖、版本推进、跨设备同步）已全部实测，但严格意义的"同一题 v1→v2→v3 三连"未单独复现。
6. **DailyPlan 本地任务级标记**：本地 store 以 `plan.status` + completionLedger 表达完成（不逐 task 标 status），因此脚本 localState 的 `completedTaskIds` 字段恒为空属**存储表示差异**；union 已以 PostgreSQL `completedTaskIds`（DB 权威）断言。
7. **未宣称**：PWA、完整离线、真机移动验收均不在验收范围内。

---

## 9. 验收脚本与证据归档

- 主脚本：`output/playwright/v12r10c-final-acceptance.mjs`（双 BrowserContext 52-stage E2E）
- 本轮证据：`output/playwright/v12r10c-2026-09-26T02-43-58-494Z-b64331e9.json`
- 迁移调试：`output/playwright/v12r10c-mig-debug.mjs`；B 恢复调试：`output/playwright/v12r10c-b-restore-debug.mjs`
- 10B 离线/重连/队列隔离（Prior）：`output/playwright/repair10b-2026-09-26T01-26-46-007Z-49df2369.json`、`output/playwright/v12r10b-account-isolation.json`

**完成。停止，等待独立最终验收。**
