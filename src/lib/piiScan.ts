export type PiiFlag = {
  type: "name" | "date_of_birth" | "phone" | "email" | "address" | "nhs_number";
  label: string;
  match: string;
  context: string;
};

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

function context(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(text.length, index + length + 25);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function findAll(text: string, regex: RegExp, type: PiiFlag["type"], label: string): PiiFlag[] {
  const flags: PiiFlag[] = [];
  for (const m of text.matchAll(regex)) {
    if (m.index === undefined) continue;
    flags.push({
      type,
      label,
      match: m[0],
      context: context(text, m.index, m[0].length),
    });
  }
  return flags;
}

// Validates a UK NHS number using its official Modulus 11 checksum, so a random
// 10-digit sequence (like a phone number) doesn't get mistaken for one.
function isValidNhsNumber(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  let checkDigit = 11 - (sum % 11);
  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) return false;
  return checkDigit === Number(digits[9]);
}

export function scanForPii(text: string): PiiFlag[] {
  const flags: PiiFlag[] = [];

  flags.push(
    ...findAll(text, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "email", "Email address")
  );

  flags.push(
    ...findAll(
      text,
      /(?:\+44\s?\d{2,4}|\(?0\d{2,4}\)?)[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
      "phone",
      "Phone number"
    )
  );

  flags.push(
    ...findAll(
      text,
      /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g,
      "address",
      "Postcode"
    )
  );
  flags.push(
    ...findAll(
      text,
      /\b\d{1,4}\s+[A-Z][a-zA-Z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Close|Drive|Dr|Way|Court|Ct|Place|Pl)\b/g,
      "address",
      "Street address"
    )
  );

  flags.push(
    ...findAll(text, /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g, "date_of_birth", "Date")
  );
  flags.push(
    ...findAll(
      text,
      new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s+\\d{2,4}\\b`, "gi"),
      "date_of_birth",
      "Date"
    )
  );
  flags.push(
    ...findAll(text, /\b(?:DOB|date of birth)\b/gi, "date_of_birth", "Date-of-birth reference")
  );

  for (const m of text.matchAll(/\b\d[\d\s-]{8,12}\d\b/g)) {
    if (m.index === undefined) continue;
    const digits = m[0].replace(/[\s-]/g, "");
    if (isValidNhsNumber(digits)) {
      flags.push({
        type: "nhs_number",
        label: "NHS number",
        match: m[0],
        context: context(text, m.index, m[0].length),
      });
    }
  }

  flags.push(
    ...findAll(
      text,
      /\b(?:Mr|Mrs|Ms|Miss|Master)\.?\s+[A-Z][a-z]+\b/g,
      "name",
      "Possible name (title + name)"
    )
  );
  flags.push(
    ...findAll(text, /\b(?:named|called)\s+[A-Z][a-z]+\b/gi, "name", "Possible name")
  );
  flags.push(
    ...findAll(text, /\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/g, "name", "Possible full name")
  );

  return flags;
}
