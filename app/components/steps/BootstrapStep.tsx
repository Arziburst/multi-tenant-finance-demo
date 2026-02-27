"use client";

import ResponsePreview from "../ResponsePreview";

type Props = {
  loading: string | null;
  response: string;
  onRun: () => void;
};

export default function BootstrapStep({
  loading,
  response,
  onRun,
}: Props) {
  return (
    <>
      <button onClick={onRun} disabled={!!loading}>
        {loading === "bootstrap" ? "Running…" : "Run bootstrap"}
      </button>
      <ResponsePreview content={response} />
    </>
  );
}
