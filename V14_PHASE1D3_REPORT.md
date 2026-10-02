# V14 Phase 1D.3 — 私有错题本手动复习 MVP

## 当前结论

2026-10-02：代码修复和本地验收 PASS；Git 提交/远程同步尚未执行，阶段 Git closure PENDING。不宣称 FINALIZED，不开始下一阶段。

基于当前内容版本有效的 PRIVATE 阅读选择题错题，每批最多 5 道，支持作答、导航、未答确认、只读服务端判分和刷新恢复。保持现有页面视觉结构。

## 本轮修复

### 存档与恢复

- 实际恢复路径调用完整存档校验，不再将 owner/paper 匹配的数据直接强制转换成 session。
- 校验 version、非空 batch/hash/question ID、唯一选项、完整答案集合与选项成员关系、整数位置、提交时间、结果数量/顺序/答案/统计一致性。
- 空结果、异常选项、重复选项、负数统计和损坏存档被拒绝，显示恢复警告，页面不崩溃。
- 保留 `private-review:{ownerId}:{paperId}:{contentHash}` 内容存档；增加 `private-review-latest:{ownerId}:{paperId}` 指针和 updatedAt，明确最新批次。兼容无指针旧存档的严格扫描；指针损坏时不静默回退到旧批次。
- 刷新、重新聚焦、页面恢复可见时，先调用现有 owner-scoped 错题 GET，验证当前权限、内容版本和题目。验证期间不能继续答旧题。
- 已提交结果恢复时再次执行服务端只读判分，不将浏览器保存的结果直接当作服务端确认。
- 内容更新、删除、权限失效显示明确无效状态；网络验证失败保留草稿并提供“重新检查”。

### 请求和错误状态

- AbortController、请求序号、scope、身份代次和批次检查均在存档写入前执行；scope 改变和卸载取消旧请求。
- 同步提交锁避免连续点击重复提交；提交期间禁止答题和题号导航。
- 存储写入移出 React 状态更新函数，避免重放副作用及嵌套状态更新。
- 存储失败独立提示，说明答案仍在当前页面、刷新可能丢失；不再被成功状态覆盖。
- 提交失败显示“答案已保留，结果尚未确认”，可重试；异常或跨 owner 成功响应也不得确认结果。
- 重新开始失败不先清除原存档；成功后才以新批次替换。

### 服务端和解析

- `selectReviewItems` 的 limit 必须为 1–5 整数；API 不再吞掉非法 JSON、超大请求或将非法 limit 静默夹取。
- 稳定选题顺序为 lastSeenAt desc + questionId asc；每次开始生成 UUID 批次 ID。
- 判分明确拒绝对象、数字、布尔、数组等异常答案类型及不存在的选项，不再 String() 强制转换。null/空串明确表示未作答。
- 判分响应包含 ownerId/paperId/contentHash/reviewBatchId；客户端校验当前批次、完整结果顺序、选项、用户答案、正确答案及统计。
- owner 始终从服务端 session 派生，跨 owner 为一致 NOT_FOUND。
- 批次 ID 用于请求/响应和本地竞态绑定；服务端是只读无状态判分，没有持久化批次注册表或复习记录。它会验证请求中所有题目均为该 owner 当前版本的有效错题。

### 键盘和布局

- 原生 modal dialog 隔离背景，补充 Tab/Shift+Tab 首尾循环；Escape 关闭，焦点返回提交按钮。
- 选项 aria-pressed、当前题号 aria-current；提交期间所有题号禁用。
- 按钮触控区域至少 44px；保留题号 28px 圆形外观，通过透明区域扩大触控范围。
- 对长文本增加换行和最小宽度防护；弹窗背景使用已有 surface token。

## 自动验证

私有复习专项 29/29 PASS：13 项真实 Prisma 服务测试、16 项纯解析/存档测试。不是 29 项全部为 Prisma 集成测试。

