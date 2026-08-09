import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import AudioPlayer from "./AudioPlayer";
import ExerciseList, { type SessionItem } from "./ExerciseList";
import MessageThread from "./MessageThread";

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
};

export default function OpenRoutine({ programmeId, patientFirstName, programme, banner }: Props) {
  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <SessionHeader
          firstName={patientFirstName}
          greeting="Hello"
          eyebrow="Your routine"
          subtitle={programme.title}
          banner={banner}
        />

        {programme.audio_url && (
          <div className={styles.messageCard}>
            <AudioPlayer src={programme.audio_url} label="A word from David" />
          </div>
        )}
        <ExerciseList items={programme.items} />

        <MessageThread programmeId={programmeId} />
      </div>
    </div>
  );
}
