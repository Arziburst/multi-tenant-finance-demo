"use client";

import ResponsePreview from "../ResponsePreview";

type Props = {
  token: string;
  question: string;
  setQuestion: (v: string) => void;
  provider: "openai" | "claude";
  setProvider: (v: "openai" | "claude") => void;
  loading: string | null;
  response: string;
  onRun: () => void;
  categories?: string[];
};

export default function ProposeStep({
  token,
  question,
  setQuestion,
  provider,
  setProvider,
  loading,
  response,
  onRun,
  categories = [],
}: Props) {
  return (
    <>
      <label className="row">
        Provider
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "openai" | "claude")}
          className="select"
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      {categories.length > 0 && (
        <p className="categories-hint">
          Available categories: {categories.join(", ")}
        </p>
      )}
      <label>
        Question
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <button onClick={onRun} disabled={!!loading || !token}>
        {loading === "propose" ? "Running…" : "Propose"}
      </button>
      <ResponsePreview content={response} />
    </>
  );
}
