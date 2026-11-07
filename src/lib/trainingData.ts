import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readTrainingCsv, sameSession, type CsvSession } from "@/lib/trainingCsv";
import { performanceType, readResult } from "@/lib/performanceTypes";

// Training data that doesn't sync by itself: a CSV export, a single test or
// race, or a screenshot. Used by the client's own pages and by Dr David
// Silver PhD's client page, which check who is asking before calling these.

const MAX_CSV_ROWS = 2000;

export type CsvPreviewRow = CsvSession & { duplicate: boolean };

/** Reads a CSV and marks which sessions are already stored for this client. */
export async function previewTrainingCsv(patientId: string, text: string): Promise<{ rows: CsvPreviewRow[]; skipped: number; error: string | null }> {
  const read = readTrainingCsv(text);
  if (read.error) return { rows: [], skipped: read.skipped, error: read.error };
  if (read.sessions.length > MAX_CSV_ROWS) {
    return { rows: [], skipped: 0, error: `That file has ${read.sessions.length} sessions. Please export a shorter date range, up to ${MAX_CSV_ROWS} at a time.` };
  }

  const dates = read.sessions.map((s) => s.date).sort();
  const { data: stored } = await supabaseAdmin
    .from("rowing_results")
    .select("c2_result_id, rowed_on, distance_m, time_tenths")
    .eq("patient_id", patientId)
    .gte("rowed_on", dates[0])
    .lte("rowed_on", dates[dates.length - 1])
    .returns<{ c2_result_id: number | null; rowed_on: string; distance_m: number; time_tenths: number }[]>();
  const have = (stored ?? []).map((r) => ({ c2: r.c2_result_id, date: r.rowed_on, distanceM: r.distance_m, timeTenths: r.time_tenths }));

  const seen: CsvSession[] = [];
  const rows = read.sessions.map((s) => {
    const duplicate =
      have.some((h) => (s.c2LogId !== null && h.c2 === s.c2LogId) || sameSession(s, h)) || seen.some((x) => sameSession(s, x));
    seen.push(s);
    return { ...s, duplicate };
  });
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { rows, skipped: read.skipped, error: null };
}

/** Saves the sessions in a CSV that aren't already stored. */
export async function saveTrainingCsv(patientId: string, text: string): Promise<{ added: number; alreadyHere: number; error: string | null }> {
  const preview = await previewTrainingCsv(patientId, text);
  if (preview.error) return { added: 0, alreadyHere: 0, error: preview.error };
  const fresh = preview.rows.filter((r) => !r.duplicate);
  if (fresh.length > 0) {
    const { error } = await supabaseAdmin.from("rowing_results").insert(
      fresh.map((s) => ({
        patient_id: patientId,
        // Concept2's Log ID is kept, so if the client links their logbook
        // later the synced copy replaces this one rather than doubling it.
        c2_result_id: s.c2LogId,
        source: "upload",
        sport: s.sport,
        rowed_on: s.date,
        distance_m: s.distanceM,
        time_tenths: s.timeTenths,
        avg_split_seconds: Math.round(((s.timeTenths / 10) * (s.sport === "run" || s.sport === "bike" ? 1000 : 500) / s.distanceM) * 100) / 100,
        stroke_rate: s.strokeRate,
        avg_hr: s.avgHr,
        workout_type: s.workoutType,
        avg_watts: s.avgWatts,
        drag_factor: s.dragFactor,
        calories: s.calories,
        note: s.note,
      }))
    );
    if (error) return { added: 0, alreadyHere: 0, error: "Those sessions couldn't be saved. Please try again." };
  }
  return { added: fresh.length, alreadyHere: preview.rows.length - fresh.length, error: null };
}

export type TestInput = {
  tested_on?: string;
  test_type?: string;
  result_text?: string;
  distance_m?: number | string | null;
  split_text?: string | null;
  stroke_rate?: number | string | null;
  drag_factor?: number | string | null;
  is_race?: boolean;
  notes?: string | null;
  rowing_result_id?: string | null;
};

function smallNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Checks a test or race typed in, and turns it into the row to store. */
export function testRow(patientId: string, input: TestInput, addedBy: "client" | "clinician") {
  const type = performanceType(input.test_type);
  if (!type) return { error: "Choose what kind of test or race this was." } as const;
  if (!input.tested_on || !/^\d{4}-\d{2}-\d{2}$/.test(input.tested_on)) return { error: "Add the date of the test." } as const;
  const resultText = (input.result_text ?? "").trim();
  if (!resultText) return { error: "Add the result." } as const;
  const distance = smallNumber(input.distance_m) ?? (type.distanceM ? Math.round(type.distanceM) : null);
  const read = readResult(type, resultText, distance);
  if (read.error) return { error: read.error } as const;

  let split: number | null = null;
  if (input.split_text && input.split_text.trim()) {
    const t = input.split_text.trim().replace(/\/.*$/, "");
    const parts = t.split(":").map(Number);
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) split = parts[0] * 60 + parts[1];
  } else if (type.family === "row" && read.seconds && distance) {
    split = Math.round(((read.seconds * 500) / distance) * 100) / 100;
  }

  return {
    error: null,
    row: {
      patient_id: patientId,
      tested_on: input.tested_on,
      test_type: type.value,
      result_text: resultText,
      result_seconds: read.seconds,
      result_watts: read.watts,
      distance_m: distance,
      avg_split_seconds: split,
      stroke_rate: smallNumber(input.stroke_rate),
      drag_factor: smallNumber(input.drag_factor),
      is_race: input.is_race === true,
      notes: input.notes?.trim().slice(0, 1000) || null,
      added_by: addedBy,
      rowing_result_id: input.rowing_result_id || null,
    },
  } as const;
}

const SCREENSHOT_BUCKET = "training-screenshots";
const SCREENSHOT_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "image/heif": "heic" };

/** Stores a screenshot for Dr David Silver PhD to read. Nothing is read from it here. */
export async function saveTrainingScreenshot(patientId: string, file: File, note: string | null): Promise<string | null> {
  const ext = SCREENSHOT_TYPES[file.type];
  if (!ext) return "Please choose a picture, such as a PNG or JPEG screenshot.";
  if (file.size > 10 * 1024 * 1024) return "That picture is larger than 10MB. A screenshot is usually much smaller.";
  const id = randomUUID();
  const path = `${patientId}/${id}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (error) return "That picture couldn't be saved. Please try again.";
  const { error: rowError } = await supabaseAdmin.from("training_screenshots").insert({ id, patient_id: patientId, storage_path: path, note });
  if (rowError) {
    await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).remove([path]);
    return "That picture couldn't be saved. Please try again.";
  }
  return null;
}

export async function screenshotUrl(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function deleteTrainingScreenshot(patientId: string, id: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("training_screenshots")
    .select("storage_path")
    .eq("id", id)
    .eq("patient_id", patientId)
    .maybeSingle<{ storage_path: string }>();
  if (!data) return;
  await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).remove([data.storage_path]);
  await supabaseAdmin.from("training_screenshots").delete().eq("id", id).eq("patient_id", patientId);
}
