import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase";
import { getUserToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = getUserToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createUserClient(token);

  let body: { proposal_id?: string; confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const proposalId = body.proposal_id;
  const confirm = body.confirm === true;

  if (!proposalId) {
    return NextResponse.json(
      { error: "Missing proposal_id" },
      { status: 400 }
    );
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const { data: proposal } = await supabase
    .from("ai_action_proposals")
    .select("tenant_id")
    .eq("id", proposalId)
    .single();

  if (!proposal?.tenant_id) {
    return NextResponse.json(
      { error: "Proposal not found or access denied" },
      { status: 404 }
    );
  }

  const { data: result, error } = await supabase.rpc("confirm_proposal", {
    p_tenant_id: proposal.tenant_id,
    p_user_id: user.id,
    p_proposal_id: proposalId,
    p_confirm: confirm,
  });

  if (error) {
    return NextResponse.json(
      { error: "Confirm failed", details: error.message },
      { status: 500 }
    );
  }

  const out = result as { error?: string; execution_id?: string; status?: string; result?: unknown };
  if (out.error) {
    return NextResponse.json(
      { error: out.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    execution_id: out.execution_id,
    status: out.status ?? (confirm ? "executed" : "rejected"),
    result: out.result,
  });
}
