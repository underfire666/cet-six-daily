# V13 Phase 2D Report — Listening Audio Production Pipeline

- **阶段**: V13 PHASE 2D
- **日期**: 2026-09-28（Asia/Shanghai）
- **分支**: `feature/v13-real-content`
- **PHASE2D_BEFORE_HEAD**: `2b117d0ebc5b6525cfa130361402c1dc7712bdf6`（= Phase 2C.1 FINAL HEAD，Local == Remote）
- **Paper 001**: `cet6:mock:paper-001`（status=staging / authenticity=original / examSpecId=`cet6-current-2026`）
- **v12.0 tag**: `697772d9412d9d1a4253e099a001734a5230e264`（未改动）

---

## 1. Provider Terms Verification（§3）

完整矩阵见 `V13_TTS_PROVIDER_RIGHTS_MATRIX.md`（4 家 provider × 10 项核对，全部基于官方 Terms / 官方文档）。

| Provider | 判定 | 实际调用 |
| --- | --- | --- |
| 火山引擎 · 豆包语音 TTS（Doubao Voice） | **PRODUCTION_CANDIDATE（本轮实际使用）** | ✅（豆包 text_to_audio_plus 通道） |
| AWS Polly | PRODUCTION_CANDIDATE（候补） | ❌ 无 AWS 凭证 |
| Azure Speech | PRODUCTION_CANDIDATE（候补，付费 tier 前提） | ❌ 无 Azure 凭证 |
| Google Cloud TTS | PRODUCTION_CANDIDATE（候补） | ❌ 无 GCP 凭证 |

- TTS_PROVIDER: 火山引擎 · 豆包语音 TTS（Doubao Voice）
- TTS_SERVICE: 豆包 text_to_audio_plus 通道
- VOICE(S): prebuilt neural voices — long conversation: female student + male professor（自然美音）；passage: female narrator；lecture: male lecturer。未使用复刻/自定义音色，未克隆任何现实人物。
- TERMS_CHECKED_DATE: 2026-09-28
- OFFICIAL_TERMS_URLS:
  - https://docs.volcengine.com/docs/6561/1533787（《生成式模型服务专用条款》，2026-08-20 版）
  - https://www.volcengine.com/docs/6561/1136414（声音复刻协议 — 本阶段未使用复刻）
  - https://www.volcengine.com/docs/82379/2525200（版权和人像素材使用规则）
- COMMERCIAL_USE_VERIFIED: **YES**（专用条款 3.3/3.5：以产品开发/构建/部署为目的）
- REDISTRIBUTION_VERIFIED: **PARTIAL** — 产品内学习播放（打包进自有产品部署）允许；音频文件本体再许可/转售不授予（条款 3.3/3.9(9)）
- ATTRIBUTION_REQUIRED: 无显式署名要求；但按中国《互联网信息服务深度合成管理规定》等法规，对外发布前需显著标识 AI 合成语音（本阶段仅 staging 资产，未发布）
- 三家云厂商条款判定均基于官方页面（AWS FAQ/产品页、Microsoft Product Terms、Google Quotas & limits），无凭证故未实际调用，列为候补。

## 2. Input Script Rights（§4）

- SCRIPT_SOURCE = **self-authored**（Paper 001 自研 Listening transcript，4 组：long_conversation g1 / passage g2 / lecture g3 / lecture g4）
- SCRIPT_RIGHTS = **owned**
- 未使用真实 CET6 transcript、第三方 transcript、新闻朗读、教材原文或真实材料改写。

## 3. Audio Production（§6–§12）

- 生成方式：自研 transcript → 豆包语音 TTS（分段生成、统一拼接转码）→ MP3（`public/audio/papers/`）。**transcript 文字未改动**（未为 TTS 顺口修改）；contentVersion 保持 1.0.1，audio 与 transcript 版本一致（无漂移）。
- Speaker 设计：long conversation 双 speaker（学生女声 + 教授男声，明显区分）；passage 单 speaker（女 narrator）；lecture 单 speaker（男 lecturer）。未做名人模仿/voice clone。
- 格式：MP3（audio/mpeg），避免超大 WAV。
- 资产与元数据（**从实际文件计算，未伪造**）：

| assetId | source | duration(s) | sizeBytes | checksum (sha256, 前 16) |
| --- | --- | --- | --- | --- |
| `cet6:mock:paper-001:listening:long_conversation:g1:audio1` | /audio/papers/p001-long-conversation-g1.mp3 | 128.9 | 2063090 | adb63cefb7041d54… |
| `cet6:mock:paper-001:listening:passage:g2:audio1` | /audio/papers/p001-passage-g2.mp3 | 111.2 | 1779714 | c6e38c85052e0d50… |
| `cet6:mock:paper-001:listening:lecture:g3:audio1` | /audio/papers/p001-lecture-g3.mp3 | 108.9 | 1743351 | 91e38671e352ac36… |

- 每个 asset 独立记录 rights（generated audio rights ≠ paper rights，不因 Paper rights=owned 自动等同）：licenseStatus=owned / rightsHolder=CET-6 Daily Project / notes 含 Phase 2D 生成与条款依据。
- assetId 保持既有 stable ID（placeholder → real 替换，语义仍是同一 listening asset，未引入随机 UUID）。
- placeholder `mock://…` 已全部替换为真实文件路径（Paper 001 无残留）。

