import { useEffect } from 'react';

type TipDetailModalProps = {
  title: string;
  text: string;
  onClose: () => void;
};

export function TipDetailModal({ title, text, onClose }: TipDetailModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop tip-detail-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-window filter-modal tip-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tip-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-window__header tip-detail-modal__header">
          <div>
            <strong id="tip-detail-title">{title}</strong>
          </div>
          <button className="modal-window__close" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="modal-window__body tip-detail-modal__body">
          <p>{text}</p>
        </div>
      </div>
    </div>
  );
}
