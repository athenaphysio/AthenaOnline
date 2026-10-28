import { NextResponse } from "next/server";
import { passportTemplateCsv } from "@/lib/passport";

// The blank upload template, with two example rows to copy the shape of.
export async function GET() {
  return new NextResponse(passportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="human-passport-upload-template.csv"',
    },
  });
}
