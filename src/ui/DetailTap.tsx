import React, { useState } from 'react';

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

  return (
    <div className="relative inline-block max-w-full">
      <button
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
          className="absolute z-30 left-0 top-full mt-2 w-72 max-w-[85vw] rounded-xl border border-slate-600 bg-[#070b14] p-3 text-xs text-slate-200 shadow-2xl space-y-2"
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