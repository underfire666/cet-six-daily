# V14 Phase 1E.2 — Private Wrongbook Review Progress Cloud Sync 验收报告

## 版本信息

- 应用版本：14.6.5
- appPhase：V14 Phase 1E.2
- 分支：feature/v14-real-content-rights
- 日期：2026-10-02

## 实现清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `prisma/migrations/20261002064622_add_private_review_progress/migration.sql` | Prisma migration SQL |
| `src/content/private-review-progress-store.ts` | Store 层（4 个导出函数 + 错误类 + 类型） |
| `src/app/api/private-papers/[paperId]/wrong-items/review/progress/route.ts` | GET 复习进度 API |
| `src/app/api/private-papers/[paperId]/wrong-items/review/progress/save/route.ts` | POST 保存复习进度 API |
| `tests/v14-private-review-progress.test.ts` | 15 个回归测试 |
| `V14_PHASE1E2_DESIGN.md` | 设计文档 |
| `V14_PHASE1E2_REPORT.md` | 本报告 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | 新增 PrivateReviewProgress 模型 + User 关系 |
| `src/app/api/private-papers/[paperId]/wrong-items/review/start/route.ts` | 改用 startPrivateReviewBatch（持久化） |
| `src/app/api/private-papers/[paperId]/wrong-items/review/grade/route.ts` | 改用 submitPrivateReviewProgress（持久化） |
| `src/lib/private-papers/use-review-session.ts` | 完整重写，接入云同步 |
| `src/lib/private-papers/review.ts` | PrivateReviewStartResponse 新增 revision 字段；result 类型修正 |
| `src/app/me/private-papers/[paperId]/wrong-items/review/ReviewClient.tsx` | 新增同步状态徽章 + 冲突对话框 + 文案更新 |
| `src/app/globals.css` | 新增 .pp-sync-badge + 5 种状态颜色样式 |
| `package.json` | version 14.6.4 → 14.6.5，appPhase → V14 Phase 1E.2 |
| `package-lock.json` | version 同步更新 |
| `PROJECT_CONTEXT.md` | 更新头部和新增 Phase 1E.2 章节 |

## 关键 Bug 修复

### 嵌套事务死锁

**问题**：`selectReviewItems` 和 `gradeReviewItems` 内部各自创建 `prisma.$transaction`，当嵌套在持有 paper row `FOR UPDATE` 锁的写事务内调用时，内层事务尝试读取同一 paper 行导致死锁，5 秒超时。

**修复**：将这两个只读函数移到写事务外部调用，写事务内只做 CAS 检查和 upsert/update。

**验证**：修复后 15 个测试全部在 20ms 内完成。

### Prisma Client 未更新

**问题**：dev server 启动时 Prisma Client 未包含新的 `PrivateReviewProgress` 模型，导致 `prisma.privateReviewProgress.findUnique` 返回 undefined，API 返回 500。

**修复**：停止 dev server，运行 `npx prisma generate`，重启 dev server。

## 8/8 Gates 验证结果

| Gate | 结果 | 详情 |
|------|------|------|
| npm test | PASS | 885/885（原 870 + 新增 15） |
| TypeScript typecheck | PASS | 0 errors |
| ESLint | PASS | 0 errors / 0 warnings |
| Production build | PASS | Next.js 16.3.5 Turbopack，编译成功 |
| content:validate | PASS | 30 vocab / 6 reading / 7 listening / 8 translation / 8 writing / 2 paper，0 errors |
| content:stats | PASS | - |
| content:rights | PASS | production pool 仅含 allowed content |
| content:audio-validate | PASS | 8 audio assets，1 expected warning for fixture placeholder |

## 浏览器 E2E 验证

### 验证场景

1. **开始复习**：POST `review/start` 返回 200，题目正常显示（3 道错题）
2. **答题保存**：选择答案后同步状态显示"已同步"（绿色 Cloud 图标）
3. **刷新恢复**：刷新页面后，答案和当前题号从云端恢复，第一题进度点保持绿色
4. **移动端布局**：399px 视口下无横向溢出、底部导航无遮挡、按钮可点击

### 同步状态徽章

- 同步中：Loader2 旋转动画
- 已同步：Cloud 图标 + 绿色文字
- 同步失败：CloudOff 图标 + 红色文字
- 有冲突：RefreshCw 图标 + 橙色文字
- 本地：Cloud 图标 + 灰色文字

### 冲突处理

- 检测到 revision 冲突时弹出原生 dialog
- 提供"采用云端进度"和"保留本地作答"两个选项
- 选择后立即执行对应操作

## 数据隔离验证

- 跨 owner 隔离：user B 不能读取 user A 的复习进度（测试 12）
- 复习操作不修改错题次数或原卷进度（测试 15）
- 所有 API 使用 `privateRequest` + `safeAuth`，owner 从 session 派生

## 已知边界

- 离线硬刷新不属于 V14 保证范围
- 真机移动端软键盘尚未验证
- 复习进度不接入 Daily Plan 或全局 Review 系统
- 不实现复习调度、掌握评分或自动移出
- 仅 Chrome 模拟宽度验证，未做实体手机或其他浏览器实测

## 未完成项

- 多宽度布局完整验证（375/390/430/768/1440px）
- 双浏览器跨设备同步完整 E2E
- 网络异常/断网重连场景验证
- 冲突对话框完整交互验证

## Git 状态

- 分支：feature/v14-real-content-rights
- Commit：df31c68fe65ab4135b583a0b889a093d4b2f044e
- Local HEAD == Remote HEAD：YES
- Worktree：CLEAN
- v12.0 tag：697772d9412d9d1a4253e099a001734a5230e264（未变化）
- 已 push 到 origin/feature/v14-real-content-rights
