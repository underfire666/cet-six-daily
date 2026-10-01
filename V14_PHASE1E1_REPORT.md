# V14 Phase 1E.1 — Private Study Progress Sync MVP 最终报告

日期：2026-10-01
分支：feature/v14-real-content-rights
状态：实现及验收通过；GitHub 推送因网络不可达失败，本地 commit 已完成（见 output/v14e1-git-closure.md）。

## 1. 目标

在 Phase 1D.1 私有卷学习 MVP（reading/careful_reading/choice，进度仅 sessionStorage）基础上，实现同一账号跨浏览器/设备恢复答案、当前题号及已提交结果；网络失败时保留本地作答，恢复后可重试。复用 V12 账号隔离队列/重试/同步状态机制，不重写现有同步系统。

## 2. 数据结构

### Prisma 模型：PrivatePaperProgress

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| userId | String | 所有者（外键 User，ON DELETE CASCADE） |
| paperId | String | 私有卷 stable id |
| attemptId | String | 练习轮次 ID（客户端生成 UUID），重新练习时新建 |
| contentHash | String | 内容指纹（v3:fnv1a64） |
| progressVersion | Int | 进度格式版本（当前=1） |
| answers | Json | { "0": "opt_a", "1": "opt_b", ... } |
| currentIndex | Int | 当前题号 |
| submitted | Boolean | 是否已提交 |
| revision | Int | 乐观并发控制版本号，每次写入递增 |
| createdAt / updatedAt | DateTime | 时间戳 |

约束：`@@unique([userId, paperId])`（每用户每卷一条最新进度），`@@index([userId])`。

Migration：`20261001111004_add_private_paper_progress`（已应用到 PostgreSQL，未 reset 数据库）。

不存储分数：读取时由调用方按当前试卷答案重算，不信任客户端分数。

## 3. API 契约

### GET /api/private-papers/[paperId]/progress
- 未登录 → 401
- 试卷不存在/跨 owner → 404
- 无进度记录或 contentHash 不匹配 → 200 `{ exists: false, progress: null }`
- 有进度 → 200 `{ exists: true, progress: { paperId, attemptId, contentHash, answers, currentIndex, submitted, revision, updatedAt } }`
- 服务端净化：非法 answers 条目静默丢弃

### PUT /api/private-papers/[paperId]/progress
请求体：`{ attemptId, mutationId, contentHash, answers, currentIndex, submitted, baseRevision, progressVersion, mode }`
- mode = "save"（默认，更新现有练习）| "restart"（重新练习，允许新 attemptId 覆盖）
- mutationId：客户端幂等键，服务端通过 SyncMutation 表去重

成功 → 200 `{ ok: true, revision, updatedAt }`

错误码：
| HTTP | error | 含义 |
|------|-------|------|
| 401 | unauthorized | 未登录 |
| 404 | not_found | 试卷不存在或无权限 |
| 409 | revision_conflict | 版本冲突，返回 currentRevision + serverProgress |
| 409 | attempt_mismatch | 旧练习轮次（mode=save 时 attemptId 不匹配） |
| 409 | not_ready | 试卷变草稿或不再支持 |
| 409 | content_changed | 内容指纹变化 |
| 422 | validation_error | answers/currentIndex 等字段非法 |

服务端每次读写：确认 owner 可访问该私有卷 → 校验 readiness/contentHash → 校验答案属于真实选项 → 不信任客户端分数。使用 `SELECT ... FOR UPDATE` 行级锁序列化并发写入。

## 4. 同步策略（复用 V12）

### 队列复用
- 复用 V12 的 `enqueueMutation`/`loadQueue`/`saveQueue` 数据结构和 localStorage 持久化
- entityType = "privateProgress"，合并策略 "snapshot"（同 paperId 只留最新）
- 队列按 userId 分 key（`cet-daily:v12:sync-queue:${userId}`），账号隔离
- V12 `loadQueue` 重命名为 `loadGlobalQueue` 以区分全局同步队列和私有进度队列

