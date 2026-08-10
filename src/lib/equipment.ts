// Pure type only -- no supabaseAdmin import, so Client Components can use
// this freely. The data fetch lives in equipmentServer.ts.
export type Equipment = { id: string; name: string; icon_url: string | null };
