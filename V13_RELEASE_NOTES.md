# V13 — Content 1.0

## 概述

V13 完成了 CET-6 Daily 从"专项练习 + 云同步"向"完整内容生产管线 + 原创模拟卷"的升级。建立了 rights-aware 内容架构、命名空间隔离、生命周期管理，并生产了第一套完整原创高仿真 CET-6 模拟卷 Paper 001。

## 核心变化

### 内容架构
- **Content Lifecycle**：raw → normalized → validated → reviewed → publishable → published → deprecated，状态机合法迁移
- **Rights-aware pipeline**：每份内容携带 provenance / authenticity / license / allowedUse / restrictions / generated flag / AI disclosure
- **Namespace hardening**：REAL / MOCK / FIXTURE 三类命名空间严格隔离，production selector 只接受 active/published 且非 fixture 内容
- **Exam Spec**：`cet6-current-2026` 显式绑定当前官方 CET6 结构（Writing 1 / Listening 25 / Reading 30 / Translation 1）

### 原创模拟卷 Paper 001
- **paperId**：`cet6:mock:paper-001`
- **身份**：authenticity=original、fixture=false、isPartial=false、contentVersion=1.1.0
- **结构**：Writing 1 / Listening 25（长对话 2 组 8 题 + 篇章 2 组 7 题 + 讲话·报道·讲座 3 组 10 题）/ Reading 30（选词填空 10 + 长篇阅读 10 + 仔细阅读 10）/ Translation 1，共 57 题/任务
- **听力音频**：7 个独立 MP3（一 material 一 asset），AI 合成语音，production flow 中可见"AI 合成语音"标识
- **全部内容原创**：题目、文章、听力脚本、解析均由项目编写，未复制真实历年真题、第三方解析或官方音频

### 完整学习流程
- **Paper Session**：完整 57 题答题流程，支持 Writing/Translation 主观题草稿保存、Listening 音频播放、Reading/Listening 客观题提交
- **Result**：交卷后成绩页，各 section 得分与正确率
- **Review / Wrongbook**：错题本接入，replayReviewItem 通过正式 lifecycle resolver 解析 Paper 原题（staging/draft/raw 不可解析）
- **XP**：交卷后按规则结算 XP，复用全局 XP 奖励机制
- **持久化**：PaperSession 存储复用 V12 LearningSession 表（module="paper"），支持 guest / logged-in / cloud sync / multi-device conflict merge

### Production Entry
- **模拟卷列表页**：`/practice/paper`，展示所有 production-eligible 模拟卷
- **模拟卷答题页**：`/practice/paper/[paperId]`，正式 production 入口，仅接受 active/published Paper
- **首页导航**：PracticeModules 中新增"模拟卷"入口卡片
- **QA route**：`/qa/paper/[paperId]` 保留为 dev-only staging 测试入口，production 用户不依赖

### 质量与验证
- **Editorial Acceptance**：57 题逐题语义审查，答案分布校准（a14/b10/c11/d10），cloze 双解修复
- **Audio QA**：7 个音频全部通过 clarity / naturalness / stitching / pronunciation / volume / speed 检查
- **Responsive**：375 / 390 / 430px 手机宽度及桌面布局验证
- **Accessibility**：多页面 Playwright audit 通过
- **Multi-device Conflict Merge**：真实浏览器双设备并发 E2E，10/10 答案一致，SESSION_ID 匹配

## 重要说明

**Paper 001 是原创模拟卷，不是官方 CET6 真题。** 听力音频为 AI 合成语音，仅供学习练习使用。

## 技术细节
- **IMPORTER_VERSION**：v13.0.0
- **Prisma**：无 schema 变更，无 migration
- **v12.0 tag**：未动（`697772d`）
- **测试**：504/504 PASS
- **Gates**：typecheck / lint(0 errors 0 warnings) / build / content:validate / content:stats / content:rights / content:audio-validate 全部 PASS
