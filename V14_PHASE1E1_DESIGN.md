# V14 Phase 1E.1 — Private Study Progress Sync 设计说明

日期：2026-10-01
分支：feature/v14-real-content-rights

## 1. 数据模型

### Prisma 模型：PrivatePaperProgress

```prisma
model PrivatePaperProgress {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  paperId       String   // 私有卷 stable id（private:... 格式）
  attemptId     String   // 客户端生成的练习轮次 ID（UUID），重新练习时新建
  contentHash   String   // 内容指纹（v3:fnv1a64），与 readiness.computePrivateContentHash 一致
  answers       Json     // { "0": "opt_a", "1": "opt_b", ... } 键为规范非负整数字符串
  currentIndex  Int      @default(0)
  submitted     Boolean  @default(false)
  revision      Int      @default(1)  // 乐观并发控制版本号，每次写入递增
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)

  @@unique([userId, paperId])
  @@index([userId])
}
```

- `@@unique([userId, paperId])`：每个用户每篇私有卷只有一条最新进度记录。
- `attemptId`：区分不同练习轮次。重新练习生成新 attemptId，旧 attemptId 的迟到请求不能覆盖。
- `revision`：乐观并发控制。PUT 必须携带 `baseRevision`，服务端校验 `revision === baseRevision` 才更新并递增。
- `answers` 存 JSON 对象，键为题目序号字符串（与 progress-storage.ts 的 Record<number, string> 序列化后一致）。
- 不存分数：服务端每次读取时按当前试卷答案重算，不信任客户端分数。

### User 模型关系

在 User model 中添加：`privatePaperProgresses PrivatePaperProgress[]`

## 2. API 契约

### GET /api/private-papers/[paperId]/progress

读取当前用户的私有卷进度。

**请求**：无 body。

**响应 200**：
```json
{
  "exists": true,
  "progress": {
    "paperId": "private:...",
    "attemptId": "uuid",
    "contentHash": "v3:abc123",
    "answers": { "0": "opt_a" },
    "currentIndex": 2,
    "submitted": false,
    "revision": 3,
    "updatedAt": "2026-10-01T12:00:00.000Z"
  }
}
```

**响应 404**（无进度记录）：
```json
{ "exists": false, "progress": null }
```

**服务端校验流程**：
1. `auth()` 获取 session ownerId，未登录 → 401。
2. `getPrivatePaper(ownerId, paperId)` 确认所有者可访问 → 不存在/跨 owner 统一 404。
3. `checkPrivatePaperReadiness(paper.content)` 校验 readiness 和 contentHash。
4. 查 `PrivatePaperProgress` where `{ userId, paperId }`。
5. 若记录存在但 `contentHash` 不匹配当前试卷 → 返回 `exists: false`（旧进度不能恢复）。
6. 校验 answers 中的每个值都是对应题目的合法 optionId；非法答案丢弃（不返回错误，但记录被净化）。
7. 返回进度。

### PUT /api/private-papers/[paperId]/progress

写入（条件更新）当前用户的私有卷进度。

**请求 body**：
```json
{
  "attemptId": "uuid",
  "contentHash": "v3:abc123",
  "answers": { "0": "opt_a", "1": "opt_b" },
  "currentIndex": 2,
  "submitted": false,
  "baseRevision": 3
}
```

- `baseRevision`：客户端基于的服务端版本号。首次写入（无现有记录）传 `0` 或省略。
- `attemptId`：必须与现有记录的 attemptId 匹配（若存在）；不匹配 → 409 CONFLICT（旧练习轮次不能覆盖新练习）。

**响应 200**（写入成功）：
```json
{
  "ok": true,
  "revision": 4,
  "updatedAt": "2026-10-01T12:01:00.000Z"
}
```

**响应 409**（revision 冲突）：
```json
{
  "ok": false,
  "error": "revision_conflict",
  "currentRevision": 5,
  "serverProgress": { ... }  // 服务端最新进度，供客户端决策
}
```

**响应 409**（attemptId 不匹配）：
```json
{
  "ok": false,
  "error": "attempt_mismatch",
  "currentAttemptId": "new-uuid"
}
```

