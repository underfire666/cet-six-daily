# V13 Phase 2D.1 — Paper 001 Listening 官方结构重组 + 7 音频 + Rights 硬化

**日期**: 2026-09-28
**分支**: `feature/v13-real-content`
**Paper 001**: `cet6:mock:paper-001`（contentVersion 1.0.1 → 1.1.0）

---

## 1. 核心变更

独立验收发现 Paper 001 虽满足 Listening 25 questions，但未完整满足官方 CET6 Listening 的 material/group 结构。Phase 2D 为 4 transcript groups / 3 audio，官方要求 2 long-conversation + 2 passage + 3 talk/report/lecture = **7 materials / 7 audio assets**。

### Listening 新结构（7 materials / 7 audio）

| # | Type | Group | Questions | Audio File | Duration |
|---|------|-------|-----------|------------|----------|
| 1 | long_conversation | g1 | 4 | p001-long-conversation-g1.mp3 | 155.8s |
| 2 | long_conversation | g2 | 4 | p001-long-conversation-g2.mp3 | 142.6s |
| 3 | passage | g1 | 4 | p001-passage-g1.mp3 | 88.9s |
| 4 | passage | g2 | 3 | p001-passage-g2.mp3 | 85.1s |
| 5 | lecture | g1 | 4 | p001-lecture-g1.mp3 | 149.2s |
| 6 | lecture | g2 | 3 | p001-lecture-g2.mp3 | 127.7s |
| 7 | lecture | g3 | 3 | p001-lecture-g3.mp3 | 113.0s |
| **合计** | | **7** | **25** | **7 assets** | **862.3s** |

- 长对话：2 篇 × 4 题 = 8
- 篇章：2 篇（3+4）= 7
- 讲话/报道/讲座：3 篇（4+3+3）= 10

### 新增 transcript（self-authored）

- long_conversation g2：campus housing（女学生 Lin + 男协调员 David，英音）
- lecture g3：microplastics in freshwater（女 lecturer 美音）
- 现有 transcript 拆分/扩展为独立 material

---

## 2. 技术实现

### 音频生成

- TTS Provider：火山引擎·豆包语音 TTS（经 `text_to_audio_plus`）
- **硬上限 120s**：4 个长音频（longConv1/longConv2/talk1/talk2）超过 120s，分 2 段生成后用 `scripts/wav-concat.mjs` 拼接为完整 WAV
- 转码：`scripts/wav-to-mp3.mjs`（`@breezystack/lamejs`，128kbps，纯 JS MP3 编码器）
- 系统无 ffmpeg/ffprobe/lame
- 7 个 MP3 的 checksum(sha256)/duration/sizeBytes 全部从实际文件计算并写入 Paper 001 asset 元数据

### Validator / Spec 扩展

- `CET6_EXAM_SPEC`：新增 `materialCount`（long_conversation=2 / passage=2 / lecture=3）和 `perMaterialQuestions`（[4] / [3,4] / [3,4]）
- `validateSpecConformance`：检查 material count 和 per-material allocation，partial/fixture 豁免
- `scripts/content-audio-validate.ts`：预期音频数 3→7，warnings→errors

### ContentRights / PaperAsset 硬化

- `ContentRights`：新增 `territory`（中国大陆）、`restrictions`、`permissionEvidence`（条款 URL）、`allowedUses`（产品内学习播放）
- `PaperAsset`：新增 `generated`（true）、`aiDisclosure`（"AI 合成语音"）
- 7 个 audio asset 全部带完整 rights metadata + provenance（provider/voice/termsCheckedDate/generatedAt/contentVersion）

### AI 合成语音标识

- `AudioPlayer.tsx`：展示 AI 合成语音标识
- 每个 asset 标记 `generated=true` + `aiDisclosure` 文案

---

## 3. 测试

### 测试数量

- Phase 2D 基线：451/451
- Phase 2D.1 新增：9 个测试
- **当前：460/460 PASS**

### 新增测试

1. `paper 001 listening: official material count = 2 long_conversation + 2 passage + 3 lecture`
2. `paper 001 listening: per-material question allocation = long conv 4+4 / passage 3+4 / lecture 4+3+3`
3. `paper 001 listening: 7 transcript units, each non-empty and self-authored`
4. `paper 001 listening: no orphan audio assets — every asset referenced by exactly one group`
5. `paper 001 listening: wrong material count triggers validator error (long_conversation 2→3)`
6. `paper 001 listening: wrong per-material allocation triggers validator error (long conv 4→5)`
7. `paper 001: contentVersion 1.1.0（Phase 2D.1 listening 结构重组）`
8. `paper 001: AI 合成语音标识准备（generated=true + aiDisclosure + provider + termsCheckedDate）`
9. `paper 001: audio rights scope hardened（territory / allowedUses / restrictions / permissionEvidence）`

### 修改的测试

- `makeCompletePaper` helper：listeningGroups 从 1+1+1（8+7+10）改为 2+2+3（4+4+3+4+4+3+3）
- `paper 001: 听力 4 组…3 个 audio` → `7 组…7 个 audio`，rights notes 检查 Phase 2D.1
- `paper 001 audio: 3 个真实音频资产` → `7 个真实音频资产`
- `transcript/contentVersion 与 audio version 一致`：referenced.size 3→7

---

## 4. 8 项 Gates 结果

