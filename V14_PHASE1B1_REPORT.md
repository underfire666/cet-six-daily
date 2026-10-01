# V14 Phase 1B.1 — Private Storage Hardening（v14.3.2）

日期：2026-10-01。分支：`feature/v14-real-content-rights`。
基线：`6c3349c199950fef68c027e63881870c9f57045c`。

## 修补内容

- 新增独立 PRIVATE 草稿运行时校验：schemaVersion、sections/groups/questions 数组与字段、重复 ID、题目选项及答案关联、answerKey 冲突、解析、资源及资源引用、questionRefs 的字段与重复引用。不会使用公开卷的 namespace 或 57 题完整性规则。
- 支持 `schemaVersion="1.0.0"` 及旧数字 `1`。允许空 sections 或未填题目的存储草稿；不代表该草稿可用于学习。questionRefs 仅校验结构，引用内容是否实际可用留待学习流程接入，当前不读取公开 registry 来解析引用。
- 权利确认必须 `acknowledged=true`、`statementVersion="1.0"`；确认时间由服务器记录，客户端时间被忽略。普通更新保留原确认与 importedAt；重新确认通过顶层 rightsAcknowledgement 明确提交。
- POST/PUT 限制实际请求体为 1 MiB（1,048,576 UTF-8 字节），在 JSON 解析前逐块计数。覆盖无 Content-Length、伪造较小长度及 chunked；413 响应关闭连接，避免未读完上传污染后续请求。无效 JSON / 非对象返回 400。
- 移除路由二次 decodeURIComponent；Next.js 解码后的参数直接交给存储层。`%`、`%25`、中文、空格 ID 经真实 HTTP CRUD 验证。
- 标题统一：顶层 title 或 content.title 均能更新数据库和内容标题；同时提供不同标题时拒绝。空白、非字符串、超过 200 字符均拒绝。content/updates/确认必须是对象，不能是数组。
- 新 ID 的 owner namespace 为带固定域分隔符的完整 SHA-256 内部 userId 摘要（64 位十六进制），不截断、不使用 email，不依赖进程随机值。该不透明标识不是授权凭证，所有数据库访问仍按 session.user.id 限定。
- 全部数据库操作统一异常处理；Prisma P2002 → 409，P2025 → 404，其他数据库异常 → 500。未知记录与跨 owner 一致 404，未登录 401。

## 旧记录兼容

无数据库迁移、无批量重写、无数据清空。

旧 `private:<rawUserId>:<localId>` 仍按原 ID 读取、更新、删除，ownerNamespace 保留；新建时同时检查旧/新格式 ID，避免同一 localId 重复。旧 ID 曾包含内部 userId 的事实不会被偷偷改写；如需去除历史披露，须另行设计显式迁移。本阶段不进行该迁移。

已识别的旧 sections 对象（writing/listening/reading/translation → groups 数组），在未显式传入 sections 的更新中转成规范 section 数组。无法识别或内部结构非法的旧内容仍能读取和删除，但更新时需要提交合法修正内容。

## 验证

| 检查 | 结果 |
| --- | --- |
| npm test | 634/634 PASS（原 603 + 新增 31） |
| npm run typecheck | PASS |
| npm run lint -- --max-warnings 0 | PASS，0 error / 0 warning |
| npm run build | PASS |
| npm run content:validate | PASS，0 error / 0 warning |
| npm run content:stats | PASS |
| npm run content:rights | PASS |
| npm run content:audio-validate | PASS，1 项原有 synthetic fixture placeholder warning |
| 真实生产 HTTP 验收 | 44/44 PASS |

新增 25 项结构/字节限额/HTTP 边界单测、6 项存储回归（使用随机用户的真实 PostgreSQL CRUD，并包含异常注入）。真实 HTTP 脚本 `tests/integration/v14-private-paper-http.ts` 通过 Credentials 登录两个隔离用户，再调用实际 API 验证 5 个端点的 401、跨 owner 404、特殊 ID CRUD、伪造 owner 被覆盖、400/422、POST/PUT 普通及 chunked 超限 413。

数据库为 localhost PostgreSQL，所有测试只创建随机 `@example.invalid` 用户，finally 按确切用户 ID 清理，未 reset/migrate/reset 现有数据。HTTP 脚本仅允许 localhost/127.0.0.1 地址。

本地复跑：先 `npm run build`，再 `npm run start -- --port 3015`，另一个终端运行 `npm exec -- tsx tests/integration/v14-private-paper-http.ts`。全量门禁日志保存在忽略目录 `output/v14-phase1b1-*.log`。

## 实际能力与边界

PRIVATE_STORAGE_IMPLEMENTED=YES；SERVER_OWNER_AUTHORIZATION=IMPLEMENTED_FOR_CRUD。
PRIVATE_SYNC_IMPLEMENTED=NO；PRIVATE_LEARNING_FLOW_IMPLEMENTED=NO。

未开始 Phase 1C，未实现上传 UI/PDF/OCR/AI/Review/Daily Plan/sync/分享；未修改 Paper 001 正文、答案、音频、生命周期、contentVersion；未 merge main/tag/Release/force push。

## Git closure

完成代码与文档后普通提交并 push 当前 feature 分支。最终 LOCAL_HEAD / REMOTE_HEAD / equality / worktree / 历史 tags 实测值写入本地 `output/v14-phase1b1-git-closure.md`，避免在 tracked 文档中引用自身 commit SHA。此报告不作为 Release 附件外发。

V14 Phase 1B.1 实施与验收 PASS；停止，等待用户检查，不开始 Phase 1C。
