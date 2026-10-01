# V14 Phase 1D.1 — Private Paper Learning MVP + Hardening 验收报告

**日期**：2026-10-01
**分支**：feature/v14-real-content-rights
**目标**：让已导入的符合要求的私有卷完成详情页 → 开始学习 → 作答 → 提交 → 查看正确率/正确答案/解析 → 返回详情。Hardening 阶段修复 9 大类问题：内容指纹、order 排序、readiness 校验、状态隔离、存档校验、权限重验、弹窗可访问性、测试覆盖、浏览器 E2E。

---

## 1. 实现范围

### 支持
- reading section + careful_reading group + 内联 choice 选择题
- 作答、导航、题号跳转、提交、结算正确率
- 结果页：正确答案高亮、用户答案标记、解析展示
- sessionStorage 本地进度持久化（按 user.id + paperId + contentHash 隔离）
- 刷新恢复、重新练习、未答题提交确认 modal
- 详情页 readiness 判定 + "开始学习"入口
- 权限与内容有效性重新验证（visibilitychange / focus / 提交前）
- 存档 6 种状态明确提示（no_archive / loaded / corrupted / content_changed / owner_mismatch / storage_read_failed）

### 不支持（本阶段边界）
- listening / translation / writing / cloze / matching 等题型
- XP / Streak / 学习统计 / Daily Plan / Review 奖励
- 服务端学习记录持久化（仅 sessionStorage 标签页本地）
- 跨设备云同步（Phase 1E）
- PDF / 图片 / 音频上传、OCR / AI

---

## 2. 核心实现（Hardening 后）

### 2.1 readiness 判定模块
**文件**：`src/lib/private-papers/readiness.ts`

- `checkPrivatePaperReadiness(content)`：返回 `{ready, reason, questions, contentHash}`
- **第 0 步**：复用 `validatePrivateDraft()` 做结构校验（schemaVersion、唯一 ID、type、order、options 唯一 ID、answerId 匹配、questionRefs 结构、assetIds 引用）
- 检查项：isPartial!==true、有 sections、仅 reading section、仅 careful_reading group、无 questionRefs、无 assetIds、仅 choice 题、options≥2 且格式合法、answerId 存在且匹配选项、prompt 非空、至少 1 题
- **不静默跳过不支持内容**：混合支持+不支持的卷整体拒绝
- **重复 ID 检测**：全局 questionId 重复、option.id 重复、空 ID 全部拒绝
- **三级 order 排序**：section.order → group.order → question.order，使用索引数组不修改原始输入，排序后重新生成连续 globalIndex
- `computePrivateContentHash`：**FNV-1a 64-bit（BigInt）**，格式 `v2:<16位hex>`，JSON.stringify 结构化序列化，排序后序列化，标题/解析不纳入哈希
- `scorePrivateAnswers`：判分（correct/total/accuracy 保留1位小数）
- `countValidAnswers`：只算当前有效题目 index 范围内的合法答案

### 2.2 存档校验模块（Hardening 新增）
**文件**：`src/lib/private-papers/progress-storage.ts`

- `loadStudyProgress(ownerId, paperId, contentHash, questions)`：加载并校验存档
- `saveStudyProgress(ownerId, paperId, contentHash, state)`：保存存档
- `clearStudyProgress(ownerId, paperId)`：清空存档
- `getProgressStatusMessage(status)`：返回用户可见提示
- 校验项：version=2、owner 匹配、paperId 匹配、contentHash 匹配、answers 纯对象且 key 为有效题目索引、value 为合法 optionId、currentIndex 合法整数并钳位范围、submitted boolean
- **6 种状态**：`no_archive` / `loaded` / `corrupted` / `content_changed` / `owner_mismatch` / `storage_read_failed`
- 存储失败仍允许内存作答，明确提示用户

### 2.3 学习页服务端组件
**文件**：`src/app/me/private-papers/[paperId]/study/page.tsx`

- `auth()` 服务端 session 校验
- `privatePaperIdFromRoute` 解码（归一化双重编码）
- `getPrivatePaper` 读取（owner-scoped，不存在返回 NOT_FOUND）
- `checkPrivatePaperReadiness` 判定
- 渲染 `StudyClient`，传入 questions / contentHash / ready / notReadyReason

