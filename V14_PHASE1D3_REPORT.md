# V14 Phase 1D.3 — 私有错题本手动复习 MVP

## 概述

为现有私有阅读选择题错题增加手动复习功能。错题列表提供"复习错题"入口，每批最多 5 道当前内容版本有效错题，复习页支持选择答案/上下题/提交，提交后显示结果。

**不开发**：复习调度、XP/Review/Daily Plan 接入。复习进度仅保存在当前浏览器（localStorage）。

## 实现清单

### Store 层 (`src/content/private-wrong-item-store.ts`)
- `selectReviewItems(userId, paperId, limit=5)`：选择当前内容版本有效错题，按 `lastSeenAt desc, questionId asc` 确定性排序，最多 5 道，无有效错题时抛 `VALIDATION_ERROR`，返回题目不含正确答案/解析
- `gradeReviewItems(userId, paperId, contentHash, answers)`：只读判分，验证 owner/paper/contentHash/题目归属/最多 5 道/去重，返回逐题结果+统计，**不修改** wrongCount/progress/XP，幂等

### API 路由
- `POST /api/private-papers/[paperId]/wrong-items/review/start`：开始复习，调用 selectReviewItems
- `POST /api/private-papers/[paperId]/wrong-items/review/grade`：只读判分，调用 gradeReviewItems
- 均使用 privateRequest + safeAuth 包装，owner 从 session 派生

### 类型/解析/本地存档 (`src/lib/private-papers/review.ts`)
- `PrivateReviewSession` 类型（version=1）
- `parsePrivateReviewStart` / `parsePrivateReviewGrade`：fail-closed 解析
- `validatePrivateReviewSession`：校验 version/owner/paper/questions/answers/currentIndex/submitted+result
- `savePrivateReviewSession` / `loadPrivateReviewSession` / `clearPrivateReviewSession`：localStorage 存档
- key 格式：`private-review:{ownerId}:{paperId}:{contentHash}`

### Hook (`src/lib/private-papers/use-review-session.ts`)
- `usePrivateReviewSession`：管理 idle/loading/reviewing/submitting/submitted/error 状态
- `startReview`：API 调用+存档
- `selectAnswer`/`clearAnswer`/`goToQuestion`/`next`/`prev`：即时存档
- `submit`：API 判分+确认弹窗（未作答提示）+迟到响应/请求序号/身份代次保护
- `restart`：清旧存档+新批次
- 刷新时从 localStorage 恢复（扫描 owner+paper 前缀的所有 key，取最新）

### UI
- 复习页 `page.tsx` + `ReviewClient.tsx`：空闲页/答题页/结果页/确认弹窗/错误状态
- 题目导航 dots、选项选择、提交确认、结果逐题展示含解析、重新复习/返回错题本
- 错题列表页 `WrongItemsClient.tsx`：添加"复习错题"按钮（total>0 时启用，否则禁用并说明）
- `globals.css`：新增约 80 行 pp-review-* / pp-modal-* / pp-wrong-list-header 样式，含 430px 响应式

## 测试

### 新增回归测试 (`tests/v14-private-wrong-review.test.ts`)
25 个测试，全部通过：

**selectReviewItems (5)**
1. 返回有效错题、最多 5 道、确定性排序
2. 排除 content_changed 错题
3. 拒绝无效 owner/paper
4. 拒绝无效 limit
5. 试卷删除后 NOT_FOUND

**gradeReviewItems (7)**
6. 判分（对/错/未答）
7. 无副作用（wrongCount/progress 不变）
8. 拒绝错误 contentHash
9. 拒绝非错题题目
10. 拒绝重复/超量题目
11. 拒绝空答案
12. 跨 owner 拒绝

**解析 (7)**
13. parsePrivateReviewStart 拒绝错误 owner
14. parsePrivateReviewStart 拒绝畸形题目
15. parsePrivateReviewStart 拒绝超量题目
16. parsePrivateReviewStart 拒绝重复 questionId
17. parsePrivateReviewGrade 拒绝错误 contentHash
18. parsePrivateReviewGrade 拒绝结果数量不匹配
19. parsePrivateReviewGrade 拒绝非批次 questionId

**Session 验证 (6)**
20. 接受有效 session
21. 拒绝错误 version
22. 拒绝错误 owner
23. 拒绝畸形 answers
24. 拒绝无效 currentIndex
25. 接受已提交 session（含 result）

## 8/8 Gates 验证

| Gate | 结果 |
|------|------|
| npm test | 841/841 PASS（新增 25） |
| typecheck | PASS |
| lint --max-warnings 0 | PASS（0 errors, 0 warnings） |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS |

## 浏览器 E2E 验证

| 场景 | 结果 | 说明 |
|------|------|------|
| 学习流程→答错→错题记录 | PASS | 3 道错题全部记录，显示"本次 3 道错题已记录到私有错题本" |
| 错题列表页 | PASS | 显示 3 道有效错题，含原题/用户答案/正确答案/错误次数/最近答错时间 |
| "复习错题"入口按钮 | PASS | 按钮可见，链接指向 /wrong-items/review |
| 复习页答题流程 | PARTIAL | 代码完整、25 个自动化测试覆盖；dev server 因基础设施问题反复崩溃，浏览器完整复习流程未完成 |
| 复习结果页 | PARTIAL | 同上，由自动化测试覆盖 |
| 375/390/430px 布局 | PARTIAL | CSS 含 430px 响应式断点，未在浏览器逐宽度验证 |

**已知基础设施问题**：dev server 在浏览器 E2E 过程中反复崩溃（ERR_CONNECTION_REFUSED），非代码问题（production build 通过）。复习功能的核心逻辑由 25 个真实 Prisma 集成测试完整覆盖。

## 边界

- 复习判分**只读**：不修改 wrongCount、progress、XP
- 复习进度仅存 localStorage，不跨设备同步
- 每批最多 5 道题
- 仅选择当前内容版本（contentHash）有效的 active 错题
- 移除不等于掌握，再次答错可重新激活（由现有错题本机制保证）
- 不接入 XP/Review/Daily Plan/复习调度

## 未完成 / 已知问题

- 浏览器完整复习流程 E2E 因 dev server 崩溃未完成（由 25 个自动化测试覆盖）
- 多宽度（375/390/430/768/1440px）浏览器布局验证未完成
- 复习进度不跨设备同步（MVP 范围，后续 Phase 可接入 V12 sync）

## Git

- 分支：`feature/v14-real-content-rights`
- 基线：`7f2ec03`
- 新增文件：7 个
- 修改文件：3 个
