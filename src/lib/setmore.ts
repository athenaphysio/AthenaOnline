import "server-only";

// Adds a new client to Setmore as a customer, so their details are already
// there when David books them in. Uses the token Setmore emailed David when
// it approved his API access, saved in Vercel as SETMORE_REFRESH_TOKEN (a
// refresh token) or SETMORE_ACCESS_TOKEN (an access token), whichever
// Setmore gave him. Without either this does nothing, and it never stops a
// registration if Setmore is down.
const BASE = "https://developer.setmore.com/api/v1";

export function setmoreConfigured(): boolean {
  return Boolean(process.env.SETMORE_REFRESH_TOKEN || process.env.SETMORE_ACCESS_TOKEN);
}

async function accessToken(): Promise<string> {
  if (!process.env.SETMORE_REFRESH_TOKEN && process.env.SETMORE_ACCESS_TOKEN) return process.env.SETMORE_ACCESS_TOKEN;
  const res = await fetch(`${BASE}/o/oauth2/token?refreshToken=${encodeURIComponent(process.env.SETMORE_REFRESH_TOKEN ?? "")}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { token?: { access_token?: string } } };
  const token = data.data?.token?.access_token;
  if (!res.ok || !token) throw new Error(`Setmore token request failed (${res.status}).`);
  return token;
}

export type SetmoreCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  comment: string | null;
};

// Returns Setmore's key for the new customer, or null when Setmore is not
// set up yet.
export async function createSetmoreCustomer(c: SetmoreCustomer): Promise<string | null> {
  if (!setmoreConfigured()) return null;
  const token = await accessToken();
  const digits = (c.phone ?? "").replace(/[^\d+]/g, "");
  const res = await fetch(`${BASE}/bookingapi/customer/create`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      first_name: c.firstName,
      last_name: c.lastName,
      email_id: c.email,
      ...(digits ? { country_code: "GB", cell_phone: digits } : {}),
      ...(c.address ? { address: c.address } : {}),
      ...(c.city ? { city: c.city } : {}),
      ...(c.postcode ? { postal_code: c.postcode } : {}),
      ...(c.comment ? { comment: c.comment } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { customer?: { key?: string } }; msg?: string };
  if (!res.ok) throw new Error(`Setmore customer create failed (${res.status}) ${data.msg ?? ""}`.trim());
  return data.data?.customer?.key ?? "created";
}
