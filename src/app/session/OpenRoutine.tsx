import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import AudioPlayer from "./AudioPlayer";
import ExerciseList, { type SessionItem } from "./ExerciseList";
import VoiceNoteButton from "./VoiceNoteButton";
import MessageThread from "./MessageThread";
import { brandScopeStyle, paletteAttr } from "./brandScopeStyle";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import type { BackTarget } from "./BackLink";

type Programme = {
  title: string;
  audio_url: string | null;
  items: SessionItem[];
};

type Props = {
  programmeId: string;
  patientFirstName: string;
  programme: Programme;
  banner?: ReactNode;
  brand?: ResolvedBrandPack;
  back?: BackTarget;
};

export default function OpenRoutine({ programmeId, patientFirstName, programme, banner, brand, back }: Props) {
  return (
    <div className={styles.app} style={brandScopeStyle(brand)} {...paletteAttr(brand)}>
      <div className={styles.inner}>
        <SessionHeader
          brand={brand}
          firstName={patientFirstName}
          greeting="Hello"
          eyebrow="Your routine"
          subtitle={programme.title}
          banner={banner}
          back={back}
        />

        {programme.audio_url && (
          <div className={styles.messageCard}>
            <AudioPlayer src={programme.audio_url} label="A word from David" />
          </div>
        )}
        <ExerciseList items={programme.items} />

        <div style={{ padding: "0 22px" }}>
          <VoiceNoteButton programmeId={programmeId} contextTitle={programme.title} />
        </div>

        <MessageThread programmeId={programmeId} />
      </div>
    </div>
  );
}
