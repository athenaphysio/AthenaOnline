// The Corporate Athlete Executive longitudinal survey (Regenerate Wellness),
// split as agreed with the team into:
//
//   Lifestyle check   the factual and behavioural items (Section A, the
//                     IPAQ short form, muscle strengthening, sleep timing,
//                     AUDIT-C and the bespoke health behaviour items), in a
//                     Month 1, Month 3 and Month 6 version so each asks
//                     exactly what the survey asks at that timepoint.
//   Wellbeing survey  the validated scales, each whole with its own
//                     instructions: Jenkins Sleep Scale, PHQ-9, GAD-7,
//                     DASS-21 Stress, WHO-5, Copenhagen Burnout Inventory,
//                     Brief Resilience Scale, Fatigue Assessment Scale,
//                     Team Psychological Safety, Recovery Experience,
//                     WPAI:GH, CDC HRQOL-4 and ONS4.
//
// Wording follows the survey document. The only changes are punctuation
// (no dashes, per house style), "please specify" answers given their own
// box, and skip instructions written into the answer options, since the app
// does not skip questions. The scoring codes are kept here, hidden from the
// client, and used to score each response on the clinic side.

import type { BuilderFormDefinition, BuilderQuestion } from "./builderForms";

type Timepoint = 1 | 3 | 6;
const ALL: Timepoint[] = [1, 3, 6];

export type Item = BuilderQuestion & { code?: string; timepoints: Timepoint[] };

const info = (prompt: string, timepoints: Timepoint[] = ALL): Item => ({ section: 0, type: "info", prompt, required: false, timepoints });
const short = (code: string, prompt: string, required = true, timepoints: Timepoint[] = ALL): Item => ({
  code,
  section: 0,
  type: "short_text",
  prompt,
  required,
  timepoints,
});
const long = (code: string, prompt: string, required = false, timepoints: Timepoint[] = ALL): Item => ({
  code,
  section: 0,
  type: "long_text",
  prompt,
  required,
  timepoints,
});
const choice = (code: string, prompt: string, options: string[], required = true, timepoints: Timepoint[] = ALL): Item => ({
  code,
  section: 0,
  type: "multiple_choice",
  prompt,
  options,
  required,
  timepoints,
});
const ticks = (code: string, prompt: string, options: string[], required = true, timepoints: Timepoint[] = ALL): Item => ({
  code,
  section: 0,
  type: "multi_select",
  prompt,
  options,
  required,
  timepoints,
});

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
const NO_YES = ["No", "Yes"];
const M1: Timepoint[] = [1];
const M16: Timepoint[] = [1, 6];

// ---------------------------------------------------------------------------
// Lifestyle check
// ---------------------------------------------------------------------------

