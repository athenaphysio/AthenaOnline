import "server-only";
import { anthropic } from "@/lib/anthropic";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";

export type RunningBuilderExercise = {
  exercise_id: string | null;
  name: string;
  sets: number | null;
  reps: number | null;
  load: string | null;
};

export type RunningBuilderStrengthExercise = {
  exercise_id: string | null;
  name: string;
  sets: number | null;
  reps: number | null;
};

export type RunningBuilderLockedBlock = {
  name: string;
  exercises: RunningBuilderStrengthExercise[];
  unlock_condition: string;
};

export type RunningBuilderCrossTrainingOption = {
  name: string;
  description: string | null;
};

export type RunningBuilderDraft = {
  header: {
    goal: string;
    event: string | null;
    event_date: string | null;
    current_capacity: string | null;
    cross_training_baseline: string | null;
  };
  pre_run_prep: RunningBuilderExercise[];
  ladder: {
    ladder_id: string | null;
    ladder_name: string | null;
    start_rung_number: number | null;
    /** Only ever a suggestion, never applied automatically -- set when the
     * note doesn't say which rung to start on, based on stated capacity.
     * David decides for real on the review screen. */
    suggested_rung_number: number | null;
  };
  weekly_structure: {
    quality_runs: number;
    easy_runs: number;
    strength_sessions: number;
    cross_training_sessions: number;
    easy_run_treadmill: boolean;
  };
  strength_session: RunningBuilderStrengthExercise[];
  cross_training: RunningBuilderCrossTrainingOption[];
  locked_blocks: RunningBuilderLockedBlock[];
  rules: string | null;
  flags: string[];
};

type ExerciseCandidate = { exercise_id: string; name_clinical: string; body_site: string | null; equipment: string | null };
type LadderCandidate = {
  id: string;
  name: string;
  phase_label: string | null;
  rungs: {
    rung_number: number;
    repeats: number | null;
    run_portion: string | null;
    recovery: string | null;
    target_pace: string | null;
    effort_cue: string | null;
    total_running_minutes: string | null;
  }[];
};

function formatExerciseCandidates(pool: ExerciseCandidate[]): string {
  return pool
    .map((e) => {
      const details = [e.body_site, e.equipment].filter(Boolean).join(", ");
      return `- id=${e.exercise_id} | "${e.name_clinical}"${details ? ` (${details})` : ""}`;
    })
    .join("\n");
}

function formatLadderCandidates(pool: LadderCandidate[]): string {
  if (pool.length === 0) return "(no active ladders)";
  return pool
    .map((l) => {
      const rungLines = l.rungs
        .map((r) => {
          const session = [r.repeats && r.run_portion ? `${r.repeats} x ${r.run_portion}` : r.run_portion, r.recovery]
            .filter(Boolean)
            .join(", ");
          const parts = [session || "(not set)"];
          if (r.total_running_minutes) parts.push(`total ${r.total_running_minutes}`);
          if (r.target_pace) parts.push(`pace ${r.target_pace}`);
          if (r.effort_cue) parts.push(`cue: ${r.effort_cue}`);
          return `  ${r.rung_number}) ${parts.join(", ")}`;
        })
        .join("\n");
      return `- id=${l.id} | "${l.name}"${l.phase_label ? ` (${l.phase_label})` : ""}\n${rungLines || "  (no rungs yet)"}`;
    })
    .join("\n");
}

