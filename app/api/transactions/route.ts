import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase";
import { getUserToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getUserToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createUserClient(token);
  const { data, error } = await supabase
    .from("transactions")
    .select("id, name, amount, posted_date, category_id, categories(name)")
    .order("posted_date", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transactions = (data ?? []).map((row) => {
    const r = row as { id: string; name: string; amount: number; posted_date: string; category_id: string | null; categories: { name: string } | null };
    return {
      id: r.id,
      name: r.name,
      amount: r.amount,
      posted_date: r.posted_date,
      category_id: r.category_id,
      category_name: r.categories?.name ?? null,
    };
  });

  return NextResponse.json({ transactions });
}
