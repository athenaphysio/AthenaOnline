// Runs the strength engine against a saved copy of the exercise library and
// a client's intake text, and prints the sessions, so a change to the rules
// can be checked before it reaches a client.
//   npx tsx scripts/test-strength-engine.ts <library.json> <intake.txt> [overrides.json]

import { readFileSync } from "node:fs";
import { applyOverrides, readStrengthProfile } from "../src/lib/strengthProfile";
import { buildStrengthSessions, type EngineExercise } from "../src/lib/strengthEngine";

const [libraryPath, intakePath, overridesPath] = process.argv.slice(2);
const library = JSON.parse(readFileSync(libraryPath, "utf8")) as EngineExercise[];
const intake = readFileSync(intakePath, "utf8");
const overrides = overridesPath ? JSON.parse(readFileSync(overridesPath, "utf8")) : null;
const profile = applyOverrides(readStrengthProfile([intake]), overrides);

const weeks = 6;
const others = Array.from({ length: weeks }, (_, i) => i + 1).flatMap((week) => [
  { week, day: 1, type: "swim", title: "Swim pace set", summary: "5 x 300 m", total: "1950 m" },
  { week, day: 2, type: "run", title: "Tempo run", summary: "3 x 1.5 km at tempo", total: "About 7 km" },
  { week, day: 3, type: "bike", title: "Easy Zwift ride", summary: "60 min easy", total: "60 min" },
  { week, day: 4, type: "other", title: "Football", summary: "Your usual football", total: "" },
  { week, day: 5, type: "run", title: "Longer easy run", summary: "9 km easy", total: "9 km" },
  { week, day: 6, type: "bike", title: week === 3 ? "Long ride with tempo" : "Long ride", summary: "2.5 hours", total: "2.5 hours" },
]);
const slots = Array.from({ length: weeks }, (_, i) => i + 1).flatMap((week) => [1, 2, 4].map((day) => ({ key: `s${week}${day}`, week, day })));
const prepItem = (id: string) => ({ exercise_id: id, sets: 1, reps: 6, hold_seconds: null, prescription_mode: "reps_and_sets", rationale: "Warm up." });
const result = buildStrengthSessions({
  profile,
  library,
  prep: { upper: { name: "Gym Prep: Upper Body", items: ["EX-068", "EX-157"].map(prepItem) }, lower: { name: "Gym Prep: Lower Body", items: ["EX-094", "EX-072"].map(prepItem) } },
  slots: overrides?.noSlots ? [] : slots,
  others,
  weeks,
});

const name = new Map(library.map((e) => [e.exercise_id, e.name]));
console.log("PROFILE", JSON.stringify({ ...profile, evidence: undefined }, null, 0));
for (const s of result.sessions) {
  console.log(`\n== ${s.name} (${s.region}) about ${s.minutes} of ${s.targetMinutes} min`);
  for (const b of s.blocks) {
    console.log(`  [${b.slot} ${b.sequence}] ${b.name}`);
    for (const it of b.items) {
      const w = it.rows.map((r) => `${r.sets}x${r.reps ?? `${r.hold_seconds}s`}${r.exercise_id !== it.rows[0].exercise_id ? `(${r.exercise_id})` : ""}`).join(" ");
      console.log(`    ${it.rows[0].exercise_id} ${name.get(it.rows[0].exercise_id)}: ${w}`);
    }
  }
  console.log(`  wk1 text: ${s.blocks.find((b) => b.slot === "main_body")?.items[0].rows[0].rationale}`);
  console.log(`  wk4 text: ${s.blocks.find((b) => b.slot === "main_body")?.items[0].rows[3].rationale}`);
  for (const r of s.reasons) console.log(`  - ${r}`);
}
console.log("\nPLACEMENTS wk1:", result.placements.filter((p) => p.week === 1).map((p) => `${p.day}:${p.sessionKey}`).join(" "));
console.log("NOTES:", result.notes);
