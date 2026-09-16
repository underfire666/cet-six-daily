import type { FeedbackSettings } from "@/types/session";
let audio: AudioContext | undefined;
export function playFeedback(correct: boolean, settings: FeedbackSettings) {
  if (settings.hapticsEnabled) {
    try {
      navigator.vibrate?.(correct ? 20 : [15, 30, 15]);
    } catch {
      /* Optional on mobile devices. */
    }
  }
  if (!settings.soundEnabled) return;
  try {
    if (!window.AudioContext) return;
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.setValueAtTime(correct ? 660 : 240, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      correct ? 880 : 180,
      audio.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.17);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Audio permissions never block an answer. */
  }
}
