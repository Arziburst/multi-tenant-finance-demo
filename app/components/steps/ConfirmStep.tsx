"use client";

import ResponsePreview from "../ResponsePreview";

type Props = {
  token: string;
  proposalId: string;
  setProposalId: (v: string) => void;
  confirmFlag: boolean;
  setConfirmFlag: (v: boolean) => void;
  loading: string | null;
  response: string;
  onRun: () => void;
};

export default function ConfirmStep({
  token,
  proposalId,
  setProposalId,
  confirmFlag,
  setConfirmFlag,
  loading,
  response,
  onRun,
}: Props) {
  return (
    <>
      <label>
        Proposal ID (filled from propose or paste)
        <input
          type="text"
          value={proposalId}
          onChange={(e) => setProposalId(e.target.value)}
          placeholder="UUID"
        />
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={confirmFlag}
          onChange={(e) => setConfirmFlag(e.target.checked)}
        />
        confirm
      </label>
      <button
        onClick={onRun}
        disabled={!!loading || !token || !proposalId}
      >
        {loading === "confirm" ? "Running…" : "Confirm"}
      </button>
      <ResponsePreview content={response} />
    </>
  );
}
