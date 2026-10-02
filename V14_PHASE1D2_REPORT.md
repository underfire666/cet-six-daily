# V14 Phase 1D.2 — 私有错题本 MVP 修复与验收报告

日期：2026-10-02（Asia/Shanghai）

分支：`feature/v14-real-content-rights`

基线：`5e2b539d4bab113ccc5b1df3f5c35eda4c7bc8ea`

功能与验收：PASS；最终 Git SHA 和远程核对记录见本地 `output/v14d2-git-closure.md`。

## 实现范围

当前私有阅读选择题成功提交后，由服务端判分并在进度写入的同一数据库事务内收集错题。包含未作答题目；草稿、打开页面、查看结果不收集。仅收集上线后接受的新提交，不回填旧历史。

私有错题独立存储，提供每卷列表、详情及必要返回入口。相同账号在独立浏览器上下文中可读取云端已记录错题。无错题复习、移除、收藏、调度、XP、Streak、全局学习统计、全局 Review 或 Daily Plan 接入。

## 本次修复

1. **安全显示解析**：详细解析以 React 文本节点渲染，保留换行，不解析导入 HTML；实际浏览器验证带 `onerror` 的内容仅为文字，没有图片节点或脚本执行。
2. **失效状态**：列表与详情均处理无题目详情的 `content_changed` 记录；不读取不存在的 `question`。旧版本显示明确失效提示，不呈现新题目的答案、解析。
3. **提交不可改写**：已提交的同一 attempt 不允许修改答案或恢复草稿。允许相同答案快照、导航同步和原 mutation 重放。冲突返回 409，可通过已有冲突决策采用云端或开始新轮次。
4. **内容版本隔离**：唯一键改为 `[userId, paperId, contentHash, questionId]`。旧版本保留失效记录，新版本从自己的次数开始。详情链接携带 contentHash；旧链接不跳到新版本。
5. **请求与账号隔离**：列表及详情共享加载逻辑，使用 AbortController、请求序号、身份代次和响应 owner 校验。账号/试卷变化时立即隐藏旧数据；迟到、坏格式、错误 owner 响应不写入页面。重新聚焦会刷新有效性。
6. **本轮数量提示**：提示绑定 attempt 和 contentHash，包含新建与再次答错的记录。重新开始与全对轮次不会沿用旧数量；刷新或跨浏览器打开结果页，数量从服务端恢复。同步失败不声称已加入云端错题本。
7. **事务与幂等**：内容更新、提交、删除按试卷行锁协调；错题读取使用共享行锁。收集失败回滚进度及回执。提交标记复用 SyncMutation，阻止已提交 attempt 被换一轮后重复使用。
8. **有效数量与布局**：API 分别返回有效错题数和失效历史数。手机长解析正常换行，刷新按钮触控区域至少 44px，沿用现有设计。

## 数据、路由与迁移

- Prisma `PrivateWrongItem`；新增无损迁移 `20261002000000_wrong_item_content_scope`，仅替换唯一索引，保留已有记录。已应用到本地测试 PostgreSQL。
- 记录键：owner + paper + contentHash + 稳定 questionId，不使用显示顺序。
- 同一内容版本新 attempt 再次答错，累计 wrongCount 并更新最近答案与时间；后续答对不删除历史错题。
- 同一 attempt 重试不改写记录或时间，不重复计数；原 mutation 返回原回执。
- `wrongItemsRecorded` 为此次实际新建/更新数量；`wrongItemsCount` 为当前已提交 attempt 的错题数量。
- API：`GET /api/private-papers/[paperId]/wrong-items`，owner 来自服务端会话；未登录 401，跨 owner/不存在 404。
- 页面：`/me/private-papers/[paperId]/wrong-items`、`/me/private-papers/[paperId]/wrong-items/[questionId]?contentHash=...`。
- 内容更新使旧记录失效；删除卷时，卷、进度和错题同事务删除。旧提交重放仍先验证 owner、卷存在和内容有效性，无法复活删除数据。

## 自动验证

| 检查 | 结果 |
| --- | --- |
| 全部测试 | 816/816 PASS |
| 私有错题回归测试 | 25/25 PASS（新增 10 项） |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 errors / 0 warnings |
| 生产构建 | PASS |
| content:validate | PASS，0 errors / 0 warnings |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS，仅允许的 synthetic fixture placeholder warning |

新增回归覆盖：提交不可改写及导航、丢失回执重放、内容版本及旧链接、所有读取入口的 hash 防护、重复答错与全对数量、旧 attempt 复用、并发提交、事务回滚、删除后旧请求、错误 owner/坏格式响应。

## 浏览器验证

生产构建本地地址：`http://127.0.0.1:3018`。

66/66 检查通过，使用同账号两个独立 Chrome browser context，另设 B 用户和未登录 context：

- 空状态及不回填说明；草稿不收集；提交网络失败不宣称云端收集，重试成功后收集。
- 答错与未答题记录、跨浏览器列表及结果恢复、刷新数量恢复。
- 导入恶意 HTML 仅显示文本，无脚本执行。
- 已提交答案改写返回 409，原答案保持。
- 同题再次答错正确累计；全对新轮次无旧提示；丢失成功响应后重试不重复计数。
- 200 坏格式和 500 显示错误，可重试恢复。
- 内容更新后列表与详情失效；新版本单独计数，旧链接持续失效。
- 账号切换结合被延迟的旧响应不显示旧 owner 内容。
- 未登录 401，跨 owner/伪造 owner 404；删除后旧请求 404。
- `/api/sync/pull` 的 xpEvents、sessions、wordbook、reviewItems、dailyPlans 前后不变。
- 375、390、430、768、1440px 下分别检查列表、详情、结果页：无横向滚动，底部导航不覆盖最后的正文操作。
- 所有流程无 pageerror；模拟断网及 500 引发的预期网络错误不计为应用异常。

16 张截图：`output/playwright/v14d2-{list,detail,result}-{375,390,430,768,1440}.png` 和 `v14d2-invalidated-390.png`。

本地证据：`output/v14d2-browser-results.json`、`output/v14d2-browser.log`、`output/v14d2-fix-tests.log`、`output/v14d2-fix-build.log`。两个测试用户及其卷、进度、错题、回执均按精确 id/email 清理，见 `output/v14d2-fixture-cleanup.json`。

## 已知限制与边界

- 错题本仅收集与查看；不增加复习、收藏、移除、调度或其他题型。
- 云端接受提交后才确认收集；未同步草稿仍只在来源浏览器私有队列中。
- 旧实现若已覆盖不同内容版本的数据，迁移无法重建丢失的历史；本阶段不推测或回填历史计数。
- 浏览器验证为 Chrome 与模拟宽度，未实测实体手机、Safari/Firefox 或屏幕阅读器。
- PRIVATE 不进入 production 内容池；Paper 001、REAL/MOCK、既有 main/tag/Release 保持不变。

## Git 收尾

最终 `LOCAL_HEAD`、`REMOTE_HEAD`、`LOCAL == REMOTE`、`WORKTREE` 和受保护 refs 核对保存于本地 `output/v14d2-git-closure.md`，避免报告内提交 SHA 自引用。

只普通推送当前 feature 分支；不合并 main，不创建或移动 tag，不创建 Release，不强推。截图、日志及最终 Git 核对记录保留本地，不上传为公开附件。

完成 Phase 1D.2 后停止，不开始下一阶段。
