# V14 Phase 1E.2 — 私有错题复习云同步修复验收报告

## 结论

**本地修复与验收 PASS。** 应用版本已更新为 **14.6.6**，appPhase 仍为 V14 Phase 1E.2。未开始下一阶段。本报告替换原仅验证核心流程的验收结论，修复前问题证据保留在本地 `output/reviews/v14-phase1e2/ACCEPTANCE_REVIEW.md`。

- 日期：2026-10-02
- 工作分支：feature/v14-real-content-rights
- 本地预览：http://127.0.0.1:3032
- 设计文档：V14_PHASE1E2_DESIGN.md

## 修复内容

| 问题 | 修复后的行为 |
| --- | --- |
| 开始响应丢失 revision，第二批次无法保存 | 严格解析并保留真实 revision；第二批次继续正常保存 |
| 已提交页面刷新重新 POST 判分，得到 409 | GET 验证并恢复存储结果，刷新不重判；相同提交重试返回原结果 |
| 慢速保存回复覆盖期间的新答案或题号 | 单个在途请求与串行保存队列，仅确认捕获的编辑序号；提交先等待保存 |
| 未同步状态只存内存，刷新丢草稿 | 本地存档立即持久化 syncDirty / syncRevision / 答案 / 题号，刷新后核对再同步 |
| 非法答案被净化成 null 或未知选项被写入 | 拒绝数组、未知题目/选项、非法索引和 revision；异常写入不改变记录 |
| 云端 GET 失败被当作无记录或已同步 | 明确错误与重新检查；未经验证的内容隐藏，本地存档保留 |
| 保留本地重复使用旧 revision；失败后无恢复入口 | 两种选择都先读最新版本；本地按新 revision 保存，云端已提交/换批次时新开受校验批次；增加手动重试与 online 恢复 |
| 事务外选题和判分存在竞争窗口 | 锁定同一试卷行，在单一事务内选题、检查有效性、判分及写入；共享 TransactionClient，避免嵌套死锁 |

补充保护：所有响应验证 owner/paper/hash/batch/revision 与结果一致性；账号/路由变化后的旧响应不能更新页面或本地存档。Escape 关闭冲突弹窗时保留草稿和冲突，用户可重新打开选择。结果页只在确认后标记云端已同步。

## 主要文件

- `src/content/private-review-progress-store.ts`：严格读写验证、CAS、同事务选题/判分、显式 resume 与提交幂等。
- `src/content/private-wrong-item-store.ts`：可复用当前事务的选择和判分函数。
- `src/lib/private-papers/review-controller.ts`：请求队列、草稿恢复、失败重试与身份保护。
- `src/lib/private-papers/review-sync.ts`：响应验证与本地/云端合并规则。
- `src/lib/private-papers/use-review-session.ts`：React/auth 生命周期与 focus/visibility/online 恢复。
- `src/lib/private-papers/review.ts`：revision 解析和同步 envelope 校验。
- `src/app/api/private-papers/[paperId]/wrong-items/review/start/route.ts`：显式冲突恢复参数。
- `src/app/me/private-papers/[paperId]/wrong-items/review/ReviewClient.tsx`：失败重试、冲突说明和 Escape 行为。
- `package.json` / `package-lock.json`：14.6.6，关于页同步显示。
- `tests/v14-private-review-progress.test.ts`：33 项专项回归（原 15 + 新增 18）。

沿用原 PrivateReviewProgress 表和已应用的 migration；本轮没有数据库结构变更或新样式。

## 自动检查：8/8 PASS

| 检查 | 结果 |
| --- | --- |
| npm test | **903/903 PASS**（885 + 18） |
| typecheck | PASS |
| lint | PASS，0 errors / 0 warnings |
| production build | PASS，Next.js 16.3.5 |
| content:validate | PASS，0 errors / 0 warnings |
| content:stats | PASS |
| content:rights | PASS，production selector 保持原允许内容 |
| content:audio-validate | PASS，0 errors；仅允许的 mock synthetic fixture placeholder warning |

新增回归覆盖真实 Prisma 事务和并发、重复提交、题目移出、损坏记录、显式恢复校验、连续批次、慢速保存、保存期间提交、刷新前未同步草稿、只读结果恢复、失败重试、读取失败、两种冲突选择、账号 scope 失效及异常响应。

## 真实浏览器：84 项 PASS

生产构建运行于 127.0.0.1:3032，使用 Chrome 独立 context：两个同账号浏览器、第二 owner 和未登录浏览器。主流程 74 项 + 异常响应/账号切换 10 项。

- 同账号独立浏览器恢复答案、题号和批次。
- 防抖发送前刷新保留未同步答案，并在核对后保存。
- 延迟真实保存响应期间连续作答与提交；提交等待保存，最终评分使用最新答案。
- 已提交刷新无 POST grade；第二批次正常保存。
- 保存失败可手动重试，云端读取 500 不错误显示已同步，断网恢复自动核对并保存。
- 两端编辑冲突保留本地；采用云端/保留本地分别生效；云端已提交后保留本地新开一批。
- 原生冲突 dialog 的 Tab / Shift+Tab、Escape、重开均验证。
- 375 / 390 / 430 / 768 / 1440px 的复习页、结果页和冲突弹窗检查通过，无横向溢出；正文/最后按钮不被固定导航遮挡，主要按钮至少 44px。
- 四个复习 API 的 guest 401、跨 owner/伪造 owner 404；异常分数与响应 owner 被拒绝，不能替换本地结果。
- 保存已返回浏览器但尚未完成期间切换账号：旧题目隐藏，迟到响应不写原 owner 草稿或新 owner 存档；新账号可正常复习保存，切回重新验证。
- 原卷学习进度、错题记录/次数和全局 XP、sessions、wordbook、reviewItems、dailyPlans 均保持一致。
- 关于页显示 14.6.6；主流程和竞争场景无 browser pageerror。

截图 15 张，结果 JSON、CLI 日志及脚本模板保留在本地 `output/reviews/v14-phase1e2/`，不作为公开附件上传。

## 测试数据清理

仅创建两个随机 `e2fix-...@example.invalid` 隔离账号及各自测试卷。清理前逐一核对精确 id/email，然后删除；用户及全部 16 类关联数据计数均为 0。测试凭据与带凭据的运行脚本已删除，日志中的测试密码已替换。原用户数据未作批量清理。

清理证据：`output/reviews/v14-phase1e2/fixture-cleanup.json`。

## Git 状态

- 本轮基线 LOCAL_HEAD：fe56fc446fc146c2c76046c842ff2d38cf16bbf5。
- 当前分支：feature/v14-real-content-rights。
- 基线远程核对为相同提交；本轮修复与文档仍在工作区，**尚未提交/推送，WORKTREE = DIRTY**。不以 HEAD 相同宣称本次修复已经远程交付。
- v12.0 指向 697772d9412d9d1a4253e099a001734a5230e264，保持不变。
- 本轮没有 merge main、移动 tag 或创建 Release。阶段标记为本地修复验收通过，Git 发布闭环未执行。

## 已知边界

- 每 owner/paper 仅保存最新复习批次，不新增云端历史。
- 离线硬刷新不保证；本地存储失败会明确提示刷新风险。
- 只验证 Chrome 独立 context 与模拟视口，未实测实体手机、软键盘或其他浏览器。
- PRIVATE 复习不接 Daily Plan/全局 Review/全局 sync，不新增调度、掌握评分或自动移出。
- 没有导入或公开上传真实试题；Paper 001、答案、音频、rights metadata 与 contentVersion 1.1.0 未变。

本次 Phase 1E.2 修复完成后停止，等待用户检查。
