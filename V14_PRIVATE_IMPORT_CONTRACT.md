# V14 Phase 0 — PRIVATE User Import Contract（用户私有导入合同）

> 生成日期：2026-09-29
> 适用仓库：CET-6 Daily，分支 `feature/v14-real-content-rights`
> 代码落点：`src/content/private-content.ts`
> Phase 0 范围：**仅定义 contract（类型 + 验证函数）**，不实现 UI / 存储 / 服务端。
> 本文件不是法律意见。

---

## 1. PRIVATE 逻辑类别定义

PRIVATE 内容是 **owner-scoped content**：用户自行上传的试卷材料（PDF / 图片 / 文本 / 音频），仅属于上传者本人的私人学习空间。

- PRIVATE **不是**一个独立的 public Paper namespace（与 `cet6:<year>-<session>:set<N>` 的 REAL namespace、`cet6:mock:*` 的 MOCK namespace 并列）。
- PRIVATE 是一个 **visibility 维度**：同一份 CET6Paper 结构，通过 `PrivateContentMeta` 标注为 owner 私有。
- PRIVATE 卷**不需要**、也**不应**占用公共 Paper namespace；它的 stable ID 走独立的 `private:` 前缀（见 §4）。
- Phase 0 仅定义 `visibility="private"`；未来可能扩展 `shared` / `org` 等可见性，但本期不实现。

---

## 2. 核心原则（Core Principles）

`PrivateContentMeta` 上以下字段为**编译期恒为 false** 的硬约束：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `ownerId` | server 从 auth session 派生（required string） | 内容归属者 |
| `ownerNamespace` | required string（如 `user:<hash>`） | owner 作用域标识，不直接暴露敏感身份 |
| `visibility` | `"private"`（唯一允许值） | 可见性 |
| `redistributable` | `false`（字面量类型） | 私有内容不可再分发 |
| `productionEligible` | `false`（字面量类型） | 私有内容永不进入 production pool |
| `globalSelectorEligible` | `false`（字面量类型） | 私有内容永不进入 global selector |
| `shareEligible` | `false`（字面量类型） | V14 初版不可分享 |
| `paperId` | `private:<owner-scoped-id>:<paper-id>` | owner scoped stable ID |
| `importedAt` | ISO 8601 | 导入时间 |
| `rightsAcknowledgement` | `PrivateRightsAcknowledgement` | 用户权利使用确认 |

`PRIVATE_NEVER_IN_GLOBAL_SELECTOR = true as const` 是编译期常量，在代码层阻断 PRIVATE 内容进入全局选择器。

---

## 3. PRIVATE Paper 访问范围

**可访问 / 可使用：**
- 仅上传者本人（owner）可访问自己的 PRIVATE paper。
- 可进入 owner 本人的：练习、Wrongbook（错题本）、Review（复习）、个人学习统计。
- 这些功能模块必须按 owner 过滤数据，只返回 `ownerId === sessionOwnerId` 的 PRIVATE 卷。

**禁止进入：**
- 公共模拟卷列表（public MOCK list）
- 公共 REAL 列表（public REAL list）
- 其他用户的 sync snapshot
- global production selector / production pool
- 任何跨用户推荐、排行榜、社交分享

---

## 4. PRIVATE Content Stable IDs

**格式：** `private:<owner-scoped-id>:<paper-id>`

- `ownerScopedId`：不含冒号的 owner 作用域标识（如 `user-a` / `u-<hash>`）。
- `paperId`：owner 自己的试卷本地 ID（如 `my-paper-1`）。
- 示例：`private:u-9f3a2:my-paper-1`。

**设计属性：**
- **stable**：owner 导入后 ID 不变，可被 Wrongbook/Review 稳定引用。
- **collision safe**：owner scoped，不同 owner 的同名 `paper-id` 不会冲突（前缀隔离）。
- **owner scoped**：访问时必须 `assertPrivateAccess()` 校验。
- **不直接暴露敏感 identity**：`ownerScopedId` 用 hash / 短码，不透出手机号 / 邮箱 / 真实姓名。
- **sync compatible**：owner scoped ID 在多端 sync 时只同步给对应 owner。
- **review replay compatible**：历史 Review 记录里的 paperId 仍可回放，但回放前必须重新做 owner authorization。

