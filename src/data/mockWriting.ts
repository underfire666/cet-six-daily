import type { WritingTask } from "@/types/writing";

export const mockWritingTasks: WritingTask[] = [
  {
    id: "w-ai-impact",
    title: "人工智能对大学生的影响",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on the impact of artificial intelligence on college students. You should write at least 150 words but no more than 200 words, and base your composition on the outline given below.",
    requirements: [
      "AI 给大学生学习带来的便利",
      "可能带来的挑战（依赖、独立思考）",
      "你的看法",
    ],
    suggestedWords: [
      "artificial intelligence",
      "convenient",
      "depend on",
      "critical thinking",
      "balance",
    ],
    referenceEssay:
      "Nowadays, artificial intelligence is increasingly present on campus. On the one hand, AI tools make study more convenient: students can look up references, polish drafts and practise speaking at any time. On the other hand, over-reliance on AI may weaken students' ability to think independently. In my view, AI is a helpful assistant rather than a replacement. We should use it wisely, keep our critical thinking, and strike a balance between efficiency and genuine learning.",
    outline: [
      { type: "introduction", content: "引出 AI 在校园的普及" },
      { type: "body", content: "便利与挑战两方面" },
      { type: "conclusion", content: "表明态度：合理使用、保持独立思考" },
    ],
    scoringPoints: ["三段结构完整", "使用 on the one hand / on the other hand", "有明确个人观点"],
    mockFeedback: {
      summary: "结构清楚，观点明确，注意连接词的多样性。",
      issues: [
        {
          type: "coherence",
          title: "衔接",
          description: "段落之间可以加入 In addition / However 等过渡词。",
          severity: "minor",
        },
      ],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
  {
    id: "w-reading-habit",
    title: "大学生阅读习惯",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on whether college students should keep a regular reading habit. You should write at least 150 words but no more than 200 words.",
    requirements: [
      "阅读习惯的重要性",
      "现在学生阅读时间减少的现象",
      "你的建议",
    ],
    suggestedWords: [
      "reading habit",
      "broaden horizons",
      "smartphone",
      "spend time",
      "suggestion",
    ],
    referenceEssay:
      "Reading is a lifelong habit that broadens our horizons. However, many college students now spend most of their free time on smartphones, leaving little room for books. In my opinion, we should set aside at least half an hour every day for reading, whether it is paper books or e-books. A regular reading habit not only enriches our knowledge, but also calms our minds in a fast-paced world.",
    outline: [
      { type: "introduction", content: "阅读的价值" },
      { type: "body", content: "现象：手机占用时间" },
      { type: "conclusion", content: "建议每天固定阅读时间" },
    ],
    scoringPoints: ["提出具体建议", "使用 whether...or...", "词汇丰富度"],
    mockFeedback: {
      summary: "观点自然，建议具体，字数偏短可再展开。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
  {
    id: "w-internship",
    title: "大学生实习",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on whether college students should take internships during vacations. You should write at least 150 words but no more than 200 words.",
    requirements: [
      "实习的好处",
      "可能的问题",
      "你的态度",
    ],
    suggestedWords: [
      "internship",
      "practical experience",
      "career",
      "balance",
      "benefit",
    ],
    referenceEssay:
      "Taking internships during vacations has become increasingly popular among college students. On the positive side, internships offer practical experience that textbooks cannot provide, and they help students clarify their career goals. However, some internships are merely about doing routine work and may take up study time. As far as I am concerned, students should choose internships carefully, balance work and rest, and treat every task as a chance to learn.",
    outline: [
      { type: "introduction", content: "实习现象普遍" },
      { type: "body", content: "好处与潜在问题" },
      { type: "conclusion", content: "谨慎选择、平衡学习" },
    ],
    scoringPoints: ["as far as I am concerned", "on the positive side", "平衡观点"],
    mockFeedback: {
      summary: "结构完整，过渡词使用得当。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
  {
    id: "w-healthy-lifestyle",
    title: "健康生活方式",
    level: "paragraph",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write a short paragraph on how college students can keep a healthy lifestyle. You should write around 120 words.",
    requirements: ["饮食、运动、睡眠至少提到两项"],
    suggestedWords: ["balanced diet", "exercise", "sleep", "regular"],
    referenceEssay:
      "To keep a healthy lifestyle, college students should first maintain a balanced diet and avoid too much fast food. Second, regular exercise, even a 20-minute walk every day, helps reduce stress. Finally, enough sleep is the foundation of efficient study. Small but consistent habits matter more than occasional intense efforts.",
    outline: [
      { type: "introduction", content: "总起：健康生活方式重要" },
      { type: "body", content: "饮食 / 运动 / 睡眠三点" },
      { type: "conclusion", content: "小结：坚持小习惯" },
    ],
    scoringPoints: ["使用 first / second / finally", "提到至少两项"],
    mockFeedback: {
      summary: "条理清楚，注意 small but consistent 的表达。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [100, 140],
    sourceType: "mock",
  },
  {
    id: "w-social-media",
    title: "社交媒体",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on the influence of social media on college students. You should write at least 150 words but no more than 200 words.",
    requirements: ["正面与负面影响", "你的建议"],
    suggestedWords: [
      "social media",
      "connect",
      "distract",
      "limit",
      "real life",
    ],
    referenceEssay:
      "Social media has become part of college life. It helps students stay connected with friends and learn about the world quickly. However, endless scrolling can easily distract us from study and reduce face-to-face communication. In my opinion, we should set a daily time limit for social media and put the phone away when studying. Real-life conversations still matter most.",
    outline: [
      { type: "introduction", content: "社交媒体普及" },
      { type: "body", content: "便利与分心" },
      { type: "conclusion", content: "限时使用、回归现实" },
    ],
    scoringPoints: ["set a time limit", "face-to-face communication", "明确建议"],
    mockFeedback: {
      summary: "观点平衡，结尾简洁有力。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
  {
    id: "w-time-management",
    title: "时间管理",
    level: "paragraph",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write a short paragraph on how college students can manage their time well. You should write around 120 words.",
    requirements: ["给出至少两条具体方法"],
    suggestedWords: ["schedule", "priority", "procrastination", "efficient"],
    referenceEssay:
      "Good time management is essential for college students. First, make a clear schedule every morning and put the most important tasks on top. Second, avoid procrastination by breaking big tasks into small steps. Finally, leave some free time for rest, or you will easily burn out. A well-planned day makes study more efficient and life more enjoyable.",
    outline: [
      { type: "introduction", content: "时间管理重要" },
      { type: "body", content: "schedule / 拆分任务 / 休息" },
      { type: "conclusion", content: "小结" },
    ],
    scoringPoints: ["first / second / finally", "avoid procrastination"],
    mockFeedback: {
      summary: "方法具体，连接词清晰。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [100, 140],
    sourceType: "mock",
  },
  {
    id: "w-green-campus",
    title: "绿色校园",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on how to build a green campus. You should write at least 150 words but no more than 200 words.",
    requirements: ["学生能做什么", "学校能做什么"],
    suggestedWords: [
      "green campus",
      "save energy",
      "recycle",
      "low-carbon",
      "joint effort",
    ],
    referenceEssay:
      "Building a green campus requires the joint effort of both the university and its students. For the university, more recycling bins, energy-saving lights and green spaces can be put in place. For students, small actions matter: turning off lights when leaving, using reusable bottles and taking stairs instead of lifts. A green campus is not a slogan; it is a habit we practise every single day.",
    outline: [
      { type: "introduction", content: "需要共同努力" },
      { type: "body", content: "学校措施 + 学生行动" },
      { type: "conclusion", content: "绿色校园是日常习惯" },
    ],
    scoringPoints: ["joint effort", "reusable bottles", "not a slogan"],
    mockFeedback: {
      summary: "层次清楚，结尾点题有力。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
  {
    id: "w-life-long-learning",
    title: "终身学习",
    level: "essay",
    prompt:
      "Directions: For this part, you are allowed 30 minutes to write an essay on why college students should develop a habit of lifelong learning. You should write at least 150 words but no more than 200 words.",
    requirements: ["为什么重要", "怎么做"],
    suggestedWords: [
      "lifelong learning",
      "keep up with",
      "curiosity",
      "adapt",
      "grow",
    ],
    referenceEssay:
      "In a rapidly changing society, knowledge can quickly become outdated. Lifelong learning, therefore, is no longer a choice but a necessity. For college students, it means staying curious, reading widely and keeping up with new developments both inside and outside the major. Learning does not end at graduation; it is a way of growing that lasts a lifetime. The more we learn, the more confident we become.",
    outline: [
      { type: "introduction", content: "知识更新快" },
      { type: "body", content: "保持好奇、广泛阅读" },
      { type: "conclusion", content: "学习伴随一生" },
    ],
    scoringPoints: ["the more...the more...", "staying curious", "首尾呼应"],
    mockFeedback: {
      summary: "立意积极，结尾句式漂亮。",
      issues: [],
      details: [],
    },
    suggestedWordsRange: [150, 200],
    sourceType: "mock",
  },
];

export function writingTaskById(id: string): WritingTask | undefined {
  return mockWritingTasks.find((t) => t.id === id);
}