**服务端校验流程**：
1. `auth()` → ownerId，未登录 401。
2. `getPrivatePaper(ownerId, paperId)` → 404。
3. `checkPrivatePaperReadiness` → 若 not ready（草稿/不支持内容）→ 409 `not_ready`，不能继续提交或同步。
4. 校验 `contentHash` 匹配 → 不匹配 → 409 `content_changed`。
5. 校验 answers：键必须为规范非负整数字符串，值必须是对应题目的合法 optionId；越界索引忽略，非法值拒绝（422）。
6. 校验 `currentIndex` 为安全整数且在范围内。
7. 校验 `submitted` 为 boolean。
8. 查现有记录：
   - 不存在：创建新记录（revision=1），要求 baseRevision ≤ 1。
   - 存在且 `attemptId` 不匹配 → 409 `attempt_mismatch`。
   - 存在且 `revision !== baseRevision` → 409 `revision_conflict`，返回服务端最新进度。
   - 存在且匹配：更新 answers/currentIndex/submitted，`revision += 1`。
9. 使用 Prisma 事务保证原子性（先查后写）。
10. 不信任客户端分数：不存储 score，读取时重算。

### 错误码汇总

| HTTP | error | 含义 |
|------|-------|------|
| 401 | unauthorized | 未登录 |
| 404 | not_found | 试卷不存在或无权限（GET progress 无记录也返回 exists:false 而非 404） |
| 409 | revision_conflict | 版本冲突，服务端有更新版本 |
| 409 | attempt_mismatch | attemptId 不匹配（旧练习轮次） |
| 409 | content_changed | 内容指纹变化 |
| 409 | not_ready | 试卷变草稿或不再支持 |
| 422 | validation_error | answers/currentIndex 等字段非法 |

## 3. 同步策略（复用 V12）

### 3.1 队列复用

V12 的 `src/lib/sync/client.ts` 提供了：
- 账号隔离队列（`queueKey(userId)` → `cet-daily:v12:sync-queue:${userId}`）
- `enqueueMutation()` 自动生成 mutationId、合并策略、持久化到 localStorage
- `pushQueue()` 批量推送、重试、账号切换保护
- `MERGE_POLICY` 按 entityType 决定合并策略

**PRIVATE 进度适配**：
- 新增 entityType `"privateProgress"`，合并策略 `"snapshot"`（同一 paperId 只保留最新状态）。
- 在 `MERGE_POLICY` 中添加：`privateProgress: "snapshot"`。
- `entityId` = paperId（同一用户同一篇卷只有一条进度）。
- `operation` = `"upsert"`。
- `payload` = `{ attemptId, contentHash, answers, currentIndex, submitted, baseRevision }`。

**注意**：PRIVATE 进度**不**走 V12 的 `/api/sync/push` 端点（那个端点的 `applyMutationInTx` 不认识 privateProgress entityType，且 V12 sync 是全局快照式同步）。PRIVATE 进度有自己的 PUT 端点，因为它需要 revision 条件更新和 contentHash 校验。

因此，PRIVATE 进度的"队列复用"是指：
1. 复用 V12 的**队列数据结构和持久化机制**（localStorage、账号隔离 key、mutationId 幂等）。
2. 复用 V12 的**队列合并策略**（snapshot：同 entityId 只留最新）。
3. **不**复用 V12 的 pushQueue（它 POST 到 /api/sync/push），而是写一个独立的 `pushPrivateProgressQueue()` 函数，从队列中取出 privateProgress 类型的 mutation，逐个 PUT 到 `/api/private-papers/[paperId]/progress`。

这样做的理由：
- V12 push 是批量 POST 到单一端点，服务端按 entityType 分发。
- PRIVATE 进度需要 per-paper 的 revision 条件更新，返回 409 时需要客户端决策（采用云端/保留本地/重新开始），这与 V12 的 fire-and-forget 批量推送模式不同。
- 复用队列结构保证了账号隔离、持久化、mutationId 幂等、合并策略这些已经验证过的机制。

### 3.2 新模块：src/lib/private-papers/progress-sync.ts

```typescript
// 队列操作（复用 V12 队列结构，但独立推送）
export function enqueuePrivateProgress(paperId: string, payload: PrivateProgressPayload): QueuedMutation
export function loadPrivateProgressQueue(userId: string): QueuedMutation[]
export function savePrivateProgressQueue(queue: QueuedMutation[], userId: string): void

// 推送（独立实现，逐个 PUT，处理 revision 冲突）
export async function pushPrivateProgressQueue(options: {
  userId: string
  fetchImpl?: typeof fetch
  onConflict?: (paperId: string, serverProgress: RemoteProgress) => void
}): Promise<{ applied: number; failed: number; conflicts: string[] }>

// 拉取云端进度
export async function fetchRemoteProgress(paperId: string, fetchImpl?: typeof fetch): Promise<RemoteProgress | null>

// 同步状态
export type PrivateSyncStatus = "local_saved" | "pending" | "synced" | "failed" | "conflict"
```

