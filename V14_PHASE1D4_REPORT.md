# V14 Phase 1D.4 — 私有错题本手动移出/恢复 MVP

## 当前结论

2026-10-02：代码实现、8/8 gates 验证和浏览器 E2E 全部 PASS。Git 提交/远程同步待执行。

用户可将错题"移出错题本"（软移出，保留记录），也可在"已移出"区域恢复；再次答错会重新激活。不开发自动移出、掌握评分、复习调度或 XP 接入。

## 实现内容

### 数据模型

- Prisma `PrivateWrongItem` 模型新增 `removedAt DateTime?`（软移出标记）和 `revision Int @default(0)`（CAS 乐观并发）。
- 新增索引 `[userId, paperId, removedAt]`，支持按移出状态高效查询。
- Migration `20261002051202_add_removed_at_revision_to_private_wrong_item` 已创建并应用。
- 保留唯一键 `userId + paperId + contentHash + questionId`，软移出不删除行。

### Store 层

- `PrivateWrongItemView` 新增 `removedAt: string | null` 和 `revision: number`。
- `enrich()`：已移出错题仍返回 question 详情（用于"已移出"区域显示）；status 推导使用 `contentValid` 变量。
- `recordWrongItems()`：新 attempt 再次答错时，若记录已移出则清除 `removedAt`、`wrongCount+1`、`revision+1`、更新 attemptId/userAnswer/lastSeenAt；返回值新增 `reactivated` 计数。同 attempt 重试不重复累计也不撤销移出。
- `selectReviewItems()` 和 `gradeReviewItems()`：where 条件新增 `removedAt: null`，已移出错题不进入复习。
- `listPrivateWrongItems()` 和 `listAllPrivateWrongItems()`：移除 status 过滤，返回所有记录（含已移出/已失效），由 UI 分组。
- 新增 `removeWrongItem(userId, paperId, contentHash, questionId, expectedRevision)`：CAS 检查 revision，幂等（已移出直接返回），设置 removedAt=now() + revision+1。
- 新增 `restoreWrongItem(...)`：CAS 检查，仅 status="active" 可恢复（content_changed 拒绝并说明原因），幂等（未移出直接返回），清除 removedAt + revision+1。
- 新增 `countWrongItems(userId, paperId)`：返回 `{active, removed, contentChanged, total}`。
- `PrivateWrongItemStoreError` 新增 `CONFLICT` 错误码（HTTP 409）。

### API 路由

- `wrong-items/route.ts` GET：响应从 `{total, invalidatedTotal}` 改为 `{counts: {active, removed, contentChanged, total}}`；错误映射支持 CONFLICT→409。
- 新建 `wrong-items/[questionId]/remove/route.ts`：POST，body `{contentHash, revision}`，owner 从 session 派生。
- 新建 `wrong-items/[questionId]/restore/route.ts`：POST，body `{contentHash, revision}`。
- `review/start/route.ts` 和 `review/grade/route.ts`：错误映射新增 CONFLICT→409。

### 解析器

- `PrivateWrongItemsResponse` 改为 `{ownerId, items, counts}`。
- 校验 item 的 `removedAt`（null 或 string）和 `revision`（非负整数）。
- status 白名单新增 `paper_deleted`。
- 仅 active 且未移出的 item 才校验 question 结构。
- 修复选项验证 typo（`typeof o.text !== "string"` 应为 `=== "string"`）。

### UI

- `WrongItemsClient.tsx` 完全重写：分三个 section（有效错题/已移出/旧版本错题）。
  - 有效错题卡片含"移出错题本"按钮（不嵌套在 Link 内，flex 布局分离 link 和 actions）。
  - 已移出错题含"恢复到错题本"按钮（content_changed 显示"内容版本已变更，无法恢复"）。
  - 移出确认原生 dialog（说明软移出及再次答错规则，含题目预览，Tab/Shift+Tab/Escape/焦点恢复）。
  - 操作 loading/error 状态，actionError 可关闭。
- `WrongItemDetailClient.tsx` 更新：已移出状态显示提示条，导航区含移出/恢复按钮，同样的确认 dialog。
- `globals.css` 新增约 80 行 Phase 1D.4 样式，含 430px 响应式。

### 复习批次失效衔接

- 更新 `use-review-session.ts` 的 `recheck` 函数，批次验证条件新增 `item.removedAt === null`。
- 固定复习批次中有题目被移出后，刷新/重新聚焦时批次失效并提示重新开始。

## 自动验证

私有错题移出/恢复专项 15/15 PASS：
- 移出幂等、CAS 冲突、恢复幂等
- content_changed 不可恢复
- 重新激活（再次答错清除 removedAt）
- 复习排除已移出
- counts 统计
- API 路由（remove/restore）
- 解析器验证（removedAt/revision/counts）
- 同 attempt 重试不撤销移出

| Gate | 本轮结果 |
| --- | --- |
| npm test | 860/860 PASS |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 errors / 0 warnings |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS（production pool 仅含允许的 Paper 001） |
| content:audio-validate | PASS（1 warning 为 fixture placeholder mock://，预期内） |

## 浏览器 E2E

- 错题列表页显示"共 N 道有效错题，M 道已移出"统计，三段分组（有效错题/已移出/旧版本错题）。
- 点击"移出错题本"弹出确认 dialog，含题目预览和规则说明（"移出仅隐藏，不代表已掌握；新一轮学习再次答错会重新收录"）。
- 确认移出后题目移到"已移出"区域，显示"已移出" badge 和移出时间，按钮变为"恢复到错题本"。
- 刷新页面后移出状态持久化。
- 点击"恢复到错题本"后题目回到有效错题区域，"已移出"区域消失。
- 详情页同样支持移出/恢复，已移出状态显示提示条。
- 384px 宽度无横向溢出，底部导航无遮挡，按钮可点击。

## 边界

- 软移出用 nullable removedAt（不删除行），保留唯一键。
- revision 用于 CAS 乐观并发。
- recordWrongItems 重新激活时清除 removedAt 并 increment revision。
- 复习选题和判分均排除 removedAt!=null。
- list 返回全部记录由 UI 分组。
- 移出状态与内容版本有效性分别表达（content_changed 的已移出错题不可恢复）。
- 不开发自动移出、掌握评分、复习调度或 XP 接入。

## Git 状态

- 分支：feature/v14-real-content-rights
- 本轮修改未提交，worktree dirty。
- 未 merge main、未打 tag、未建 Release、未开始 V15。
