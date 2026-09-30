# V14 Phase 1A — Private Content Import MVP Design Report

> 日期：2026-09-30 · 分支：feature/v14-real-content-rights
> 状态：Implemented & 8/8 Gates Verified

## 1. 摘要

V14 Phase 1A 完成了**用户私有导入内容（Private Content Import）**的完整隔离合约设计与实现。
包括数据模型扩展、validatePrivatePaper() 校验、owner 访问隔离、production selector 排除、
private stable ID 设计、rights acknowledgement 合约，以及 27 个安全测试。

**不包含**：UI、文件上传、AI/OCR、数据库变更、sync engine 修改。

## 2. 实现清单

### 2.1 代码变更

| 文件 | 变更 |
|------|------|
| `src/content/types.ts` | ContentMeta: authenticity 增加 `user_import`；新增 `visibility?`、`ownerId?` |
| `src/content/papers.ts` | CET6Paper: authenticity 增加 `user_import`；新增 `visibility?`、`ownerId?`；validator 接受 user_import |
| `src/content/private-content.ts` | 新增 `SOURCE_D_PRIVATE_USER_IMPORT`、`isPrivateContent()`、`validatePrivatePaper()`（8 项校验）、`isValidOwnerScopedId()` |
| `src/content/registry.ts` | `getPublishableItems()` 新增 `isPrivateContent()` 过滤，PRIVATE 永不进入 production selector |
| `tests/v14-private-isolation.test.ts` | 新增 27 个隔离测试，27/27 PASS |

### 2.2 文档

| 文件 | 说明 |
|------|------|
| `V14_PRIVATE_IMPORT_DESIGN.md` | 完整设计文档（数据模型、ID 设计、校验合约、访问隔离、sync 范围、安全测试） |
| `V14_PHASE1A_REPORT.md` | 本报告 |

## 3. 核心合约

### 3.1 PRIVATE_MODEL

- `authenticity` 新增 `"user_import"`（与 original/practice/past_exam 并列）
- `visibility?: "public" | "private"`（默认 public，向后兼容）
- `ownerId?: string`（仅 private 必填，server 派生，不信任 client）

### 3.2 OWNER_SCOPED

- Private stable ID 格式：`private:<owner-scoped-id>:<paper-local-id>`
- `owner-scoped-id` 为 server 派生 hash，不暴露 email / 内部 user id
- `isValidOwnerScopedId()` 拒绝 email 格式、冒号、过短（<3 字符）
- 不同 owner 的相同 paper-id 永不碰撞

### 3.3 PUBLIC_SELECTOR

- `getPublishableItems()` 新增 `isPrivateContent()` 过滤
- `isPrivateContent()` 检测：visibility=private 或 namespace=private
- **保证**：PRIVATE 内容永不进入学习页 Selector

### 3.4 REAL_NAMESPACE

- `private:` 前缀与 `cet6:` 前缀完全隔离
- `stableIdNamespace()` 正确识别 private namespace
- PRIVATE paper 的 paperId 必须使用 private namespace（validatePrivatePaper 第 4 项）

### 3.5 SYNC_SCOPE

- PRIVATE 内容不进入全局 content registry
- 通过 owner-scoped sync 同步（V12 account-scoped mutation queue）
- server 端按 ownerId 过滤，跨用户隔离

### 3.6 REVIEW_SCOPE

- PRIVATE paper 产生的错题/复习归属 owner
- 其他用户不可见
- Daily Plan 可包含 owner 的 private 复习任务（仅本人可见）

### 3.7 IMPORT_TYPES

- Phase 1A 仅定义合约，不实现导入
- 支持的导入类型（后续 Phase）：真题 PDF、模拟卷、笔记、自定义题目
- 所有导入内容 authenticity = "user_import"，visibility = "private"

### 3.8 OCR / AI

- Phase 1A 不实现 OCR/AI
- 后续 Phase 1C 实现：PDF 解析、题目提取、AI 辅助标注
- AI 处理的内容仍标记为 user_import，不改变 authenticity

### 3.9 TESTS

- 27 个隔离测试，27/27 PASS
- 覆盖：validatePrivatePaper 各维度、isPrivateContent、assertPrivateAccess、
  production selector 排除、privatePaperStableId 格式/collision、isValidOwnerScopedId

### 3.10 GATES

| Gate | 结果 |
|------|------|
| npm test | 577/577 PASS |
| typecheck | PASS |
| lint (--max-warnings 0) | PASS |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS |

**8/8 GATES PASS**

## 4. 关键设计决策

### 4.1 为什么用 visibility 字段而不是单独的 private registry？

- **向后兼容**：现有内容不需要迁移，visibility 缺省 = public
- **统一模型**：public/private 内容使用相同的 CET6Paper 类型，减少代码分支
- **防御深度**：即使 private 内容被意外注册到全局 registry，`getPublishableItems()` 的
  `isPrivateContent()` 过滤也能保证它不被 Selector 抽到
- **后续可扩展**：visibility 未来可增加 "unlisted" / "shared" 等值

### 4.2 为什么 ownerId 由 server 派生而不是 client 传入？

- **安全**：client 可以伪造 ownerId，server 必须从 auth session 派生可信身份
- `validatePrivatePaper()` 校验 ownerId 存在，但最终保存时 server 覆盖为 session 中的 user id
- `isValidOwnerScopedId()` 用于 owner-scoped-id（hash），不是原始 user id

### 4.3 为什么 authenticity 增加 user_import 而不是复用 past_exam？

- **语义清晰**：user_import 明确表示"用户导入"，不暗示"官方真题"
- **权利区分**：user_import 的权利由用户自行确认（rightsAcknowledgement），与 past_exam 的
  官方来源权利模型不同
- **统计/筛选**：可以独立统计用户导入内容，不与真题混淆

## 5. 已知限制

1. **无 UI**：Phase 1A 仅实现数据模型和校验合约，无导入页面/私有内容列表
2. **无存储层**：private content 的持久化存储（DB 表 / owner-scoped store）在后续 Phase
3. **无文件上传**：PDF/音频/图片上传在 Phase 1C
4. **无 AI/OCR**：题目自动提取在 Phase 1C
5. **sync 未接入**：private content 的云同步在 Phase 1E（复用 V12 account-scoped queue）
6. **学习流程未接入**：private paper 的答题/错题/复习在 Phase 1D

## 6. 后续 Phase 路线

| Phase | 内容 |
|-------|------|
| 1B | Private content 存储层（owner-scoped store / DB schema / migration） |
| 1C | Import UI + 文件上传 + OCR/AI 题目提取 |
| 1D | Private content 学习流程接入（答题、错题、复习、Daily Plan） |
| 1E | Private content sync + 跨设备恢复 |

## 7. 验证结论

- 数据模型：ContentMeta + CET6Paper 已扩展，typecheck PASS
- 校验合约：validatePrivatePaper() 8 项校验，27 测试覆盖
- 访问隔离：assertPrivateAccess() owner 隔离，无效 session 拒绝
- Production 排除：getPublishableItems() 过滤 PRIVATE，测试验证
- ID 设计：private namespace 隔离，collision-safe
- 测试：577/577 PASS（含 27 新增）
- Gates：8/8 PASS

**V14 Phase 1A — Private Content Import MVP Design: COMPLETE**
