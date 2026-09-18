import type {
  ReadingArticle,
  ReadingDifficulty,
} from "@/types/reading";

const difficulty: ReadingDifficulty = "normal";

export const mockReadingArticles: ReadingArticle[] = [
  {
    id: "r-ai-screening",
    title: "When Algorithms Screen Résumés",
    passage:
      "Every year, large companies receive thousands of applications for a single position. To manage the flood, many firms now use software to screen résumés before a human recruiter ever sees them. The programs scan for keywords, measure how closely a candidate's experience matches the job description, and rank applicants in seconds. Supporters also point out that a machine never forgets a deadline and never skips a file by accident.\n\n" +
      "Supporters argue that such tools make hiring faster and more consistent. A machine does not grow tired at the end of the day, and it applies the same standard to every file. Yet researchers warn that the technology can be quietly unfair. If the program is trained on the records of past employees, it may learn patterns that have little to do with ability. A candidate who used a less common job title, or who attended a less famous university, could be filtered out before a person has a chance to weigh the evidence.\n\n" +
      "There is also the question of feedback. A rejected applicant who understands the reason can improve the next application; one who faces a silent system may simply give up. For this reason, some specialists suggest a middle path: software narrows the list, and a small team interviews the final few. Some firms even pair every automated decision with a named human contact, so that applicants always know whom to ask.\n\n" +
      "Transparency, experts say, does not remove every risk, but it forces firms to examine their own assumptions. The goal is not to abandon automation but to keep a human voice in decisions that shape people's lives.",
    difficulty,
    estimatedMinutes: 7,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Screening software can save time but needs careful human oversight.",
          },
          {
            id: "b",
            text: "Screening software always ranks candidates fairly.",
          },
          {
            id: "c",
            text: "Companies should stop using software in hiring.",
          },
          {
            id: "d",
            text: "Job descriptions have become harder to understand.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "文章既肯定筛选用软件节省时间，也指出偏差风险，并主张保留人工判断，因此 A 最全面。",
        detailedExplanation:
          "第一段说明软件让筛选变快；第二段以 yet 转折，指出它可能学自过去员工的记录而产生偏差；第三、四段强调反馈与透明度。B 的 always 过于绝对，C 与最后一段“不是放弃自动化”矛盾，D 与主题无关。",
        hint: "把每段的关键句连起来看：软件省时、可能不公、反馈重要、保留人的判断。",
      },
      {
        id: "q2",
        prompt: "Why might screening software be unfair, according to researchers?",
        options: [
          {
            id: "a",
            text: "It compares candidates with employees from unrelated companies.",
          },
          {
            id: "b",
            text: "It may copy patterns from past employees that are unrelated to ability.",
          },
          {
            id: "c",
            text: "It rejects every applicant from less famous universities.",
          },
          {
            id: "d",
            text: "It grows tired after working for many hours.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "软件从过去员工的记录中学习，可能学到与能力无关的模式，从而把合格者筛掉。",
        detailedExplanation:
          "原文指出“If the program is trained on the records of past employees, it may learn patterns that have little to do with ability”。C 的 every 过于绝对；A、D 在原文没有依据。",
        hint: "留意第二段中“trained on the records of past employees”这一条件句。",
      },
      {
        id: "q3",
        prompt: "What middle path do specialists suggest?",
        options: [
          {
            id: "a",
            text: "Ask machines to make the final decision alone.",
          },
          {
            id: "b",
            text: "Let software narrow the list and a small team interview the final few.",
          },
          {
            id: "c",
            text: "Reject all applications before they reach a recruiter.",
          },
          {
            id: "d",
            text: "Publish every hiring decision online.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "专家建议软件缩小候选名单，再由小团队面试最后几名候选人。",
        detailedExplanation:
          "第三段原文为“software narrows the list, and a small team interviews the final few”。A 与保留人工判断的主张相反；C、D 原文未提及。",
        hint: "找到第三段中的“a middle path”后面的具体做法。",
      },
      {
        id: "q4",
        prompt: "What is the author's attitude toward automated screening?",
        options: [
          { id: "a", text: "Completely opposed." },
          { id: "b", text: "Uninterested." },
          { id: "c", text: "Balanced and cautious." },
          { id: "d", text: "Highly enthusiastic." },
        ],
        answerId: "c",
        shortExplanation:
          "作者既承认软件的价值，又指出风险并给出改进建议，态度平衡而谨慎。",
        detailedExplanation:
          "文章同时呈现支持与警告两方面的观点，最后强调“keep a human voice”，属于有保留的支持。A、D 都过于极端，B 与文章认真分析的态度不符。",
        hint: "看看作者是否只讲了一面：支持与风险分别出现在哪些段落？",
      },
    ],
    vocabulary: {
      screen: {
        word: "screen",
        phonetic: "/skriːn/",
        partOfSpeech: "v.",
        meaning: "筛选；甄别",
        sentence:
          "many firms now use software to screen résumés before a human recruiter ever sees them.",
        sentenceTranslation: "许多公司现在用软件先筛选简历，然后才轮到人类招聘者查看。",
      },
      flood: {
        word: "flood",
        phonetic: "/flʌd/",
        partOfSpeech: "n.",
        meaning: "大量；泛滥",
        sentence: "To manage the flood, many firms now use software to screen résumés.",
        sentenceTranslation: "为了应对大量涌入的申请，许多公司现在用软件筛选简历。",
      },
      applicant: {
        word: "applicant",
        phonetic: "/ˈæplɪkənt/",
        partOfSpeech: "n.",
        meaning: "申请人",
        sentence:
          "A rejected applicant who understands the reason can improve the next application.",
        sentenceTranslation: "知道被拒原因的申请人可以改进下一次申请。",
      },
      consistent: {
        word: "consistent",
        phonetic: "/kənˈsɪstənt/",
        partOfSpeech: "adj.",
        meaning: "一致的；稳定的",
        sentence: "Supporters argue that such tools make hiring faster and more consistent.",
        sentenceTranslation: "支持者认为这类工具让招聘更快、更一致。",
      },
      unfair: {
        word: "unfair",
        phonetic: "/ʌnˈfeər/",
        partOfSpeech: "adj.",
        meaning: "不公平的",
        sentence: "Yet researchers warn that the technology can be quietly unfair.",
        sentenceTranslation: "然而研究人员警告说，这项技术可能在不知不觉中变得不公平。",
      },
      transparency: {
        word: "transparency",
        phonetic: "/trænsˈpærənsi/",
        partOfSpeech: "n.",
        meaning: "透明；公开",
        sentence: "Transparency, experts say, does not remove every risk.",
        sentenceTranslation: "专家说，透明并不能消除所有风险。",
      },
      automation: {
        word: "automation",
        phonetic: "/ˌɔːtəˈmeɪʃn/",
        partOfSpeech: "n.",
        meaning: "自动化",
        sentence:
          "The goal is not to abandon automation but to keep a human voice in decisions.",
        sentenceTranslation: "目标不是放弃自动化，而是在决策中保留人的声音。",
      },
    },
  },
  {
    id: "r-plastic-cost",
    title: "The Price of Convenience",
    passage:
      "Walk into almost any supermarket and you will see food wrapped in plastic: cucumbers in film, apples in bags, sauces in single-portion cups. This packaging keeps products fresh and makes them easy to carry, and most shoppers never stop to question it. Few shoppers check the fine print on the package, and fewer still wonder where the wrapper will end up. Yet the bill for this convenience arrives later, in the form of waste that takes centuries to break down.\n\n" +
      "Recycling was once presented as the answer. Many packages carry a small arrow symbol, and consumers are told to place them in the recycling bin. In practice, however, a large share of plastic waste is never recycled. It is mixed with other materials, contaminated by food, or sent to places that lack the facilities to process it. The symbol, critics say, can create a false sense of progress.\n\n" +
      "Some companies have begun to design packaging that can be reused or truly recycled, and a growing number of cities charge for plastic bags. Change is possible, but it rarely comes from a single step. It depends on clearer rules, better collection systems, and honest labels that tell consumers what will actually happen to the packaging they buy.\n\n" +
      "Consumers play a part as well. Choosing unpackaged fruit, carrying a reusable bottle, and refusing single-portion cups are small habits that add up. None of these actions is dramatic by itself, yet together they send a signal that convenience should not come at the cost of the planet.",
    difficulty,
    estimatedMinutes: 6,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Plastic packaging is convenient, and recycling has already solved its problems.",
          },
          {
            id: "b",
            text: "The convenience of plastic packaging hides environmental costs that recycling alone cannot solve.",
          },
          {
            id: "c",
            text: "Supermarkets should stop selling fresh food.",
          },
          {
            id: "d",
            text: "Consumers should never buy anything wrapped in plastic.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "文章指出塑料包装的便利背后是难以降解的浪费，且回收并未真正解决问题。",
        detailedExplanation:
          "第一段提出便利与代价的对比；第二段说明回收的实际情况与承诺不符；第三段给出需要多环节配合的改变方向。A 与第二段矛盾，C、D 过于极端。",
        hint: "注意第一段的 yet 和第三段的 depends on，它们分别引出问题与解决方向。",
      },
      {
        id: "q2",
        prompt: "Why is a large share of plastic waste never recycled?",
        options: [
          {
            id: "a",
            text: "Because all plastic breaks down within a few years.",
          },
          {
            id: "b",
            text: "Because recycling bins are rarely placed near supermarkets.",
          },
          {
            id: "c",
            text: "Because the waste is mixed with other materials, contaminated, or sent where it cannot be processed.",
          },
          {
            id: "d",
            text: "Because consumers are not interested in recycling at all.",
          },
        ],
        answerId: "c",
        shortExplanation:
          "塑料垃圾常与其他材料混合、被食物污染，或被送到缺乏处理设施的地方。",
        detailedExplanation:
          "第二段原文列举了三个原因：mixed with other materials、contaminated by food、sent to places that lack the facilities。A 与第一段“需要数百年分解”矛盾；B、D 原文未提及。",
        hint: "在第二段中找到“In practice, however”后面的三个并列原因。",
      },
      {
        id: "q3",
        prompt: "What do critics say about the recycling symbol on packages?",
        options: [
          {
            id: "a",
            text: "It proves the packaging will definitely be recycled.",
          },
          {
            id: "b",
            text: "It can create a false sense of progress.",
          },
          {
            id: "c",
            text: "It makes packages harder to open.",
          },
          {
            id: "d",
            text: "It increases the cost of every product.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "批评者认为回收标志可能让人误以为问题正在解决，形成虚假的进展感。",
        detailedExplanation:
          "第二段末句“The symbol, critics say, can create a false sense of progress”。A 与实际情况相反；C、D 原文未提及。",
        hint: "定位到“critics say”之后，看看他们如何评价这个符号。",
      },
      {
        id: "q4",
        prompt: "According to the last paragraph, what does real change depend on?",
        options: [
          {
            id: "a",
            text: "One single impressive step from a large company.",
          },
          {
            id: "b",
            text: "Consumers stopping all purchases of packaged food.",
          },
          {
            id: "c",
            text: "Clearer rules, better collection systems, and honest labels.",
          },
          {
            id: "d",
            text: "Governments banning plastic completely within a year.",
          },
        ],
        answerId: "c",
        shortExplanation:
          "改变依赖更清晰的规则、更好的回收系统和诚实的标签，而不是单一步骤。",
        detailedExplanation:
          "最后一段明确“It depends on clearer rules, better collection systems, and honest labels”。A 与“rarely comes from a single step”相反；B、D 过于极端且无原文依据。",
        hint: "最后一句中的 depends on 后面就是答案要点。",
      },
    ],
    vocabulary: {
      wrapped: {
        word: "wrapped",
        phonetic: "/ræpt/",
        partOfSpeech: "v.",
        meaning: "包裹（wrap 的过去分词）",
        sentence:
          "Walk into almost any supermarket and you will see food wrapped in plastic.",
        sentenceTranslation: "走进几乎任何一家超市，你都会看到用塑料包裹的食物。",
      },
      convenience: {
        word: "convenience",
        phonetic: "/kənˈviːniəns/",
        partOfSpeech: "n.",
        meaning: "便利；方便",
        sentence: "Yet the bill for this convenience arrives later.",
        sentenceTranslation: "然而，这种便利的账单稍后就会到来。",
      },
      contaminated: {
        word: "contaminated",
        phonetic: "/kənˈtæmɪneɪtɪd/",
        partOfSpeech: "adj.",
        meaning: "被污染的",
        sentence: "It is mixed with other materials, contaminated by food.",
        sentenceTranslation: "它与其他材料混在一起，被食物污染。",
      },
      facilities: {
        word: "facilities",
        phonetic: "/fəˈsɪlətiz/",
        partOfSpeech: "n.",
        meaning: "设施（facility 的复数）",
        sentence: "or sent to places that lack the facilities to process it.",
        sentenceTranslation: "或者被送到缺乏处理设施的地方。",
      },
      symbol: {
        word: "symbol",
        phonetic: "/ˈsɪmbl/",
        partOfSpeech: "n.",
        meaning: "符号；标志",
        sentence: "Many packages carry a small arrow symbol.",
        sentenceTranslation: "许多包装上都印有一个小箭头符号。",
      },
      reused: {
        word: "reused",
        phonetic: "/ˌriːˈjuːzd/",
        partOfSpeech: "v.",
        meaning: "重复使用（reuse 的过去分词）",
        sentence: "Some companies have begun to design packaging that can be reused.",
        sentenceTranslation: "一些公司已经开始设计可以重复使用的包装。",
      },
      charge: {
        word: "charge",
        phonetic: "/tʃɑːdʒ/",
        partOfSpeech: "v.",
        meaning: "收费",
        sentence: "a growing number of cities charge for plastic bags.",
        sentenceTranslation: "越来越多的城市对塑料袋收费。",
      },
    },
  },
  {
    id: "r-remote-isolation",
    title: "The Quiet Side of Remote Work",
    passage:
      "After months of working from home, many employees report that they save time, avoid traffic, and enjoy more flexible hours. Surveys also show, however, a quieter side of the arrangement: a growing sense of isolation. Without the small exchanges of an office—greetings at the door, questions at a desk, coffee breaks shared with colleagues—some workers begin to feel invisible to their teams.\n\n" +
      "Managers have tried different remedies. Some schedule a short daily video call just to check in; others create online channels where people can share news that is not strictly work-related. These efforts help, but they do not always replace the accidental conversations where problems are solved and trust is built.\n\n" +
      "Researchers who study workplace relationships note that isolation is not simply a matter of loneliness. When people feel cut off, they may hesitate to ask for help, and small misunderstandings can grow into larger conflicts. A team that communicates only through formal meetings may miss the early signs of stress.\n\n" +
      "The lesson is not that remote work is wrong. For many, it has been a relief. The task ahead is to design work in a way that keeps its benefits while protecting the informal connections that make teams function. The goal is not to copy the office online, but to notice when connections are fading and to act before they disappear. Companies that manage this well often treat small routines—a weekly coffee call, a shared joke channel—as seriously as formal projects. In the end, the best remote teams are not the busiest, but the most connected.",
    difficulty,
    estimatedMinutes: 6,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Remote work saves time, so its drawbacks do not matter.",
          },
          {
            id: "b",
            text: "Remote work brings isolation, and companies should abandon it.",
          },
          {
            id: "c",
            text: "Remote work has benefits but risks isolating workers, so informal connections need protection.",
          },
          {
            id: "d",
            text: "Video calls have completely solved the problems of remote work.",
          },
        ],
        answerId: "c",
        shortExplanation:
          "文章既肯定远程办公的好处，又指出孤独风险，并强调要保护非正式联系。",
        detailedExplanation:
          "第一段点出隔离问题；第二、三段分析原因与后果；最后一段说明远程办公并非错误，关键在于设计。A 忽略风险，B 与最后一段相反，D 与第二段“help, but…”矛盾。",
        hint: "把第一段和最后一段连起来读，作者对远程办公整体持什么态度？",
      },
      {
        id: "q2",
        prompt: "Which of the following is an example of the small office exchanges mentioned?",
        options: [
          {
            id: "a",
            text: "A formal annual performance review.",
          },
          {
            id: "b",
            text: "Greetings at the door and questions at a desk.",
          },
          {
            id: "c",
            text: "A company-wide announcement by email.",
          },
          {
            id: "d",
            text: "An online course about workplace safety.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "开门时的问候、桌边的提问、与同事分享的咖啡时间都是文中所说的小型交流。",
        detailedExplanation:
          "第一段破折号内的例子即为答案：greetings at the door、questions at a desk、coffee breaks。A、C、D 属于正式安排，不符合“小交流”的特征。",
        hint: "在第一段中找到破折号后面的并列例子。",
      },
      {
        id: "q3",
        prompt: "Why is isolation more than simple loneliness, according to researchers?",
        options: [
          {
            id: "a",
            text: "Because lonely workers usually prefer to work longer hours.",
          },
          {
            id: "b",
            text: "Because it may stop people asking for help and let misunderstandings grow.",
          },
          {
            id: "c",
            text: "Because formal meetings always cause stress.",
          },
          {
            id: "d",
            text: "Because remote workers cannot learn new skills.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "感到被隔离的人可能不愿求助，小误会也会发展成更大的冲突。",
        detailedExplanation:
          "第三段原文“they may hesitate to ask for help, and small misunderstandings can grow into larger conflicts”。A、D 无依据；C 的 always 过于绝对。",
        hint: "在第三段中找到“may hesitate to”和“grow into”两处关键词。",
      },
      {
        id: "q4",
        prompt: "What does the author suggest in the last paragraph?",
        options: [
          {
            id: "a",
            text: "Remote work should be replaced by office work completely.",
          },
          {
            id: "b",
            text: "Teams should meet in person every single day.",
          },
          {
            id: "c",
            text: "Work should be designed to keep benefits while protecting informal connections.",
          },
          {
            id: "d",
            text: "Informal connections are impossible to maintain.",
          },
        ],
        answerId: "c",
        shortExplanation:
          "作者建议设计工作方式，保留远程办公的好处，同时保护让团队运转的非正式联系。",
        detailedExplanation:
          "最后一段“design work in a way that keeps its benefits while protecting the informal connections”。A、B 与文意相反；D 过于悲观且无依据。",
        hint: "最后一段的“The task ahead is to…”就是作者给出的方向。",
      },
    ],
    vocabulary: {
      isolation: {
        word: "isolation",
        phonetic: "/ˌaɪsəˈleɪʃn/",
        partOfSpeech: "n.",
        meaning: "孤独；隔离",
        sentence: "a quieter side of the arrangement: a growing sense of isolation.",
        sentenceTranslation: "这种安排还有安静的另一面：越来越强烈的孤独感。",
      },
      exchanges: {
        word: "exchanges",
        phonetic: "/ɪksˈtʃeɪndʒɪz/",
        partOfSpeech: "n.",
        meaning: "交流（exchange 的复数）",
        sentence: "Without the small exchanges of an office, some workers begin to feel invisible.",
        sentenceTranslation: "没有了办公室里的日常交流，一些员工开始感到自己被忽视。",
      },
      invisible: {
        word: "invisible",
        phonetic: "/ɪnˈvɪzəbl/",
        partOfSpeech: "adj.",
        meaning: "看不见的；被忽视的",
        sentence: "some workers begin to feel invisible to their teams.",
        sentenceTranslation: "一些员工开始觉得自己在团队中无足轻重。",
      },
      remedies: {
        word: "remedies",
        phonetic: "/ˈremədiz/",
        partOfSpeech: "n.",
        meaning: "补救措施（remedy 的复数）",
        sentence: "Managers have tried different remedies.",
        sentenceTranslation: "管理者尝试了不同的补救措施。",
      },
      accidental: {
        word: "accidental",
        phonetic: "/ˌæksɪˈdentl/",
        partOfSpeech: "adj.",
        meaning: "偶然的；意外的",
        sentence:
          "they do not always replace the accidental conversations where problems are solved.",
        sentenceTranslation: "它们并不总能替代那些偶然而又解决问题、建立信任的对话。",
      },
      conflicts: {
        word: "conflicts",
        phonetic: "/ˈkɒnflɪkts/",
        partOfSpeech: "n.",
        meaning: "冲突（conflict 的复数）",
        sentence: "small misunderstandings can grow into larger conflicts.",
        sentenceTranslation: "小小的误会可能演变成更大的冲突。",
      },
      relief: {
        word: "relief",
        phonetic: "/rɪˈliːf/",
        partOfSpeech: "n.",
        meaning: "解脱；宽慰",
        sentence: "For many, it has been a relief.",
        sentenceTranslation: "对许多人来说，这是一种解脱。",
      },
    },
  },
  {
    id: "r-micro-learning",
    title: "Learning in Short Bursts",
    passage:
      "Universities have long been built around the long lecture: an hour or more of one person speaking while students take notes. A growing number of educators now question this format, pointing to evidence that attention fades quickly and that long sessions may not be the most efficient way to learn.\n\n" +
      "In response, some courses have been redesigned around shorter segments. A two-hour class becomes several focused blocks, each followed by a quick activity that asks students to apply what they have just heard. Supporters say the approach matches the way memory works: we remember more when we practice soon after learning, and we learn better when the material is divided into manageable pieces. Teachers who try this format often say that planning the activity matters more than choosing the length of the video.\n\n" +
      "Technology has made the idea easier to test. Online courses can measure exactly when students stop watching a video, and many platforms now break lessons into segments of ten minutes or less. The results are not always dramatic, but they have encouraged teachers to think about time as a learning resource rather than a fixed container.\n\n" +
      "Critics warn that splitting material into small pieces is not the same as understanding it. A list of short videos, they argue, can feel easy without building the deep thinking that a long discussion provides. A course can also mix formats: a ten-minute video to introduce a topic, a problem set to test it, and a seminar to argue about it. The best designs, it seems, combine both: short input, then real practice, then time to talk.",
    difficulty,
    estimatedMinutes: 7,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Long lectures are the only effective way to teach university students.",
          },
          {
            id: "b",
            text: "Shorter learning segments with practice may improve learning, but balance is needed.",
          },
          {
            id: "c",
            text: "Online courses always produce better results than classroom teaching.",
          },
          {
            id: "d",
            text: "Students should never take notes during a lecture.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "文章支持把学习切分为更短的片段并配合练习，同时提醒不能只求轻松，需要平衡。",
        detailedExplanation:
          "第二段说明短片段配合练习符合记忆规律；第三段给出技术验证；第四段提醒碎片化不等于理解，好的设计要结合输入、练习与讨论。A、C 过于绝对，D 无依据。",
        hint: "分别看支持者与批评者的观点，最后一段的“combine both”是结论。",
      },
      {
        id: "q2",
        prompt: "Why do some educators question the long lecture format?",
        options: [
          {
            id: "a",
            text: "Because lectures have become too expensive to organize.",
          },
          {
            id: "b",
            text: "Because attention fades quickly and long sessions may be inefficient.",
          },
          {
            id: "c",
            text: "Because students refuse to take notes anymore.",
          },
          {
            id: "d",
            text: "Because there are too few professors available.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "教育者质疑长讲座是因为注意力消退很快，长时段的效率未必最高。",
        detailedExplanation:
          "第一段原文“attention fades quickly and that long sessions may not be the most efficient way to learn”。A、C、D 均未在原文出现。",
        hint: "在第一段中找到“question this format”后的原因说明。",
      },
      {
        id: "q3",
        prompt: "How has technology helped test the idea of short learning segments?",
        options: [
          {
            id: "a",
            text: "It can measure when students stop watching and split lessons into short segments.",
          },
          {
            id: "b",
            text: "It makes all students learn at exactly the same speed.",
          },
          {
            id: "c",
            text: "It removes the need for teachers completely.",
          },
          {
            id: "d",
            text: "It guarantees every student a perfect grade.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "在线课程能精确测量学生何时停止观看，许多平台也把课程拆成十分钟以内的片段。",
        detailedExplanation:
          "第三段原文“measure exactly when students stop watching a video”与“break lessons into segments of ten minutes or less”。B、D 过于绝对，C 无依据。",
        hint: "在第三段中找“measure”与“break”两个动词对应的内容。",
      },
      {
        id: "q4",
        prompt: "What do the best course designs combine, according to the passage?",
        options: [
          {
            id: "a",
            text: "Short input, real practice, and time to talk.",
          },
          {
            id: "b",
            text: "Long lectures followed by online quizzes.",
          },
          {
            id: "c",
            text: "Videos without any practice or discussion.",
          },
          {
            id: "d",
            text: "Strict deadlines and longer homework.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "最好的设计把短输入、真实练习和讨论时间结合起来。",
        detailedExplanation:
          "最后一句“combine both: short input, then real practice, then time to talk”。B 与文章批评长讲座的立场不符；C、D 无依据。",
        hint: "最后一段冒号后面的三个步骤就是答案。",
      },
    ],
    vocabulary: {
      lecture: {
        word: "lecture",
        phonetic: "/ˈlektʃə(r)/",
        partOfSpeech: "n.",
        meaning: "讲座；大课",
        sentence:
          "Universities have long been built around the long lecture.",
        sentenceTranslation: "大学长期以来都是围绕长时间的大课建立的。",
      },
      fades: {
        word: "fades",
        phonetic: "/feɪdz/",
        partOfSpeech: "v.",
        meaning: "消退（fade 的第三人称单数）",
        sentence: "attention fades quickly.",
        sentenceTranslation: "注意力消退得很快。",
      },
      segments: {
        word: "segments",
        phonetic: "/ˈseɡmənts/",
        partOfSpeech: "n.",
        meaning: "片段（segment 的复数）",
        sentence: "some courses have been redesigned around shorter segments.",
        sentenceTranslation: "一些课程被重新设计成更短的片段。",
      },
      apply: {
        word: "apply",
        phonetic: "/əˈplaɪ/",
        partOfSpeech: "v.",
        meaning: "应用；运用",
        sentence: "each followed by a quick activity that asks students to apply what they have just heard.",
        sentenceTranslation: "每个片段之后都跟着一个快速活动，要求学生运用刚刚听到的内容。",
      },
      manageable: {
        word: "manageable",
        phonetic: "/ˈmænɪdʒəbl/",
        partOfSpeech: "adj.",
        meaning: "可管理的；可应付的",
        sentence: "we learn better when the material is divided into manageable pieces.",
        sentenceTranslation: "当材料被分成易于掌握的片段时，我们学得更好。",
      },
      dramatic: {
        word: "dramatic",
        phonetic: "/drəˈmætɪk/",
        partOfSpeech: "adj.",
        meaning: "显著的；戏剧性的",
        sentence: "The results are not always dramatic.",
        sentenceTranslation: "结果并不总是那么显著。",
      },
      combine: {
        word: "combine",
        phonetic: "/kəmˈbaɪn/",
        partOfSpeech: "v.",
        meaning: "结合；组合",
        sentence: "The best designs, it seems, combine both.",
        sentenceTranslation: "看起来，最好的设计把两者结合起来。",
      },
    },
  },
  {
    id: "r-sleep-study",
    title: "Sleep Is Part of Studying",
    passage:
      "Students often treat sleep as the first thing they can give up. A deadline approaches, so the night becomes shorter; an exam is near, so coffee replaces rest. The habit is easy to explain: there is always more to review and never enough hours. Yet a large body of research points in the opposite direction: sleep is not a break from learning but an active part of it.\n\n" +
      "During deep sleep, the brain replays the day's experiences and strengthens the connections that matter. Memories formed while awake are sorted and stored, and skills practiced during the day become smoother overnight. Studies have shown that people who sleep after studying a list of words remember more than those who stay awake, even if the awake group spends the extra hours reviewing. In one well-known experiment, students who napped after class solved problems faster than those who did not, even though both groups had learned the same material.\n\n" +
      "The practical advice that follows is simple but often ignored. Regular bedtimes matter more than occasional long nights of rest. A short nap can help, but it cannot replace the full cycle of sleep. And pulling an all-nighter before an exam usually produces the opposite of the intended effect: slower thinking, weaker recall, and greater stress. The advice applies to exams of every kind, from a weekly quiz to a final paper.\n\n" +
      "None of this means students should study less. It means they should plan sleep the way they plan classes, treating it as part of the timetable rather than as an obstacle to it.",
    difficulty,
    estimatedMinutes: 6,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Sleep is an active part of learning, so students should treat it as part of their timetable.",
          },
          {
            id: "b",
            text: "Students should give up sleep whenever an exam is approaching.",
          },
          {
            id: "c",
            text: "Coffee is more effective than sleep for remembering words.",
          },
          {
            id: "d",
            text: "Studying less is the best way to improve grades.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "文章认为睡眠是学习的主动组成部分，学生应把它当作时间表的一部分。",
        detailedExplanation:
          "第一段提出“sleep is not a break from learning but an active part of it”；第二段用实验支持；最后一段给出把睡眠列入时间表的建议。B 与文章相反，C、D 无依据。",
        hint: "把第一段的“yet”后面和最后一段的“means”后面的内容连起来。",
      },
      {
        id: "q2",
        prompt: "What happens during deep sleep, according to the passage?",
        options: [
          {
            id: "a",
            text: "The brain forgets everything learned during the day.",
          },
          {
            id: "b",
            text: "The brain replays the day's experiences and strengthens important connections.",
          },
          {
            id: "c",
            text: "The body stops all activity completely.",
          },
          {
            id: "d",
            text: "Memories are permanently erased.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "深睡时大脑回放白天的经历，并加强重要的神经连接。",
        detailedExplanation:
          "第二段开头“the brain replays the day's experiences and strengthens the connections that matter”。A、D 与文意相反，C 过度绝对。",
        hint: "在第二段开头找“replays”和“strengthens”对应的内容。",
      },
      {
        id: "q3",
        prompt: "What did the study about word lists show?",
        options: [
          {
            id: "a",
            text: "People who reviewed words all night remembered more.",
          },
          {
            id: "b",
            text: "People who stayed awake performed better on the test.",
          },
          {
            id: "c",
            text: "People who slept after studying remembered more than those who stayed awake.",
          },
          {
            id: "d",
            text: "Sleep had no effect on memory at all.",
          },
        ],
        answerId: "c",
        shortExplanation:
          "学完单词后睡觉的人比保持清醒（即使清醒者在复习）的人记住更多。",
        detailedExplanation:
          "第二段原文“people who sleep after studying a list of words remember more than those who stay awake, even if the awake group spends the extra hours reviewing”。A、B、D 与原文相反。",
        hint: "注意“even if”暗示清醒组即使复习也赶不上睡眠组。",
      },
      {
        id: "q4",
        prompt: "What does an all-nighter before an exam usually produce, according to the passage?",
        options: [
          {
            id: "a",
            text: "Slower thinking, weaker recall, and greater stress.",
          },
          {
            id: "b",
            text: "A stronger memory and better focus.",
          },
          {
            id: "c",
            text: "More confidence in the exam room.",
          },
          {
            id: "d",
            text: "A longer and deeper sleep afterwards.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "考前通宵通常带来思维变慢、记忆变弱和压力增大。",
        detailedExplanation:
          "第三段原文“pulling an all-nighter before an exam usually produces the opposite of the intended effect: slower thinking, weaker recall, and greater stress”。B、C 与文意相反，D 无依据。",
        hint: "在第三段中找到冒号后面列举的三个后果。",
      },
    ],
    vocabulary: {
      deadline: {
        word: "deadline",
        phonetic: "/ˈdedlaɪn/",
        partOfSpeech: "n.",
        meaning: "截止日期",
        sentence: "A deadline approaches, so the night becomes shorter.",
        sentenceTranslation: "截止日期临近，夜晚就变得更短。",
      },
      opposite: {
        word: "opposite",
        phonetic: "/ˈɒpəzɪt/",
        partOfSpeech: "adj.",
        meaning: "相反的",
        sentence: "a large body of research points in the opposite direction.",
        sentenceTranslation: "大量研究指向相反的方向。",
      },
      replays: {
        word: "replays",
        phonetic: "/ˌriːˈpleɪz/",
        partOfSpeech: "v.",
        meaning: "回放；重放（replay 的第三人称单数）",
        sentence: "the brain replays the day's experiences.",
        sentenceTranslation: "大脑回放白天的经历。",
      },
      strengthens: {
        word: "strengthens",
        phonetic: "/ˈstreŋθnz/",
        partOfSpeech: "v.",
        meaning: "加强（strengthen 的第三人称单数）",
        sentence: "and strengthens the connections that matter.",
        sentenceTranslation: "并加强重要的连接。",
      },
      recall: {
        word: "recall",
        phonetic: "/rɪˈkɔːl/",
        partOfSpeech: "n.",
        meaning: "记忆；回忆",
        sentence: "slower thinking, weaker recall, and greater stress.",
        sentenceTranslation: "思维变慢、记忆变弱、压力增大。",
      },
      obstacle: {
        word: "obstacle",
        phonetic: "/ˈɒbstəkl/",
        partOfSpeech: "n.",
        meaning: "障碍",
        sentence: "treating it as part of the timetable rather than as an obstacle to it.",
        sentenceTranslation: "把它当作时间表的一部分，而不是时间表的障碍。",
      },
    },
  },
  {
    id: "r-food-home",
    title: "Taste of Home, Far From Home",
    passage:
      "For immigrants, food is often the most portable piece of home. A recipe travels across borders inside a person's memory, carrying flavors that no textbook can describe. In many cities, small shops have appeared that sell familiar vegetables, spices and sauces, and weekend kitchens turn into gathering places where newcomers cook the dishes of their childhood.\n\n" +
      "These kitchens do more than feed people. They preserve languages, since recipes and family stories are exchanged in the mother tongue. They create work for people whose qualifications may not be recognized in a new country. And they build bridges: curious neighbors arrive, taste something unfamiliar, ask questions, and leave with a small connection to a culture they had only read about.\n\n" +
      "For young people born in the new country, these kitchens can be a door back to a history they half-remember. A grandmother's dish, passed down and cooked together, turns a distant tradition into something they can touch. In that way, food does what old photographs often cannot: it makes memory something you can eat, share, and pass on.\n\n" +
      "Researchers who study migration describe food as a form of memory made public. A dish can hold the taste of a grandmother's kitchen, the sound of a crowded market, or the warmth of a festival. Sharing it does not dilute its meaning; instead, it allows a personal history to become part of a shared city.\n\n" +
      "The next time a food stall opens in your neighborhood, the smell may tell a longer story than any sign on the street.",
    difficulty,
    estimatedMinutes: 6,
    sourceType: "mock",
    questions: [
      {
        id: "q1",
        prompt: "What is the main idea of the passage?",
        options: [
          {
            id: "a",
            text: "Immigrant food preserves memory, builds community, and connects cultures.",
          },
          {
            id: "b",
            text: "Immigrant food has become more expensive than local food.",
          },
          {
            id: "c",
            text: "Recipes should be kept secret within each family.",
          },
          {
            id: "d",
            text: "Restaurants are the only places where immigrant food is sold.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "文章讲述移民食物承载记忆、建立社区联系并连接文化。",
        detailedExplanation:
          "第一段讲食物随身携带家乡记忆；第二段说明周末厨房保存语言、创造工作、架起桥梁；第三段把食物称为公开的记忆。B、D 无依据，C 与“分享不会稀释意义”相反。",
        hint: "注意第二段的“do more than feed people”之后列举的三件事。",
      },
      {
        id: "q2",
        prompt: "What do weekend kitchens do besides feeding people?",
        options: [
          {
            id: "a",
            text: "They only sell spices to local supermarkets.",
          },
          {
            id: "b",
            text: "They preserve languages, create work, and build bridges between cultures.",
          },
          {
            id: "c",
            text: "They replace schools in immigrant neighborhoods.",
          },
          {
            id: "d",
            text: "They prevent newcomers from learning the local language.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "周末厨房保存语言、创造就业，并在不同文化之间架起桥梁。",
        detailedExplanation:
          "第二段用“They preserve languages”“They create work”“And they build bridges”三个排比句说明。A、C、D 均与原文不符。",
        hint: "在第二段中找到三个以“They”开头的句子。",
      },
      {
        id: "q3",
        prompt: "How do researchers describe food in the study of migration?",
        options: [
          {
            id: "a",
            text: "As a form of memory made public.",
          },
          {
            id: "b",
            text: "As the cheapest way to travel.",
          },
          {
            id: "c",
            text: "As a private family secret.",
          },
          {
            id: "d",
            text: "As a replacement for written history.",
          },
        ],
        answerId: "a",
        shortExplanation:
          "研究移民的学者把食物描述为一种公开化的记忆。",
        detailedExplanation:
          "第三段原文“researchers who study migration describe food as a form of memory made public”。B、D 无依据，C 与“made public”相反。",
        hint: "在第三段开头找“describe food as”后面的内容。",
      },
      {
        id: "q4",
        prompt: "What does the last sentence suggest about a food stall's smell?",
        options: [
          {
            id: "a",
            text: "It is usually unpleasant to neighbors.",
          },
          {
            id: "b",
            text: "It can carry a richer story than the sign on the street.",
          },
          {
            id: "c",
            text: "It shows the food is no longer fresh.",
          },
          {
            id: "d",
            text: "It tells people exactly what is inside every dish.",
          },
        ],
        answerId: "b",
        shortExplanation:
          "摊位的气味可能比街上的招牌讲述更长的故事。",
        detailedExplanation:
          "最后一句“the smell may tell a longer story than any sign on the street”呼应全文：气味承载着记忆与文化。A、C、D 均与文意相反或无关。",
        hint: "把“tell a longer story”与全文关于记忆的比喻联系起来。",
      },
    ],
    vocabulary: {
      portable: {
        word: "portable",
        phonetic: "/ˈpɔːtəbl/",
        partOfSpeech: "adj.",
        meaning: "便携的；可随身携带的",
        sentence: "food is often the most portable piece of home.",
        sentenceTranslation: "食物往往是家乡最便携的部分。",
      },
      recipe: {
        word: "recipe",
        phonetic: "/ˈresəpi/",
        partOfSpeech: "n.",
        meaning: "食谱；配方",
        sentence: "A recipe travels across borders inside a person's memory.",
        sentenceTranslation: "食谱藏在人的记忆里跨越国界。",
      },
      preserve: {
        word: "preserve",
        phonetic: "/prɪˈzɜːv/",
        partOfSpeech: "v.",
        meaning: "保存；保留",
        sentence: "They preserve languages, since recipes and family stories are exchanged in the mother tongue.",
        sentenceTranslation: "它们保存语言，因为食谱和家庭故事都是用母语交流的。",
      },
      qualifications: {
        word: "qualifications",
        phonetic: "/ˌkwɒlɪfɪˈkeɪʃnz/",
        partOfSpeech: "n.",
        meaning: "资历；资格（qualification 的复数）",
        sentence: "They create work for people whose qualifications may not be recognized.",
        sentenceTranslation: "它们为资历可能不被认可的人创造工作机会。",
      },
      migration: {
        word: "migration",
        phonetic: "/maɪˈɡreɪʃn/",
        partOfSpeech: "n.",
        meaning: "迁移；移民",
        sentence: "Researchers who study migration describe food as a form of memory made public.",
        sentenceTranslation: "研究移民的学者把食物描述为一种公开化的记忆。",
      },
      dilute: {
        word: "dilute",
        phonetic: "/daɪˈluːt/",
        partOfSpeech: "v.",
        meaning: "稀释；削弱",
        sentence: "Sharing it does not dilute its meaning.",
        sentenceTranslation: "分享并不会削弱它的意义。",
      },
      stall: {
        word: "stall",
        phonetic: "/stɔːl/",
        partOfSpeech: "n.",
        meaning: "摊位",
        sentence: "The next time a food stall opens in your neighborhood.",
        sentenceTranslation: "下次当你家附近开起一个食品摊位时。",
      },
    },
  },
];

export const readingArticleById = (id: string) =>
  mockReadingArticles.find((article) => article.id === id);
