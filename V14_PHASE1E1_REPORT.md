# V14 Phase 1E.1 — Private Study Progress Sync MVP 验收报告

日期：2026-10-01
分支：feature/v14-real-content-rights
提交：见 git log

## 1. 目标

在 Phase 1D.1 私有卷学习 MVP（reading/careful_reading/choice，进度仅 sessionStorage）基础上，实现同一账号跨浏览器/设备恢复答案、当前题号及已提交结果；网络失败时保留本地作答，恢复后可重试。复用 V12 账号隔离队列/重试/同步状态机制，不重写现有同步系统。

## 2. 实现清单

### 2.1 服务端存储

- **Prisma 模型**：`PrivatePaperProgress`（id/userId/paperId/attemptId/contentHash/answers/currentIndex/submitted/revision/createdAt/updatedAt）
  - `@@unique([userId, paperId])`：每用户每卷一条最新进度
  - `attemptId`：区分练习轮次，重新练习生成新 ID
  - `revision`：乐观并发控制，每次写入递增
- **Migration**：`20261001111004_add_private_paper_progress`（已应用到 PostgreSQL）
- **服务端存储层**：`src/content/private-paper-progress-store.ts`
  - `getPrivatePaperProgress`：读取并净化（contentHash 不匹配 → null；非法答案丢弃并回写）
  - `putPrivatePaperProgress`：条件更新（attemptId/revision/contentHash 校验，事务内先查后写）
  - 冲突检测：`revision_conflict`（409）、`attempt_mismatch`（409）、`content_changed`（410）、`not_ready`（409）
  - 答案净化：PUT 时键/值非法 → 422；GET 时非法条目静默丢弃
  - 不存储分数：读取时由调用方按当前试卷重算

### 2.2 API 路由

- `GET /api/private-papers/[paperId]/progress`
  - 未登录 → 401
  - 无进度 → `{ exists: false, progress: null }`
  - 有进度 → `{ exists: true, progress: RemoteProgress }`
- `PUT /api/private-papers/[paperId]/progress`
  - 成功 → `{ ok: true, revision, updatedAt }`
  - 冲突 → 409 + `{ error, currentRevision, serverProgress }`
  - 使用 `safeAuth()` 包装，测试环境 auth 异常安全返回 401

### 2.3 客户端同步适配

- `src/lib/private-papers/progress-sync.ts`
  - 复用 V12 队列数据结构（`enqueueMutation`/`loadQueue`/`saveQueue`），entityType=`privateProgress`，合并策略 `snapshot`
  - **独立推送**：`pushPrivateProgressQueue()` 逐个 PUT 到专用端点，不走 V12 `/api/sync/push`
  - `enqueuePrivateProgress`：入队（同 paperId 只留最新）
  - `fetchRemoteProgress`：拉取云端进度
  - `clearPrivateProgressForPaper`：清空某卷待同步队列
  - `generateAttemptId`：生成新练习轮次 ID
  - 冲突回调：`onConflict(paperId, serverProgress)`
  - 账号切换保护：`activeUserId()` 校验，切换后停止推送
  - 返回 `{ applied, failed, conflicts, revisions }`

### 2.4 StudyClient 集成

- `src/app/me/private-papers/[paperId]/study/StudyClient.tsx`
  - **云端拉取水合**：打开页面时先 GET 云端进度，优先采用云端（答案更多/已提交），否则推送本地
  - **debounce 推送**：选答案后 1.2s 防抖入队并推送，高频操作不频繁写 localStorage
  - **同步状态**：`local_saved` / `pending` / `synced` / `failed` / `conflict`，UI 显示对应提示
  - **冲突解决弹窗**：revision 冲突时显示本地 vs 云端对比，提供"采用云端"/"保留本地"/"重新开始"
  - **attemptId 隔离**：重新练习生成新 attemptId，旧轮次迟到请求被服务端拒绝（attempt_mismatch）
  - **本地恢复**：sessionStorage 存档支持 attemptId 字段（version=3）
  - **重试**：同步失败后可手动点击重试
  - **迟到响应保护**：`activeBinding` + `requestId` 机制，账号切换/页面卸载后忽略旧响应

### 2.5 其他修改

- `src/lib/private-papers/http.ts`：添加 `PrivatePaperProgressStoreError` 错误映射（CONFLICT→409, CONTENT_CHANGED→410, NOT_READY→409）
- `src/lib/private-papers/progress-storage.ts`：添加 `attemptId` 可选字段到 `StudyProgressState`
- `src/content/private-paper-store.ts`：`deletePrivatePaper` 级联删除 `PrivatePaperProgress`
- `src/lib/sync/client.ts`：`MERGE_POLICY` 添加 `privateProgress: "snapshot"`
- `src/app/globals.css`：同步状态样式（由另一个 AI 添加）

## 3. 测试

