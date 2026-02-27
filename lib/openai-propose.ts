import OpenAI from "openai";
import { proposeRecategorizeTool, SYSTEM_PROMPT } from "./openai-tools";

export type ProposeResult = {
  modelId: string;
  requestId: string | null;
  toolCall: { name: string; arguments: unknown } | null;
  textMessage: string | null;
};

export async function callOpenAIPropose(
  apiKey: string,
  userMessage: string,
  model?: string
): Promise<ProposeResult> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    tools: [proposeRecategorizeTool],
    tool_choice: "auto",
    parallel_tool_calls: false,
  });

  const msg = response.choices[0]?.message;
  const tc = msg?.tool_calls?.[0];
  const toolCall =
    tc?.function?.name === "propose_recategorize"
      ? {
          name: tc.function.name,
          arguments: (() => {
            try {
              return JSON.parse(tc.function.arguments ?? "{}");
            } catch {
              return {};
            }
          })(),
        }
      : null;

  return {
    modelId: response.model,
    requestId: response.id ?? null,
    toolCall,
    textMessage: msg?.content && typeof msg.content === "string" ? msg.content : null,
  };
}
