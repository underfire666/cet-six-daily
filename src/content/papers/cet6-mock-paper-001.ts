/**
 * V13 Phase 2C: 原创高仿真模拟卷 Paper 001（cet6:mock:paper-001）
 *
 * IDENTITY（V13 Phase 2B.1 强制）：
 * - namespace: MOCK（cet6:mock:paper-001）；authenticity=original；fixture=false；isPartial=false。
 * - examSpecId: cet6-current-2026（显式绑定，冻结当前官方结构）。
 * - 严禁使用 REAL date namespace（cet6:2026-6:set1 等）——那是真实真题的保留空间。
 *
 * CONTENT：
 * - 全部正文由本项目原创编写（project-authored），未复制任何真实历年真题、
 *   未复制第三方解析、未引入真实 CET6 音频。
 * - 结构完整符合 cet6-current-2026：Writing 1 / Listening 25（长对话 8 + 篇章 7 +
 *   讲话·报道·讲座 10）/ Reading 30（选词填空 10 + 长篇阅读 10 + 仔细阅读 10）/
 *   Translation 1，共 57 题/任务。
 * - status=active：V13 Final Acceptance 通过后进入 production 池，暴露给学习页 Selector 与模拟卷入口。
 *
 * Phase 2C.1（editorial revision, contentVersion 1.0.1）：
 * - 独立 Editorial Review 修正答案位置分布（消除 B 偏好与 D 稀少，重排 15 题选项顺序，
 *   题目内容与干扰项语义不变，讲解中选项字母同步更新）。
 * - cloze q5 选项 close→cross，消除 bridge/close 双解。
 * - 文件自 src/content/fixture/ 迁移至 src/content/papers/（fixture/ 仅用于 TEST FIXTURE）。
 *
 * Phase 2D（audio production, 2026-09-28）：3 个音频资产已由豆包语音 TTS 生成（自研 transcript → WAV 分段 → 拼接转码 MP3，public/audio/papers/），
 * asset 元数据含 provider/voice/termsCheckedDate/duration/checksum/sizeBytes；rights 独立记录（generated audio rights ≠ paper rights）。
 *
 * Phase 2D.1（listening structure realignment, contentVersion 1.1.0）：
 * - Listening 从 4 groups（8/7/5/5）重构为官方 CET6 7-material 结构：
 *   2 long conversations（各 4 题）+ 2 passages（4+3 题）+ 3 talks/lectures（4+3+3 题）= 25 题。
 * - 新增 Long Conv #2（campus housing & part-time work）与 Talk #3（microplastics in freshwater），全部 self-authored。
 * - 现有 transcript 拆分/扩展以满足 word count contract（long conv 280–320 / passage 240–260 / talks 总计约 1200）。
 * - 7 个独立 audio asset（一 material 一 asset），deterministic asset IDs。
 * - Audio rights scope hardened：territory=China mainland / allowedUse=product-internal learning playback / restrictions 明确记录。
 * - AI 合成语音标识准备：generated=true + aiDisclosure，供 Phase 2E UI 展示。
 * - stable ID 因 group 重组而变化（long_conversation:g1 保持；passage:g2→g1/g2；lecture:g3/g4→g1/g2/g3），
 *   按 stable ID/contentVersion contract 处理，contentVersion 1.0.1→1.1.0。
 * - Paper 001 仍 staging。
 *
 * 稳定 ID 全部由 cet6:mock:paper-001 确定性派生（extendStableId），无随机/索引 ID。
 */
import { registerContentPack, getContentPack } from "../registry";
import { MOCK_PAPER_001_SOURCE } from "../sources";
import type { ContentPack, ContentRights } from "../types";
import type { CET6Paper, PaperQuestion } from "../papers";
import { extendStableId, mockPaperStableId } from "../stable-id";

export const MOCK_PAPER_001_MOCK_ID = "paper-001";
export const MOCK_PAPER_001_ID = mockPaperStableId(MOCK_PAPER_001_MOCK_ID); // cet6:mock:paper-001
export const MOCK_PAPER_001_PACK_ID = "pack-paper-cet6-mock-001";

const base = MOCK_PAPER_001_ID;
const secWriting = extendStableId(base, "writing");
const secListening = extendStableId(base, "listening");
const secReading = extendStableId(base, "reading");
const secTranslation = extendStableId(base, "translation");

const gWriting = extendStableId(secWriting, "g1");
// V13 Phase 2D.1：官方 CET6 Listening 7-material 结构（2 long conv + 2 passage + 3 talk/lecture）
const gLongConv1 = extendStableId(secListening, "long_conversation", "g1");
const gLongConv2 = extendStableId(secListening, "long_conversation", "g2");
const gPassage1 = extendStableId(secListening, "passage", "g1");
const gPassage2 = extendStableId(secListening, "passage", "g2");
const gTalk1 = extendStableId(secListening, "lecture", "g1");
const gTalk2 = extendStableId(secListening, "lecture", "g2");
const gTalk3 = extendStableId(secListening, "lecture", "g3");
const gCloze = extendStableId(secReading, "cloze", "g1");
const gMatching = extendStableId(secReading, "matching", "g2");
const gCarefulA = extendStableId(secReading, "careful_reading", "g3");
const gCarefulB = extendStableId(secReading, "careful_reading", "g4");
const gTranslation = extendStableId(secTranslation, "g1");

// V13 Phase 2D.1：7 个独立 listening audio asset（一 material 一 asset）
const audioLongConv1 = extendStableId(gLongConv1, "audio1");
const audioLongConv2 = extendStableId(gLongConv2, "audio1");
const audioPassage1 = extendStableId(gPassage1, "audio1");
const audioPassage2 = extendStableId(gPassage2, "audio1");
const audioTalk1 = extendStableId(gTalk1, "audio1");
const audioTalk2 = extendStableId(gTalk2, "audio1");
const audioTalk3 = extendStableId(gTalk3, "audio1");

const q = (group: string, n: number) => extendStableId(group, `q${n}`);
const now = "2026-09-28T00:00:00.000Z";

/** 选择题构造（answerId 即正确项；详细解析内含 whyCorrect / whyWrong，针对具体干扰项）。 */
function choice(
  group: string,
  order: number,
  prompt: string,
  options: { id: string; text: string }[],
  answerId: string,
  shortExplanation: string,
  detailedExplanation: string,
  difficulty?: "easy" | "normal" | "hard",
): PaperQuestion {
  void difficulty;
  return {
    questionId: q(group, order),
    order,
    prompt,
    type: "choice",
    options,
    answerId,
    answerKey: { value: answerId, source: "cet6-mock-paper-001" },
    shortExplanation,
    detailedExplanation,
  };
}

/** 主观/匹配/填空类题构造。 */
function openAnswer(
  group: string,
  order: number,
  prompt: string,
  type: "subjective_writing" | "subjective_translation" | "matching" | "cloze",
  answerText: string,
  shortExplanation: string,
  detailedExplanation: string,
  difficulty?: "easy" | "normal" | "hard",
): PaperQuestion {
  void difficulty;
  // Matching 题需要 A-J 段落选项供 UI 渲染
  const options = type === "matching"
    ? ["A","B","C","D","E","F","G","H","I","J"].map((id) => ({ id, text: "Paragraph " + id }))
    : undefined;
  return {
    questionId: q(group, order),
    order,
    prompt,
    type,
    answerText,
    options,
    answerKey: { value: answerText, source: "cet6-mock-paper-001" },
    shortExplanation,
    detailedExplanation,
  };
}

// ---------------------------------------------------------------- Writing
const writingQuestions: PaperQuestion[] = [
  {
    questionId: q(gWriting, 1),
    order: 1,
    prompt:
      "Write an essay on whether spending a year doing voluntary work before entering university should be encouraged. You should write at least 150 words but no more than 200 words.",
    type: "subjective_writing",
    answerText:
      "A year of voluntary work between school and university, often called a gap year, has become a debated topic. In my view, it should be encouraged, provided that the year is spent productively.\n\nFirst, voluntary work builds maturity. Students who manage real responsibilities—organising activities, cooperating with strangers, meeting deadlines—return to university with stronger time-management and interpersonal skills. Second, it clarifies motivation. A young person who has taught children or helped in a hospital often understands more clearly why they chose their subject and studies with greater purpose.\n\nCritics worry that a year away may weaken academic habits. This is a fair concern, yet it can be addressed by choosing structured programmes with regular feedback. The benefits in confidence and social awareness generally outweigh the temporary pause in formal study.\n\nIn conclusion, I believe a well-planned year of voluntary service deserves encouragement, as it prepares students not only for examinations but for adult life itself.",
    answerKey: { value: "See answerText (reference essay, 150–200 words).", source: "cet6-mock-paper-001" },
    shortExplanation:
      "观点明确（should be encouraged）→ 两个理由（maturity / motivation）→ 让步回应反对意见（academic habits）→ 结论。全文约 200 词，结构完整。",
    detailedExplanation:
      "评分要点（rubric）：1) 内容：立场清晰，理由有展开与例证（responsibilities、teaching children）；2) 结构：引言-主体-让步-结论层次清楚，连接词（First/Second/Critics worry/In conclusion）自然；3) 语言：句式多样（provided that…, A young person who has…），词汇准确（debated topic, clarifies motivation, outweigh）。本题为议论文，不要求唯一答案，只要观点明确、论证充分、语言准确即可；字数 150–200 词。",
  },
];

