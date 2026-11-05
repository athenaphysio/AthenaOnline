// The two ready-made forms that feed the Programme Builder (a Claude
// Project outside the app) for clients who have not had a one to one
// consultation. Every question is tagged with the section of David's
// generic Twofold programme template it feeds, so form answers and
// Twofold notes reach the builder in the same shape.
//
// These definitions are only used to create the forms (from the Forms
// page) and to group answers when they are saved. Once created, the forms
// are ordinary forms that David can edit like any other. Answers whose
// question wording no longer matches a definition here are kept under
// "Other answers", so editing a question never loses anything.

export type BuilderFormKind = "intake" | "update";

export type BuilderQuestion = {
  section: number; // 0 means no Twofold section
  type: "short_text" | "long_text" | "multiple_choice" | "scale" | "yes_no";
  prompt: string;
  options?: string[];
  required: boolean;
};

export type BuilderFormDefinition = {
  kind: BuilderFormKind;
  title: string;
  questions: BuilderQuestion[];
};

export const TWOFOLD_SECTIONS: Record<number, string> = {
  1: "1. GOALS",
  2: "2. SPORT AND ACTIVITY DEMANDS",
  3: "3. CLINICAL BASELINE",
  4: "4. PRECAUTIONS",
  5: "5. CURRENT CAPACITY AND BASELINE TESTS",
  6: "6. CARDIO AND SPORT SPECIFIC PLAN",
  7: "7. STRENGTH PLAN",
  8: "8. MOVE ON CRITERIA",
  9: "9. FLARE UP PLAN AND LOAD MANAGEMENT",
  10: "10. RETURN TO SPORT STEPS",
  11: "11. AVAILABILITY AND RESOURCES",
  12: "12. PREFERENCES AND MOTIVATION",
};

export const PROGRAMME_INTAKE: BuilderFormDefinition = {
  kind: "intake",
  title: "Programme intake",
  questions: [
    { section: 1, type: "long_text", prompt: "What is your main goal, and why does it matter to you?", required: true },
    {
      section: 1,
      type: "multiple_choice",
      prompt: "Which best describes your goal?",
      options: [
        "Recovering from an injury",
        "Getting back to my sport",
        "Improving my performance",
        "Getting stronger",
        "General health and fitness",
      ],
      required: true,
    },
    {
      section: 1,
      type: "short_text",
      prompt: "Is there an event or date you are working towards? Please give its name, place and date.",
      required: false,
    },
    {
      section: 1,
      type: "short_text",
      prompt: "Do you have a specific target, such as a finishing time, a weight you want to lift or a level of play?",
      required: false,
    },
    { section: 2, type: "long_text", prompt: "Which sports and activities do you do now, or want to get back to?", required: true },
    {
      section: 3,
      type: "long_text",
      prompt:
        "Do you have any current injury, pain or condition? Where is it, how long have you had it, and how does it behave during and after exercise?",
      required: true,
    },
    { section: 3, type: "long_text", prompt: "Have you had injuries or flare ups in the past? What tends to set them off?", required: false },
    {
      section: 3,
      type: "short_text",
      prompt: "If you have pain at the moment, how much is it bothering you, on a scale from 0 (not at all) to 10 (the worst imaginable)?",
      required: false,
    },
    { section: 4, type: "long_text", prompt: "Has a doctor or other health professional told you to avoid or limit anything?", required: true },
    {
      section: 5,
      type: "long_text",
      prompt:
        "What can you comfortably do right now? For example, how far or how long you can run, cycle, swim or row, and at what pace, and what weights you lift.",
      required: true,
    },
    { section: 5, type: "short_text", prompt: "Do you have any recent test results or race times? Please give the date of each.", required: false },
    {
      section: 7,
      type: "multiple_choice",
      prompt: "How experienced are you with strength training?",
      options: ["New to it", "Some experience", "I train regularly", "Very experienced"],
      required: true,
    },
    { section: 11, type: "long_text", prompt: "Which days can you train, and roughly how long do you have on each day?", required: true },
    {
      section: 11,
      type: "long_text",
      prompt: "What equipment and facilities can you use? For example gym, treadmill, rower, bike, pool, weights at home, court or pitch.",
      required: true,
    },
    { section: 11, type: "long_text", prompt: "Do you have fixed commitments, such as matches, classes, shifts or travel?", required: false },
    { section: 11, type: "short_text", prompt: "When would you like to start?", required: true },
    { section: 12, type: "long_text", prompt: "What kinds of training do you enjoy, and what do you dislike?", required: false },
    { section: 12, type: "long_text", prompt: "What usually makes it hard for you to keep training regularly?", required: false },
    { section: 0, type: "long_text", prompt: "Is there anything else you would like me to know?", required: false },
  ],
};

