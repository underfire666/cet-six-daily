# V14 Phase 1D.1 — Private Reading Choice MVP 最终收尾报告

日期：2026-10-01
分支：feature/v14-real-content-rights
状态：实现及验收通过；Git 最终提交/远程一致性另记录于本地 output/v14d1-git-closure.md，避免报告自引用提交 SHA。

## 范围

已实现 owner-scoped 私有卷详情 → 开始学习 → 阅读选择题作答 → 提交确认 → 正确率/答案/解析回顾 → 重新练习。只支持非草稿 reading section / careful_reading group / 内联 choice，混合不支持内容整体拒绝。

答题进度仅保存在当前标签页 sessionStorage，按 ownerId + paperId 分键，并校验内容指纹。没有服务端答题存储、跨设备同步、XP/Streak/全局学习统计、Daily Plan 或 Review 接入。未接 PDF/OCR/AI；未开始 Phase 1E；未修改 Prisma、Paper 001、main、标签或 Release。

## 本次修复

1. **提交验证结果**：verifyPaper 明确返回 boolean；每次提交、未答题确认和重新练习都重新验证并等待本次结果。旧的 verified 状态不再允许跳过；网络失败、500、坏响应均保留内存答案并阻止结算。同步操作锁阻止重复提交及提交过程中改答案。
2. **账号与请求隔离**：实际 session.user.id 必须匹配页面 owner；不匹配时立即隐藏旧试卷，并禁止存档/操作。绑定清理、请求序号及 AbortController 避免旧响应覆盖较新的错误。验证 API 使用服务端 session owner，返回 ownerId、contentHash、ready；即使指纹没变，试卷转成草稿也不能提交。已提交结果在重新聚焦时同样验证。
3. **排序一致性**：section/group/question 均使用 order，再以稳定 ID 打破同序号并列。展示和指纹采用相同规则，数组倒序不再导致答案错位。
4. **存档校验**：指纹升级为 v3，存档 version=3 必填。旧版存档不迁移，失效提示后重新作答。answers 必须为对象，索引必须为规范非负整数字符串，值必须是对应题目的 optionId；额外越界答案忽略；submitted 必须为 boolean，currentIndex 必须为安全整数，整数越界钳位。损坏/缺版本/账号不符/内容变化均不恢复旧结果。
5. **存储失败**：不再通过试写探测读取能力，因此配额满仍可读取已有进度；写入失败单独提示，继续保留内存作答。清空失败也明确提示，避免声称已清空。
6. **弹窗**：原生 dialog/showModal 提供背景不可操作；移除 aria-hidden 父级，保留标题/描述关联。显式 Tab/Shift+Tab 焦点循环，Escape 关闭并恢复提交按钮焦点。不改变既有绿色主题。
7. **报告准确性**：修复两个未使用变量 lint 警告；更新当前项目状态，替换此前尚未实测的手机宽度与 gates 声明。

## 自动验证

| 检查 | 结果 |
|---|---|
| npm test | 748/748 PASS；私有学习专项 74/74 |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 error / 0 warning |
| production build | PASS |
| content:validate | PASS，0 error / 0 warning |
| content:stats | PASS，production pool 保持 Paper 001 |
| content:rights | PASS，生产内容均通过 rights guard |
| content:audio-validate | PASS，0 error；仅已有允许的 synthetic fixture placeholder warning |

新增 9 项回归测试覆盖缺版本、缺失/字符串 submitted、非法选项、数字答案、歧义索引、合法答案计数、满配额读取及三级相同 order 的稳定映射。此前 decimal/array 存档测试改为明确拒绝。

## 浏览器实测

使用生产构建、隔离浏览器和两个随机测试账号，共 **56 项 PASS**。测试用户及关联私有卷全部按精确 id/email 清理。

- 375、390、430、768、1440px × 学习页/弹窗/结果页，保存 15 张截图；无横向溢出。
- 各宽度 Tab、Shift+Tab 循环，Escape 关闭与焦点恢复。
- 答案/当前题刷新恢复；已提交结果刷新恢复；同 order 数组倒序后答案映射保留。
- 既有 verified 后模拟网络失败，提交仍验证且不结算；重试成功后可提交。
- 弹窗打开后改为草稿，确认提交重新检查 ready 并拦截。
- 存储配额失败保留内存答案；缺 version 的 submitted 存档拒绝恢复。
- 500、200 坏响应、401 均阻止结算；旧 200 迟到不覆盖新 404。
- 结果页删除试卷后重新聚焦，撤销旧结果显示。
- B 登录后原 A 页面立即隐藏 A 题目；B 对 A 的 get/verify/update/delete 一律 404；匿名 verify 为 401。
- 正常私有练习不写全局 cet-* localStorage 学习记录；主学习链路无 pageerror。

证据仅保留本地：output/v14d1-browser-results.json、output/v14d1-final-tests.log、output/v14d1-final-build.log；截图 output/playwright/v14d1-{study,modal,result}-{width}.png。未上传公开附件。

## 最终边界及限制

PRIVATE_LEARNING_FLOW = LIMITED_READING_CHOICE_MVP
PRIVATE_PROGRESS = TAB_LOCAL_ONLY / VERSION_3
PRIVATE_SYNC / REVIEW / DAILY_PLAN / XP = NOT_IMPLEMENTED
PHASE_1E_STARTED = NO

sessionStorage 关闭标签页后丢失，不是跨设备存档。版本 2 及缺版本的旧答题进度失效，用户需重新作答。手机宽度为桌面 Chrome 模拟视口，未做真机软键盘/屏幕阅读器或跨浏览器测试。权限与内容验证是每次操作前的快照，不提供数据库事务式服务器结算。

完成本阶段后停止，等待用户验收。
