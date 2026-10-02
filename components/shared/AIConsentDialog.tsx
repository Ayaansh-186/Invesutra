"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

export default function AIConsentDialog({ open, onChoose, onClose }: {
  open: boolean;
  onChoose: (online: boolean) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="ai-privacy-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface)] p-5 text-[var(--shell-text)] shadow-xl backdrop:bg-black/40 sm:p-6">
      <ShieldCheck className="mb-3 h-6 w-6 text-emerald-600" />
      <h2 id="ai-privacy-title" className="text-lg font-semibold">Choose your analysis privacy</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--shell-text-muted)]">Local analysis does not send your financial details to external AI providers.</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--shell-text-muted)]">Allowing detailed online analysis sends your individual fund names, purchase amounts, units, purchase dates and NAVs, current values, gains or losses, portfolio summary, and this conversation to Groq, Gemini, or OpenAI.</p>
      <p className="mt-2 text-sm text-[var(--shell-text-muted)]">This choice applies to this portfolio for this visit. NAV updates work with either choice.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button autoFocus onClick={() => onChoose(false)} className="app-primary-button">Use local analysis</button>
        <button onClick={() => onChoose(true)} className="app-secondary-button">Allow detailed online analysis</button>
        <button onClick={onClose} className="py-2 text-sm text-[var(--shell-text-muted)]">Cancel</button>
      </div>
    </dialog>
  );
}