## 4. Audio Integrity Validation（§13 / §19）

新增 `scripts/content-audio-validate.ts`（package.json 注册 `content:audio-validate`），确定性检查（不做 OCR/语音识别）：
- placeholder 残留（非 fixture paper 必须 0）✅
- 文件存在、size > 0、sizeBytes 与文件一致 ✅
- checksum 从实际文件计算并与元数据一致 ✅
- duration > 最小阈值 ✅
- mimeType/format/provenance（sizeBytes/contentVersion/generatedAt/provider/voice/termsCheckedDate）完整 ✅
- rights metadata 完整 ✅
- assetId 唯一（paper 内 + 全库）、group assetIds 引用可解析 ✅

结果：**Errors: 0**；Warnings: 1（synthetic TEST FIXTURE 的合法 `mock://` placeholder，允许）。

## 5. Manual Audio QA（§14）与浏览器验证（§20）

- **程序化音频 QA（真实执行）**：3 个音频全部可解码并完整播放（浏览器触发自然 `ended`，无截断/无损坏）；`loadedmetadata` duration 与元数据精确一致（128.88 / 111.16 / 108.90 s）；播放流畅无 error 事件。
- **MANUAL_AUDIO_QA_COMPLETE: PARTIAL** — 程序化 QA 全部 PASS；**人工听感确认（§14 列表：无静音/无重复句/无漏句/speaker 切换/数字读法/专有名词/音量一致/无 TTS glitch/语速）由最终验收用户试听确认，AI 无法替代人耳，未伪造 PASS**。
- **BROWSER_AUDIO_SMOKE: PASS**（真实浏览器 `http://localhost:3000/_qa-audio.html`）：
  - play ✅ / pause ✅ / resume ✅ / 0.8x ✅（播放位置保持）/ 1.0x ✅ / 自然 ended ✅ / replay（从头）✅ / 加载失败处理（AudioPlayer 超时重试逻辑，未触发）✅
  - network：3 个音频请求全部 200，无 404（重载后 BAD_COUNT=0）；console 无运行时 error
  - MIME：audio/mpeg 正确解码
- V6 播放器兼容（§16）：Paper 001 音频复用现有 `AudioPlayer.tsx`（play/pause/replay/rate/ended/10s 超时重试），未创建第二套 player。

## 6. Paper Status（§17）

- PAPER_STATUS: **staging**
- PRODUCTION_POOL_CONTAINS_PAPER001: **NO**（content:rights 验证 production pool 为空）
- 未 active / 未 published / 未开始 Phase 2E

## 7. Tests（§18）

`tests/v13-content.test.ts` 更新 + 新增 4 项（Phase 2C.1 基线 447 → 451）：
- 3 个真实音频资产，无 mock:// placeholder 残留
- 音频文件存在且 size>0（从实际文件检查），sizeBytes 与实际一致
- checksum（≥64 hex）/duration>30/mimeType/provenance/rights 元数据完整
- transcript/contentVersion 与 audio version 一致（无漂移）；group 引用 3 个音频全部可解析

## 8. Gates（§19，全部 PASS）

| Gate | 结果 |
| --- | --- |
| `npm test` | **451/451 PASS** |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（0 errors） |
| `npm run build` | PASS（6/6 静态页） |
| `npm run content:validate` | PASS（0 errors / 0 warnings；Paper 001 仍 staging） |
| `npm run content:stats` | PASS |
| `npm run content:rights` | PASS（production pool 空） |
| `npm run content:audio-validate` | PASS（Errors 0） |

## 9. Compliance（§21）

- REAL_CET6_AUDIO_USED: **NO**
- REAL_CET6_TRANSCRIPT_USED: **NO**
- THIRD_PARTY_AUDIO_USED: **NO**
- VOICE_CLONE_USED: **NO**
- 所有音频由项目原创 script（owned）生成；API key / secret 未提交、未写入报告（生成经豆包通道，无本地密钥）。

## 10. Known Limitations

1. 豆包语音许可限中国大陆地区使用；海外部署需重新评估。
2. 对外发布前需按深度合成法规完成 AI 合成语音显著标识（当前 staging 未发布）。
3. 音频文件本体不可再许可/转售（产品内学习播放不受影响）。
4. AWS / Azure / GCP 未被实际调用（无凭证），条款判定基于官方页面，正式切换前需复核最新版本。
5. 人工听感确认待最终验收用户试听（程序化 QA 已全 PASS）。

## 11. Git（§23）

- 提交建议：`feat: add V13 mock paper 001 listening audio`（code）+ `docs: document V13 listening audio production`（docs，含本报告与 TTS 矩阵）
- 已确认无 API key / .env / secret / 真实 CET6 音频 / 第三方 audio / 临时下载文件（notes/ 中间产物已删除）
- 禁止 force push；最终 Local HEAD == Remote HEAD、worktree clean、v12.0 不变。

---

**V13 PHASE 2D COMPLETE**（待独立验收；未开始 Phase 2E / V14；Paper 001 保持 staging）
