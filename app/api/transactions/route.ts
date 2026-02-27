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
    .select("id, name, amount, posted_date, category_id")
    .order("posted_date", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: data });
}
