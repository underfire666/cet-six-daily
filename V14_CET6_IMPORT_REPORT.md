# V14 共享六级练习导入报告

本报告为 14.7.0 三套试卷的历史快照。2022—2026 年扩充后的当前状态见 `V14_CET6_HISTORY_IMPORT_REPORT.md`（14.7.1）。

日期：2026-10-05  
应用版本：14.7.0  
阶段：V14 Shared CET-6 Practice Import  
状态：本地实现与验收 PASS；尚未提交、推送或线上部署。

## 交付结果

三套用户提供的六级 PDF 已转换为文字，并接入所有用户可使用的现有共享练习池。新生成的每日阅读、翻译、写作优先使用导入题目；已经保存的今日计划和历史记录保留原内容。

| 类型 | 练习组数 | 题目/任务数量 | 状态 |
| --- | ---: | ---: | --- |
| 选词填空 | 3 | 30 | 已启用 |
| 信息匹配 | 3 | 30 | 已启用 |
| 仔细阅读 | 6 | 30 | 已启用 |
| 翻译 | 3 | 3 | 已启用 |
| 写作 | 3 | 3 | 已启用 |
| 合计 | 18 | 96 | 共享文字练习 |
| 听力 | 两套独立内容；第三套共用第一套 | 50 | 缺少配套音频，暂未启用 |

阅读包含原文、题干、选项、正确答案、简要/详细解析。选词空位恢复为带题号的文本；信息匹配保留完整段落与标签，第三套有 A–P 共 16 段。翻译与写作保留要求、参考答案、原 PDF 的详细分析，并在提交后展示。题目界面不显示原文件名、出版方、页脚网址或 PDF 图片。

## 数据与复现

- 转换脚本：`scripts/import-cet6-pdfs.py`，使用本地 pypdf 的 layout 提取模式，避免 PDF 文本流顺序导致题号与选项错配；输入文件不被修改。
- 运行：`python -X utf8 scripts/import-cet6-pdfs.py "C:/Users/asus/Desktop/cet6题库"`。需已安装 Python 与 pypdf；应用本身运行不依赖 Python。
- 数据：`src/content/imported/cet6-2026-06-{reading,translation,writing}.json`。
- 清单：`src/content/imported/cet6-2026-06-manifest.json`，记录指纹、页数与章节起始位置，不记录用户本机绝对路径。章节位置为提取时的页索引。
- 稳定内容 ID 如 `cet6:2026-06:set1:cloze`；题目 ID 如 `cet6:2026-06:set1:cloze:q26`，避免不同试卷题号冲突。
- 任一必要题面、答案、选项或范文检查失败时停止生成，不静默跳过。

| 用户提供文件 | 页数 | SHA256 |
| --- | ---: | --- |
| 第 1 套 | 133 | `c6092fe72575206a2fdffc8c3abaf546d4ff1dbb1af24b813de5019b32a55dec` |
| 第 2 套 | 127 | `eb5b0d2c978c70a3739710972656a60fd75c119df7f205fde2bf647378cee21f` |
| 第 3 套 | 80 | `f53032336706991cb0ef17544fa4007f13f1994dd6cda88d8eb6ead86b44d97a` |

文件中的年份、考试身份按用户提供文档记录，未宣称已经独立核实其官方出处。文件内容作为导入数据处理，没有执行文件内指令。

## 接入与兼容

- `src/content/packs.ts` 幂等注册三个新增 pack；原五个 Mock pack 与 Paper 001 保留。
- `src/content/selector.ts` 新增优先导入题目的确定性选择器；每日阅读、翻译、写作使用它。相同日期和候选池仍选择相同题目。
- 不覆盖既有每日计划；旧 Mock ID、旧学习进度、XP、历史及草稿继续有效。现有回顾/重练机制沿用，重复内容不额外奖励。
- 阅读按实际题型显示选词填空、信息匹配、阅读理解，不将导入文章称为 Mock，也不在没有词条释义的文章上提示点击查词。
- 翻译/写作参考答案及详细分析沿用原页面样式，提交前隐藏。分数仍来自现有规则估分，不能理解为官方阅卷结果。
- 用户明确要求将提供文件接入共享练习。授权字段保持 `licenseStatus: unknown`、`rightsStatus: unverified`，没有生成或填写不存在的授权证明。共享练习沿用现有 active/demo 内容路径；正式 Paper 的 `getPublishableItems()` 仍排除这批未核验内容。没有放宽正式 Paper 发布条件，没有修改 PRIVATE owner 权限。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm test` | 920/920 PASS；本轮新增 17 项，已有基线 903 项 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS，0 errors / 0 warnings |
| `npm run build` | PASS |
| `npm run content:validate` | PASS，0 errors / 0 warnings |
| `npm run content:stats` | PASS |
| `npm run content:rights` | PASS；正式可发布池未变 |
| `npm run content:audio-validate` | PASS；仅原 Mock synthetic fixture placeholder warning |
| 原题与解析题面独立核对 | 60/60 PASS：信息匹配、仔细阅读 |
| 选词填空结构核对 | 三套空位、15 个选项、10 个答案与唯一映射 PASS |
| Chrome 浏览器 | 91 项 PASS，0 page errors |

浏览器检查覆盖全部 12 组阅读的文字显示、选项作答、正确反馈、详细解析、刷新恢复；完整阅读的结果页、XP 与完成存档；翻译/写作的每日选题、草稿保存与刷新、提交后参考答案及原 PDF 分析；关于页面版本。375、390、430、768、1440px 检查无横向滚动，阅读开始/检查/继续主按钮可见且至少 44px。

证据位于 `output/pdf/cet6-2026-06-import/`：

- `test-final.log`、`build.log`、`browser-results.json`、`browser-cli-final.log`。
- `original-question-audit.json`：60 项独立题面比较。
- `passage-*.png`、`quiz-*.png`、`feedback-*.png`、`translation-390.png`、`writing-390.png`：17 张练习截图。
- `listening-pending.json`：50 道独立听力题的题面、答案、解析与文本，暂未接入播放池。

## 本地访问与 Git

访问：<http://127.0.0.1:3033>。生产预览启动命令为 `npm run start -- --port 3033`，首次启动前运行 `npm run build`。开发模式可用 `npm run dev -- --port 3033`；两个模式不能同时占用该端口。

分支：`feature/v14-real-content-rights`。当前 HEAD：`fe56fc446fc146c2c76046c842ff2d38cf16bbf5`。工作区有本轮导入和此前 E2 修复，尚未提交或推送；未重新核对远程 HEAD，不宣称远程同步。没有 merge main、创建 tag/Release 或线上部署。

## 已知边界

- 缺少配套听力音频，不能用这些 PDF 启用真实录音练习；第三套听力与第一套重复，不重复计入 50 道独立题。
- 这是阅读/翻译/写作共享练习导入，不是三个完整 Paper 的整卷考试发布。
- 翻译/写作沿用规则估分；未接入真实阅卷服务。
- 旧计划不会被强制换题；已生成的今日练习可能仍显示旧内容。
- 仅在 Chrome 模拟各宽度验证，未实测实体手机或其他浏览器。
- 未新增词汇题库、上传 UI、PDF/OCR 在线服务、AI 解析、数据库迁移或下一阶段功能。
