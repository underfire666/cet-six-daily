# V12 Repair 10A.1 定点修复报告

## 结论

**REPAIR 10A.1 PASSED**

账号页的手动同步现在由该页面负责完整生命周期。空队列与非空队列均在推送（如有）、拉取、恢复数据和刷新待同步数成功后显示“已同步”并重新启用按钮；失败则显示可重试的“同步失败”状态。没有修改 Cloud Hydration、Sync Engine、后台自动同步、Prisma 或数据库 migration。

| Git 基线 | SHA |
| --- | --- |
| Before HEAD（Repair 10A） | `d940e71f82e3701644d502d2862035e93ee6e26f` |
| After HEAD（Repair 10A.1 产品修复提交） | `58ef2a7d46a43767c05376321c08d51bc3d96020` |
| 产品修复 commit message | `fix: complete V12 manual sync status lifecycle` |

本报告与前一轮的 `V12_REPAIR10A_BROWSER_VERIFICATION.md` 属于文档交付，随后另行提交，因此最终分支交付 SHA 会晚于上表的产品修复 SHA；最终 SHA 以交付核对和本次对话中的 `git rev-parse HEAD` 为准。

## Root Cause

原账号页 `onSync()` 设置 `syncing` 后，把状态回调交给 `pushQueue()`，再执行 `pullRemote()` 和待发送数刷新，却没有在全部成功后结束状态。`pushQueue()` 对空队列直接返回，不触发回调，所以空队列场景永久显示“正在同步…”。此外，`pushQueue()` 失败时返回 `failed` 数量、`pullRemote()` 失败时返回 `null`，原账号页没有把这两种结果可靠地判为失败。

## Modified Files

| 文件 | 变更 |
| --- | --- |
| `src/app/me/account/page.tsx` | 页面调用定点手动同步流程；成功后更新同步时间，失败后显示错误；按钮只在 `syncing` 时禁用。 |
| `src/lib/sync/manual.ts` | 新增最小可测试生命周期：`syncing → push → pull → hydrate → refresh → synced`；推送、拉取、恢复或待发送项未清空时进入 `failed` 并向页面抛出错误。 |
| `tests/v12-manual-sync.test.ts` | 新增 7 项状态机回归测试。 |

`src/lib/sync/client.ts`、`src/components/sync/SyncProvider.tsx`、Cloud Hydration、业务数据模型和 Prisma 文件均未修改。

## Automated Regression

| 检查 | 结果 |
| --- | --- |
| 空队列手动同步 | **PASS**：pull/hydrate 后 `synced`，按钮可重试。 |
| 非空队列手动同步 | **PASS**：push 先于 pull，随后 `synced`，按钮可重试。 |
| 连续第二次空队列同步 | **PASS**：第二次也经历 `syncing → synced`。 |
| pull 失败 | **PASS**：进入 `failed`，不更新时间，按钮可重试。 |
| push 失败 | **PASS**：不继续 pull，进入 `failed`，按钮可重试。 |
| hydrate 失败 | **PASS**：错误向页面传播，不误报 `synced`。 |
| push 后仍有待发送项 | **PASS**：不误报 `synced`。 |
| `npm test` | **PASS**，355/355。 |
| `npm run typecheck` | **PASS**。 |
| `npm run lint` | **PASS**。 |
| `npm run build` | **PASS**，Next.js 16.3.5 生产构建完成。 |

## Browser Retest

使用本机真实 Chrome、Playwright、真实 Next.js 应用和 HTTP API。页面操作均通过真实 UI；没有手工写 cookie 或 localStorage。浏览器 CLI 在跨标签操作中关闭了会话，因此非空队列与重复同步改由 Playwright 直接驱动单标签 Chrome 完成。浏览器脚本及截图留在本地被忽略的 `output/playwright/`，未作为产品代码提交。

| 场景 | 实际证据 | 结果 |
| --- | --- | --- |
| 1. 空队列 | 已登录的 Repair 10A A 账号，队列 0；点击“立即同步”，`GET /api/sync/pull` 200。等待 4 秒后页面“已同步”、上次同步时间已更新，按钮 enabled，队列仍为 0。 | **PASS** |
| 2. 非空队列 | 新 disposable 测试账号通过 UI 将目标分改为 600，队列出现 1 条 `profile` mutation。经正常页面导航到账号页仍为 1；点击“立即同步”，实际 `POST /api/sync/push` 200 → `GET /api/sync/pull` 200，恢复后队列为 0；等待 4 秒仍为“已同步”，按钮 enabled。[本地截图](output/playwright/repair10a1-nonempty-sync.png)。 | **PASS** |
| 3. 再次空队列 | 同一账号紧接着再次点击“立即同步”；本次只有 `GET /api/sync/pull` 200，无 push。等待 4 秒仍为“已同步”，按钮 enabled，队列 0。[本地截图](output/playwright/repair10a1-second-empty-sync.png)。 | **PASS** |

### Repair 10A 最小 Smoke

上述新测试账号在真实浏览器中登录后，目标分 600 可在“我的”页面直接看到；生词本、错题本、翻译与写作页面均可打开，浏览器控制台错误为 0。此项为页面可用性冒烟，未重跑 Repair 10A 的 14 项完整浏览器验证，也未重新验证旧 A 账号的全部历史数据。既有 Repair 10A 业务逻辑未改动。

## 最终问题

| # | 问题 | 答复 |
| --- | --- | --- |
| 1 | Empty queue manual sync 是否 PASS？ | **YES**。 |
| 2 | Non-empty queue manual sync 是否 PASS？ | **YES**，队列 1→0，push 200、pull 200。 |
| 3 | 连续第二次 empty queue sync 是否 PASS？ | **YES**。 |
| 4 | Button 是否正常重新 enabled？ | **YES**，三个浏览器场景均 enabled；错误路径由回归测试验证可重试。 |
| 5 | Repair 10A smoke 是否 PASS？ | **YES**，上述最小页面冒烟通过；旧 A 历史数据未在本轮重测。 |
| 6 | Local HEAD == Remote HEAD？ | **YES**，以最终 push 后 SHA 核对为准。 |
| 7 | git status 是否 clean？ | **YES**，以最终提交后核对为准。 |

本结论仅适用于 **Repair 10A.1**。Offline 与双设备冲突不在本轮范围。
