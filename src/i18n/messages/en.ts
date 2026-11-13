// The English word list: the master copy every other language follows.
// Words are placed into sentences with {name} style gaps, so a translator can
// move them to wherever that language needs them. A gap called {link} is
// filled with a link rather than plain text.
//
// The voice rules in CLAUDE.md apply here and to every translation.

export const en = {
  tabs: {
    home: "Home",
    programme: "Programme",
    tools: "Tools",
    passport: "Passport",
    me: "Me",
    team: "Team",
    messages: "Messages",
  },
  me: {
    title: "Me",
    lead: "Your details, your consent, your connected apps, and anything waiting for you.",
    waitingTitle: "Waiting for you",
    nothingWaiting: "Nothing to fill in at the moment.",
    diaryTitle: "Your diary",
    diaryBody: "Fit your practice around your working week, link Google Calendar, and let your PA place sessions for you.",
    diaryLink: "Plan this week and next",
    detailsTitle: "Your details",
    name: "Name",
    email: "Email",
    mobile: "Mobile",
    notRecorded: "Not recorded",
    changeWithMessage: "If anything here needs changing, {link} and it will be updated for you.",
    changeLink: "send the team a message",
    changeNoMessage: "If anything here needs changing, let the clinic know and it will be updated for you.",
  },
  apps: {
    title: "Connected apps",
    body: "Link the apps you train with, so your sessions reach your programme without you typing anything in. You can unlink any of them at any time.",
    concept2: "Concept2 Logbook, for your rows on the PM5: {status}",
    connected: "connected",
    connectedLastRead: "connected, last read {date}",
    notConnected: "not connected",
    workouts: "Upload a workout file, from your Wattbike, watch, Zwift or any other app",
    trainingData: "Add training data: a logbook export, a test or race result, or a screenshot",
    wearable: "Your watch or wearable, such as Garmin",
  },
  info: {
    title: "Your information",
    body: "How we look after your information, who can see it, and the choices you have made. You can read any of these at any time.",
    privacy: "Privacy notice: what we collect, why, where it is kept and your rights",
    terms: "Terms: how the programme and the app work",
    cookies: "Cookies: the small files the app keeps on your device",
    consentRow: "Who can see your record ({package}): {status}",
    consentSigned: "you have given your consent",
    consentWithdrawn: "you have withdrawn your consent",
    consentNeedsResign: "please review the updated list",
    consentWaiting: "waiting for your consent",
    agreedOn: "You agreed to the privacy notice and terms on {date}.",
    notAgreed: "Your agreement to the privacy notice and terms has not been recorded in the app yet.",
    request: "Ask for a copy of your information, a correction or a deletion",
    requestReply: "We answer every request within one month, and there is no charge.",
  },
  language: {
    title: "Language",
    label: "App language",
    body: "Choose the language the app shows you. Your programme notes and messages from the team stay in the language they were written in until they are translated.",
    draftNote: "This translation is new and is still being checked by a native speaker, so if anything reads oddly, please tell the team.",
    error: "That did not save, so please try again.",
  },
} as const;

// The shape every other language's word list follows.
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
export type PartialMessages = { [K in keyof Messages]?: Partial<Messages[K]> };
