import React from 'react';
import { isSpeechSupported, speakText, stopSpeaking } from '../audio/speak';
import { useSettingsStore } from '../store/settingsStore';

interface SpeakerButtonProps {
  text: string;
  label?: string;
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({
  text,
  label = 'Listen',
}) => {
  const enabled = useSettingsStore(state => state.readAloudEnabled);
  const speaking = useSettingsStore(state => state.speakingNow);
  const setSpeakingNow = useSettingsStore(state => state.setSpeakingNow);
  const unavailable = !isSpeechSupported();

  const handleClick = () => {
    if (speaking) {
      stopSpeaking();
      setSpeakingNow(false);
      return;
    }

    if (!enabled || unavailable) return;
    speakText(text, {
      onStart: () => setSpeakingNow(true),
      onEnd: () => setSpeakingNow(false),
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={unavailable || (!enabled && !speaking)}
      aria-pressed={speaking}
      title={unavailable ? 'Speech is not supported in this browser' : undefined}
      className="min-h-[36px] rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer whitespace-nowrap"
    >
      {speaking ? 'Stop Reading' : label}
    </button>
  );
};