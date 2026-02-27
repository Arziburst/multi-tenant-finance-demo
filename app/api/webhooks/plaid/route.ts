import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/webhook-auth";
import type { WebhookPlaidPayload } from "@/lib/types";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-plaid-signature") ?? req.headers.get("x-webhook-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookPlaidPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { item_id, idempotency_key, transactions: txns } = payload;
  if (!item_id || !idempotency_key) {
    return NextResponse.json(
      { error: "Missing item_id or idempotency_key" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: plaidRow } = await supabase
    .from("plaid_items")
    .select("tenant_id, id")
    .eq("plaid_item_id", item_id)
    .eq("status", "connected")
    .single();

  if (!plaidRow) {
    return NextResponse.json(
      { error: "Unknown item_id or not connected" },
      { status: 404 }
    );
  }

  const { data: insertResult } = await supabase.rpc("insert_webhook_event_if_new", {
    p_tenant_id: plaidRow.tenant_id,
    p_provider: "plaid_mock",
    p_idempotency_key: idempotency_key,
    p_item_id: item_id,
    p_payload: payload as unknown as Record<string, unknown>,
  });

  const row = Array.isArray(insertResult) ? insertResult[0] : insertResult;
  const wasNew = row?.was_new === true;

  if (!wasNew) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  if (txns?.length) {
    for (const t of txns) {
      await supabase.from("transactions").upsert(
        {
          tenant_id: plaidRow.tenant_id,
          plaid_item_pk: plaidRow.id,
          provider_transaction_id: t.transaction_id,
          amount: t.amount,
          currency: t.iso_currency_code ?? "USD",
          posted_date: t.date,
          name: t.name,
          category_id: null,
        },
        {
          onConflict: "tenant_id,provider_transaction_id",
          ignoreDuplicates: true,
        }
      );
    }
  }

  const { data: webhookRow } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("tenant_id", plaidRow.tenant_id)
    .eq("provider", "plaid_mock")
    .eq("idempotency_key", idempotency_key)
    .single();

  if (webhookRow?.id) {
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("tenant_id", plaidRow.tenant_id)
      .eq("provider", "plaid_mock")
      .eq("idempotency_key", idempotency_key);
  }

  return NextResponse.json({ ok: true, deduped: false }, { status: 200 });
}
