import React from 'react';

interface SpeakerButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({
  text,
  label = 'Read Aloud',
  className = '',
}) => {
  const [speaking, setSpeaking] = React.useState(false);

  const handleClick = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    if (!window.speechSynthesis) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.02;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
        speaking
          ? 'bg-sky-500/25 border-sky-400 text-sky-100'
          : 'bg-slate-800/90 border-slate-600/80 text-slate-200 hover:bg-slate-700/90 hover:border-slate-500'
      } ${className}`}
      aria-pressed={speaking}
      aria-label={speaking ? 'Stop reading aloud' : label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4 shrink-0"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {speaking ? (
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
        ) : (
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        )}
      </svg>
      <span>{speaking ? 'Stop Reading' : label}</span>
    </button>
  );
};