export const LIFESTYLE_ITEMS: Item[] = [
  info("About you and your work"),
  short("A1", "What is your age? (years)", true, M1),
  choice("A2", "What is your sex?", ["Female", "Male", "Prefer not to say"], true, M1),
  choice("A3", "Which best describes your current role level?", ["Board / C-suite", "Director", "Head of / senior manager", "Other"], true, M1),
  short("A3 other", "If other, please specify.", false, M1),
  short("A4", "How many years have you been in your current role? (years)", true, M1),
  short("A5", "How many hours are you contracted to work per week? (hours)", true, M1),
  short("A6", "In the past 4 weeks, how many hours did you actually work in a typical week (including evenings and weekends)? (hours)"),
  choice("A7", "How often are you on call or responsible for out-of-hours incident escalation?", ["Never", "Occasionally", "On a weekly rota", "Always available"]),
  short("A8", "In the past 4 weeks, how many nights did you spend away from home for work? (nights)"),
  choice("A9", "In a typical week, on how many days do you take work calls or meetings before 7am or after 7pm? (days)", range(0, 7)),
  choice("A10", "In the past 4 weeks, how often have you had more work than you could get done?", ["Never", "Rarely", "Sometimes", "Often", "Always"]),
  choice("A11", "Do you have caring responsibilities for children or adults?", NO_YES, true, M1),
  short("A11 hours", "If yes, how many hours per week?", false, M1),
  choice("A12", "Has a doctor ever told you that you have any long-term health condition?", NO_YES, true, M1),
  short("A12 detail", "If yes, please specify.", false, M1),
  choice("A13", "In the past 3 months, have you experienced a major life event (e.g. bereavement, house move, organisational restructure)?", NO_YES),
  short("A13 detail", "If yes, please specify.", false),
  choice("A14", "All things considered, how satisfied are you with your job? (0 is not at all satisfied, 10 is completely satisfied)", range(0, 10)),
  choice("A15", "How likely are you to leave your organisation in the next 12 months?", ["Very unlikely", "Unlikely", "Unsure", "Likely", "Very likely"]),

  info("Medication and supplements"),
  choice("A16", "Are you currently taking any prescribed medication?", NO_YES),
  long("A16 detail", "If yes, please list name, dose and how often taken."),
  ticks("A17", "In the past 4 weeks, have you taken any of the following?", [
    "Beta-blockers or other blood pressure medication",
    "Antidepressants or anti-anxiety medication",
    "Sleeping tablets or sedating antihistamines",
    "Stimulants (e.g. ADHD medication, modafinil)",
    "Steroids (tablets or injections)",
    "Hormone therapy (e.g. HRT, testosterone, thyroid)",
    "Painkillers containing codeine or other opioids",
    "Melatonin",
    "None of these",
  ]),
  choice("A18", "Do you regularly take any over-the-counter medicines or supplements?", NO_YES),
  long("A18 detail", "If yes, please list (e.g. vitamin D, magnesium, creatine, CoQ10)."),
  choice("A19", "Since your last survey, have you started, stopped or changed the dose of any medication or supplement?", [
    "No",
    "Yes",
    "Not applicable (first survey)",
  ]),
  long("A19 detail", "If yes, please give details and the date of the change."),

  info("Travel"),
  choice("A20", "In the past 4 weeks, how many trips did you make that crossed 3 or more time zones?", [
    "None (skip the rest of this travel section)",
    "1",
    "2",
    "3",
    "4 or more",
  ]),
  short("A21", "For your most recent trip, how many time zones did you cross? (time zones)", false),
  choice("A21 direction", "In which direction?", ["Eastward", "Westward", "Both (multi-leg trip)"], false),
  short("A22", "On what date did you return home from your most recent trip across 3 or more time zones? Please give the date, or write still travelling.", false),
  choice("A23", "Do you expect to travel across 3 or more time zones during your 7-day monitoring period?", ["No", "Yes", "Not sure"], false),
  short("A23 dates", "If yes, please give dates.", false),

  info("Facilities and support", M16),
  ticks(
    "A24",
    "Which of the following facilities do you currently have access to?",
    [
      "Gym at my workplace",
      "Gym membership elsewhere",
      "Home gym or exercise equipment",
      "Swimming pool",
      "Sauna or steam room",
      "Cold-water immersion / ice bath",
      "Massage, physiotherapy or other recovery services",
      "None of these",
    ],
    true,
    M16
  ),
  choice(
    "A25",
    "In the past 4 weeks, how often did you use any of the facilities you ticked in the previous question?",
    ["Not at all", "1 to 3 times", "About once a week", "2 to 3 times a week", "4 or more times a week", "Not applicable"],
    true,
    M16
  ),
  ticks(
    "A26",
    "Are you currently working with any of the following?",
    ["Personal trainer", "Nutritionist or dietitian", "Physiotherapist", "Executive or life coach", "Therapist, counsellor or psychologist", "None of these"],
    true,
    M16
  ),
  choice("A27", "Do you have private medical insurance?", ["No", "Yes, through my employer", "Yes, self-funded", "Don't know"], true, M16),
  short("A27 provider", "If yes, provider:", false, M16),
  ticks(
    "A28",
    "If you have private medical insurance, which of the following does it cover?",
    [
      "Mental health outpatient care (therapy, psychiatry)",
      "Mental health inpatient care",
      "Physiotherapy",
      "Health assessments or screening",
      "Online / virtual GP",
      "Don't know",
      "Not applicable",
    ],
    true,
    M16
  ),
  ticks(
    "A29",
    "Which of the following wellbeing support does your employer provide?",
    [
      "Employee Assistance Programme (EAP)",
      "Mental health first aiders",
      "Occupational health service",
      "Wellbeing or mental health app",
      "Wellbeing allowance or budget",
      "None of these",
      "Don't know",
    ],
    true,
    M16
  ),
  choice(
    "A30",
    "In the past 12 months, have you used any of the mental health support available to you through your employer or insurance?",
    ["Yes", "No, I didn't need it", "No, although I could have benefited", "No, I didn't know how to access it"],
    true,
    M16
  ),

  info(
    "Physical activity. Think about the physical activities you did in the last 7 days. Vigorous activities take hard physical effort and make you breathe much harder than normal; moderate activities take moderate effort and make you breathe somewhat harder than normal. Only count activities done for at least 10 minutes at a time."
  ),
  short("B1", "During the last 7 days, on how many days did you do vigorous physical activities like heavy lifting, digging, aerobics, or fast bicycling? (days per week, or 0 if none, then skip the next question)"),
  short("B2", "How much time did you usually spend doing vigorous physical activities on one of those days? (hours and minutes per day, or don't know / not sure)", false),
  short(
    "B3",
    "During the last 7 days, on how many days did you do moderate physical activities like carrying light loads, bicycling at a regular pace, or doubles tennis? Do not include walking. (days per week, or 0 if none, then skip the next question)"
  ),
  short("B4", "How much time did you usually spend doing moderate physical activities on one of those days? (hours and minutes per day, or don't know / not sure)", false),
  short("B5", "During the last 7 days, on how many days did you walk for at least 10 minutes at a time? (days per week, or 0 if none, then skip the next question)"),
  short("B6", "How much time did you usually spend walking on one of those days? (hours and minutes per day, or don't know / not sure)", false),
  short("B7", "During the last 7 days, how much time did you spend sitting on a week day? (hours and minutes per day, or don't know / not sure)"),
  choice(
    "B8",
    "During the last 7 days, on how many days did you do activities to strengthen your muscles (e.g. weights, resistance bands, body-weight exercises, heavy gardening)? (days)",
    range(0, 7)
  ),

  info("Sleep, alcohol, smoking and diet"),
  short("B13 bed", "On work days, what time do you usually go to bed? (bed time)"),
  short("B13 wake", "On work days, what time do you usually wake up? (wake time)"),
  short("B14", "In the past month, how many hours of actual sleep did you usually get per night? (hours and minutes)"),
  choice("B15", "How often do you have a drink containing alcohol?", ["Never", "Monthly or less", "2 to 4 times per month", "2 to 3 times per week", "4 or more times per week"]),
  choice("B16", "How many units of alcohol do you drink on a typical day when you are drinking?", ["0 to 2", "3 to 4", "5 to 6", "7 to 9", "10 or more"]),
  choice("B17", "How often have you had 6 or more units if female, or 8 or more if male, on a single occasion in the last year?", [
    "Never",
    "Less than monthly",
    "Monthly",
    "Weekly",
    "Daily or almost daily",
  ]),
  choice("B18", "Which best describes your cigarette smoking?", [
    "I have never smoked",
    "I used to smoke but have stopped",
    "I smoke occasionally, not every day",
    "I smoke every day",
  ]),
  choice("B19", "Do you currently use e-cigarettes (vapes) or nicotine pouches?", ["No", "Yes, occasionally", "Yes, every day"]),
  choice("B20", "On a typical day, how many portions of fruit do you eat? (1 portion = 80g, e.g. one apple)", ["0", "1", "2", "3", "4", "5 or more"]),
  choice("B21", "On a typical day, how many portions of vegetables do you eat? (1 portion = 80g, e.g. 3 heaped tablespoons)", ["0", "1", "2", "3", "4", "5 or more"]),
  choice("B22", "In a typical week, how many times do you eat takeaway, fast food or ready meals?", ["Never", "1 to 2 times", "3 to 4 times", "5 to 6 times", "7 or more times"]),
  choice("B23", "In a typical week, how often do you skip a main meal because of work?", ["Never", "1 to 2 times", "3 to 4 times", "5 to 6 times", "7 or more times"]),
  choice("B24", "On a typical day, how many caffeinated drinks (coffee, tea, energy drinks) do you have?", ["0", "1", "2", "3", "4", "5", "6 or more"]),
  choice("B25", "What time do you usually have your last caffeinated drink?", ["Before 12:00", "12:00 to 14:00", "14:00 to 17:00", "After 17:00", "I don't drink caffeine"]),
  choice(
    "B26",
    "In the past 7 days, on how many days did you check work email or messages within 1 hour of going to sleep? (days)",
    range(0, 7)
  ),
];

