"use client";

import { useRef, useState } from "react";
import styles from "./TodaySession.module.css";
import { useT } from "@/i18n/client";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src, label }: { src: string | null; label: string }) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  if (!src) return null;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  }

  return (
    <div className={styles.audio}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className={styles.aplay}
        onClick={toggle}
        aria-label={playing ? t("practice.pause") : t("practice.play")}
        data-playing={playing || undefined}
      />
      <div className={styles.awave}>
        {Array.from({ length: 12 }).map((_, i) => (
          <i key={i} style={{ height: `${7 + ((i * 5) % 13)}px` }} />
        ))}
      </div>
      <div className={styles.atext}>
        {label}
        {duration !== null ? ` · ${formatDuration(duration)}` : ""}
      </div>
    </div>
  );
}
