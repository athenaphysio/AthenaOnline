import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A second, finer classification on top of a block's Type dropdown -- most
// blocks sit in "Main Body", which makes that field useless for finding a
// specific one later. This is a flat, growable, David-managed tag list
// (same shape as equipment), not a fixed enum, so a new tag he thinks of
// mid-session doesn't need a code change to become selectable.
export type BlockUsageTag = { id: string; name: string };

export async function getBlockUsageTagCatalog(): Promise<BlockUsageTag[]> {
  const { data, error } = await supabaseAdmin
    .from("block_usage_tags")
    .select("id, name")
    .order("name")
    .returns<BlockUsageTag[]>();
  if (error) throw new Error(`Block usage tag catalog query failed: ${error.message}`);
  return data ?? [];
}

// block_id -> tag_id[]
export async function getBlockUsageTagMap(): Promise<Map<string, string[]>> {
  const { data, error } = await supabaseAdmin
    .from("block_usage_tag_links")
    .select("block_id, tag_id")
    .returns<{ block_id: string; tag_id: string }[]>();
  if (error) throw new Error(`Block usage tag link query failed: ${error.message}`);

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!map.has(row.block_id)) map.set(row.block_id, []);
    map.get(row.block_id)!.push(row.tag_id);
  }
  return map;
}

export function parseUsageTagIds(body: unknown): string[] {
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.usage_tag_ids)) return [];
  return b.usage_tag_ids.filter((id): id is string => typeof id === "string");
}

// Full-replace sync, same technique as syncExerciseEquipment -- the editor
// always sends the block's complete current tag set.
export async function syncBlockUsageTags(blockId: string, tagIds: string[]): Promise<void> {
  const { error: deleteError } = await supabaseAdmin.from("block_usage_tag_links").delete().eq("block_id", blockId);
  if (deleteError) throw new Error(deleteError.message);

  if (tagIds.length === 0) return;

  const { error: insertError } = await supabaseAdmin
    .from("block_usage_tag_links")
    .insert(tagIds.map((tag_id) => ({ block_id: blockId, tag_id })));
  if (insertError) throw new Error(insertError.message);
}

// Case-insensitive find-or-create, so typing "hip hinge" from the block
// editor when "Hip Hinge" already exists reuses the same row rather than
// creating a near-duplicate.
export async function findOrCreateUsageTag(name: string): Promise<BlockUsageTag> {
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabaseAdmin
    .from("block_usage_tags")
    .select("id, name")
    .ilike("name", trimmed)
    .maybeSingle<BlockUsageTag>();
  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("block_usage_tags")
    .insert({ name: trimmed })
    .select("id, name")
    .single<BlockUsageTag>();
  if (createError) throw new Error(createError.message);
  return created;
}