### 3.1 回归测试

- `tests/v14-private-progress-api.test.ts`：服务端存储 + API 集成测试（真实 Prisma，隔离随机用户）
  - GET：空 userId/越权 → NOT_FOUND、跨 owner → NOT_FOUND、无进度 → null、有进度 → 返回、contentHash 不匹配 → null、answers 净化
  - PUT：首次创建、revision 递增、revision 冲突 + 服务端进度、attemptId 不匹配、contentHash 变化、草稿 not_ready、非法 answers 422、currentIndex 钳位、submitted 非 boolean 拒绝、幂等性
  - API：未登录 → 401（GET + PUT）

### 3.2 测试结果

```
npm test: 767/767 PASS
npm run typecheck: PASS
npm run lint -- --max-warnings 0: PASS (0 errors, 0 warnings)
npm run build: PASS
npm run content:validate: PASS (0 errors, 0 warnings)
npm run content:stats: PASS
npm run content:rights: PASS
npm run content:audio-validate: PASS (0 errors, 1 expected warning)
```

**8/8 gates PASS**

## 4. 同步状态机

```
local_saved ──(用户作答, debounce)──→ pending ──(push成功)──→ synced
    ↑                                          │
    │                                          ├──(网络失败)──→ failed ──(手动重试)──→ pending
    │                                          │
    │                                          └──(revision冲突)──→ conflict ──(用户决策)──→ synced/local_saved
    │
    └──(采用云端/重新开始)── 重置
```

## 5. 冲突解决策略

| 冲突类型 | 服务端行为 | 客户端行为 |
|---------|-----------|-----------|
| revision_conflict | 409 + serverProgress | 弹窗：采用云端/保留本地(强制覆盖)/重新开始 |
| attempt_mismatch | 409 | 从队列移除（旧练习轮次，不覆盖新练习） |
| content_changed | 410 | 显示"试卷内容已更新"，清空本地进度，不重试 |
| not_ready | 409 | 阻止提交，显示原因 |
| 网络错误 | - | 保留在队列，标记 failed，可手动重试 |

## 6. 恢复优先级

1. **云端进度优先**：GET 云端，有进度且 contentHash 匹配 → 采用云端
2. **本地 sessionStorage**：云端无进度时，检查本地存档，有有效进度 → 采用并立即上传
3. **全新开始**：两者都无 → 初始状态

**关键规则**：云端恢复的进度不自动入队（避免 push/pull 循环）；只有用户主动修改才触发入队。

## 7. 边界与隔离

- PRIVATE 进度**不**进入全局 LearningSession / XP / Review / Daily Plan
- 不调用 `enqueueSession`、`enqueueXpEvent` 等 V12 全局同步适配器
- 私有练习队列使用独立推送逻辑，不与 V12 全局 sync push 混合
- V12 队列按 userId 分 key，A 的待同步队列不会作为 B 推送
- 账号切换后 `activeBinding.current = null`，所有旧响应被忽略

## 8. 已知限制

- 同一练习的 revision 冲突不自动合并 answers，需用户手动决策
- 同步状态仅在学习页显示，列表页/详情页不显示同步状态
- 离线时队列持久化在 localStorage，但 sessionStorage 中的答题状态在关闭标签页后丢失（与 Phase 1D.1 一致）。下次打开时从云端恢复
- 不支持多标签页同时作答同一篇卷（两个标签页会产生 revision 冲突）
- 手机宽度为桌面 Chrome 模拟视口，未做真机软键盘测试
- 浏览器 E2E 多宽度验证待执行

## 9. 文件清单

### 新增
- `prisma/migrations/20261001111004_add_private_paper_progress/migration.sql`
- `src/content/private-paper-progress-store.ts`
- `src/lib/private-papers/progress-sync.ts`
- `src/app/api/private-papers/[paperId]/progress/route.ts`
- `tests/v14-private-progress-api.test.ts`
- `V14_PHASE1E1_DESIGN.md`
- `V14_PHASE1E1_REPORT.md`（本文件）

### 修改
- `prisma/schema.prisma`
- `src/lib/private-papers/http.ts`
- `src/lib/private-papers/progress-storage.ts`
- `src/content/private-paper-store.ts`
- `src/lib/sync/client.ts`
- `src/app/me/private-papers/[paperId]/study/StudyClient.tsx`
- `src/app/globals.css`

## 10. 结论

V14 Phase 1E.1 私有卷学习进度云同步 MVP 核心功能已实现：
- 服务端存储 + API 路由 ✓
- 客户端同步适配（复用 V12 队列） ✓
- StudyClient 集成（水合/推送/冲突/重试） ✓
- 回归测试（767/767） ✓
- 8/8 gates PASS ✓

待完成：浏览器 E2E 多宽度验证、文档更新（PROJECT_CONTEXT.md）。
