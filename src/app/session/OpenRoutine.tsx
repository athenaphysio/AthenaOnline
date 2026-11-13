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
import { translator } from "@/i18n/translate";
import type { Lang } from "@/i18n/languages";

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
  /** Show the "Message David" line under the routine. */
  showMessages?: boolean;
  lang?: Lang;
};

export default function OpenRoutine({ programmeId, patientFirstName, programme, banner, brand, back, showMessages = false, lang = "en" }: Props) {
  const { t } = translator(lang);
  return (
    <div className={styles.app} style={brandScopeStyle(brand)} {...paletteAttr(brand)}>
      <div className={styles.inner}>
        <SessionHeader
          brand={brand}
          firstName={patientFirstName}
          greeting={t("practice.greetingHello")}
          eyebrow={t("practice.yourRoutine")}
          subtitle={programme.title}
          banner={banner}
          back={back}
        />

        {programme.audio_url && (
          <div className={styles.messageCard}>
            <AudioPlayer src={programme.audio_url} label={t("practice.wordFromDavid")} />
          </div>
        )}
        <ExerciseList items={programme.items} />

        <div style={{ padding: "0 22px" }}>
          <VoiceNoteButton programmeId={programmeId} contextTitle={programme.title} />
        </div>

        {showMessages && <MessageThread programmeId={programmeId} />}
      </div>
    </div>
  );
}