function lifestyleForMonth(month: Timepoint): BuilderFormDefinition {
  return {
    kind: "lifestyle",
    title: `Lifestyle check, Month ${month}`,
    brandPackName: "Regenerate Wellness",
    questions: LIFESTYLE_ITEMS.filter((q) => q.timepoints.includes(month)).map(({ timepoints: _t, code: _c, ...q }) => q),
  };
}

export const LIFESTYLE_MONTH_1 = lifestyleForMonth(1);
export const LIFESTYLE_MONTH_3 = lifestyleForMonth(3);
export const LIFESTYLE_MONTH_6 = lifestyleForMonth(6);

// ---------------------------------------------------------------------------
// Wellbeing survey
// ---------------------------------------------------------------------------

const JSS = ["Not at all", "1 to 3 days", "4 to 7 days", "8 to 14 days", "15 to 21 days", "22 to 31 days"];
const PHQ = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const DASS = [
  "Did not apply to me at all",
  "Applied to me to some degree, or some of the time",
  "Applied to me to a considerable degree, or a good part of time",
  "Applied to me very much, or most of the time",
];
const WHO5 = ["All of the time", "Most of the time", "More than half of the time", "Less than half of the time", "Some of the time", "At no time"];
const CBI_FREQ = ["Always", "Often", "Sometimes", "Seldom", "Never/almost never"];
const CBI_DEGREE = ["To a very high degree", "To a high degree", "Somewhat", "To a low degree", "To a very low degree"];
const BRS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const FAS = ["Never", "Sometimes", "Regularly", "Often", "Always"];

