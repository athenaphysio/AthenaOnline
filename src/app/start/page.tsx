import type { Metadata, Viewport } from "next";
import { loginPageBrand } from "@/lib/loginBrand";
import { metadataForBrand, viewportForBrand } from "@/lib/brandMetadata";
import StartClient from "./StartClient";

// The login page, in the brand this phone belongs to when it is known (see
// src/lib/loginBrand.ts), so a branded client sees their own brand and saves
// its icon to their home screen. Otherwise the standard Athena login.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = await loginPageBrand((await searchParams).brand);
  return metadataForBrand(brand, "Log in", true);
}

export async function generateViewport({ searchParams }: Props): Promise<Viewport> {
  const brand = await loginPageBrand((await searchParams).brand);
  return viewportForBrand(brand);
}

export default async function Page({ searchParams }: Props) {
  const brand = await loginPageBrand((await searchParams).brand);
  return <StartClient brand={brand} />;
}
