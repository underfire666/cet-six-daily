# V12 Repair 10A：真实浏览器专项验证

## 结论与范围

**REPAIR 10A BROWSER VERIFICATION FAILED**

指定的 14 项云端迁移与恢复检查均通过，但额外发现一处可复现的账号同步界面缺陷：待同步队列为空时，点击“立即同步”后，请求已成功、上次同步时间已更新，界面却持续显示“正在同步…”，按钮保持禁用。按本轮“发现真实 Bug 后记录并停止”的要求，本报告只记录现象和原因，不修改产品代码。

本轮只验证 Repair 10A 的真实浏览器行为；没有开展 Offline、完整双设备冲突、Repair 10B、V13、合并、打标或发布。没有把自动化单元／集成测试结果当作浏览器通过证据。

| 环境 | 实际值 |
| --- | --- |
| Branch / HEAD | `feature/v12-cloud-sync` / `d940e71f82e3701644d502d2862035e93ee6e26f` |
| 数据库 | PostgreSQL 18.6，`cet_six_v12_test`；Prisma migration 状态为已应用，其中包括 `20260924120000_repair10a_review_payload` |
| 应用 | Next.js 16.3.5，本地真实 Next.js 应用及 HTTP API |
| 浏览器 | Chrome / Playwright；Device A 与 Device B 为两个独立的内存浏览器上下文；没有复制 cookie、localStorage 或 sessionStorage，也没有手工设置存储来伪造恢复 |
| 测试账号 | 本轮新注册的 disposable User A `repair10a-a-20260924-1732@example.test`、User B `repair10a-b-20260924-1732@example.test`；另有独立 Guest 状态。报告不包含密码 |

## 逐项结果

