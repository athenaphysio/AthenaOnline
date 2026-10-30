import type { Metadata, Viewport } from "next";
import { loginPageBrand } from "@/lib/loginBrand";
import { metadataForBrand, viewportForBrand } from "@/lib/brandMetadata";
import SetPasswordClient from "./SetPasswordClient";

// Where the welcome email lands, in the client's brand when the link names
// it (invite emails do for a client on a brand pack), so their first sight
// of the app is their own brand.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = await loginPageBrand((await searchParams).brand);
  return metadataForBrand(brand, "Set your password", true);
}

export async function generateViewport({ searchParams }: Props): Promise<Viewport> {
  const brand = await loginPageBrand((await searchParams).brand);
  return viewportForBrand(brand);
}

export default async function Page({ searchParams }: Props) {
  const brand = await loginPageBrand((await searchParams).brand);
  return <SetPasswordClient brand={brand} />;
}
