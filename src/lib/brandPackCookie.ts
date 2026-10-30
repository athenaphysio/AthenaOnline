// The brand a phone belongs to, remembered between visits. It is set when a
// client opens their brand's join link or invite email, and whenever they
// open their app, so the login page can show their brand even before they
// log in (it cannot otherwise know who they are). It holds only a brand
// pack's id, nothing about the client. Safe for browser and server.
export const BRAND_PACK_COOKIE = "athena_brand_pack";
export const BRAND_PACK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