本轮新增 4 项测试覆盖异常 session/result、统计与批次校验、最新存档指针/存储访问失败、服务端异常答案及无副作用；加强原有确定性选题、UUID 唯一性和 5 道上限验证。

| Gate | 本轮结果 |
| --- | --- |
| npm test | 845/845 PASS |
| typecheck | PASS |
| lint --max-warnings 0 | PASS，0 errors / 0 warnings |
| build | PASS |
| content:validate | PASS |
| content:stats | PASS |
| content:rights | PASS |
| content:audio-validate | PASS，仅原有允许的 synthetic fixture placeholder warning |

测试日志：`output/v14d3-fix-tests.log`；生产构建日志：`output/v14d3-fix-build.log`。

## 真实浏览器验收

本地生产服务器 http://127.0.0.1:3019，真实 Chrome（Playwright CLI），完整流程 70 项 + 请求竞态/账号切换 10 项，共 80/80 PASS，页面运行异常 pageerror 为 0。

- 真实登录/隔离数据库试卷，7 道错题进入列表后通过页面开始复习，每批最多 5 道，不泄露开始批次的答案和解析。
- 刷新保留批次 ID、题目顺序、答案与当前位置；提交确认、正确/错误/未答结果、已提交刷新重新确认和不可修改。
- Tab、Shift+Tab、Escape、关闭后返回焦点。
- 断网提交保留草稿、明确未确认、成功重试；重新开始失败保留原存档。
- quota 存储失败独立警告，内存答案仍可继续；损坏已提交结果拒绝恢复而不崩溃。
- 未登录 401、跨 owner/伪造 owner 404、异常 JSON 400、非法 limit/答案 422；响应 owner 不一致失败关闭。
- 聚焦验证网络失败禁止继续旧题；内容更新聚焦失效，刷新不恢复旧批次；已删除试卷不能显示缓存批次。
- 模拟响应体已到达、忽略取消信号的迟到成功：旧开始/旧判分不能覆盖新批次，刷新仍恢复新批次。
- 同一 cookie 会话切换到另一账号并广播更新：旧页面题目隐藏、旧响应不写旧存档或新 owner 存档，切回原账号经服务端验证后恢复草稿。
- 全部复习操作前后错题次数/时间戳、原 progress/attempt 和 XP/全局学习集合一致；导入解析 HTML 为普通文本。
- 375/390/430/768/1440px 答题页、结果页无横向滚动、正文不被底部导航覆盖，主要按钮至少 44px。

证据仅保留本地：

- `output/v14d3-browser-results.json`（70 项）
- `output/v14d3-races-results.json`（10 项）
- `output/playwright/v14d3-review-{375,390,430,768,1440}.png`
- `output/playwright/v14d3-result-{375,390,430,768,1440}.png`
- `output/v14d3-fixture-cleanup.json`：两名测试用户精确核验 id/email 后删除，users/papers/progress/wrongItems/receipts 均为 0。

浏览器测试使用隔离用户与预先提交的错题数据，不代表本轮重新验收所有原始学习流程。异常网络测试会产生预期浏览器网络错误，不是未捕获页面异常。未做实体手机和其他浏览器实测。

## 边界与 Git

- 不修改原 PrivatePaperProgress、attempt、PRIVATE 队列或错题计数，不发 XP，不接入全局 Review/Daily Plan。
- 不实现移除/掌握、复习历史、调度、跨设备复习存档、上传/OCR/AI、真实词库或其他专项。
- 未修改 Paper 001、数据库 schema/migration、main 或已有 tag/Release。
- 工作分支：`feature/v14-real-content-rights`。
- 本轮修复基线 LOCAL_HEAD：`f59ee92781bc40129293b8c997a5bc47d8843db0`。
- 当前代码/文档修复留在工作区，尚未提交和推送；REMOTE_HEAD 本轮未联网核验，不填写 LOCAL == REMOTE = YES。
- 后续需要 Git 提交/远程核对才能宣布 Git closure 和 FINALIZED。本轮停止，不开始下一阶段。
