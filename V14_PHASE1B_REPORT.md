# V14 Phase 1B — Private Storage Layer 报告

**日期**: 2026-10-01
**分支**: feature/v14-real-content-rights
**基线**: 797240b (Phase 1A Final)

## 1. 存储方案

### 选择理由
- 复用现有 PostgreSQL + Prisma 架构，避免平行存储方案
- 遵循 V12 已建立的 user-scoped 表模式（userId 外键 + @@unique([userId, clientId]) + onDelete: Cascade）
- 完整 CET6Paper 对象以 JSONB 存储，与 LearningSession.payload / ReviewItem.payload 模式一致
- server 从 NextAuth session 派生 owner，不信任客户端任何身份字段

### PrivatePaper 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (cuid) | 主键 |
| userId | TEXT | 所有者（外键 → User.id, ON DELETE CASCADE） |
| paperId | TEXT | owner-scoped stable ID（private:<ownerScopedId>:<localId>） |
| title | TEXT | 卷标题 |
| content | JSONB | 完整 CET6Paper 对象（authenticity=user_import, visibility=private） |
| createdAt | TIMESTAMPTZ(6) | 创建时间 |
| updatedAt | TIMESTAMPTZ(6) | 更新时间 |

**约束**:
- `@@unique([userId, paperId])` — 同一用户 paperId 唯一
- `@@index([userId])` — 按用户查询优化
- 外键 ON DELETE CASCADE — 删除用户时级联删除私有卷

### Migration
- 文件: `prisma/migrations/20261001002437_private_paper/migration.sql`
- 操作: CREATE TABLE + CREATE INDEX + CREATE UNIQUE INDEX + ADD FOREIGN KEY
- 不清空任何现有数据

## 2. CRUD 服务层

**文件**: `src/content/private-paper-store.ts`

| 函数 | 说明 |
|------|------|
| `createPrivatePaper(userId, input)` | 创建私有卷，server 派生身份字段 |
| `getPrivatePaper(userId, paperId)` | 按 owner + paperId 获取 |
| `listPrivatePapers(userId)` | 列出用户所有私有卷（摘要，不含完整 content） |
| `updatePrivatePaper(userId, paperId, updates)` | 更新（身份字段禁止修改） |
| `deletePrivatePaper(userId, paperId)` | 删除（按 owner 限定） |

### 安全设计
- **owner 派生**: userId 参数必须来自 server auth session，函数内部不接受 client ownerId
- **身份字段强制**: create 时 server 生成 paperId、ownerId、ownerNamespace、authenticity、visibility、productionEligible、globalSelectorEligible 等字段，覆盖客户端任何伪造值
- **update 身份锁定**: update 时从现有记录保留身份字段，不允许通过 content 修改 ownerId/paperId/visibility/authenticity
- **一致错误响应**: 不存在和他人拥有的记录都返回 NOT_FOUND，避免泄露存在性
- **内容校验**: create 和 update 均调用 `validatePrivatePaper()` 进行 8 项校验

### 错误码
| code | HTTP 状态 | 说明 |
|------|-----------|------|
| UNAUTHORIZED | 401 | 未登录或无效 userId |
| NOT_FOUND | 404 | 记录不存在（或不属于当前用户） |
| VALIDATION_ERROR | 422 | 内容校验失败 |
| DUPLICATE_ID | 409 | paperId 重复 |
| INTERNAL_ERROR | 500 | 数据库错误 |

## 3. API 路由

### `GET /api/private-papers`
- 列出当前用户所有私有卷（摘要）
- 401: 未登录

### `POST /api/private-papers`
- 创建私有卷
- Body: `{ localPaperId, title, content, rightsAcknowledgement }`
- 201: 创建成功，返回 `{ id, paperId, title }`
- 400: 请求体无效
- 401: 未登录
- 409: paperId 重复
- 422: 内容校验失败

### `GET /api/private-papers/[paperId]`
- 获取单个私有卷（完整 content）
- 401: 未登录
- 404: 不存在或不属于当前用户

### `PUT /api/private-papers/[paperId]`
- 更新私有卷（仅 title/content/rightsAcknowledgement 可修改）
- 401: 未登录
- 404: 不存在或不属于当前用户
- 422: 内容校验失败

### `DELETE /api/private-papers/[paperId]`
- 删除私有卷
- 401: 未登录
- 404: 不存在或不属于当前用户

## 4. 鉴权方式

- 使用 NextAuth JWT session（`import { auth } from "@/lib/auth/config"`）
- 所有路由首先调用 `const session = await auth()`
- 未登录返回 `401 { error: "unauthorized" }`
- 使用 `session.user.id`（数据库 User.id, cuid）作为 owner
- 派生 ownerScopedId: userId 本身满足 `isValidOwnerScopedId()`（cuid 不含 @ 和 :，长度 3-128）
- 生成完整 paperId: `privatePaperStableId(userId, localPaperId)` = `private:<userId>:<localPaperId>`

