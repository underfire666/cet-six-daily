# V14 Phase 1E.2 — Private Wrongbook Review Progress Cloud Sync

## 目标

在 V14 Phase 1D.3 私有错题本手动复习（仅 localStorage）基础上，增加服务端持久化与跨浏览器云同步。同一账号在另一个浏览器打开同一私有卷错题复习页，可恢复当前批次、答案、题号及已提交结果。保留现有界面，只增加必要的同步提示和冲突操作。

## 非目标

- 不修改错题次数、学习进度、XP 或原卷数据
- 不实现复习调度、掌握评分、自动移出
- 不接入 Daily Plan 或全局 Review 系统
- 不修改 Paper 内容、answer keys、audio、rights metadata
- 不修改 contentVersion 1.1.0

## 数据模型

### PrivateReviewProgress 表

```prisma
model PrivateReviewProgress {
  id            String   @id @default(cuid())
  userId        String
  paperId       String
  reviewBatchId String
  contentHash   String
  questionIds   Json     // string[]
  answers       Json     // Record<string, string | null>
  currentIndex  Int      @default(0)
  submitted     Boolean  @default(false)
  result        Json?    // { results, total, correct, unanswered }
  revision      Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, paperId])
  @@index([userId])
}
```

- 每 owner/paper 只保留一条最新复习进度记录
- 开始新批次时 upsert（revision 递增）
- 提交后 submitted=true，result 持久化
- 再次开始复习会替换旧批次

## Store 层

### 函数

1. `readPrivateReviewProgressSnapshot(ownerId, paperId)`
   - paper row `FOR UPDATE` 锁 + readiness 校验
   - 返回 `{progress, revision, invalidated, invalidReason}`
   - 内容版本变化或批次题目失效返回 invalidated=true，不删除记录

2. `startPrivateReviewBatch(ownerId, paperId, limit)`
   - 调用 `selectReviewItems` 选题（在写事务外部，避免嵌套事务死锁）
   - 写事务内 paper row 锁 + upsert
   - revision 递增

3. `savePrivateReviewProgress(ownerId, paperId, input)`
   - CAS revision 检查（baseRevision 必须匹配）
   - batchId/contentHash 校验
   - 已提交拒绝
   - 净化 answers，更新 currentIndex/answers
   - revision+1

4. `submitPrivateReviewProgress(ownerId, paperId, input)`
   - 先读当前行校验（事务外）
   - 调用 `gradeReviewItems` 判分（事务外，避免嵌套死锁）
   - 写事务内重新 CAS 检查 + 持久化 result + submitted=true
   - revision+1

### 关键设计决策

- **paper row `FOR UPDATE` 锁**：所有写操作串行化，防止并发开始/保存/提交冲突
- **CAS revision 乐观并发**：客户端携带 baseRevision，服务端校验不匹配返回 409
- **服务端选题**：不信任客户端题目集合，由 `selectReviewItems` 统一选择
- **服务端判分**：不信任客户端分数，由 `gradeReviewItems` 统一判分
- **判分/保存不修改错题次数/学习进度/XP**：复习操作是独立的，不影响原学习记录
- **GET 只读净化不删除失效记录**：内容变化时返回 invalidated=true，由客户端决定是否重新开始
- **嵌套事务死锁修复**：`selectReviewItems` 和 `gradeReviewItems` 内部各自创建 `prisma.$transaction`，不能嵌套在持有 paper row 锁的写事务内。修复方案：移到写事务外部调用。

## API 路由

### GET `/api/private-papers/[paperId]/wrong-items/review/progress`
- 调用 `readPrivateReviewProgressSnapshot`
- 返回 `{ownerId, paperId, progress, revision, invalidated, invalidReason}`

### POST `/api/private-papers/[paperId]/wrong-items/review/progress/save`
- 调用 `savePrivateReviewProgress`
- 返回 `{ownerId, paperId, revision, updatedAt}`
- 错误映射：CONFLICT→409、CONTENT_CHANGED→409、BATCH_MISMATCH→409

### POST `/api/private-papers/[paperId]/wrong-items/review/start`（已修改）
- 改用 `startPrivateReviewBatch`（服务端选题并持久化批次）
- 返回 `{ownerId, ...batch}`（含 questions/revision 等）

### POST `/api/private-papers/[paperId]/wrong-items/review/grade`（已修改）
- 改用 `submitPrivateReviewProgress`（服务端判分并持久化提交结果）
- 返回 `{ownerId, ...submitted}`

所有路由使用 `privateRequest` + `safeAuth`，owner 从 session 派生。

## 客户端云同步

### usePrivateReviewSession Hook 重写

- `syncStatus`：idle / saving / saved / error / conflict
- `syncError`：同步错误信息
- `recheck`：先 fetch `review/progress` GET 获取云端进度；本地有未同步 dirty 状态时保留本地并提示冲突；无本地修改才采用云端；读取失败不能当作无记录
- `edit`（选择答案/切换题目）：防抖 800ms 保存到 `review/progress/save`，携带 baseRevision；保存成功更新本地 revision；409 冲突时设置 syncStatus=conflict
- `submit`：使用新的 grade 端点（已持久化），成功后更新 revision
- `resolveConflict("cloud"|"local")`：cloud 采用云端（重新 recheck），local 保留本地并立即强制 push
- `serverRevision` ref：跟踪最后已知服务端 revision
- `dirty` ref：跟踪本地是否有未同步修改
- 页面 focus / visibilitychange 时自动 recheck

### UI 更新

- Header 新增同步状态徽章：
  - 同步中（Loader2 旋转）
  - 已同步（Cloud 绿色）
  - 同步失败（CloudOff 红色）
  - 有冲突（RefreshCw 橙色）
  - 本地（Cloud 灰色）
- 新增冲突对话框（native `<dialog>`）："复习进度冲突"，两个按钮"采用云端进度"和"保留本地作答"
- idle 状态文案："复习进度自动同步到云端，可在其他设备继续"
- 结果页文案："复习结果已同步到云端"
- CSS：`.pp-sync-badge` + 5 种状态颜色类

## 回归测试

15 个测试（`tests/v14-private-review-progress.test.ts`）：

1. startPrivateReviewBatch 创建并持久化批次
2. start 替换已有批次并递增 revision
3. readSnapshot 返回持久化进度
4. readSnapshot 无批次时返回 null
5. readSnapshot 内容变更时 invalidated
6. save 保存答案和 currentIndex
7. save 拒绝 stale revision（CAS 冲突）
8. save 拒绝 batch mismatch
9. save 拒绝已提交批次
10. submit 判分并持久化结果
11. submit 拒绝 stale revision
12. 跨 owner 隔离（user B 不能读 user A 进度）
13. start 拒绝无效 limit
14. save 校验必填字段
15. 复习操作不修改错题次数或原卷进度

## 浏览器 E2E 验证

- 开始复习：API 返回 200，题目正常显示
- 答题保存：同步状态显示"已同步"
- 刷新恢复：刷新后答案和进度从云端恢复
- 移动端布局：399px 视口无横向溢出或导航遮挡

## 已知边界

- 离线硬刷新不属于 V14 保证范围
- 真机移动端软键盘尚未验证
- 复习进度不接入 Daily Plan 或全局 Review
- 不实现复习调度或掌握评分
