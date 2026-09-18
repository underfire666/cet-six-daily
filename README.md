# 六级日常 · 第四版

保留学习首页与每日总关卡，词汇每日 20 词完成后可继续选择 10、20 或自定义数量。额外学习单独统计，复用卡片、巩固题、生词本、间隔复习与本地记录。使用本地 Mock 数据，面向本地浏览器演示。

当前规则见 [项目上下文](./PROJECT_CONTEXT.md) 和 [V4交付说明](./V4交付说明.md)。[V3交付说明](./V3交付说明.md) 保留为历史记录；其中词库耗尽停止新任务的规则已由 V4 的轮换巩固机制替代。

## 打开网站

项目位置：`E:\The king of CET`。双击项目里的 **启动网站.cmd**，保持启动窗口打开，再访问 **http://127.0.0.1:3000**。

```powershell
Set-Location 'E:\The king of CET'
npm ci       # 首次使用或依赖缺失时
npm run dev
```

开发服务只绑定本机。若 3000 端口被其他应用占用，可使用 `npm run dev -- --port 3001`，以启动输出为准。停止服务或关闭电脑后，需要重新启动。本地浏览器使用同一个地址：`localhost` 和 `127.0.0.1` 的本地存储彼此独立。

## 技术与页面

Next.js 16.3.5 App Router、React 19.3.0、TypeScript 6.0.3、Tailwind CSS 4.3.3、Lucide。依赖版本固定在 `package-lock.json`，Node.js 24.15.0 / npm 11.12.1 已验证。

| 地址 | 功能 |
| --- | --- |
| `/` | 原有月历首页；同步真实本地完成状态、继续学习、XP 与连续天数 |
| `/lesson/[date]` | 由占位页升级为每日答题；日期格式 YYYY-MM-DD |
| `/lesson/[date]?review=1` | 已完成关卡重练；保留独立练习进度 |
| `/lesson/[date]/complete` | 新增完成页，含完成度、正确率、奖励和轻量庆祝 |
| `/practice/vocabulary` | 今日词汇、待复习、生词本入口 |
| `/practice/vocabulary/wordbook` | 搜索、详情、收藏与主动复习 |
| `/practice/vocabulary/session/[id]` | 新词学习或复习，支持恢复 |
| `/practice/vocabulary/complete/[id]` | 本次统计、奖励及未掌握详情 |
| `/practice/[module]` | 听力、阅读、翻译、写作仍为占位页 |
| `/ai`、`/me` | 原有占位页 |

直接打开未来日期仍锁定。无效日期显示未找到页面；未完成时直接访问完成页会回到对应关卡。答题与完成页不显示首页底部导航。

## 新增结构与组件

```text
src/components/lesson/
  LessonPlayer.tsx       入口校验、题目流程与页面组装
  LessonProgress.tsx     仅显示整体进度与退出按钮
  QuestionRenderer.tsx   分发三种题型；含 ChoiceQuestion / ReadingQuestion
  AnswerFeedback.tsx     重试、简短解析、详细解析与底部按钮
  LessonDialog.tsx       通用弹窗、AiHint、LessonExitDialog
  LessonComplete.tsx     完成统计、庆祝、五项专项选择
  lesson.css            使用现有 Design Tokens 的独立样式
src/components/LearningProvider.tsx  管理本地学习资料、会话、设置
src/components/AppShell.tsx          按页面显示导航
src/data/mockLesson.ts              9 道原创示例题
src/types/question.ts               题目与关卡类型
src/types/session.ts                作答记录、会话、奖励、设置类型
src/lib/lesson/session.ts           纯函数答题状态转换与进度计算
src/lib/lesson/profile.ts           历史状态、XP 与连续天数
src/lib/lesson/storage.ts           本地存储、校验、内存降级
src/lib/lesson/feedback.ts          短音效与可选触觉反馈
tests/lesson.test.ts                答题、复测、持久化与奖励测试
```

## Lesson 数据结构

`LessonDefinition` 包含 `id`、`version`、`title`、`minutes`、`questions`。

题目使用 TypeScript 可辨识联合类型：`choice` 单选、`fill_blank` 句子填空、`reading` 阅读。共同字段为 `id`、`module`、`prompt`、`options`、`answerId`、`explanation`、`details`、`hint`；填空附带 `sentence`，阅读附带 `passage` 和 `passageTitle`。

模块类型预留词汇、听力、阅读、翻译、写作。本版实际内容是 **3 道词汇单选 + 3 道句子填空 + 3 道短篇阅读**，因此首页学习模块同步显示词汇、阅读，预计 14 分钟。每个日期使用同一份示例题，但作答会话独立。