export const PHQ9_ITEM_9 = "Thoughts that you would be better off dead or of hurting yourself in some way";

export const WELLBEING_ITEMS: Item[] = [
  info("Sleep. How often in the past month did you…"),
  choice("B9", "…have trouble falling asleep?", JSS),
  choice("B10", "…wake up several times per night?", JSS),
  choice("B11", "…have trouble staying asleep (including waking far too early)?", JSS),
  choice("B12", "…wake up after your usual amount of sleep feeling tired and worn out?", JSS),

  info("Over the last 2 weeks, how often have you been bothered by any of the following problems?"),
  choice("C1", "Little interest or pleasure in doing things", PHQ),
  choice("C2", "Feeling down, depressed, or hopeless", PHQ),
  choice("C3", "Trouble falling or staying asleep, or sleeping too much", PHQ),
  choice("C4", "Feeling tired or having little energy", PHQ),
  choice("C5", "Poor appetite or overeating", PHQ),
  choice("C6", "Feeling bad about yourself, or that you are a failure or have let yourself or your family down", PHQ),
  choice("C7", "Trouble concentrating on things, such as reading the newspaper or watching television", PHQ),
  choice(
    "C8",
    "Moving or speaking so slowly that other people could have noticed? Or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
    PHQ
  ),
  choice("C9", PHQ9_ITEM_9, PHQ),
  choice(
    "C10",
    "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?",
    ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"],
    false
  ),

  info("Over the last 2 weeks, how often have you been bothered by the following problems?"),
  choice("C11", "Feeling nervous, anxious or on edge", PHQ),
  choice("C12", "Not being able to stop or control worrying", PHQ),
  choice("C13", "Worrying too much about different things", PHQ),
  choice("C14", "Trouble relaxing", PHQ),
  choice("C15", "Being so restless that it is hard to sit still", PHQ),
  choice("C16", "Becoming easily annoyed or irritable", PHQ),
  choice("C17", "Feeling afraid as if something awful might happen", PHQ),

  info("Please read each statement and select how much the statement applied to you over the past week. There are no right or wrong answers."),
  choice("C18", "I found it hard to wind down", DASS),
  choice("C19", "I tended to over-react to situations", DASS),
  choice("C20", "I felt that I was using a lot of nervous energy", DASS),
  choice("C21", "I found myself getting agitated", DASS),
  choice("C22", "I found it difficult to relax", DASS),
  choice("C23", "I was intolerant of anything that kept me from getting on with what I was doing", DASS),
  choice("C24", "I felt that I was rather touchy", DASS),

  info("Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks."),
  choice("C25", "I have felt cheerful and in good spirits", WHO5),
  choice("C26", "I have felt calm and relaxed", WHO5),
  choice("C27", "I have felt active and vigorous", WHO5),
  choice("C28", "I woke up feeling fresh and rested", WHO5),
  choice("C29", "My daily life has been filled with things that interest me", WHO5),

  choice("C30", "How often do you feel tired?", CBI_FREQ),
  choice("C31", "How often are you physically exhausted?", CBI_FREQ),
  choice("C32", "How often are you emotionally exhausted?", CBI_FREQ),
  choice("C33", "How often do you think: \"I can't take it anymore\"?", CBI_FREQ),
  choice("C34", "How often do you feel worn out?", CBI_FREQ),
  choice("C35", "How often do you feel weak and susceptible to illness?", CBI_FREQ),
  choice("C36", "Is your work emotionally exhausting?", CBI_DEGREE),
  choice("C37", "Do you feel burnt out because of your work?", CBI_DEGREE),
  choice("C38", "Does your work frustrate you?", CBI_DEGREE),
  choice("C39", "Do you feel worn out at the end of the working day?", CBI_FREQ),
  choice("C40", "Are you exhausted in the morning at the thought of another day at work?", CBI_FREQ),
  choice("C41", "Do you feel that every working hour is tiring for you?", CBI_FREQ),
  choice("C42", "Do you have enough energy for family and friends during leisure time?", CBI_FREQ),

  info("Please indicate the extent to which you agree with each statement."),
  choice("C43", "I tend to bounce back quickly after hard times", BRS),
  choice("C44", "I have a hard time making it through stressful events", BRS),
  choice("C45", "It does not take me long to recover from a stressful event", BRS),
  choice("C46", "It is hard for me to snap back when something bad happens", BRS),
  choice("C47", "I usually come through difficult times with little trouble", BRS),
  choice("C48", "I tend to take a long time to get over set-backs in my life", BRS),

  info("The following statements refer to how you usually feel."),
  choice("C49", "I am bothered by fatigue", FAS),
  choice("C50", "I get tired very quickly", FAS),
  choice("C51", "I don't do much during the day", FAS),
  choice("C52", "I have enough energy for everyday life", FAS),
  choice("C53", "Physically, I feel exhausted", FAS),
  choice("C54", "I have problems starting things", FAS),
  choice("C55", "I have problems thinking clearly", FAS),
  choice("C56", "I feel no desire to do anything", FAS),
  choice("C57", "Mentally, I feel exhausted", FAS),
  choice("C58", "When I am doing something, I can concentrate quite well", FAS),

  info(
    "Work and recovery. Thinking about the team you work in most closely (e.g. your leadership team), how accurate is each statement? 1 is very inaccurate and 7 is very accurate."
  ),
  choice("D1", "If you make a mistake on this team, it is often held against you", range(1, 7)),
  choice("D2", "Members of this team are able to bring up problems and tough issues", range(1, 7)),
  choice("D3", "People on this team sometimes reject others for being different", range(1, 7)),
  choice("D4", "It is safe to take a risk on this team", range(1, 7)),
  choice("D5", "It is difficult to ask other members of this team for help", range(1, 7)),
  choice("D6", "No one on this team would deliberately act in a way that undermines my efforts", range(1, 7)),
  choice("D7", "Working with members of this team, my unique skills and talents are valued and utilised", range(1, 7)),

  info("During time after work… (1 is I do not agree at all, 5 is I fully agree)"),
  choice("D8", "I forget about work", range(1, 5)),
  choice("D9", "I don't think about work at all", range(1, 5)),
  choice("D10", "I distance myself from my work", range(1, 5)),
  choice("D11", "I get a break from the demands of work", range(1, 5)),
  choice("D12", "I kick back and relax", range(1, 5)),
  choice("D13", "I do relaxing things", range(1, 5)),
  choice("D14", "I use the time to relax", range(1, 5)),
  choice("D15", "I take time for leisure", range(1, 5)),

  info(
    "The following questions ask about the effect of your health on your ability to work and perform regular activities. Health problems means any physical or emotional problem or symptom."
  ),
  short(
    "D16",
    "During the past seven days, how many hours did you miss from work because of problems associated with your health? Include hours missed on sick days, times you went in late, left early, etc., because of your health. (hours)"
  ),
  short("D17", "During the past seven days, how many hours did you miss from work because of any other reason, such as holidays or time off? (hours)"),
  short("D18", "During the past seven days, how many hours did you actually work? (hours)"),
  choice(
    "D19",
    "During the past seven days, how much did health problems affect your productivity while you were working? Think about days you were limited in the amount or kind of work you could do, days you accomplished less than you would like, or days you could not do your work as carefully as usual. (0 is health problems had no effect on my work, 10 is health problems completely prevented me from working)",
    range(0, 10)
  ),
  choice(
    "D20",
    "During the past seven days, how much did health problems affect your ability to do your regular daily activities, other than work at a job? (0 is health problems had no effect on my daily activities, 10 is health problems completely prevented me from doing my daily activities)",
    range(0, 10)
  ),

  info("Quality of life"),
  choice("E1", "Would you say that in general your health is excellent, very good, good, fair, or poor?", ["Excellent", "Very good", "Good", "Fair", "Poor"]),
  short(
    "E2",
    "Now thinking about your physical health, which includes physical illness and injury, for how many days during the past 30 days was your physical health not good? (days, 0 to 30)"
  ),
  short(
    "E3",
    "Now thinking about your mental health, which includes stress, depression, and problems with emotions, for how many days during the past 30 days was your mental health not good? (days, 0 to 30)"
  ),
  short(
    "E4",
    "During the past 30 days, for about how many days did poor physical or mental health keep you from doing your usual activities, such as self-care, work, and recreation? (days, 0 to 30)"
  ),
  choice("E5", "Overall, how satisfied are you with your life nowadays? (0 is not at all, 10 is completely)", range(0, 10)),
  choice("E6", "Overall, to what extent do you feel that the things you do in your life are worthwhile? (0 is not at all, 10 is completely)", range(0, 10)),
  choice("E7", "Overall, how happy did you feel yesterday? (0 is not at all, 10 is completely)", range(0, 10)),
  choice(
    "E8",
    "On a scale where 0 is \"not at all anxious\" and 10 is \"completely anxious\", overall, how anxious did you feel yesterday?",
    range(0, 10)
  ),
];