## 5. 测试证据

**文件**: `tests/v14-private-paper-store.test.ts`
**测试数**: 24/24 PASS

### 覆盖场景

| 类别 | 测试 | 结果 |
|------|------|------|
| 未登录拒绝 | 1a-1d: create/get/update/delete 空 userId | PASS |
| 正常 CRUD | 2a: create+get+持久化验证 | PASS |
| | 2b: list 返回所有卷（不含 content） | PASS |
| | 2c: update title 和 content | PASS |
| | 2d: delete 后读取 NOT_FOUND | PASS |
| 跨 owner 隔离 | 3a: B 不能读 A 的卷（一致 NOT_FOUND） | PASS |
| | 3b: B 不能更新 A 的卷 | PASS |
| | 3c: B 不能删除 A 的卷 | PASS |
| 伪造身份 | 4a: create 伪造 ownerId 被 server 覆盖 | PASS |
| | 4b: update 伪造 authenticity=past_exam 被强制保留 | PASS |
| 禁止更新身份字段 | 5a: update 不能改 ownerId/paperId/visibility | PASS |
| 非法内容 | 6a: 缺失 rightsAcknowledgement 拒绝 | PASS |
| | 6b: server 强制覆盖 productionEligible=false | PASS |
| | 6c: localPaperId 含冒号拒绝 | PASS |
| 重复/不存在 | 7a: 重复 localPaperId 返回 DUPLICATE_ID | PASS |
| | 7b: 读取不存在返回 NOT_FOUND | PASS |
| | 7c: 更新不存在返回 NOT_FOUND | PASS |
| | 7d: 删除不存在返回 NOT_FOUND | PASS |
| Production 隔离 | 8a: isPrivateContent 识别私有卷 | PASS |
| | 8b: getItems/getPublishableItems 不含私有卷 | PASS |
| 无回归 | 9a: Paper001 仍在 registry（authenticity=original） | PASS |

### 全量测试
- `npm test`: 603/603 PASS（新增 24）

## 6. 8/8 Gates 验证

| Gate | 结果 |
|------|------|
| npm test | 603/603 PASS |
| typecheck | PASS |
| lint (--max-warnings 0) | PASS (0 errors, 0 warnings) |
| build | PASS |
| content:validate | PASS (0 errors, 0 warnings) |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS (1 expected fixture warning) |

## 7. 实际实现 vs 后续设计

### 已实现（Phase 1B）
- PrivatePaper 数据库表 + migration
- CRUD 服务层（create/get/list/update/delete）
- Next.js API 路由（5 个端点）
- server 端 owner 派生与身份字段强制
- 跨 owner 访问隔离
- 内容校验（validatePrivatePaper）
- 24 个回归测试
- 8/8 gates PASS

### 后续设计（未实现）
- **PRIVATE_STORAGE_IMPLEMENTED**: YES（本阶段完成）
- **PRIVATE_SYNC_IMPLEMENTED**: NO（Phase 1E 将复用 V12 account-scoped queue）
- **PRIVATE_LEARNING_FLOW_IMPLEMENTED**: NO（Phase 1C/D 将实现答题/Review/Daily Plan）
- **上传 UI / PDF / OCR / AI**: 未实现
- **分享 / 公开**: 未实现（V14 初版 shareEligible=false）

## 8. 限制

- 私有卷存储在 PostgreSQL，不进入 content registry / production selector
- 私有卷不能通过现有公开 Paper 路由访问（需后续 Phase 实现私有卷学习页）
- API 路由未做请求体大小限制（Next.js 默认 1MB body limit）
- 未实现 rate limiting（复用 V12 登录 rate limit 模式，后续 Phase 添加）
- 未实现软删除（当前为硬删除，后续 Phase 可考虑 tombstone）

## 9. 文件清单

### 新增
- `prisma/migrations/20261001002437_private_paper/migration.sql`
- `src/content/private-paper-store.ts`
- `src/app/api/private-papers/route.ts`
- `src/app/api/private-papers/[paperId]/route.ts`
- `tests/v14-private-paper-store.test.ts`
- `V14_PHASE1B_REPORT.md`（本文件）

### 修改
- `prisma/schema.prisma`（新增 PrivatePaper 模型 + User.privatePapers 关系）
- `package.json`（新增 prisma@6.19.3 devDependency，用于 migration）
- `package-lock.json`（对应 lockfile 更新）
- `PROJECT_CONTEXT.md`（追加 V14 Phase 1B 章节）

## 10. Git

- 分支: feature/v14-real-content-rights
- 基线: 797240b
- 最终 HEAD: （见 Git closure）
- 禁止: merge main / tag / Release / force push
