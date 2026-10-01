# V14 Phase 1C.1 — Private Paper Management + JSON Import UI

日期：2026-10-01。工作分支：`feature/v14-real-content-rights`。
实现基线：`05d6809bc81f70fbc0a01a32718d06f596691cd3`；存储修补基线：`b58c17c63ef5f6b0c9f7c0606dbc4e3b3f6a4dee`。

## 已实现

- `/me/private-papers`：本人私有卷列表、空状态、导入入口。
- `/me/private-papers/import`：粘贴 JSON 或选择本地 .json 文件，共用解析/校验/预览/提交逻辑。
- `/me/private-papers/[paperId]`：内容概览、元信息、修改标题、取消/确认删除。
- `/me`：我的私有卷入口。保持现有视觉布局与导航。
- 三个页面使用 Server Component 调用真实 auth()，未登录重定向；交互拆为 ListClient/ImportClient/DetailClient。API 仍逐次执行服务端 session owner 授权。

## 收尾修补

1. **ID 边界**：实际浏览器验证发现，此 Next.js 版本页面参数可能保留整段编码。privatePaperIdFromRoute() 仅在开头为编码后的 private: namespace 时解码一次；已经以 private: 开头的 ID 原样保留。服务端将结果传给 DetailClient，客户端构造 URL 时 encodeURIComponent 一次。% / %25 / %25% / 字面 %3A / 中文空格 ID 的导入、列表跳转、刷新均通过；非法参数由页面返回 notFound，不抛出未处理 URIError。
2. **客户端校验**：复用纯 validatePrivateDraft()，不复制服务端结构规则；非法 sections/schema、标题冲突、JSON 非对象等在发送前反馈，服务端继续最终校验。
3. **大小限制**：完整请求只序列化一次，用 TextEncoder 计算 UTF-8 字节数后发送同一个字符串；超过 1,048,576 字节拒绝。文件读取前检查 file.size，未把“文件内容小于 1MiB”等同于“完整请求小于 1MiB”。
4. **权利确认及重复提交**：checkbox 默认不勾选，未确认/文件读取中/提交中按钮禁用；同步 ref 阻止重复请求，成功后保持禁用至页面跳转。statementVersion=1.0 留在数据中，确认时间仍由服务端记录。
5. **输入保留**：请求失败、超限文件或文件读取失败保留已有输入；新文件读取会取消旧任务，防止结果乱序覆盖；切回粘贴模式时取消待完成读取。
6. **登录返回**：登录页实际忽略 callbackUrl 的问题已修复，只接受站内相对地址，外部/反斜杠/控制字符地址回退 /me。详情页回跳保留特殊 ID，不再重复编码。
7. **账号变化**：列表/详情重新按当前 session.user.id 请求，加载完成前隐藏上一账号的数据，过期请求不更新状态。
8. **准确说明**：删除文案仅说明此私有卷内容被移除，不宣称删除尚未接入的学习记录；预览题目计数包含 questionRefs，旧数字 schemaVersion=1 显示兼容格式。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| npm test | 674/674 PASS（本次新增 7 项） |
| npm run typecheck | PASS |
| npm run lint -- --max-warnings 0 | PASS，0 error / 0 warning |
| npm run build | PASS |
| npm run content:validate | PASS，0 error / 0 warning |
| npm run content:stats | PASS |
| npm run content:rights | PASS |
| npm run content:audio-validate | PASS，保留原有 1 项 synthetic fixture placeholder warning |
| 真实生产 HTTP 回归 | 44/44 PASS |
| Chrome 浏览器核心流程 | 12/12 PASS |
| Chrome 特殊 ID / 隔离 / 响应式 | 52/52 PASS |

浏览器使用 Playwright CLI、生产构建 `http://127.0.0.1:3015`、两个随机 @example.invalid 隔离用户。覆盖真实 Credentials 登录与返回、未确认禁用、粘贴错误 JSON/错误结构、中文 UTF-8 超限、网络失败保留输入、文件超限/错误 JSON/带题文件导入、标题刷新、删除取消/确认、特殊 ID 跳转/刷新、重复 localPaperId、双账号详情不可访问及列表隔离、三个页面未登录重定向。

375/390/430/768/1440px 共 15 组页面检查，均无横向溢出、末尾按钮/卡片被固定导航遮挡。正常流程无 browser pageerror；主动注入网络失败和跨 owner 404 会产生预期的网络错误日志，未将其冒充零错误。截图人工查看了 390px 导入页与 1440px 详情页。

### 本地证据

- `output/v14c1-closure-tests.log`
- `output/v14c1-closure-build.log`
- `output/v14c1-closure-http.log`
- `output/v14c1-browser-results.json`：两组浏览器结构化结果
- `output/playwright/v14c1-closure/`：list/import/detail × 五种宽度，共 15 张最终截图
- `output/v14c1-git-closure.md`：最终提交、远程、工作区、历史 tags 实测

测试仅创建随机隔离用户并按确切 ID/email 清理，无 database reset，无生产账号数据删除。截图和 Git closure 留在本地，不作为 Release 附件外发。

## 能力与边界

PRIVATE_STORAGE_IMPLEMENTED=YES
PRIVATE_MANAGEMENT_UI_IMPLEMENTED=YES
PRIVATE_JSON_IMPORT_UI_IMPLEMENTED=YES
SERVER_OWNER_AUTHORIZATION=IMPLEMENTED_FOR_PAGES_AND_CRUD
PRIVATE_LEARNING_FLOW_IMPLEMENTED=NO
PRIVATE_SYNC_IMPLEMENTED=NO

本阶段文件选择仅在浏览器读取 JSON 后调用现有 CRUD API，不上传/保存文件原件。不实现 PDF/图片/音频上传、OCR/AI、答题、XP、Review、Daily Plan、专用同步、分享、公开发布；不新增 Prisma migration，不修改 Paper 001 正文/答案/音频/lifecycle/contentVersion。

未在真机验证软键盘与物理 safe-area；桌面 Chrome 的响应式 viewport 检查不等同于真机测试。

## Git 与阶段关闭

完成修补及验收后普通提交并 push 当前 feature 分支。最终完整 SHA 及 LOCAL==REMOTE、WORKTREE=CLEAN、main/历史 tag 未变的结果记录在本地 Git closure，避免 tracked 文档引用自身 commit SHA。

禁止 merge main、移动 tag、创建 Release、force push。Phase 1C.1 实施与验收 PASS；完成 Git closure 后 FINALIZED，停止等待验收，不开始 Phase 1D/1E。
