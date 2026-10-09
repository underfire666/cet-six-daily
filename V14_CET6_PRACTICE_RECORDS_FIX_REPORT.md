# V14.10.1 CET-6 Practice Records Fix Report

**版本**: 14.10.0 → 14.10.1
**日期**: 2026-10-09
**分支**: feature/v14-real-content-rights
**状态**: 开发完成，等待验收

---

## 一、修复清单

V14.10.0 浏览器验收审计（`output/playwright/records-audit/AUDIT.md`）发现 7 个问题，本轮全部修复：

### P1: 未完成练习提前显示答案
- **问题**: 直接访问未完成记录回顾地址，阅读显示正确答案、翻译显示参考译文。
- **根因**: `ExamRecordReview.tsx` 中 `!isCompleted` 时仍挂载 `ObjectiveReview`/`SubjectiveReview` 组件。
- **修复**: 新增 `IncompleteReview` 组件，未完成 session 只显示进度（已作答题数）和"继续练习"按钮，不渲染任何答案/解析/参考译文。
- **验证**: 浏览器直接访问未完成回顾 URL，页面显示"这是未完成的练习。完成后才能查看答案与解析。"，无答案泄露。

### P2: 返回链路丢失筛选
- **问题**: 从记录页继续练习退出后返回真题目录 `/practice/exams`；从回顾返回丢失 status/module 筛选。
- **根因**: session player 退出硬编码 `router.push("/practice/exams")`，未传递记录页筛选状态。
- **修复**:
  - 新增 `safeRecordsReturnUrl()` 严格验证 returnTo 必须是 `/practice/exams/records` 路径且只含 status/module 参数，拒绝外部 URL、协议相对 URL、子路由、未知参数。
  - 新增 `sessionExitHref()` / `completeExitHref()` 统一退出地址解析。
  - `ExamRecords.tsx` 将当前记录页 URL（含筛选）作为 `returnTo` 编码传递给"继续练习"和"查看记录"链接。
  - 四个 session player（Listening/Reading/Translation/Writing）和四个 Complete 页面的退出逻辑改用 `sessionExitHref()` / `completeExitHref()`。
- **验证**: 记录页筛选"未完成"→ 继续练习 → 退出 → 返回 `/practice/exams/records?status=in_progress`，筛选保留。

### P2: 复测答对仍显示"答错"
- **问题**: `resultLabel()` 优先检查 `initialResult`，初答错+复测对仍标"答错"；用户首次答对无"你的选择"标记。
- **根因**: 结果标签逻辑只看 initialResult，未考虑 retest 阶段。
- **修复**:
  - `resultLabel()` 改为优先展示最新阶段结果：有 retest 时显示"复测答对"/"复测答错"，否则显示"首次答对"/"重试答对"/"提示后答对"/"答错"/"未掌握"/"未完成"。
  - `isFinalCorrect()` / `finalUserAnswer()` 取最新作答（retest 优先于 initial）。
  - 选项标记：正确答案标"正确答案"，用户最终选择标"你的选择"（正确时绿色，错误时红色）。
  - 多次作答显示完整作答记录：`初答: A✗ → 重试1: B✓ | 复测1: C✗`。
- **验证**: 单元测试覆盖 6 种结果组合（初答错+复测对、初答错+复测错、首次答对、重试答对、无作答、复测优先）。

### P2: 共享题目套卷标识不全
- **问题**: `buildContentLookup()` 用 `map.has()` 只保留首次出现，`cet6:2022-06:set1:cloze` 对应第1、3套却只显示第1套且 sharedWith 为空。
- **根因**: 单阶段 map 构建，后出现的共享 set 被跳过。
- **修复**:
  - `buildContentLookup()` 重构为两阶段：先收集所有 content ID 对应的 set 集合，再构建最终 map。
  - `PracticeRecord.sharedWith: string | null` → `sharedSets: string[]` + `originalSetKnown: boolean`。
  - 历史 session 不存储原始套卷选择，标记 `originalSetKnown=false`，显示"第 X、Y 套共用"而非断言用户选了某一套。
- **验证**: 单元测试验证共享内容 `sharedSets` 包含所有共享套卷；非共享内容只有单个 set。

### P2: 详细解析未展示
- **问题**: 只显示 `q.explanation`（短解析），未显示 `q.details`（详细解析，实测 1394 字符）。
- **根因**: `ObjectiveReview` 只渲染 `q.explanation`。
- **修复**: 新增 `.er-explanation-detailed` 区块，在短解析下方显示 `q.details` 详细解析（黄色背景区分）。
- **验证**: 代码审查确认 `q.details` 渲染；`Question` 类型确认 `details` 字段存在且由 `readingLesson()`/`listeningLesson()` 从 `detailedExplanation` 映射。

### P2: 音频暂停后重播从头开始
- **问题**: `{audioPlaying && <audio .../>}` 条件渲染，暂停移除元素、播放重建元素导致进度归零；原生播放器暂停后自定义按钮仍显示"播放中"。
- **根因**: 条件渲染导致 audio 元素反复创建销毁。
- **修复**:
  - 改为始终渲染 `<audio>` 元素，用 `useRef` + `play()/pause()` 控制。
  - 监听 `onPlay`/`onPause`/`onEnded` 同步自定义按钮状态。
  - 页面卸载时 `useEffect` cleanup 自动 `pause()`。
  - 同时保留原生 `controls` 供用户直接操作。
- **验证**: 代码审查确认 audio 元素始终存在，状态同步正确。

### P2: 触控区域不足 44px
- **问题**: `.er-filters button` 和 `.er-toggle-btn` 均为 `min-height:40px`。
- **修复**: 两者 `min-height` 从 40px 改为 44px。
- **验证**: 浏览器 `getComputedStyle` 确认所有筛选按钮 `min-height: 44px`、`height: 44px`。

