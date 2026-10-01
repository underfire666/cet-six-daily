# V14 Phase 1E.1 — Private Study Progress Sync MVP 最终验收报告

日期：2026-10-01（Asia/Shanghai）
分支：feature/v14-real-content-rights
状态：实现与验收通过。最终提交及远程闭环记录于本地 output/v14e1-git-closure.md，避免本文件自引用提交 SHA。

## 1. 范围

同一账号的私有 reading / careful_reading / choice 学习进度可以保存云端，并在另一个隔离浏览器环境恢复答案、当前题号及提交结果。网络失败保留本地答案和持久待同步队列；联网或手动重试后继续同步。

不接 XP、Streak、全局学习统计、Review、Daily Plan、其他私有题型、PDF/OCR/AI、分享。未开始 Phase 1E.2；不修改 Paper 001、main、既有标签或 Release。

## 2. 本轮阻塞问题及修复

### 队列与全局同步隔离

- 使用独立账号键 cet-daily:v14:private-progress-queue:{userId}，复用 V12 的 mutation 数据结构。
- V12 push、pending 计数、手动同步及账号页仅处理全局队列，privateProgress 不再导致整个全局批次被拒绝。
- 原 V12 队列中的 PRIVATE 记录先成功保存到独立队列，再移除旧位置；存储失败不丢弃旧记录。
- 本地答案和队列立即保存；500ms 仅延迟网络发送。未获确认的请求 ID/payload 保持不变，不能被新答案覆盖。新快照在旧请求确认后更新基础版本并继续推送。
- 同账号推送串行，联网事件与后台同步均可重试；账号身份代次防止 A→B→A 的旧响应误确认。

### 数据库并发与删除

- 事务内通过 PostgreSQL FOR UPDATE 锁定当前 owner 的 PrivatePaper 行，再检查 readiness、指纹、当前 revision 和 attempt。
- 同一基础版本的并发更新只允许一个成功，另一个返回冲突；不是仅在事务外先读后无条件覆盖。
- 删除试卷与进度位于同一事务；不再忽略进度删除失败。删除与同步共用试卷行锁，旧请求不能重建已删除的卷。
- GET 对答案作只读净化，不回写旧快照覆盖更新后的答案。

### 请求幂等与练习轮次

- progressVersion=1、mutationId、baseRevision 为必填合约。专用接口校验实际答案选项和服务端当前内容，不接客户端分数。
- 复用 SyncMutation 存储请求及写入结果，与进度更新同一事务提交；同 ID、同请求返回原 revision/updatedAt，同 ID 不同请求拒绝。
- mode=save 只更新当前轮次；mode=restart 明确切换为新的 attemptId，并且必须匹配当前基础版本。
- 内容更新使旧进度失效，GET 提供当前 revision 供新轮次条件重启，不恢复旧内容答案。

### 恢复及冲突处理

- 恢复前先检查同 owner、同 paper、同 contentHash 的未确认队列和本地 dirty 草稿。
- 有未上传答案时保留本地视图，再尝试上传；不能无条件用旧云端覆盖。关闭标签页后，仍可从持久 PRIVATE 队列恢复草稿。
- 服务端版本/轮次冲突保留本地答案，提供采用云端、保留本地、重新开始。不同练习的答案不自动合并。
- 冲突对话框在答题页和结果页均可操作；键盘焦点循环保持。
- 读取失败与无云端记录明确区分；空队列不等于已同步，重试必须重新确认云端状态。存储失败保留内存状态，并分别显示保存/同步失败。

## 3. 自动验收

| 检查 | 结果 |
|---|---|
| npm test | 791/791 PASS |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 error / 0 warning |
| production build | PASS |
| content:validate | PASS，0 error / 0 warning |
| content:stats | PASS，生产卷保持 Paper 001 |
| content:rights | PASS |
| content:audio-validate | PASS，0 error；仅原有允许的 synthetic fixture placeholder warning |

新增回归覆盖：8 轮真实数据库并发写入、原样请求重放、请求 ID 重用拒绝、轮次切换及旧轮次拦截、内容更新重启、必填字段、全局/私有混合队列、丢失响应后先重放再推进新快照、高频编辑、A→B→A 迟到响应、坏成功响应。

## 4. 浏览器验收

生产构建，Chrome + 两个独立 browserContext 模拟独立设备，共 **55 项 PASS**。

- 跨浏览器恢复未完成进度及结果。
- 重新练习实际写入新轮次，旧轮次被拒绝。
- 同步冲突保留本地选项；采用云端、保留本地及重新开始均通过；结果页也能处理冲突。
- 新本地答案未上传时刷新，仍保留本地；关闭标签页后从持久队列恢复。
- 实际离线作答后联网重试；模拟服务器成功但响应丢失，重试不会重复递增 revision。
- 空队列且云端读取失败时不能误报同步成功。
- 内容变化后重新开始并成功同步；删除后的旧写入为 404。
- B 读取/伪造 owner 写入 A 的进度均为 404；匿名为 401；同页 session 切换隐藏旧账号内容。
- PRIVATE 练习前后全局 xpEvents/sessions/wordbook/reviewItems/dailyPlans 不变。
- 375/390/430/768/1440px × 学习页/冲突弹窗/结果页，保存 15 张截图；无横向溢出，最后答题按钮不被底部导航覆盖；弹窗 Tab 焦点循环通过。
- 主流程及补充流程均无 pageerror。故意模拟断网/冲突时出现的网络错误为测试预期。

证据仅保留本地：output/v14e1-browser-results.json、output/v14e1-browser.log、output/v14e1-browser-supplement.log、output/v14e1-fix-tests.log、output/v14e1-fix-build.log。
截图：output/playwright/v14e1-{study,conflict,result}-{width}.png。
隔离测试用户及关联记录按精确 id/email 清理；不上传报告附件。

## 5. 限制及最终字段

- 同时打开同一卷可以产生明确冲突，需用户决定，不提供自动答案合并。
- 已提交结果按当前题目重算；不是服务端考试结算，也不发奖励。
- 已上传进度可跨设备恢复，未上传草稿只在产生它的浏览器中持久保存。
- sessionStorage 本身仍为标签页存储；持久 PRIVATE 队列补充未上传草稿恢复。删除浏览器本地数据会丢失未上传内容。
- 本阶段不缓存页面为离线应用；重新打开服务端页面需要网络连接，已打开页面可离线作答。
- 两个独立 Chrome context 与模拟手机宽度已验证；未做实体设备、其他浏览器、软键盘或屏幕阅读器验收。
- 同步状态显示于学习页；账号页全局同步计数不包含 PRIVATE。

PRIVATE_LEARNING_FLOW = LIMITED_READING_CHOICE_MVP
PRIVATE_PROGRESS = OWNER_SCOPED_CLOUD_WITH_LOCAL_QUEUE
PRIVATE_SYNC = IMPLEMENTED
PRIVATE_XP / REVIEW / DAILY_PLAN = NOT_IMPLEMENTED
PHASE_1E2_STARTED = NO

完成后停止，等待用户验收。