### 2.4 StudyClient（Hardening 后）
**文件**：`src/app/me/private-papers/[paperId]/study/StudyClient.tsx`

- 合并 `StudyState` 对象 `{answers, currentIndex, submitted}`
- **hydratedRef 随 ownerId/paperId/contentHash 变化重置**：身份不匹配时禁止作答/提交/写入存档
- **旧异步请求用 requestId/epoch 守卫**：防止覆盖新状态
- 恢复完成前显示 loading 禁止用户操作
- 作答选择、前后题导航、已答/未答计数、题号跳转 dots
- 未答题提交确认 modal（未答题目计为错误）
- **modal 可访问性**：role="dialog" aria-modal="true" aria-labelledby/aria-describedby、Escape 取消、焦点管理、焦点恢复
- 提交冻结、结算正确率
- 结果页：正确答案高亮（绿色）、用户答案标记（错误红色）、解析/暂无解析
- 重新练习：清空 sessionStorage + 重置状态
- sessionStorage 持久化：key=`private-study:${userId}:${paperId}`
- **权限与内容有效性重新验证**：visibilitychange / focus / 提交前重新检查登录身份、私有卷权限和内容
- VerifyStatus 类型：`"idle" | "verifying" | "verified" | "failed" | "invalid"`
- 原卷被删除/修改/失去权限时停止使用旧进度并显示说明
- 明确标注"本阶段私有练习暂不计入 XP、Streak、学习统计、Daily Plan 或 Review"

### 2.5 权限验证 API（Hardening 新增）
**文件**：`src/app/api/private-papers/[paperId]/verify/route.ts`

- GET 端点：验证当前用户对私有卷的访问权限和内容有效性
- 返回 401/403（权限失效）、404（卷被删除）、200（含 contentHash）
- StudyClient 在 visibilitychange/focus/提交前调用

### 2.6 详情页更新
**文件**：`src/app/me/private-papers/[paperId]/DetailClient.tsx`

- 新增"学习"section
- ready 时：显示题目数量 + 说明 + "开始学习"按钮（Link 到 /study）
- 不 ready 时：显示具体原因 + 支持范围说明

### 2.7 CSS（Hardening 修复）
**文件**：`src/app/globals.css`

- pp-* 系列样式替换未定义 Design Tokens：`--bg`→`--surface`、`--bg-subtle`→`--surface-soft`、`--text-secondary`→`--muted`、`--text-primary`→`--text`
- 弹窗改为不透明白色背景 + border + box-shadow，overlay 0.5
- **题号按钮 44×44px**（触控区域达标），gap 8px
- 新增 `.pp-study-status-banner` / `.pp-study-status-warning` / `.pp-study-retry-btn` 样式
- 新增 `@media (prefers-reduced-motion: reduce)` 禁用过渡动画
- 移动端 `@media max-width:430px` 响应式

---

## 3. Hardening 修复清单

| # | 问题 | 修复 |
|---|------|------|
| 40 | 内容指纹 djb2 32位+截断 | FNV-1a 64-bit（BigInt）+ 完整文本不截断 + JSON.stringify 结构化 + 排序后序列化，格式 `v2:<hex>` |
| 41 | order 未排序 | 三级排序 section→group→question，索引数组不修改原始输入，重新生成连续 globalIndex |
| 42 | readiness 校验过弱 | 复用 validatePrivateDraft 做第 0 步结构校验，重复 ID/空 ID/非法答案全部拒绝 |
| 43 | 账号/内容变化状态隔离失效 | hydratedRef 随 ownerId/paperId/contentHash 重置，epoch 守卫防止旧异步覆盖新状态 |
| 44 | 存档校验过松且静默失败 | 独立 progress-storage 模块，6 种状态明确提示，currentIndex 钳位，多余答案过滤 |
| 45 | 权限/内容有效性不重新验证 | visibilitychange/focus/提交前重新验证，原卷删除/修改/失权时停止使用旧进度 |
| 46 | 弹窗 CSS 使用未定义 Token 且触控不足 | 替换 4 个未定义 Design Token，题号按钮 32→44px，modal 可访问性（role/aria/Escape/focus） |
| 47 | 测试覆盖不足 | 35→65 个测试，新增长文本指纹/逆序排序/重复ID/存档6状态/存储失败等 |
| 48 | 浏览器 E2E 覆盖不足 | 补充 modal 可访问性、Escape 键、刷新恢复、无横向溢出验证 |