// ---------------------------------------------------------------- Listening: Long Conversation #1 — Summer Internship (4 questions, ~300 words)
const longConv1Transcript =
  "W: Hi Professor Carter. I saw the list for the summer research internship. I am still comparing two options and I hoped you could help me decide.\n" +
  "M: Emma, welcome. Take a seat. Tell me about the two choices you are weighing.\n" +
  "W: The marine biology lab sounds exciting, because I have always loved fieldwork near the coast. But the project on renewable energy policy is more directly relevant to my major in environmental studies.\n" +
  "M: Both are excellent choices, and either would serve you well. Keep in mind that the marine biology lab requires a solid background in statistics, which you already have from your methods course last semester.\n" +
  "W: That is true. I had forgotten that the statistics requirement works in my favour. Even so, I have always wanted to understand how policy decisions actually shape energy markets. It feels closer to what I want to do after graduation.\n" +
  "M: That is a sensible consideration. Have you checked the workload carefully? The energy policy project involves weekly reports and field interviews with local businesses, which can be demanding for someone who has not done qualitative research before.\n" +
  "W: I have read the syllabus twice. The interviews worry me a little, since I have never done fieldwork of that kind. I am also concerned that the weekly reports might leave little time for my part-time job at the library.\n" +
  "M: That is exactly why it is such a good learning opportunity. The lab runs a two-day training session in May for all new interns, specifically covering interview technique and note-taking. As for the job, many interns arrange a reduced schedule over the summer, and the library is usually flexible with students who have research placements.\n" +
  "W: That is reassuring. Then I will submit my application to the energy policy lab this week. How soon will I know whether I have been accepted?\n" +
  "M: The selection committee meets on the fifteenth of next month. You should receive a formal decision by email by the end of that week. If you are accepted, the project coordinator will contact you about the May training.\n" +
  "W: Great. One last question—does the stipend cover accommodation on campus? I am trying to work out whether I need to find subletting for the summer.\n" +
  "M: The stipend is competitive, and on-campus housing is subsidised for research interns. You should not have trouble covering your basic costs, though you may want to budget carefully if you keep the library job.\n" +
  "W: Perfect. Thank you so much for your time, Professor. I feel much clearer about the decision now.\n" +
  "M: You are very welcome. Good luck with the application, Emma. I hope to see you in the project this summer.";

