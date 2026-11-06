import type { Metadata, Viewport } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loginPageBrand } from "@/lib/loginBrand";
import { metadataForBrand, viewportForBrand } from "@/lib/brandMetadata";
import { findBuilderForm } from "@/lib/sendForm";
import PageBanner from "@/components/PageBanner";
import BrandLinkHeader from "@/components/BrandLinkHeader";
import styles from "../session/TodaySession.module.css";
import { brandScopeStyle, paletteAttr } from "../session/brandScopeStyle";
import type { FormQuestion } from "../forms/[sendId]/FormAnswerClient";
import IntakeLinkClient from "./IntakeLinkClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// The Programme intake form from a link, with no login needed: sent on its
// own to a client who has already registered (/join/<pack>/intake), or
// reached straight after the registration form (/join/<pack>/register-intake).
// It wears the pack named in the link, or the one this phone remembers.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = await loginPageBrand((await searchParams).brand);
  return { title: "Programme intake", ...metadataForBrand(brand, "Programme intake") };
}

export async function generateViewport({ searchParams }: Props): Promise<Viewport> {
  return viewportForBrand(await loginPageBrand((await searchParams).brand));
}

export default async function IntakePage({ searchParams }: Props) {
  const params = await searchParams;
  const brand = await loginPageBrand(params.brand);
  const form = await findBuilderForm("intake");
  const { data: questions } = form
    ? await supabaseAdmin
        .from("form_questions")
        .select("id, question_order, type, prompt, options, required")
        .eq("form_id", form.id)
        .order("question_order")
        .returns<FormQuestion[]>()
    : { data: [] as FormQuestion[] };

  return (
    <div className={styles.app} style={brandScopeStyle(brand ?? undefined)} {...paletteAttr(brand)}>
      {brand ? <BrandLinkHeader brand={brand} pageIsDark={Boolean(brand.app_layout.palette)} /> : <PageBanner />}
      <div className={styles.inner}>
        {questions && questions.length > 0 ? (
          <IntakeLinkClient
            questions={questions}
            brandId={brand?.id ?? null}
            afterRegistration={one(params.after) === "register"}
            initial={{ firstName: one(params.first_name), lastName: one(params.last_name), email: one(params.email) }}
          />
        ) : (
          <div className={styles.head}>
            <h1>Programme intake</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--stone)" }}>
              This form is not available at the moment. Please get in touch with Dr David Silver PhD directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