| Gate | Result |
|------|--------|
| `npm test` | **460/460 PASS** |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npm run content:validate` | **PASS**（0 errors, 0 warnings） |
| `npm run content:stats` | **PASS** |
| `npm run content:rights` | **PASS**（production pool empty） |
| `npm run content:audio-validate` | **PASS**（0 errors, 1 warning = fixture placeholder 允许） |

---

## 5. 浏览器 Audio Smoke

- 页面：`http://localhost:3000/_qa-audio.html`（已更新为 7 音频）
- 7 个 audio 元素全部存在，readyState=4（HAVE_ENOUGH_DATA）
- duration 全部与元数据一致
- 第一个音频点击播放验证：3s 后 currentTime=2.58s，wasPlaying=true
- 所有 7 个 MP3 网络请求全部 200 OK
- 控制台：唯一 404 为 favicon.ico（无关）；NotAllowedError 为 JS 自动播放被策略阻止（点击播放后正常）
- **Browser Audio Smoke: PASS**

---

## 6. 人工试听 QA

- **MANUAL_AUDIO_QA_COMPLETE = PARTIAL**
- AI 无法替代人耳，7 个音频需人工试听确认：
  - 语音清晰度、自然度
  - 长音频拼接处无明显断裂
  - 英音/美音区分
  - 无截断、无爆音
  - 语速适中
- `_qa-audio.html` 提供 Play All / Pause / 0.8x / 1.0x / Replay / Check Durations 按钮供人工试听

---

## 7. 验收字段

| 字段 | 值 |
|------|-----|
| LONG_CONVERSATION_MATERIALS | 2 |
| PASSAGE_MATERIALS | 2 |
| TALK_REPORT_LECTURE_MATERIALS | 3 |
| TOTAL_LISTENING_MATERIALS | 7 |
| TOTAL_AUDIO_ASSETS | 7 |
| OFFICIAL_GROUP_STRUCTURE_MATCH | YES |
| WORD_COUNT_REVIEW_COMPLETE | YES |
| QUESTION_ALLOCATION_VALID | YES |
| AUDIO_RIGHTS_SCOPE_HARDENED | YES |
| AI_AUDIO_LABEL_READY | YES |
| MANUAL_AUDIO_QA_COMPLETE | PARTIAL |
| ALL_7_AUDIO_PASS | YES（browser smoke） |
| REAL_CET6_PAST_PAPERS_IMPORTED | NO |
| REAL_CET6_AUDIO_COMMITTED | NO |
| UNLICENSED_CONTENT_COMMITTED | NO |
| PAPER_STATUS | staging |
| PRODUCTION_POOL_CONTAINS_PAPER001 | NO |
| PHASE_2E_STARTED | NO |

---

## 8. 已知限制

- **人工试听 QA 未完成**：AI 无法替代人耳，7 个音频需人工试听确认音质和拼接质量
- **Offline hard refresh** 不属于 V12/V13 保证范围
- **Listening 音频离线重播**不保证稳定
- **真机移动端软键盘**尚未验证
- TTS 条款为 2026-08-20 版，Phase 2B 正式选择 provider 时需重新检查当前条款

---

## 9. 文件清单

### 修改

- `src/content/papers/cet6-mock-paper-001.ts` — Paper 001 重写为 7 materials/7 audio，contentVersion 1.1.0
- `src/content/types.ts` — ContentRights 扩展（territory/restrictions/permissionEvidence/allowedUses）
- `src/content/papers.ts` — PaperAsset 扩展（generated/aiDisclosure）+ validateSpecConformance material count
- `src/content/exam-spec.ts` — materialCount/perMaterialQuestions
- `src/components/listening/AudioPlayer.tsx` — AI 合成语音标识展示
- `scripts/content-audio-validate.ts` — 预期音频数 3→7
- `public/_qa-audio.html` — 7 音频 QA 页面
- `tests/v13-content.test.ts` — 9 个新测试 + fixture 更新
- `package.json` / `package-lock.json` — `@breezystack/lamejs` devDependency

### 新增

- `scripts/wav-to-mp3.mjs` — WAV→MP3 转码（128kbps）
- `scripts/wav-concat.mjs` — PCM WAV 拼接
- `public/audio/papers/p001-long-conversation-g2.mp3`
- `public/audio/papers/p001-passage-g1.mp3`
- `public/audio/papers/p001-lecture-g1.mp3`
- `public/audio/papers/p001-lecture-g2.mp3`

### 修改（音频文件）

- `public/audio/papers/p001-long-conversation-g1.mp3`（重新生成，155.8s）
- `public/audio/papers/p001-passage-g2.mp3`（重新生成，85.1s）
- `public/audio/papers/p001-lecture-g3.mp3`（新增主题，113.0s）

---

## 10. TTS Provider Rights

- **Provider**: 火山引擎·豆包语音 TTS
- **条款**: 《生成式模型服务专用条款》2026-08-20 版
- **URL**: `https://docs.volcengine.com/docs/6561/1533787`
- **termsCheckedDate**: 2026-09-28
- **COMMERCIAL_USE**: YES
- **REDISTRIBUTION**: PARTIAL（仅限中国大陆）
- **未使用**: voice clone / 名人模仿 / 真实真题音频
- 详见 `V13_TTS_PROVIDER_RIGHTS_MATRIX.md`（已随 Phase 2D 提交）