---

## 二、新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/exam-records-route.ts` | 修改 | 新增 safeRecordsReturnUrl / recordsReturnParam / readReturnToFromLocation / sessionExitHref / completeExitHref |
| `src/lib/exam-records.ts` | 修改 | sharedSets 重构、两阶段 buildContentLookup、href 增加 returnTo 参数 |
| `src/components/exams/ExamRecords.tsx` | 修改 | 传递 returnTo、共享套卷显示逻辑 |
| `src/components/exams/ExamRecordReview.tsx` | 重写 | 未完成隐藏答案、复测结果标签、详细解析、音频 ref 控制、returnTo |
| `src/components/exams/exams.css` | 修改 | 44px 触控、新增详细解析/未完成/选项标签样式 |
| `src/components/listening/ListeningSessionPlayer.tsx` | 修改 | 退出改用 sessionExitHref |
| `src/components/reading/ReadingSessionPlayer.tsx` | 修改 | 退出改用 sessionExitHref |
| `src/components/translation/TranslationSessionPlayer.tsx` | 修改 | 退出/完成改用 sessionExitHref |
| `src/components/writing/WritingSessionPlayer.tsx` | 修改 | 退出/完成改用 sessionExitHref |
| `src/components/listening/ListeningComplete.tsx` | 修改 | 退出改用 completeExitHref |
| `src/components/reading/ReadingComplete.tsx` | 修改 | 退出改用 completeExitHref |
| `src/components/translation/TranslationComplete.tsx` | 修改 | 退出改用 completeExitHref |
| `src/components/writing/WritingComplete.tsx` | 修改 | 退出改用 completeExitHref |
| `tests/v14-exam-records.test.ts` | 修改 | sharedWith → sharedSets 字段更新 |
| `tests/v14-exam-records-fix.test.ts` | 新增 | 27 个回归测试 |
| `package.json` | 修改 | version 14.10.0 → 14.10.1 |
| `package-lock.json` | 修改 | version 同步 |
| `PROJECT_CONTEXT.md` | 修改 | 版本更新 + V14.10.1 说明 |

---

## 三、测试结果

### 8/8 Gates

| Gate | 结果 | 详情 |
|------|------|------|
| `npm test` | PASS | 1313/1313 (新增 27 个 V14.10.1 测试) |
| `npm run typecheck` | PASS | tsc --noEmit 无错误 |
| `npm run lint -- --max-warnings 0` | PASS | 0 errors, 0 warnings |
| `npm run build` | PASS | Next.js production build 成功 |
| `npm run content:validate` | PASS | 0 errors, 0 warnings |
| `npm run content:stats` | PASS | 内容统计正常 |
| `npm run content:rights` | PASS | 生产池仅含允许内容 |
| `npm run content:audio-validate` | PASS | 141 音频资产，1 个 fixture 占位（允许） |

### 新增回归测试覆盖（27 个）

1. `safeRecordsReturnUrl`: 接受纯记录页、接受有效筛选、拒绝外部 URL、拒绝协议相对、拒绝子路由、拒绝未知参数、拒绝非法值归一化、拒绝 null/空、拒绝反斜杠/换行、拒绝其他内部路由
2. `recordsReturnParam`: 默认状态为空、非默认状态正确编码
3. `practiceSessionHref` / `practiceRecordReviewHref`: 带/不带 returnTo
4. `collectPracticeRecords`: 共享套卷 sharedSets、非共享内容、不修改输入 stores
5. `resultLabel` / `isFinalCorrect` / `finalUserAnswer`: 初答错+复测对、初答错+复测错、首次答对、重试答对、无作答、复测优先
6. `readExamRecords` + `examRecordsHref`: 筛选往返一致
7. 版本一致性: package.json version = 14.10.1

### 浏览器 E2E 验证

| 场景 | 结果 | 验证方式 |
|------|------|----------|
| 记录页加载 | PASS | 页面显示记录列表、筛选按钮、统计 |
| 未完成回顾不显示答案 | PASS | 直接访问回顾 URL，仅显示进度+继续练习 |
| 返回链路保留筛选 | PASS | 筛选"未完成"→继续练习→退出→返回带筛选的记录页 |
| returnTo 安全编码 | PASS | URL 中 returnTo 正确编码 |
| 44px 触控区域 | PASS | getComputedStyle 确认 min-height:44px |
| 控制台无错误 | PASS | 0 console errors |
| 移动端布局 (496px) | PASS | 无横向滚动、底部导航正常 |

---

## 四、未完成 / 已知问题

1. **完成 session 回顾页浏览器验证**: 当前浏览器 localStorage 中只有 1 条未完成记录，已完成 session 的答案/解析/复测标签/音频播放需在有完成数据时进一步验证。代码逻辑和单元测试已覆盖。
2. **共享套卷 UI 显示**: 历史 session 不存储原始套卷选择，显示"第 X、Y 套共用"而非具体某一套。未来 selected 会话可在创建时记录 examSet。
3. **GitHub 推送**: 此前 GitHub 443 端口连接超时，本轮修改尚未 push。网络恢复后需 `git push origin feature/v14-real-content-rights`。

---

## 五、Git 状态

- 分支: `feature/v14-real-content-rights`
- 基线 commit: `9862580` (V14.7–V14.10.0)
- 当前: worktree dirty（V14.10.1 修改未提交）
- v12.0 tag: `697772d9412d9d1a4253e099a001734a5230e264`（未变动）

---

## 六、结论

V14.10.1 修复了 V14.10.0 验收审计发现的全部 7 个问题，1313/1313 测试通过，8/8 gates 通过，浏览器 E2E 验证核心修复点正常。等待验收后提交 commit 并推送。
