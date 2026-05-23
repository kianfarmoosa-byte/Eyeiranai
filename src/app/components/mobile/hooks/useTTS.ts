import { useCallback, useEffect, useRef, useState } from "react";

type State = "idle" | "playing" | "paused";

/**
 * Wrapper over the Web Speech Synthesis API. Picks a Persian voice when
 * available; falls back to the browser default. Auto-stops on unmount.
 */
export function useTTS() {
  const [state, setState] = useState<State>("idle");
  const [rate, setRate] = useState(1);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setState("idle");
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  const pickVoice = (): SpeechSynthesisVoice | undefined => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang?.toLowerCase().startsWith("fa"))
        ?? voices.find((v) => /persian|farsi/i.test(v.name))
        ?? voices.find((v) => v.lang?.toLowerCase().startsWith("ar"))
        ?? voices[0];
  };

  const speak = useCallback((text: string) => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fa-IR";
    u.rate = rate;
    u.voice = pickVoice() ?? null;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setState("playing");
  }, [supported, rate]);

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setState("playing");
  }, [supported]);

  return { supported, state, rate, setRate, speak, pause, resume, stop };
}
