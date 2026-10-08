# V14.8.0 六级真题听力接入报告

日期：2026-10-06。状态：本地实施与验收 PASS。未进行 Git 发布。

## 本轮范围

按用户选择补齐 2022–2026 年已导入试卷的原录音，并接入现有每日和额外听力练习。使用本地文件播放，不生成替代朗读，不依赖练习时访问第三方网站。

## 内容与实现

- 19 份不同的完整录音，拆成 133 个篇章，475 道选择题；33 套试卷通过原卷中的共用声明映射，不重复导入共用听力。2024 年 6 月、12 月及 2025 年 6 月的第三套引用第二套。
- 篇章起止时间与题号范围来自原页面播放器数据；题干、选项、答案、英文原文及中文解析来自已有 PDF。475 道题的四个选项另与 PDF 的原始试卷页对照。
- `scripts/import-cet6-listening.py` 负责公开 HLS 下载、分段转换、解码检查及生成数据。只支持公开、未加密录音；下载缓存与临时转换工具留在忽略的 `output/` 中。转换工具不加入应用依赖。
- `public/audio/cet6/` 保存 MP3；`src/content/imported/cet6-2022-2026-listening.json` 注册内容；`cet6-listening-manifest.json` 记录实际文件的 SHA-256、大小、时长、原录音指纹、原地址、分段范围及试卷共用关系。
- 新生成的每日与额外听力优先真题；已有每日计划及 Mock 会话保留原 ID，可继续。答题、解析、错误复测、XP 和本地刷新恢复沿用现有流程。
- 原生播放中直接设置 `playbackRate`，不重置 `currentTime`；暂停时变速不会自动播放。倍速按钮提供 `aria-pressed` 和至少 44px 点击区域。听力题标签、真实题型名称和没有词典条目时的提示已修正。

## 数据边界

- 内部来源记录和 unknown/unverified 权利状态保留，不声称已获得许可。题目页面不显示 PDF 文件名、来源站点或出版社。
- `getPublishableItems()` 的正式 production Paper guard 未改变，Paper 001、词汇、PRIVATE 存储/同步及用户实际学习数据未改动。
- 旧阅读导入 manifest 的 `listeningEnabled: false` / `pendingListeningQuestions` 是当时的快照；当前听力状态以新的 `cet6-listening-manifest.json` 为准。旧导入报告保留为历史。
- 本轮不包含整卷计时考试或按年份浏览的新界面。未推送 GitHub、合并 main、打 tag、创建 Release 或部署线上。

## 验证

- 1220/1220 tests PASS（本轮增加 136 项）；typecheck PASS；lint 0/0；生产 build PASS；content:validate / stats / rights / audio-validate 全部 PASS。音频 validator 覆盖 133 个导入资源，只有旧 synthetic fixture 的允许 placeholder warning。
- 475/475 原卷选项独立核对；19 份原录音指纹及 3043 个 MPEG-TS 片段同步检查 PASS；133 个 MP3 完整解码、SHA-256/大小以及 HTTP Range 206、audio/mpeg、ID3 header 检查 PASS。音频总大小 212,109,419 字节（约 202.3 MiB）。
- Chrome 浏览器 727 项检查 PASS：全部 133 组的真实播放/原文/首题判分/详细解析；播放中 0.8× 不重置位置；暂停时切换速度；恢复不重复计次；主动重播/播完再播；刷新保留倍速/次数/答案/结算；答错重试及复测；人为音频失败的明确提示与成功重试；正常每日 3/3 后进入额外新真题并累计额外数量；关于页显示 14.8.0。
- 375/390/430/768/1440px 的播放页、答题页及展开解析无横向滚动，答题/继续按钮可见且高度至少 44px，练习中主导航不遮挡内容。零未预期页面或控制台错误；阻断音频测试产生的 1 条预期 ERR_FAILED 已单独记录。
- 日志及 JSON 证据：output/audio/cet6-listening-import/。截图：output/playwright/cet-listening-*.png、cet-listening-feedback-*.png。
- 生产预览服务已实际启动并验证，地址 http://127.0.0.1:3033；页面可直接访问 /practice/listening。测试使用独立 Chrome guest profile，结束后清理测试浏览器的本地存档，不修改用户日常浏览器的数据。

音频与原文的对应依据是原页面的分段映射与原卷核对；没有对全部录音逐字进行人工听写或语音识别。响应式检查使用桌面 Chrome 模拟尺寸，未在实体手机或其他浏览器逐项实测。