// The Claude API caps a JSON schema at 16 nullable/union-typed fields
// (exponential compilation cost). This draft's natural shape needed 20, so
// every STRING field that can be "not stated" is typed as a plain,
// non-nullable string here and uses "" as the sentinel for that, instead of
// `["string", "null"]`. parseRunningFramework() converts every "" back to a
// real null immediately after parsing, so nothing outside this file ever
// sees the sentinel -- RunningBuilderDraft itself still types these fields
// as `string | null`. Numeric fields (sets, reps, rung numbers) stay
// genuinely nullable since there are few enough of them to fit the limit.
function buildSchema() {
  const exerciseItem = {
    type: "object",
    properties: {
      exercise_id: { type: "string" },
      name: { type: "string" },
      sets: { type: ["number", "null"] },
      reps: { type: ["number", "null"] },
      load: { type: "string" },
    },
    required: ["exercise_id", "name", "sets", "reps", "load"],
    additionalProperties: false,
  };
  const lockedBlock = {
    type: "object",
    properties: {
      name: { type: "string" },
      exercises: { type: "array", items: exerciseItem },
      unlock_condition: { type: "string" },
    },
    required: ["name", "exercises", "unlock_condition"],
    additionalProperties: false,
  };
  const crossTrainingOption = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
    },
    required: ["name", "description"],
    additionalProperties: false,
  };

  return {
    type: "object",
    properties: {
      header: {
        type: "object",
        properties: {
          goal: { type: "string" },
          event: { type: "string" },
          event_date: { type: "string" },
          current_capacity: { type: "string" },
          cross_training_baseline: { type: "string" },
        },
        required: ["goal", "event", "event_date", "current_capacity", "cross_training_baseline"],
        additionalProperties: false,
      },
      pre_run_prep: { type: "array", items: exerciseItem },
      ladder: {
        type: "object",
        properties: {
          ladder_id: { type: "string" },
          ladder_name: { type: "string" },
          start_rung_number: { type: ["number", "null"] },
          suggested_rung_number: { type: ["number", "null"] },
        },
        required: ["ladder_id", "ladder_name", "start_rung_number", "suggested_rung_number"],
        additionalProperties: false,
      },
      weekly_structure: {
        type: "object",
        properties: {
          quality_runs: { type: "number" },
          easy_runs: { type: "number" },
          strength_sessions: { type: "number" },
          cross_training_sessions: { type: "number" },
          easy_run_treadmill: { type: "boolean" },
        },
        required: ["quality_runs", "easy_runs", "strength_sessions", "cross_training_sessions", "easy_run_treadmill"],
        additionalProperties: false,
      },
      strength_session: { type: "array", items: exerciseItem },
      cross_training: { type: "array", items: crossTrainingOption },
      locked_blocks: { type: "array", items: lockedBlock },
      rules: { type: "string" },
      flags: { type: "array", items: { type: "string" } },
    },
    required: [
      "header",
      "pre_run_prep",
      "ladder",
      "weekly_structure",
      "strength_session",
      "cross_training",
      "locked_blocks",
      "rules",
      "flags",
    ],
    additionalProperties: false,
  } as const;
}

// Turns every "" the model wrote (the required-non-null sentinel a plain
// `string` schema field uses for "not stated", see buildSchema() above)
// back into a real null, recursively, right after JSON.parse -- so nothing
// past this point in the file, or in any caller, ever has to know the
// sentinel exists.
function denullifyEmptyStrings(value: unknown): unknown {
  if (typeof value === "string") return value === "" ? null : value;
  if (Array.isArray(value)) return value.map(denullifyEmptyStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, denullifyEmptyStrings(v)]));
  }
  return value;
}

