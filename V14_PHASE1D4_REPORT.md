# V14 Phase 1D.4 — 私有错题本手动移出/恢复 MVP

## 当前结论

2026-10-02：审查发现的问题已修复，本地实现及验收 PASS；Git 提交与远程同步尚待执行，不宣称 FINALIZED。

应用版本已同步为 `14.6.4`（V14 Phase 1D.4）。“关于”页面直接读取 `package.json` 的 version/appPhase，锁文件根版本同步，修复原先写死 V11 的显示；未变更题目或存储格式版本，未创建 Release。

本轮基于 `782b799ef59ee4f7a96b1b13a29b28a6d4872a49` 修复既有功能，未开始下一阶段。手动移出保留错题历史，不代表已掌握；新一轮原私有卷学习再次答错可重新激活，同一次提交重试不撤销移出。

## 修复结果

### 1. 原子并发与有限幂等

- 原实现先检查 revision、再按 id 更新，不能阻止两个并发请求同时通过。本轮管理操作使用试卷行 `FOR UPDATE`，与学习提交、内容更新及删除协调；更新同时限定 owner/paper/hash/revision，更新行数不是 1 则返回 409。
- 重复请求只在 revision 等于请求值或请求值加一、且目标状态一致时确认。旧移出请求不能覆盖后来的恢复或新学习重新激活，旧恢复请求不能覆盖下一次移出。
- 校验试卷 readiness、当前 hash、题目归属及错题状态。旧版本和无对应题目的记录不可恢复。
- 移出/恢复不修改原作答、wrongCount、attemptId、firstSeenAt、lastSeenAt、学习进度、提交回执、XP 或全局收藏。同一已接受学习 mutation 的回放保持原回执且不撤销后续移出。

### 2. 列表与数量使用同一快照

- GET 在一次受锁保护的列表读取后，从同一组 enriched items 推导 counts，消除列表与四次独立计数之间的不一致。
- 三组互斥：active 为有效且未移出；removed 为全部已移出；contentChanged 为未移出的失效历史。三者相加等于 total。
- 物理状态 active 但当前版本找不到对应题目的记录，展示为失效；已移出的失效历史保留在 removed，不重复计入 contentChanged。

### 3. 数据解析与请求边界

- 所有记录均严格校验日期、非负数据库整数 revision、正整数 wrongCount、答案、唯一 ID 及数量一致性。
- status 为 active 的记录，无论是否已移出，都校验题目、唯一选项和答案归属；失效记录不能携带新版本题目解释旧答案。损坏响应显示明确错误，避免详情崩溃。
- 移出/恢复响应绑定 owner、paper、hash、question、记录 id、目标状态及允许的 revision，并验证不应变化的历史字段。
- 两个管理接口复用有流式大小限制的 JSON 读取，实际请求超过 1MiB 返回 413，非法 JSON/非对象返回 400，非法 revision 返回 422。
- owner 从服务器 session 派生；未登录 401、跨 owner 或已删除 404，内容失效 422、版本冲突 409。

### 4. 百分号与中文题目路由

- 实测当前 Next.js 的 API params 已解码，页面 params 仍可能编码。本轮 API 不再重复 decodeURIComponent；页面入口统一只解码一次并验证合法性。
- 真实浏览器验证 `q%`、`q%25`、`q 中文`，链接与直接访问/刷新均保持原题目身份，不串题。

### 5. 管理请求与弹窗生命周期

- 列表与详情复用 scope、AbortController、请求序号、同步身份代次和同步 pending 锁保护，成功、失败和 finally 都检查当前请求。
- 关闭弹窗、切换页面或账号会使旧请求失效；迟到成功不能关闭新弹窗、清除新请求 loading 或重新显示旧 owner 内容。
- 错误直接出现在当前弹窗内；409/401/404/422 后重新读取权威状态，网络失败明确提示未确认，允许重试。
- 已移出的有效题目可进入对应版本详情。原生 dialog 提供 Tab/Shift+Tab 循环、Escape、取消后的触发按钮焦点恢复及移出后的标题焦点回退。
- 仅将本弹窗的 padding 样式限定为 `.pp-remove-dialog`，避免影响既有复习确认弹窗。管理按钮至少 44px，长文本可换行，沿用现有视觉设计。