---

## 4. 测试

**文件**：`tests/v14-private-paper-study.test.ts`
**数量**：65 个测试，全部 PASS

覆盖范围：
- readiness 各类不支持场景（isPartial / 无sections / 非reading section / 非careful_reading group / questionRefs / assetIds / 非choice题 / 选项不足 / 缺answerId / answerId不匹配 / 缺prompt / 空内容）
- 合法内容展开结构
- 多 group 排序、多 section 按 section.order 排序
- 逆序 order 排序正确、原始输入不被排序修改
- 混合支持+不支持拒绝（不静默跳过）
- 重复 option.id→拒绝、重复 questionId→拒绝、空 option id→拒绝
- 非法 questionRefs 结构→拒绝、schemaVersion 不匹配→拒绝
- 判分（全对 / 全错 / 部分 / 未答 / 多余answer不影响）
- contentHash（同内容同hash / answerId变化不同hash / prompt变化不同hash / 标题不影响hash / 解析不影响hash / 长文本末尾变化不同hash / v2:前缀格式）
- countValidAnswers 只算有效索引、忽略非字符串值
- 存档 6 种状态全部测试（no_archive/loaded/corrupted/content_changed/owner_mismatch/storage_read_failed）
- answers 是数组→过滤为空对象、currentIndex 小数→钳位 0、currentIndex 超范围→钳位 total-1
- 多余答案→过滤、save/load roundtrip、clearStudyProgress
- getProgressStatusMessage 各状态消息、旧版本存档→corrupted
- submitted=true 存档恢复、negative currentIndex→钳位 0

---

## 5. Gates 验证结果

| Gate | 结果 |
|------|------|
| npm test | **739/739 PASS** |
| npm run typecheck | **PASS** |
| npm run lint -- --max-warnings 0 | **PASS**（0 errors, 0 warnings） |
| npm run build | **PASS** |
| npm run content:validate | **PASS** |
| npm run content:stats | **PASS** |
| npm run content:rights | **PASS** |
| npm run content:audio-validate | **PASS** |

**8/8 gates 全部通过**

---

## 6. 浏览器 E2E 验证

### 验证环境
- Dev server：http://127.0.0.1:3000（Next.js 16.3.5 Turbopack）
- 视口：494x632（移动端）

### 初始 MVP 验证流程与结果

| 步骤 | 操作 | 结果 |
|------|------|------|
| 1 | 导航到"我的"页面 | ✅ 显示"我的私有卷"入口 |
| 2 | 进入私有卷列表 | ✅ 空状态显示"立即导入"按钮 |
| 3 | 导入合法 reading/careful_reading/choice 卷（3题） | ✅ 导入成功，跳转详情页 |
| 4 | 详情页显示"学习"section | ✅ 显示"本卷包含 3 道可作答阅读选择题"+"开始学习"按钮 |
| 5 | 点击"开始学习"进入学习页 | ✅ 显示标题、进度条（第1/3题）、阅读材料、题目、4个选项、导航、题号dots |
| 6 | 选择第1题答案A（正确） | ✅ 选项高亮，dot显示"已答"，已答计数更新 |
| 7 | 点击"下一题"进入第2题 | ✅ 导航正常，进度条更新 |
| 8 | 选择第2题答案C（正确） | ✅ 选项高亮，dot显示"已答" |
| 9 | 点击"下一题"进入第3题 | ✅ 导航正常，"下一题"变为"提交答案" |
| 10 | 选择第3题答案A（错误，正确为D） | ✅ 选项高亮 |
| 11 | 点击"提交答案" | ✅ 进入结果页 |
| 12 | 结果页显示正确率 | ✅ 66.7%，正确 2/3 题 |
| 13 | 结果页显示每题回顾 | ✅ 第1题正确（绿色）、第2题正确（绿色）、第3题错误（红色），正确答案高亮，解析显示 |
| 14 | 刷新页面 | ✅ 结果页仍显示（sessionStorage 恢复成功） |
| 15 | 点击"重新练习" | ✅ 重置到第1题，已答0题，sessionStorage 清空 |
| 16 | 直接到第3题提交（未答前2题） | ✅ 未答题确认 modal 出现"还有2题未作答" |
| 17 | 点击"确认提交" | ✅ 进入结果页，未答题计为错误 |

