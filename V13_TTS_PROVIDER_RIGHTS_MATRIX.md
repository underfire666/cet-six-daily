# V13 TTS Provider Rights Matrix

- **阶段**: V13 Phase 2D（Listening Audio Production Pipeline）
- **生成日期**: 2026-09-28（Asia/Shanghai）
- **调查原则**: 只使用官方 Terms / Service Terms / 官方文档 / 官方 pricing·licensing 页面；不以论坛、Community answer、博客、Reddit 作为最终授权依据。

---

## 1. 决策摘要

| Provider | 判定 | 依据等级 | 实际可调用（当前环境） | 备注 |
| --- | --- | --- | --- | --- |
| **火山引擎 · 豆包语音 TTS（Doubao Voice）** | **PRODUCTION_CANDIDATE（本轮实际使用）** | HIGH（官方《生成式模型服务专用条款》，2026-08-20 版） | ✅ 是（豆包 text_to_audio_plus 通道） | 生成内容 IP 归客户；许可限中国大陆地区、用于产品目的；不支持声音复刻/名人模仿 |
| AWS Polly | PRODUCTION_CANDIDATE（候补） | HIGH（官方 FAQ + 产品页） | ❌ 无 AWS 账号 key | 输出归客户，MP3/OGG 可再分发 |
| Azure Speech | PRODUCTION_CANDIDATE（候补，付费 tier 前提） | HIGH（Microsoft Product Terms 官方页） | ❌ 无 Azure key | 付费 tier prebuilt neural voices 输出可商用 |
| Google Cloud TTS | PRODUCTION_CANDIDATE（候补） | HIGH（官方 Quotas & limits 文档） | ❌ 无 GCP key | 你创建的音频数据文件可用于应用/媒体 |

> 三家云厂商正式条款均支持生产用途，但当前开发环境**没有** AWS / Azure / GCP 凭证，无法真实调用；本轮唯一可真实调用的 TTS 通道为**火山引擎豆包语音**，其官方正式条款（见 §5）足以支撑"以本产品使用为目的"的生成与部署。生成资产全部标记 **staging**，正式对外发布前需按 Known Limitations 复核深度合成标识等合规要求。

## 2. 核对项（每家 10 项）

### 2.1 火山引擎 · 豆包语音 TTS（本轮使用）
| # | 核对项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | commercial use | ✅ 允许（以产品开发/构建/部署为目的） | 专用条款 3.3、3.5 |
| 2 | generated output ownership/use rights | ✅ 生成内容产生的知识产权由客户在合法合规范围内维护和使用 | 专用条款 3.5 |
| 3 | redistribution of generated audio | ⚠️ 产品内使用允许；音频文件本体再许可/转售不授予 | 专用条款 3.3（普通许可，不可再许可/转让）、3.9(9) |
| 4 | storage/bundling in app | ✅ 允许（打包进自有产品部署） | 专用条款 3.3(1)(2)、3.5 |
| 5 | attribution requirement | 无显式署名要求；但深度合成内容须按中国法规显著标识（详见 §4） | 专用条款 3.11 |
| 6 | voice-specific restrictions | ✅ 使用系统预置音色；不使用自定义/复刻音色（复刻需单独协议） | 声音复刻协议（volcengine docs 6561/1136414） |
| 7 | synthetic voice restrictions | ✅ 未克隆现实人物；禁止名人模仿/深度伪造 | 版权和人像素材使用规则（docs 82379/2525200）、专用条款 3.9 |
| 8 | input text rights | ✅ 输入为项目自研 transcript（owned），无第三方权利问题 | 专用条款 3.4（客户内容归客户） |
| 9 | prohibited uses | ✅ 本项目不涉及医疗/法律决策、反向工程、竞品模型训练等 | 专用条款 3.9 |
| 10 | terms version / access date | 《生成式模型服务专用条款》最近更新时间 2026-08-20 21:54:43；访问日期 2026-09-28 | docs.volcengine.com/docs/6561/1533787 |

**TERMS_URLS**:
- https://docs.volcengine.com/docs/6561/1533787 （生成式模型服务专用条款 — 豆包语音）
- https://www.volcengine.com/docs/6561/1136414 （声音复刻协议 — 本阶段不使用复刻）
- https://www.volcengine.com/docs/82379/2525200 （版权和人像素材使用规则）

### 2.2 AWS Polly（候补）
| # | 核对项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | commercial use | ✅ 允许（AWS Customer Agreement 商业条款框架下） | aws.amazon.com/polly/faqs/ |
| 2 | output ownership | ✅ "As between you and AWS, your Polly output belongs to you." | Amazon Polly FAQ |
| 3 | redistribution | ✅ "Store your text-to-speech output in standard audio files like MP3 and OGG for redistribution ... at no extra cost." | Amazon Polly 产品页 |
| 4 | storage/bundling | ✅ 输出文件可存储/打包 | Amazon Polly 产品页 |
| 5 | attribution | 无显式署名要求 | Polly FAQ |
| 6 | voice-specific restrictions | 预置神经音色无额外限制；custom voice 另论 | Polly 文档 |
| 7 | synthetic voice restrictions | 禁止未经授权克隆他人声音（输入文本须有权利） | Polly FAQ（第三方文本须有权利） |
| 8 | input text rights | ✅ 输入为自研 transcript | Polly FAQ |
| 9 | prohibited uses | 无与本项目冲突项 | Customer Agreement |
| 10 | terms version / access date | FAQ 与产品页 2026-09 访问；正式合同以 AWS Customer Agreement 为准 | aws.amazon.com/polly/faqs/、aws.amazon.com/polly/ |

