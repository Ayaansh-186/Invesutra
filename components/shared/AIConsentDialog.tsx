"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function AIConsentDialog({ open, onChoose, onClose, canRemember = false }: {
  open: boolean;
  onChoose: (online: boolean, remember: boolean) => void;
  onClose: () => void;
  canRemember?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    if (open) setRemember(false);
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
      <p className="mt-2 text-sm text-[var(--shell-text-muted)]">Online analysis is recommended for more flexible explanations and follow-up questions. Local analysis keeps financial details on the local analysis path. NAV updates work with either choice.</p>
      {canRemember && <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>Remember my choice for future queries<span className="mt-1 block text-xs text-[var(--shell-text-muted)]">Saved on this device for this account and portfolio. Change it anytime using the privacy control.</span></span></label>}
      <div className="mt-5 flex flex-col gap-2">
        <button autoFocus onClick={() => onChoose(false, remember)} className="app-secondary-button">Use local analysis</button>
        <button onClick={() => onChoose(true, remember)} className="app-primary-button whitespace-normal">Allow detailed online analysis (Recommended)</button>
        <button onClick={onClose} className="py-2 text-sm text-[var(--shell-text-muted)]">Cancel</button>
      </div>
    </dialog>
  );
}
