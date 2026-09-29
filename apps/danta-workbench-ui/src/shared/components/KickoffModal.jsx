import { memo, useEffect, useRef } from 'react';
import { Copy, Check } from '@phosphor-icons/react';

export const KickoffModal = memo(({
  isOpen,
  kickoffPrompt,
  copied,
  onCopy,
  onClose,
  copyButtonRef,
  dialogRef
}) => {
  const previouslyFocusedRef = useRef(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current && previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
      wasOpenRef.current = false;
      previouslyFocusedRef.current = null;
      return undefined;
    }

    if (!wasOpenRef.current) previouslyFocusedRef.current = document.activeElement;
    wasOpenRef.current = true;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled])') || [])];
    copyButtonRef.current?.focus();

    const handleDialogKeydown = event => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeydown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeydown);
    };
  }, [isOpen, onClose, copyButtonRef, dialogRef]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="kickoff-description"
      >
        <h2 id="modal-title">启动语已生成</h2>
        <p id="kickoff-description">检查内容后复制启动语，再到目标 Codex 项目的新对话中粘贴。</p>
        <p className="kickoff-connection-note">当前工作台不会自动跳转或创建 Codex 对话。</p>
        <pre className="kickoff-prompt">{kickoffPrompt}</pre>
        <div className="modal-actions">
          <button
            ref={copyButtonRef}
            className="primary-button"
            type="button"
            onClick={onCopy}
          >
            {copied ? (
              <>
                <Check size={18} aria-hidden="true" />
                已复制 · 再复制
              </>
            ) : (
              <>
                <Copy size={18} aria-hidden="true" />
                复制启动语
              </>
            )}
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  );
});

KickoffModal.displayName = 'KickoffModal';