### 独立推送
- `pushPrivateProgressQueue()` 逐个 PUT 到 `/api/private-papers/[paperId]/progress`，不走 V12 `/api/sync/push` 批量端点
- 原因：PRIVATE 进度需要 per-paper 的 revision 条件更新和冲突决策，与 V12 fire-and-forget 批量模式不同
- SyncProvider 在全局 auto-sync 时也推送私有进度队列（不阻塞全局同步）

### 高频选答案合并
- StudyClient 中 500ms debounce 入队，连续选答案只产生一次队列写入
- 提交（submitted=true）时立即 flush debounce 并推送
- snapshot 合并策略保证同 paperId 队列中只留最新状态

### 四种同步状态
| 状态 | 含义 |
|------|------|
| local_saved | 本地 sessionStorage 已保存，debounce 中尚未入队 |
| pending | 已入队，正在同步或等待同步 |
| synced | 最近一次同步成功 |
| failed | 同步失败（网络/服务器错误），本地保留，可手动重试 |
| conflict | revision 冲突，等待用户决策 |

## 5. 恢复优先级

打开学习页时：
1. **云端进度优先**：先 GET 云端进度。有进度且 contentHash 匹配 → 采用云端，设置 knownRevision，**不**入队（避免 push/pull 循环）
2. **本地 sessionStorage**：云端无进度时，检查本地存档。有有效进度 → 采用并立即入队（baseRevision=0 创建）
3. **全新开始**：两者都无 → 初始状态，生成新 attemptId

云端恢复的进度同时保存到 sessionStorage，保持本地与云端一致。

## 6. 冲突解决

### revision 条件更新
- 客户端每次成功 PUT 后更新 knownRevision
- 下一次 PUT 携带 baseRevision = knownRevision
- 服务端校验 revision === baseRevision 才更新并递增；不匹配返回 409 + 服务端最新进度

### 冲突时用户决策
409 revision_conflict 时显示弹窗，提供三选项：
- **采用云端**：丢弃本地答案，加载云端进度，更新 knownRevision，清空队列中该 paperId 的 pending mutation
- **保留本地**：以云端当前 revision 为 baseRevision 重新 PUT（强制覆盖），成功后更新 knownRevision
- **重新开始**：生成新 attemptId，mode="restart"，清空本地和队列，从第一题开始

不自动合并两次不同练习的答案。

### 重新练习
- 生成新 attemptId = crypto.randomUUID()
- 发送 mode="restart"，baseRevision=0
- 服务端 restart 模式允许新 attemptId 覆盖旧记录（@@unique 约束保证每用户每卷一条）
- 旧设备/旧请求携带旧 attemptId + mode="save" → 服务端返回 409 attempt_mismatch，客户端丢弃（不覆盖新练习）

### 幂等性
- 每个 mutation 携带 mutationId（UUID）
- 服务端通过 SyncMutation 表（@@unique([userId, mutationId])）去重
- 重复 mutation 返回首次结果，不重复写入

## 7. 内容变化、删除和账号切换

### 内容指纹变化
- 每次 GET/PUT 校验 contentHash
- 变化后 GET 返回 exists:false（旧进度不恢复），PUT 返回 409 content_changed
- 客户端显示"试卷内容已更新，旧作答进度已失效"，清空本地进度，不自动重试

### 试卷变草稿/不再支持
- PUT 时 checkPrivatePaperReadiness 返回 not ready → 409 not_ready
- 客户端阻止提交，显示原因
- 已提交结果在重新验证时也检查 ready

### 试卷删除
- GET/PUT 时 getPrivatePaper 返回 404 → progress API 也返回 404
- 队列中该 paperId 的 pending mutation 推送时收到 404，从队列移除（不重建试卷或进度）
- PrivatePaperProgress 外键 ON DELETE CASCADE，删除试卷时级联删除进度

### 账号切换
- V12 队列按 userId 分 key，A 的待同步队列不会作为 B 推送
- StudyClient identityMatches 检查：session.user.id !== ownerId 时立即隐藏题目
- activeBinding ref 在身份变化时置 null，所有进行中的请求回调被忽略
- requestId 递增 + AbortController 取消旧请求
- 云端恢复的进度绑定 ownerId，B 登录后查不到 A 的记录