export const WELLBEING_SURVEY: BuilderFormDefinition = {
  kind: "wellbeing",
  title: "Wellbeing survey",
  brandPackName: "Regenerate Wellness",
  questions: WELLBEING_ITEMS.map(({ timepoints: _t, code: _c, ...q }) => q),
};

export const CORPORATE_ATHLETE_FORMS = [LIFESTYLE_MONTH_1, LIFESTYLE_MONTH_3, LIFESTYLE_MONTH_6, WELLBEING_SURVEY];

// ---------------------------------------------------------------------------
// Scoring, following the survey's scoring key
// ---------------------------------------------------------------------------

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const ITEM_BY_PROMPT = new Map([...LIFESTYLE_ITEMS, ...WELLBEING_ITEMS].filter((i) => i.code).map((i) => [norm(i.prompt), i]));

/** Answers keyed by survey item code (A6, C9, ...), from prompts and answers. */
export function answersByCode(answers: { prompt: string; answer: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of answers) {
    const item = ITEM_BY_PROMPT.get(norm(a.prompt));
    if (item?.code && a.answer.trim()) out.set(item.code, a.answer.trim());
  }
  return out;
}

function optionIndex(code: string, answer: string | undefined): number | null {
  if (answer === undefined) return null;
  const item = [...LIFESTYLE_ITEMS, ...WELLBEING_ITEMS].find((i) => i.code === code);
  const i = item?.options?.indexOf(answer) ?? -1;
  return i >= 0 ? i : null;
}