### 2.3 Azure Speech（候补，付费 tier 前提）
| # | 核对项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | commercial use | ✅（**付费 tier 前提**）："For Customers of the paid tier TTS Service only, Customer may use the audio output of prebuilt neural voices generated using the TTS Service, including for commercial purposes." | Microsoft Product Terms（microsoft.com/licensing/terms/.../MicrosoftAzureServices） |
| 2 | output ownership | ✅ 客户可使用输出；微软不对客户音频主张所有权（官方文档口径） | Product Terms + 官方文档 |
| 3 | redistribution | ✅ 付费 tier 输出可用于商业目的，含再分发场景 | Product Terms |
| 4 | storage/bundling | ✅ | Product Terms |
| 5 | attribution | 无显式署名要求 | Product Terms |
| 6 | voice-specific restrictions | custom neural voice 需 voice talent 书面许可；预置 neural voices 无此要求 | 官方 Disclosure for voice and avatar talent |
| 7 | synthetic voice restrictions | 禁止未授权自定义语音 | 同上 |
| 8 | input text rights | ✅ Customer represents and warrants rights to input | Product Terms（TTS Services 条款） |
| 9 | prohibited uses | 无与本项目冲突项 | Product Terms |
| 10 | terms version / access date | Product Terms 页访问 2026-09-28；版本以页面当前版本为准 | microsoft.com/licensing/terms |

> 注意：learn.microsoft.com/answers 上的社区 Q&A（如 5792674）仅作参考，**不作为正式授权依据**；正式依据为 Microsoft Product Terms 官方页。

### 2.4 Google Cloud TTS（候补）
| # | 核对项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | commercial use | ✅（GCP 付费/开通计费前提下按量使用） | cloud.google.com/text-to-speech/pricing |
| 2 | output ownership/use | ✅ "You can use the audio data files you create using Cloud Text-to-Speech in your applications or media in compliance with the Google Cloud Platform Terms of Service" | Cloud TTS Quotas & limits（Last updated 2026-09-18 UTC） |
| 3 | redistribution | ⚠️ 官方文档明示"in your applications or media"；音频文件再分发按 GCP ToS 评估（NEEDS FINAL TERMS CHECK） | 同上 |
| 4 | storage/bundling | ✅ | 同上 |
| 5 | attribution | 无显式署名要求 | GCP ToS |
| 6 | voice-specific restrictions | Chirp 3 即时自定义语音需许可名单；预置音色无额外限制 | Cloud TTS 文档 |
| 7 | synthetic voice restrictions | 自定义语音（Chirp 3 instant custom voice）仅许可名单用户 | 官方文档 |
| 8 | input text rights | ✅ 输入为自研 transcript | GCP ToS |
| 9 | prohibited uses | 无与本项目冲突项 | GCP ToS |
| 10 | terms version / access date | Quotas 页 Last updated 2026-09-18 UTC；访问 2026-09-28 | docs.cloud.google.com/text-to-speech/quotas |

---

## 3. 结论

1. **本轮 provider**：火山引擎 · 豆包语音 TTS（Doubao Voice，经豆包 text_to_audio_plus 通道真实生成）。
2. **三家云厂商条款均支持生产用途**（AWS 输出归客户可再分发；Azure 付费 tier 可商用；Google 官方明示可用于应用/媒体），列为**候补**，正式规模化生产时可切换。
3. **权利模型**：SCRIPT_SOURCE=self-authored（Paper 001 自研 Listening transcript），SCRIPT_RIGHTS=owned；generated audio 权利独立记录（见 paper asset rights metadata），**不因 Paper rights=owned 自动等同**。
4. 生成资产为 **staging**（Paper 001 仍 staging），不发布。

## 4. Known Limitations / Compliance Notes

- 豆包语音许可限**中国大陆地区**使用；本项目目标用户场景符合，但若未来海外部署需重新评估。
- 按《互联网信息服务深度合成管理规定》等法规，AI 合成语音在对外发布场景可能需要**显著标识**；Phase 2E/正式发布前需完成合规处理（本阶段仅 staging 资产）。
- 音频文件**本体**不可再许可/转售（豆包条款 3.3/3.9(9)）；产品内学习播放用途不受影响。
- AWS/Azure/GCP 三家未被实际调用（无凭证），其条款判定基于官方页面文本；正式切换前应复核最新版本与定价。
