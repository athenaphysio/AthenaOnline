// The client-facing privacy notice, terms and cookie notice, published at
// /legal/privacy, /legal/terms and /legal/cookies.
//
// Source: the ROAM Policy and Data Protection Framework (Regenerate project,
// v0.2, 11 November 2026), Part 4. These are working versions published so
// that clients can read what they are agreeing to; the framework is still
// to be reviewed by a healthcare and data protection solicitor, and any
// change it brings should be made here and the version and date updated.
//
// Two versions of each page: one for the Regenerate Corporate Athlete
// Programme (the ROAM app), and one for every other brand (Athena Physio,
// Athena Ergon and Athena Online), which leaves out the Regenerate team,
// the Human Passport and the Regenerate suppliers.

export type LegalPage = "privacy" | "terms" | "cookies";

export type LegalBlock =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type LegalDoc = {
  title: string;
  sub: string;
  version: string;
  blocks: LegalBlock[];
};

export const LEGAL_CONTACT_EMAIL = "David@drdavidsilverphd.com";
const VERSION = "Version 1.0, 11 November 2026";

const h = (text: string): LegalBlock => ({ kind: "h", text });
const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (items: string[]): LegalBlock => ({ kind: "list", items });
const table = (head: string[], rows: string[][]): LegalBlock => ({ kind: "table", head, rows });

export function isRegenerateBrand(packName: string | null | undefined): boolean {
  return packName?.trim().toLowerCase() === "regenerate wellness";
}

// ---------------------------------------------------------------------------
// Privacy notice
// ---------------------------------------------------------------------------

