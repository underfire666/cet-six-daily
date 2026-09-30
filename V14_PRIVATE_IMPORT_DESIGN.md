# V14 Phase 1A — Private Content Import MVP Design

> 版本：1.0 · 日期：2026-09-30 · 状态：Implemented & Validated
> 分支：feature/v14-real-content-rights

## 1. 目标

为 CET-6 Daily 设计并实现**用户私有导入内容（Private Content Import）**的完整隔离合约。
用户可以导入自己的真题/模拟卷/笔记，这些内容**仅本人可见**，永不进入 production selector、
全局搜索、跨用户同步或公开分享。

## 2. 数据模型

### 2.1 ContentMeta 扩展

```typescript
interface ContentMeta {
  // ... 现有字段
  authenticity: "original" | "practice" | "past_exam" | "user_import";  // 新增 user_import
  visibility?: "public" | "private";  // 新增，默认 public（向后兼容）
  ownerId?: string;  // 新增，仅 private 必填
}
```

### 2.2 CET6Paper 扩展

```typescript
interface CET6Paper {
  // ... 现有字段
  authenticity: "original" | "practice" | "past_exam" | "user_import";
  visibility?: "public" | "private";
  ownerId?: string;
}
```

### 2.3 PrivateContentMeta（V14 Phase 0 已有）

```typescript
interface PrivateContentMeta {
  ownerId: string;
  ownerNamespace: string;  // user:<hash>，不暴露 email
  visibility: "private";
  redistributable: false;
  productionEligible: false;
  globalSelectorEligible: false;
  shareEligible: false;
  paperId: string;  // private:<owner-scoped-id>:<paper-id>
  importedAt: string;
  rightsAcknowledgement: {
    acknowledged: boolean;
    acknowledgedAt: string;
    statementVersion: string;
  };
}
```

## 3. Private Stable ID 设计

### 3.1 格式

```
private:<owner-scoped-id>:<paper-local-id>
```

- 第一段固定保留字 `private`，与 `cet6:` namespace 完全隔离
- `owner-scoped-id`：server 派生的 owner hash（不暴露 email / 内部 user id）
- `paper-local-id`：用户自定义或系统生成的 paper 标识

### 3.2 示例

```
private:user-hash-a1b2c3:imported-2024-06
private:user-hash-d4e5f6:my-notes-paper-001
```

### 3.3 Collision Safety

- 不同 owner 的相同 paper-local-id 永不碰撞（owner-scoped-id 不同）
- `private:` 前缀与 `cet6:` 前缀完全隔离，不可能与 public 内容碰撞
- `stableIdNamespace()` 正确识别 `private` namespace

## 4. validatePrivatePaper() 校验合约

导入/保存 PRIVATE paper 前必须通过以下 8 项校验（任一不满足 → 拒绝）：

| # | 检查项 | 要求 |
|---|--------|------|
| 1 | visibility | 必须 === "private" |
| 2 | authenticity | 必须 === "user_import" 或 "past_exam"（private owner import） |
| 3 | ownerId | 必须存在且非空（server 从 auth session 派生，不信任 client） |
| 4 | paperId namespace | 必须 === "private"（stableIdNamespace 检测） |
| 5 | productionEligible | 必须 !== true（PRIVATE 永不 production） |
| 6 | globalSelectorEligible | 必须 !== true |
| 7 | redistributionAllowed | rights.redistributionAllowed 必须 !== true |
| 8 | rightsAcknowledgement | acknowledged === true 且 acknowledgedAt 存在 |

返回值：`string[]`（空数组 = 通过，非空 = 所有不满足原因）。

## 5. Owner 访问隔离

### 5.1 assertPrivateAccess()

```typescript
function assertPrivateAccess(meta: PrivateContentMeta, requesterId: string): boolean
```

- owner 本人 → `true`
- 其他用户 → `false`
- 无效 session（空 / null）→ `false`

### 5.2 Server 端强制

- ownerId 由 server 从 auth session 派生，**不信任 client 传入的 ownerId**
- 所有 private content 的 CRUD 操作必须校验 `requesterId === meta.ownerId`
- 跨用户访问返回 403，不泄露内容存在性（统一 404/403 策略）

## 6. Production Selector 排除

`getPublishableItems()` 新增 `isPrivateContent()` 过滤：

```typescript
if (isPrivateContent(item)) return false;  // PRIVATE 永不进入 production selector
```

`isPrivateContent()` 检测条件（任一满足即 private）：
1. `item.visibility === "private"`
2. `stableIdNamespace(item.paperId ?? item.id) === "private"`

**保证**：即使 PRIVATE paper 被意外注册到全局 registry，也不会被学习页 Selector 抽到。

## 7. Rights Acknowledgement

用户导入私有内容前必须确认：
- 内容为本人合法持有或已获授权
- 内容仅本人可见，不公开分发
- 平台不对导入内容的版权合规性背书
- 违规内容可能被移除

`rightsAcknowledgement` 记录：
- `acknowledged: boolean`
- `acknowledgedAt: ISO 8601 timestamp`
- `statementVersion: string`（确认条款版本，便于后续追溯）

## 8. Sync 范围

- PRIVATE 内容**不进入**全局 content registry / production selector
- PRIVATE 内容通过 owner-scoped sync 同步（V12 云同步架构的 account-scoped mutation queue）
- 不同用户的 private 内容完全隔离，server 端按 ownerId 过滤
- PRIVATE 内容的 mutation 携带 ownerId，server 校验后才执行

## 9. Review / Wrongbook 范围

- PRIVATE paper 产生的错题/复习记录归属 owner
- 其他用户看不到 owner 的 private 错题
- Daily Plan 可以包含 owner 的 private paper 复习任务（仅本人可见）
- 全局统计/排行榜不包含 private 内容数据

## 10. 安全测试覆盖（27 tests）

| 测试组 | 数量 | 覆盖 |
|--------|------|------|
| validatePrivatePaper 合法 | 1 | 完整合法 paper 通过 |
| validatePrivatePaper 各维度拒绝 | 9 | visibility/authenticity/ownerId/paperId/productionEligible/redistribution/acknowledgement/null |
| isPrivateContent 检测 | 3 | visibility=private / private namespace / public content |
| assertPrivateAccess 隔离 | 3 | owner 可访问 / 其他用户拒绝 / 无效 session 拒绝 |
| production selector 排除 | 1 | PRIVATE paper 不出现在 getPublishableItems |
| privatePaperStableId 格式 | 4 | 正确格式 / 空 owner 拒绝 / 冒号拒绝 / 不同 owner 不碰撞 |
| isValidOwnerScopedId | 4 | 合法 / email 拒绝 / 冒号拒绝 / 过短拒绝 |
| 常量确认 | 1 | PRIVATE_NEVER_IN_GLOBAL_SELECTOR / SOURCE_D |
| null paper | 1 | null/undefined 拒绝 |

## 11. 不做的事（Phase 1A 边界）

- ❌ 不实现 UI（导入页面、私有内容列表）
- ❌ 不实现 AI 解析/OCR
- ❌ 不实现真实文件上传（PDF/音频）
- ❌ 不实现分享/协作
- ❌ 不修改 V12 sync engine
- ❌ 不导入任何真实真题
- ❌ 不创建数据库表（Prisma 不变）

## 12. 后续 Phase

- **Phase 1B**：Private content 存储层（owner-scoped store / DB schema）
- **Phase 1C**：Import UI + 文件上传 + OCR/AI 解析
- **Phase 1D**：Private content 学习流程接入（答题、错题、复习）
- **Phase 1E**：Private content sync + 跨设备恢复
