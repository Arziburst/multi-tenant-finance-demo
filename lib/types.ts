export type ProposalStatus = "proposed" | "confirmed" | "executed" | "rejected";
export type ExecutionStatus = "executed" | "rejected" | "failed";

export interface ProposeRecategorizeParams {
  transaction_ids: string[];
  category_name: string;
  rationale: string;
  citations: string[];
}

export interface WebhookPlaidPayload {
  item_id: string;
  idempotency_key: string;
  transactions?: Array<{
    transaction_id: string;
    amount: number;
    iso_currency_code?: string;
    date: string;
    name: string;
  }>;
}
