export const CLINIC_SESSION_COOKIE = "clinic_session";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The cookie never holds the password itself — just a value derived from it,
// so a copy of the cookie is useless without knowing the password that produced it.
export async function getExpectedSessionToken(): Promise<string> {
  const password = process.env.CLINIC_PASSWORD ?? "";
  return sha256Hex(`clinic-session:${password}`);
}
