import "server-only";
import { listClientDocuments, listContextEntries, listPhysicalEntries } from "@/lib/clientBackground";
import { loadClinicPassport } from "@/lib/passportServer";
import { timepointLabel } from "@/lib/passport";
import { PERSON_ARMS, type ArmKey } from "@/lib/personMap";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { passportEnabledFor, passportFeaturesOn } from "@/lib/passportFeatures";

// What the Overview shows from Client profile: the Client context summary
// exactly as Dr David Silver PhD wrote it, and one plain line for each arm
// saying what is on record. Nothing is generated or guessed.

export type ArmCount = { key: ArmKey; label: string; text: string; count: number };

export type BackgroundSummary = {
  summary: string[];
  latest: { label: string; hasNotes: boolean } | null;
  arms: ArmCount[];
  empty: boolean;
};

export async function buildBackgroundSummary(patientId: string): Promise<BackgroundSummary> {
  const [entries, counts, enabled, brand] = await Promise.all([
    listContextEntries(patientId).catch(() => []),
    countArms(patientId),
    passportEnabledFor(patientId).catch(() => false),
    resolveBrandPack({ patientId }).catch(() => null),
  ]);
  // A client without the passport shows no Physiology, Psychology or
  // Physicality lines, only their consultation summary.
  const passportOn = passportFeaturesOn(enabled, brand);
  const latest = entries[0] ?? null;
  const summary = (latest?.summary_text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    summary,
    latest: latest
      ? { label: `${consultationLabel(latest.timepoint)} consultation, ${day(latest.consulted_on)}`, hasNotes: Boolean(latest.notes_text?.trim()) }
      : null,
    arms: passportOn ? counts : [],
    empty: !latest && (!passportOn || counts.every((a) => a.count === 0)),
  };
}

// How much sits in each arm, for the diagram and the Overview.
export async function countArms(patientId: string): Promise<ArmCount[]> {
  const [passport, questionnaires, physical] = await Promise.all([
    loadClinicPassport(patientId).catch(() => null),
    listClientDocuments(patientId, "questionnaire").catch(() => []),
    listPhysicalEntries(patientId).catch(() => []),
  ]);
  const domainOf = new Map((passport?.markers ?? []).map((m) => [m.marker_key, m.domain as string]));
  const resultsIn = (domains: readonly string[]) =>
    (passport?.results ?? []).filter((r) => domains.includes(domainOf.get(r.marker_key) ?? "")).length;

  return PERSON_ARMS.map((arm) => {
    const results = resultsIn(arm.domains);
    const parts: string[] = [];
    let count = results;
    if (results) parts.push(plural(results, "passport result"));
    if (arm.key === "psychology" && questionnaires.length) {
      parts.push(plural(questionnaires.length, "questionnaire"));
      count += questionnaires.length;
    }
    if (arm.key === "physicality" && physical.length) {
      parts.push(plural(physical.length, "note"));
      count += physical.length;
    }
    return { key: arm.key, label: arm.label, text: parts.length ? joinAnd(parts) : "nothing yet", count };
  });
}

export function consultationLabel(timepoint: string): string {
  const label = timepointLabel(timepoint).replace(" months", " month");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