export const QUICK_UPDATE: BuilderFormDefinition = {
  kind: "update",
  title: "Quick update",
  questions: [
    {
      section: 0,
      type: "multiple_choice",
      prompt: "What has changed?",
      options: [
        "Time off training",
        "Illness",
        "New pain or a flare up",
        "Training feels easier than planned",
        "Change to my schedule",
        "New goal or event",
        "Something else",
      ],
      required: true,
    },
    { section: 0, type: "long_text", prompt: "Tell me more about what has happened.", required: true },
    {
      section: 0,
      type: "short_text",
      prompt: "If you have had time off, how long was it, and did you do any other exercise?",
      required: false,
    },
    {
      section: 0,
      type: "scale",
      prompt: "How has your training felt over the last two weeks? (1 is very hard going, 5 is going really well)",
      required: true,
    },
    {
      section: 0,
      type: "short_text",
      prompt: "Any pain at the moment? If so, where is it, when do you notice it, and how much from 0 (none) to 10 (the worst imaginable)?",
      required: false,
    },
    { section: 0, type: "short_text", prompt: "Any recent session numbers, test results or race times?", required: false },
    { section: 0, type: "long_text", prompt: "Has anything changed about the days or time you have available?", required: false },
  ],
};

export const BUILDER_FORMS: BuilderFormDefinition[] = [PROGRAMME_INTAKE, QUICK_UPDATE];

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function builderFormForTitle(title: string): BuilderFormDefinition | null {
  const t = normalise(title);
  return BUILDER_FORMS.find((f) => normalise(f.title) === t) ?? null;
}

export type AnsweredQuestion = { prompt: string; answer: string };

// Turns a submitted builder form into plain text for the client's
// background, laid out under the Twofold headings for the intake form, and
// as a simple list of questions and answers for an update.
export function formatBuilderFormAnswers(
  form: BuilderFormDefinition,
  answers: AnsweredQuestion[],
  submittedOn: string
): string {
  const heading =
    form.kind === "intake"
      ? `PROGRAMME INTAKE FORM, filled in by the client on ${submittedOn}. These are the client's own answers, not a clinical consultation.`
      : `QUICK UPDATE FORM, filled in by the client on ${submittedOn}.`;

  const answered = answers.filter((a) => a.answer.trim().length > 0);
  if (form.kind === "update") {
    const lines = answered.map((a) => `${a.prompt}\n${a.answer.trim()}`);
    return [heading, ...lines].join("\n\n");
  }

  const sectionOf = new Map(form.questions.map((q) => [normalise(q.prompt), q.section]));
  const bySection = new Map<number, AnsweredQuestion[]>();
  const other: AnsweredQuestion[] = [];
  for (const a of answered) {
    const section = sectionOf.get(normalise(a.prompt));
    if (section === undefined || section === 0) {
      other.push(a);
      continue;
    }
    bySection.set(section, [...(bySection.get(section) ?? []), a]);
  }

  // Sections the form never asks about, because they are David's clinical
  // decisions rather than facts the client can report.
  const askedSections = new Set(form.questions.map((q) => q.section));

  const parts: string[] = [heading];
  for (const [num, title] of Object.entries(TWOFOLD_SECTIONS)) {
    const items = bySection.get(Number(num));
    const body =
      items && items.length > 0
        ? items.map((a) => `${a.prompt}\n${a.answer.trim()}`).join("\n\n")
        : askedSections.has(Number(num))
          ? "Not answered"
          : "Not covered by the form. For Dr David Silver PhD to decide.";
    parts.push(`${title}\n${body}`);
  }
  if (other.length > 0) {
    parts.push(`OTHER ANSWERS\n${other.map((a) => `${a.prompt}\n${a.answer.trim()}`).join("\n\n")}`);
  }
  return parts.join("\n\n");
}