### 3.3 高频选答案合并

用户快速连续选答案时，每次 `selectAnswer` 都会产生一个 mutation。由于合并策略是 `"snapshot"`（同 entityId 只留最新），队列中同一 paperId 只会保留最后一个 mutation。但这意味着：
- 每次选答案都调用 `enqueueMutation`，它会 `loadQueue → applyQueueMerge → push → saveQueue`，涉及 localStorage 读写。
- 高频操作下可能有性能问题。

**方案**：在 StudyClient 中使用 debounce（500ms），将连续的答案选择合并为一次入队。debounce 期间状态已更新到内存和 sessionStorage，入队延迟不影响本地体验。debounce 取消时（如提交、重新练习）立即 flush。

### 3.4 四种同步状态

| 状态 | 含义 | UI 提示 |
|------|------|---------|
| `local_saved` | 本地 sessionStorage 已保存，尚未入队（debounce 中） | "进度已保存在本地" |
| `pending` | 已入队，等待同步（或正在同步） | "正在同步到云端…" |
| `synced` | 最近一次同步成功 | "进度已同步到云端" |
| `failed` | 同步失败（网络/服务器错误），本地保留 | "同步失败，将在网络恢复后重试" |
| `conflict` | revision 冲突，等待用户决策 | "检测到其他设备的更新，请选择" |

## 4. 冲突解决

### 4.1 revision 条件更新

- 客户端每次成功 PUT 后更新本地 `knownRevision`。
- 下一次 PUT 携带 `baseRevision: knownRevision`。
- 服务端校验 `revision === baseRevision`，不匹配返回 409 + 服务端最新进度。

### 4.2 冲突时的用户决策

当 PUT 返回 409 `revision_conflict` 时：
1. 停止自动重试该 paperId 的队列。
2. 显示冲突弹窗，展示：
   - 本地进度（已答题数、当前题、是否已提交）
   - 云端进度（已答题数、当前题、是否已提交、更新时间）
3. 提供三个选项：
   - **采用云端**：丢弃本地答案，加载云端进度，更新 knownRevision，清空队列中该 paperId 的 pending mutation。
   - **保留本地**：以云端当前 revision 为 baseRevision，强制覆盖云端（PUT with baseRevision = serverRevision）。这会递增服务端 revision。
   - **重新开始**：清空本地和云端进度，生成新 attemptId，从第一题开始。

### 4.3 不自动合并

- 两次不同练习的答案不自动合并（attemptId 不同直接拒绝）。
- 同一练习的 revision 冲突也不自动合并 answers（可能是两端答了不同题，合并语义不明确），由用户决策。

### 4.4 重新练习

- "重新练习"按钮生成新的 `attemptId = crypto.randomUUID()`。
- 清空本地 sessionStorage 和队列中该 paperId 的 pending mutation。
- PUT 新进度（空 answers, currentIndex=0, submitted=false, 新 attemptId）。
- 服务端校验 attemptId 不匹配时返回 409 `attempt_mismatch`，客户端收到后用新 attemptId 重新 PUT（baseRevision=0 创建新记录）。
- 旧设备/旧请求携带旧 attemptId，服务端返回 409 `attempt_mismatch`，不能覆盖新练习。

## 5. 恢复优先级

打开学习页时，按以下优先级恢复进度：

1. **云端进度优先**：先 GET `/api/private-papers/[paperId]/progress`。
   - 若云端有进度且 contentHash 匹配 → 采用云端进度，设置 knownRevision。
   - 若云端无进度或 contentHash 不匹配 → 继续下一步。
2. **本地 sessionStorage**：若云端无进度，检查本地 sessionStorage（Phase 1D.1 的 `loadStudyProgress`）。
   - 若本地有有效进度 → 采用本地进度，并立即入队同步到云端。
3. **全新开始**：若两者都无 → 初始状态。

**关键规则**：
- 云端恢复的进度**不**自动入队（避免 push/pull 循环：从云端拉取的内容不应再推回云端）。
- 只有用户主动修改（选答案、切题、提交）才触发入队。
- 本地 sessionStorage 进度在云端无记录时，首次入队使用 baseRevision=0（创建）。

## 6. 内容变化、删除和账号切换

### 6.1 内容指纹变化