### 迟到响应
- 所有 fetch 请求携带递增 requestId，回调时检查 id === requestId.current
- activeBinding.current !== binding 时忽略响应
- 账号切换后 activeBinding.current = null，所有旧响应被忽略

## 8. 旧存档处理

- Phase 1D.1 的 sessionStorage 存档（version=3）继续有效，作为本地恢复的第二优先级
- 新增 attemptId 可选字段到 StudyProgressState（向后兼容）
- 云端进度恢复后，sessionStorage 被云端进度覆盖
- 旧版/坏存档（version≠3、损坏、owner_mismatch、content_changed）按 Phase 1D.1 现有逻辑拒绝，显示提示
- 云端不存在旧进度记录时（首次使用同步功能），本地 sessionStorage 进度自动上传

## 9. PRIVATE 进度隔离

- 不进入全局 LearningSession、XP、Review、Daily Plan
- 不调用 enqueueSession、enqueueXpEvent 等 V12 全局同步适配器
- 不写入 cet-* localStorage 全局学习记录
- 私有练习队列使用独立推送逻辑，不与 V12 全局 sync push 混合
- 账号页面只显示全局同步 pending 计数（loadGlobalQueue），不显示私有进度

## 10. 测试证据

### 自动测试
- **npm test：791/791 PASS**（Phase 1D.1 基线 748 + 新增 43 项私有进度同步专项）
- 专项测试：tests/v14-private-progress-api.test.ts（真实 Prisma，隔离随机用户）+ tests/v14-private-progress-sync.test.ts（mock fetch）

### 12 类回归测试覆盖
1. 同账号两个独立浏览器恢复未完成进度 → E2E S1 PASS + 单元测试（fetchRemoteProgress + 云端水合）
2. 已提交结果在另一浏览器恢复 → E2E S2 PASS + 单元测试（submitted=true 往返）
3. 离线作答后联网同步，刷新仍能恢复 → 单元测试（网络失败保留队列 + 重试成功）
4. 网络失败、本地存储失败及重试 → 单元测试（push 失败保留队列 + failed 状态 + 手动重试）
5. 重复 mutation 幂等 → 服务端 SyncMutation 去重测试 + 客户端 mutationId 测试
6. 两端 revision 冲突，不丢失本地答案 → 单元测试（409 revision_conflict + serverProgress + 保留本地选项）
7. 重新练习后旧请求不能回写 → 单元测试（mode=restart + attempt_mismatch 拒绝旧请求）
8. 内容更新、草稿状态和试卷删除 → 单元测试（content_changed 409 + not_ready 409 + 404 出队）
9. 双账号隔离、伪造 owner、非法选项和坏存档 → 单元测试（跨 owner 404 + 非法 answers 422 + 坏存档拒绝）
10. 迟到响应不能覆盖当前账号或当前练习 → 单元测试（activeUserId 切换保护 + requestId 机制）
11. PRIVATE 学习不增加全局 XP、Streak 或统计 → 单元测试（不调用 enqueueXpEvent + 不写 cet-* localStorage）+ V12 同步回归无回归
12. 原 V12 同步和 Phase 1D.1 学习流程无回归 → 791/791 全量通过（含所有 V12 和 Phase 1D.1 测试）

### 8/8 Gates
| 检查 | 结果 |
|------|------|
| npm test | 791/791 PASS |
| typecheck | PASS |
| lint --max-warnings 0 | PASS（0 error / 0 warning） |
| build | PASS |
| content:validate | PASS（0 error / 0 warning） |
| content:stats | PASS（production pool = Paper 001） |
| content:rights | PASS（production pool 仅 allowed 内容） |
| content:audio-validate | PASS（0 error，1 个允许的 fixture placeholder warning） |

### 浏览器 E2E
生产构建 + Playwright chromium + 两个独立 browserContext 模拟两台设备，隔离测试账号（测试后级联清理）。

