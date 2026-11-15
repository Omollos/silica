/**
 * Web Speech API wrapper for kid-friendly read-aloud support.
 * Gracefully degrades in browsers/environments without speechSynthesis.
 */

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech synthesis cancellation errors
  }
}

export function speakText(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    rate?: number;
  }
): boolean {
  if (!isSpeechSupported() || !text.trim()) {
    options?.onEnd?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 0.95;
    utterance.pitch = 1.02;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        v =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha'))
      ) ?? voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => options?.onStart?.();
    utterance.onend = () => options?.onEnd?.();
    utterance.onerror = () => options?.onEnd?.();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options?.onEnd?.();
    return false;
  }
}