import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { previewTrainingCsv, saveTrainingCsv, testRow, deleteTrainingScreenshot, type TestInput } from "@/lib/trainingData";
import { syncConcept2, twelveWeeksAgo } from "@/lib/rowing/concept2";
import { performanceType, readResult } from "@/lib/performanceTypes";

// One place for every change to a client's training data, tests and goals.
// The client's own route passes who = "client" with their own id from their
// login; Dr David Silver PhD's client page passes who = "clinician". A
// client can only change entries on their own record, and only the ones
// they added; goals are his alone.

export type TrainingAction = { action?: string; [key: string]: unknown };
type Reply = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = {}): Reply => ({ status: 200, body: { ok: true, ...body } });
const bad = (error: string, status = 400): Reply => ({ status, body: { error } });

export async function runTrainingAction(patientId: string, who: "client" | "clinician", input: TrainingAction): Promise<Reply> {
  switch (input.action) {
    case "csv_preview": {
      const out = await previewTrainingCsv(patientId, String(input.csv ?? ""));
      if (out.error) return bad(out.error);
      return ok({ rows: out.rows, skipped: out.skipped });
    }
    case "csv_save": {
      const out = await saveTrainingCsv(patientId, String(input.csv ?? ""));
      if (out.error) return bad(out.error);
      return ok({ added: out.added, alreadyHere: out.alreadyHere });
    }
    case "delete_session": {
      // Clients can remove sessions they uploaded; David can remove any
      // that didn't come from a sync (a synced one would only come back).
      const sources = who === "client" ? ["upload"] : ["upload", "manual"];
      const { error } = await supabaseAdmin
        .from("rowing_results")
        .delete()
        .eq("id", String(input.id ?? ""))
        .eq("patient_id", patientId)
        .in("source", sources);
      return error ? bad("That session couldn't be removed.") : ok();
    }
    case "add_test": {
      const made = testRow(patientId, input as TestInput, who);
      if (made.error !== null) return bad(made.error);
      const { data, error } = await supabaseAdmin.from("performance_tests").insert(made.row).select("id").single<{ id: string }>();
      return error ? bad("That result couldn't be saved. Please try again.") : ok({ id: data.id });
    }
    case "edit_test": {
      if (who !== "clinician") return bad("Only Dr David Silver PhD can change a saved result.", 403);
      const made = testRow(patientId, input as TestInput, "clinician");
      if (made.error !== null) return bad(made.error);
      const { added_by: _keep, ...changes } = made.row;
      void _keep;
      const { error } = await supabaseAdmin.from("performance_tests").update(changes).eq("id", String(input.id ?? "")).eq("patient_id", patientId);
      return error ? bad("That result couldn't be saved.") : ok();
    }
    case "delete_test": {
      let q = supabaseAdmin.from("performance_tests").delete().eq("id", String(input.id ?? "")).eq("patient_id", patientId);
      if (who === "client") q = q.eq("added_by", "client");
      const { error } = await q;
      return error ? bad("That result couldn't be removed.") : ok();
    }
    case "delete_screenshot": {
      if (who !== "clinician") {
        const { data } = await supabaseAdmin.from("training_screenshots").select("id").eq("id", String(input.id ?? "")).eq("patient_id", patientId).maybeSingle();
        if (!data) return bad("That picture couldn't be found.", 404);
      }
      await deleteTrainingScreenshot(patientId, String(input.id ?? ""));
      return ok();
    }
    case "screenshots_seen": {
      if (who !== "clinician") return bad("Not available.", 403);
      await supabaseAdmin.from("training_screenshots").update({ seen_at: new Date().toISOString() }).eq("patient_id", patientId).is("seen_at", null);
      return ok();
    }
    case "sync_concept2": {
      if (who !== "clinician") return bad("Not available.", 403);
      const out = await syncConcept2(patientId, twelveWeeksAgo());
      if (!out.connected) return bad("This client hasn't linked their Concept2 Logbook yet, or Concept2 isn't set up in the app's settings.");
      if (out.error) return bad(`Concept2 didn't answer properly: ${out.error}`);
      return ok({ added: out.added });
    }
    case "save_goal": {
      if (who !== "clinician") return bad("Goals are set by Dr David Silver PhD.", 403);
      const type = performanceType(String(input.goal_type ?? ""));
      if (!type) return bad("Choose the kind of goal.");
      const target = String(input.target_text ?? "").trim();
      if (!target) return bad("Add the target.");
      const distance = Number(input.distance_m) > 0 ? Math.round(Number(input.distance_m)) : type.distanceM ? Math.round(type.distanceM) : null;
      if (type.value === "long_row" && !distance) return bad("Add the distance of the row, in metres.");
      const read = readResult(type, target, distance);
      if (read.error) return bad(read.error);
      const goalDate = String(input.goal_date ?? "").trim();
      if (goalDate && !/^\d{4}-\d{2}-\d{2}$/.test(goalDate)) return bad("Choose the date from the calendar.");
      const row = {
        patient_id: patientId,
        goal_type: type.value,
        target_text: target,
        target_seconds: read.seconds,
        target_watts: read.watts,
        distance_m: distance,
        goal_date: goalDate || null,
        event_name: String(input.event_name ?? "").trim().slice(0, 200) || null,
        updated_at: new Date().toISOString(),
      };
      const id = String(input.id ?? "");
      const { error } = id
        ? await supabaseAdmin.from("client_goals").update(row).eq("id", id).eq("patient_id", patientId)
        : await supabaseAdmin.from("client_goals").insert(row);
      return error ? bad("That goal couldn't be saved.") : ok();
    }
    case "delete_goal": {
      if (who !== "clinician") return bad("Goals are set by Dr David Silver PhD.", 403);
      const { error } = await supabaseAdmin.from("client_goals").delete().eq("id", String(input.id ?? "")).eq("patient_id", patientId);
      return error ? bad("That goal couldn't be removed.") : ok();
    }
    default:
      return bad("Unknown request.");
  }
}
