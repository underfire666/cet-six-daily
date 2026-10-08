# V14 Phase 1E.2 — Private Wrongbook Review Progress Cloud Sync

应用版本：14.6.6；阶段仍为 V14 Phase 1E.2。本文描述本轮修复后的实际实现。

## 目标与边界

同一账号可在独立浏览器恢复私有卷错题复习批次、答案、题号与已提交结果。保留现有视觉设计，只补充失败重试和明确的冲突提示。

复习独立于原卷学习，不修改原答案、错题次数、学习进度、XP、Daily Plan 或全局 Review。不增加复习调度、自动移出、真实题库导入或下一阶段功能；Paper 001 / contentVersion 1.1.0 不变。

## 数据与权限

沿用已应用的 `20261002064622_add_private_review_progress` migration 和 PrivateReviewProgress 表，本轮无新表或迁移。

- 唯一键 `[userId, paperId]`，索引 `[userId]`；每 owner/paper 保存最新一批。
- 字段：reviewBatchId、contentHash、questionIds、answers、currentIndex、submitted、result、revision、createdAt、updatedAt。
- owner 仅从服务端 session 派生，忽略请求自报 owner。跨 owner 与不存在的试卷保持 NOT_FOUND；未登录 401。
- 数据只在 owner-scoped PRIVATE API 中读写，不进入公共 production selector 或全局 sync。
- 本地存档继续使用 version=1，新增可选 `syncRevision` / `syncDirty`。每次编辑立即写入答案、题号及同步状态；旧存档无 revision 时按未确认草稿处理，不静默丢弃。

## 服务端事务

四个服务操作使用同一试卷行 `FOR UPDATE` 锁，在单一事务内完成权限、readiness、内容版本、批次与 revision 检查。

`selectReviewItemsInTransaction` / `gradeReviewItemsInTransaction` 接受当前 TransactionClient，不自行创建嵌套事务。既避免原嵌套事务死锁，也避免事务外选题/判分与移出、更新或删除竞争。

### readPrivateReviewProgressSnapshot

返回 `{progress, revision, invalidated, invalidReason}`。读取当前内容并严格验证存储的题目集合、答案、索引与结果。内容变化、已移出题目或损坏记录返回 invalidated；GET 不删除或覆盖旧记录。已提交结果由此 GET 恢复，不再通过 POST grade 重判。

### startPrivateReviewBatch

普通开始：同一事务内按最近答错时间与稳定 ID 选取最多 5 道有效、未移出的选择题，持久化新的 UUID 批次，revision 递增。

显式保留本地且云端已提交/换批次：允许可选 `resume = {baseRevision, contentHash, questionIds}`。服务端验证 CAS、hash、题目数量/唯一性及当前 owner 的有效错题归属，由当前内容重建题目。客户端不能指定题目文本、分数或正确答案。创建新批次，不改写已提交结果；表仍只保留最新批次，不新增历史表。

### savePrivateReviewProgress

拒绝非对象答案、未知题目/选项、非法整数索引/revision；缺少批次内答案按 null 规范化。校验 batch/hash、未提交状态以及所有题目仍有效。CAS 成功只更新答案、题号和 revision；错误不写入。

### submitPrivateReviewProgress

锁内检查并使用当前内容判分、持久化 result 和 submitted=true，revision 递增。

同一已提交批次、内容与答案的重试返回原结果，不再次写入或递增 revision，支持提交成功但响应丢失后的恢复。改变已提交答案返回冲突。复习判分不改变原卷进度、错题次数或 XP。

## API

- GET `.../wrong-items/review/progress`：严格的 owner/paper/revision/invalidated 快照。
- POST `.../wrong-items/review/start`：普通 limit 或显式 resume，返回包含 revision 的批次。
- POST `.../wrong-items/review/progress/save`：baseRevision + batch/hash + answers/currentIndex；返回 owner/paper/revision/updatedAt。
- POST `.../wrong-items/review/grade`：baseRevision + batch/hash + answers；返回已提交进度与逐题结果。

路径前缀为 `/api/private-papers/[paperId]`。使用 privateRequest / safeAuth；非法 JSON/非对象 400，超限请求 413，非法业务字段 422，CAS/版本/批次冲突 409，不存在/跨 owner 404。

## 客户端状态管理

`use-review-session.ts` 负责 React/auth 生命周期；`PrivateReviewController` 负责读写串行与错误恢复；`review-sync.ts` 提供快照、响应解析和草稿合并规则。

1. 加载或重新聚焦时先验证云端快照与当前错题集合；读失败显示错误，不能当作无进度或宣称已同步。
2. 编辑立即保存本地 envelope，只将网络发送防抖 800ms。同一 controller 仅一个保存请求在途；保存响应确认其捕获的编辑序号，随后发送期间产生的新编辑。
3. 响应只更新最新状态的 revision/同步确认，不把旧答案/题号快照覆盖到当前状态。提交等待保存队列清空后取最新 revision 与答案。
4. 请求有 AbortController、owner/paper scope、身份代次和操作序号保护；卸载、路由或账号变化后的旧响应不能更新 UI 或 localStorage。
5. 已提交结果只读恢复。异常响应身份、revision、答案、题目或分数统计被拒绝，保留本地存档并提示重新检查。
6. focus / visibilitychange / online 重新核对。同步失败保留答案，提供“重试同步”；网络恢复后自动重新核对和发送，离线硬刷新不保证。

### 草稿合并

- 无本地或本地已确认：采用验证后的云端。
- 未确认本地与云端完全一致：确认响应丢失后的已保存状态。
- 相同未提交批次/hash/baseRevision：继续发送本地编辑。
- 未确认本地与较新云端不同：提示冲突，不静默覆盖。
- 内容或题目失效：隐藏旧题目，保留草稿，提示重新开始。

### 冲突选择与界面

“采用云端进度”先重新读取最新快照，再显式采用。“保留本地作答”先验证题目并取得最新 revision；相同未提交批次重新保存，云端已提交或换批次则打开受校验的新批次。

原生 dialog 支持 Tab / Shift+Tab 焦点循环；Escape 仅关闭弹窗并保留冲突，外部“处理冲突”按钮可重开。五种同步徽章沿用现有样式；结果页仅在确认后写“已同步到云端”。

## 验证

- `tests/v14-private-review-progress.test.ts`：33 项（原 15 + 新增 18），包含真实 Prisma 事务测试及注入真实服务请求的 controller 测试。
- 全项目 903/903 tests，typecheck、lint 0/0、生产 build 和四项 content gates 通过。
- 浏览器验收与清理记录以 `V14_PHASE1E2_REPORT.md` 为准。脚本、结果和截图留在本地 output/。

## 已知边界

最新批次覆盖旧批次，不提供云端复习历史。只验证 Chrome 独立浏览器 context 和模拟屏幕宽度，未验证实体手机、软键盘或其他浏览器。离线硬刷新不保证；不接入全局同步、Daily Plan 或复习调度。
