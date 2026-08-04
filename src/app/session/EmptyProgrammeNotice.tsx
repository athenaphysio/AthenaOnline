"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./TodaySession.module.css";
import AddToHomeScreen from "../start/AddToHomeScreen";

// Shown in the Continue zone when there's nothing active yet. Polls quietly
// in the background so a programme David builds while the client has the
// app open just appears -- no manual reload needed.
export default function EmptyProgrammeNotice() {
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
        You don&apos;t have an active programme right now. Have a look at what&apos;s available below.
      </p>
      <div style={{ marginTop: 16 }}>
        <AddToHomeScreen />
      </div>
    </div>
  );
}
