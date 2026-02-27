import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase";
import { getUserToken } from "@/lib/auth";
import { SYSTEM_PROMPT } from "@/lib/ai-tools";
import { callOpenAIPropose } from "@/lib/openai-propose";
import { callClaudePropose } from "@/lib/claude-client";
import { proposeRecategorizeSchema, validateCitations } from "@/lib/validation";

function getProvider(body: { provider?: string }): "openai" | "claude" {
  const p = (body.provider ?? process.env.AI_PROVIDER ?? "").toLowerCase();
  if (p === "claude" || p === "anthropic") return "claude";
  return "openai";
}

export async function POST(req: NextRequest) {
  try {
    const token = getUserToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createUserClient(token);

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_tenant_id")
      .single();

    if (!profile?.current_tenant_id) {
      return NextResponse.json(
        { error: "No profile or tenant" },
        { status: 403 }
      );
    }

    let body: { question?: string; provider?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const question =
      typeof body.question === "string"
        ? body.question
        : "List my recent transactions.";

    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, name, amount, posted_date, category_id")
      .order("posted_date", { ascending: false })
      .limit(100);

    const txRows = transactions ?? [];
    const txIds = new Set(txRows.map((r) => r.id));

    const userMessage =
      "Available transactions (use only these IDs): " +
      JSON.stringify(
        txRows.map((t) => ({
          id: t.id,
          name: t.name,
          amount: t.amount,
          posted_date: t.posted_date,
        }))
      ) +
      ". User question: " +
      question;

    const provider = getProvider(body);
    let modelId: string;
    let requestId: string | null;
    let toolCall: { name: string; arguments: unknown } | null;
    let textMessage: string | null;

    if (provider === "claude") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "Claude selected but ANTHROPIC_API_KEY is not set" },
          { status: 400 }
        );
      }
      const result = await callClaudePropose(key, SYSTEM_PROMPT, userMessage);
      modelId = result.modelId;
      requestId = result.requestId;
      toolCall = result.toolCall;
      textMessage = result.textMessage;
    } else {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "OpenAI selected but OPENAI_API_KEY is not set" },
          { status: 400 }
        );
      }
      const result = await callOpenAIPropose(key, userMessage);
      modelId = result.modelId;
      requestId = result.requestId;
      toolCall = result.toolCall;
      textMessage = result.textMessage;
    }

    if (!toolCall || toolCall.name !== "propose_recategorize") {
      return NextResponse.json({
        proposal: null,
        message: textMessage ?? "No action proposed.",
        provider,
      });
    }

    const args = toolCall.arguments;
    const parsed = proposeRecategorizeSchema.safeParse(args);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { transaction_ids, citations, category_name } = parsed.data;
    if (!validateCitations(transaction_ids, citations)) {
      return NextResponse.json(
        { error: "Every citation must be in transaction_ids" },
        { status: 400 }
      );
    }

    const missing = transaction_ids.filter((id) => !txIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Invalid or out-of-tenant transaction IDs", ids: missing },
        { status: 400 }
      );
    }

    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("tenant_id", profile.current_tenant_id)
      .ilike("name", category_name)
      .single();

    if (!category?.id) {
      return NextResponse.json(
        { error: "Category not found in deterministic data", category_name },
        { status: 400 }
      );
    }

    const proposedAction = {
      action: "recategorize",
      transaction_ids,
      category_name,
      rationale: parsed.data.rationale,
      citations: parsed.data.citations,
    };

    const { data: proposal, error: insertErr } = await supabase
      .from("ai_action_proposals")
      .insert({
        tenant_id: profile.current_tenant_id,
        user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        model: modelId,
        request_id: requestId,
        proposed_action: proposedAction as unknown as Record<string, unknown>,
        referenced_transaction_ids: transaction_ids,
        status: "proposed",
      })
      .select("id, proposed_action, status, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: "Failed to save proposal", details: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      proposal_id: proposal.id,
      tenant_id: profile.current_tenant_id,
      provider,
      proposal: {
        id: proposal.id,
        proposed_action: proposal.proposed_action,
        status: proposal.status,
        created_at: proposal.created_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Propose failed", details: message },
      { status: 500 }
    );
  }
}