### Hardening 补充验证

| 步骤 | 操作 | 结果 |
|------|------|------|
| 18 | 未答题弹窗可访问性 | ✅ role="dialog" aria-modal="true"，不透明白色背景+边框+阴影 |
| 19 | Escape 键关闭弹窗 | ✅ 按 Escape 关闭未答题确认弹窗 |
| 20 | 状态横幅显示 | ✅ "进度保存在当前浏览器标签页，刷新后可恢复" |
| 21 | 刷新后已提交状态恢复 | ✅ 100% 分数、重新练习按钮仍在 |
| 22 | 无横向溢出 | ✅ scrollWidth == clientWidth == 479px |
| 23 | 题号按钮触控区域 | ✅ 44×44px，符合移动端触控标准 |

### 截图
保存于 `output/v14d1-screenshots/`：
1. `01-detail-with-study-button.png` — 详情页显示"开始学习"按钮
2. `02-study-page-question.png` — 学习页显示题目与选项
3. `03-results-page.png` — 结果页显示正确率与答题回顾

---

## 7. 最终状态字段

| 字段 | 值 |
|------|-----|
| PRIVATE_LEARNING_FLOW | LIMITED_READING_CHOICE_MVP + HARDENING |
| PRIVATE_PROGRESS | TAB_LOCAL_ONLY（sessionStorage，按 user.id+paperId+contentHash 隔离，6 种状态校验） |
| PRIVATE_REVIEW | NOT_IMPLEMENTED |
| PRIVATE_DAILY_PLAN | NOT_IMPLEMENTED |
| PRIVATE_SYNC | NOT_IMPLEMENTED |
| PRIVATE_XP | NOT_IMPLEMENTED |
| PRIVATE_STORAGE_IMPLEMENTED | YES（Phase 1B） |
| PRIVATE_MANAGEMENT_UI | YES（Phase 1C） |
| PRIVATE_JSON_IMPORT_UI | YES（Phase 1C） |
| CONTENT_HASH_VERSION | v2（FNV-1a 64-bit） |
| PROGRESS_STORAGE_VERSION | 2 |
| PRISMA_CHANGED | NO |
| PAPER_001_CHANGED | NO |
| PHASE_1E_STARTED | NO |

---

## 8. 已知限制

1. 仅支持 reading section + careful_reading group + 内联 choice 题
2. 进度仅保存在 sessionStorage（标签页关闭后丢失），不持久化到数据库
3. 不奖励 XP / Streak / 学习统计 / Daily Plan / Review
4. 不支持跨设备同步（Phase 1E）
5. 真机移动端软键盘未验证
6. 375/390/430px 精确宽度的 Playwright 自动化检查未单独运行（E2E 使用 494px 视口手动验证，CSS 已包含 @media max-width:430px 响应式）
7. CDP Emulation.setDeviceMetricsOverride 报 "Session with given id not found"，无法通过 CDP 切换视口宽度

---

## 9. 结论

**V14 Phase 1D.1 开发 + Hardening 完成并通过验收。**

- 8/8 gates 全部通过（739/739 tests）
- 9 大类 hardening 问题全部修复
- 65 个私有卷学习专项测试全部通过
- 浏览器 E2E 完整学习流程 + hardening 补充验证通过
- sessionStorage 本地进度恢复 + 6 种状态校验验证通过
- 未答题提交确认 modal + 可访问性验证通过
- 权限与内容有效性重新验证实现
- 无 Prisma 变更，无 Paper 001 内容变更
- 未开始 Phase 1E

完成后停止，等待验收，不开始 Phase 1E。
