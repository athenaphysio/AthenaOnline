// Wearable connections through ROOK are switched off until a working deal
// with ROOK is in place (Dr David Silver PhD, 11 November 2026). While this
// is false, the Me tab hides the link, the connect page sends clients back
// to the app, and the connect route refuses, so no data reaches ROOK and
// the privacy notice does not list it. Set to true to bring it back, and
// add ROOK to the supplier table in src/lib/legalDocs.ts at the same time.
export const WEARABLE_CONNECTIONS_LIVE = false;

// Display config for the wearable "Connect your wearable" screen. The
// data_source string is ROOK's own exact identifier for each provider --
// confirmed against ROOK's docs, not guessed -- and is what gets sent to
// their authorizer endpoint (src/lib/rook.ts).

export type RookProvider = {
  dataSource: string;
  name: string;
};

export const ROOK_PROVIDERS: RookProvider[] = [
  { dataSource: "Garmin", name: "Garmin" },
  { dataSource: "Whoop", name: "Whoop" },
  { dataSource: "Oura", name: "Oura" },
  { dataSource: "Polar", name: "Polar" },
];

export function getRookProvider(dataSource: string): RookProvider | undefined {
  return ROOK_PROVIDERS.find((p) => p.dataSource === dataSource);
}
