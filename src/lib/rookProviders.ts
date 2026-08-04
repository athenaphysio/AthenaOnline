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
