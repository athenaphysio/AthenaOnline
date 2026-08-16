import type { ReactNode } from "react";
import { DirtyStateProvider } from "./DirtyStateContext";
import ClinicShell from "./ClinicShell";

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <DirtyStateProvider>
      <ClinicShell>{children}</ClinicShell>
    </DirtyStateProvider>
  );
}