function buildSystemPrompt(exercises: string, ladders: string): string {
  return `You are helping Dr David Silver turn a running consultation note (from his own Twofold voice-note transcription tool) into a structured running programme draft at Athena Physio.

CLINICAL REASONING PROFILE (how Dr Silver reasons -- apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

You are reading a note that is ALREADY his own clinical judgement, written in his own words -- your job is to structure it faithfully, never to add clinical content he didn't write. If the note is silent on something, leave that field null or empty and say so in "flags"; never fill a gap with your own invented content.

HARD RULES, no exceptions:
0. Every STRING field described below as "leave it null" or "leave it empty" is typed as plain text, not nullable -- write an empty string "" for it, never the word "null" or any placeholder. This applies to exercise_id, load, event, event_date, current_capacity, cross_training_baseline, ladder_id, ladder_name, rules, and cross_training descriptions. The numeric fields (sets, reps, start_rung_number, suggested_rung_number) are genuinely nullable -- use JSON null for those when not stated. Never use an em dash or en dash anywhere in any text you write, including "flags" -- use a comma, a semicolon, or two sentences instead.
1. Every exercise (in pre_run_prep, strength_session, and any locked_blocks exercises) must be matched to a real exercise id from the library list below, by reading the note's own description against each candidate's name/body site/equipment. If you cannot find a genuine match for something the note names, set that exercise's "exercise_id" to "" (keep "name" as whatever the note called it) and add a line to "flags" saying it wasn't found in the library and needs a manual match or a new library entry. Never invent an exercise id, and never silently drop the exercise.
2. The ladder must be chosen from the active ladders list below, by "ladder_id". If the note doesn't clearly name one of these ladders (or names something not in the list), leave "ladder_id" and "ladder_name" as "" and add a flag saying so.
3. If the note does not explicitly say which rung to start the client on, do NOT guess -- leave "start_rung_number" null. You may still set "suggested_rung_number" to the rung that best matches the client's stated current running capacity, but it must be clearly a suggestion: add a flag like "No starting rung stated in the note -- rung N suggested based on stated capacity, needs David's confirmation." If the note DOES state a rung, set "start_rung_number" to it directly and leave "suggested_rung_number" null.
4. Keep David's own wording for cues, rules, and rationale wherever the note gives them -- do not paraphrase or "improve" his phrasing. Only write your own words for the odd structural label (e.g. a locked block's short name) where the note has no wording of its own to copy.
5. "rules" should capture the load management / flare-up rules exactly as written in the note, in David's own words, or "" if the note doesn't give any.
6. "locked_blocks" is for anything the note says to unlock later (e.g. a return-to-sport block), each with its own short name, its own exercises (matched the same way as above), and its unlock_condition written as the note states it (e.g. "5K milestone reached").
7. "flags" must list absolutely everything missing, unclear, or not found in the library -- David needs to see every gap without hunting for it. An empty flags array should only happen when the note was genuinely complete and everything matched cleanly.

EXERCISE LIBRARY (id, name, body site/equipment where known -- only choose from these):
${exercises}

ACTIVE RUNNING LADDERS (id, name, phase, and every rung's session/total/pace/cue -- only choose from these):
${ladders}

Return the full structured draft in the exact JSON shape requested. Every field must be present even when empty (empty array, or null), never omitted.`;
}

