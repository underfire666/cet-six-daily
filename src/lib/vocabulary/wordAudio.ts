let playback: HTMLAudioElement | undefined;
export function stopWordAudio() {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel();
    playback?.pause();
  } catch {}
}
export function speakWord(text: string, url?: string): Promise<boolean> {
  stopWordAudio();
  return new Promise((resolve) => {
    try {
      if (url) {
        playback = new Audio(url);
        playback.onended = () => resolve(true);
        playback.onerror = () => resolve(false);
        void playback.play().catch(() => resolve(false));
        return;
      }
      if (!("speechSynthesis" in window)) {
        resolve(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.82;
      utterance.voice =
        window.speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase().startsWith("en-us")) ?? null;
      const timeout = window.setTimeout(() => resolve(false), 7000);
      utterance.onend = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      utterance.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}
