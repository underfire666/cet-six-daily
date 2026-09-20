import type { TranslationTask } from "@/types/translation";

export const mockTranslationTasks: TranslationTask[] = [
  {
    id: "t-trad-festival",
    title: "传统节日",
    level: "paragraph",
    promptChinese:
      "春节是中国最重要的传统节日。无论人们身在何方，都会尽量赶回家与家人团聚。年夜饭是一年中最丰盛的一顿饭，饺子、鱼和年糕都是常见的菜肴。长辈会给孩子们发红包，祝福新的一年平安健康。",
    keywords: [
      "spring festival",
      "traditional",
      "reunite",
      "family",
      "reunion dinner",
      "dumpling",
      "red envelope",
      "blessing",
    ],
    referenceTranslation:
      "The Spring Festival is the most important traditional festival in China. Wherever people are, they will try their best to return home and reunite with their families. The reunion dinner is the most lavish meal of the year; dumplings, fish and rice cakes are common dishes. Elders give red envelopes to children, wishing them peace and health in the new year.",
    scoringPoints: [
      "准确译出\"团聚\"与\"年夜饭\"",
      "使用被动或从句处理\"无论身在何方\"",
      "红包 / 祝福等文化词翻译自然",
    ],
    mockFeedback: {
      summary: "整体意思传达清楚，个别文化词表达可以更地道。",
      issues: [
        {
          type: "vocabulary",
          title: "文化词",
          description: "\"红包\"建议译为 red envelope 或 red packet，而不是 red bag。",
          severity: "minor",
        },
        {
          type: "structure",
          title: "句子衔接",
          description: "长句可以用分号或从句连接，避免连续用 and。",
          severity: "minor",
        },
      ],
      details: [
        {
          excerpt: "长辈会给孩子们发红包",
          userExpression: "Elders give kids red bags",
          referenceExpression: "Elders give red envelopes to children",
          note: "两种都能懂，red envelope 是更常见的英文表达。",
        },
      ],
    },
    estimatedMinutes: 12,
    sourceType: "mock",
  },
  {
    id: "t-online-edu",
    title: "在线教育",
    level: "paragraph",
    promptChinese:
      "近年来，在线教育在中国迅速普及。学生可以通过网络课程在任何时间、任何地点学习。这种方式不仅打破了地域限制，也为偏远地区的孩子提供了接触优质师资的机会。不过，过度依赖屏幕也可能影响学生的视力和自律能力。",
    keywords: [
      "online education",
      "popular",
      "anytime",
      "anywhere",
      "break",
      "geographical",
      "remote",
      "screen",
      "self-discipline",
    ],
    referenceTranslation:
      "In recent years, online education has gained rapid popularity in China. Students can take online courses and study anytime, anywhere. This approach not only breaks geographical barriers, but also gives children in remote areas access to high-quality teaching resources. However, relying too much on screens may affect students' eyesight and self-discipline.",
    scoringPoints: [
      "完成时使用现在完成时 has gained",
      "\"打破地域限制\"译为 break geographical barriers",
      "转折句 however 衔接自然",
    ],
    mockFeedback: {
      summary: "时态和连接词使用得当，注意\"自律\"的拼写。",
      issues: [
        {
          type: "vocabulary",
          title: "词形",
          description: "\"自律\"是 self-discipline，不是 self-discipline ability。",
          severity: "minor",
        },
      ],
      details: [],
    },
    estimatedMinutes: 12,
    sourceType: "mock",
  },
  {
    id: "t-campus-life",
    title: "大学生活",
    level: "sentence",
    promptChinese:
      "大学不仅是学习知识的地方，也是培养独立生活能力和人际交往能力的重要阶段。",
    keywords: [
      "not only",
      "but also",
      "independence",
      "interpersonal",
      "stage",
    ],
    referenceTranslation:
      "University is not only a place to acquire knowledge, but also an important stage for developing independence and interpersonal skills.",
    scoringPoints: ["not only...but also 平行结构", "培养能力用 develop / cultivate"],
    mockFeedback: {
      summary: "句子主干清晰，注意 not only 与 but also 后的结构平行。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 6,
    sourceType: "mock",
  },
  {
    id: "t-environment",
    title: "环境保护",
    level: "paragraph",
    promptChinese:
      "随着城市化进程加快，空气污染和垃圾处理问题日益突出。政府已经出台了多项政策，例如推广新能源汽车和建立垃圾分类制度。然而，环境保护需要每个人的参与，只有从日常生活做起，我们才能真正拥有蓝天。",
    keywords: [
      "urbanization",
      "air pollution",
      "garbage",
      "policy",
      "new energy",
      "sorting",
      "participation",
      "blue sky",
    ],
    referenceTranslation:
      "As urbanization accelerates, air pollution and waste disposal have become increasingly serious. The government has introduced a number of policies, such as promoting new-energy vehicles and establishing a garbage-sorting system. Environmental protection, however, requires everyone's participation; only by starting from daily life can we truly have a blue sky.",
    scoringPoints: ["as 引导时间状语", "only by...can 倒装", "垃圾分类译为 garbage sorting"],
    mockFeedback: {
      summary: "信息完整，结尾倒装句使用准确会加分。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 12,
    sourceType: "mock",
  },
  {
    id: "t-reading",
    title: "阅读习惯",
    level: "sentence",
    promptChinese:
      "阅读经典书籍能够帮助年轻人开阔视野，并在快速变化的世界中保持内心的平静。",
    keywords: [
      "classics",
      "broaden",
      "horizon",
      "rapidly changing",
      "inner peace",
    ],
    referenceTranslation:
      "Reading classics helps young people broaden their horizons and maintain inner peace in a rapidly changing world.",
    scoringPoints: ["broaden one's horizons 固定搭配", "现在分词作状语"],
    mockFeedback: {
      summary: "主干清楚，注意 horizons 用复数。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 6,
    sourceType: "mock",
  },
  {
    id: "t-city-traffic",
    title: "城市交通",
    level: "paragraph",
    promptChinese:
      "为了缓解交通拥堵，许多大城市鼓励市民乘坐公共交通。地铁和公交线路不断延伸，共享单车也成为短距离出行的重要选择。这些措施不仅减少了碳排放，也让城市生活更加便捷。",
    keywords: [
      "traffic jam",
      "public transport",
      "subway",
      "shared bike",
      "short distance",
      "carbon emission",
      "convenient",
    ],
    referenceTranslation:
      "To ease traffic congestion, many large cities encourage residents to use public transport. Subway and bus routes keep expanding, and shared bikes have become an important option for short-distance travel. These measures not only reduce carbon emissions, but also make city life more convenient.",
    scoringPoints: ["To ease... 不定式表目的", "not only...but also 平行", "碳排放 carbon emissions"],
    mockFeedback: {
      summary: "整体表达自然，注意 emission 常用复数。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 12,
    sourceType: "mock",
  },
  {
    id: "t-traditional-culture",
    title: "传统文化",
    level: "sentence",
    promptChinese:
      "书法不仅是一门艺术，也是中国人修养心性、传承文化的重要方式。",
    keywords: [
      "calligraphy",
      "art",
      "cultivate",
      "inherit",
      "culture",
    ],
    referenceTranslation:
      "Calligraphy is not only an art, but also an important way for Chinese people to cultivate their minds and pass on their culture.",
    scoringPoints: ["书法 calligraphy", "传承文化 pass on culture"],
    mockFeedback: {
      summary: "意思到位，cultivate 比 develop 更贴合\"修养心性\"。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 6,
    sourceType: "mock",
  },
  {
    id: "t-ai",
    title: "人工智能",
    level: "paragraph",
    promptChinese:
      "人工智能正在深刻改变我们的生活方式。从智能助手到自动驾驶，AI 已经渗透到医疗、教育和交通等多个领域。专家提醒，技术进步的同时，我们也需要思考如何保护隐私和确保算法的公平性。",
    keywords: [
      "artificial intelligence",
      "transform",
      "smart assistant",
      "self-driving",
      "medical",
      "privacy",
      "algorithm",
      "fairness",
    ],
    referenceTranslation:
      "Artificial intelligence is profoundly changing the way we live. From smart assistants to self-driving cars, AI has penetrated into fields such as healthcare, education and transportation. Experts remind us that while technology advances, we also need to think about how to protect privacy and ensure algorithmic fairness.",
    scoringPoints: ["the way we live", "while 引导让步", "algorithmic fairness"],
    mockFeedback: {
      summary: "覆盖全面，\"算法公平\"建议用 algorithmic fairness。",
      issues: [],
      details: [],
    },
    estimatedMinutes: 12,
    sourceType: "mock",
  },
];

export function translationTaskById(id: string): TranslationTask | undefined {
  return mockTranslationTasks.find((t) => t.id === id);
}
