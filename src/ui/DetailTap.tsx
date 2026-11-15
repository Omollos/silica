import React, { useEffect, useRef, useState } from 'react';

interface DetailTapProps {
  promptLabel: string;
  shortText?: string;
  detailText: string;
  extraNote?: string;
}

export const DetailTap: React.FC<DetailTapProps> = ({
  promptLabel,
  shortText,
  detailText,
  extraNote,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const panelWidth = Math.min(288, window.innerWidth - 32);
      const panelHeight = 180;
      const x = Math.min(Math.max(rect.left + rect.width / 2 - panelWidth / 2, 16), window.innerWidth - panelWidth - 16);
      const y = Math.min(rect.bottom + 12, window.innerHeight - panelHeight - 16);

      setPanelPosition({ x, y });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative inline-block max-w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="min-h-[32px] rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 cursor-pointer"
      >
        {promptLabel}
      </button>
      {open && (
        <div
          role="note"
          style={{
            position: 'fixed',
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            width: 'min(18rem, calc(100vw - 2rem))',
          }}
          className="z-50 rounded-xl border border-slate-600 bg-[#070b14] p-3 text-xs text-slate-200 shadow-2xl space-y-2"
        >
          {shortText && <p className="font-semibold text-white">{shortText}</p>}
          <p className="leading-relaxed">{detailText}</p>
          {extraNote && <p className="border-t border-slate-700 pt-2 text-sky-200">{extraNote}</p>}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] font-semibold text-sky-300 underline underline-offset-2 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};