"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// When a clinic page belongs to a client with their own brand pack, the
// page's brand bar reports that pack here, so the parts of the clinic
// drawn outside the page itself (the left sidebar) wear it too, with no
// Athena branding left on screen. Cleared again when the page goes.
export type ClinicBrand = {
  logoUrl: string | null;
  accent: string;
  canvas: string;
};

const Ctx = createContext<{ brand: ClinicBrand | null; setBrand: (b: ClinicBrand | null) => void }>({
  brand: null,
  setBrand: () => {},
});

export function ClinicBrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<ClinicBrand | null>(null);
  return <Ctx.Provider value={{ brand, setBrand }}>{children}</Ctx.Provider>;
}

export function useClinicBrand() {
  return useContext(Ctx);
}