| 场景 | 结果 | 关键证据 |
|------|------|----------|
| S1 跨浏览器恢复未完成进度 | PASS | 设备 B 恢复：当前题号=第 3/3 题，Q1/Q2 已选 |
| S2 已提交结果跨浏览器恢复 | PASS | 设备 B 直接显示结果页：66.7%（2/3），答案高亮+解析 |
| S3 同步状态显示 | PASS | banner 正确流转：已同步→本地保存→正在同步→已同步 |
| S4 重新练习 | PASS（修复后） | 初始 E2E 发现云端未被新练习覆盖（mode=save 时 attempt_mismatch）；已通过引入 mode=restart 修复，服务端允许新 attemptId 覆盖 |
| S5 账号切换隔离 | PASS | B 看不到 A 的私有卷；B 打开 A 的卷 URL 显示 404 |
| S6 5 宽度布局 | PASS | 375/390/430/768/1440 均无横向溢出 |

截图 15 张保存于 output/v14e1-screenshots/（本地保留，不上传公开附件）。
测试脚本：output/v14e1-e2e.js；结果汇总：output/v14e1-browser-results.json。

## 11. 文件清单

### 新增
- prisma/migrations/20261001111004_add_private_paper_progress/
- src/content/private-paper-progress-store.ts
- src/lib/private-papers/progress-sync.ts
- src/app/api/private-papers/[paperId]/progress/route.ts
- tests/v14-private-progress-api.test.ts
- tests/v14-private-progress-sync.test.ts
- V14_PHASE1E1_DESIGN.md
- V14_PHASE1E1_REPORT.md（本文件）

### 修改
- prisma/schema.prisma（PrivatePaperProgress model + User 关系）
- src/lib/sync/client.ts（MERGE_POLICY 添加 privateProgress；loadQueue→loadGlobalQueue）
- src/lib/private-papers/progress-storage.ts（attemptId 可选字段）
- src/content/private-paper-store.ts（deletePrivatePaper 级联）
- src/app/me/private-papers/[paperId]/study/StudyClient.tsx（同步集成）
- src/app/api/private-papers/[paperId]/progress/route.ts（错误映射）
- src/components/sync/SyncProvider.tsx（auto-sync 时推送私有进度）
- src/app/me/account/page.tsx（使用 loadGlobalQueue）
- src/app/globals.css（同步状态 banner + 冲突弹窗样式）
- PROJECT_CONTEXT.md（追加 Phase 1E.1 章节）
- tests/v14-private-paper-store.test.ts（适配新 API）

## 12. 已知限制

- 同一练习的 revision 冲突不自动合并 answers，需用户手动决策（采用云端/保留本地/重新开始）
- 同步状态仅在学习页显示，列表页/详情页不显示同步状态
- 离线时队列持久化在 localStorage，但 sessionStorage 中的答题状态在关闭标签页后丢失（与 Phase 1D.1 一致）；下次打开时从云端恢复
- 不支持多标签页同时作答同一篇卷（两个标签页会产生 revision 冲突）
- 手机宽度为桌面 Chrome 模拟视口，未做真机软键盘/屏幕阅读器或跨浏览器测试
- GitHub 推送因网络不可达失败（Connection reset / timeout），本地 commit 已完成；待网络恢复后需手动 push
- 权限与内容验证是每次操作前的快照，不提供数据库事务式服务器结算

## 13. 最终字段

- PRIVATE_LEARNING_FLOW = LIMITED_READING_CHOICE_MVP
- PRIVATE_PROGRESS = CLOUD_SYNCED
- PRIVATE_SYNC = IMPLEMENTED（V12 队列复用 + 专用端点 + revision 乐观并发）
- PRIVATE_REVIEW = NOT_IMPLEMENTED
- PRIVATE_DAILY_PLAN = NOT_IMPLEMENTED
- PRIVATE_XP = NOT_IMPLEMENTED
- PHASE_1E_STARTED = YES（1E.1 完成，未开始 1E.2）
- 无 Paper 001 内容变更，无 main/tag/Release 变更

完成 Phase 1E.1 后停止，等待验收。