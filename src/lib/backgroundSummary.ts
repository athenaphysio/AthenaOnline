import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listClientDocuments, listContextEntries, type ContextEntry } from "@/lib/clientBackground";
import { CONTEXT_SCALES } from "@/lib/clientContext";
import { buildSummaries, loadClinicPassport } from "@/lib/passportServer";
import { timepointLabel } from "@/lib/passport";

// A short written summary of a client's background for the Overview, put
// together from what is recorded in Client background: the latest
// consultation, how the scales have moved since the first one, the health
// passport and any questionnaires. It only ever repeats what is recorded,
// in plain sentences, and leaves out anything that is missing. Nothing is
// generated or guessed.

export type BackgroundSummary = {
  paragraphs: string[];
  redFlags: string[];
  latest: { timepoint: string; consultedOn: string } | null;
  empty: boolean;
};

// The scales most useful at a glance, in the order they are mentioned.
const HEADLINE_SCALES = ["readiness", "stress", "coping", "energy", "pain_interference", "body_confidence", "confidence"];

export async function buildBackgroundSummary(patientId: string): Promise<BackgroundSummary> {
  const [{ data: patient }, entries, passport, questionnaires] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name, presenting_complaint").eq("id", patientId).maybeSingle<{ first_name: string; presenting_complaint: string | null }>(),
    listContextEntries(patientId).catch(() => [] as ContextEntry[]),
    loadClinicPassport(patientId).catch(() => null),
    listClientDocuments(patientId, "questionnaire").catch(() => []),
  ]);

  const name = patient?.first_name?.trim() || "This client";
  const paragraphs: string[] = [];
  const latest = entries[0] ?? null;
  const first = entries.length > 1 ? entries[entries.length - 1] : null;

  // 1. Who they are and why they came, from the latest consultation.
  if (latest) {
    const c = latest.content;
    const field = (section: string, label: string) =>
      c.sections.find((s) => s.key === section)?.fields.find((f) => f.label === label)?.value.trim() ?? "";
    const role = field("person_life", "Role, organisation and seniority");
    const reason = field("opening", "Reason for attending, in their own words") || c.referral.presenting_complaint || patient?.presenting_complaint || "";

    const opening: string[] = [];
    opening.push(`From the ${consultationLabel(latest.timepoint)} consultation on ${day(latest.consulted_on)}.`);
    if (role) opening.push(`${name}: ${sentence(role)}`);
    if (reason) opening.push(`Reason for attending: ${sentence(reason)}`);
    if (c.anchor_statement) opening.push(`In ${possessive(name)} own words, “${c.anchor_statement.replace(/^["“]|["”]$/g, "")}”`);
    paragraphs.push(opening.join(" "));

    const plan: string[] = [];
    if (c.goals.length) plan.push(`Goals: ${list(c.goals.map((g) => lowerFirst(g.goal.replace(/\.$/, ""))))}.`);
    if (c.top_priority) plan.push(`Top priority: ${sentence(c.top_priority)}`);
    if (c.first_action) plan.push(`First action agreed: ${sentence(c.first_action)}`);
    const scaleBits = HEADLINE_SCALES.map((key) => {
      const score = c.scales.find((s) => s.key === key)?.score;
      const def = CONTEXT_SCALES.find((s) => s.key === key);
      return score != null && def ? `${def.label.toLowerCase()} ${fmt(score)}/10` : null;
    }).filter((x): x is string => Boolean(x));
    if (scaleBits.length) plan.push(`Self ratings: ${list(scaleBits)}.`);
    const otherFlags = c.flags.filter((f) => f.kind !== "red_flag").map((f) => f.text);
    if (otherFlags.length) plan.push(`To keep in mind: ${list(otherFlags.map((t) => lowerFirst(t.replace(/\.$/, ""))))}.`);
    if (plan.length) paragraphs.push(plan.join(" "));

    // 2. Change since the first consultation, where the same scale was
    // recorded both times and moved by at least one point.
    if (first) {
      const moves = CONTEXT_SCALES.map((def) => {
        const a = first.content.scales.find((s) => s.key === def.key)?.score;
        const b = c.scales.find((s) => s.key === def.key)?.score;
        if (a == null || b == null || Math.abs(b - a) < 1) return null;
        return `${def.label.toLowerCase()} ${fmt(a)} to ${fmt(b)}`;
      }).filter((x): x is string => Boolean(x));
      if (moves.length) paragraphs.push(`Since the ${consultationLabel(first.timepoint)} consultation on ${day(first.consulted_on)}: ${list(moves)}.`);
    }
  }

  // 3. Health passport.
  if (passport && passport.results.length) {
    const domains = buildSummaries(passport.markers, passport.results).filter((d) => d.series.length > 0);
    const series = domains.flatMap((d) => d.series);
    const improving = series.filter((s) => s.trend === "improving").length;
    const watch = series.filter((s) => s.status === "worth_a_conversation").map((s) => s.marker.name);
    const drafts = passport.results.filter((r) => r.status === "draft").length;
    const bits = [
      `Health passport: ${series.length} marker${series.length === 1 ? "" : "s"} across ${domains.length} area${domains.length === 1 ? "" : "s"}`,
      series.some((s) => s.results.length > 1) ? `${improving} improving since the first reading` : "first readings only so far",
    ];
    let text = `${bits.join(", ")}.`;
    if (watch.length) text += ` Worth a conversation: ${list(watch.slice(0, 5))}${watch.length > 5 ? ` and ${watch.length - 5} more` : ""}.`;
    if (drafts) text += ` ${drafts} result${drafts === 1 ? " is" : "s are"} still a draft, not yet released to ${name}.`;
    paragraphs.push(text);
  }

  // 4. Questionnaires.
  if (questionnaires.length) {
    const recent = questionnaires[0];
    paragraphs.push(
      `Questionnaires: ${questionnaires.length} on file, most recently ${recent.title}${recent.dated ? ` (${day(recent.dated)})` : ""}.`
    );
  }

  const redFlags = latest ? latest.content.flags.filter((f) => f.kind === "red_flag").map((f) => f.text) : [];
  return {
    paragraphs,
    redFlags,
    latest: latest ? { timepoint: latest.timepoint, consultedOn: latest.consulted_on } : null,
    empty: paragraphs.length === 0,
  };
}

// "6 month consultation", not "6 months consultation".
function consultationLabel(timepoint: string): string {
  return timepointLabel(timepoint).toLowerCase().replace(" months", " month");
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function sentence(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return /[.!?”"]$/.test(t) ? t : `${t}.`;
}

function lowerFirst(text: string): string {
  const t = text.trim();
  // Keep capitals that start a name or an acronym, such as "I" or "GP".
  if (/^(I\b|[A-Z]{2,})/.test(t)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function possessive(name: string): string {
  return name === "This client" ? "the client's" : name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
