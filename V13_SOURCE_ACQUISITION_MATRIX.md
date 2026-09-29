# V13 SOURCE ACQUISITION & RIGHTS MATRIX

- **Phase:** V13 Phase 2A — Source Acquisition & Rights Matrix
- **Date:** 2026-09-26
- **Branch:** `feature/v13-real-content`
- **Scope:** Pure research / documentation. No product code modified, no real content imported, no audio committed.
- **Access date for all source checks:** 2026-09-26

---

## 1. Executive Summary

This document investigates, verifies, and classifies real CET-6 (College English Test Band 6) content sources to determine which assets may enter production, which may enter staging only, and which must be blocked. Research was conducted across four tiers: official first-hand sources (Tier A), explicitly licensed/open sources (Tier B), publisher/institution public materials (Tier C), and third-party aggregators/forums/GitHub/social media (Tier D).

### Headline findings

- **OFFICIAL SOURCES FOUND:** 4 — cet.neea.edu.cn (info portal), cet-bm/cet-kw.neea.edu.cn (registration), NEEA User Service Agreement, 2016 revised syllabus PDF with embedded CET-6 sample paper.
- **OFFICIAL FULL PAST PAPERS FOUND:** Zero for 2022–2026. No official full administered CET6 papers for 2022–2026 were found in the official sources surveyed during this research.
- **OFFICIAL AUDIO FOUND:** Zero English CET-6 listening audio currently available from official sources. Legacy host www.cet.edu.cn no longer serves CET content.
- **PRODUCTION CANDIDATES:** None for real CET-6 content. Only self-authored mock content, self-produced audio, and re-authored exam-structure facts are production-safe.
- **STAGING CANDIDATES:** 2016 syllabus PDF (specification/sample reference), official exam-structure tables (re-authored facts).
- **BLOCKED SOURCES:** All third-party aggregators, all GitHub CET-6 content repos, all training-institution content, all social-media audio uploads, all real past-paper text/audio/transcripts.
- **UNKNOWN RIGHTS SOURCES:** Legacy cet.edu.cn sample audio (availability unverified); a small number of uninspected GitHub repos.

### Core conclusion

No source surveyed provides explicit redistribution, commercial-use, or derivative-use permission for real CET-6 exam content. The rights holder (教育部教育考试院 / 全国大学英语四、六级考试委员会) explicitly reserves all rights and prohibits copying, distribution, and commercial or non-commercial use without written permission. **The recommended first-import strategy is a hybrid model: official specification for exam structure, self-authored high-fidelity mock items for practice, self-produced/commissioned audio for listening, and self-authored editorial explanations. Real past papers remain staging/reference-only pending a written license from NEEA.**

---

## 2. Research Method

### 2.1 Tiered investigation framework

| Tier | Definition | Investigation depth |
|---|---|---|
| **A** | Official first-hand sources (NEEA, 教育部教育考试院, official CET pages, syllabus, sample questions) | Direct page inspection, copyright clause extraction, asset inventory |
| **B** | Explicitly licensed / open-license sources (CC, OER, written permission) | License verification, content-rights separation check |
| **C** | Publisher / institution / school public materials (外研社, 新东方, 有道, etc.) | Copyright notice inspection, lead discovery, cross-check only |
| **D** | Training institutions / forums / cloud drives / blogs / WeChat / GitHub third-party repos | Repository license vs. content rights separation, redistribution evidence check |

### 2.2 Methodology

1. **Web search** for official CET-6 portals, syllabus documents, past-paper repositories, GitHub repos, aggregator sites, and listening audio sources.
2. **Direct page fetch** (web.fetch) for key URLs to verify exact wording of copyright notices, license files, terms of service, and content inventories.
3. **GitHub repository inspection**: directory listing for LICENSE files, README rights statements, content type inventory, and separation of code license from content rights.
4. **FACT vs. INFERENCE labeling**: every key conclusion is labeled as directly observed (FACT) or deduced without explicit statement (INFERENCE).
5. **Asset-level rights analysis**: each source is evaluated across 12 asset types independently (Exam Structure, Question Text, Reading Passage, Listening Question, Listening Audio, Listening Transcript, Writing Prompt, Translation Prompt, Answer Key, Official Explanation, Third-party Explanation).
6. **Evidence quality grading**: HIGH (explicit official license/permission/terms), MEDIUM (credible source but reuse needs interpretation), LOW (third-party claim / unverifiable). LOW evidence cannot qualify as PRODUCTION CANDIDATE.

### 2.3 Constraints observed

- No real exam papers, audio, or PDFs were downloaded or saved.
- No full question text, answers, or explanations were reproduced.
- No product code, Prisma schema, or migrations were modified.
- No Phase 2B work was initiated.
- Third-party content was never used to fill gaps in official-source coverage.

---

## 3. Official Sources (Tier A)

### 3.1 Source inventory

#### SRC-A01: CET Information Portal — cet.neea.edu.cn

| Field | Value |
|---|---|
| **Source Name** | 中国教育考试网 CET 分站 |
| **Publisher/Operator** | 教育部教育考试院 (NEEA); exam owned by 教育部 |
| **URL** | https://cet.neea.edu.cn/ |
| **Material Type** | Exam introduction, news, syllabus listing, exam structure, score interpretation, FAQ |
| **Years Covered** | N/A (reference site, no past papers) |

**Asset availability:**

| Asset Type | Available? | Notes |
|---|---|---|
| Exam Structure | YES | CET-6 structure table: 57 items, 130 min, section weightings. https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm |
| Question Text | NO | No real exam questions published |
| Reading Passage | NO | Not published |
| Listening Question | NO | Not published |
| Listening Audio | NO | No English audio hosted |
| Listening Transcript | NO | Not published |
| Writing Prompt | NO | Not published |
| Translation Prompt | NO | Not published |
| Answer Key | NO | Not published |
| Official Explanation | NO | Not published |

