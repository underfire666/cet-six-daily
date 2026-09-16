import type { LessonDefinition } from "@/types/question";
export const mockLesson: LessonDefinition = {
  id: "daily-foundations",
  version: 1,
  title: "今日学习",
  minutes: 14,
  questions: [
    {
      id: "v-sustain",
      type: "choice",
      module: "vocabulary",
      prompt: "选择 sustain 最贴近的含义",
      options: [
        { id: "a", text: "维持；使持续" },
        { id: "b", text: "怀疑；不信任" },
        { id: "c", text: "替换；取代" },
        { id: "d", text: "忽略；忽视" },
      ],
      answerId: "a",
      explanation:
        "sustain 表示使某种状态持续，例如 sustain growth（保持增长）。",
      details:
        "sustain 常与 growth、interest、effort 搭配，强调“维持、支撑”。例句：Regular practice helps sustain progress. 规律练习有助于保持进步。它也有“承受”的含义，需结合语境判断。",
      hint: "想想：一种努力如果能长期坚持下去，会带来怎样的状态？这个词强调持续性。",
    },
    {
      id: "f-despite",
      type: "fill_blank",
      module: "vocabulary",
      prompt: "选择合适的词，补全句子",
      sentence:
        "_____ the limited budget, the students completed their research successfully.",
      options: [
        { id: "a", text: "Because" },
        { id: "b", text: "Despite" },
        { id: "c", text: "Unless" },
        { id: "d", text: "Although" },
      ],
      answerId: "b",
      explanation:
        "Despite 后接名词短语，表示“尽管”。这里的 limited budget 是名词短语。",
      details:
        "despite 是介词，后面可以接名词、代词或动名词。although 是连词，后面通常接完整从句。因此可以说 Despite the limited budget，也可以说 Although the budget was limited。",
      hint: "前半句的困难与后半句的成功形成让步关系。再看看空格后面是完整句子，还是名词短语。",
    },
    {
      id: "r-library",
      type: "reading",
      module: "reading",
      passageTitle: "A different kind of quiet",
      passage:
        "A university library replaced some silent desks with small discussion areas. At first, several students worried that the change would make studying harder. After a month, however, visitors reported that it was easier to find a suitable place: quiet rooms were still available, while group projects finally had a space of their own.",
      prompt: "What was the main benefit of the change?",
      options: [
        { id: "a", text: "It made every room completely silent." },
        { id: "b", text: "It reduced the number of group projects." },
        { id: "c", text: "It provided spaces for different study needs." },
        { id: "d", text: "It shortened the time students spent reading." },
      ],
      answerId: "c",
      explanation: "安静房间与讨论区同时保留，说明改动满足了不同的学习需求。",
      details:
        "题目询问主要好处。最后一句用 while 并列介绍两类空间：quiet rooms 和 a space for group projects。A 的 every 属于过度概括；B、D 没有原文依据。",
      hint: "留意最后一句 while 两边分别提到了什么，以及这些空间适合谁使用。",
    },
    {
      id: "v-feasible",
      type: "choice",
      module: "vocabulary",
      prompt: "选择 feasible 最贴近的含义",
      options: [
        { id: "a", text: "偶然的" },
        { id: "b", text: "可行的" },
        { id: "c", text: "模糊的" },
        { id: "d", text: "昂贵的" },
      ],
      answerId: "b",
      explanation: "feasible 指计划或方案在实际条件下能够实现，即“可行的”。",
      details:
        "a feasible plan 是一个能实行的计划。feasible 侧重实际条件是否允许；possible 更广泛地表示可能。例句：The team is looking for a feasible solution. 团队正在寻找可行的解决办法。",
      hint: "评价一个计划时，除了它是否有吸引力，还需要判断它能不能在现实条件下实施。",
    },
    {
      id: "f-contribute",
      type: "fill_blank",
      module: "vocabulary",
      prompt: "选择合适的词，补全句子",
      sentence:
        "Small changes in daily habits can _____ to a healthier lifestyle.",
      options: [
        { id: "a", text: "contribute" },
        { id: "b", text: "consist" },
        { id: "c", text: "depend" },
        { id: "d", text: "result" },
      ],
      answerId: "a",
      explanation:
        "contribute to 表示“有助于；促成”，符合小改变带来积极影响的语境。",
      details:
        "注意动词与介词的固定搭配：contribute to、consist of、depend on、result in。can 后面使用动词原形。这里要表达习惯的改变“有助于”形成更健康的生活方式。",
      hint: "先观察空格后面的介词 to，再判断哪个动词常与它搭配，并能表达积极影响。",
    },
    {
      id: "r-garden",
      type: "reading",
      module: "reading",
      passageTitle: "Learning in the garden",
      passage:
        "When a campus garden opened, its organisers expected students to learn mainly about plants. They soon noticed another outcome. Students from different departments began sharing tools and exchanging advice. Some even continued working together on unrelated projects after the growing season ended.",
      prompt: "What unexpected outcome did the organisers observe?",
      options: [
        { id: "a", text: "Students stopped studying plants." },
        { id: "b", text: "The growing season became longer." },
        { id: "c", text: "The garden needed fewer tools." },
        { id: "d", text: "Students formed connections across departments." },
      ],
      answerId: "d",
      explanation:
        "不同院系学生开始交流并持续合作，这是组织者最初预期之外的收获。",
      details:
        "mainly about plants 是原先的预期；another outcome 引出新的发现。sharing tools、exchanging advice 和 continued working together 都指向建立联系与合作。",
      hint: "区分第一句的原先预期和后面观察到的新变化，注意人物之间的互动。",
    },
    {
      id: "v-significant",
      type: "choice",
      module: "vocabulary",
      prompt: "选择 significant 最贴近的含义",
      options: [
        { id: "a", text: "暂时的" },
        { id: "b", text: "相似的" },
        { id: "c", text: "显著的；重要的" },
        { id: "d", text: "独立的" },
      ],
      answerId: "c",
      explanation:
        "significant 可以表示“显著的”或“重要的”，如 a significant improvement。",
      details:
        "在日常表达中，significant 强调值得注意的程度或重要性。a significant difference 是显著差异。统计学语境中的 statistical significance 有更严格的含义，不能直接等同于实际影响很大。",
      hint: "如果一次 improvement 大到值得特别关注，你会怎样形容这种进步？",
    },
    {
      id: "f-evidence",
      type: "fill_blank",
      module: "vocabulary",
      prompt: "选择合适的词，补全句子",
      sentence: "The conclusion should be supported by reliable _____.",
      options: [
        { id: "a", text: "evident" },
        { id: "b", text: "evidence" },
        { id: "c", text: "evidently" },
        { id: "d", text: "evidential" },
      ],
      answerId: "b",
      explanation:
        "reliable 是形容词，后面需要名词 evidence，表示“可靠的证据”。",
      details:
        "evidence 是不可数名词，可说 a piece of evidence。evident 是形容词，evidently 是副词，evidential 也是形容词。选择时同时检查词性和句意。",
      hint: "先判断 reliable 的词性，再想想它后面通常修饰哪一类词。",
    },
    {
      id: "r-breaks",
      type: "reading",
      module: "reading",
      passageTitle: "A useful pause",
      passage:
        "Students often believe that studying without a break shows commitment. Yet a small classroom project found that students who took short, planned breaks made fewer mistakes in the final part of a reading task. The teacher cautioned that breaks should be brief and purposeful: repeatedly checking social media could make it harder to return to work.",
      prompt: "Which statement best reflects the teacher’s advice?",
      options: [
        {
          id: "a",
          text: "Take brief, planned breaks and avoid distracting activities.",
        },
        { id: "b", text: "Never pause during a reading task." },
        { id: "c", text: "Check social media whenever concentration drops." },
        { id: "d", text: "Longer breaks always produce better results." },
      ],
      answerId: "a",
      explanation:
        "老师强调休息应当短暂且有目的，同时提醒避免社交媒体带来的干扰。",
      details:
        "brief and purposeful 是建议的核心。冒号后的例子解释了为什么某些休息方式会妨碍重新投入学习。B、C 与原文相反，D 的 always 和 longer 没有依据。",
      hint: "最后一句中的 should 给出了建议，冒号后面则补充了需要避免的情况。",
    },
  ],
};
