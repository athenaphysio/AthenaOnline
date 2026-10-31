"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HexMap from "@/components/HexMap";
import { PERSON_ARMS, type ArmKey, type BackgroundPart } from "@/lib/personMap";
import type { ArmCount } from "@/lib/backgroundSummary";

// The three arms of Client profile, Physiology, Psychology and Physicality,
// as the flat hexagons of the Corporate Athlete material. The open arm sits
// at the bottom; choosing another slides it down into that place. Client
// context summary, the person at the centre of it all, sits beneath.

type Props = {
  base: string;
  active: BackgroundPart;
  arms: ArmCount[];
};

export default function PersonMap({ base, active, arms }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<{ part: BackgroundPart; from: BackgroundPart } | null>(null);
  const chosen = pending && pending.from === active ? pending.part : active;
  const openArm = PERSON_ARMS.some((a) => a.key === active) ? (active as ArmKey) : null;
  const personOn = chosen === "person";

  const items = PERSON_ARMS.map((arm) => {
    const count = arms.find((a) => a.key === arm.key);
    return {
      key: arm.key,
      label: arm.label,
      line: arm.source,
      meta: count && count.count > 0 ? `${count.count} on record` : "nothing yet",
      href: `${base}?part=${arm.key}`,
      description: `${arm.source}: ${arm.detail}`,
    };
  });

  return (
    <div>
      <HexMap items={items} open={openArm} restingKey="physiology" ariaLabel="Client profile: physiology, psychology and physicality" />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <a
          href={base}
          onClick={(e) => {
            e.preventDefault();
            setPending({ part: "person", from: active });
            router.push(base, { scroll: false });
          }}
          aria-current={personOn ? "page" : undefined}
          style={{
            padding: "9px 22px",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-fraunces), serif",
            textDecoration: "none",
            border: "1.5px solid var(--hex-accent, var(--crimson))",
            background: personOn ? "var(--hex-accent, var(--crimson))" : "transparent",
            color: personOn ? "var(--hex-fill, #111)" : "var(--hex-accent, var(--crimson))",
            borderRadius: 3,
          }}
        >
          Client context summary
        </a>
      </div>
    </div>
  );
}
