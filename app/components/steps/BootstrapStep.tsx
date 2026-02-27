"use client";

import ResponsePreview from "../ResponsePreview";

type Props = {
  secret: string;
  setSecret: (v: string) => void;
  loading: string | null;
  response: string;
  onRun: () => void;
};

export default function BootstrapStep({
  secret,
  setSecret,
  loading,
  response,
  onRun,
}: Props) {
  return (
    <>
      <label>
        DEMO_ADMIN_SECRET
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="e.g. 1234567890"
        />
      </label>
      <button onClick={onRun} disabled={!!loading || !secret}>
        {loading === "bootstrap" ? "Running…" : "Run bootstrap"}
      </button>
      <ResponsePreview content={response} />
    </>
  );
}
