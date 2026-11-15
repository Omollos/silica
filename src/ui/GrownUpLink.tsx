import React, { useId, useState } from 'react';
import { KID_TEXT } from '../shared/nasa/kidText';

interface GrownUpLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Every outbound NASA/CSA link goes through this gate: a child must ask a
 * grown-up first, and the link opens in a new tab with no opener reference.
 */
export const GrownUpLink: React.FC<GrownUpLinkProps> = ({ href, children, className }) => {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim() === '15') {
      setOpen(false);
      setAnswer('');
      setWrong(false);
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    setWrong(true);
  };

  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => {
          setOpen(value => !value);
          setWrong(false);
        }}
        aria-expanded={open}
        className={className}
      >
        {children}
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 flex flex-wrap items-center gap-2 text-xs"
        >
          <label htmlFor={inputId} className="font-semibold text-slate-200">
            {KID_TEXT.grownUps.prompt}
          </label>
          <input
            id={inputId}
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="w-14 min-h-[32px] rounded-md bg-slate-900 border border-slate-600 px-2 text-white text-center tabular-nums"
          />
          <button
            type="submit"
            className="min-h-[32px] px-2.5 rounded-md bg-sky-400 text-slate-950 font-bold cursor-pointer"
          >
            {KID_TEXT.grownUps.check}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setWrong(false);
              setAnswer('');
            }}
            className="min-h-[32px] px-2 rounded-md bg-slate-800 border border-slate-600 text-slate-200 font-semibold cursor-pointer"
          >
            {KID_TEXT.grownUps.cancel}
          </button>
          {wrong && (
            <span className="text-amber-200 font-semibold">{KID_TEXT.grownUps.wrong}</span>
          )}
        </form>
      )}
    </span>
  );
};
