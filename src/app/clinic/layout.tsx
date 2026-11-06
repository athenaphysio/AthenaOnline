import type { ReactNode } from "react";
import { DirtyStateProvider } from "./DirtyStateContext";
import { FavouritesProvider } from "./FavouritesContext";
import ClinicShell from "./ClinicShell";

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <DirtyStateProvider>
      <FavouritesProvider>
        <ClinicShell>{children}</ClinicShell>
      </FavouritesProvider>
    </DirtyStateProvider>
  );
}
