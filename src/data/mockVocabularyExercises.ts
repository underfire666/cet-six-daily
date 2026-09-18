// Curated contrasts avoid interchangeable synonyms in the same question.
export const vocabularyExercises: Record<
  string,
  { sentence: string; distractors: string[] }
> = {
  sustain: {
    sentence:
      "Without continued funding, the project cannot _____ its current level of activity.",
    distractors: ["decline", "allocate", "consume"],
  },
  feasible: {
    sentence: "The plan fits both our budget and timetable, so it is _____.",
    distractors: ["reluctant", "inevitable", "diverse"],
  },
  significant: {
    sentence: "The improvement was large enough to matter; it was _____.",
    distractors: ["reluctant", "conventional", "diverse"],
  },
  contribute: {
    sentence: "Regular reading can _____ to a wider vocabulary.",
    distractors: ["consume", "allocate", "distinguish"],
  },
  evidence: {
    sentence: "The claim needs facts that support it; it needs reliable _____.",
    distractors: ["priority", "perspective", "consequence"],
  },
  maintain: {
    sentence:
      "The machine needs regular care to _____ its performance at the same level.",
    distractors: ["consume", "decline", "allocate"],
  },
  decline: {
    sentence: "If demand falls, sales are likely to _____ rather than rise.",
    distractors: ["enhance", "contribute", "emerge"],
  },
  allocate: {
    sentence: "We must _____ a specific amount of money to each department.",
    distractors: ["interpret", "distinguish", "consume"],
  },
  inevitable: {
    sentence: "The change cannot be prevented; it is _____.",
    distractors: ["feasible", "reluctant", "accurate"],
  },
  enhance: {
    sentence:
      "The course aims to _____ students’ skills, making them better than before.",
    distractors: ["retain", "decline", "consume"],
  },
  reluctant: {
    sentence: "He did not want to leave and was _____ to say goodbye.",
    distractors: ["feasible", "sufficient", "inevitable"],
  },
  perspective: {
    sentence:
      "Try seeing the issue from another person’s point of view, or _____.",
    distractors: ["evidence", "priority", "consequence"],
  },
  emerge: {
    sentence: "As the fog clears, the mountains gradually _____ into view.",
    distractors: ["consume", "allocate", "contribute"],
  },
  regulate: {
    sentence: "The agency sets rules to _____ how companies handle waste.",
    distractors: ["consume", "emerge", "interpret"],
  },
  substantial: {
    sentence: "The repair cost was not small; it was a _____ sum.",
    distractors: ["reluctant", "diverse", "conventional"],
  },
  innovative: {
    sentence: "The design introduces a completely new approach; it is _____.",
    distractors: ["conventional", "reluctant", "inevitable"],
  },
  compensate: {
    sentence: "The extra payment is intended to _____ workers for lost income.",
    distractors: ["consume", "distinguish", "emerge"],
  },
  accurate: {
    sentence:
      "All the figures match the original records, so the report is _____.",
    distractors: ["reluctant", "diverse", "inevitable"],
  },
  distinguish: {
    sentence:
      "The two sounds are similar, but trained listeners can _____ one from the other.",
    distractors: ["allocate", "sustain", "consume"],
  },
  conventional: {
    sentence: "This method follows long-established practice; it is _____.",
    distractors: ["innovative", "reluctant", "inevitable"],
  },
  priority: {
    sentence: "The task that must come before all others is our top _____.",
    distractors: ["evidence", "perspective", "consequence"],
  },
  interpret: {
    sentence:
      "To understand the poem, readers must _____ the meaning of its images.",
    distractors: ["allocate", "consume", "sustain"],
  },
  sufficient: {
    sentence: "We have enough food for everyone; the supply is _____.",
    distractors: ["reluctant", "inevitable", "diverse"],
  },
  consequence: {
    sentence: "A result that follows an action is its _____.",
    distractors: ["priority", "evidence", "perspective"],
  },
  adapt: {
    sentence: "New students must _____ to a different way of studying.",
    distractors: ["consume", "allocate", "distinguish"],
  },
  crucial: {
    sentence: "The final step is essential to success; it is _____.",
    distractors: ["conventional", "reluctant", "diverse"],
  },
  consume: {
    sentence: "These machines _____ electricity as they operate.",
    distractors: ["interpret", "distinguish", "allocate"],
  },
  diverse: {
    sentence:
      "The group includes many different cultures and experiences; it is _____.",
    distractors: ["reluctant", "sufficient", "inevitable"],
  },
  evaluate: {
    sentence:
      "Before choosing a proposal, we should _____ its strengths and weaknesses.",
    distractors: ["consume", "allocate", "sustain"],
  },
  retain: {
    sentence: "To keep information in memory is to _____ it.",
    distractors: ["decline", "allocate", "consume"],
  },
};
