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
 * - 听力 audio 均为明确 staging placeholder（mock://…），未生成/未引入真实音频。
 * - status=staging：不进入 production 池，不暴露给学习页 Selector；Phase 2D/2E 独立验收后再决定发布。
 *
 * Phase 2C.1（editorial revision, contentVersion 1.0.1）：
 * - 独立 Editorial Review 修正答案位置分布（消除 B 偏好与 D 稀少，重排 15 题选项顺序，
 *   题目内容与干扰项语义不变，讲解中选项字母同步更新）。
 * - cloze q5 选项 close→cross，消除 bridge/close 双解。
 * - 文件自 src/content/fixture/ 迁移至 src/content/papers/（fixture/ 仅用于 TEST FIXTURE）。
 *
 * 稳定 ID 全部由 cet6:mock:paper-001 确定性派生（extendStableId），无随机/索引 ID。
 */
import { registerContentPack } from "../registry";
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
const gConversation = extendStableId(secListening, "long_conversation", "g1");
const gPassage = extendStableId(secListening, "passage", "g2");
const gLectureA = extendStableId(secListening, "lecture", "g3");
const gLectureB = extendStableId(secListening, "lecture", "g4");
const gCloze = extendStableId(secReading, "cloze", "g1");
const gMatching = extendStableId(secReading, "matching", "g2");
const gCarefulA = extendStableId(secReading, "careful_reading", "g3");
const gCarefulB = extendStableId(secReading, "careful_reading", "g4");
const gTranslation = extendStableId(secTranslation, "g1");

