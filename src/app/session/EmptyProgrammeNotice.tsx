"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./TodaySession.module.css";

// Shown in the Continue zone when there's nothing active yet. Polls quietly
// in the background so a programme David builds while the client has the
// app open just appears -- no manual reload needed.
export default function EmptyProgrammeNotice({ hasMoreBelow = true }: { hasMoreBelow?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("programmes").select("id").eq("patient_id", user.id).limit(1);
      if (data && data.length > 0) {
        router.refresh();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div>
      <p className={styles.emptyNotice}>
        {hasMoreBelow
          ? "You don't have an active programme right now. Have a look at what's available below."
          : "Your programme will appear here once it has been built with you, usually straight after your first assessment."}
      </p>
    </div>
  );
}
