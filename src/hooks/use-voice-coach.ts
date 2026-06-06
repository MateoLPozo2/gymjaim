import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeVoice } from "@/lib/api/voice.functions";

const STORAGE_KEY = "jims-data-gym_voice_coach";

export function useVoiceCoach() {
  const synthFn = useServerFn(synthesizeVoice);
  const [enabled, setEnabledState] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, v ? "true" : "false");
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!enabled || busyRef.current) return;
      busyRef.current = true;
      try {
        const { audio_base64, content_type } = await synthFn({ data: { text } });
        const src = `data:${content_type};base64,${audio_base64}`;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(src);
        audioRef.current = audio;
        await audio.play();
      } catch (e) {
        console.warn("[voice coach]", e);
      } finally {
        busyRef.current = false;
      }
    },
    [enabled, synthFn],
  );

  return { enabled, setEnabled, speak };
}

export { STORAGE_KEY as VOICE_COACH_STORAGE_KEY };
