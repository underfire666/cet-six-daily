"use client";
import { useEffect, useId, useRef } from "react";
import { AlertCircle, Loader2, Trash2, X } from "lucide-react";
import type { PrivateWrongItemView } from "@/lib/private-papers/wrong-items";

export function WrongItemRemoveDialog({ item, busy, error, onClose, onConfirm }: { item: PrivateWrongItemView | null; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), title = useId();
  useEffect(() => {
    if (!item) return;
    const dialog = ref.current, previous = document.activeElement;
    dialog?.showModal(); cancel.current?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else { const heading = document.querySelector<HTMLElement>("main h1"); if (heading) { heading.tabIndex = -1; heading.focus(); } }
    };
  }, [item]);
  if (!item) return null;
  return <dialog ref={ref} className="pp-modal pp-remove-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")), first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="pp-modal-content">
      <div className="pp-modal-header"><h3 id={title}>移出错题本</h3><button type="button" onClick={onClose} className="pp-icon-btn" aria-label="关闭"><X size={18} /></button></div>
      <div className="pp-modal-body">
        <p>确定要将这道错题移出错题本吗？</p>
        <div className="pp-modal-warning"><AlertCircle size={18} /><div><p>移出仅隐藏，不代表已掌握</p><p>以后在原私有卷的新一轮学习中再次答错，这道题会重新进入错题本。同一次提交的重试不会重新收录。</p></div></div>
        <div className="pp-modal-item-preview"><p>题目：</p><p>{item.question?.prompt}</p></div>
        {error && <p className="pp-error" role="alert">{error}</p>}
      </div>
      <div className="pp-modal-footer"><button ref={cancel} type="button" onClick={onClose} className="pp-cancel-btn">取消</button><button type="button" onClick={onConfirm} className="pp-danger-btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}确认移出</button></div>
    </div>
  </dialog>;
}
