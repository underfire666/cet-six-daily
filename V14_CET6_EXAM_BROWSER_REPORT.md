# V14.9.0 真题浏览与选练验收报告

日期：2026-10-08（Asia/Shanghai）。状态：本地实现与验收 PASS。

## 交付

- 首页新增“真题题库”入口，地址 `/practice/exams`。保留五项专项、原模拟卷与三项底部导航。
- 浏览 2022—2026 年 33 套试卷，按年份、考期和套卷筛选。包含 2022 年 9 月、2023 年 3 月考期；空筛选与不存在的套卷有明确返回入口。
- 每套可选择听力 7 组、阅读 4 组、翻译 1 项、写作 1 项。目录引用既有 manifest 与规范内容 ID；共用套卷共用内容和进度。仍为 311 个独立题组/任务、1381 道题/任务，没有新增或重复导入内容。
- 四项专项增加 `selected` 会话模式，精确选择当前题组，未完成时继续同一会话。选练绕过每日完成门槛，独立于每日/额外计数；原存档、计划、草稿、XP、生词与学习流程保留。
- URL 保存筛选、套卷与专项。退出/结算返回原选择，刷新及浏览器后退/前进保持状态。旧格式直接学习/结算链接的选练返回题库；非法或缺失会话可安全返回。
- 本地保存现有答题阶段、答案、听力速度和主观题草稿。共用题目采用同一个规范 ID，避免重复生成学习记录。完成沿用原 XP 账本：同一天同组题重复练习不再奖励；+0 XP 有原因说明。
- 保留绿色 Design Tokens、44px 操作区、键盘焦点和减少动态效果支持。浏览页显示保存失败提示，保存失败时不宣称“进度已保存”。底部导航固定，内容预留安全区。
- `package.json`、锁文件根版本、关于页统一 `14.9.0`，阶段 `V14 CET-6 Exam Browser and Selected Practice`。应用版本不等于内容 schema/contentVersion。

## 主要结构

| 路径 | 职责 |
|---|---|
| `src/content/exam-catalog.ts` | 从两份 manifest 建立目录，校验活动题组及共用关系 |
| `src/lib/exam-browse-route.ts` | 筛选参数净化、选练地址、固定内部返回地址 |
| `src/app/practice/exams/` | 真题浏览页面与样式布局 |
| `src/components/exams/` | 浏览、筛选、专项与进度界面 |
| 四项 `store.ts` / `storage.ts` / Provider | 精确选练、继续会话、存档验证 |
| 四项 Home / Player / Complete | 复用练习流程、返回与奖励提示 |
| `tests/exam-catalog.test.ts` / `tests/exam-selected-sessions.test.ts` | 新增 43 项回归测试 |

## 验证

| 项目 | 结果 |
|---|---|
| 全量测试 | 1263/1263 PASS（原 1220 + 新增 43） |
| TypeScript | PASS |
| ESLint | 0 errors / 0 warnings |
| 生产构建 | PASS，包含 `/practice/exams` |
| content:validate / stats / rights / audio-validate | 4/4 PASS |
| 音频检查 | 0 errors；保留原 synthetic fixture 的 1 条允许 placeholder warning |
| Chrome 主流程 | 226 项 PASS |
| Chrome 补充检查 | 22 项 PASS |
| 宽度 | 375、390、430、768、1440px 无横向溢出，末尾按钮可滚动至导航上方 |
| 控制台 / 页面错误 | 0 条未预期错误 |
| 访问验证 | HTTP 200；本地生产预览已启动 |

新测试覆盖：33 套四项规范 ID、共用第二套听力与五套共用阅读、Mock/PRIVATE/下线/未知 ID 拒绝；四项精确开始、跨日继续、每日与额外隔离、答题/倍速/草稿刷新、完整结算与 XP 去重；完成会话同步恢复、账号存储隔离；安全 URL 与返回净化。

浏览器覆盖：逐套四项目录引用、筛选/空列表/非法套卷、五种宽度与44px区域、原录音播放中的0.8×切换、听力与阅读答题/退出/刷新/结算、三种阅读格式、翻译与写作草稿/提交/结算/重复+0 XP、共用套卷继续同一会话、后退/前进、旧格式直接访问、存储配额失败、首页入口与14.9.0关于页。测试使用独立访客浏览器，结束时清空测试学习数据。

## 本地交付

- 项目：`E:\The king of CET`。
- 访问：`http://127.0.0.1:3033/practice/exams`；首页 `http://127.0.0.1:3033`。
- 重新启动：先 `npm run build`，再 `npm run start -- --port 3033`。
- 日志、结果与截图仅本地保留于 `output/playwright/exams/`（已忽略）。
- 截图：`final-list-390.png`、`final-detail-390.png`、`final-detail-1440.png`；另有五种宽度列表/详情与+0 XP截图。完整长页截图是浏览器捕获产物；实际底部遮挡用滚动到底与按钮边界检查。

## Git 与边界

分支：`feature/v14-real-content-rights`。当前 HEAD：`fe56fc446fc146c2c76046c842ff2d38cf16bbf5`。工作树有既有与本轮修改，本轮未提交/推送/合并/打标签/创建 Release/线上部署，不宣称远程同步或 Git FINALIZED。

本轮只做既有题库浏览与选练，没有新导入文件、数据库迁移、整卷计时考试、上传、OCR 或 AI。正式 Paper 发布筛选、Paper 001、PRIVATE owner 边界及内部来源/unknown/unverified 元数据保持既有规则。翻译与写作沿用规则估分，并非官方评分。未完成选练主要保存在当前浏览器，未新增跨设备草稿同步；已有完成会话同步路径通过回归验证，本轮没有重新实测登录云同步。仅 Chrome 模拟宽度，未实测实体手机、软键盘或其他浏览器。

V14.9.0 本地验收完成，等待用户检查 UI，不开始下一版。