const longConv1Questions: PaperQuestion[] = [
  choice(
    gLongConv1, 1,
    "What are the two options the student is considering for the summer?",
    [
      { id: "a", text: "A marine biology lab and a renewable energy policy project." },
      { id: "b", text: "Two part-time jobs on campus." },
      { id: "c", text: "A statistics course and a field trip." },
      { id: "d", text: "A teaching post and a summer camp." },
    ],
    "a",
    "The woman says she is comparing the marine biology lab and the renewable energy policy project.",
    "正确答案 A：对话开头女生明确说在两个选择之间犹豫——marine biology lab 与 renewable energy policy project。B 是兼职工作，未提及；C 的统计学课程只是海洋生物实验室的背景要求，不是选项；D 的教学岗位与夏令营在对话中不存在。",
    "easy",
  ),
  choice(
    gLongConv1, 2,
    "What advantage does the student have for the marine biology lab?",
    [
      { id: "a", text: "She has experience with field interviews." },
      { id: "b", text: "She has a background in statistics." },
      { id: "c", text: "She was recommended by a professor." },
      { id: "d", text: "She has published a paper." },
    ],
    "b",
    "The professor notes the marine biology lab requires statistics, which the student has.",
    "正确答案 B：教授说 'the marine biology lab requires a solid background in statistics, which you already have'，即学生具备统计背景。A 的实地采访经验是学生自己担心缺乏的；C 的教授推荐、D 的发表论文均未提及。",
    "easy",
  ),
  choice(
    gLongConv1, 3,
    "Why does the student prefer the energy policy project?",
    [
      { id: "a", text: "It offers a higher stipend." },
      { id: "b", text: "It involves less travel." },
      { id: "c", text: "It was recommended by her classmates." },
      { id: "d", text: "It is closer to her intended career." },
    ],
    "d",
    "She says it feels closer to what she wants to do after graduation.",
    "正确答案 D：女生说该项目 'feels closer to what I want to do after graduation'，即与职业目标更接近。A 的津贴更高未提及（津贴只在下文整体说明）；B 的出行更少、C 的同学推荐都没有出现。",
    "easy",
  ),
  choice(
    gLongConv1, 4,
    "What does the energy policy project involve besides weekly reports?",
    [
      { id: "a", text: "Overnight laboratory sessions." },
      { id: "b", text: "Public presentations every month." },
      { id: "c", text: "Field interviews with local businesses." },
      { id: "d", text: "Statistical modelling of market data only." },
    ],
    "c",
    "The professor mentions weekly reports and field interviews with local businesses.",
    "正确答案 C：教授说项目包含 weekly reports 和 field interviews with local businesses，后者是除周报外的另一项工作。A 的过夜实验、B 的每月公开演示、D 的纯统计建模都与原文不符。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Listening: Long Conversation #2 — Campus Housing & Part-time Work (4 questions, ~300 words)
const longConv2Transcript =
  "W: Excuse me, is this the housing office? I am a new transfer student and I need to arrange accommodation for next semester.\n" +
  "M: Yes, you are in the right place. I am David, the housing coordinator. Have you already submitted an application through the student portal?\n" +
  "W: I tried last week, but the website kept showing an error when I selected my preferences. I was hoping I could sort it out in person. My name is Lin Wei, student number 20268471.\n" +
  "M: Let me pull up your record. Ah, here it is. I can see the application was started but not submitted. The portal has been having intermittent issues with transfer students, so you are not the first person to come in. What kind of room are you looking for?\n" +
  "W: I would prefer a single room if possible, because I need quiet for my evening study sessions. But I am also worried about the cost. I am planning to work part-time at the campus café, and I do not want rent to take up most of my earnings.\n" +
  "M: That is a reasonable concern. Single rooms in the main halls are quite popular and tend to fill quickly. We do have a few singles left in the newer building near the library, but they cost about twenty percent more than a standard shared room.\n" +
  "W: How much is a shared room exactly? And would I be able to choose my roommate, or is that assigned randomly?\n" +
  "M: A standard shared room is three hundred and twenty pounds per semester, including utilities and internet. Roommates are usually assigned based on your lifestyle questionnaire—things like sleep schedule, whether you play music, and whether you have guests overnight. You can also request a specific person if you both agree.\n" +
  "W: That sounds fair. I think a shared room would be more manageable for my budget. Is there a deadline for confirming my choice? I want to talk it over with my parents first.\n" +
  "M: The deadline for housing confirmation is the end of this month. After that, we release unconfirmed rooms to students on the waiting list. I would also suggest applying for the café job as soon as possible, because those positions are allocated on a first-come basis and they fill up quickly.\n" +
  "W: Thank you, David. You have been very helpful. I will come back by Friday with my decision.\n" +
  "M: You are welcome. If you have any more questions before then, just drop by or send an email to housing@university.ac.uk. Good luck with the move, Lin.";

const longConv2Questions: PaperQuestion[] = [
  choice(
    gLongConv2, 1,
    "Why did the student come to the housing office in person?",
    [
      { id: "a", text: "She wanted to complain about her current roommate." },
      { id: "b", text: "The online application portal kept showing an error." },
      { id: "c", text: "She had been assigned the wrong room type." },
      { id: "d", text: "She wanted to apply for a part-time job at the office." },
    ],
    "b",
    "The student says the website kept showing an error when she selected her preferences, so she came in person.",
    "正确答案 B：女生说 'the website kept showing an error when I selected my preferences'，所以亲自来办公室。A 的抱怨室友、C 的被分配错误房型、D 的申请办公室兼职都不是她来的原因。",
    "easy",
  ),
  choice(
    gLongConv2, 2,
    "What is the student's main concern about a single room?",
    [
      { id: "a", text: "It would be too far from the library." },
      { id: "b", text: "She is afraid of being lonely." },
      { id: "c", text: "The cost might take up most of her part-time earnings." },
      { id: "d", text: "Single rooms do not include internet access." },
    ],
    "c",
    "She is worried that rent for a single room would take up most of her earnings from the campus café job.",
    "正确答案 C：女生说 'I do not want rent to take up most of my earnings'，因为她计划在校园咖啡馆兼职。A 的离图书馆太远（实际新楼就在图书馆附近）、B 的怕孤独、D 的不含网络（shared room 含网络，single 也应含）都不是她的主要顾虑。",
    "normal",
  ),
  choice(
    gLongConv2, 3,
    "How are roommates usually assigned in shared rooms?",
    [
      { id: "a", text: "Completely randomly, with no questionnaire." },
      { id: "b", text: "Based on a lifestyle questionnaire, and students can request a specific person." },
      { id: "c", text: "Only by major of study, with no other factors." },
      { id: "d", text: "By seniority, with final-year students choosing first." },
    ],
    "b",
    "Roommates are assigned based on a lifestyle questionnaire, and students can request a specific person if both agree.",
    "正确答案 B：协调员说 'assigned based on your lifestyle questionnaire'，且 'you can also request a specific person if you both agree'。A 的完全随机与原文相反；C 的只按专业、D 的按年级优先都不是分配方式。",
    "normal",
  ),
  choice(
    gLongConv2, 4,
    "What deadline does the coordinator mention for housing confirmation?",
    [
      { id: "a", text: "The end of this month." },
      { id: "b", text: "The end of next week." },
      { id: "c", text: "The first day of next semester." },
      { id: "d", text: "There is no deadline; rooms are held indefinitely." },
    ],
    "a",
    "The deadline for housing confirmation is the end of this month, after which unconfirmed rooms are released to the waiting list.",
    "正确答案 A：协调员明确说 'The deadline for housing confirmation is the end of this month'。B 的下周末、C 的下学期第一天、D 的无截止日期都与原文不符。",
    "easy",
  ),
];

// ---------------------------------------------------------------- Listening: Passage #1 — Sleep & Memory Study (4 questions, ~250 words)
const passage1Transcript =
  "Scientists have long known that sleep helps consolidate memories, but the precise mechanism remained unclear. A recent study at a European university followed one hundred and twenty students during an intensive three-week language course. Half were allowed to nap for ninety minutes after morning classes, while the other half stayed awake doing quiet reading in a separate room. When both groups were tested the next morning, the napping group recalled about twenty percent more vocabulary items, and their scores remained higher when they were retested a full week later.\n" +
  "The researchers attribute the effect to the slow-wave phase of sleep, during which the brain appears to replay newly learned information. Brain scans taken during the naps showed synchronized activity between the hippocampus, which captures new facts, and the prefrontal cortex, which stores them for the long term. Interestingly, the benefit disappeared when participants were woken during slow-wave sleep, suggesting that completing the full sleep cycle matters for durable learning.";

const passage1Questions: PaperQuestion[] = [
  choice(
    gPassage1, 1,
    "How was the recent study on sleep and memory designed?",
    [
      { id: "a", text: "All participants napped for ninety minutes each day." },
      { id: "b", text: "Half napped after morning classes while the other half stayed awake reading." },
      { id: "c", text: "Participants were only tested one week after the course." },
      { id: "d", text: "Participants studied in the evening and slept normally." },
    ],
    "b",
    "The study split students: half napped for ninety minutes, half stayed awake doing quiet reading.",
    "正确答案 B：原文明确 'Half were allowed to nap for ninety minutes after morning classes, while the other half stayed awake doing quiet reading'。A 是全体午睡，错误；C 说只在课后一周测试，实际次日与一周后都测；D 的晚间学习与正常睡眠不是实验设计。",
    "normal",
  ),
  choice(
    gPassage1, 2,
    "What did the napping group achieve in the vocabulary test?",
    [
      { id: "a", text: "They recalled about twenty percent more vocabulary items." },
      { id: "b", text: "They remembered fewer words than the reading group." },
      { id: "c", text: "They showed higher motivation to continue studying." },
      { id: "d", text: "They slept better in the following nights." },
    ],
    "a",
    "The napping group recalled about twenty percent more vocabulary items and kept the advantage a week later.",
    "正确答案 A：原文 'the napping group recalled about twenty percent more vocabulary items'。B 与结果相反；C 的学习动机、D 的后续睡眠质量都不是测试内容。",
    "easy",
  ),
  choice(
    gPassage1, 3,
    "What happens during the slow-wave phase of sleep, according to the researchers?",
    [
      { id: "a", text: "The hippocampus stops processing new information." },
      { id: "b", text: "Memory traces are permanently erased." },
      { id: "c", text: "The brain appears to replay newly learned information." },
      { id: "d", text: "The brain enters a state of complete rest." },
    ],
    "c",
    "During slow-wave sleep the brain appears to replay newly learned information.",
    "正确答案 C：原文 'the brain appears to replay newly learned information' 是研究者对慢波阶段的解释。A 的海马体停止工作、B 的记忆被清除、D 的完全休息都与原文相反或未提及。",
    "normal",
  ),
  choice(
    gPassage1, 4,
    "What did brain scans taken during the naps reveal?",
    [
      { id: "a", text: "Damage in the prefrontal cortex of some students." },
      { id: "b", text: "Faster heartbeat among the reading group." },
      { id: "c", text: "Activity limited to the visual areas of the brain." },
      { id: "d", text: "Synchronized activity between the hippocampus and the prefrontal cortex." },
    ],
    "d",
    "Scans showed synchronized activity between the hippocampus and the prefrontal cortex.",
    "正确答案 D：原文 'scans ... showed synchronized activity between the hippocampus, which captures new facts, and the prefrontal cortex, which stores them for the long term'。A 的损伤、B 的心率、C 的仅视觉区活跃都不在原文。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Listening: Passage #2 — Practical Implications & Limitations (3 questions, ~250 words)
const passage2Transcript =
  "The findings have clear practical implications for learners of all ages. Pulling an all-nighter before an examination may be counterproductive, since sleep deprivation disrupts exactly the neurological process that turns short-term knowledge into durable memory. The authors recommend short, regular naps and consistent sleep schedules rather than last-minute cramming, and they note that even a ninety-minute nap after a study session can produce measurable gains in retention.\n" +
  "At the same time, the researchers are careful not to overstate their conclusions. They caution that the study was relatively small—only one hundred and twenty participants—and that it focused specifically on vocabulary learning in a university setting. Whether the same benefits apply to other kinds of learning, such as mathematical reasoning or motor skills, remains an open question. The long-term effects beyond one week have also not been fully explored, and the researchers call for larger, longitudinal studies before the results can be translated into broad educational policy.";

const passage2Questions: PaperQuestion[] = [
  choice(
    gPassage2, 1,
    "What happened when participants were woken during slow-wave sleep?",
    [
      { id: "a", text: "The memory benefit disappeared." },
      { id: "b", text: "They recalled even more items." },
      { id: "c", text: "They felt more refreshed." },
      { id: "d", text: "The effect became permanent." },
    ],
    "a",
    "The benefit disappeared when participants were woken during slow-wave sleep.",
    "正确答案 A：原文（Passage #1 末尾）'the benefit disappeared when participants were woken during slow-wave sleep'，Passage #2 承接该发现讨论实践意义。B 的回忆更多、C 的更精神、D 的永久化都与原文相反。",
    "normal",
  ),
  choice(
    gPassage2, 2,
    "What do the findings suggest about pulling an all-nighter before an exam?",
    [
      { id: "a", text: "It is effective for short-term recall." },
      { id: "b", text: "It strengthens slow-wave sleep." },
      { id: "c", text: "It is likely counterproductive for memory." },
      { id: "d", text: "It is harmless if done only once." },
    ],
    "c",
    "Sleep deprivation disrupts the process that turns short-term knowledge into durable memory.",
    "正确答案 C：原文 'Pulling an all-nighter before an exam may be counterproductive, since sleep deprivation disrupts exactly the process that turns short-term knowledge into durable memory'。A 的效果好、B 的增强慢波、D 的无害都与原文矛盾。",
    "normal",
  ),
  choice(
    gPassage2, 3,
    "What limitation of the study does the author mention?",
    [
      { id: "a", text: "The participants were all elderly learners." },
      { id: "b", text: "The language course was too short to be meaningful." },
      { id: "c", text: "The brain scans were technically unreliable." },
      { id: "d", text: "The sample was small and long-term effects are unclear." },
    ],
    "d",
    "The authors caution that the study was small and the long-term effects remain to be explored.",
    "正确答案 D：结尾 'the study was relatively small—only one hundred and twenty participants' 且 'The long-term effects beyond one week have also not been fully explored'。A 的老年学习者错误（是 120 名学生）；B 的课程太短、C 的扫描不可靠都不是原文提到的限制。",
    "hard",
  ),
];

// ---------------------------------------------------------------- Listening: Talk #1 — Rooftop Farming (4 questions, ~380 words)
const talk1Transcript =
  "Good afternoon. Today I would like to look at the rise of rooftop farming in dense cities. Over the past decade, rooftop farms have moved from a niche experiment to a visible feature of several Asian and European capitals, from Singapore to Berlin. Three forces explain the trend: rising food prices, growing public interest in food security, and the need to use vacant rooftop space productively in cities where land is extremely expensive.\n" +
  "What do these farms actually contribute? Researchers measured the output of thirty rooftop farms over two growing seasons. They found that a well-managed rooftop plot can supply a meaningful share of fresh vegetables for a small restaurant or a community kitchen, sometimes as much as forty percent of the leafy greens needed during peak season. More importantly, the farms reduce the distance food travels, lowering transport emissions and keeping produce fresher by the time it reaches the plate.\n" +
  "Yet the challenges are real and should not be underestimated. Rooftop farms demand careful engineering from the outset—the roof must bear the combined weight of soil, water, and planters, and drainage must be planned before any soil is laid, because poor drainage can damage the building below. Labour costs are also higher than on conventional farms, because much of the work, from planting to harvesting, is done by hand in spaces that are too small for machinery.\n" +
  "The researchers conclude that rooftop farming is unlikely to replace conventional agriculture or feed an entire city on its own. However, it can play a valuable supporting role, particularly in neighbourhoods where fresh food is expensive or hard to reach, and where residents value the environmental and educational benefits that a visible farm on a rooftop can bring to a community.";

const talk1Questions: PaperQuestion[] = [
  choice(
    gTalk1, 1,
    "What is the main topic of the lecture?",
    [
      { id: "a", text: "The history of urban planning in Asian capitals." },
      { id: "b", text: "The rise of rooftop farming in dense cities." },
      { id: "c", text: "The cost of conventional agriculture." },
      { id: "d", text: "The design of modern skyscrapers." },
    ],
    "b",
    "The lecture examines the rise of rooftop farming and its contributions and challenges.",
    "正确答案 B：整场讲座围绕 rooftop farming 的兴起（three forces）、贡献（contribution）与挑战（challenges）展开。A 的城市规划史、C 的传统农业成本、D 的摩天大楼设计都不是主题。",
    "easy",
  ),
  choice(
    gTalk1, 2,
    "According to the lecture, which force has driven the growth of rooftop farms?",
    [
      { id: "a", text: "A desire to reduce rooftop maintenance costs." },
      { id: "b", text: "Government requirements for building insulation." },
      { id: "c", text: "Rising food prices and concern about food security." },
      { id: "d", text: "The popularity of organic restaurants." },
    ],
    "c",
    "Three forces are cited: rising food prices, food security, and productive use of vacant roofs.",
    "正确答案 C：原文列举 three forces：rising food prices、growing public interest in food security、the need to use vacant rooftop space productively。A 的维护成本降低、B 的建筑保温要求、D 的有机餐厅流行都不是原文原因。",
    "normal",
  ),
  choice(
    gTalk1, 3,
    "What did researchers measure over two growing seasons?",
    [
      { id: "a", text: "The output of thirty rooftop farms." },
      { id: "b", text: "The rainfall on thirty city buildings." },
      { id: "c", text: "The energy use of community kitchens." },
      { id: "d", text: "The prices of vegetables in local markets." },
    ],
    "a",
    "Researchers measured the output of thirty rooftop farms over two growing seasons.",
    "正确答案 A：原文 'Researchers measured the output of thirty rooftop farms over two growing seasons'。B 的降雨量、C 的厨房能耗、D 的市场菜价都不是测量对象。",
    "normal",
  ),
  choice(
    gTalk1, 4,
    "What is mentioned as a challenge for rooftop farming?",
    [
      { id: "a", text: "A shortage of seeds and fertiliser." },
      { id: "b", text: "High labour costs and engineering demands." },
      { id: "c", text: "Competition from imported vegetables." },
      { id: "d", text: "Uncertain weather in winter months." },
    ],
    "b",
    "Rooftop farms demand careful engineering and have higher labour costs.",
    "正确答案 B：原文 challenges 部分说 'demand careful engineering from the outset' 且 'Labour costs are also higher than on conventional farms'。A 的种子肥料短缺、C 的进口竞争、D 的冬季天气都不是原文提到的问题。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Listening: Talk #2 — Loss Aversion (3 questions, ~380 words)
const talk2Transcript =
  "Today we turn to a well-known idea in behavioural economics: loss aversion. In simple terms, people feel the pain of losing something more intensely than the pleasure of gaining the same thing. A classic experiment offers a vivid demonstration. Participants were given a small gift—say a coffee mug—and then asked whether they would trade it for cash. Those who owned a mug typically demanded a price far higher than the price newcomers were willing to pay to buy one. The object had not changed; what changed was simply who held it, and that shift in ownership was enough to alter the perceived value dramatically.\n" +
  "Loss aversion has practical consequences in real markets. Investors often hold on to losing stocks far too long, hoping to avoid admitting a loss, while selling winning stocks too quickly to lock in gains. This behaviour is one reason markets sometimes move more slowly than economic fundamentals would suggest, because participants are not acting as purely rational calculators of expected value.\n" +
  "Framing also matters a great deal. People respond differently to the same information depending on whether it is presented as a gain or as a loss. For example, telling patients that a treatment has a ninety percent success rate produces a different reaction from telling them it has a ten percent failure rate, even though the two statements describe exactly the same underlying facts. The lesson for decision-making is simple but hard to apply in practice: we should evaluate choices by their actual outcomes, not by whether they feel like gains or losses. Being aware of loss aversion does not eliminate it, but it can make us more careful and more consistent in the choices we make.";

const talk2Questions: PaperQuestion[] = [
  choice(
    gTalk2, 1,
    "What does loss aversion refer to?",
    [
      { id: "a", text: "The habit of forgetting past financial losses." },
      { id: "b", text: "Feeling losses more intensely than equivalent gains." },
      { id: "c", text: "Preferring cash gifts over physical objects." },
      { id: "d", text: "A tendency to take greater risks after winning." },
    ],
    "b",
    "People feel the pain of losing more intensely than the pleasure of gaining the same thing.",
    "正确答案 B：原文第一句即定义 'people feel the pain of losing something more intensely than the pleasure of gaining the same thing'。A 的遗忘损失、C 的偏好现金、D 的赢后冒险都不是该概念的定义。",
    "easy",
  ),
  choice(
    gTalk2, 2,
    "What did the classic mug experiment demonstrate?",
    [
      { id: "a", text: "Owners valued the mug far more than buyers were willing to pay." },
      { id: "b", text: "Mugs were more popular than cash among participants." },
      { id: "c", text: "People refused all offers for their possessions." },
      { id: "d", text: "Buyers offered more than the mugs were worth." },
    ],
    "a",
    "Those who owned the mug demanded a far higher price than newcomers would pay.",
    "正确答案 A：原文 'Those who owned a mug typically demanded a price far higher than the price newcomers were willing to pay to buy one'。B 的更喜欢杯子、C 的全部拒绝、D 的买家出价过高都与实验结论相反或无关。",
    "normal",
  ),
  choice(
    gTalk2, 3,
    "How does loss aversion affect investors, according to the lecture?",
    [
      { id: "a", text: "They sell losing stocks early and keep winners." },
      { id: "b", text: "They avoid the stock market altogether." },
      { id: "c", text: "They diversify their portfolios more aggressively." },
      { id: "d", text: "They hold losing stocks too long and sell winners too quickly." },
    ],
    "d",
    "Investors often hold losing stocks too long and sell winning stocks too quickly.",
    "正确答案 D：原文 'Investors often hold on to losing stocks far too long ... while selling winning stocks too quickly to lock in gains'。A 与原文相反；B 的完全回避、C 的激进分散都不是讲座内容。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Listening: Talk #3 — Microplastics in Freshwater (3 questions, ~380 words)
const talk3Transcript =
  "Good morning. Today I want to discuss a growing environmental concern: microplastics in freshwater systems. Microplastics are tiny plastic fragments, generally less than five millimetres across, that come from a variety of sources, including the breakdown of larger plastic waste, synthetic clothing fibres washed down drains, and the microbeads that used to be common in personal care products. While most public attention has focused on ocean plastic, researchers are finding that freshwater rivers and lakes can carry even higher concentrations, because they act as the transport route between land and the sea.\n" +
  "A three-year study of a major European river system found microplastics in every sample taken, from remote mountain streams to densely populated urban sections. The highest concentrations were found near wastewater treatment plants and industrial outlets, suggesting that these are key entry points. The researchers also discovered that a significant proportion of the particles were fibres from synthetic textiles, which are not fully captured by standard treatment processes. This means that even treated wastewater can release large numbers of microplastic fibres into rivers.\n" +
  "The ecological effects are still being mapped, but early findings are concerning. Fish and aquatic invertebrates have been found to ingest microplastics, which can accumulate in their digestive systems and may transfer up the food chain. There is also evidence that microplastics can absorb and carry harmful chemical pollutants, potentially concentrating them in organisms. The researchers argue that addressing the problem requires action at the source—reducing single-use plastics, improving wastewater treatment technology, and designing textiles that shed fewer fibres—rather than relying on cleanup alone, which is unlikely to be effective at the scale of the problem.";

const talk3Questions: PaperQuestion[] = [
  choice(
    gTalk3, 1,
    "According to the lecture, why can freshwater rivers carry higher microplastic concentrations than the ocean?",
    [
      { id: "a", text: "Because rivers are colder and plastics break down more slowly." },
      { id: "b", text: "Because rivers act as the transport route between land and the sea." },
      { id: "c", text: "Because ocean currents quickly dilute plastic particles." },
      { id: "d", text: "Because freshwater fish consume more microplastics." },
    ],
    "b",
    "Freshwater rivers and lakes can carry higher concentrations because they act as the transport route between land and the sea.",
    "正确答案 B：原文 'freshwater rivers and lakes can carry even higher concentrations, because they act as the transport route between land and the sea'。A 的水温、C 的洋流稀释、D 的淡水鱼消耗都不是原文给出的原因。",
    "normal",
  ),
  choice(
    gTalk3, 2,
    "Where were the highest microplastic concentrations found in the European river study?",
    [
      { id: "a", text: "In remote mountain streams far from human activity." },
      { id: "b", text: "Near wastewater treatment plants and industrial outlets." },
      { id: "c", text: "At the mouth of the river where it meets the sea." },
      { id: "d", text: "In deep, slow-moving sections of the river." },
    ],
    "b",
    "The highest concentrations were found near wastewater treatment plants and industrial outlets.",
    "正确答案 B：原文 'The highest concentrations were found near wastewater treatment plants and industrial outlets, suggesting that these are key entry points'。A 的偏远溪流（虽然每个样本都有，但浓度不是最高）、C 的入海口、D 的深缓流段都不是原文指出的最高浓度位置。",
    "normal",
  ),
  choice(
    gTalk3, 3,
    "What solution do the researchers emphasise for addressing microplastic pollution?",
    [
      { id: "a", text: "Relying on large-scale river cleanup projects." },
      { id: "b", text: "Banning all plastic products immediately." },
      { id: "c", text: "Action at the source, including reducing single-use plastics and improving wastewater treatment." },
      { id: "d", text: "Stocking rivers with fish that eat microplastics." },
    ],
    "c",
    "The researchers argue for action at the source rather than relying on cleanup alone.",
    "正确答案 C：原文 'addressing the problem requires action at the source—reducing single-use plastics, improving wastewater treatment technology, and designing textiles that shed fewer fibres—rather than relying on cleanup alone'。A 的仅靠清理与原文相反；B 的立即禁止所有塑料过于绝对；D 的投放吃微塑料的鱼未提及。",
    "hard",
  ),
];

// ---------------------------------------------------------------- Reading: Cloze (10)
const clozePassage =
  "Public libraries are quietly reinventing themselves for the digital age. Once (1) ______ as quiet storage rooms for printed books, they now offer e-books, online courses, and free computer access. The change has been driven partly by falling (2) ______ of printed books and partly by a growing demand for digital skills. In many cities, libraries have become community (3) ______ where residents attend job-search workshops and coding classes. However, librarians warn that funding has not (4) ______ with the expansion of services. Many branches still operate with limited staff and outdated equipment. To (5) ______ the gap, some libraries have formed partnerships with local businesses and universities, sharing resources and (6) ______ new programmes together. Researchers argue that such cooperation is (7) ______ if libraries are to remain relevant. They also point out that digital access alone is not (8) ______. A library's real value lies in the human support it provides—staff who help a first-time user create an email account or a teenager prepare for an interview. In this sense, the library is not disappearing; it is (9) ______ its role. The challenge ahead is to (10) ______ that this transformation reaches every neighbourhood, not just wealthy ones.";

const clozeQuestions: PaperQuestion[] = [
  choice(
    gCloze, 1,
    "Choose the best word for blank (1).",
    [
      { id: "a", text: "viewed" },
      { id: "b", text: "forgotten" },
      { id: "c", text: "renamed" },
      { id: "d", text: "designed" },
    ],
    "a",
    "'Once viewed as quiet storage rooms' fits the passive structure describing the past image of libraries.",
    "正确答案 A：'Once viewed as ...' 意为“曾被看作”，与 'quiet storage rooms' 搭配符合被动语态与语义。B 'forgotten as' 搭配不当；C 'renamed as' 表示改名，语义不符；D 'designed as' 与后文 'now offer' 的对比不成立。",
    "normal",
  ),
  choice(
    gCloze, 2,
    "Choose the best word for blank (2).",
    [
      { id: "a", text: "quality" },
      { id: "b", text: "prices" },
      { id: "c", text: "variety" },
      { id: "d", text: "sales" },
    ],
    "d",
    "'Falling sales of printed books' is the natural collocation describing declining demand.",
    "正确答案 D：'falling sales of printed books'（纸质书销量下降）是驱动转型的经济因素。A 'quality' 不参与销量变化语境；B 'prices' 与 'falling' 也可搭配但上下文强调的是销量与需求（growing demand）；C 'variety' 语义不通。",
    "hard",
  ),
  choice(
    gCloze, 3,
    "Choose the best word for blank (3).",
    [
      { id: "a", text: "hubs" },
      { id: "b", text: "branches" },
      { id: "c", text: "offices" },
      { id: "d", text: "stores" },
    ],
    "a",
    "'Community hubs' means central places of activity, matching the workshop and class examples.",
    "正确答案 A：'community hubs'（社区活动中心）最能概括后文举办求职工作坊和编程课的功能。B 'branches' 指图书馆分馆，是地点而非功能定位；C 'offices'、D 'stores' 语义不符。",
    "normal",
  ),
  choice(
    gCloze, 4,
    "Choose the best word for blank (4).",
    [
      { id: "a", text: "competed" },
      { id: "b", text: "kept up" },
      { id: "c", text: "agreed" },
      { id: "d", text: "combined" },
    ],
    "b",
    "'Funding has not kept up with the expansion' means funding has not increased as fast as services.",
    "正确答案 B：'has not kept up with'（跟不上）表示资金增长未与服务扩展同步。A 'competed with' 语义错误；C 'agreed with'、D 'combined with' 都不符合“资金滞后”的语境。",
    "normal",
  ),
  choice(
    gCloze, 5,
    "Choose the best word for blank (5).",
    [
      { id: "a", text: "bridge" },
      { id: "b", text: "cross" },
      { id: "c", text: "widen" },
      { id: "d", text: "measure" },
    ],
    "a",
    "'Bridge the gap' is a fixed collocation meaning to reduce the difference.",
    "正确答案 A：'bridge the gap'（弥合差距）是固定搭配，指通过合作弥补资金与服务之间的缺口。B 'cross the gap' 搭配不当；C 'widen the gap' 与目的相反；D 'measure' 不搭配。",
    "hard",
  ),
  choice(
    gCloze, 6,
    "Choose the best word for blank (6).",
    [
      { id: "a", text: "splitting" },
      { id: "b", text: "delaying" },
      { id: "c", text: "reducing" },
      { id: "d", text: "developing" },
    ],
    "d",
    "'Sharing resources and developing new programmes together' describes partnership activities.",
    "正确答案 D：'developing new programmes together'（共同开发新项目）与 'sharing resources' 并列，都是合作内容。A 'splitting' 与 'programmes' 搭配怪异；B 'delaying'、C 'reducing' 语义与合作的积极方向矛盾。",
    "normal",
  ),
  choice(
    gCloze, 7,
    "Choose the best word for blank (7).",
    [
      { id: "a", text: "optional" },
      { id: "b", text: "expensive" },
      { id: "c", text: "essential" },
      { id: "d", text: "temporary" },
    ],
    "c",
    "'Such cooperation is essential if libraries are to remain relevant' — necessary condition.",
    "正确答案 C：'essential'（至关重要的）表达“合作是图书馆保持相关性的必要条件”。A 'optional'（可选）与 'if ... are to remain relevant' 的逻辑矛盾；B 'expensive'、D 'temporary' 语义不通。",
    "normal",
  ),
  choice(
    gCloze, 8,
    "Choose the best word for blank (8).",
    [
      { id: "a", text: "available" },
      { id: "b", text: "affordable" },
      { id: "c", text: "sufficient" },
      { id: "d", text: "popular" },
    ],
    "c",
    "'Digital access alone is not sufficient' — the following sentence explains human support is also needed.",
    "正确答案 C：'not sufficient'（不够）与下文 'A library's real value lies in the human support' 构成“仅有数字接入还不够”的递进。A 'available'（可用）、B 'affordable'（可负担）、D 'popular'（受欢迎）都不表达“足够”之意。",
    "normal",
  ),
  choice(
    gCloze, 9,
    "Choose the best word for blank (9).",
    [
      { id: "a", text: "abandoning" },
      { id: "b", text: "expanding" },
      { id: "c", text: "forgetting" },
      { id: "d", text: "dividing" },
    ],
    "b",
    "'It is expanding its role' means libraries are growing into new functions rather than disappearing.",
    "正确答案 B：'expanding its role'（扩展其角色）与 'not disappearing' 形成呼应，说明图书馆在转型而非消失。A 'abandoning its role'（放弃）与主旨相反；C 'forgetting'、D 'dividing' 语义不通。",
    "normal",
  ),
  choice(
    gCloze, 10,
    "Choose the best word for blank (10).",
    [
      { id: "a", text: "ensure" },
      { id: "b", text: "pretend" },
      { id: "c", text: "doubt" },
      { id: "d", text: "ignore" },
    ],
    "a",
    "'The challenge is to ensure that this transformation reaches every neighbourhood' — guarantee.",
    "正确答案 A：'ensure'（确保）表达挑战目标——让转型惠及每个社区。B 'pretend'（假装）、C 'doubt'（怀疑）、D 'ignore'（忽视）都与“挑战在于实现”的语义相反。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Reading: Matching (10)
const matchingPassage =
  "How some cities are becoming friendlier to bicycles\n" +
  "A. Copenhagen did not become a cycling city overnight. Its success rests on decades of steady investment in separated cycle lanes, traffic-light timing that favours cyclists, and a culture in which riding to work is completely ordinary. Politicians of different parties have supported the policy, which has survived changes of government.\n" +
  "B. Seville, in southern Spain, transformed its streets in a remarkably short time. In the late 2000s the city built a network of protected lanes within a few years, and cycling trips grew rapidly. The climate, with mild winters and limited rain, made year-round cycling practical.\n" +
  "C. Amsterdam's approach is unusual because it treats cycling not as a special activity but as a default way of moving. Children learn to ride on the streets, and parking for bicycles is provided as generously as parking for cars elsewhere. The density of the old city centre, with its narrow streets, makes cycling an efficient choice.\n" +
  "D. Electric bicycles have changed the picture in hilly cities. In San Francisco, where steep slopes once discouraged commuting by bike, e-bikes have made daily rides possible for people of different fitness levels. Manufacturers report strong growth in sales to commuters aged over fifty.\n" +
  "E. Safety is often the deciding factor for potential cyclists. Surveys in several European capitals show that the single largest barrier to cycling is fear of traffic, not distance or weather. Where separated lanes exist, the share of women and older adults cycling rises noticeably.\n" +
  "F. Bogotá's famous ciclovía programme closes major streets to cars every Sunday and holiday, opening them to cyclists and walkers. The event began as a small experiment and now attracts millions of participants a year, helping residents experience the city without engines.\n" +
  "G. Car-sharing schemes have an unexpected side effect. Studies in Berlin found that households which joined a car-sharing service tended to cycle more, because they no longer felt they had to justify the cost of car ownership by using it daily. Owning a car, it seems, encourages driving it.\n" +
  "H. Workplace facilities matter more than one might think. Companies that provide secure bicycle parking, showers, and repair tools report substantially higher rates of cycling among employees. In Japan, some firms even offer small financial incentives for staff who cycle to work.\n" +
  "I. Public awareness campaigns have limited value on their own, researchers caution. Posters urging people to cycle achieve little unless the infrastructure is already safe. Conversely, when safe routes exist, behaviour changes quickly without any need for persuasion.\n" +
  "J. The financial argument is increasingly persuasive. Studies comparing transport costs find that cycling saves individuals significant sums each year once car purchase, fuel, parking, and insurance are counted. Several cities now include cycling infrastructure in their public health budgets, on the grounds that it reduces healthcare costs.";

const matchingQuestions: PaperQuestion[] = [
  openAnswer(gMatching, 1, "Which paragraph says that fear of traffic, rather than distance or weather, is the main barrier to cycling?", "matching", "E", "Paragraph E reports surveys showing fear of traffic is the largest barrier.", "正确答案 E：E 段 'the single largest barrier to cycling is fear of traffic, not distance or weather'。其余段落分别讲长期投资（A）、快速建设（B）、默认出行方式（C）、电动车（D）、星期天封路（F）、共享汽车（G）、单位设施（H）、宣传活动（I）、经济账（J）。"),
  openAnswer(gMatching, 2, "Which paragraph explains how a Sunday street-closing programme helped residents experience their city?", "matching", "F", "Paragraph F describes Bogotá's ciclovía programme that closes streets to cars on Sundays.", "正确答案 F：F 段介绍波哥大的 ciclovía——周日和节假日把主要街道对汽车关闭、向骑车人开放。B 段虽也讲塞维利亚但内容是建车道；其余段无此内容。"),
  openAnswer(gMatching, 3, "Which paragraph mentions that political support for cycling policy continued across different governments?", "matching", "A", "Paragraph A says the cycling policy has survived changes of government.", "正确答案 A：A 段 'Politicians of different parties have supported the policy, which has survived changes of government'。其余段落未提及跨党派、跨届政府支持。"),
  openAnswer(gMatching, 4, "Which paragraph suggests that owning a car may encourage people to drive it more?", "matching", "G", "Paragraph G discusses car-sharing and the finding that ownership encourages daily use.", "正确答案 G：G 段 'Owning a car, it seems, encourages driving it'，并提到加入共享汽车服务的家庭骑车更多。"),
  openAnswer(gMatching, 5, "Which paragraph describes how e-bikes helped overcome the obstacle of steep hills?", "matching", "D", "Paragraph D discusses electric bicycles in hilly San Francisco.", "正确答案 D：D 段 'In San Francisco, where steep slopes once discouraged commuting by bike, e-bikes have made daily rides possible'。"),
  openAnswer(gMatching, 6, "Which paragraph says that persuasion campaigns achieve little unless infrastructure is safe?", "matching", "I", "Paragraph I argues posters urging cycling have limited value without safe routes.", "正确答案 I：I 段 'Public awareness campaigns have limited value on their own... Posters urging people to cycle achieve little unless the infrastructure is already safe'。"),
  openAnswer(gMatching, 7, "Which paragraph cites financial savings and public health budgets as arguments for cycling?", "matching", "J", "Paragraph J presents the financial argument and health-budget reasoning.", "正确答案 J：J 段 'cycling saves individuals significant sums each year'，并提到一些城市把骑行设施纳入公共卫生预算。"),
  openAnswer(gMatching, 8, "Which paragraph says cycling is treated as the default way of moving rather than a special activity?", "matching", "C", "Paragraph C describes Amsterdam treating cycling as a default mode of transport.", "正确答案 C：C 段 'it treats cycling not as a special activity but as a default way of moving'。"),
  openAnswer(gMatching, 9, "Which paragraph mentions that workplace facilities such as showers and repair tools increase cycling rates?", "matching", "H", "Paragraph H discusses workplace facilities and their effect on cycling rates.", "正确答案 H：H 段 'Companies that provide secure bicycle parking, showers, and repair tools report substantially higher rates of cycling among employees'。"),
  openAnswer(gMatching, 10, "Which paragraph reports that a city built its cycling network in only a few years?", "matching", "B", "Paragraph B describes Seville building a network of protected lanes in a short time.", "正确答案 B：B 段 'the city built a network of protected lanes within a few years, and cycling trips grew rapidly'。"),
];

// ---------------------------------------------------------------- Reading: Careful Reading A — 远程医疗 (5)
const carefulAPassage =
  "Telehealth, the delivery of medical services through digital communication, has moved from a convenience to a necessity in many rural regions. In areas where the nearest specialist is hours away, a video consultation can mean the difference between early treatment and a missed diagnosis.\n" +
  "A programme in western China connected township clinics with provincial hospitals, allowing local doctors to share scans and seek advice in real time. Over two years, the programme reduced the average time to diagnosis for patients with suspicious chest symptoms from eleven days to three. It also lowered the number of unnecessary transfers, because specialists could confirm that many cases could be managed locally.\n" +
  "Yet the technology is not a perfect substitute for face-to-face care. Physical examination remains limited, and some patients, particularly the elderly, struggle with the devices. The programme found that the benefits depended heavily on training: clinics that assigned a dedicated coordinator, someone who helped patients log in and explained how to describe their symptoms, saw far better outcomes.\n" +
  "The authors caution that telehealth should be seen as a complement to, rather than a replacement for, a well-staffed local health system. In places where the clinic itself is understaffed, video links alone cannot fill the gap.";

const carefulAQuestions: PaperQuestion[] = [
  choice(
    gCarefulA, 1,
    "What is the main point of the passage?",
    [
      { id: "a", text: "Telehealth has become essential in rural areas but cannot replace local health systems." },
      { id: "b", text: "Video consultations are always better than face-to-face visits." },
      { id: "c", text: "Rural clinics should be closed and replaced by provincial hospitals." },
      { id: "d", text: "Telehealth is mainly useful for wealthy urban patients." },
    ],
    "a",
    "The passage shows telehealth's value in rural areas and cautions that it complements rather than replaces local systems.",
    "正确答案 A：全文先讲远程医疗在乡村的必要性与成效，结尾明确 'should be seen as a complement to, rather than a replacement for' 本地医疗体系。B 的“总是更好”绝对化且与 'not a perfect substitute' 矛盾；C 的关闭乡村诊所、D 的只对城市富人有用都与原文相反。",
    "hard",
  ),
  choice(
    gCarefulA, 2,
    "What did the programme in western China achieve?",
    [
      { id: "a", text: "It doubled the number of patients transferred to provincial hospitals." },
      { id: "b", text: "It cut the time to diagnosis for suspicious chest symptoms from eleven days to three." },
      { id: "c", text: "It eliminated the need for physical examinations." },
      { id: "d", text: "It reduced staffing in township clinics." },
    ],
    "b",
    "The programme reduced average time to diagnosis from eleven days to three and lowered unnecessary transfers.",
    "正确答案 B：原文 'reduced the average time to diagnosis ... from eleven days to three'。A 的转诊翻倍与 'lowered the number of unnecessary transfers' 相反；C 的取消体检、D 的减少人员都不在原文。",
    "normal",
  ),
  choice(
    gCarefulA, 3,
    "Why did some patients struggle with the technology?",
    [
      { id: "a", text: "The video quality was poor in remote areas." },
      { id: "b", text: "The clinics charged extra for video consultations." },
      { id: "c", text: "Doctors refused to use the new equipment." },
      { id: "d", text: "Elderly patients, in particular, found the devices difficult." },
    ],
    "d",
    "The passage says some patients, particularly the elderly, struggle with the devices.",
    "正确答案 D：原文 'some patients, particularly the elderly, struggle with the devices'。A 的视频质量、B 的额外收费、C 的医生拒绝使用都不是原文提到的困难。",
    "easy",
  ),
  choice(
    gCarefulA, 4,
    "What factor determined how well the programme worked?",
    [
      { id: "a", text: "The size of the provincial hospital." },
      { id: "b", text: "The brand of the video equipment." },
      { id: "c", text: "A dedicated coordinator who helped patients use the system." },
      { id: "d", text: "The distance between the clinic and the city." },
    ],
    "c",
    "Clinics with a dedicated coordinator saw far better outcomes.",
    "正确答案 C：原文 'clinics that assigned a dedicated coordinator ... saw far better outcomes'。A 的省级医院规模、B 的设备品牌、D 的距离都不是决定因素。",
    "normal",
  ),
  choice(
    gCarefulA, 5,
    "What does the author say about understaffed clinics?",
    [
      { id: "a", text: "Video links alone cannot fill the gap." },
      { id: "b", text: "They should rely entirely on telehealth." },
      { id: "c", text: "They should close their emergency rooms." },
      { id: "d", text: "They benefit most from newer equipment." },
    ],
    "a",
    "In understaffed clinics, video links alone cannot fill the gap.",
    "正确答案 A：结尾 'In places where the clinic itself is understaffed, video links alone cannot fill the gap'。B 的完全依赖远程医疗、C 的关闭急诊、D 的更新设备都不是原文观点。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Reading: Careful Reading B — 传统手工艺 (5)
const carefulBPassage =
  "The revival of traditional crafts is one of the quieter success stories of recent years. Rather than being preserved only in museums, skills such as wood carving, paper-making, and indigo dyeing are finding new life in workshops and small studios, often among designers under thirty.\n" +
  "What attracts young makers is not nostalgia alone. Many are drawn by the contrast between handmade objects and mass-produced ones: each piece carries the trace of a person's hands and the story of a particular place. Consumers, for their part, have shown a growing willingness to pay more for products with a clear provenance.\n" +
  "Yet the revival faces a practical obstacle. The most valuable techniques are passed down orally, from master to apprentice, and the chain is easily broken. A studio in Jiangnan spent three years reconstructing a single dyeing process from old photographs and written fragments, only to discover that the crucial step had been a matter of the dyer's judgement under particular weather conditions.\n" +
  "Educators argue that the solution lies in combining tradition with formal training. If craft knowledge can be documented systematically—recorded, tested, and taught in vocational schools—it may survive the loss of individual masters. The goal is not to freeze crafts in their old forms but to give them enough structure to evolve.";

const carefulBQuestions: PaperQuestion[] = [
  choice(
    gCarefulB, 1,
    "What is the passage mainly about?",
    [
      { id: "a", text: "The decline of mass production in modern economies." },
      { id: "b", text: "The history of indigo dyeing in Jiangnan." },
      { id: "c", text: "The tourism value of museum exhibitions." },
      { id: "d", text: "The revival of traditional crafts and the challenges it faces." },
    ],
    "d",
    "The passage describes crafts finding new life and the obstacle of oral-only transmission.",
    "正确答案 D：全文围绕传统手工艺复兴（revival）与挑战（oral transmission、documentation）展开。A 的大规模生产衰落不是主题；B 的靛蓝染色史只是例子；C 的博物馆旅游价值未提及。",
    "hard",
  ),
  choice(
    gCarefulB, 2,
    "What attracts young makers to traditional crafts, according to the passage?",
    [
      { id: "a", text: "The promise of high salaries." },
      { id: "b", text: "The contrast between handmade and mass-produced objects." },
      { id: "c", text: "Government subsidies for small studios." },
      { id: "d", text: "The popularity of antique collecting." },
    ],
    "b",
    "Young makers are drawn by the contrast between handmade objects and mass-produced ones.",
    "正确答案 B：原文 'Many are drawn by the contrast between handmade objects and mass-produced ones'。A 的高薪、C 的政府补贴、D 的收藏热都不是原文原因。",
    "normal",
  ),
  choice(
    gCarefulB, 3,
    "What is described as the practical obstacle to the revival?",
    [
      { id: "a", text: "The high cost of raw materials." },
      { id: "b", text: "A lack of consumer interest." },
      { id: "c", text: "Techniques are passed down orally and the chain is easily broken." },
      { id: "d", text: "The competition from imported crafts." },
    ],
    "c",
    "The most valuable techniques are passed down orally from master to apprentice, and the chain is easily broken.",
    "正确答案 C：原文 'The most valuable techniques are passed down orally, from master to apprentice, and the chain is easily broken'。A 的原料成本、B 的消费者兴趣缺乏、D 的进口竞争都不是障碍。",
    "normal",
  ),
  choice(
    gCarefulB, 4,
    "What happened when a studio in Jiangnan tried to reconstruct a dyeing process?",
    [
      { id: "a", text: "They found the process documented fully in old textbooks." },
      { id: "b", text: "They completed it in a few months with the help of a master." },
      { id: "c", text: "They discovered the crucial step depended on the dyer's judgement in specific weather." },
      { id: "d", text: "They gave up and turned to modern synthetic dyes." },
    ],
    "c",
    "The crucial step had been a matter of the dyer's judgement under particular weather conditions.",
    "正确答案 C：原文 'the crucial step had been a matter of the dyer's judgement under particular weather conditions'。A 的教科书完整记录、B 的几个月完成、D 的放弃改用合成染料都与原文不符。",
    "normal",
  ),
  choice(
    gCarefulB, 5,
    "What solution do educators propose?",
    [
      { id: "a", text: "Documenting craft knowledge and teaching it in vocational schools." },
      { id: "b", text: "Preserving crafts exactly in their old forms." },
      { id: "c", text: "Restricting craft production to museums." },
      { id: "d", text: "Discouraging young people from learning crafts." },
    ],
    "a",
    "Educators argue for documenting craft knowledge systematically and teaching it in vocational schools.",
    "正确答案 A：结尾 'If craft knowledge can be documented systematically—recorded, tested, and taught in vocational schools—it may survive'。B 的保持原样与 'not to freeze crafts in their old forms' 矛盾；C 的限于博物馆、D 的阻止年轻人学习都与主旨相反。",
    "normal",
  ),
];

// ---------------------------------------------------------------- Translation
const translationPrompt =
  "近年来，中国的许多城市出现了越来越多的公共阅读空间。这些城市书房通常设在社区、公园或地铁站附近，让市民在忙碌的生活中也能方便地享受阅读。它们不仅提供丰富的图书，还经常举办读书分享会和文化讲座，成为城市文化生活的重要组成部分。";

const translationQuestions: PaperQuestion[] = [
  {
    questionId: q(gTranslation, 1),
    order: 1,
    prompt: translationPrompt,
    type: "subjective_translation",
    answerText:
      "In recent years, an increasing number of public reading spaces have appeared in many Chinese cities. These urban reading rooms are usually located near residential communities, parks, or metro stations, allowing citizens to enjoy reading conveniently amid their busy lives. They not only provide a rich collection of books but also frequently host reading-sharing sessions and cultural lectures, making them an important part of urban cultural life.",
    answerKey: { value: "See answerText (reference translation).", source: "cet6-mock-paper-001" },
    shortExplanation:
      "核心表达：公共阅读空间 public reading spaces / 城市书房 urban reading rooms / 读书分享会 reading-sharing sessions / 文化生活 urban cultural life。",
    detailedExplanation:
      "评分要点（rubric/key expressions）：1) '越来越多的' → an increasing number of；2) '让市民……方便地享受阅读' → allowing citizens to enjoy reading conveniently（现在分词作状语）；3) '不仅……还……' → not only ... but also ...（注意 not only 置于句首时主谓倒装可选，此处用自然语序更稳）；4) '成为……重要组成部分' → making them an important part of ...。翻译以准确传达原文信息为准，允许合理句式变化，不要求唯一译文。",
  },
];

// ---------------------------------------------------------------- Paper 组装
export const mockPaper001: CET6Paper = {
  paperId: MOCK_PAPER_001_ID,
  type: "paper",
  tags: ["original-mock", "full-paper"],
  examSpecId: "cet6-current-2026",
  exam: "CET6",
  level: "CET6",
  year: 2026,
  session: 6,
  set: 1,
  title: "CET6 Original Mock Paper 001 (Project-authored, Full)",
  sourceId: MOCK_PAPER_001_SOURCE.id,
  rights: MOCK_PAPER_001_SOURCE.rights as ContentRights,
  sections: [
    {
      sectionId: secWriting,
      type: "writing",
      order: 1,
      instructions:
        "Write an essay on the given topic. You should write at least 150 words but no more than 200 words.",
      groups: [
        {
          groupId: gWriting,
          type: "writing",
          order: 1,
          prompt: writingQuestions[0].prompt,
          questions: writingQuestions,
        },
      ],
    },
    {
      sectionId: secListening,
      type: "listening",
      order: 2,
      instructions:
        "In this section, you will hear long conversations, passages, and talks or lectures. Each will be read once. After each item, choose the best answer to the question you hear.",
      groups: [
        {
          groupId: gLongConv1,
          type: "long_conversation",
          order: 1,
          transcript: longConv1Transcript,
          questions: longConv1Questions,
          assetIds: [audioLongConv1],
        },
        {
          groupId: gLongConv2,
          type: "long_conversation",
          order: 2,
          transcript: longConv2Transcript,
          questions: longConv2Questions,
          assetIds: [audioLongConv2],
        },
        {
          groupId: gPassage1,
          type: "passage",
          order: 3,
          transcript: passage1Transcript,
          questions: passage1Questions,
          assetIds: [audioPassage1],
        },
        {
          groupId: gPassage2,
          type: "passage",
          order: 4,
          transcript: passage2Transcript,
          questions: passage2Questions,
          assetIds: [audioPassage2],
        },
        {
          groupId: gTalk1,
          type: "lecture",
          order: 5,
          transcript: talk1Transcript,
          questions: talk1Questions,
          assetIds: [audioTalk1],
        },
        {
          groupId: gTalk2,
          type: "lecture",
          order: 6,
          transcript: talk2Transcript,
          questions: talk2Questions,
          assetIds: [audioTalk2],
        },
        {
          groupId: gTalk3,
          type: "lecture",
          order: 7,
          transcript: talk3Transcript,
          questions: talk3Questions,
          assetIds: [audioTalk3],
        },
      ],
    },
    {
      sectionId: secReading,
      type: "reading",
      order: 3,
      instructions:
        "This section includes vocabulary comprehension (cloze), long reading matching, and careful reading passages.",
      groups: [
        {
          groupId: gCloze,
          type: "cloze",
          order: 1,
          passage: clozePassage,
          questions: clozeQuestions,
        },
        {
          groupId: gMatching,
          type: "matching",
          order: 2,
          passage: matchingPassage,
          questions: matchingQuestions,
        },
        {
          groupId: gCarefulA,
          type: "careful_reading",
          order: 3,
          passage: carefulAPassage,
          questions: carefulAQuestions,
        },
        {
          groupId: gCarefulB,
          type: "careful_reading",
          order: 4,
          passage: carefulBPassage,
          questions: carefulBQuestions,
        },
      ],
    },
    {
      sectionId: secTranslation,
      type: "translation",
      order: 4,
      instructions: "Translate the following passage into English.",
      groups: [
        {
          groupId: gTranslation,
          type: "translation",
          order: 1,
          prompt: translationPrompt,
          questions: translationQuestions,
        },
      ],
    },
  ],
  assets: [
    {
      assetId: audioLongConv1,
      type: "audio",
      source: "/audio/papers/p001-long-conversation-g1.mp3",
      mimeType: "audio/mpeg",
      duration: 155.8,
      checksum: "2e4c6335cd442970733b1befd0e28efd074688d5dc8e91bc20195ae2336509c2",
      sizeBytes: 2493504,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voices (female student + male professor), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787 (火山引擎《生成式模型服务专用条款》2026-08-20 版, 3.3/3.5)",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；输出可用于产品内学习播放；仅限中国大陆地区；staging 资产，未发布。",
      },
    },
    {
      assetId: audioLongConv2,
      type: "audio",
      source: "/audio/papers/p001-long-conversation-g2.mp3",
      mimeType: "audio/mpeg",
      duration: 142.58,
      checksum: "1c94be08a92d7cd2157c681da03b44ba86147a5068855a61ee3bd58487ac84a8",
      sizeBytes: 2282112,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voices (female student + male housing coordinator), natural British English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
    {
      assetId: audioPassage1,
      type: "audio",
      source: "/audio/papers/p001-passage-g1.mp3",
      mimeType: "audio/mpeg",
      duration: 88.9,
      checksum: "7eea0f313ee8caaeb12d551870f6d9f63dfdcc97dde62e6d1ff336676b39983c",
      sizeBytes: 1423296,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voice (female narrator), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
    {
      assetId: audioPassage2,
      type: "audio",
      source: "/audio/papers/p001-passage-g2.mp3",
      mimeType: "audio/mpeg",
      duration: 85.08,
      checksum: "f775e85c249f27cebbfd570ea16d2c80a46d32423d231fd69d01d4fecae57740",
      sizeBytes: 1362240,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voice (female narrator), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
    {
      assetId: audioTalk1,
      type: "audio",
      source: "/audio/papers/p001-lecture-g1.mp3",
      mimeType: "audio/mpeg",
      duration: 149.18,
      checksum: "a13a89d70ad731043f4d9755618de805765be0515b0d559baa68321b98213868",
      sizeBytes: 2387520,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voice (male lecturer), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
    {
      assetId: audioTalk2,
      type: "audio",
      source: "/audio/papers/p001-lecture-g2.mp3",
      mimeType: "audio/mpeg",
      duration: 127.68,
      checksum: "f82dabdd7a9b3d2b838ea9908c4805cd278c022494674be0d24255a6cffb4d9e",
      sizeBytes: 2043648,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voice (male lecturer), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
    {
      assetId: audioTalk3,
      type: "audio",
      source: "/audio/papers/p001-lecture-g3.mp3",
      mimeType: "audio/mpeg",
      duration: 113,
      checksum: "5c1e35e9ceea65a8c847f2bd557af3c38d315039243b64b6b5b17c57beb1533c",
      sizeBytes: 1808640,
      format: "mp3",
      contentVersion: "1.1.0",
      generatedAt: "2026-09-28",
      provider: "volcengine-doubao-voice",
      voice: "prebuilt neural voice (female lecturer), natural American English",
      termsCheckedDate: "2026-09-28",
      generated: true,
      aiDisclosure: "AI 合成语音",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        territory: "China mainland only",
        allowedUses: ["product-internal learning playback"],
        restrictions: [
          "standalone audio sublicense or resale not granted",
          "overseas deployment not auto-allowed",
          "staging asset, not published",
        ],
        permissionEvidence: "https://docs.volcengine.com/docs/6561/1533787",
        notes: "Phase 2D.1：由项目自研 transcript（owned）经豆包语音 TTS 生成；仅限中国大陆地区；staging 资产。",
      },
    },
  ],
  schemaVersion: "1.0.0",
  contentVersion: "1.1.0",
  isPartial: false,
  fixture: false,
  status: "active",
  authenticity: "original",
  createdAt: now,
  updatedAt: now,
};

/** 注册 Paper 001（幂等；V13 production 起由 registerBuiltinPacks 调用，进入运行时 bootstrap 与 production 池）。 */
export function registerMockPaper001(): void {
  if (getContentPack(MOCK_PAPER_001_PACK_ID)) return;
  registerContentPack({
    id: MOCK_PAPER_001_PACK_ID,
    name: "CET6 Original Mock Paper 001",
    version: "1.1.0",
    contentType: "paper",
    sourceId: MOCK_PAPER_001_SOURCE.id,
    items: [mockPaper001],
    schemaVersion: "1.0.0",
    rights: mockPaper001.rights,
    provenance: MOCK_PAPER_001_SOURCE.provenance,
    createdAt: now,
    updatedAt: now,
  } as ContentPack);
}
