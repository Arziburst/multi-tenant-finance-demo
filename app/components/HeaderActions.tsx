"use client";

type Props = {
  loading: string | null;
  resetRes: string;
  onReset: () => void;
  onCloseModal: () => void;
};

export default function HeaderActions({
  loading,
  resetRes,
  onReset,
  onCloseModal,
}: Props) {
  return (
    <div className="header-actions">
      <button
        type="button"
        className="header-actions__btn"
        onClick={onReset}
        disabled={!!loading}
      >
        {loading === "reset" ? "Running…" : "Reset DB"}
      </button>
      {resetRes && (
        <div
          className="reset-log-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-log-title"
          onClick={(e) => e.target === e.currentTarget && onCloseModal()}
        >
          <div className="reset-log-modal">
            <div className="reset-log-modal__head">
              <h2 id="reset-log-title" className="reset-log-modal__title">
                Reset result
              </h2>
              <button
                type="button"
                className="reset-log-modal__close"
                onClick={onCloseModal}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <pre className="reset-log-modal__body">{resetRes}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