| # | 验证项 | 结果 | Browser Evidence | HTTP Evidence | PostgreSQL Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Guest Preview | **PASS** | Guest 通过真实词汇练习完成 5 题，获得 10 XP、1 次学习记录，收藏 `sustain`；注册 A 后账号页真实显示迁移预览：学习天数 1、XP 10、完成记录 1、生词 1、错题 0。后续回到原 `127.0.0.1` 来源仍见 Guest XP 10 与原生词数据。 | 注册请求 `POST /api/auth/register` 为 201、认证回调为 200；预览来自真实账号页流程。 | 预览前 A 的 XP event、session、wordbook、MigrationRecord 均为 0。**限制：注册前未单独执行所要求的 Guest 刷新；后续重新加载原来源确认了 Guest 本地数据仍在。** |
| 2 | Migration Later | **PASS** | 点击“稍后处理”后重新进入账号页，预览仍显示 XP 10、完成记录 1、生词 1；Guest 原始数据仍可见。 | 本次操作没有发出 `POST /api/sync/migrate`。 | A 的 XP event、session、wordbook、MigrationRecord 仍均为 0；没有 completed 迁移。 |
| 3 | Migration Confirm | **PASS** | 点击“合并到我的账号”，界面显示已同步；Guest 原始数据后续仍保留。 | `POST /api/sync/migrate` 200，随后 `GET /api/sync/pull` 200。 | A 新增 XP event 1 条、XP 10、完成 session 1 条、活动生词 1 条；MigrationRecord 1 条，状态 `completed`、`verified=true`，ID `9d9333d1-8125-4089-ad75-4c18a7b6e744`。 |
| 4 | Migration Idempotency | **PASS** | 通过正常退出、重新登录并重进账号页，没有再次出现相同 Guest 数据的合并入口。 | 后续正常登录和 pull 成功；未观察到第二次同数据迁移请求。 | MigrationRecord 始终 1 条；原始迁移的 1 条 XP event、1 条 session、1 条生词没有重复。后续总量增长来自真实新增练习。 |
| 5 | A→B Profile | **PASS** | A 在设置页把目标分改为 600。全新 Device B 首次登录 A 后，无需 F5、关闭浏览器或二次登录，“我的”直接显示目标分 600。 | Device B 首次 `GET /api/sync/pull` 200，响应中 `targetScore=600`。 | A 的 profile `targetScore=600`。 |
| 6 | A→B XP / StudyStats | **PASS** | Device B 首次恢复后，“我的”显示学习天数 1、XP 141、正确率 73%；学习数据页显示时长 23 分钟、答题数 15。 | 同一次 pull 包含 10 条 XP event、12 条 session，均为已完成。 | Device B 登录前 A 有 XP event 10 条、合计 XP 141、完成 session 12 条；数值与既有统计计算相符。后续额外真实复习使总量增加，非恢复回声。 |
| 7 | A→B Wordbook | **PASS** | Device B 打开现有生词本页面，实际看到 A 收藏的 `sustain` 及释义、发音。 | 首次 pull 响应含 1 条 wordbook 记录。 | A 有活动生词 1 条。 |
| 8 | A→B Review | **PASS** | A 通过真实阅读答题和重测产生 `reading:r-sleep-study:rq:q1`；Device B 错题页实际显示该条，打开后可重做原题 “What is the main idea of the passage?”，选项和解析可见。 | 首次 pull 响应含 1 条 review item，含原题重放所需数据。 | A 有 ReviewItem 1 条；Device B 首次恢复前状态 `mastered`、版本 5，结构可读取。 |
| 9 | Review Refresh | **PASS** | A 完成三组真实复习，使条目达到领域规则的掌握状态；页面显示“已掌握 1 / 需加强 0”。刷新并重新进入错题页后仍为“已掌握”，退出再登录仍保持。首组完成页的“已掌握 1”是本组答题结果，领域掌握需连续答对三次，不将两者混淆。 | 复习后的同步与重新登录 pull 成功。 | 刷新前本地领域记录 `masteryStatus=mastered`、`correctStreak=3`、`reviewCount=4`、版本 5，数据库 ReviewItem 同为 mastered／版本 5；后续 Device B 真实重做后版本 6，仍为 mastered。[完成页截图](output/playwright/repair10a-review-complete.png)、[刷新前掌握状态截图](output/playwright/repair10a-review-mastered-before-refresh.png)。 |
| 10 | Translation Restore | **PASS** | A 通过 UI 完成两次翻译；Device B 翻译页显示“最近 2 次”，分数 13／15 与 6／15。 | Device B 首次 pull 响应 `translationHistory` 为 2 条。 | A 有 2 条翻译历史，对应真实 session `aafe250c-538b-41a3-b531-b62fbcb3cf92`、`21d9c741-b96c-4de6-bcaa-dda9a00e0121`。 |
| 11 | Writing Restore | **PASS** | A 通过 UI 完成两次写作；Device B 写作页显示“最近 2 次”，分别为 171 词／9 分及 114 词／12 分。 | Device B 首次 pull 响应 `writingHistory` 为 2 条。 | A 有 2 条写作历史，对应真实 session `a60dc8a0-8ce5-47c0-8fcd-fd2babf8d7c5`、`3da00b04-91f2-4c6f-ab7c-6c1d83026031`。 |
| 12 | Same-tab Rehydrate | **PASS** | Device B 在首次登录后的同一页面生命周期中看到 Profile、Stats、Wordbook、Review、Translation、Writing；过程中没有 F5、浏览器重启或第二次登录。[Device B 页面截图](output/playwright/repair10a-device-b-me.png)。 | 首次登录回调 200，紧随的 pull 200；响应含上述数据。 | 首次登录前 A 已有目标分 600、XP 141、完成 session 12、生词 1、Review 1、翻译 2、写作 2。 |
| 13 | Sync Echo | **PASS** | Device B 登录前无 A 的本地存储或待发送队列；pull→hydrate 后待发送数仍为 0，mutation types 为 `[]`。 | 初次恢复期间有成功的 GET pull，没有 `POST /api/sync/push`。 | 初次恢复时间段没有对应的 SyncMutation；后来的 3 条 reviewItem／session／xpEvent mutation 属于 Device B **主动完成**的一次复习，非恢复回声。 |
| 14 | A / Guest / B Isolation | **PASS** | Device B 退出 A 后，Guest 显示默认目标分 500、XP 0、生词／错题 0，翻译／写作无近期历史；新注册 User B 也如此。再登录 A，目标分 600、XP 143、生词 1、错题 1、已掌握状态及历史恢复。 | B 注册与 A 重登录的认证请求成功，A pull 成功。 | B 的 XP event、session、wordbook、review、翻译、写作及 migration 均为 0，目标分未设置；A 最终 XP 143、完成 session 13、Review mastered／版本 6、翻译 2、写作 2、MigrationRecord 1。比先前基线多出的 XP 2 和 session 1 来自 Device B 主动重做。 |
| 15 | 空队列手动同步状态（额外发现） | **FAIL** | A 账号页待发送数为 0 时点击“立即同步”；等候 3 秒后仍显示“正在同步…”，按钮为禁用“同步中…”，但“上次同步”已更新。[复现截图](output/playwright/repair10a-empty-queue-sync-stuck.png)。 | 对应 `GET /api/sync/pull` 返回 200，没有 5xx；该状态不应在请求完成后继续占用界面。 | A 的云端数据保持有效；这是一处状态更新缺陷，而非数据丢失。 |

