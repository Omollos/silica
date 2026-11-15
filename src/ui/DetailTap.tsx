import React from 'react';

interface DetailTapProps {
  promptLabel: string;
  detailText: string;
}

export const DetailTap: React.FC<DetailTapProps> = ({ promptLabel, detailText }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer"
      >
        {promptLabel}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 right-0 w-80 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-slate-200 leading-relaxed">
              {detailText}
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};