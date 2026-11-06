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
  type: "short_text" | "long_text" | "multiple_choice" | "multi_select" | "scale" | "yes_no";
  prompt: string;
  /** Short label used instead of the full question when answers are laid
   * out for the Programme Builder, e.g. "Monday" for the day questions. */
  label?: string;
  options?: string[];
  required: boolean;
};

export type BuilderFormDefinition = {
  kind: BuilderFormKind;
  title: string;
  /** A version made for one brand pack's clients (matched by pack name),
   * sent to them instead of the standard form. */
  brandPackName?: string;
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

const NO_ANSWER_IF_NONE = "Leave blank if you have no current injury, pain or condition.";

export const PROGRAMME_INTAKE: BuilderFormDefinition = {
  kind: "intake",
  title: "Programme intake",
  questions: [
    // 1. Goals
    { section: 1, type: "long_text", label: "Main goal and why it matters", prompt: "What is your main goal, and why does it matter to you?", required: true },
    {
      section: 1,
      type: "multiple_choice",
      label: "Type of goal",
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
      type: "multiple_choice",
      label: "Event or personal goal",
      prompt: "Are you working towards an organised event or a personal goal?",
      options: ["An organised event, such as a race, match or competition", "A personal goal with a date in mind", "No fixed date yet"],
      required: true,
    },
    // Event, date and measurable target are separate optional boxes, so a
    // client with an event gives one specific goal (e.g. London Marathon, 26 April,
    // under 4 hours) that the trajectory graph can be drawn towards.
    {
      section: 1,
      type: "short_text",
      label: "Event or goal",
      prompt: "What is the event, or the goal, you are working towards? For example, the London Marathon. Leave blank if you have nothing specific in mind.",
      required: false,
    },
    {
      section: 1,
      type: "short_text",
      label: "Date",
      prompt: "What is the date? If there is no fixed date but you have one in mind, please give the date you would like to reach your goal by.",
      required: false,
    },
    {
      section: 1,
      type: "short_text",
      label: "Measurable target",
      prompt:
        "What exactly do you want to achieve? If you can, please give one measurable target, for example finishing the London Marathon in under 4 hours, rowing 2,000 m in under 7 minutes, or running 5 km without stopping.",
      required: false,
    },

    // 2. Sport and activity demands
    { section: 2, type: "long_text", label: "Sports and activities", prompt: "Which sports and activities do you do now, or want to get back to?", required: true },

    // 3. Clinical baseline, one part per box so nothing gets skipped
    { section: 3, type: "yes_no", label: "Current injury, pain or condition", prompt: "Do you have a current injury, pain or condition?", required: true },
    { section: 3, type: "short_text", label: "Where it is", prompt: `Where is it? ${NO_ANSWER_IF_NONE}`, required: false },
    { section: 3, type: "short_text", label: "How long", prompt: "How long have you had it?", required: false },
    { section: 3, type: "long_text", label: "During exercise", prompt: "How does it feel during exercise?", required: false },
    { section: 3, type: "long_text", label: "After exercise", prompt: "How does it feel after exercise, later that day and the next morning?", required: false },
    {
      section: 3,
      type: "short_text",
      label: "Usual level (0 to 10)",
      prompt: "On a usual day, how much does it bother you? Please give one number from 0 (not at all) to 10 (the worst imaginable).",
      required: false,
    },
    {
      section: 3,
      type: "short_text",
      label: "Worst level (0 to 10)",
      prompt: "At its worst, how much does it bother you? Please give one number from 0 to 10.",
      required: false,
    },
    { section: 3, type: "long_text", label: "What makes it worse or better", prompt: "What tends to make it worse, and what helps?", required: false },
    { section: 3, type: "long_text", label: "Past injuries and triggers", prompt: "Have you had injuries or flare ups in the past? What tends to set them off?", required: false },

    // 4. Precautions
    { section: 4, type: "long_text", label: "Told to avoid or limit", prompt: "Has a doctor or other health professional told you to avoid or limit anything? If so, what?", required: true },

    // 5. Current capacity and baseline tests
    {
      section: 5,
      type: "long_text",
      label: "What they can do now",
      prompt:
        "What can you comfortably do right now? For example, how far or how long you can run, cycle, swim or row, and at what pace, and what weights you lift.",
      required: true,
    },
    {
      section: 5,
      type: "short_text",
      label: "Best recent result",
      prompt: "What is your best recent result for the distance or event you are aiming at, and roughly when was it?",
      required: false,
    },
    { section: 5, type: "short_text", label: "Other recent tests or times", prompt: "Any other recent test results or race times? Please give the date of each.", required: false },

    // 7. Strength
    {
      section: 7,
      type: "multiple_choice",
      label: "Strength experience",
      prompt: "How experienced are you with strength training?",
      options: ["New to it", "Some experience", "I train regularly", "Very experienced"],
      required: true,
    },

    // 11. Availability and resources, one box per day
    { section: 11, type: "short_text", label: "Monday", prompt: "Monday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Tuesday", prompt: "Tuesday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Wednesday", prompt: "Wednesday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Thursday", prompt: "Thursday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Friday", prompt: "Friday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Saturday", prompt: "Saturday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Sunday", prompt: "Sunday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Strength days", prompt: "Which of those days would you like to do strength training?", required: false },
    {
      section: 11,
      type: "short_text",
      label: "Extra short session",
      prompt: "Could you fit in a short extra session, such as 20 minutes on a bike, on another day? If so, which day and for how long?",
      required: false,
    },
    {
      section: 11,
      type: "long_text",
      label: "Equipment and facilities",
      prompt: "What equipment and facilities can you use? For example gym, treadmill, rower, bike, pool, weights at home, court or pitch.",
      required: true,
    },
    { section: 11, type: "long_text", label: "Fixed commitments", prompt: "Do you have fixed commitments, such as matches, classes, shifts or travel?", required: false },
    { section: 11, type: "short_text", label: "Preferred start", prompt: "When would you like to start?", required: true },

    // 12. Preferences and motivation
    { section: 12, type: "long_text", label: "Enjoys and dislikes", prompt: "What kinds of training do you enjoy, and what do you dislike?", required: false },
    { section: 12, type: "long_text", label: "What gets in the way", prompt: "What usually makes it hard for you to keep training regularly?", required: false },

    { section: 0, type: "long_text", label: "Anything else", prompt: "Is there anything else you would like me to know?", required: false },
  ],
};

const DAYS = ["0 days", "1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "7 days"];
const ONLY_10_MINUTES = "Only count activities done for at least 10 minutes at a time.";

// The Programme intake form for Regenerate Wellness clients on the Corporate
// Athlete Executive Programme. It keeps the standard intake's goals, injury,
// capacity, availability and preference questions, and wherever it touches
// the same ground as the Corporate Athlete longitudinal survey (work pattern,
// travel, health conditions, medication, physical activity, sleep timing,
// facilities and existing support) it uses the survey's own wording and
// answer options, so the two line up. The survey's validated scales (sleep,
// alcohol, mental health, burnout, resilience, fatigue, team and recovery,
// productivity, quality of life) stay in the survey itself.
export const REGENERATE_INTAKE: BuilderFormDefinition = {
  kind: "intake",
  title: "Regenerate programme intake",
  brandPackName: "Regenerate Wellness",
  questions: [
    // 1. Goals
    { section: 1, type: "long_text", label: "Main goal and why it matters", prompt: "What is your main goal for the programme, and why does it matter to you?", required: true },
    {
      section: 1,
      type: "multiple_choice",
      label: "Type of goal",
      prompt: "Which best describes your goal?",
      options: [
        "More energy and less fatigue",
        "Better sleep and recovery",
        "Managing stress",
        "Getting fitter and stronger",
        "Long term health",
        "Getting back to a sport or activity",
        "Recovering from an injury",
        "Performing in a sport or event",
      ],
      required: true,
    },
    {
      section: 1,
      type: "multiple_choice",
      label: "Event or personal goal",
      prompt: "Are you working towards an organised event or a personal goal?",
      options: ["An organised event, such as a race, sportive or match", "A personal goal with a date in mind", "No fixed date yet"],
      required: true,
    },
    {
      section: 1,
      type: "short_text",
      label: "Event or goal",
      prompt: "What is the event, or the goal, you are working towards? Leave blank if you have nothing specific in mind.",
      required: false,
    },
    {
      section: 1,
      type: "short_text",
      label: "Date",
      prompt: "What is the date? If there is no fixed date but you have one in mind, please give the date you would like to reach your goal by.",
      required: false,
    },
    {
      section: 1,
      type: "short_text",
      label: "Measurable target",
      prompt:
        "What exactly do you want to achieve? If you can, please give one measurable target, for example running 5 km without stopping, completing a 100 km sportive, or ten full push ups.",
      required: false,
    },

    // 2. The demands of the role, from survey Section A, and sport
    {
      section: 2,
      type: "multiple_choice",
      label: "Role level",
      prompt: "Which best describes your current role level?",
      options: ["Board or C-suite", "Director", "Head of or senior manager", "Other"],
      required: true,
    },
    { section: 2, type: "short_text", label: "Role, if other", prompt: "If you chose Other, what is your role?", required: false },
    {
      section: 2,
      type: "short_text",
      label: "Hours actually worked per week",
      prompt: "In the past 4 weeks, how many hours did you actually work in a typical week (including evenings and weekends)?",
      required: true,
    },
    {
      section: 2,
      type: "multiple_choice",
      label: "On call",
      prompt: "How often are you on call or responsible for out of hours incident escalation?",
      options: ["Never", "Occasionally", "On a weekly rota", "Always available"],
      required: true,
    },
    {
      section: 2,
      type: "short_text",
      label: "Nights away for work (past 4 weeks)",
      prompt: "In the past 4 weeks, how many nights did you spend away from home for work?",
      required: true,
    },
    {
      section: 2,
      type: "multiple_choice",
      label: "Days with calls before 7am or after 7pm",
      prompt: "In a typical week, on how many days do you take work calls or meetings before 7am or after 7pm?",
      options: DAYS,
      required: true,
    },
    {
      section: 2,
      type: "multiple_choice",
      label: "Long haul trips (past 4 weeks)",
      prompt: "In the past 4 weeks, how many trips did you make that crossed 3 or more time zones?",
      options: ["None", "1", "2", "3", "4 or more"],
      required: true,
    },
    { section: 2, type: "long_text", label: "Sports and activities", prompt: "Which sports and activities do you do now, or want to get back to?", required: false },

    // 3. Clinical baseline, as the standard intake
    { section: 3, type: "yes_no", label: "Current injury, pain or condition", prompt: "Do you have a current injury, pain or condition?", required: true },
    { section: 3, type: "short_text", label: "Where it is", prompt: `Where is it? ${NO_ANSWER_IF_NONE}`, required: false },
    { section: 3, type: "short_text", label: "How long", prompt: "How long have you had it?", required: false },
    { section: 3, type: "long_text", label: "During exercise", prompt: "How does it feel during exercise?", required: false },
    { section: 3, type: "long_text", label: "After exercise", prompt: "How does it feel after exercise, later that day and the next morning?", required: false },
    {
      section: 3,
      type: "short_text",
      label: "Usual level (0 to 10)",
      prompt: "On a usual day, how much does it bother you? Please give one number from 0 (not at all) to 10 (the worst imaginable).",
      required: false,
    },
    {
      section: 3,
      type: "short_text",
      label: "Worst level (0 to 10)",
      prompt: "At its worst, how much does it bother you? Please give one number from 0 to 10.",
      required: false,
    },
    { section: 3, type: "long_text", label: "What makes it worse or better", prompt: "What tends to make it worse, and what helps?", required: false },
    { section: 3, type: "long_text", label: "Past injuries and triggers", prompt: "Have you had injuries or flare ups in the past? What tends to set them off?", required: false },

    // 4. Precautions, with the survey's health and medication questions
    { section: 4, type: "yes_no", label: "Long term health condition", prompt: "Has a doctor ever told you that you have any long term health condition?", required: true },
    { section: 4, type: "short_text", label: "Condition", prompt: "If yes, please specify.", required: false },
    { section: 4, type: "yes_no", label: "Prescribed medication", prompt: "Are you currently taking any prescribed medication?", required: true },
    { section: 4, type: "long_text", label: "Medication, dose and frequency", prompt: "If yes, please list the name, dose and how often it is taken.", required: false },
    {
      section: 4,
      type: "multi_select",
      label: "Medication affecting heart rate, sleep or stress hormones (past 4 weeks)",
      prompt: "In the past 4 weeks, have you taken any of the following?",
      options: [
        "Beta-blockers or other blood pressure medication",
        "Antidepressants or anti-anxiety medication",
        "Sleeping tablets or sedating antihistamines",
        "Stimulants (for example ADHD medication, modafinil)",
        "Steroids (tablets or injections)",
        "Hormone therapy (for example HRT, testosterone, thyroid)",
        "Painkillers containing codeine or other opioids",
        "Melatonin",
        "None of these",
      ],
      required: true,
    },
    {
      section: 4,
      type: "long_text",
      label: "Over the counter medicines and supplements",
      prompt: "Do you regularly take any over the counter medicines or supplements? If so, please list them (for example vitamin D, magnesium, creatine, CoQ10). Leave blank if not.",
      required: false,
    },
    { section: 4, type: "long_text", label: "Told to avoid or limit", prompt: "Has a doctor or other health professional told you to avoid or limit anything? If so, what?", required: true },

    // 5. Current capacity: the survey's physical activity (IPAQ short form)
    // and muscle strengthening questions, then sleep timing and fitness
    {
      section: 5,
      type: "short_text",
      label: "Vigorous activity, days (last 7 days)",
      prompt: `During the last 7 days, on how many days did you do vigorous physical activities like heavy lifting, digging, aerobics, or fast bicycling? Vigorous activities take hard physical effort and make you breathe much harder than normal. ${ONLY_10_MINUTES} Enter 0 if none.`,
      required: true,
    },
    {
      section: 5,
      type: "short_text",
      label: "Vigorous activity, time per day",
      prompt: "How much time did you usually spend doing vigorous physical activities on one of those days? Please give hours and minutes, or write don't know. Leave blank if none.",
      required: false,
    },
    {
      section: 5,
      type: "short_text",
      label: "Moderate activity, days (last 7 days)",
      prompt: `During the last 7 days, on how many days did you do moderate physical activities like carrying light loads, bicycling at a regular pace, or doubles tennis? Do not include walking. Moderate activities take moderate effort and make you breathe somewhat harder than normal. ${ONLY_10_MINUTES} Enter 0 if none.`,
      required: true,
    },
    {
      section: 5,
      type: "short_text",
      label: "Moderate activity, time per day",
      prompt: "How much time did you usually spend doing moderate physical activities on one of those days? Please give hours and minutes, or write don't know. Leave blank if none.",
      required: false,
    },
    {
      section: 5,
      type: "short_text",
      label: "Walking, days (last 7 days)",
      prompt: "During the last 7 days, on how many days did you walk for at least 10 minutes at a time? Enter 0 if none.",
      required: true,
    },
    {
      section: 5,
      type: "short_text",
      label: "Walking, time per day",
      prompt: "How much time did you usually spend walking on one of those days? Please give hours and minutes, or write don't know. Leave blank if none.",
      required: false,
    },
    {
      section: 5,
      type: "short_text",
      label: "Sitting on a week day",
      prompt: "During the last 7 days, how much time did you spend sitting on a week day? Please give hours and minutes, or write don't know.",
      required: true,
    },
    {
      section: 5,
      type: "multiple_choice",
      label: "Muscle strengthening days (last 7 days)",
      prompt:
        "During the last 7 days, on how many days did you do activities to strengthen your muscles (for example weights, resistance bands, body weight exercises, heavy gardening)?",
      options: DAYS,
      required: true,
    },
    { section: 5, type: "short_text", label: "Work day bed and wake times", prompt: "On work days, what time do you usually go to bed and wake up?", required: true },
    {
      section: 5,
      type: "short_text",
      label: "Hours of actual sleep",
      prompt: "In the past month, how many hours of actual sleep did you usually get per night?",
      required: true,
    },
    {
      section: 5,
      type: "long_text",
      label: "What they can do now",
      prompt:
        "What can you comfortably do right now? For example, how far or how long you can run, cycle, swim or row, and at what pace, and what weights you lift.",
      required: false,
    },
    {
      section: 5,
      type: "short_text",
      label: "Recent tests or times",
      prompt: "Any recent test results, race times or fitness numbers? Please give the date of each.",
      required: false,
    },

    // 7. Strength
    {
      section: 7,
      type: "multiple_choice",
      label: "Strength experience",
      prompt: "How experienced are you with strength training?",
      options: ["New to it", "Some experience", "I train regularly", "Very experienced"],
      required: true,
    },

    // 11. Availability and resources, with the survey's facilities, support
    // and caring questions
    { section: 11, type: "short_text", label: "Monday", prompt: "Monday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Tuesday", prompt: "Tuesday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Wednesday", prompt: "Wednesday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Thursday", prompt: "Thursday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Friday", prompt: "Friday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Saturday", prompt: "Saturday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Sunday", prompt: "Sunday: how long could you train? Leave blank if you can't train that day.", required: false },
    { section: 11, type: "short_text", label: "Strength days", prompt: "Which of those days would you like to do strength training?", required: false },
    {
      section: 11,
      type: "multi_select",
      label: "Facilities",
      prompt: "Which of the following facilities do you currently have access to?",
      options: [
        "Gym at my workplace",
        "Gym membership elsewhere",
        "Home gym or exercise equipment",
        "Swimming pool",
        "Sauna or steam room",
        "Cold water immersion or ice bath",
        "Massage, physiotherapy or other recovery services",
        "None of these",
      ],
      required: true,
    },
    {
      section: 11,
      type: "long_text",
      label: "Equipment",
      prompt: "What equipment can you use, at home, at work or when travelling? For example treadmill, rower, bike, dumbbells, kettlebells or resistance bands.",
      required: false,
    },
    {
      section: 11,
      type: "multi_select",
      label: "Currently working with",
      prompt: "Are you currently working with any of the following?",
      options: [
        "Personal trainer",
        "Nutritionist or dietitian",
        "Physiotherapist",
        "Executive or life coach",
        "Therapist, counsellor or psychologist",
        "None of these",
      ],
      required: true,
    },
    {
      section: 11,
      type: "short_text",
      label: "Caring responsibilities",
      prompt: "Do you have caring responsibilities for children or adults? If so, roughly how many hours per week?",
      required: false,
    },
    {
      section: 11,
      type: "long_text",
      label: "Fixed commitments and planned travel",
      prompt: "Do you have other fixed commitments, or travel already planned over the next few months, that your programme should work around?",
      required: false,
    },
    { section: 11, type: "short_text", label: "Preferred start", prompt: "When would you like to start?", required: false },

    // 12. Preferences and motivation
    { section: 12, type: "long_text", label: "Enjoys and dislikes", prompt: "What kinds of training do you enjoy, and what do you dislike?", required: false },
    {
      section: 12,
      type: "long_text",
      label: "What gets in the way",
      prompt: "What usually makes it hard for you to keep training regularly? For example travel, long days or late meetings.",
      required: false,
    },

    { section: 0, type: "long_text", label: "Anything else", prompt: "Is there anything else you would like us to know?", required: false },
  ],
};

export const QUICK_UPDATE: BuilderFormDefinition = {
  kind: "update",
  title: "Quick update",
  questions: [
    {
      section: 0,
      type: "multiple_choice",
      label: "What has changed",
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
    { section: 0, type: "long_text", label: "More detail", prompt: "Tell me more about what has happened.", required: true },
    { section: 0, type: "short_text", label: "Time off", prompt: "If you have had time off, how long was it, and did you do any other exercise?", required: false },
    {
      section: 0,
      type: "scale",
      label: "How training has felt (1 to 5)",
      prompt: "How has your training felt over the last two weeks? (1 is very hard going, 5 is going really well)",
      required: true,
    },
    { section: 0, type: "yes_no", label: "Any pain now", prompt: "Do you have any pain at the moment?", required: true },
    { section: 0, type: "short_text", label: "Where and when", prompt: "If so, where is it, and when do you notice it?", required: false },
    { section: 0, type: "short_text", label: "Usual level (0 to 10)", prompt: "On a usual day, how much does it bother you? Please give one number from 0 to 10.", required: false },
    { section: 0, type: "short_text", label: "Worst level (0 to 10)", prompt: "At its worst, how much does it bother you? Please give one number from 0 to 10.", required: false },
    { section: 0, type: "short_text", label: "Recent numbers", prompt: "Any recent session numbers, test results or race times?", required: false },
    { section: 0, type: "long_text", label: "Change to available time", prompt: "Has anything changed about the days or time you have available?", required: false },
  ],
};

export const BUILDER_FORMS: BuilderFormDefinition[] = [PROGRAMME_INTAKE, REGENERATE_INTAKE, QUICK_UPDATE];

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
      ? `${form.title.toUpperCase()} FORM, filled in by the client on ${submittedOn}. These are the client's own answers, not a clinical consultation.`
      : `QUICK UPDATE FORM, filled in by the client on ${submittedOn}.`;

  const answered = answers.filter((a) => a.answer.trim().length > 0);
  const byPrompt = new Map(form.questions.map((q) => [normalise(q.prompt), q]));
  // "Label: answer" on one line, so the builder reads it quickly. A
  // question David has reworded since has no label, so its full wording is
  // kept instead and nothing is lost.
  const line = (a: AnsweredQuestion) => `${byPrompt.get(normalise(a.prompt))?.label ?? a.prompt}: ${a.answer.trim()}`;

  if (form.kind === "update") {
    return [heading, answered.map(line).join("\n")].join("\n\n");
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
        ? items.map(line).join("\n")
        : askedSections.has(Number(num))
          ? "Not answered"
          : "Not covered by the form. For Dr David Silver PhD to decide.";
    parts.push(`${title}\n${body}`);
  }
  if (other.length > 0) {
    parts.push(`OTHER ANSWERS\n${other.map(line).join("\n")}`);
  }
  return parts.join("\n\n");
}
