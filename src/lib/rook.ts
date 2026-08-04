import "server-only";

const ROOK_API_BASE = "https://api.rook-connect.com";

// Confirmed against ROOK's own docs: GET
// /api/v1/user_id/{user_id}/data_source/{data_source}/authorizer, Basic
// auth of client_uuid:secret_key, response includes authorization_url --
// the manufacturer's own login page to send the patient to. user_id is our
// own patient id; ROOK's docs don't document a separate "create user" call,
// so this assumes ROOK creates the user implicitly on first use -- worth
// confirming once real credentials exist, not something I could verify
// further from their public docs.
type RookAuthorizerResponse = {
  data_source: string;
  authorized: boolean;
  authorization_url: string;
};

export async function getRookAuthorizationUrl(
  patientId: string,
  dataSource: string,
  redirectUrl: string
): Promise<string> {
  const clientUuid = process.env.ROOK_CLIENT_UUID;
  const secretKey = process.env.ROOK_SECRET_KEY;
  if (!clientUuid || !secretKey) {
    throw new Error("ROOK_CLIENT_UUID/ROOK_SECRET_KEY are not configured.");
  }

  const auth = Buffer.from(`${clientUuid}:${secretKey}`).toString("base64");
  const url = `${ROOK_API_BASE}/api/v1/user_id/${encodeURIComponent(patientId)}/data_source/${encodeURIComponent(dataSource)}/authorizer?redirect_url=${encodeURIComponent(redirectUrl)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`ROOK authorizer request failed (${res.status}).`);
  }
  const data = (await res.json()) as RookAuthorizerResponse;
  if (!data.authorization_url) {
    throw new Error("ROOK did not return an authorization URL.");
  }
  return data.authorization_url;
}