function privacy(regenerate: boolean): LegalDoc {
  const controller = regenerate
    ? [
        p(
          "Your ROAM record is held by Athena Physio, the practice of Dr David Silver PhD, a physiotherapist registered with the Health and Care Professions Council (HCPC PH82005). In data protection law this makes us the controller of your ROAM record. Regenerate Wellness, which runs the programme, is separately responsible for its own business records about you, such as your agreement and invoices, and the two organisations have a written agreement that controls what passes between them.",
        ),
      ]
    : [
        p(
          "Your record is held by Athena Physio, the practice of Dr David Silver PhD, a physiotherapist registered with the Health and Care Professions Council (HCPC PH82005). In data protection law this makes us the controller of your record.",
        ),
      ];

  const collect = regenerate
    ? [
        "About you: your name, date of birth, contact details, country of residence, employer and role, an emergency contact, and your own doctor's details if you choose to give them.",
        "Your health and wellbeing: what you tell us in your onboarding consultation and check-ins, including medical history, injuries, sleep, energy, stress, mood and goals, sometimes in your own words.",
        "Your Human Passport: blood test results from Randox, heart rate variability and heart recordings from a Firstbeat monitor, gut microbiome results, and questionnaire scores on wellbeing and behaviour, measured at the start and again later so you can see change over time.",
        "Your wearable and training apps: if you choose to connect them, data such as heart rate, sleep, activity and the sessions you record.",
        "Your physical assessments: how you move, and strength and performance results.",
        "Your programme: the exercise plan we set, what you complete, and the messages and voice notes you send through the app.",
        "Bookings and payments: appointment times and payment records.",
      ]
    : [
        "About you: your name, date of birth, contact details, address, an emergency contact, your GP's details, and for a child, the details of their parent or guardian.",
        "Your health: what you tell us in your consultations and check-ins, including your history, injuries, symptoms and goals, and our clinical notes.",
        "Your wearable and training apps: if you choose to connect them, data such as heart rate, sleep, activity and the sessions you record.",
        "Your programme: the exercise plan we set, what you complete, and the messages and voice notes you send through the app.",
        "Bookings and payments: appointment times and payment records.",
      ];

  const whoCanSee = regenerate
    ? [
        p(
          "Only the people named on the consent page in the app, and only the parts of your record shown beside their name. Each person's professional role is shown, so you can see who is a registered healthcare professional and who is not. Nobody on the programme team can see your information through the app until you have signed that consent, and if you withdraw it, their access stops at once.",
        ),
        p(
          "Your employer, or anyone else paying for your place, never sees your individual information. With your separate permission, they may receive anonymous summaries about a whole group, never smaller than five people.",
        ),
      ]
    : [
        p(
          "Dr David Silver PhD sees your record so that he can assess you and run your programme. If your programme involves another named clinician, you will be asked in the app to agree before they can see anything, and they will see only the parts of your record listed against their name.",
        ),
      ];

  const suppliers: string[][] = [
    ["Supabase", "Stores your record", "London, United Kingdom"],
    ["Vercel", "Runs the app", "London, United Kingdom"],
    ["Resend", "Sends the app's emails", "United States"],
    ["Setmore", "Appointment bookings", "United States"],
    ["Stripe", "Card payments", "United Kingdom and United States"],
    ["Twofold", "Turns consultation recordings into written notes, only if you agree", "United States"],
    ["OpenAI", "Turns your voice notes into text", "United States"],
    ["Anthropic", "Helps the team draft and organise notes and forms", "United States"],
    ["Rook", "Connects your wearable, only if you choose to", "Details available on request"],
    ["Concept2", "Connects your Concept2 logbook, only if you choose to", "Details available on request"],
  ];
  if (regenerate) {
    suppliers.push(
      ["Randox", "Blood testing", "United Kingdom"],
      ["Firstbeat", "Heart rate variability monitor and analysis", "Finland, European Union"],
      ["Our gut microbiome testing partner", "Gut microbiome testing", "Details available on request"],
      ["Jisc", "Online questionnaires", "United Kingdom"],
    );
  }

  return {
    title: regenerate ? "How we look after your information" : "Privacy notice",
    sub: regenerate
      ? "ROAM privacy notice for participants in the Regenerate Corporate Athlete Programme."
      : "How Athena Physio and Dr David Silver PhD look after your information.",
    version: VERSION,
    blocks: [
      p(
        regenerate
          ? "This notice explains what information we collect about you during the programme, why we need it, who can see it, where it is kept and what your rights are. Please read it alongside the consent page in the app, which lists by name the people who can see each part of your record."
          : "This notice explains what information we collect about you, why we need it, who can see it, where it is kept and what your rights are.",
      ),
      h("Who is responsible for your information"),
      ...controller,
      p(`For any question about your information, contact Dr David Silver PhD at ${LEGAL_CONTACT_EMAIL}.`),
      h("What we collect"),
      list(collect),
      p("Most of this is health information, which the law treats as especially sensitive, and we handle it with that in mind."),
      h("Why we use it, and our legal reasons"),
      table(
        ["What we use it for", "Our legal reason"],
        [
          [
            regenerate ? "Assessing you, designing and running your programme, and measuring your progress" : "Assessing you, treating you, and designing and running your programme",
            "Our agreement with you, and health care provided by registered professionals who owe you a duty of confidentiality",
          ],
          ["Keeping clinical records, as our professional regulators require", "Health care by registered professionals, and our legal and professional duties"],
          ...(regenerate
            ? [
                ["Sharing named parts of your record with the programme team listed on your consent page", "Your explicit consent"],
                ["Recording and transcribing consultations, research use, group reports, testimonials", "Your explicit consent, asked for separately for each one, and entirely optional"],
              ]
            : [["Sharing your record with another named clinician involved in your programme", "Your explicit consent"]]),
          ["Sending you our newsletter, if you ticked the box", "Your consent, which you can withdraw at any time from any newsletter"],
          ["Bookings, payments and admin", "Our agreement with you"],
          ["Acting in an emergency where you cannot consent", "Protecting your vital interests"],
        ],
      ),
      h("Who can see it"),
      ...whoCanSee,
      p(
        "We will only share your information outside this list if you ask us to, if a court or the law requires it, or if we believe you or someone else is at serious risk of harm.",
      ),
      h("Companies that help us run the service"),
      p("These companies store or process information for us under contract, and they are not allowed to use it for their own purposes."),
      table(["Company", "What it does for us", "Where your information is held"], suppliers),
      p(
        "Where information goes to the United States, we use companies covered by the UK's approved arrangements for transfers there, or we put the UK's standard transfer agreement in place with them.",
      ),
      h("How we keep it safe"),
      p(
        "Every member of the team logs in with their own account and a code sent to their email on any new device. The app keeps a log of who opened your record, when, and which part. Your record is stored in London and encrypted while it travels between your device and our systems. We do not send results or clinical notes by ordinary email; you will find them in the app.",
      ),
      h("Computer tools and AI"),
      p(
        "If you agree, an AI note-taking tool (Twofold) listens to your consultation and drafts written notes, which a clinician then checks and corrects; the recording itself is not kept. Voice notes you send in the app are turned into text by an AI service (OpenAI) so that the team can read them. No decision about you is ever made by a computer alone; every assessment, plan and change is made by a person.",
      ),
      h("How long we keep it"),
      p(
        "We keep your record for eight years after your last contact with us, in line with the guidance of the Chartered Society of Physiotherapy, and then delete it securely. Records about a child are kept for longer, as professional guidance requires. If you withdraw your consent, sharing stops straight away, but we still keep the clinical record for that period because our regulators require it.",
      ),
      h("Your rights"),
      p(
        `You can ask us for a copy of your information, ask us to correct anything wrong, ask us to delete or limit what we use where the law allows, take a copy of what you gave us in a usable format, object to how we use it, and withdraw any consent at any time, from the app or by emailing ${LEGAL_CONTACT_EMAIL}. We will answer within one month, and there is no charge.`,
      ),
      h("If you are unhappy"),
      p(
        `Please tell us first at ${LEGAL_CONTACT_EMAIL}. You also have the right to complain to the Information Commissioner's Office, the UK's data protection regulator, at ico.org.uk/make-a-complaint or on 0303 123 1113.`,
      ),
      h("Changes to this notice"),
      p("If we change this notice in a way that affects you, we will tell you through the app before the change takes effect."),
    ],
  };
}

