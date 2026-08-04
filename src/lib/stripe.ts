import "server-only";
import Stripe from "stripe";

// Server-only, same guarantee as supabaseAdmin.ts -- the "server-only"
// package makes any accidental import of this file from a Client Component
// (or anything else that ships to the browser) fail the build outright,
// rather than silently bundling the secret key into client JS.
//
// Built lazily, on first real use, rather than a module-level `new Stripe()`
// -- Next.js evaluates route modules while collecting page data at build
// time, before any request has happened and before STRIPE_SECRET_KEY is
// necessarily set (e.g. a local build without the key), and the Stripe SDK
// validates its key eagerly at construction. A lazy singleton means a
// missing key only breaks a request that actually needed Stripe, not the
// build itself.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    cached = new Stripe(secretKey);
  }
  return cached;
}
