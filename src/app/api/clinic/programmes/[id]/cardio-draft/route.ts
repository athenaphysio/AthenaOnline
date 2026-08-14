import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { weeksUntilEvent } from "@/lib/cardioGoal";
import {
  planTrajectory,
  generateHalfMarathonPlan,
  generateMarathonPlan,
  generateReturnToRunningPlan,
  type DraftDay,
} from "@/lib/cardioGoalDraft";

type ProgrammeRow = {
  id: string;
  start_date: string;
  block_length_weeks: number;
  cardio_goal_category: "ongoing" | "event" | null;
  goal_target_id: string | null;
  target_event_date: string | null;
};

type BaselineRow = { discipline: string; value_number: number; value_unit: string };

// Regenerates the whole draft (Phase 4). Deletes and replaces any existing
// draft sessions for this programme rather than merging -- "Generate" is
// meant to be re-run after a baseline/timeline edit, not accumulated.
// Never writes an unsafe plan: the "insufficient" branch returns a message
// and alternatives instead, per the brief's own done-when.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: programme }, { data: baselineRows }] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select("id, start_date, block_length_weeks, cardio_goal_category, goal_target_id, target_event_date")
      .eq("id", id)
      .maybeSingle<ProgrammeRow>(),
    supabaseAdmin.from("programme_cardio_baselines").select("discipline, value_number, value_unit").eq("programme_id", id).returns<BaselineRow[]>(),
  ]);

  if (!programme) return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  if (!programme.cardio_goal_category) {
    return NextResponse.json({ error: "No cardio goal set for this programme yet." }, { status: 400 });
  }

  let goalTargetName: string | null = null;
  if (programme.goal_target_id) {
    const { data: target } = await supabaseAdmin.from("goal_targets").select("name").eq("id", programme.goal_target_id).maybeSingle<{ name: string }>();
    goalTargetName = target?.name ?? null;
  }

  const runningBaseline = (baselineRows ?? []).find((b) => b.discipline === "running") ?? null;

  let days: DraftDay[] = [];
  let insufficientMessage: string | null = null;
  let totalWeeks: number | null = null;

  if (programme.cardio_goal_category === "ongoing") {
    if (goalTargetName === "General return to running") {
      if (!runningBaseline) {
        return NextResponse.json({ error: "No running baseline captured yet -- set that before generating." }, { status: 400 });
      }
      days = generateReturnToRunningPlan(convertToMinutes(runningBaseline));
      totalWeeks = Math.max(...days.map((d) => d.weekNumber));
    } else {
      return NextResponse.json(
        { error: `"${goalTargetName ?? "this goal"}" doesn't need a generated draft -- point the patient at the existing library content directly.` },
        { status: 400 }
      );
    }
  } else {
    // Event.
    if (goalTargetName !== "Half marathon" && goalTargetName !== "Marathon") {
      return NextResponse.json(
        {
          error: `"${goalTargetName ?? "this event"}" isn't modelled yet -- Ironman 70.3/Full need a clinically sourced peak long-ride figure before they can be drafted with the same rigor as the running goals.`,
        },
        { status: 400 }
      );
    }
    if (!runningBaseline) {
      return NextResponse.json({ error: "No running baseline captured yet -- set that before generating." }, { status: 400 });
    }
    if (!programme.target_event_date) {
      return NextResponse.json({ error: "No target event date set yet." }, { status: 400 });
    }

    const weeksAvailable = weeksUntilEvent(programme.start_date, programme.target_event_date);
    if (weeksAvailable == null || weeksAvailable <= 0) {
      return NextResponse.json({ error: "Target event date isn't after the programme's start date." }, { status: 400 });
    }

    const baselineMiles = convertToMiles(runningBaseline);
    const terminalMiles = goalTargetName === "Half marathon" ? 10 : 20;
    const trajectory = planTrajectory(baselineMiles, terminalMiles, weeksAvailable);

    if (trajectory.status === "insufficient") {
      insufficientMessage = trajectory.message;
    } else {
      days = goalTargetName === "Half marathon" ? generateHalfMarathonPlan(baselineMiles, trajectory) : generateMarathonPlan(baselineMiles, trajectory);
      totalWeeks = trajectory.totalWeeks;
    }
  }

  if (insufficientMessage) {
    return NextResponse.json({ status: "insufficient", message: insufficientMessage });
  }

  try {
    const { error: deleteError } = await supabaseAdmin.from("programme_cardio_draft_sessions").delete().eq("programme_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (days.length > 0) {
      const rows = days.map((d, i) => ({
        programme_id: id,
        week_number: d.weekNumber,
        day_of_week: d.dayOfWeek,
        kind: d.kind,
        description: d.description,
        distance_value: d.distanceValue,
        distance_unit: d.distanceUnit,
        review_status: "pending" as const,
        sort_order: i,
      }));
      const { error: insertError } = await supabaseAdmin.from("programme_cardio_draft_sessions").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    if (totalWeeks && totalWeeks > programme.block_length_weeks) {
      await supabaseAdmin.from("programmes").update({ block_length_weeks: totalWeeks }).eq("id", id);
    }

    return NextResponse.json({ status: "generated", totalWeeks, sessionCount: days.length });
  } catch (err) {
    console.error("generate cardio draft failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Generate failed: ${detail}` }, { status: 500 });
  }
}

function convertToMiles(baseline: BaselineRow): number {
  if (baseline.value_unit === "miles") return baseline.value_number;
  if (baseline.value_unit === "km") return baseline.value_number * 0.621371;
  // "minutes" baseline: assume ~10 min/mile easy pace as a rough conversion,
  // clearly a draft estimate David should confirm, not a measured distance.
  return baseline.value_number / 10;
}

function convertToMinutes(baseline: BaselineRow): number {
  if (baseline.value_unit === "minutes") return baseline.value_number;
  const miles = baseline.value_unit === "km" ? baseline.value_number * 0.621371 : baseline.value_number;
  return miles * 10;
}
