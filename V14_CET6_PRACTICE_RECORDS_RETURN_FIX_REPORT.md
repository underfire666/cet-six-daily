# V14.10.2 学习记录返回修补报告

- 日期：2026-10-09。
- 应用版本：14.10.2。
- 阶段：V14.10.2 CET-6 Practice Records Return Fix。
- 状态：本地实现及验收完成；尚未提交本轮修改或发布。

## 修复结果

| 问题 | 当前行为 | 验证 |
| --- | --- | --- |
| 翻译、写作从记录页进入后关闭仍回题库 | 页面使用当前查询参数，关闭立即返回原记录列表及 status/module | 页面内点击导航实测通过，无需先刷新 |
| 四项练习完成后丢失 returnTo | 原 session → 结算 → 刷新 → 返回保留记录页上下文 | 四项完整操作及结算刷新全部通过 |
| 旧结算入口清空题库筛选 | 有合法记录页返回地址时优先；否则保留原题库完整地址 | 四项旧直接结算链接及原 query 入口全部通过 |
| 返回按钮文案与目的地不一致 | 记录来源显示“返回学习记录”，题库来源显示“返回真题题库” | 两类入口实际点击验证 |
| 回归测试复制页面逻辑 | 页面和测试导入相同生产函数，验证真实返回地址和共享集合 | 新增返回测试 24/24，回顾修补测试 30/30 |

## 实现

- `src/lib/exam-records-route.ts`：移除对全局浏览器地址的依赖，显式接收 search；新增 recordsReturnFromSearch、practiceCompleteHref；记录页返回严格校验，完成地址保留合法返回上下文和规范化题库筛选。daily/extra 返回专项首页。
- 听力、阅读、翻译、写作 SessionPlayer 和 Complete 共 8 个组件使用 useSearchParams；四项完成导航传递返回上下文，保留已有 onExit/onComplete/onHome 回调优先级。
- `src/lib/exam-record-review.ts`：提取最终结果、最终选项、正确性和作答历史函数，供回顾组件及测试共用。
- `tests/v14-exam-records-return.test.ts`：24 项返回回归，包含四项完整链路、目录筛选、来源优先级、daily/extra、非法返回地址、ID 边界及无 window 的纯函数运行。
- `tests/v14-exam-records-fix.test.ts`：删除函数副本，精确校验共享阅读 `["1", "3"]`、共享听力 `["2", "3"]` 和非共享 `["1"]`；补充作答历史及版本一致性检查。
- package.json、package-lock.json、关于页与 PROJECT_CONTEXT.md 同步为 14.10.2；旧 14.10.1 报告注明复核未通过及后续修补位置。

本轮共增加 27 项自动测试（新增返回测试 24 项、回顾测试增加 3 项）。

## 自动检查

| 检查 | 实际结果 |
| --- | --- |
| npm test | 1340/1340 PASS |
| npm run typecheck | PASS |
| npm run lint -- --max-warnings 0 | PASS，0 errors / 0 warnings |
| npm run build | PASS |
| npm run content:validate | PASS，0 errors / 0 warnings |
| npm run content:stats | PASS |
| npm run content:rights | PASS |
| npm run content:audio-validate | PASS，141 音频资产；原测试夹具有 1 项允许占位警告 |

完整检查为 8/8 PASS。新增测试的局部变量名引起的 Next ESLint 报错已修正，修正后定向测试、完整 ESLint 和类型检查均通过。

## 浏览器验收

Chrome 独立访客环境：116/116 PASS，0 条非预期页面或控制台错误；测试存档已清理，没有使用用户现有浏览器的学习数据。

### 主流程：102 项

- 四项未完成回顾及刷新保持答案隐藏。
- 从带筛选记录列表进入原 session，关闭/退出恢复记录列表及筛选。
- 完成回顾保留用户最终选择、初答/重试/复测历史、参考内容和详细解析；回顾返回保持筛选。
- 回顾和音频操作不改变持久化学习数据。
- 回顾音频暂停后继续播放保留进度；原生暂停同步自定义按钮。
- 从原记录页继续，实际点击最后一步完成四项 session；结算 URL 保留 returnTo，刷新结算页后仍可返回原记录列表。
- 四项旧式直接结算链接保留题库年份、考期、套卷和专项。
- 不存在的记录、无效专项和非 selected 会话有正常兜底。
- 375、390、430、768、1440px 的记录列表和四项回顾无横向溢出；正文页尾可以滚动到固定底部导航上方；筛选按钮达到 44px。

### 原入口、音频和版本补查：14 项

- 共享内容实际显示阅读第 1、3 套，听力第 2、3 套。
- 四项原题库 query 入口完成及刷新后，继续返回原题库筛选和套卷。
- 听力播放中切到 0.8×，时间由 1.208271 秒继续到 1.228495 秒，保持播放且 playbackRate=0.8；没有从头开始。
- 暂停时切回 1.0×，仍保持暂停及原播放位置。
- 关于页实际显示 14.10.2。
- `http://localhost:3000` 首页实际可访问。

## 本地访问和截图

项目目录：`E:\The king of CET`。

实际地址：[本地首页](http://localhost:3000)，[学习记录](http://localhost:3000/practice/exams/records)。沿用已运行的本地开发服务器；生产构建单独验证通过，浏览器检查使用开发预览。

需要重新启动时，在项目目录运行 `npm run dev`，按终端实际显示的端口访问。

- [390px 手机记录列表](<E:/The king of CET/output/playwright/records-return-fix/list-390.png>)
- [1440px 桌面记录列表](<E:/The king of CET/output/playwright/records-return-fix/list-1440.png>)
- [390px 阅读回顾](<E:/The king of CET/output/playwright/records-return-fix/reading-review-390.png>)
- [390px 关于页版本](<E:/The king of CET/output/playwright/records-return-fix/about-390.png>)
- [102 项主流程结果](<E:/The king of CET/output/playwright/records-return-fix/browser-results.json>)
- [14 项补查结果](<E:/The king of CET/output/playwright/records-return-fix/extra-results.json>)
- 检查日志及其他宽度截图保留在 `output/playwright/records-return-fix/`。截图使用独立测试存档，不表示用户的实际学习记录。

## Git 状态

```text
BRANCH = feature/v14-real-content-rights
BASELINE_HEAD = f9f42f63d3a4d852390c4332890fdf60a7cf093b
LOCAL_HEAD = f9f42f63d3a4d852390c4332890fdf60a7cf093b
WORKTREE = DIRTY (本轮本地修复，尚未提交)
REMOTE_HEAD = NOT VERIFIED
LOCAL_EQUALS_REMOTE = NOT VERIFIED
V12_TAG = 697772d9412d9d1a4253e099a001734a5230e264
```

本轮未执行 push、merge、tag、Release 或线上部署，不宣称 Git FINALIZED。

## 范围和限制

- 本轮完成已确认的返回缺口与必要回归，未扩展题库、数据库、上传、OCR、AI 或整卷考试。
- 学习记录继续使用原本的本地存档，不新增跨设备未完成会话同步。
- 浏览器检查为 Chrome 模拟尺寸，未实测实体手机或其他浏览器。
- 本轮三类返回问题均已修复，未发现新的阻塞问题；等待用户检查 UI。