- 每次 GET/PUT progress 都校验 contentHash。
- 内容变化后：
  - GET 返回 `exists: false`（旧进度不恢复）。
  - PUT 返回 409 `content_changed`。
  - 客户端显示"试卷内容已更新，旧作答进度已失效"，清空本地进度，不自动重试。

### 6.2 试卷变草稿/不再支持

- PUT 时 `checkPrivatePaperReadiness` 返回 not ready → 409 `not_ready`。
- 客户端阻止提交，显示原因。
- 已提交结果在重新验证时也检查 ready，not ready 则撤销结果显示。

### 6.3 试卷删除

- GET/PUT progress 时 `getPrivatePaper` 返回 404 → progress API 也返回 404。
- 客户端显示"该私有卷已被删除"，隐藏题目。
- 队列中该 paperId 的 pending mutation：推送时收到 404，从队列中移除（不重建试卷或进度）。
- 旧同步请求的迟到响应：通过 requestId/activeBinding 机制忽略，不写入当前状态。

### 6.4 账号切换

- V12 队列按 userId 分 key，A 的待同步队列不会作为 B 推送。
- StudyClient 的 `identityMatches` 检查：session.user.id !== ownerId 时立即隐藏题目。
- `activeBinding` ref 在身份变化时置 null，所有进行中的请求回调被忽略。
- `requestId` 递增 + AbortController 取消旧请求。
- 云端恢复的进度绑定 ownerId，B 登录后不会恢复 A 的进度（GET progress 用 B 的 session，查不到 A 的记录）。

### 6.5 迟到响应

- 所有 fetch 请求携带递增 requestId，回调时检查 `id === requestId.current`。
- `activeBinding.current !== binding` 时忽略响应。
- 账号切换后 `activeBinding.current = null`，所有旧响应被忽略。
- 重新练习后 attemptId 变化，旧 PUT 的 409 attempt_mismatch 被正常处理（不覆盖新练习）。

## 7. 旧存档处理

- Phase 1D.1 的 sessionStorage 存档（version=3）继续有效，作为本地恢复的第二优先级。
- 云端进度恢复后，sessionStorage 被云端进度覆盖（保持一致）。
- 旧版/坏存档（version≠3、损坏、owner_mismatch、content_changed）按 Phase 1D.1 现有逻辑拒绝，显示提示。
- 云端不存在旧进度记录时（首次使用同步功能），本地 sessionStorage 进度自动上传。

## 8. PRIVATE 进度隔离

- PRIVATE 进度**不**进入全局 LearningSession、XP、Review、Daily Plan。
- 不调用 `enqueueSession`、`enqueueXpEvent` 等 V12 全局同步适配器。
- 不写入 `cet-daily:*` localStorage 键（全局学习记录）。
- 私有练习的队列使用独立的推送逻辑，不与 V12 全局 sync push 混合。

## 9. 文件清单

### 新增
- `prisma/migrations/*_private_paper_progress/`（migration）
- `src/lib/private-papers/progress-sync.ts`（客户端同步适配器）
- `src/app/api/private-papers/[paperId]/progress/route.ts`（API 路由）
- `src/content/private-paper-progress-store.ts`（服务端进度 CRUD + 校验）
- `tests/v14-private-progress-sync.test.ts`（同步专项测试）
- `tests/v14-private-progress-api.test.ts`（API 集成测试）
- `V14_PHASE1E1_REPORT.md`（最终报告）
- `V14_PHASE1E1_DESIGN.md`（本设计文档）

### 修改
- `prisma/schema.prisma`（新增 PrivatePaperProgress model + User relation）
- `src/lib/sync/client.ts`（MERGE_POLICY 添加 privateProgress: "snapshot"）
- `src/app/me/private-papers/[paperId]/study/StudyClient.tsx`（集成同步）
- `src/app/me/private-papers/[paperId]/study/page.tsx`（可能需要传递初始云端进度）
- `src/app/globals.css`（同步状态 banner、冲突弹窗样式）
- `PROJECT_CONTEXT.md`（追加 Phase 1E 章节）

## 10. 已知限制

- 同一练习的 revision 冲突不自动合并 answers，需用户手动决策。
- 同步状态仅在学习页显示，列表页/详情页不显示同步状态。
- 离线时队列持久化在 localStorage，但 sessionStorage 中的答题状态在关闭标签页后丢失（与 Phase 1D.1 一致）。下次打开时从云端恢复。
- 不支持多标签页同时作答同一篇卷（两个标签页会产生 revision 冲突）。
- 手机宽度为桌面 Chrome 模拟视口，未做真机软键盘测试。