function number(answer: string | undefined): number | null {
  if (!answer) return null;
  const m = answer.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Time answers such as "1 hour 30 minutes", "1h30", "90 mins" or "1:30",
// in minutes. A bare number is read as minutes when 10 or more, else hours.
function minutes(answer: string | undefined): number | null {
  if (!answer) return null;
  const t = answer.toLowerCase();
  const colon = t.match(/(\d+)\s*:\s*(\d{1,2})/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const h = t.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = t.match(/(\d+)\s*m/);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  const n = number(t);
  if (n === null) return null;
  return n >= 10 ? n : n * 60;
}

// value is the single number the score is tracked by over time (the total,
// mean or overall figure behind the display text), or null when incomplete.
export type MeasureScore = { measure: string; items: string; score: string; interpretation: string; complete: boolean; value: number | null };

const sum = (xs: (number | null)[]) => (xs.every((x) => x !== null) ? (xs as number[]).reduce((a, b) => a + b, 0) : null);
const mean = (xs: (number | null)[]) => {
  const s = sum(xs);
  return s === null ? null : s / xs.length;
};
const codes = (prefix: string, from: number, to: number) => range(from, to).map((n) => `${prefix}${n}`);
const fmt = (n: number, dp = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(dp));

function result(measure: string, items: string, value: number | null, display: (v: number) => string, band: (v: number) => string): MeasureScore {
  return value === null
    ? { measure, items, score: "Incomplete", interpretation: "Not every item was answered", complete: false, value: null }
    : { measure, items, score: display(value), interpretation: band(value), complete: true, value };
}

export function scoreLifestyle(a: Map<string, string>): MeasureScore[] {
  const out: MeasureScore[] = [];
  // IPAQ short form: MET-min/week, days at 0 count as no activity.
  const part = (daysCode: string, minsCode: string, met: number) => {
    const days = number(a.get(daysCode));
    if (days === 0) return 0;
    const mins = minutes(a.get(minsCode));
    return days === null || mins === null ? null : met * mins * days;
  };
  const vig = part("B1", "B2", 8);
  const mod = part("B3", "B4", 4);
  const walk = part("B5", "B6", 3.3);
  const met = sum([vig, mod, walk]);
  const sitting = minutes(a.get("B7"));
  out.push(
    result(
      "IPAQ short form",
      "B1 to B7",
      met,
      (v) => `${Math.round(v)} MET-min/week${sitting !== null ? `, sitting ${sitting} min/day` : ""}`,
      () => "Categorise as low, moderate or high per the IPAQ scoring protocol; time answers are read from free text, so check them"
    )
  );
  const b8 = optionIndex("B8", a.get("B8"));
  out.push(result("Muscle strengthening", "B8", b8, (v) => `${v} ${v === 1 ? "day" : "days"}/week`, (v) => (v >= 2 ? "Meets the UK CMO guideline" : "Below the UK CMO guideline of 2 days")));
  const audit = sum(["B15", "B16", "B17"].map((c) => optionIndex(c, a.get(c))));
  out.push(result("AUDIT-C", "B15 to B17", audit, (v) => `${v} of 12`, (v) => (v >= 5 ? "Increasing or higher risk (complete full AUDIT)" : "Lower risk")));
  return out;
}

export function scoreWellbeing(a: Map<string, string>): MeasureScore[] {
  const idx = (c: string) => optionIndex(c, a.get(c));
  const out: MeasureScore[] = [];

  const jss = sum(codes("B", 9, 12).map(idx));
  out.push(result("Jenkins Sleep Scale", "B9 to B12", jss, (v) => `${v} of 20`, (v) => (v >= 12 ? "Frequent sleep disturbance" : "Higher scores mean more sleep disturbance")));

  const phq = sum(codes("C", 1, 9).map(idx));
  out.push(
    result("PHQ-9", "C1 to C9", phq, (v) => `${v} of 27`, (v) =>
      v >= 20 ? "Severe" : v >= 15 ? "Moderately severe" : v >= 10 ? "Moderate" : v >= 5 ? "Mild" : "Minimal"
    )
  );

  const gad = sum(codes("C", 11, 17).map(idx));
  out.push(result("GAD-7", "C11 to C17", gad, (v) => `${v} of 21`, (v) => (v >= 15 ? "Severe" : v >= 10 ? "Moderate" : v >= 5 ? "Mild" : "Minimal")));

  const dassRaw = sum(codes("C", 18, 24).map(idx));
  out.push(
    result("DASS-21 Stress", "C18 to C24", dassRaw === null ? null : dassRaw * 2, (v) => `${v} of 42`, (v) =>
      v >= 34 ? "Extremely severe" : v >= 26 ? "Severe" : v >= 19 ? "Moderate" : v >= 15 ? "Mild" : "Normal"
    )
  );

  const who = sum(codes("C", 25, 29).map((c) => (idx(c) === null ? null : 5 - idx(c)!)));
  out.push(
    result("WHO-5", "C25 to C29", who === null ? null : who * 4, (v) => `${v} of 100`, (v) =>
      v <= 28 ? "Poor wellbeing; screen for depression" : v <= 50 ? "Poor wellbeing" : "No indication of poor wellbeing"
    )
  );

  const cbi = (c: string) => (idx(c) === null ? null : 100 - 25 * idx(c)!);
  const personal = mean(codes("C", 30, 35).map(cbi));
  out.push(result("CBI personal burnout", "C30 to C35", personal, (v) => `${fmt(v)} of 100`, (v) => (v >= 50 ? "High burnout" : "Below the high burnout threshold")));
  const work = mean([...codes("C", 36, 41).map(cbi), idx("C42") === null ? null : 25 * idx("C42")!]);
  out.push(result("CBI work-related burnout", "C36 to C42", work, (v) => `${fmt(v)} of 100`, (v) => (v >= 50 ? "High burnout" : "Below the high burnout threshold")));

  const brsReverse = new Set(["C44", "C46", "C48"]);
  const brs = mean(codes("C", 43, 48).map((c) => (idx(c) === null ? null : brsReverse.has(c) ? 5 - idx(c)! : idx(c)! + 1)));
  out.push(result("Brief Resilience Scale", "C43 to C48", brs, (v) => `${v.toFixed(2)} of 5`, (v) => (v < 3 ? "Low resilience" : v > 4.3 ? "High resilience" : "Normal resilience")));

  const fasReverse = new Set(["C52", "C58"]);
  const fas = sum(codes("C", 49, 58).map((c) => (idx(c) === null ? null : fasReverse.has(c) ? 5 - idx(c)! : idx(c)! + 1)));
  out.push(result("Fatigue Assessment Scale", "C49 to C58", fas, (v) => `${v} of 50`, (v) => (v >= 35 ? "Extreme fatigue" : v >= 22 ? "Substantial fatigue" : "No substantial fatigue")));

  const psReverse = new Set(["D1", "D3", "D5"]);
  const ps = mean(codes("D", 1, 7).map((c) => (idx(c) === null ? null : psReverse.has(c) ? 7 - idx(c)! : idx(c)! + 1)));
  out.push(result("Team Psychological Safety", "D1 to D7", ps, (v) => `${v.toFixed(2)} of 7`, () => "Higher means greater psychological safety"));

  const req = (cs: string[]) => mean(cs.map((c) => (idx(c) === null ? null : idx(c)! + 1)));
  out.push(result("REQ detachment", "D8 to D11", req(codes("D", 8, 11)), (v) => `${v.toFixed(2)} of 5`, () => "Higher means better recovery"));
  out.push(result("REQ relaxation", "D12 to D15", req(codes("D", 12, 15)), (v) => `${v.toFixed(2)} of 5`, () => "Higher means better recovery"));

  const d16 = number(a.get("D16"));
  const d18 = number(a.get("D18"));
  const d19 = idx("D19");
  const d20 = idx("D20");
  const absent = d16 !== null && d18 !== null && d16 + d18 > 0 ? d16 / (d16 + d18) : d16 === 0 && d18 === 0 ? 0 : null;
  const present = d19 === null ? null : d19 / 10;
  const overall = absent === null || present === null ? null : absent + (1 - absent) * present;
  out.push(
    result(
      "WPAI:GH",
      "D16 to D20",
      overall,
      (v) =>
        `Absenteeism ${Math.round(absent! * 100)}%, presenteeism ${Math.round(present! * 100)}%, overall work impairment ${Math.round(v * 100)}%${
          d20 !== null ? `, activity impairment ${d20 * 10}%` : ""
        }`,
      () => "Higher means greater productivity loss"
    )
  );

  const e1 = idx("E1");
  const e2 = number(a.get("E2"));
  const e3 = number(a.get("E3"));
  const unhealthy = e2 === null || e3 === null ? null : Math.min(30, e2 + e3);
  out.push(
    result(
      "CDC HRQOL-4",
      "E1 to E4",
      unhealthy,
      (v) => `${v} unhealthy days, ${30 - v} healthy days${e1 !== null ? `; self-rated health ${["excellent", "very good", "good", "fair", "poor"][e1]}` : ""}`,
      () => (e1 !== null && e1 >= 3 ? "Poor self-rated health" : "Self-rated health good or better")
    )
  );

  const ons = ["E5", "E6", "E7", "E8"].map(idx);
  out.push(
    result(
      "ONS4",
      "E5 to E8",
      sum(ons),
      () => `Life satisfaction ${ons[0]}, worthwhile ${ons[1]}, happiness ${ons[2]}, anxiety ${ons[3]}`,
      () => {
        const low = ons.slice(0, 3).some((v) => v! <= 4);
        const anxious = ons[3]! >= 6;
        return [low ? "Low on at least one of life satisfaction, worthwhile or happiness" : "", anxious ? "High anxiety" : ""].filter(Boolean).join("; ") || "No low or high-anxiety ratings";
      }
    )
  );
  return out;
}

/** True when the PHQ-9 self harm item (C9) was answered above zero. */
export function safeguardingConcern(answers: { prompt: string; answer: string }[]): boolean {
  const c9 = answers.find((a) => norm(a.prompt) === norm(PHQ9_ITEM_9))?.answer.trim();
  return !!c9 && c9 !== "Not at all";
}
