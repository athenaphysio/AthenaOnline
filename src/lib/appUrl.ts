// The app's own web address, used in emails, payment pages and link
// previews. The app also still answers on its original Vercel address, so
// links sent before the move keep working. Set APP_URL in Vercel only to
// point everything somewhere else for a while.
export const APP_URL = (process.env.APP_URL || "https://app.drdavidsilverphd.com").replace(/\/+$/, "");
