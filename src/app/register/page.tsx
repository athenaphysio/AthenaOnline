import type { Metadata, Viewport } from "next";
import { loginPageBrand } from "@/lib/loginBrand";
import { metadataForBrand, viewportForBrand } from "@/lib/brandMetadata";
import RegisterClient from "./RegisterClient";

export const dynamic = "force-dynamic";

// The registration form, in the brand named in the link (/join/<pack>/register)
// or the one this phone remembers, otherwise the standard Athena look. With
// then=intake (/join/<pack>/register-intake) it leads straight on to the
// Programme intake form.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = await loginPageBrand((await searchParams).brand);
  return { title: "Registration", ...metadataForBrand(brand, "Registration") };
}

export async function generateViewport({ searchParams }: Props): Promise<Viewport> {
  return viewportForBrand(await loginPageBrand((await searchParams).brand));
}

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const brand = await loginPageBrand(params.brand);
  return <RegisterClient brand={brand} thenIntake={params.then === "intake"} />;
}
