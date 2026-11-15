import React from 'react';

interface ScienceLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

export const ScienceLibraryModal: React.FC<ScienceLibraryModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">
            Science Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-slate-300">
            This is where NASA and CSA educational content will be displayed.
          </p>
          <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-4">
            <h3 className="font-bold text-sky-300 mb-2">Coming Soon</h3>
            <p className="text-sm text-slate-400">
              Interactive science facts, real NASA data visualizations, and educational content will be available here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};