实现函数：
- `privatePaperStableId(ownerScopedId, paperId)`：生成 ID，对非法输入（空 / 含冒号）throw。
- `isPrivateStableId(id)`：判断 ID 是否属于 private namespace。

---

## 5. User Import Rights Acknowledgement（用户导入权利确认）

`PrivateRightsAcknowledgement`：

| 字段 | 含义 |
| --- | --- |
| `acknowledged: boolean` | 用户是否已确认权利声明 |
| `acknowledgedAt: string` | 确认时间（ISO 8601，server 记录） |
| `statementVersion: string` | 声明文案版本号（文案变更时要求重新确认） |

**用户上传前必须确认的声明要点（产品文案方向）：**
- 用户确认对自己上传的内容拥有合法使用权。
- 上传内容仅用于本人个人学习。
- 不会将上传内容公开分发、商用、再发布到其他平台。
- 产品说明：上传内容**不会**自动加入公共题库，仅本人可见。

**产品纪律：**
- 不得在 UI 或对外口径中声称"用户上传 = 一定合法"。
- 上传内容的权利责任由用户承担；产品仅提供私人学习空间。
- 发现用户上传侵权内容时，按投诉/下架流程处理（deferred 到后续阶段）。

---

## 6. PRIVATE Security Model（安全模型）

- **server derives owner from auth session**：`ownerId` 必须由 server 从已登录会话派生，**绝不信任 client 在请求体里自报的 ownerId**。
- **A 用户不得访问 B 用户 private paper**：`assertPrivateAccess(content, sessionOwnerId)` 在每次读取 PRIVATE 内容前强制校验。
- **Review replay 必须做 owner authorization**：历史 Review 记录回放时，不能因为"记录里有 paperId"就放行，必须重新校验 `ownerId === sessionOwnerId`。
- **Sync owner scoped**：多端同步只同步当前登录 owner 的 PRIVATE 卷；登出/切换账号后不可见他人数据。
- **禁止跨用户推荐**：PRIVATE 卷不进入任何全局/社交/推荐计算。
- **Phase 0 边界**：本阶段只形成明确 contract（类型 + 断言函数），不实现 UI、存储、服务端鉴权中间件；后续阶段实现时必须遵守本 contract。

---

## 7. 代码实现位置

`src/content/private-content.ts` 导出：

| 符号 | 说明 |
| --- | --- |
| `PrivateVisibility` | 类型，Phase 0 仅 `"private"` |
| `PRIVATE_NEVER_IN_GLOBAL_SELECTOR` | 编译期常量 `true` |
| `PrivateRightsAcknowledgement` | 接口（acknowledged/acknowledgedAt/statementVersion） |
| `PrivateContentMeta` | 接口（ownerId/ownerNamespace/visibility/redistributable=false/productionEligible=false/globalSelectorEligible=false/shareEligible=false/paperId/importedAt/rightsAcknowledgement） |
| `privatePaperStableId(ownerScopedId, paperId)` | 生成 `private:<ownerScopedId>:<paperId>` |
| `isPrivateStableId(id)` | 判断是否 private namespace |
| `assertPrivateAccess(content, sessionOwnerId)` | owner 访问授权断言 |

`src/content/stable-id.ts` 扩展：
- `StableIdNamespace` 增加 `"private"`。
- `stableIdNamespace()` 识别 `private:<owner-scoped-id>:<paper-id>`。

---

## 8. 与现有 content repository 的关系

- **不建立第二套 content repository**。PRIVATE 内容仍走现有 content layer（CET6Paper / ContentPack / validator）。
- PRIVATE 是 **visibility 维度**，不是 repository 维度。同一份 CET6Paper 结构，通过 `PrivateContentMeta` 叠加 owner 私有语义。
- `PRIVATE_NEVER_IN_GLOBAL_SELECTOR` 保证 PRIVATE 卷在 production selector 构建阶段被排除，不需要单独的存储路径。
- Phase 0 的 fixtures（E / F）是 synthetic 占位，未注册进任何真实 repository。
