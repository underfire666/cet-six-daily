# V14 Phase 1D.2 — 私有错题本 MVP 验收报告

**日期**: 2026-10-01
**分支**: feature/v14-real-content-rights
**阶段**: V14 Phase 1D.2

## 概述

为私有阅读选择题增加独立错题本：提交成功后服务端事务内记录错题（与进度同一事务），用户可查看列表和详情，同账号跨浏览器云端可见。

## 实现清单

### 数据层
- [x] Prisma `PrivateWrongItem` 模型（`@@unique([userId, paperId, questionId])`）
- [x] Migration `add_private_wrong_item` 已应用到 PostgreSQL
- [x] 状态枚举：`active` | `content_changed` | `paper_deleted`

### 服务端存储层
- [x] `recordWrongItems()` — 事务内记录错题，同 attempt 幂等，新 attempt 累计
- [x] `markWrongItemsContentChanged()` — 内容更新时标记旧错题失效
- [x] `deleteWrongItemsForPaper()` — 删除私有卷时级联清理
- [x] `listPrivateWrongItems()` — 查询错题列表（附带题目详情 enrichment）
- [x] `getPrivateWrongItem()` — 查询单条错题详情
- [x] `listAllPrivateWrongItems()` — 跨卷查询

### 提交流集成
- [x] `putPrivatePaperProgress` 同一 Prisma 事务内调用 `recordWrongItems`
- [x] 仅 `submitted=true` 且首次提交时记录
- [x] 结果返回 `wrongItemsRecorded` 数量
- [x] 同步 mutation receipt 包含 `wrongItemsRecorded`

### API
- [x] `GET /api/private-papers/[paperId]/wrong-items` — 错题列表（auth + owner 隔离）

### UI
- [x] 错题列表页 `/me/private-papers/[paperId]/wrong-items`
- [x] 错题详情页 `/me/private-papers/[paperId]/wrong-items/[questionId]`
- [x] 私有卷详情页添加"私有错题"入口
- [x] 学习结果页显示"X 道错题已加入私有错题本"提示
- [x] 移动端布局适配（375/390/430px 无横向溢出）

### 级联与隔离
- [x] 删除私有卷 → 级联删除关联错题
- [x] 更新私有卷内容 → 旧错题标记 `content_changed`
- [x] 跨 owner 隔离（用户 B 无法访问用户 A 的错题）
- [x] 私有错题不进入全局 XP / LearningSession / ReviewItem / DailyPlan

## 测试结果

### 回归测试（15/15 PASS）
1. 答错 → 收集错题
2. 答对 → 不收集
3. 未作答 → 按判分规则计为错误并收集（userAnswer=null）
4. 草稿（submitted=false）→ 不收集错题
5. 同 attempt 重复提交 → 不重复计数（wrongCount 保持 1）
6. 新 attempt 再次答错同一题 → wrongCount 累计为 2
7. 后续答对 → 不自动删除历史错题
8. 内容修改后 → 旧错题标记为 content_changed
9. 删除私有卷 → 关联错题级联删除
10. 跨 owner → 看不到对方错题
11. getPrivateWrongItem 详情
12. non-owner rejected
13. 空数组不创建错题
14. markWrongItemsContentChanged
15. deleteWrongItemsForPaper

### 8/8 Gates
- [x] npm test: 806/806 PASS
- [x] TypeScript typecheck: PASS
- [x] ESLint (--max-warnings 0): PASS (0 errors, 0 warnings)
- [x] Production build: PASS
- [x] content:validate: PASS
- [x] content:stats: PASS
- [x] content:rights: PASS
- [x] content:audio-validate: PASS

### 浏览器 E2E
- [x] 导入测试私有卷（2 道阅读选择题）
- [x] 学习页作答（2 题均答错）
- [x] 提交后结果页显示"2 道错题已加入私有错题本"
- [x] 错题列表页显示 2 道错题（题干、用户答案、正确答案、错误次数、最近答错时间）
- [x] 错题详情页显示完整题目、选项高亮（正确答案绿色、用户答案红色）、解析、首次/最近答错时间
- [x] 移动端 399px 布局：无横向溢出、底部导航不遮挡内容

## 关键架构决策

1. **事务一致性**：错题记录必须在 `putPrivatePaperProgress` 的同一 Prisma 事务内完成，避免进度已提交但错题漏记。
2. **稳定题目身份**：使用 `questionId` 而非显示顺序作为题目身份。
3. **同 attempt 幂等**：重复提交不增加 wrongCount；新 attempt 答错更新原记录并累计。
4. **独立存储**：私有错题独立存储，不进入全局 ReviewItem/XP/Streak/DailyPlan。
5. **内容失效**：私有卷内容更新时，旧错题标记为 `content_changed`，避免用新内容解释旧错题。

## 已知限制

- 错题本当前为只读（查看列表和详情），不支持手动复习/移除/收藏（后续 Phase）
- 错题不进入全局 Review 系统和 Daily Plan
- 私有练习暂不计入 XP、Streak 或学习统计

## 结论

V14 Phase 1D.2 私有错题本 MVP 开发完成，806/806 测试通过，8/8 gates 通过，浏览器 E2E 验证通过。