**统计（15 项）：PASS 14 / PARTIAL 0 / FAIL 1 / NOT VERIFIED 0。**

## 额外 FAIL 的原因

`src/app/me/account/page.tsx` 的 `onSync()` 先将状态设为 `syncing`，完成 `pushQueue()`、`pullRemote()` 和待发送数刷新后，没有将状态改回 `synced`。`src/lib/sync/client.ts` 的 `pushQueue()` 在队列为空时直接返回，也不会调用状态回调。两者叠加，使空队列手动同步即使 pull 成功仍永久显示“同步中…”。本轮没有修改代码，留待用户决定是否开展 Repair 10A.1。

## 控制台、网络与验证边界

- 两个浏览器上下文最后检查的控制台错误与警告均为 0；只见正常开发环境提示。相关登录／同步过程中未发现 500、401 循环、hydration warning 或未捕获异常。正常认证跳转请求未判作故障。
- Guest 登出后认证流程跳转到 `localhost:3000`，与测试使用的 `127.0.0.1:3000` 属于不同浏览器存储来源；在 `localhost` 初见 Guest XP 0，返回原 `127.0.0.1` 来源后 Guest XP 10 和原生词数据仍在。因此不能把不同来源的本地存储隔离误判为 Guest 数据删除。
- 本报告的截图及只读数据库核对脚本位于被忽略的 `output/playwright/`，可在本地查看；不把这些辅助文件当作产品代码或提交产物。Guest 注册前的单独刷新动作没有执行，已在第 1 项如实注明；后续返回原来源并重新加载提供了持久性证据。

## 13 个最终问题

| # | 问题 | 回答 |
| --- | --- | --- |
| 1 | Guest Migration Preview 是否真实出现？ | **YES**：账号页出现 XP 10、完成记录 1、生词 1 的真实预览。 |
| 2 | “稍后处理”是否不写 Cloud？ | **YES**：无 migrate POST；数据库保持 0，预览可再次出现。 |
| 3 | Confirm 是否真实写 PostgreSQL？ | **YES**：migrate 200；XP、session、生词和 completed MigrationRecord 入库。 |
| 4 | Migration 是否无重复？ | **YES**：再次进入账号页无重复迁移，MigrationRecord 始终 1 条。 |
| 5 | Device B 是否无需 F5 恢复 targetScore=600？ | **YES**。 |
| 6 | XP／StudyStats 是否恢复？ | **YES**：首次恢复 XP 141、学习天数 1、完成 session 12，页面统计同步出现。 |
| 7 | Wordbook 是否恢复？ | **YES**：Device B 页面可见 `sustain`。 |
| 8 | Review 是否恢复？ | **YES**：Device B 可见并重做原题。 |
| 9 | Review 完成后刷新是否仍保持 mastered？ | **YES**：连续三次正确达到领域掌握规则后，刷新及重登录仍为 mastered。 |
| 10 | Translation 2 条是否恢复？ | **YES**：Device B 最近记录显示两条。 |
| 11 | Writing 2 条是否恢复？ | **YES**：Device B 最近记录显示两条。 |
| 12 | Remote hydrate 是否无 echo？ | **YES**：待发送数 0→0、mutation types `[]`，初次恢复期间无 push。 |
| 13 | A／Guest／B 是否隔离？ | **YES**：Guest 和 B 未显示 A 云端数据，重新登录 A 后数据恢复。 |

上述 13 问对应的核心恢复行为均为 **YES**；但第 15 项发现真实界面 FAIL，因此本轮整体结论仍为 **REPAIR 10A BROWSER VERIFICATION FAILED**。停止于本报告，等待下一步决定。
