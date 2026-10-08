# V14.10.0 — CET-6 真题学习记录与回顾

## 概述

在现有 33 套真题浏览 + 四项选练（听力/阅读/翻译/写作，使用 selected 会话，已有本地进度保存、每日任务隔离、XP 去重）基础上，增加统一的"学习记录"入口 `/practice/exams/records`：集中找到未完成选练、继续原练习和草稿、查看已完成练习的只读详情、区分多次重新练习。

围绕现有 selected 会话实现，不新增数据库迁移、不新增云同步。

## 实现清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/exam-records.ts` | 学习记录聚合层：从四项 store 收集 selected 会话、筛选、排序、时间格式化、URL 生成 |
| `src/lib/exam-records-route.ts` | 记录页 URL 状态管理（status/module 筛选） |
| `src/components/exams/ExamRecords.tsx` | 学习记录列表组件（状态筛选、专项筛选、记录卡片、空状态） |
| `src/app/practice/exams/records/page.tsx` | 记录列表页面路由 |
| `src/components/exams/ExamRecordReview.tsx` | 只读回顾组件（客观题/主观题两种展示模式） |
| `src/app/practice/exams/records/[module]/[sessionId]/page.tsx` | 回顾页面路由 |
| `tests/v14-exam-records.test.ts` | 23 个回归测试 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `src/components/exams/ExamBrowser.tsx` | 真题题库页 header 添加"记录"入口链接 |
| `src/components/exams/exams.css` | 新增 .er-* 系列样式（记录卡片、筛选、回顾页、题目、选项、反馈等） |
| `package.json` | 版本 14.9.0 → 14.10.0，appPhase 更新 |
| `package-lock.json` | 版本同步 |

## 核心功能

### 1. 学习记录列表 `/practice/exams/records`

- 从听力、阅读、翻译、写作四项 store 聚合所有 `mode="selected"` 的会话
- 按未完成/已完成 + 四项专项筛选
- 未完成按开始时间倒序，已完成按完成时间倒序
- 筛选状态通过 URL query 保存（`?status=in_progress&module=reading`）
- 记录卡片显示：专项图标、题组名称、试卷信息（年份/考期/套卷）、开始/完成时间（Asia/Shanghai）、答题进度、已获得 XP
- 未完成记录显示"继续练习"按钮，已完成记录显示"查看记录"按钮
- 空状态提示并引导前往真题题库

### 2. 继续未完成练习

- 点击"继续练习"直接跳转到原模块的 session 页面（`/practice/{module}/session/{sessionId}`）
- 恢复原模块和阶段：听力答题位置/答案/倍速、阅读阶段/答案、翻译写作草稿/待结算结果
- 不创建替代会话、不覆盖草稿

### 3. 已完成记录只读回顾 `/practice/exams/records/{module}/{sessionId}`

**客观题（听力/阅读）：**
- 展示原文（可展开/收起）
- 听力可播放音频（回顾模式，不修改统计）
- 每题展示：题目、选项、用户答案标记、正确答案标记、解析
- 区分首次作答/重试/复测（作答记录展示）
- 全部只读，无提交/重算/改时间/改 XP

**主观题（翻译/写作）：**
- 展示题目（翻译中文原文 / 写作 directions + requirements）
- 展示用户提交文本和字数
- 展示反馈：估分、总结、主要问题、详细分析
- 展示参考答案和解析
- 标明估分性质

### 4. 历史兼容与隔离

- 从现有四项存储 selected 会话生成记录，无需数据迁移
- 每次重新练习独立 session，保留独立记录
- 保留原每日/额外练习/翻译写作历史
- 账号隔离（localStorage 按账号前缀）
- 损坏存档有返回入口
- 无效 module/sessionId/非 selected 会话均有友好错误页

## 测试结果

| 测试项 | 结果 |
|--------|------|
| npm test | 1286/1286 PASS（新增 23 个） |
| TypeScript typecheck | PASS |
| ESLint | 0 errors / 0 warnings |
| Production build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS（1 fixture placeholder warning，预期） |

### 新增测试覆盖（23 个）

- collectPracticeRecords: 收集四项 selected 会话
- collectPracticeRecords: 忽略非 selected 会话（daily/extra）
- collectPracticeRecords: 已完成会话状态和 XP
- collectPracticeRecords: 未完成会话状态
- collectPracticeRecords: 同一内容多次练习独立记录
- collectPracticeRecords: 未知 contentId 元数据为 null
- filterRecords: 按状态筛选
- filterRecords: 按专项筛选
- sortRecords: 未完成按 startedAt 倒序、已完成按 completedAt 倒序
- sortRecords: 未完成始终排在已完成前
- formatShanghaiTime: 上海时区格式化
- formatShanghaiTime: null 返回破折号
- moduleLabel: 中文标签
- practiceSessionHref / practiceRecordReviewHref: URL 生成
- readExamRecords: 解析有效/无效/空 query
- examRecordsHref: 生成带筛选 URL，省略默认值
- collectPracticeRecords: 客观题已答题数统计
- collectPracticeRecords: 空 store 返回空数组
- collectPracticeRecords: 已完成但未 applied 的会话 XP 为 null

## 约束遵守

- 不新增数据库迁移
- 不新增云同步
- 不修改现有 selected 会话存储结构
- 不增加题库内容
- 不做整卷考试、OCR、AI评分、新复习调度
- 只读回顾不得修改任何学习数据
- 日期统一使用 Asia/Shanghai

## 版本

- package.json: 14.10.0
- appPhase: V14.10.0 CET-6 Practice Records & Review

## 已知限制

- 本轮保持浏览器本地存档，未完成会话不跨设备云同步
- 听力回顾音频播放使用原生 audio 元素，不经过学习统计
- 主观题反馈为 Mock 估分，仅供参考