## 数据与功能边界

- 原 D4 migration `20261002051202_add_removed_at_revision_to_private_wrong_item` 及 removedAt/revision/索引沿用，本轮没有新增 migration 或修改 schema。
- 固定复习批次中的题目被移出后，聚焦/刷新验证使批次失效；服务端判分再次检查，不允许继续旧批次。
- 只读复习仍不改错题次数或 XP；软移出不删除错题行。
- 不开发自动移出、掌握评分、复习调度、题库、上传、OCR、AI 或下一阶段功能；未修改生产 Paper 001。

## 自动验证

专项文件 `tests/v14-private-wrong-removal.test.ts`：25/25 PASS。原有 15 项基础上新增 10 项，覆盖真实 Prisma 并发、旧请求回放、学习重新激活、内容更新/删除、统计分组、损坏响应与页面路由辅助校验；不将这些测试虚称为 HTTP 端点测试，真实 HTTP 错误码由下述浏览器验收覆盖。

| Gate | 本轮结果 |
| --- | --- |
| npm test | 870/870 PASS |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 errors / 0 warnings |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS，0 errors；1 个允许的 synthetic fixture mock:// warning |

日志位于本地 `output/v14d4-fix-tests.log`、`output/v14d4-fix-build.log` 和其余六项 `output/v14d4-fix-*.log`。

## 真实浏览器验收

生产构建运行于 http://127.0.0.1:3020，Chrome 真实界面与 HTTP 验证合计 103 项 PASS：

- 主流程 84 项：A/B/未登录、跨 owner、400/413/422/409、百分号与中文 ID、列表与详情移出/恢复、刷新及独立 context、已移出详情、XSS 纯文本显示、网络失败重试、损坏数据拒绝、复习批次失效、新学习重新激活和无全局副作用。
- 异常及竞争 19 项：迟到成功不覆盖新弹窗、新 pending 锁、账号切换旧响应隔离、离开页面后旧响应失效、已提交但响应丢失后的幂等重试、内容更新及删除后的历史失效和权限检查。
- 375/390/430/768/1440px 列表、详情与弹窗均检查无横向溢出、触控区域及滚动后的最后操作不被导航遮挡；测试没有捕获 pageerror。
- 结果：`output/v14d4-fix-browser-results.json`（84）与 `output/v14d4-fix-races-results.json`（19）。故意制造断网等场景产生的网络错误不等同于页面崩溃。
- 截图：`output/playwright/v14d4-{list,detail,remove}-{width}.png` 共 15 张，另有失效历史截图；`v14d4-mobile-390.png` 为实际手机视口预览。全页截图中的固定导航按截取时的视口位置显示，正文可滚动到导航上方。

两个隔离测试用户按精确 id/email 校验后清理；用户、试卷、进度、错题、回执剩余均为 0，证据见 `output/v14d4-fix-cleanup.json`。临时凭据文件已删除，浏览器日志中的测试密码已替换。所有截图和日志仅保留本地，不作为公开附件上传。

## 本地预览

- 实际地址：http://127.0.0.1:3020（需登录并使用自己的私有卷；验收测试卷已清理）。
- 当前生产预览已确认可访问；重新启动：`npm run build` 后 `npm run start -- --port 3020`。
- 私有内容依赖已有本地数据库及配置；截图使用临时合成题目，不是真实题库。

## Git 与已知限制

- 分支：`feature/v14-real-content-rights`。
- 本轮基线及当前 HEAD：`782b799ef59ee4f7a96b1b13a29b28a6d4872a49`；本轮修复和报告尚未提交，worktree 有本地修改。
- 未推送本轮修复；没有重新 fetch 或核对最新远程 HEAD，不宣称 LOCAL == REMOTE。未 merge main、移动 tag 或创建 Release。
- 本地验收通过，Git closure 待后续执行；不得以本报告宣称阶段已经 FINALIZED。
- 只实测 Chrome 的模拟宽度，未实测实体手机或其他浏览器；当前不增加新阶段能力。
