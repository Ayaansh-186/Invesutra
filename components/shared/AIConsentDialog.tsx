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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface)] p-6 text-[var(--shell-text)] shadow-xl backdrop:bg-black/40">
      <ShieldCheck className="mb-3 h-6 w-6 text-emerald-600" />
      <h2 id="ai-privacy-title" className="text-lg font-semibold">Choose your analysis privacy</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--shell-text-muted)]">Local analysis keeps your financial details away from external AI providers. Online AI may send your fund holdings, quantities, purchase dates and NAVs, portfolio values, and this conversation to Groq, Gemini, or OpenAI.</p>
      <p className="mt-2 text-sm text-[var(--shell-text-muted)]">This choice applies to this portfolio for this visit. NAV updates work with either choice.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button autoFocus onClick={() => onChoose(false)} className="rounded-lg bg-[var(--shell-text)] px-4 py-3 text-sm font-medium text-[var(--shell-bg)]">Use local analysis</button>
        <button onClick={() => onChoose(true)} className="rounded-lg border border-[var(--shell-border)] px-4 py-3 text-sm font-medium">Allow online AI</button>
        <button onClick={onClose} className="py-2 text-sm text-[var(--shell-text-muted)]">Cancel</button>
      </div>
    </dialog>
  );
}
