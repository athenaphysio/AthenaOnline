const GBP_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

// Whole pounds only -- programme pricing here is a round number set by
// David, never pence-level precision.
export function formatPriceGBP(pounds: number): string {
  return GBP_FORMATTER.format(pounds);
}

const GBP_FORMATTER_PRECISE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// For prices that do carry pence, like membership tiers (£5.99, £24.99) --
// shows the pence when present, drops them for a whole number like £270,
// rather than always forcing two decimal places.
export function formatPriceGBPPrecise(pounds: number): string {
  return GBP_FORMATTER_PRECISE.format(pounds);
}
