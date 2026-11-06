// What the registration form says and asks for, by brand pack. The standard
// Athena Physio version covers clinic clients, including children registered
// by a parent or guardian. Regenerate Wellness (the ROAM app, for the
// Corporate Athlete Executive Programme) is for adult executives on a
// performance programme, not treatment, so it has no parent or guardian
// route, no cancellation policy and no treatment consent, and names
// Regenerate Wellness wherever the standard form names Athena Physio.

export type RegistrationProfile = {
  orgName: string;
  introSub: string;
  allowGuardian: boolean;
  cancellationPolicy: boolean;
  treatmentConsent: boolean;
  referralOptions: string[];
  notesPolicy: string;
};

const STANDARD: RegistrationProfile = {
  orgName: "Athena Physio",
  introSub: "Required details ahead of your appointment.",
  allowGuardian: true,
  cancellationPolicy: true,
  treatmentConsent: true,
  referralOptions: [
    "Google search",
    "Instagram / social media",
    "Friend or family referral",
    "GP referral",
    "Walked past / saw the clinic",
    "Existing Athena client",
    "Other",
  ],
  notesPolicy: "Athena Physio uses transcription-based note keeping: session notes are generated from a transcript.",
};

const REGENERATE: RegistrationProfile = {
  orgName: "Regenerate Wellness",
  introSub: "Required details before you start the programme.",
  allowGuardian: false,
  cancellationPolicy: false,
  treatmentConsent: false,
  referralOptions: [
    "Through my employer",
    "Recommended by a colleague",
    "Friend or family referral",
    "Google search",
    "LinkedIn / social media",
    "Existing Regenerate client",
    "Other",
  ],
  notesPolicy:
    "Regenerate Wellness, in conjunction with Athena Physio, uses transcription-based note keeping: session notes are generated from a transcript.",
};

export function registrationProfile(packName: string | null | undefined): RegistrationProfile {
  return packName?.trim().toLowerCase() === "regenerate wellness" ? REGENERATE : STANDARD;
}
