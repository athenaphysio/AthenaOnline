import "server-only";

// Creates a customer in Setmore so David can book a newly confirmed client
// straight into his diary without retyping their details. Setmore issues a
// long-lived refresh token (requested from api@setmore.com), which is swapped
// here for a short-lived access token on each call.
//
// Needs SETMORE_REFRESH_TOKEN set in Vercel. If it is missing, this quietly
// does nothing, so confirming a registration never breaks because of Setmore.

const SETMORE_BASE = "https://developer.setmore.com/api/v1";

export type SetmoreCustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
};

export type SetmoreResult =
  | { status: "created"; customerKey: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(
    `${SETMORE_BASE}/o/oauth2/token?refreshToken=${encodeURIComponent(refreshToken)}`,
    { method: "GET", cache: "no-store" }
  );
  const data = await res.json().catch(() => null);
  const token = data?.data?.token?.access_token;
  if (!res.ok || !token) {
    throw new Error(data?.msg || `Setmore sign-in failed (${res.status}).`);
  }
  return token as string;
}

export async function createSetmoreCustomer(input: SetmoreCustomerInput): Promise<SetmoreResult> {
  const refreshToken = process.env.SETMORE_REFRESH_TOKEN;
  if (!refreshToken) {
    return { status: "skipped", reason: "Setmore is not connected yet." };
  }

  try {
    const accessToken = await getAccessToken(refreshToken);
    const res = await fetch(`${SETMORE_BASE}/bookingapi/customer/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        first_name: input.firstName,
        last_name: input.lastName,
        email_id: input.email,
        country_code: "GB",
        cell_phone: input.mobilePhone ?? "",
        address: input.address ?? "",
        city: input.city ?? "",
        postal_code: input.postcode ?? "",
        comment: "Added automatically from Athena Online registration.",
      }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.response === false) {
      return { status: "failed", reason: data?.msg || `Setmore returned ${res.status}.` };
    }
    return { status: "created", customerKey: data?.data?.customer?.key ?? null };
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : "Setmore could not be reached." };
  }
}