// ---------------------------------------------------------------------------
// Terms: programme terms (Regenerate) and terms of use for the app (all)
// ---------------------------------------------------------------------------

function appTerms(regenerate: boolean): LegalBlock[] {
  return [
    h(regenerate ? "Using the ROAM app" : "Using the app"),
    list([
      `Who provides the app. ${regenerate ? "ROAM" : "The app"} is provided by Athena Physio, the practice of Dr David Silver PhD${regenerate ? ", for the Regenerate Corporate Athlete Programme" : ""}.`,
      `Your account. Your account is for you alone. Keep your password private, use a password you do not use anywhere else, and tell us straight away at ${LEGAL_CONTACT_EMAIL} if you think someone else has used your account. New accounts are checked and approved before they open.`,
      "Using the app properly. Use the app only for your own programme. Please do not try to access anyone else's information, copy or share the exercise library or programmes, or interfere with how the app works.",
      regenerate
        ? "Content and ownership. Exercise videos, programmes and tools in the app are for your personal use while you are on the programme. Material Regenerate commissions for the programme belongs to Regenerate; Dr David Silver PhD's existing programmes, exercise library, platform and clinical reasoning remain his. Information you put into the app about yourself remains yours."
        : "Content and ownership. Exercise videos, programmes and tools in the app are for your personal use while you are a client, and they remain the work of Dr David Silver PhD. Information you put into the app about yourself remains yours.",
      "Availability. We work to keep the app running and secure, but it may occasionally be unavailable for maintenance or for reasons outside our control, so please never rely on it in an emergency.",
      "Changes and ending. We may update the app and these terms, and we will tell you in the app before any change that affects you. Your access ends when your programme ends, and your records are then kept as set out in the privacy notice. We may suspend an account that is misused, and we will tell you why.",
    ]),
  ];
}

