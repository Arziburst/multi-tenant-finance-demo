export const SYSTEM_PROMPT = `You are a financial assistant operating over deterministic transaction data.
Rules you MUST follow:
1) Never invent transactions, IDs, amounts, or balances.
2) If you cannot answer using the provided transaction rows, say: "I don't have enough data to answer."
3) Every recommendation must cite the exact transaction UUIDs from the provided dataset.
4) To request changes, you MUST call the tool propose_recategorize with real transaction_ids only.
5) Do not call tools unless the user explicitly asked for a change.`;

export const PROPOSE_RECATEGORIZE_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    transaction_ids: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: { type: "string", description: "UUID of an existing transaction row." },
    },
    category_name: {
      type: "string",
      minLength: 1,
      maxLength: 64,
      description: "Target category label (must exist or be created via separate flow).",
    },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description: "Short reason; should cite transaction_ids in plain text.",
    },
    citations: {
      type: "array",
      minItems: 1,
      items: { type: "string", description: "Must be one of transaction_ids." },
      description: "Explicit citations list; each entry must match a transaction_id.",
    },
  },
  required: ["transaction_ids", "category_name", "rationale", "citations"],
};

export const PROPOSE_TOOL_DESCRIPTION =
  "Propose recategorizing a set of existing transactions to a given category. Must reference real transaction IDs previously provided by the system.";
