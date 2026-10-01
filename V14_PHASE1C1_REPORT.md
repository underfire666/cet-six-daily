# V14 Phase 1C.1 — Private Paper Management + JSON Import UI

## 概述

Phase 1C.1 在 Phase 1B（PrivatePaper 存储层 + API）基础上，实现了完整的网页端私有卷管理 UI：
- 私有卷列表页 `/me/private-papers`
- JSON 导入页 `/me/private-papers/import`
- 私有卷详情页 `/me/private-papers/[paperId]`
- "我的"页面入口
- 共享校验模块
- 33 个回归测试

**不包含**：答题流程（Phase 1D）、云同步（Phase 1E）。

## 实现清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/app/me/private-papers/page.tsx` | 私有卷列表页（client component，useSession 鉴权，未登录重定向，空状态，导入按钮） |
| `src/app/me/private-papers/import/page.tsx` | JSON 导入页（粘贴/文件双模式 tab，表单校验，实时预览，权利确认，1MiB 限制，提交跳转） |
| `src/app/me/private-papers/[paperId]/page.tsx` | 私有卷详情页（内容概览，元信息，修改标题，删除确认，404 处理，paperId 编码归一化） |
| `src/lib/private-papers/validation.ts` | 共享校验模块（validateLocalPaperId/validateTitle/parseJsonContent/validateImportDraft/countContentStats/encodePaperIdForUrl/hasSpecialPaperIdChars/IMPORT_BODY_LIMIT） |
| `tests/v14-private-papers-ui.test.ts` | 33 个回归测试（客户端校验 + store 集成） |

### 修改文件

| 文件 | 说明 |
|------|------|
| `src/app/me/page.tsx` | 新增 FileText import + "内容"section（"我的私有卷"链接） |
| `src/app/globals.css` | 追加 pp-* 系列 CSS 样式（列表卡片、导入表单、预览网格、详情 section、危险操作区、移动端响应式） |

### 关键设计决策

1. **鉴权**：所有页面使用 `useSession()`，未登录重定向到 `/login?callbackUrl=...`
2. **paperId 编码**：详情页使用 `useParams()` 获取参数，检测是否包含 `%3A`/`%25` 并归一化解码，再用 `encodeURIComponent` 构造 fetch URL，避免双重编码
3. **权利确认**：导入页 checkbox 默认不勾选，未勾选时提交按钮禁用
4. **1MiB 限制**：客户端和服务端双重限制（`IMPORT_BODY_LIMIT = 1024 * 1024`）
5. **草稿状态**：`isPartial: true` 的卷显示"草稿"badge 和"不完整草稿暂不能开始学习"提示
6. **删除确认**：两步确认（先显示确认框，可取消，再确认删除）
7. **修改标题**：保持 DB title 与 content.title 一致，通过 PUT /api/private-papers/[paperId] 更新

## 测试结果

### 单元/集成测试（33/33 PASS）

**客户端校验（18 个）**：
- validateLocalPaperId：有效/空/过长/含冒号/含空格/含特殊字符
- validateTitle：有效/空/过长
- parseJsonContent：有效 JSON/空/无效语法/非对象/数组
- validateImportDraft：有效/缺少 schemaVersion/缺少 isPartial/缺少 sections
- countContentStats：空/有 sections/有 groups/有 questions
- encodePaperIdForUrl：普通 ID/含冒号 ID/含特殊字符 ID
- hasSpecialPaperIdChars：普通/含特殊字符

**Store 集成（15 个）**：
- 未登录拒绝
- 空草稿创建
- 带 sections 创建
- 重复 localPaperId 拒绝
- 缺少权利确认拒绝
- 修改标题一致性（DB title == content.title）
- 删除
- 跨 owner 隔离
- 中文 ID
- server 强制身份字段（authenticity=user_import, visibility=private）
- 刷新重读
- 列表按更新时间排序

### 8/8 Gates

| Gate | 结果 |
|------|------|
| npm test | 667/667 PASS |
| typecheck | PASS |
| lint (--max-warnings 0) | PASS (0 errors, 0 warnings) |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS |

## 浏览器 E2E 验证

### 验证环境
- Dev Server: `http://127.0.0.1:3000`
- 测试账号: `v14c1-test@example.invalid`
- 浏览器: Chrome (CNGC Browser Use)

### 验证流程与结果

| # | 场景 | 结果 | 截图 |
|---|------|------|------|
| 1 | 未登录访问 /me/private-papers → 重定向登录页 | PASS | - |
| 2 | 注册测试账号 → 自动登录跳转 /me | PASS | 01-me-page-with-private-entry.png |
| 3 | /me 页面显示"内容 > 我的私有卷"入口 | PASS | 01 |
| 4 | 进入列表页 → 空状态正常显示 | PASS | 02-private-papers-empty.png |
| 5 | 进入导入页 → 表单完整（localPaperId/标题/JSON/权利确认/预览） | PASS | 03-import-page.png |
| 6 | 填写表单并提交 → 创建成功 → 跳转详情页 | PASS | 04-import-filled-preview.png |
| 7 | 详情页显示标题/草稿badge/内容概览/元信息/删除区 | PASS（修复 paperId 编码后） | 06-detail-page.png |
| 8 | 修改标题 → 保存成功 → 刷新后保持 | PASS | 07-detail-after-edit-refresh.png |
| 9 | 删除确认 → 取消 → 仍在详情页 | PASS | - |
| 10 | 删除确认 → 确认 → 跳转列表页 → 列表为空 | PASS | 08-list-after-delete.png |
| 11 | 移动端布局（~399px 宽度） | PASS（无横向溢出、底部导航不遮挡） | - |

### Bug 修复记录

**Bug：详情页 paperId 双重编码导致 404**
- 现象：成功导入后跳转详情页，显示"该私有卷不存在或你没有访问权限"
- 根因：`useParams()` 在某些情况下返回 URL 编码后的 paperId（含 `%3A`），详情页 fetch 时再次 `encodeURIComponent` 导致双重编码（`%253A`），API 路由解码后仍为编码值，store `checkPaperId` 正则不匹配
- 修复：详情页增加归一化逻辑，检测 `%3A`/`%25` 并 `decodeURIComponent` 后再编码
- 验证：修复后详情页正常显示，刷新保持

## 截图清单

保存在 `output/v14c1-screenshots/`：
1. `01-me-page-with-private-entry.png` — 我的页面（含私有卷入口）
2. `02-private-papers-empty.png` — 空列表页
3. `03-import-page.png` — 导入页（空表单）
4. `04-import-filled-preview.png` — 导入页（已填写+预览）
5. `05-detail-page.png` — 详情页（Bug 状态，已修复）
6. `06-detail-page.png` — 详情页（修复后）
7. `07-detail-after-edit-refresh.png` — 修改标题后刷新
8. `08-list-after-delete.png` — 删除后空列表

## 边界与约束

- ✅ 保留绿色主题和 Design Tokens
- ✅ 移动端响应式（@media max-width:430px）
- ✅ 不修改 Paper 001 production 内容
- ✅ 不导入真实真题/音频
- ✅ 不开始 Phase 1D（答题流程）
- ✅ 不开始 Phase 1E（云同步）
- ✅ 不 merge main
- ✅ 不创建 tag/Release

## 已知限制

1. **文件导入模式**：UI 已实现"选择文件"tab，但浏览器 E2E 仅验证了粘贴 JSON 模式
2. **真机移动端**：CSS 已写响应式，但未在真机上验证软键盘遮挡
3. **跨 owner 浏览器隔离**：单元测试已覆盖，浏览器中未注册第二个账号验证
4. **重复 localPaperId 浏览器验证**：单元测试已覆盖，浏览器中未重复导入同一 ID

## 最终状态

- **分支**: `feature/v14-real-content-rights`
- **Phase 1B 基线**: `b58c17c`
- **测试**: 667/667 PASS
- **Gates**: 8/8 PASS
- **浏览器 E2E**: 核心流程全部通过
- **待完成**: Git commit + push（本轮执行）

---

**V14 PHASE 1C.1 — IMPLEMENTATION COMPLETE**