## 作答、复测和进度

- 未选择答案时不能提交；选中后「检查」，反馈后「继续」。
- 第一次错只显示「再试一次」，不会展示答案或解析；第二次错才显示答案、简短解析及默认收起的详细解析。
- 第二次仍错的题加入末尾复测队列。全部原题结束后先出现巩固过渡页，再逐题复测。
- **每道错题只复测一次**。复测错则记录 `unmastered`，不再重新排队。
- 每道题分别保存首轮 `initial` 与复测 `retest` 的提交记录、正确性、是否用过提示和最终结果，避免覆盖首轮错误。
- 结果类型为 `first_try_correct`、`second_try_correct`、`ai_hint_correct`、`wrong`、`unmastered`。使用过提示后答对优先记录 `ai_hint_correct`。
- 进度分母固定为 9 份任务权重。正常完成得 1；待复测题先得 0.5，完成复测再得 0.5，加入复测不会让进度倒退。
- 正确率固定按 **首轮第一次提交答对的题数 ÷ 9** 计算，后续重试和复测不改变分母。

## 保存与断点续学

通过独立存储接口写入 `localStorage`，键名前缀 `cet-daily:v2:`：

- `profile`：首次使用日期、完成过的学习日期、按实际完成日期登记的奖励；`bonusXpEvents` 保存词汇会话奖励，按会话去重。
- `session:YYYY-MM-DD:daily/review`：每个日期与练习模式各自的题目位置、选项、轮次、尝试、提示、反馈、复测队列与完成统计。
- `settings`：`soundEnabled`、`hapticsEnabled`、`celebrationEnabled`；统一接口已建立，默认开启，设置页未在本阶段实现。

每次选答案、提交、使用提示或继续时立即保存。退出、浏览器后退、刷新后都可恢复当前问题及反馈阶段；解析折叠和弹窗开关属于临时界面状态。

载入时检查数据结构、会话版本、题目版本与状态一致性；损坏的单份会话不会清空其他会话。存储权限或容量不足时退化为页面内存，并显示简短提示。此时刷新或关闭页面可能丢失进度。

数据仅在当前浏览器、当前站点地址保存；不会同步其他设备。清除浏览器站点数据会清除学习记录。本版按单标签页演示设计，未提供多标签页同时作答的冲突合并。

## 奖励与日期

- 初始用户一翔，Lv.12 · 进阶者，1240 / 1500 XP；首次使用日前 7 天作为固定演示历史。
- 历史锚点首次保存后不随午夜滚动。跨日未完成日期不会自动变成完成，新一天有独立会话。
- 首次完成正常关卡可得 45 XP，每个实际学习日最多一次。重练及已计奖关卡不重复增加 XP 或连续天数；完成页刷新不重复计奖。
- 连续天数按 `Asia/Shanghai` 的实际完成日计算，跨午夜完成算新一天。
- 页面每秒及重新聚焦时检查日期；服务端与客户端首屏共用日期，避免日期差导致首屏不一致。
- 考试目标 **2026-12-11** 是第一版实施日后 87 天的固定 Mock 日期，**不是官方考试日期**。倒计时随真实日期递减，过期后提示更新目标。

## 验证

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

自动测试覆盖日期边界、闰年、解锁、重试、提示优先级、所有错题仅复测一次、末题复测过渡、进度单调、会话恢复、坏数据隔离、存储降级、奖励幂等、跨午夜及固定历史。

浏览器检查使用 Chrome：375 / 390 / 430 / 768 / 1440px；检查完整混合作答流程、退出续学、刷新、重练、题型、提示、解析展开、完成奖励、直接路由、五项专项入口、导航、减少动态效果、横向溢出及底部安全区。截图与验证脚本位于 `output/playwright/`（不纳入版本管理）。

## Mock 范围与限制

题目、30 个示例词汇、AI 提示、初始用户、历史计划和考试目标仍为 Mock。没有真实 AI API、数据库、登录、题库服务或复杂听力播放器；听力、阅读、翻译、写作、AI 页和个人页仍为占位功能。词汇进度、收藏和复习记录为真实本地操作数据。

声音使用浏览器合成的短音效；触觉依赖设备支持，不支持时静默忽略。庆祝尊重减少动态效果设置。真实手机硬件、Safari 和 Firefox 尚未实测。

本阶段完成后停止扩展，等待 UI 检查。
