import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const DEMO_ADMIN_SECRET = process.env.DEMO_ADMIN_SECRET;
const DEMO_USER_EMAILS = ["user-a@demo.local", "user-b@demo.local"];
const DEMO_TENANT_NAMES = ["Tenant A", "Tenant B"];

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!DEMO_ADMIN_SECRET || auth !== `Bearer ${DEMO_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results: { step: string; ok: boolean; detail?: string }[] = [];

  const { data: demoTenants } = await supabase
    .from("tenants")
    .select("id")
    .in("name", DEMO_TENANT_NAMES);
  const tenantIds = (demoTenants ?? []).map((t) => t.id);

  if (tenantIds.length > 0) {
    const { error: delProfiles } = await supabase
      .from("profiles")
      .delete()
      .in("current_tenant_id", tenantIds);
    if (delProfiles) {
      results.push({ step: "delete profiles for demo tenants", ok: false, detail: delProfiles.message });
    } else {
      results.push({ step: "delete profiles for demo tenants", ok: true });
    }
  }

  for (const tid of tenantIds) {
    const { error: delTenant } = await supabase.from("tenants").delete().eq("id", tid);
    if (delTenant) {
      results.push({ step: "delete tenant", ok: false, detail: delTenant.message });
    } else {
      results.push({ step: "delete tenant", ok: true });
    }
  }

  const { data: authData } = await supabase.auth.admin.listUsers();
  const demoUsers = (authData?.users ?? []).filter((u) =>
    DEMO_USER_EMAILS.includes(u.email ?? "")
  );
  for (const user of demoUsers) {
    const { error: delUser } = await supabase.auth.admin.deleteUser(user.id);
    if (delUser) {
      results.push({ step: `delete auth user ${user.email}`, ok: false, detail: delUser.message });
    } else {
      results.push({ step: `delete auth user ${user.email}`, ok: true });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    status: allOk ? "reset_ok" : "reset_partial",
    message: allOk
      ? "Demo data removed. Run Bootstrap to start over."
      : "Some steps failed. Check details.",
    details: results,
  });
}
