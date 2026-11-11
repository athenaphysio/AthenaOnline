import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// /legal on its own opens the privacy notice, keeping any brand in the link.
export default async function LegalIndex({ searchParams }: Props) {
  const brand = (await searchParams).brand;
  redirect(typeof brand === "string" ? `/legal/privacy?brand=${encodeURIComponent(brand)}` : "/legal/privacy");
}