**Rights:**
- Footer operator notice: "主办单位:教育部教育考试院 京ICP备05064772号-1" — this is an ICP/operator notice, NOT a reuse license. (FACT, https://www.neea.edu.cn/xhtml1/folder/1509/36-1.htm)
- No open-license or reuse-terms page found on the CET info site. (FACT)
- **Redistribution permission:** NO — governed by NEEA all-rights-reserved regime (see SRC-A02).
- **Commercial use permission:** NO.
- **Derivative use permission:** NO.
- **Attribution:** No CC-style attribution model exists; default is "no use without permission."

**Rights Verdict:** Exam Structure = STAGING_ONLY (re-authored in own words → usable as specification). All other asset types = BLOCKED (not published; plus blanket no-copy clause). Evidence quality: HIGH.

---

#### SRC-A02: NEEA User Service Agreement (binding IP statement)

| Field | Value |
|---|---|
| **Source Name** | 教育考试院用户服务协议 (CET/NCRE/PETS) |
| **Publisher/Operator** | 教育部教育考试院 |
| **URL** | https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf |
| **Updated** | 2021-11-01; effective 2022-03-30 |
| **Material Type** | Terms of service / intellectual property statement |

**Quoted copyright clause (Section 九 知识产权, verbatim):**

> "本网站所有内容和资源的知识产权归教育考试院所有，域名、名称、文字、图片、排版、代码等信息受《中华人民共和国著作权法》等法律法规保护。**未经许可，任何单位和个人不得对本网站的内容和资源以任何方式做复制、修改、发送、储存、发布、交流和分发，不得将本网站上的资源用作其他商业或非商业用途。**否则本网站将追究其法律责任。"

**Section 六.5(3):** users may not "对本网站拥有知识产权的内容进行使用、出租、出借、复制、修改、链接、转载、汇编、发表、出版、建立镜像站点等".

**Scope note (corrected 2026-09-26, Phase 2A.1):**
- **FACT:** This agreement formally governs the CET/NCRE/PETS **registration website** (cet-bm / cet-kw .neea.edu.cn). Its object is the registration site, not every NEEA property.
- **FACT:** The official CET info pages (cet.neea.edu.cn) and the 2016 syllabus/sample material carry no explicit open license, redistribution permission, or commercial-use permission found during this research.
- **INFERENCE (MEDIUM):** Identical IP boilerplate is reused across NEEA resource subdomains (e.g., https://resource.neea.edu.cn/project/Agreement/TOEFL/ServiceAgreement.html) and the operator/rights holder is the same entity, so the all-rights-reserved posture is consistent across NEEA properties — but this is inference, not a direct contractual finding.
- **OPERATIONAL DECISION (fail closed):** Do NOT claim this agreement directly governs all CET-6 exam assets (all cet.neea.edu.cn content, the 2016 syllabus book, all administered papers). Absent independent reuse evidence for those assets, the V13 production rights model fails closed (UNKNOWN / STAGING_ONLY / BLOCKED), consistent with the Phase 1.1 rights model.

**Rights Verdict:** All content = BLOCKED for redistribution/commercial/derivative use without written permission. Evidence quality: HIGH.

---

#### SRC-A03: Official Syllabus & Sample Paper (2016 revised edition)

| Field | Value |
|---|---|
| **Source Name** | 《全国大学英语四、六级考试大纲（2016年修订版）》 |
| **Compiled by** | 全国大学英语四、六级考试委员会◎编著 (committee office at 上海交通大学) |
| **Print Publisher** | 上海交通大学出版社, ISBN 9787313146502, 2016-04, ¥39 |
| **Official Listing** | https://cet.neea.edu.cn/html1/folder/16113/1588-1.htm |
| **Official PDF** | https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf |
| **Committee page** | https://cet.neea.edu.cn/xhtml1/folder/19081/5123-1.htm |
| **Library catalog** | https://www.las.ac.cn/front/book/detail?id=b3547a1378f35574e950ea3184ced025 |

**Contents (FACT):** Includes test objectives, item-type rubrics, and one embedded CET-6 written sample paper (样卷, approx. p.167) plus CET-SET6 sample. The PDF preface states that配套听力音频/口试视频 were downloadable from "www.cet.edu.cn".

**Current status of legacy audio host (FACT):** `http://www.cet.edu.cn` no longer serves CET content — it now serves an MHK (民族汉考) admission-ticket download page (fetched 2026-09-26). The current 考试大纲 folder lists sample listening audio **only for Japanese and Russian CET** — no English CET-4/6 audio link exists (https://cet.neea.edu.cn/html1/folder/16113/1588-1.htm).

**Asset availability:**

| Asset Type | Available? | Notes |
|---|---|---|
| Exam Structure / Specification | YES | Test objectives, rubrics, item-type definitions |
| Question Text (sample) | YES | One CET-6 样卷 embedded in PDF |
| Reading Passage (sample) | YES | Within sample paper |
| Listening Question (sample) | YES | Within sample paper |
| Listening Audio (sample) | NO | Legacy host repurposed; no current English audio link |
| Listening Transcript (sample) | YES | Sample listening script within 样卷 |
| Writing Prompt (sample) | YES | Within sample paper |
| Translation Prompt (sample) | YES | Within sample paper |
| Answer Key (sample) | YES | Within sample paper |
| Official Explanation | NO | No explanations in syllabus |

**Rights:**
- The PDF is a copyrighted book (SJTU Press ISBN) made viewable on NEEA's site; no reuse license is attached. (FACT)
- "Publicly viewable PDF" ≠ "may reproduce sample questions in our app" — NEEA IP clause and copyright law both bar that without written permission. (INFERENCE, MEDIUM)

**Rights Verdict:**
- Specification text (test objectives, rubrics, structure) = STAGING_ONLY / REFERENCE (re-author in own words). Evidence: MEDIUM.
- Embedded sample paper text = BLOCKED for redistribution; REFERENCE ONLY for style/structure study. Evidence: MEDIUM.
- Embedded sample listening audio = BLOCKED (also unavailable). Evidence: MEDIUM.

---

#### SRC-A04: Registration / Score Service Sites

| Field | Value |
|---|---|
| **Source Name** | CET报名网 / 成绩查询 |
| **URLs** | cet-bm.neea.edu.cn, cet-kw.neea.edu.cn, https://cet.neea.edu.cn/cet, https://zwfw.moe.gov.cn/cet/dc/ |
| **Content** | Registration, score queries, e-report cards |
| **Exam content** | NONE |

All governed by SRC-A02 agreement. No exam content of any kind. **Rights Verdict:** N/A (no content assets).

---

### 3.2 Official source summary

| Source ID | Name | Key URL | Production Value | Verdict |
|---|---|---|---|---|
| SRC-A01 | CET info portal | https://cet.neea.edu.cn/ | Exam structure facts only | STAGING_ONLY (structure) / BLOCKED (content) |
| SRC-A02 | NEEA User Agreement | https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf | Defines rights regime — all rights reserved | BLOCKED (all redistribution) |
| SRC-A03 | 2016 Syllabus PDF | https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf | Specification + 1 sample paper | STAGING_ONLY (spec) / BLOCKED (sample content) |
| SRC-A04 | Registration/score sites | cet-bm.neea.edu.cn | None | N/A |

---

## 4. Past Paper Availability Matrix

**FACT:** The official CET portal (cet.neea.edu.cn) publishes **no actual sitting papers**. The 考试动态 archive contains only registration/timetable/score notices; there is no "历年真题" section. Navigation observed: 考试动态 / CET委员会 / 考试大纲 / 考核内容 / 分数解释 / 常见问题 (https://cet.neea.edu.cn/xhtml1/folder/1608/1178-1.htm).

| Year | June (Set 1/2/3) | December (Set 1/2/3) | Official Source URL | Rights Status |
|---|---|---|---|---|
| **2026** | NOT FOUND FROM OFFICIAL SOURCE | NOT FOUND FROM OFFICIAL SOURCE (Dec sitting scheduled 2026-12-12; no paper released) | n/a — news only: https://cet.neea.edu.cn/xhtml1/report/2609/1-1.htm | BLOCKED / UNAVAILABLE |
| **2025** | NOT FOUND FROM OFFICIAL SOURCE | NOT FOUND FROM OFFICIAL SOURCE | n/a — score notice: https://cet.neea.edu.cn/html1/folder/21083/9970-1.htm | BLOCKED / UNAVAILABLE |
| **2024** | NOT FOUND FROM OFFICIAL SOURCE | NOT FOUND FROM OFFICIAL SOURCE | n/a | BLOCKED / UNAVAILABLE |
| **2023** | NOT FOUND FROM OFFICIAL SOURCE | NOT FOUND FROM OFFICIAL SOURCE | n/a | BLOCKED / UNAVAILABLE |
| **2022** | NOT FOUND FROM OFFICIAL SOURCE | NOT FOUND FROM OFFICIAL SOURCE | n/a | BLOCKED / UNAVAILABLE |

**Note:** Third-party aggregators (CET通, 懒笔记, WeHUSTER) do host reconstructed "考生回忆版" papers for these years, but these are NOT official sources and are classified as BLOCKED (see Section 6). They are listed here only to document that the gap exists in official coverage, not to recommend their use.

**INFERENCE (HIGH confidence):** NEEA's consistent policy posture — never releasing administered papers, only one 2016-vintage sample set inside the syllabus book — means production use of any "real CET-6 paper" cannot be sourced from Tier A.

---

## 5. Asset-Level Rights Matrix

Rights are evaluated per asset type across all source classes. Verdicts use only: PUBLISHABLE / STAGING_ONLY / BLOCKED / UNKNOWN.

| Asset Type | Official (Tier A) | Publisher (Tier C) | Third-party (Tier D) | Self-authored | Overall Verdict | Evidence |
|---|---|---|---|---|---|---|
| **Exam Structure** (timing, weighting, item counts) | STAGING_ONLY (re-author facts) | REFERENCE ONLY | BLOCKED | PUBLISHABLE (own re-statement) | **PUBLISHABLE** as re-authored specification | MEDIUM — factual conventions; verbatim copy barred |
| **Question Text** (real past papers) | BLOCKED (not published) | BLOCKED (paid copyrighted) | BLOCKED (no license) | PUBLISHABLE (own mock) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH — NEEA all-rights-reserved |
| **Reading Passage** (real) | BLOCKED | BLOCKED | BLOCKED (plus underlying foreign-press copyright) | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Listening Question** (real text) | BLOCKED | BLOCKED | BLOCKED | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Listening Audio** (real) | BLOCKED (unavailable) | BLOCKED | BLOCKED (leaked/ripped, no license) | PUBLISHABLE (TTS/voice-over for own scripts) | **BLOCKED** for real; PUBLISHABLE for self-produced on own scripts | HIGH — no redistribution license anywhere |
| **Listening Transcript** (real) | BLOCKED (only sample in PDF) | BLOCKED | BLOCKED (derivative of script+recording) | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | MEDIUM — transcript infringes both script and recording rights |
| **Writing Prompt** (real) | BLOCKED | BLOCKED | BLOCKED | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Translation Prompt** (real) | BLOCKED | BLOCKED | BLOCKED | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Answer Key** (real) | BLOCKED (not published) | BLOCKED | BLOCKED | PUBLISHABLE (own) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Official Explanation** | BLOCKED (not published) | N/A | N/A | PUBLISHABLE (own editorial) | **BLOCKED** for real; PUBLISHABLE for self-authored | HIGH |
| **Third-party Explanation** | N/A | BLOCKED (publisher IP) | BLOCKED (training firm IP) | PUBLISHABLE (own editorial) | **BLOCKED** for third-party; PUBLISHABLE for self-authored | HIGH — 新东方/有道 each assert own copyright |

### Key principles

1. **official_public_material ≠ redistributionAllowed=true**: Even when material is publicly viewable on an official website, no explicit reuse/redistribution/commercial license exists. Per Phase 1.1 rights model, this yields UNKNOWN or STAGING_ONLY, never PUBLISHABLE.
2. **Asset-level independence**: A source may provide usable exam-structure facts while its question text remains BLOCKED. Rights are evaluated per asset, not per source.
3. **Self-authored content is the only PUBLISHABLE path**: Original high-fidelity mock questions, self-written listening scripts, self-produced audio (via paid TTS or contracted voice-over buyout), and self-authored editorial explanations are all PUBLISHABLE when we own the input rights.
4. **Facts are not copyrightable**: Exam year, session, form number, section structure, timing, weighting, and difficulty tags are factual data that may be curated and published — but they must not embed or smuggle in copyrighted question text.

---

## 6. Third-party Sources (Tier B / C / D)

### 6.1 Tier B — Explicitly licensed / open sources

**Result: NONE found.**

- Searches for CET-6 real exam content under Creative Commons / CC0 / OER returned only generic CC-licensed educational material (OER Commons, creativecommons.org), **no CC-licensed CET-6 past papers**. (FACT)
- No repo or site inspected carried a CC/CC0/BSD/Apache/GPL license that actually covers the *exam question content* (as opposed to surrounding code). (FACT)
- **INFERENCE (HIGH):** Real CET-6 papers are government-exam content owned by the committee; no OER publisher has relicensed them. Tier B is effectively empty for genuine past papers.

---

### 6.2 Tier C — Publisher / institution / training institution public materials

| Source ID | Name | Type | Operator | URL | Material | Years | Rights Note | Verdict |
|---|---|---|---|---|---|---|---|---|
| SRC-C01 | 外研社 HEP/VEP | University press | 外语教学与研究出版社 (BFSU) | heep.fltrp.com; vep.fltrp.com | Paid book 《大学英语六级考试真题全解+标准预测》(ISBN 978-7-5213-3407-4); companion PDF with 2024.06 & 2024.12 real papers + listening transcript/answers: https://vep.fltrp.com/upload/20250805/e439abb1df734b51a71f64c5170ead68.pdf | Recent, ~11 papers | Commercial copyrighted publication. No redistribution license. Legal consumption = buy the book. | REFERENCE ONLY / BLOCKED for reuse |
| SRC-C02 | 新东方在线 | Training institution | 新东方教育 (NYSE: EDU) | cet6.koolearn.com; cet4-6.xdf.cn | 真题+答案+深度解析 within days of each exam; 历年真题+答案+听力音频 | 2019–2026 | 新东方 states own course/content copyright is fully its own and prohibits copying/redistribution. Their *explanations* are their IP; underlying question text belongs to the committee. | BLOCKED (explanations) / REFERENCE (metadata) |
| SRC-C03 | 有道精品课 (有道考神) | Training institution | 网易有道 | c.youdao.com; ke.youdao.com | Paid CET-6 courses using real papers for drills | 2018–present | Copyright notice: "未经授权许可，任何人、任何单位不得对以上内容实施复制、改编、传播、交易、借用、存储或上传至其他平台（不论商业或非商业）。" (https://c.youdao.com/article/index.html?pid=598) | BLOCKED |
| SRC-C04 | 粉笔四六级 App | Training institution | 北京粉笔蓝天科技有限公司 | App (fenbiCET WeChat) | In-app 真题 bank, paid | Current | Proprietary app; no web redistribution terms found. | BLOCKED |
| SRC-C05 | 星火英语 / 华研外语 | Commercial print publishers | Various | dangdang.com / jd.com product pages | Printed past-paper books | 2026 cycle | Authorized commercial channel for papers — evidence that lawful consumption is buying the printed book. | REFERENCE ONLY |

**Tier C verdict:** These sources are useful only for lead discovery, metadata confirmation (session counts, form structure, paper existence), and cross-checking. Their own copyright statements reinforce that content is not freely redistributable. None grants us rights. Evidence quality: HIGH for explicit copyright statements; MEDIUM for metadata.

---

### 6.3 Tier D — Aggregator sites / forums / blogs / cloud drives / social media

| Source ID | Name | Type | URL | Material | Years | Rights Statement | Verdict |
|---|---|---|---|---|---|---|---|
| SRC-D01 | CET通 | Free aggregator | https://www.cettong.cn/library/cet6 | 46 sets: 试卷PDF + 答案 + 听力MP3 (streaming + download) | 2019–2025 | No copyright notice, no license/terms, no attribution to committee found on library page. | BLOCKED |
| SRC-D02 | WeHUSTER | Personal/aggregator | https://wehuster.com/cet6 | 真题+解析, "含听力" labels, answers per set | 2019–2026.06 | No rights/license text found; no operator entity stated. | BLOCKED |
| SRC-D03 | 懒笔记 (lazynote) | Elaborate aggregator | https://english-exam.lazynote.cn/cet6 | 76 sets (2015–2026): full PDF + editable Word + 解析版 + streaming 听力原声 (343 clips) + transcripts + explanations + word/sentence banks | 2015–2026.06 | Markets files as "免费下载"; attributes 命题方=教育部考试中心 descriptively but offers no license, no redistribution permission, no contact/entity. Own PDFs say answers were "由懒笔记…逐题核对整理." | BLOCKED |
| SRC-D04 | catteacher0515/cet6-download | GitHub Pages static downloader | https://catteacher0515.github.io/cet6-download | Direct PDF downloads, no login | 2021–2025 (~30 sets) | Marketing copy "免费…不登录不跳转"; no license, no rights statement. | BLOCKED |
| SRC-D05 | book118 (原创力文档) | Doc cloud-drive | https://m.book118.com | Individual paper PDFs (e.g. 2024.06 Set2) | Various | Typical paid/gated doc-sharing site; no redistribution rights. | BLOCKED |
| SRC-D06 | Bilibili UGC | Video/social | e.g. https://www.bilibili.com/video/BV1nfEg6EEYd/ | 听力真题 audio + bilingual subtitles; PDFs funneled via WeChat bio | Up to 2025–2026 | B站 video carries platform tag "未经作者授权，禁止转载"; uploaders funnel viewers to WeChat 公众号 for "PDF/讲义." | BLOCKED |
| SRC-D07 | 喜马拉雅 Ximalaya | User-uploaded UGC | https://m.ximalaya.com/creation/24841701 | User-uploaded CET-6 listening albums; Baidu-pan links in descriptions | Various | Platform UGC; no chain of rights from NEEA. | BLOCKED |
| SRC-D08 | 可可英语 kekenet | Media site | http://search.kekenet.com/cse/search?q=六级听力 | MP3 + 字幕 + bilingual subtitles | Various | No redistribution license found. | BLOCKED |
| SRC-D09 | 结网英语 jwbl.com | 网盘 pack | http://www.jwbl.com/html/21/16901.html | mp3+txt via Baidu pan | Various | None. | BLOCKED |
| SRC-D10 | WeChat 公众号 | Social | Referenced inside B站/抖音 bios | PDF/听力 packs distributed privately | Rolling | Content is gated/funneled off-platform; no public license terms. | BLOCKED |
| SRC-D11 | 掘金/CSDN blogs | Dev blogs | https://blog.csdn.net/sgsx11/article/details/121024254 | Point to free sites; PyQt5 scraper tool distributing 1989–2021 papers via Aliyun drive | 1989–2021 | No content license. | BLOCKED |

**Tier D verdict:** All BLOCKED. No source displays an explicit redistribution license. Most either stay silent on rights or explicitly state "personal study only, no redistribution." Evidence quality: MEDIUM for site inspection; LOW for UGC/social sources.

---

### 6.4 GitHub repository analysis

| Repo | URL | Stars (approx) | Repo License | Content Types | Years | Content Rights Addressed? | Verdict |
|---|---|---|---|---|---|---|---|
| **YinsinSirius/CET6-Resources** | https://github.com/YinsinSirius/CET6-Resources | 535 | **NONE** (no LICENSE file; only README + .gitattributes + content folders) | Full papers per-session folders, reading/writing/translation; listening NOT committed (README links to Bilibili video) | 2013.06–2025.06 (incl. 2020.07/09, 2022.09 make-up) | README gives no copyright notice, no permission, no source attribution to the committee. Only study tips. | **BLOCKED** — no license at all; content is committee's |
| **123xzw999/cet6-exam-quiz** | https://github.com/123xzw999/cet6-exam-quiz | 0 (1 fork) | **NONE** | 1859 questions, answer key, per-question 解析, listening HLS audio links, reading passages, writing/translation prompts | 2020.07–2026.06 (46 sets) | **YES — disclaims rights:** README states 真题版权归全国大学英语四、六级考试委员会及命题方; original book cover says "仅限个人学习使用，请勿二次传播"; repo "不用于商业用途，也不提供任何形式的再分发"; takedown-on-request. | **BLOCKED** — repo confirms no redistribution rights |
| **glh5835/cet6-papers-spider** | https://github.com/glh5835/cet6-papers-spider | 1 | **NONE** | Code only (Python scraper); downloads PDFs from catteacher0515 site | Targets 2023–2026 | README: "仅用于个人学习研究，请遵守目标网站服务条款，勿用于商业用途." No audio. | **BLOCKED** — scraper against unlicensed site |
| **catteacher0515/cet6-download** | https://github.com/catteacher0515/cet6-download (Pages) | Low (site) | **NONE** observed | Static PDF direct-download page | 2021–2025 (~30 sets) | No license/rights text observed; marketed as free/no-login. | **BLOCKED** |
| **longweihua/english-data-download** (Gitee mirror) | https://gitee.com/longweihua/english-data-download | — | **NONE** (README empty, no LICENSE) | Raw CET6-YYYY-mm-N.mp3 committed + paired .pdf/.txt | Various | No permission statement. | **BLOCKED** — repo license ≠ content license |
| Others (xxayt/*CET6*, bedoom/cet-6-pdf, YSP0Github/Cet6-Practice, masher-pp/cet6-real-exam-trainer, XxuCyprus/Eword) | GitHub search results | 0–7 | Not individually inspected; no known LICENSE | Papers/practice tools | Various | Not inspected → presumed no content grant. | **UNKNOWN / BLOCKED by default** |

**GitHub critical rule application (FACT vs. INFERENCE):**
- **FACT:** YinsinSirius/CET6-Resources has no LICENSE file (directory listing showed only README.md, .gitattributes, and paper folders).
- **FACT:** 123xzw999/cet6-exam-quiz explicitly attributes copyright to the exam committee and states it does not redistribute.
- **INFERENCE (HIGH):** Even if a CET-6 repo did carry an MIT/Apache LICENSE, that license attaches to the repository author's own code; the author is not the rights holder of the exam questions/audio, so they cannot MIT-license the papers. A code LICENSE would therefore NOT make the exam content PUBLISHABLE.
- **INFERENCE:** No inspected repo contains a permission chain from 教育考试院/考试委员会. All are BLOCKED or UNKNOWN, never PUBLISHABLE.

---

### 6.5 Market flow analysis (risk understanding only)

Real CET-6 papers circulate in a recognizable pipeline:

1. **Post-exam recall:** Within hours of each June/December sitting, training firms (新东方 cet4-6.xdf.cn, 有道, 粉笔) publish reconstructed 真题及答案 ("考生回忆版") and their own 解析 to drive traffic. (FACT, e.g. http://mtoutiao.xdf.cn/cet4-6/202604/15175702.html)
2. **Free aggregators mirror them:** Independently-run sites (CET通, WeHUSTER, 懒笔记) assemble reconstructed papers into downloadable PDF + Word + answer + listening MP3/HLS, adding annotations for SEO. 懒笔记 catalogs 203 reading passages' original sources (The Guardian, NYT, etc.) — noting underlying passages are themselves foreign-press copyrighted works layered on top of exam copyright.
3. **GitHub/Pages re-host:** Individuals package the same PDFs (catteacher0515 Pages), build static quiz UIs (123xzw999), or write scrapers (glh5835).
4. **Social funnels:** Bilibili/Douyin uploaders post listening audio with bilingual subtitles and funnel viewers to WeChat 公众号 for "PDF/讲义."
5. **Rights claims:** Effectively none. Most stay silent or explicitly state "personal study only, no redistribution, takedown on request." None claim a license from the committee. The lawful commercial channel remains printed books (外研社/星火/华研) and paid courses.

---

## 7. Listening Rights Analysis

### 7.1 Listening source inventory

| Source | Type | URL | Real Audio? | Transcript? | Question Text? | Audio Rights | Transcript/Text Rights | Evidence | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| NEEA 考试大纲 page | Official | https://cet.neea.edu.cn/html1/folder/16113/1588-1.htm | No English audio (only 日语/俄语) | No | Only 样卷 text in 2016 PDF | n/a | All rights reserved | HIGH | BLOCKED |
| 2016 Syllabus PDF | Official PDF | https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf | Legacy link to www.cet.edu.cn (unverified) | Sample script in 样卷 | CET-6 sample listening Q's | UNKNOWN (legacy) | All rights reserved | MEDIUM | STAGING_ONLY (text) / UNKNOWN (audio) |
| NEEA User Agreement | Official terms | https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf | — | — | — | Explicit prohibition | Same | HIGH | BLOCKED |
| 懒笔记 | 3rd-party | https://english-exam.lazynote.cn/cet6/sections/listening/ | Yes, streaming "原声音频" (49 sets) | Yes, "原文转写" | Yes, PDFs | No license | No license | MEDIUM | BLOCKED |
| CET通 | 3rd-party | https://www.cettong.cn/library/cet6/2025_06_1 | Yes, streaming + MP3 download | Implied | Yes, PDF + answer | No license | No license | MEDIUM | BLOCKED |
| 可可英语 | 3rd-party media | http://search.kekenet.com/cse/search?q=六级听力 | Yes, MP3 + 字幕 | Yes (bilingual) | Yes | No license | No license | LOW | BLOCKED |
| 喜马拉雅 | UGC | https://m.ximalaya.com/creation/24841701 | Yes, user-uploaded | Partial | Partial | Platform UGC; Baidu-pan links | No chain | LOW | BLOCKED |
| Gitee longweihua | Open-source host | https://gitee.com/longweihua/english-data-download | Yes, raw MP3 committed | Yes, .pdf/.txt | Yes | No LICENSE, empty README | Same | MEDIUM | BLOCKED |
| Bilibili UGC | UGC | https://www.bilibili.com/video/BV1nfEg6EEYd/ | Yes (video form) | Yes, hardcoded subtitles | Yes | "未经作者授权，禁止转载" | No rights chain | LOW | BLOCKED |
| 新东方在线 | Commercial | https://cet6.koolearn.com/20250609/901413.html | Sells "历年真题电子版" (~¥50, 12 sets) | As product | Yes, "考生回忆版" | No NEEA license evidence | Self-described "回忆版" | MEDIUM | REFERENCE ONLY |

### 7.2 Audio rights deep-dive

**Who holds the rights?**
- **FACT:** NEEA's CET/NCRE/PETS user agreement asserts: "本网站所有内容和资源的知识产权归教育考试院所有…未经许可，任何单位和个人不得对本网站的内容和资源以任何方式做复制、修改、发送、储存、发布、交流和分发，不得将本网站上的资源用作其他商业或非商业用途" (https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf).
- **FACT (law):** Under 著作权法 (2020), performers enjoy Art.39/38 moral + economic rights (表明身份、许可录音录像、复制发行、信息网络传播，保护期50年) — https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm. The recording itself is a 录音制品 whose producer holds 录音制作者权.
- **INFERENCE (MEDIUM):** CET listening audio is commissioned work; economic rights in the sound recording most likely rest with NEEA (or its recording contractor, who would have assigned to NEEA), with voice performers retaining moral rights. No public contract discloses this chain.
- **FACT:** No redistribution license for real CET-6 audio exists on any source surveyed. No source states "audio may be reused/redistributed."

### 7.3 Transcript rights deep-dive

- **FACT:** No official listening transcripts for administered past exams were found in the official sources surveyed during this research. The only official listening script text found is the 样卷 script inside the 2016 syllabus PDF.
- **FACT (law):** A transcript is both a reproduction of the underlying script text (which NEEA claims) and a transcription/derivative of the sound recording. Transcribing an audio recording creates no new right that clears the underlying rights — it infringes the script copyright and the recording producer's right simultaneously. (Framework: 著作权法 Art.10 reproduction/derivative rights; https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html.)
- **INFERENCE (MEDIUM):** Third-party "听力原文" sites either OCR/copy publisher book transcripts or transcribe leaked audio themselves — neither chain has a NEEA license.
- **Fair-use check (FACT):** Art.24(6) classroom-teaching exception explicitly says "供教学或者科研人员使用，但不得出版发行" — it does NOT cover a commercial consumer app (https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm). This is not a safe harbor.

### 7.4 Streaming/linking vs. hosting analysis

- **FACT (law):** Chinese courts apply the "server standard": a plain deep link that does not frame/embed and directs the user to the original site is generally not itself an 信息网络传播行为 (北京知产法院典型案例 (2015)京知民终字第796号, https://www.chinaiprlaw.cn/index.php?id=4026; 上海知产法院 http://www.shzcfy.gov.cn/detail.jhtml?id=10006336).
- **FACT:** But: (a) contributory (帮助) liability attaches if the linker knows/should know the target is infringing; (b) profit-driven deep-linking to infringing works has produced criminal convictions (上海普陀法院 case, https://www.shzcfy.gov.cn/detail.jhtml?id=339270).
- **INFERENCE:** Since every third-party host of real CET-6 audio appears itself to lack NEEA's distribution license, deep-linking to that audio would still expose us to contributory liability. There is also no official audio URL to link to (NEEA doesn't host past-paper audio).
- **FACT:** No official embeddable player or API exists.

### 7.5 Alternative approach: "Real metadata + self-made/licensed audio"

#### What "real metadata" can safely include
- **PUBLISHABLE as facts (FACT, HIGH):** exam year, session (June/Dec), form number (第1/2/3套), section structure (Section A 长对话 8 题 / Section B 听力篇章 7 题 / Section C 讲话·报道·讲座 10 题 = 25 questions, 30 min, per current official CET-6 structure — https://cet.neea.edu.cn/xhtml1/report/16123/201-1.htm), topic domain tags (campus / lecture / science). Factual data itself is not copyrighted.
- **NOT safe (INFERENCE, MEDIUM):** real question stems, options, and answer keys — these are copyrighted expression. "Metadata" must not smuggle in question text.

#### Can we re-read an official transcript with our own voices?
- **NO (INFERENCE, MEDIUM-HIGH):** The blocker is the text, not the voice. Recording a NEEA script with TTS or a new narrator is still reproducing/deriving the copyrighted script and making it available to the public. New voice = new performance over the same underlying work; permission from the script rights holder (NEEA) is still required. This approach only works if the script text is self-written (mock/high-fidelity imitation).

#### TTS commercial licensing (for self-written scripts)

| Provider | Commercial redistribution of output | Evidence Basis (source nature) | Source URL |
|---|---|---|---|
| **Azure Speech TTS** | Paid tier (S0) with prebuilt neural voices: output may be used commercially; **you must own rights to input text**. Free tier not for production output. | Community Q&A (Microsoft Learn answers) + pricing page — NOT binding service terms | https://learn.microsoft.com/en-in/answers/questions/5987029/can-audio-generated-with-azure-text-to-speech-be-p ; https://azure.microsoft.com/da-dk/pricing/details/speech/ |
| **AWS Polly** | Explicitly: store output as MP3/OGG "for redistribution, analysis, archiving, or any other use case at no extra cost"; pay-as-you-go. | Official product page + official FAQ (FAQ-level, not the binding AWS Service Terms) | https://aws.amazon.com/polly/ ; https://aws.amazon.com/polly/faqs/ |
| **Google Cloud TTS** | Generated audio usable in apps/media in compliance with GCP ToS; **no attribution required**; may not be used to build competing TTS. | Community forum discussions (discuss.google.dev) — NOT binding service terms | https://discuss.google.dev/t/commercial-use/128101/2 ; https://discuss.google.dev/t/text-to-speech-api-license/187973/2 |

**FACT (evidence quality downgraded, Phase 2A.1):** The above sources indicate all three major providers permit commercial use of output conditioned on the user owning input-text rights — but the evidence is drawn from FAQs, pricing pages, and community Q&A/forum answers, **not from the providers' binding, current service terms**. Evidence quality for provider TTS licensing = **MEDIUM / NEEDS FINAL TERMS CHECK** (not HIGH). When Phase 2B actually selects a TTS provider, the following must be re-verified against official current terms: commercial use, output redistribution, attribution, voice-specific restrictions, synthetic-voice restrictions, input-text rights, and the terms' effective date. No provider is selected and no audio is generated in this phase.

#### Professional voice-over licensing models
- **FACT:** Standard models: (i) buyout/flat buyout — one-time fee, perpetual, all-territory/all-media; common in e-learning; (ii) term-limited license — channel/territory/duration specified; (iii) residuals/royalties — per-broadcast fees, typical of unionized TV/radio. Key dimensions: medium, territory, term, exclusivity. (Sources: https://flyvoiceovers.com/blog/voice-over-rights-usage-licences-explained-guide-for-brands ; https://audioscene.org/article/best-practices-for-licensing-voiceover-content-for-marketing-use/ ; https://www.votrainer.com/blog/voiceover-buyouts-and-usage-rights-explained-simply)
- **INFERENCE:** For an educational app, a non-union buyout covering "commercial mobile app use, worldwide, perpetual" is the clean structure; contract must be written and explicitly cover digital distribution.

#### Architectural separation feasibility
- **FACT (design feasibility):** Content model can split `item.script_text_id` from `item.audio_asset_id`. The script and audio are independent assets with independent rights states; the player joins them at runtime.
- **INFERENCE:** This architecture lets you mix: (a) self-written scripts + self-made TTS/voice-over audio (PUBLISHABLE), (b) official structural metadata (PUBLISHABLE), and (c) real past-paper assets held only in staging/reference (never shipped). It does NOT let you ship real scripts with self-made audio.

#### Precedent
- **INFERENCE (LOW-MEDIUM):** The mainstream pattern in Chinese test-prep apps is self-authored mock content with self-produced audio; no public precedent found of an app lawfully re-voicing real CET scripts without NEEA written permission. Publisher-licensed apps (新东方, 星火) pay for rights as part of book products — a commercial licensing channel exists in principle but no evidence of it being offered to indie app developers.

### 7.6 Listening rights verdicts

| Asset | Source Class | Verdict | Evidence Quality |
|---|---|---|---|
| Listening question TEXT (real past papers) | Any third-party | BLOCKED | MEDIUM |
| Listening question TEXT (official 2016 样卷) | NEEA syllabus PDF | BLOCKED for production redistribution | HIGH |
| Listening AUDIO (real past papers) | Any source | BLOCKED | HIGH (terms) / MEDIUM (no license) |
| Listening AUDIO (official sample) | NEEA legacy cet.edu.cn | UNKNOWN (availability unverified; if found, still BLOCKED absent permission) | LOW |
| Listening TRANSCRIPT (real) | Any third-party | BLOCKED (derivative of script + recording; no license) | MEDIUM |
| Listening TRANSCRIPT (official) | Not published | UNKNOWN / n/a | HIGH |
| Question metadata (year, set, section, difficulty tags) | Self-curated facts | PUBLISHABLE (facts not copyrightable; do not embed stems) | MEDIUM |
| Audio for self-written mock scripts via paid Azure/Polly/Google TTS | Self-produced | PUBLISHABLE (vendor commercial-use posture per FAQ/pricing/community sources; input text owned by us) | MEDIUM / NEEDS FINAL TERMS CHECK |
| Audio for self-written scripts via contracted voice-over buyout | Self-produced | PUBLISHABLE (with written buyout contract) | MEDIUM |
| Deep-linking to third-party-hosted real audio | Third-party | BLOCKED (knowing link to likely-infringing source; contributory risk) | MEDIUM |

---

## 8. Production Candidates

**No real CET-6 content source qualifies as a PRODUCTION CANDIDATE.**

The only production-safe content paths are self-authored:

| Candidate | Content Type | Rights Basis | Evidence Quality | Notes |
|---|---|---|---|---|
| **Self-authored high-fidelity mock questions** | Reading, Writing, Translation, Listening (question text) | We own the content; original creation | HIGH | Must be genuinely original, not derived from real papers. High-fidelity = matches structure, difficulty, topic distribution per official spec. |
| **Self-produced listening audio (TTS)** | Listening audio | Azure/AWS/Google commercial-use posture (FAQ/pricing/community sources; final terms TBD in Phase 2B); input text owned by us | MEDIUM / NEEDS FINAL TERMS CHECK | Pay-as-you-go; ~$4–16/1M chars depending on provider/voice tier. Must use self-written scripts. Provider final terms must be re-checked in Phase 2B before selection. |
| **Self-produced listening audio (voice-over buyout)** | Listening audio | Written buyout contract; input text owned by us | MEDIUM | Non-union buyout covering commercial mobile app, worldwide, perpetual. Contract must be written before recording. |
| **Re-authored exam structure / specification** | Exam Structure | Factual conventions re-stated in our own words | MEDIUM | Do not copy official tables verbatim; re-describe timing, weightings, item counts from scratch. |
| **Self-authored editorial explanations** | Answer explanations | We own the content | HIGH | Original analysis written by our editorial team; not copied from 新东方/有道/外研社. |
| **Self-curated question metadata** | Metadata (year, session, form, section, difficulty tags) | Facts are not copyrightable | MEDIUM | Must not embed or reference real question text. Useful for structuring mock content to match real exam distribution. |

**Criteria for PRODUCTION CANDIDATE (none of the real-content sources meet these):**
1. Explicit redistribution permission in writing (license URL / permission document / terms text)
2. Explicit commercial use permission
3. Clear chain of title from the actual rights holder (教育部教育考试院 / 考试委员会)
4. Evidence quality HIGH or MEDIUM (LOW automatically disqualified)
5. Asset-level clearance (not just source-level)

---

## 9. Staging Candidates

Content that is credible/valuable but has insufficient rights for production — may enter staging for manual review and structural reference only.

| Candidate | Source | Content Type | Rights Status | Why Staging | Evidence |
|---|---|---|---|---|---|
| **2016 Syllabus PDF** | SRC-A03 (NEEA) | Test objectives, rubrics, item-type definitions, one CET-6 sample paper | All rights reserved; no reuse license | Useful for structural/rubric fidelity study; sample paper can inform mock-item design but cannot be republished | MEDIUM — https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf |
| **Official exam-structure tables** | SRC-A01 (cet.neea.edu.cn) | CET-6 section list, item counts, weightings, durations | All rights reserved; factual content low-risk | Re-author in own words for production spec; original tables are staging/reference | MEDIUM — https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm |
| **Publisher companion PDFs (外研社)** | SRC-C01 | Real papers + transcripts + answers (2024.06, 2024.12) | Commercial copyrighted publication | Cross-check paper existence, session structure, form counts; do not copy content | HIGH — https://vep.fltrp.com/upload/20250805/e439abb1df734b51a71f64c5170ead68.pdf |
| **Training-institution 真题 pages** | SRC-C02 (新东方), SRC-C03 (有道) | Reconstructed "考生回忆版" papers + own explanations | Their explanations are their IP; question text is committee's | Confirm paper dates, form counts, topic distribution; metadata cross-check only | HIGH — https://cet6.koolearn.com/ ; https://c.youdao.com/ |

**Staging rules:**
- Staging content may be saved for structural validation, metadata extraction, and人工审查.
- Staging content must NEVER be promoted to production without explicit written rights clearance.
- Per Phase 1.1 rights model: `validatePack` allows unknown/permission_required/unverified official material in raw/staging state for structural validation; `rightsIssues(scope="production")` blocks them from production pool.

---

## 10. Reference-only Sources

Sources that may be used for exam-structure verification, metadata research, and人工研究 — but from which no content may be copied.

| Source ID | Name | URL | Reference Use | Why Not Staging/Production |
|---|---|---|---|---|
| SRC-C05 | 星火英语 / 华研外语 (print books) | dangdang.com / jd.com product pages | Confirm which years/sessions have published paper books; understand commercial channel | Paid copyrighted print; no digital rights |
| SRC-D01 | CET通 | https://www.cettong.cn/library/cet6 | Confirm paper existence per year/session/set; count available sets | No license; aggregator of likely-infringing content |
| SRC-D03 | 懒笔记 | https://english-exam.lazynote.cn/cet6 | Confirm 76 sets 2015–2026; reading passage original-source catalog (The Guardian, NYT, etc.) | No license; elaborate aggregator |
| SRC-D02 | WeHUSTER | https://wehuster.com/cet6 | Confirm paper coverage 2019–2026.06 | No license; no operator entity |
| GitHub: YinsinSirius/CET6-Resources | https://github.com/YinsinSirius/CET6-Resources | Confirm 535-star repo exists; papers 2013–2025; no LICENSE | No license; content is committee's |
| GitHub: 123xzw999/cet6-exam-quiz | https://github.com/123xzw999/cet6-exam-quiz | Confirm explicit rights disclaimer; 46 sets 2020–2026; HLS audio links | Repo itself confirms no redistribution rights |

**Reference-only rules:**
- May be browsed to confirm metadata (existence, dates, counts, structure).
- No content (question text, audio, transcripts, answers, explanations) may be downloaded, saved, or reproduced.
- No content from these sources may enter staging or production.

---

## 11. Blocked Sources

All sources that must not enter the product in any form (staging or production).

### 11.1 Content-level blocks (all real CET-6 content from any unlicensed source)

| Blocked Asset | Reason | Evidence |
|---|---|---|
| Real past-paper question text (any source) | NEEA all-rights-reserved; no redistribution license; third-party copies are presumptively unauthorized | HIGH — https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf |
| Real listening audio (any source) | No official audio published; circulating audio is leaked/ripped with no license; highest-risk asset | HIGH/MEDIUM |
| Real listening transcripts (any source) | Derivative of both script copyright and recording producer rights; no license | MEDIUM |
| Real answer keys (any source) | Part of copyrighted exam content; no license | HIGH |
| Third-party explanations (新东方/有道/外研社/懒笔记) | Each asserts own copyright over explanations; copying infringes their IP | HIGH — https://c.youdao.com/article/index.html?pid=598 |
| Reading passages from real papers | Layered copyright: exam committee + original foreign-press publishers (The Guardian, NYT, etc.) | MEDIUM — 懒笔记 passage-source catalog |

### 11.2 Source-level blocks

| Source Category | Examples | Reason |
|---|---|---|
| Free aggregator sites | CET通, WeHUSTER, 懒笔记, catteacher0515 Pages | No license; no operator authority; likely-infringing content |
| GitHub CET-6 content repos | YinsinSirius/CET6-Resources, 123xzw999/cet6-exam-quiz, glh5835 spider, catteacher0515 | No LICENSE or explicit rights disclaimer; code license ≠ content license |
| UGC / social media audio | Bilibili, 抖音, 喜马拉雅, WeChat 公众号 | "禁止转载" tags; private funneling; no rights chain; audio rights especially risky |
| Doc-sharing / cloud drives | book118, Baidu pan packs, Aliyun drive | No redistribution rights; paid/gated; no authority |
| Scraper tools | CSDN PyQt5 scraper, glh5835 spider | Tools that pull from unlicensed sites; using them contributes to infringement |
| Deep-linking to third-party real audio | Any third-party audio host | Knowing link to likely-infringing source; contributory/criminal risk under Chinese law |

---

## 12. Unknown / Needs Permission

Sources or assets where rights status cannot be determined from available evidence and would require direct contact with the rights holder.

| Item | Current Status | What's Needed | Evidence Quality |
|---|---|---|---|
| **Legacy cet.edu.cn sample listening audio** | Referenced in 2016 syllabus PDF preface; domain now serves MHK content; audio availability unverified | Would need to locate if audio still exists anywhere; if found, still BLOCKED absent NEEA written permission | LOW |
| **Uninspected GitHub repos** (xxayt/*CET6*, bedoom/cet-6-pdf, YSP0Github/Cet6-Practice, masher-pp/cet6-real-exam-trainer, XxuCyprus/Eword) | Found via search; not individually inspected; no known LICENSE | Would need inspection, but based on pattern (all CET-6 content repos lack content rights), presumed BLOCKED | LOW |
| **NEEA commercial licensing channel** | No public licensing program found; publishers (外研社/星火) license content for printed books but no evidence of digital/app licensing for indie developers | Would need direct inquiry to 教育部教育考试院 / 全国大学英语四、六级考试委员会 (office at 上海交通大学) | MEDIUM — channel exists in principle for print; unknown for digital/app |
| **Voice performer moral rights** for any commissioned audio | Under 著作权法 Art.39, performers retain moral rights (表明身份) even in work-for-hire | Contract should address performer attribution/waiver; standard in voice-over buyout contracts | MEDIUM |
| **Reading passage underlying foreign-press copyright** | 懒笔记 catalogs 203 reading passages sourced from The Guardian, NYT, etc. Real CET-6 reading passages are adapted from foreign publications | If ever licensing real passages, would need clearance from both NEEA and original publishers | MEDIUM |
| **book118 / individual WeChat 公众号 behind login/gating** | Not deep-inspected behind paywall/login | Would need access, but pattern suggests no license | LOW |

**Permission contact path (if pursued in a future phase):**
- 教育部教育考试院: https://www.neea.edu.cn/
- 全国大学英语四、六级考试委员会: office at 上海交通大学 (https://cet.neea.edu.cn/xhtml1/folder/19081/5123-1.htm)
- Note: Based on the explicit all-rights-reserved clause in the user agreement, a positive response should not be assumed. Any licensing inquiry should be documented and its response recorded as evidence.

---

## 13. First Import Recommendation

**Based on the research findings, no real CET-6 content has sufficient rights evidence for production import. The recommended strategy is a hybrid model.**

### 13.1 First import by content type

| Content Type | Recommended Source | Rights Basis | Action |
|---|---|---|---|
| **Writing** | **Self-authored original high-fidelity mock prompts** | We own the content | Do NOT import real writing prompts. Create original prompts matching CET-6 writing structure (argumentative essay, graph/picture description, practical writing) per official spec. |
| **Listening** | **Self-written scripts + self-produced audio (paid TTS or voice-over buyout)** | TTS vendor commercial terms (final terms TBD in Phase 2B) + we own input text | Do NOT import real listening questions, audio, or transcripts. Create original scripts matching the **current official CET-6 listening structure (25 questions / 30 min): Section A 长对话 8 题 (8%), Section B 听力篇章 7 题 (7%), Section C 讲话/报道/讲座 10 题 (20%)**. Official references: https://cet.neea.edu.cn/xhtml1/report/16123/201-1.htm ; https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm . Generate audio via paid TTS (provider final terms TBD in Phase 2B) or contracted voice-over buyout. |
| **Reading** | **Self-authored original high-fidelity mock passages + questions** | We own the content | Do NOT import real reading passages or questions. Create original passages sourced from public-domain or originally-written material, with question types matching CET-6 (词汇理解, 长篇阅读, 仔细阅读). |
| **Translation** | **Self-authored original high-fidelity mock translation prompts** | We own the content | Do NOT import real translation prompts. Create original Chinese-to-English translation prompts matching CET-6 topic distribution (culture, history, economy, society, development). |

### 13.2 What to use from official sources

| Official Asset | Use | How |
|---|---|---|
| Exam structure / timing / weighting / item counts | **Specification layer** | Re-author in own words; do not copy official tables verbatim. Source: https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm |
| 2016 syllabus test objectives / rubrics | **Specification reference** | Study to ensure mock items match difficulty and rubric fidelity. Source: https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf |
| 2016 syllabus sample paper | **Style/structure reference only** | Study question wording style, passage length, option construction. Do NOT reproduce. |
| Real paper metadata (year, session, form counts) | **Content planning** | Use to plan mock content distribution (how many sets per session, topic distribution). Do NOT embed real question text. |

### 13.3 What NOT to import

- **REAL PAST PAPERS IMPORTED: NO** — No real CET-6 past paper text, questions, reading passages, writing prompts, translation prompts, or answer keys should be imported.
- **REAL CET6 AUDIO COMMITTED: NO** — No real CET-6 listening audio should be committed or bundled.
- **Third-party explanations** — Do not copy explanations from 新东方, 有道, 外研社, 懒笔记, or any other source.
- **Real transcripts** — Do not import real listening transcripts.

### 13.4 Hybrid strategy summary

```
考试结构 (Exam Structure): 官方 specification, re-authored in own words
真实真题 (Real Past Papers): staging / reference only, NEVER production
练习题 (Practice Content): 自研 original high-fidelity mock items
解析 (Explanations): 自研 editorial content, originally written
音频 (Listening Audio): 自制/授权 audio (TTS or voice-over buyout on self-written scripts)
元数据 (Metadata): self-curated facts (year/session/set/structure), no question text
```

---

## 14. Risks

### 14.1 Legal risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Copyright infringement from real CET-6 content** | HIGH | HIGH if real content imported | Do not import real content. NEEA explicitly reserves all rights and prohibits commercial/non-commercial use without permission. (https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf) |
| **Listening audio infringement** | HIGH | HIGH if real audio bundled | No real audio has a redistribution license. Use self-produced audio on self-written scripts only. |
| **Third-party explanation infringement** | MEDIUM | MEDIUM if copied | 新东方/有道 each assert own copyright. Write original editorial explanations. |
| **Reading passage layered copyright** | MEDIUM | MEDIUM if real passages used | Real passages are adapted from foreign publications (The Guardian, NYT, etc.) — layered copyright on top of NEEA rights. Use original/public-domain passages. |
| **Contributory liability from deep-linking** | MEDIUM | LOW-MEDIUM if linking to third-party audio | Chinese law imposes contributory liability for knowing links to infringing content. Do not deep-link to third-party real audio. |
| **TTS input-text rights** | LOW | LOW if using own scripts | All TTS providers require user to own input-text rights. Mitigated by using only self-written scripts. |

### 14.2 Product risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Mock content fidelity gap** | MEDIUM | Use official syllabus + sample paper as specification reference; invest in editorial quality control; calibrate difficulty against official structure tables. |
| **Listening audio quality (TTS)** | MEDIUM | Use neural TTS voices (Azure S0, AWS Polly Neural, Google WaveNet) or professional voice-over buyout; test with users. |
| **Content volume ramp-up** | LOW | Phase content creation; start with one complete mock set, validate, then scale. |
| **Metadata accuracy** | LOW | Cross-reference paper existence/dates across multiple reference sources (publisher listings, training-institution pages); do not rely on single aggregator. |

### 14.3 Process risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Accidental import of real content** | HIGH | Phase 1.1 rights model fail-closed: unknown/permission_required/unverified official material cannot enter production pool. Maintain staging/production separation. |
| **Scope creep into Phase 2B** | MEDIUM | This document is the Phase 2A stop condition. Do not begin content import or development until Phase 2B is explicitly authorized. |
| **GitHub repo license confusion** | MEDIUM | Code MIT/Apache does NOT cover exam content. Always separate code license from content rights. |

---

## 15. Evidence / URLs

### 15.1 Official sources

| Evidence | URL |
|---|---|
| CET information portal homepage | https://cet.neea.edu.cn/ |
| CET-6 exam structure table (考核内容) | https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm |
| CET-6 exam structure (alternate page) | https://cet.neea.edu.cn/xhtml1/report/16123/201-1.htm |
| 考试大纲 listing folder | https://cet.neea.edu.cn/html1/folder/16113/1588-1.htm |
| 2016 revised syllabus PDF (official) | https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf |
| CET committee page (考试委员会) | https://cet.neea.edu.cn/xhtml1/folder/19081/5123-1.htm |
| NEEA User Service Agreement (CET/NCRE/PETS) | https://resource.neea.edu.cn/project/Passport/PublicInfo/CETNCREPETSServicesAgreement.pdf |
| NEEA TOEFL service agreement (same IP clause boilerplate) | https://resource.neea.edu.cn/project/Agreement/TOEFL/ServiceAgreement.html |
| NEEA footer/operator notice | https://www.neea.edu.cn/xhtml1/folder/1509/36-1.htm |
| CET 考试动态 news listing | https://cet.neea.edu.cn/html1/category/16093/1124-1.htm |
| 2026 CET news page | https://cet.neea.edu.cn/xhtml1/report/2609/1-1.htm |
| CET score notice page | https://cet.neea.edu.cn/html1/folder/21083/9970-1.htm |
| CET navigation folder | https://cet.neea.edu.cn/xhtml1/folder/1608/1178-1.htm |
| Syllabus library catalog record (ISBN 9787313146502) | https://www.las.ac.cn/front/book/detail?id=b3547a1378f35574e950ea3184ced025 |

### 15.2 Publisher / training institution sources

| Evidence | URL |
|---|---|
| 外研社 VEP companion PDF (2024 papers) | https://vep.fltrp.com/upload/20250805/e439abb1df734b51a71f64c5170ead68.pdf |
| 外研社 HEP | https://heep.fltrp.com/ |
| 新东方在线 CET6 | https://cet6.koolearn.com/ |
| 新东方 CET4-6 | https://cet4-6.xdf.cn/ |
| 新东方 2025.06 真题 page | https://cet6.koolearn.com/20250609/901413.html |
| 新东方 考生回忆版 article | http://mtoutiao.xdf.cn/cet4-6/202604/15175702.html |
| 有道精品课 copyright notice | https://c.youdao.com/article/index.html?pid=598 |
| 有道考神 | https://ke.youdao.com/ |

### 15.3 Third-party aggregator / GitHub / social sources

| Evidence | URL |
|---|---|
| CET通 library | https://www.cettong.cn/library/cet6 |
| CET通 2025.06 Set1 | https://www.cettong.cn/library/cet6/2025_06_1 |
| WeHUSTER CET6 | https://wehuster.com/cet6 |
| 懒笔记 CET6 | https://english-exam.lazynote.cn/cet6 |
| 懒笔记 listening section | https://english-exam.lazynote.cn/cet6/sections/listening/ |
| catteacher0515 GitHub Pages downloader | https://catteacher0515.github.io/cet6-download |
| YinsinSirius/CET6-Resources (GitHub, 535 stars, no LICENSE) | https://github.com/YinsinSirius/CET6-Resources |
| 123xzw999/cet6-exam-quiz (GitHub, explicit rights disclaimer) | https://github.com/123xzw999/cet6-exam-quiz |
| glh5835/cet6-papers-spider (GitHub) | https://github.com/glh5835/cet6-papers-spider |
| catteacher0515/cet6-download (GitHub repo) | https://github.com/catteacher0515/cet6-download |
| longweihua/english-data-download (Gitee, raw MP3) | https://gitee.com/longweihua/english-data-download |
| Bilibili CET6 listening UGC example | https://www.bilibili.com/video/BV1nfEg6EEYd/ |
| 喜马拉雅 CET6 album example | https://m.ximalaya.com/creation/24841701 |
| 可可英语 CET6 listening search | http://search.kekenet.com/cse/search?q=六级听力 |
| CSDN CET6 scraper blog | https://blog.csdn.net/sgsx11/article/details/121024254 |
| 结网英语网盘 pack | http://www.jwbl.com/html/21/16901.html |
| book118 doc sharing | https://m.book118.com/ |

### 15.4 Legal / licensing references

| Evidence | URL |
|---|---|
| 中华人民共和国著作权法 (2020) | https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm |
| 国家版权局 著作权法 | https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html |
| 北京知产法院 deep-link case (2015)京知民终字第796号 | https://www.chinaiprlaw.cn/index.php?id=4026 |
| 上海知产法院 server standard | http://www.shzcfy.gov.cn/detail.jhtml?id=10006336 |
| 上海普陀法院 criminal deep-link case | http://www.shzcfy.gov.cn/detail.jhtml?id=339270 |
| Azure TTS commercial use Q&A | https://learn.microsoft.com/en-in/answers/questions/5987029/can-audio-generated-with-azure-text-to-speech-be-p |
| Azure Speech pricing | https://azure.microsoft.com/da-dk/pricing/details/speech/ |
| AWS Polly | https://aws.amazon.com/polly/ |
| AWS Polly FAQ | https://aws.amazon.com/polly/faqs/ |
| Google Cloud TTS commercial use | https://discuss.google.dev/t/commercial-use/128101/2 |
| Google Cloud TTS license | https://discuss.google.dev/t/text-to-speech-api-license/187973/2 |
| Voice-over rights licensing guide | https://flyvoiceovers.com/blog/voice-over-rights-usage-licences-explained-guide-for-brands |
| Voice-over licensing best practices | https://audioscene.org/article/best-practices-for-licensing-voiceover-content-for-marketing-use/ |
| Voice-over buyout explanation | https://www.votrainer.com/blog/voiceover-buyouts-and-usage-rights-explained-simply |

---

## 16. Next Phase Recommendation

### 16.1 Phase 2A completion

This document (V13_SOURCE_ACQUISITION_MATRIX.md) completes V13 Phase 2A. The research establishes that:
1. No real CET-6 content source has sufficient rights evidence for production import.
2. The only production-safe path is self-authored content + self-produced audio + re-authored official specification.
3. Real past papers should remain staging/reference-only pending a written license from NEEA (which should not be assumed).

### 16.2 Recommended next steps (for Phase 2B planning, NOT to be executed now)

When Phase 2B is explicitly authorized, recommended priorities:

1. **Specification layer (highest priority):** Encode the official CET-6 exam structure (re-authored in own words) into the content architecture as the canonical specification. This includes section structure, item counts, timing, weightings, difficulty bands, and topic distributions.

2. **First mock set:** Produce one complete original high-fidelity mock CET-6 paper (all sections: Writing, Listening, Reading, Translation) with self-authored content, self-produced listening audio (TTS or voice-over), and self-authored explanations. Validate structure against official spec.

3. **Listening audio pipeline:** Establish the TTS or voice-over production pipeline. If using TTS, select provider and voice tier — **must re-check each provider's official, current service terms first** (commercial use, output redistribution, attribution, voice-specific restrictions, synthetic-voice restrictions, input-text rights, terms effective date; per the Phase 2A.1 evidence downgrade, FAQ/pricing/community sources are NOT sufficient). If using voice-over, draft buyout contract template. Generate audio only for the first mock set's listening section and only on self-written scripts.

4. **Editorial quality control:** Define review process for mock content fidelity (structure, difficulty, topic distribution) and explanation quality.

5. **Staging environment for real content (optional, low priority):** If desired for future research, set up a staging-only area where real paper metadata (not content) can be stored for content-planning purposes. This must be strictly separated from production.

6. **Rights inquiry (optional, long-term):** If there is business interest in eventually licensing real CET-6 content, initiate a formal written inquiry to 教育部教育考试院 / 全国大学英语四、六级考试委员会. Document the inquiry and any response. Based on current evidence, a positive response should not be assumed.

### 16.3 What NOT to do next

- Do NOT begin Phase 2B until explicitly authorized.
- Do NOT import any real CET-6 content.
- Do NOT commit any real CET-6 audio.
- Do NOT modify product code, Prisma, or migrations for content-acquisition purposes.
- Do NOT merge main, create tags, or create releases.
- Do NOT assume that "publicly available" means "redistributable."

---

## Appendix: FACT vs INFERENCE ledger (key conclusions)

| # | Conclusion | Type | Evidence Quality |
|---|---|---|---|
| 1 | NEEA User Service Agreement explicitly prohibits copying, redistribution, commercial/non-commercial use, and derivative works without written permission | FACT | HIGH |
| 2 | Official CET site publishes exam structure and one 2016 syllabus PDF with a CET-6 sample paper; no real sitting papers for 2022–2026 | FACT | HIGH |
| 3 | English sample listening audio referenced in 2016 PDF was hosted at www.cet.edu.cn, which no longer serves CET content | FACT | HIGH |
| 4 | No third-party source surveyed displays an explicit audio/transcript redistribution license | FACT | MEDIUM |
| 5 | YinsinSirius/CET6-Resources (535 stars) has no LICENSE file | FACT | HIGH |
| 6 | 123xzw999/cet6-exam-quiz explicitly attributes copyright to the committee and disclaims redistribution | FACT | HIGH |
| 7 | All three major TTS providers indicate commercial use of output is permitted, conditioned on user owning input-text rights (evidence: FAQs / pricing pages / community Q&A — not binding service terms) | FACT | MEDIUM / NEEDS FINAL TERMS CHECK |
| 8 | Chinese law: deep links ≠ reproduction per server standard, but knowing links to infringing content carry contributory/criminal risk | FACT | HIGH |
| 9 | "Publicly viewable on official website" does not grant redistribution rights; no open license exists anywhere on Tier A | INFERENCE | HIGH |
| 10 | Audio economic rights rest with NEEA/its contractor chain (no public contract found) | INFERENCE | MEDIUM |
| 11 | Circulating third-party "原声" audio derives from leaked publisher-book recordings | INFERENCE | MEDIUM |
| 12 | Re-voicing a real script still infringes script copyright; only self-written scripts are safe with self-made audio | INFERENCE | MEDIUM-HIGH |
| 13 | No OER/CC-licensed CET-6 past papers exist | INFERENCE | HIGH |
| 14 | NEEA commercial licensing for digital/app use is not publicly offered (print licensing exists via publishers) | INFERENCE | MEDIUM |
| 15 | Legacy cet.edu.cn sample audio availability is unverified | UNVERIFIED | LOW |

---

*Document generated: 2026-09-26. Research access date: 2026-09-26. No real exam content, audio, or PDFs were downloaded or reproduced in the preparation of this document. No product code was modified.*

*V13 PHASE 2A RESEARCH COMPLETE*
