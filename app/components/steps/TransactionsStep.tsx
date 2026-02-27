"use client";

import ResponsePreview from "../ResponsePreview";

type Props = {
  token: string;
  setToken: (v: string) => void;
  loading: string | null;
  response: string;
  onRun: () => void;
};

export default function TransactionsStep({
  token,
  setToken,
  loading,
  response,
  onRun,
}: Props) {
  return (
    <>
      <label>
        Token (filled from bootstrap or paste)
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
        />
      </label>
      <button onClick={onRun} disabled={!!loading || !token}>
        {loading === "transactions" ? "Running…" : "Get transactions"}
      </button>
      <ResponsePreview content={response} />
    </>
  );
}
