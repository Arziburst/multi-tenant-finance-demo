import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";

const DEMO_ADMIN_SECRET = process.env.DEMO_ADMIN_SECRET;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!DEMO_ADMIN_SECRET || auth !== `Bearer ${DEMO_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  let t1 = (await supabase.from("tenants").select("id").eq("name", "Tenant A").maybeSingle()).data;
  let t2 = (await supabase.from("tenants").select("id").eq("name", "Tenant B").maybeSingle()).data;

  if (!t1?.id) {
    const r = await supabase.from("tenants").insert({ name: "Tenant A" }).select("id").single();
    t1 = r.data;
  }
  if (!t2?.id) {
    const r = await supabase.from("tenants").insert({ name: "Tenant B" }).select("id").single();
    t2 = r.data;
  }

  if (!t1?.id || !t2?.id) {
    return NextResponse.json(
      { error: "Failed to create or get tenants" },
      { status: 500 }
    );
  }

  const { data: authData } = await supabase.auth.admin.listUsers();
  const users = authData?.users ?? [];
  let userA: { id: string } | null | undefined = users.find((u) => u.email === "user-a@demo.local");
  let userB: { id: string } | null | undefined = users.find((u) => u.email === "user-b@demo.local");

  if (!userA) {
    const { data: createdA } = await supabase.auth.admin.createUser({
      email: "user-a@demo.local",
      password: "demo-password-a",
      email_confirm: true,
    });
    userA = createdA?.user ?? null;
  }
  if (!userB) {
    const { data: createdB } = await supabase.auth.admin.createUser({
      email: "user-b@demo.local",
      password: "demo-password-b",
      email_confirm: true,
    });
    userB = createdB?.user ?? null;
  }

  if (!userA?.id || !userB?.id) {
    return NextResponse.json(
      { error: "Failed to create or find users" },
      { status: 500 }
    );
  }

  const plaidItemIdA = "item-demo-tenant-a";
  let plaidA = (await supabase.from("plaid_items").select("tenant_id, id").eq("plaid_item_id", plaidItemIdA).maybeSingle()).data;
  if (!plaidA?.id) {
    const ins = await supabase.from("plaid_items").insert({
      tenant_id: t1.id,
      plaid_item_id: plaidItemIdA,
      status: "connected",
    }).select("tenant_id, id").single();
    plaidA = ins.data;
  }
  const tenantIdForItem = plaidA?.tenant_id ?? t1.id;

  await supabase.from("profiles").upsert(
    [
      { user_id: userA.id, current_tenant_id: tenantIdForItem },
      { user_id: userB.id, current_tenant_id: t2.id },
    ],
    { onConflict: "user_id" }
  );

  let catA1 = (await supabase.from("categories").select("id").eq("tenant_id", tenantIdForItem).ilike("name", "Coffee").maybeSingle()).data;
  if (!catA1?.id) {
    const r = await supabase.from("categories").insert({ tenant_id: tenantIdForItem, name: "Coffee" }).select("id").single();
    catA1 = r.data;
  }
  const catA2 = (await supabase.from("categories").select("id").eq("tenant_id", tenantIdForItem).ilike("name", "Dining").maybeSingle()).data;
  if (!catA2?.id) {
    await supabase.from("categories").insert({ tenant_id: tenantIdForItem, name: "Dining" }).select("id").single();
  }

  if (plaidA?.id) {
    await supabase.from("transactions").upsert(
      [
        {
          tenant_id: tenantIdForItem,
          plaid_item_pk: plaidA.id,
          provider_transaction_id: "txn-a-1",
          amount: -5.5,
          currency: "USD",
          posted_date: "2025-02-01",
          name: "Starbucks",
          category_id: catA1?.id ?? null,
        },
        {
          tenant_id: tenantIdForItem,
          plaid_item_pk: plaidA.id,
          provider_transaction_id: "txn-a-2",
          amount: -4.25,
          currency: "USD",
          posted_date: "2025-02-02",
          name: "Starbucks",
          category_id: null,
        },
      ],
      { onConflict: "tenant_id,provider_transaction_id", ignoreDuplicates: true }
    );
  }

  const anon = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data: signInA } = await anon.auth.signInWithPassword({
    email: "user-a@demo.local",
    password: "demo-password-a",
  });
  const tokenA = signInA.session?.access_token ?? null;

  return NextResponse.json({
    tenants: [t1.id, t2.id],
    users: {
      "user-a@demo.local": { id: userA.id, tenant_id: tenantIdForItem },
      "user-b@demo.local": { id: userB.id, tenant_id: t2.id },
    },
    plaid_item_id_tenant_a: plaidItemIdA,
    token_user_a: tokenA ?? "Sign in to get token",
  });
}