// 听力 audio 占位 asset（明确 staging placeholder，未生成真实音频）
const audioConv = extendStableId(gConversation, "audio1");
const audioPassage = extendStableId(gPassage, "audio1");
const audioLectureA = extendStableId(gLectureA, "audio1");

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
  return {
    questionId: q(group, order),
    order,
    prompt,
    type,
    answerText,
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

// ---------------------------------------------------------------- Listening: Long Conversation (8)
const conversationTranscript =
  "W: Hi Professor Carter. I saw the list for the summer research internship. I'm still comparing two options.\n" +
  "M: Emma, welcome. Tell me about them.\n" +
  "W: The marine biology lab sounds exciting, but the project on renewable energy policy is more relevant to my major.\n" +
  "M: Both are excellent choices. Keep in mind the marine biology lab requires a background in statistics, which you have.\n" +
  "W: That's true, but I've always wanted to understand how policy decisions shape energy markets. It feels closer to what I want to do after graduation.\n" +
  "M: A sensible consideration. Have you checked the workload? The energy policy project involves weekly reports and field interviews with local businesses.\n" +
  "W: I've read the syllabus. The interviews worry me a little since I haven't done fieldwork before.\n" +
  "M: That's exactly why it's a good learning opportunity. The lab runs a two-day training session in May for all new interns.\n" +
  "W: Then I'll submit my application to the energy policy lab this week. How soon will I know the result?\n" +
  "M: The committee meets on the fifteenth. You should receive a decision by the end of next week.\n" +
  "W: Great. One more question—is the stipend enough to cover accommodation on campus?\n" +
  "M: The stipend is competitive, and on-campus housing is subsidized for interns. You shouldn't have trouble covering your costs.\n" +
  "W: Perfect. Thank you for your time, Professor.\n" +
  "M: Good luck with the application, Emma. I hope to see you in the project.";

const conversationQuestions: PaperQuestion[] = [
  choice(
    gConversation, 1,
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
    gConversation, 2,
    "What advantage does the student have for the marine biology lab?",
    [
      { id: "a", text: "She has experience with field interviews." },
      { id: "b", text: "She has a background in statistics." },
      { id: "c", text: "She was recommended by a professor." },
      { id: "d", text: "She has published a paper." },
    ],
    "b",
    "The professor notes the marine biology lab requires statistics, which the student has.",
    "正确答案 B：教授说 'the marine biology lab requires a background in statistics, which you have'，即学生具备统计背景。A 的实地采访经验是学生自己担心缺乏的；C 的教授推荐、D 的发表论文均未提及。",
    "easy",
  ),
  choice(
    gConversation, 3,
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
    gConversation, 4,
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
  choice(
    gConversation, 5,
    "What worries the student about the project?",
    [
      { id: "a", text: "She has never done fieldwork." },
      { id: "b", text: "The workload is too heavy for her." },
      { id: "c", text: "The deadline conflicts with her exams." },
      { id: "d", text: "She dislikes public speaking." },
    ],
    "a",
    "She says the interviews worry her because she hasn't done fieldwork before.",
    "正确答案 A：女生说 'I haven't done fieldwork before'，这是她对实地采访的担忧来源。B 的工作量过重、C 与考试冲突、D 不喜欢公开演讲在对话中都没有依据。",
    "normal",
  ),
  choice(
    gConversation, 6,
    "What does the professor suggest about the interviews?",
    [
      { id: "a", text: "She can skip them if she is too busy." },
      { id: "b", text: "The professor will accompany her." },
      { id: "c", text: "A two-day training session will prepare her." },
      { id: "d", text: "They are optional for new interns." },
    ],
    "c",
    "The lab runs a two-day training session in May for all new interns.",
    "正确答案 C：教授指出这正是学习机会，并说 'the lab runs a two-day training session in May for all new interns'，即培训会解决她的顾虑。A 的跳过、B 的陪同、D 的可选都与原文不符。",
    "normal",
  ),
  choice(
    gConversation, 7,
    "When will the student receive the decision?",
    [
      { id: "a", text: "This Friday." },
      { id: "b", text: "At the May training session." },
      { id: "c", text: "In about two months." },
      { id: "d", text: "By the end of next week." },
    ],
    "d",
    "The professor says the committee meets on the fifteenth and the decision arrives by the end of next week.",
    "正确答案 D：教授说委员会十五号开会，'You should receive a decision by the end of next week'。A 的本周五太早；B 的五月份培训是在决策之后的事；C 的两个月与原文不符。",
    "easy",
  ),
  choice(
    gConversation, 8,
    "What does the professor say about the stipend?",
    [
      { id: "a", text: "It barely covers daily meals." },
      { id: "b", text: "It is competitive and housing is subsidized." },
      { id: "c", text: "It is paid only after the project ends." },
      { id: "d", text: "It depends on examination results." },
    ],
    "b",
    "The stipend is competitive, and on-campus housing is subsidized for interns.",
    "正确答案 B：教授说 'The stipend is competitive, and on-campus housing is subsidized for interns'。A 的难以覆盖餐费与原文相反；C 的结束后才支付、D 的取决于考试成绩均未提及。",
    "easy",
  ),
];

// ---------------------------------------------------------------- Listening: Passage (7)
const passageTranscript =
  "Scientists have long known that sleep helps consolidate memories, but the precise mechanism remained unclear. A recent study at a European university followed 120 students during an intensive language course. Half were allowed to nap for ninety minutes after morning classes, while the other half stayed awake doing quiet reading. When both groups were tested the next morning, the napping group recalled about twenty percent more vocabulary items, and their scores remained higher when they were retested a week later.\n" +
  "The researchers attribute the effect to the slow-wave phase of sleep, during which the brain appears to replay newly learned information. Brain scans taken during the naps showed synchronized activity between the hippocampus, which captures new facts, and the prefrontal cortex, which stores them for the long term. Interestingly, the benefit disappeared when participants were woken during slow-wave sleep, suggesting that the full sleep cycle matters.\n" +
  "The findings have practical implications for learners. Pulling an all-nighter before an exam may be counterproductive, since sleep deprivation disrupts exactly the process that turns short-term knowledge into durable memory. The authors recommend short naps and consistent sleep schedules, though they caution that the study was small and the long-term effects remain to be explored.";

const passageQuestions: PaperQuestion[] = [
  choice(
    gPassage, 1,
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
    gPassage, 2,
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
    gPassage, 3,
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
    gPassage, 4,
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
  choice(
    gPassage, 5,
    "What happened when participants were woken during slow-wave sleep?",
    [
      { id: "a", text: "The memory benefit disappeared." },
      { id: "b", text: "They recalled even more items." },
      { id: "c", text: "They felt more refreshed." },
      { id: "d", text: "The effect became permanent." },
    ],
    "a",
    "The benefit disappeared when participants were woken during slow-wave sleep.",
    "正确答案 A：原文 'the benefit disappeared when participants were woken during slow-wave sleep'。B 的回忆更多、C 的更精神、D 的永久化都与原文相反。",
    "normal",
  ),
  choice(
    gPassage, 6,
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
    gPassage, 7,
    "What limitation of the study does the author mention?",
    [
      { id: "a", text: "The participants were all elderly learners." },
      { id: "b", text: "The language course was too short to be meaningful." },
      { id: "c", text: "The brain scans were technically unreliable." },
      { id: "d", text: "The sample was small and long-term effects are unclear." },
    ],
    "d",
    "The authors caution that the study was small and the long-term effects remain to be explored.",
    "正确答案 D：结尾 'they caution that the study was small and the long-term effects remain to be explored'。A 的老年学习者错误（是 120 名学生）；B 的课程太短、C 的扫描不可靠都不是原文提到的限制。",
    "hard",
  ),
];

// ---------------------------------------------------------------- Listening: Lecture A — 城市农业 (5)
const lectureATranscript =
  "Good afternoon. Today I'd like to look at the rise of rooftop farming in dense cities. Over the past decade, rooftop farms have moved from a niche experiment to a visible feature of several Asian and European capitals. Three forces explain the trend: rising food prices, growing interest in food security, and the need to use vacant rooftop space productively.\n" +
  "What do these farms actually contribute? Researchers measured the output of thirty rooftop farms over two growing seasons. They found that a well-managed rooftop plot can supply a meaningful share of fresh vegetables for a small restaurant or a community kitchen. More importantly, the farms reduce the distance food travels, lowering emissions and keeping produce fresher.\n" +
  "Yet the challenges are real. Rooftop farms demand careful engineering—the roof must bear the weight of soil and water, and drainage must be planned from the start. Labour costs are also higher than on conventional farms, because much of the work is done by hand.\n" +
  "The researchers conclude that rooftop farming is unlikely to replace conventional agriculture, but it can play a valuable supporting role, particularly in neighbourhoods where fresh food is expensive or hard to reach.";

const lectureAQuestions: PaperQuestion[] = [
  choice(
    gLectureA, 1,
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
    gLectureA, 2,
    "According to the lecture, which force has driven the growth of rooftop farms?",
    [
      { id: "a", text: "A desire to reduce rooftop maintenance costs." },
      { id: "b", text: "Government requirements for building insulation." },
      { id: "c", text: "Rising food prices and concern about food security." },
      { id: "d", text: "The popularity of organic restaurants." },
    ],
    "c",
    "Three forces are cited: rising food prices, food security, and productive use of vacant roofs.",
    "正确答案 C：原文列举 three forces：rising food prices、growing interest in food security、the need to use vacant rooftop space productively。A 的维护成本降低、B 的建筑保温要求、D 的有机餐厅流行都不是原文原因。",
    "normal",
  ),
  choice(
    gLectureA, 3,
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
    gLectureA, 4,
    "What is mentioned as a challenge for rooftop farming?",
    [
      { id: "a", text: "A shortage of seeds and fertiliser." },
      { id: "b", text: "High labour costs and engineering demands." },
      { id: "c", text: "Competition from imported vegetables." },
      { id: "d", text: "Uncertain weather in winter months." },
    ],
    "b",
    "Rooftop farms demand careful engineering and have higher labour costs.",
    "正确答案 B：原文 challenges 部分说 'demand careful engineering' 且 'Labour costs are also higher than on conventional farms'。A 的种子肥料短缺、C 的进口竞争、D 的冬季天气都不是原文提到的问题。",
    "normal",
  ),
  choice(
    gLectureA, 5,
    "What is the lecture's conclusion about rooftop farming?",
    [
      { id: "a", text: "It will soon replace conventional agriculture." },
      { id: "b", text: "It is too costly to be worth pursuing." },
      { id: "c", text: "It mainly benefits large commercial farms." },
      { id: "d", text: "It can play a valuable supporting role in some neighbourhoods." },
    ],
    "d",
    "Rooftop farming is unlikely to replace conventional agriculture but can play a valuable supporting role.",
    "正确答案 D：结尾 'unlikely to replace conventional agriculture, but it can play a valuable supporting role, particularly in neighbourhoods where fresh food is expensive or hard to reach'。A 的取代传统农业与原文相反；B 的过于昂贵、C 的惠及大型商业农场都不是结论。",
    "hard",
  ),
];

// ---------------------------------------------------------------- Listening: Lecture B — 损失厌恶 (5)
const lectureBTranscript =
  "Today we turn to a well-known idea in behavioural economics: loss aversion. In simple terms, people feel the pain of losing something more intensely than the pleasure of gaining the same thing. A classic experiment offers a vivid demonstration. Participants were given a small gift—say a coffee mug—and then asked whether they would trade it for cash. Those who owned a mug typically demanded a price far higher than the price newcomers were willing to pay to buy one. The object had not changed; what changed was simply who held it.\n" +
  "Loss aversion has practical consequences in markets. Investors often hold on to losing stocks far too long, hoping to avoid admitting a loss, while selling winning stocks too quickly to lock in gains. This behaviour is one reason markets sometimes move more slowly than economic fundamentals would suggest.\n" +
  "Framing also matters. People respond differently to the same information depending on whether it is presented as a gain or a loss. For example, telling patients that a treatment has a ninety percent success rate produces a different reaction from telling them it has a ten percent failure rate, even though the facts are identical.\n" +
  "The lesson for decision-making is simple but hard to apply: we should evaluate choices by their actual outcomes, not by whether they feel like gains or losses. Being aware of loss aversion does not eliminate it, but it can make us more careful.";

const lectureBQuestions: PaperQuestion[] = [
  choice(
    gLectureB, 1,
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
    gLectureB, 2,
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
    gLectureB, 3,
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
  choice(
    gLectureB, 4,
    "What does the example about the ninety percent success rate illustrate?",
    [
      { id: "a", text: "That framing affects how people respond to identical facts." },
      { id: "b", text: "The importance of accurate medical statistics." },
      { id: "c", text: "That patients prefer detailed explanations." },
      { id: "d", text: "That doctors should avoid giving percentages." },
    ],
    "a",
    "The same facts framed as a gain or a loss produce different reactions.",
    "正确答案 A：原文 'People respond differently to the same information depending on whether it is presented as a gain or a loss'，并用成功率/失败率例子说明。B 的统计准确性、C 的患者偏好、D 的避免百分比都不是该例的要点。",
    "normal",
  ),
  choice(
    gLectureB, 5,
    "What lesson does the speaker draw for decision-making?",
    [
      { id: "a", text: "Loss aversion can be completely eliminated with practice." },
      { id: "b", text: "People should always trust their first emotional response." },
      { id: "c", text: "Choices should be judged by actual outcomes, not by how they feel." },
      { id: "d", text: "Markets are always rational in the long run." },
    ],
    "c",
    "We should evaluate choices by their actual outcomes, not by whether they feel like gains or losses.",
    "正确答案 C：结尾 'we should evaluate choices by their actual outcomes, not by whether they feel like gains or losses'。A 的完全消除与原文 'does not eliminate it' 矛盾；B 的信任直觉、D 的市场始终理性都不是讲座结论。",
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
          groupId: gConversation,
          type: "long_conversation",
          order: 1,
          transcript: conversationTranscript,
          questions: conversationQuestions,
          assetIds: [audioConv],
        },
        {
          groupId: gPassage,
          type: "passage",
          order: 2,
          transcript: passageTranscript,
          questions: passageQuestions,
          assetIds: [audioPassage],
        },
        {
          groupId: gLectureA,
          type: "lecture",
          order: 3,
          transcript: lectureATranscript,
          questions: lectureAQuestions,
          assetIds: [audioLectureA],
        },
        {
          groupId: gLectureB,
          type: "lecture",
          order: 4,
          transcript: lectureBTranscript,
          questions: lectureBQuestions,
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
      assetId: audioConv,
      type: "audio",
      source: "mock://cet6-mock-paper-001/long-conversation-g1.mp3",
      mimeType: "audio/mpeg",
      duration: 150,
      checksum: "paper-001-audio-placeholder-conv",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        notes: "staging placeholder asset：音频尚未生成（Phase 2C 不生成/不引入真实音频）。",
      },
    },
    {
      assetId: audioPassage,
      type: "audio",
      source: "mock://cet6-mock-paper-001/passage-g2.mp3",
      mimeType: "audio/mpeg",
      duration: 150,
      checksum: "paper-001-audio-placeholder-passage",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        notes: "staging placeholder asset：音频尚未生成（Phase 2C 不生成/不引入真实音频）。",
      },
    },
    {
      assetId: audioLectureA,
      type: "audio",
      source: "mock://cet6-mock-paper-001/lecture-g3.mp3",
      mimeType: "audio/mpeg",
      duration: 150,
      checksum: "paper-001-audio-placeholder-lecture-a",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        notes: "staging placeholder asset：音频尚未生成（Phase 2C 不生成/不引入真实音频）。",
      },
    },
  ],
  schemaVersion: "1.0.0",
  contentVersion: "1.0.1",
  isPartial: false,
  fixture: false,
  status: "staging",
  authenticity: "original",
  createdAt: now,
  updatedAt: now,
};

/** 注册 Paper 001（幂等；内容脚本与测试调用；不进入运行时 bootstrap，不暴露给学习页 Selector）。 */
export function registerMockPaper001(): void {
  registerContentPack({
    id: MOCK_PAPER_001_PACK_ID,
    name: "CET6 Original Mock Paper 001",
    version: "1.0.1",
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
