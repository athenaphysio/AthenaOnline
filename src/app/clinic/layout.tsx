import type { ReactNode } from "react";
import { DirtyStateProvider } from "./DirtyStateContext";

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return <DirtyStateProvider>{children}</DirtyStateProvider>;
}