// Strips a ```json ... ``` or ``` ... ``` fence if the model wrapped its
// answer in one -- cheap insurance alongside the schema-constrained output
// below, never the only thing standing between a reply and JSON.parse.
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function parseRunningFramework(input: {
  note: string;
  exercises: ExerciseCandidate[];
  ladders: LadderCandidate[];
}): Promise<RunningBuilderDraft> {
  const exercisesById = new Map(input.exercises.map((e) => [e.exercise_id, e]));
  const laddersById = new Map(input.ladders.map((l) => [l.id, l]));

  const systemPrompt = buildSystemPrompt(formatExerciseCandidates(input.exercises), formatLadderCandidates(input.ladders));
  const schema = buildSchema();

  // Two attempts, no more -- a truncated or unparseable reply on the first
  // try is retried once automatically; a second failure surfaces as a
  // real, readable error rather than a silent loop. Every failure logs the
  // raw reply server-side (never shown to David) so a repeat can actually
  // be diagnosed.
  let parsedRaw: RunningBuilderDraft | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= 2 && !parsedRaw; attempt++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      // 16000, not 8000 -- adaptive thinking spends part of this same
      // budget on its own reasoning before writing the JSON answer, so
      // 8000 left too little room for both on a note this size and the
      // final answer was getting cut off mid-string (a truncated JSON
      // reply, not a malformed one -- this is why a schema-constrained
      // output alone didn't help; the model simply ran out of tokens).
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema },
      },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: `TWOFOLD RUNNING FRAMEWORK NOTE:\n\n${input.note.trim()}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

    if (response.stop_reason === "max_tokens") {
      lastError = "The AI's answer was cut off before it finished (the note may be unusually long). Please try again.";
      console.error(`Running Builder: model reply truncated (stop_reason=max_tokens) on attempt ${attempt}. Raw reply:`, rawText);
      continue;
    }
    if (!textBlock || textBlock.type !== "text") {
      lastError = "No text reply came back from the AI. Please try again.";
      console.error(`Running Builder: no text block in the model reply on attempt ${attempt}.`, JSON.stringify(response.content));
      continue;
    }

    try {
      parsedRaw = denullifyEmptyStrings(JSON.parse(stripJsonFences(rawText))) as RunningBuilderDraft;
    } catch (err) {
      lastError = "The AI's answer wasn't valid JSON. Please try again.";
      console.error(`Running Builder: JSON.parse failed on attempt ${attempt}:`, err, "Raw reply:", rawText);
    }
  }

  if (!parsedRaw) {
    throw new Error(lastError ?? "Couldn't get a usable answer from the AI. Please try again.");
  }
  const parsed = parsedRaw;
  const flags = [...parsed.flags];

  // Defense in depth -- never trust a model-returned id blindly, exactly
  // the same two-layer pattern draftScaffold.ts uses for block ids.
  function validateExercise(ex: RunningBuilderExercise): RunningBuilderExercise {
    if (!ex.exercise_id) return ex;
    if (!exercisesById.has(ex.exercise_id)) {
      flags.push(`"${ex.name}" was matched to an exercise id that isn't in the library -- treated as unmatched.`);
      return { ...ex, exercise_id: null };
    }
    return ex;
  }
  function validateStrength(ex: RunningBuilderStrengthExercise): RunningBuilderStrengthExercise {
    if (!ex.exercise_id) return ex;
    if (!exercisesById.has(ex.exercise_id)) {
      flags.push(`"${ex.name}" was matched to an exercise id that isn't in the library -- treated as unmatched.`);
      return { ...ex, exercise_id: null };
    }
    return ex;
  }

  const preRunPrep = parsed.pre_run_prep.map(validateExercise);
  const strengthSession = parsed.strength_session.map(validateStrength);
  const lockedBlocks = parsed.locked_blocks.map((b) => ({ ...b, exercises: b.exercises.map(validateStrength) }));

  let ladder = parsed.ladder;
  if (ladder.ladder_id && !laddersById.has(ladder.ladder_id)) {
    flags.push(`"${ladder.ladder_name ?? "The chosen ladder"}" isn't one of the active ladders -- left unmatched.`);
    ladder = { ...ladder, ladder_id: null, ladder_name: null };
  }
  const matchedLadder = ladder.ladder_id ? laddersById.get(ladder.ladder_id) : undefined;
  if (ladder.start_rung_number != null && matchedLadder) {
    const validRung = matchedLadder.rungs.some((r) => r.rung_number === ladder.start_rung_number);
    if (!validRung) {
      flags.push(`Rung ${ladder.start_rung_number} isn't on "${matchedLadder.name}" -- starting rung left unset.`);
      ladder = { ...ladder, start_rung_number: null };
    }
  }
  if (ladder.start_rung_number == null && !flags.some((f) => f.toLowerCase().includes("starting rung"))) {
    flags.push(
      ladder.suggested_rung_number != null
        ? `No starting rung stated in the note -- rung ${ladder.suggested_rung_number} suggested based on stated capacity, needs David's confirmation.`
        : "No starting rung stated in the note, and none could be suggested -- needs David's own choice."
    );
  }

  return {
    ...parsed,
    pre_run_prep: preRunPrep,
    strength_session: strengthSession,
    locked_blocks: lockedBlocks,
    ladder,
    flags,
  };
}