function terms(regenerate: boolean): LegalDoc {
  if (!regenerate) {
    return {
      title: "Terms",
      sub: "Important information about your programme and the app.",
      version: VERSION,
      blocks: [
        h("This is not an emergency service"),
        p(
          "Messages and voice notes in the app are not monitored around the clock. If you have chest pain, severe breathlessness, collapse or any other emergency, call 999 in the UK or your local emergency number. If you are in crisis with your mental health, you can call Samaritans free on 116 123 at any time.",
        ),
        h("Your programme works alongside your own doctor"),
        p(
          "Your programme supports your recovery and performance; it does not replace your GP. Do not stop or change any prescribed medicine because of anything in your programme without speaking to the doctor who prescribed it.",
        ),
        h("Exercise safely"),
        p(
          "Work within the limits you are given, and stop and tell us if you feel chest pain, unusual breathlessness, dizziness, palpitations or sharp pain. Tell us if you are unwell, injured or have started a new medicine. You are responsible for exercising in a safe place with suitable equipment.",
        ),
        ...appTerms(false),
        h("Concerns and complaints"),
        p(
          `Please raise any concern with Dr David Silver PhD at ${LEGAL_CONTACT_EMAIL} first. You can also contact the Health and Care Professions Council, which regulates physiotherapists, and concerns about your data can go to the Information Commissioner's Office, as explained in the privacy notice.`,
        ),
        h("Law"),
        p("These terms are governed by the law of England and Wales."),
      ],
    };
  }
  return {
    title: "Programme terms and important information",
    sub: "Regenerate Corporate Athlete Programme and the ROAM app.",
    version: VERSION,
    blocks: [
      p(
        "These terms cover the health, safety and app side of the programme. Fees, payment and cancellation are set out separately in your agreement with Regenerate Wellness. If the two ever differ on a health or safety point, these terms apply.",
      ),
      h("1. Who provides what"),
      p(
        "Regenerate Wellness runs the programme. The clinical parts are delivered by the named professionals on your consent page, and each of them is responsible for their own advice within their own professional registration. The ROAM app is provided by Athena Physio, the practice of Dr David Silver PhD.",
      ),
      h("2. This is not an emergency service"),
      p(
        "Messages and voice notes in the app are not monitored around the clock. If you have chest pain, severe breathlessness, collapse or any other emergency, call 999 in the UK, 911 in the US, or your local emergency number. If you are in crisis with your mental health, call Samaritans on 116 123 in the UK, or call or text 988 in the US.",
      ),
      h("3. The programme works alongside your own doctor"),
      p(
        "The programme supports your health and performance; it does not replace your GP or personal physician. Keep seeing your own doctor as usual, and do not stop or change any prescribed medicine because of anything in the programme without speaking to the doctor who prescribed it.",
      ),
      h("4. What the measurements can and cannot tell you"),
      list([
        "Heart monitoring. The Firstbeat Bodyguard 3 is a wellbeing device; its maker states that it is not a medical device and is not intended to diagnose disease. A normal report does not mean your heart is healthy, and an unusual one is a reason to speak to a doctor rather than a diagnosis.",
        "Blood tests. Results are reviewed by the programme's doctor alongside your history. Laboratory reference ranges are averages and may not reflect what is right for you.",
        "Gut microbiome and questionnaires. These describe patterns that may be useful for lifestyle change; they are not diagnostic tests.",
        "Your own numbers. Progress is shown against your own earlier results rather than other people's.",
      ]),
      h("5. If a result needs follow-up"),
      p(
        "If any result suggests you should see a doctor, the programme's doctor will tell you directly, explain why and how soon, and, if you agree, write to your own doctor. Sometimes tests show something nobody was looking for, and if that happens we will always tell you, even if it is unrelated to the programme.",
      ),
      h("6. Exercise safely"),
      p(
        "Work within the limits you are given, and stop at once and tell us if you feel chest pain, unusual breathlessness, dizziness, palpitations or sharp pain. Tell us before each session if you are unwell, injured or have started a new medicine. You are responsible for exercising in a safe place with suitable equipment.",
      ),
      h("7. Remote sessions and travel"),
      p(
        "Much of the programme is delivered remotely. For each live session, please be somewhere private, tell us at the start which country you are in, and keep a phone nearby. While you are outside the UK, remote sessions are coaching and education, and clinical assessment and treatment take place in person when you are in the UK. If you need treatment while abroad, we will help you find a suitable local professional.",
      ),
      h("8. Results are not guaranteed"),
      p("Everyone responds differently, and we cannot promise any particular outcome."),
      h("9. Responsibility"),
      p("Nothing in these terms limits responsibility for death or personal injury caused by negligence, or anything else that cannot be limited by law."),
      h("10. Pausing or stopping"),
      p(
        "You can stop at any time. We may pause your programme if we have a safety concern, and we will always explain why and what needs to happen to restart.",
      ),
      ...appTerms(true),
      h("Concerns and complaints"),
      p(
        `Please raise any concern with Dr David Silver PhD at ${LEGAL_CONTACT_EMAIL} first. You can also contact the professional regulator of the person concerned: the Health and Care Professions Council for physiotherapists, and the General Medical Council for doctors. Concerns about your data can go to the Information Commissioner's Office, as explained in the privacy notice.`,
      ),
      h("Law"),
      p("These terms are governed by the law of England and Wales."),
    ],
  };
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

function cookies(regenerate: boolean): LegalDoc {
  const app = regenerate ? "ROAM" : "The app";
  return {
    title: "Cookies and your device",
    sub: `How ${regenerate ? "ROAM" : "the app"} uses small files on your phone or computer.`,
    version: VERSION,
    blocks: [
      p(
        `${app} stores a small number of files, known as cookies, on your phone or computer. We use them only to make the app work for you. We do not use advertising cookies, and we do not use tracking or analytics tools that follow you around the internet.`,
      ),
      table(
        ["What it does", "Why", "How long it lasts"],
        [
          ["Keeps you securely logged in", "Without it you would have to log in on every page", "Until you log out or your session ends"],
          ["Remembers which programme's look to show you", "So the app opens in your programme's design, even before you log in", "Up to one year"],
          ["Remembers the loading screen for your programme", "So the app opens smoothly in your programme's design", "Up to one year"],
        ],
      ),
      p(
        "Because these files are needed for the service you have asked for, we do not ask for separate permission to use them. You can clear them at any time in your browser or phone settings, and you will then need to log in again.",
      ),
      p(`If you have any question about this, contact Dr David Silver PhD at ${LEGAL_CONTACT_EMAIL}.`),
    ],
  };
}

export function legalDoc(page: LegalPage, regenerate: boolean): LegalDoc {
  if (page === "privacy") return privacy(regenerate);
  if (page === "terms") return terms(regenerate);
  return cookies(regenerate);
}

export const LEGAL_TITLES: Record<LegalPage, string> = {
  privacy: "Privacy notice",
  terms: "Terms",
  cookies: "Cookies",
};
