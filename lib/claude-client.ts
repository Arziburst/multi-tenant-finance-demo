const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export type ClaudeToolUse = {
  name: string;
  input: unknown;
};

export type ClaudeProposeResult = {
  modelId: string;
  requestId: string;
  toolCall: { name: string; arguments: unknown } | null;
  textMessage: string | null;
};

const proposeRecategorizeTool = {
  name: "propose_recategorize",
  description: "Propose recategorizing a set of existing transactions to a given category. Must reference real transaction IDs previously provided by the system.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      transaction_ids: {
        type: "array",
        items: { type: "string" },
        description: "UUID of an existing transaction row.",
      },
      category_name: { type: "string", description: "Target category label." },
      rationale: { type: "string", description: "Short reason." },
      citations: {
        type: "array",
        items: { type: "string" },
        description: "Must be one of transaction_ids.",
      },
    },
    required: ["transaction_ids", "category_name", "rationale", "citations"],
  },
};

export async function callClaudePropose(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  model?: string
): Promise<ClaudeProposeResult> {
  const body = {
    model: model ?? process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user" as const, content: userMessage }],
    tools: [proposeRecategorizeTool],
  };

  const r = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Claude API ${r.status}: ${err}`);
  }

  const data = (await r.json()) as {
    id: string;
    model: string;
    content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
    stop_reason: string;
  };

  let toolCall: { name: string; arguments: unknown } | null = null;
  let textMessage: string | null = null;

  for (const block of data.content) {
    if (block.type === "tool_use" && block.name === "propose_recategorize" && block.input != null) {
      toolCall = { name: block.name, arguments: block.input };
      break;
    }
    if (block.type === "text" && typeof block.text === "string") {
      textMessage = block.text;
    }
  }

  return {
    modelId: data.model,
    requestId: data.id,
    toolCall,
    textMessage,
  };
}
