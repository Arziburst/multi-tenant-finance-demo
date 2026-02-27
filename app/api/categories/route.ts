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
    .from("categories")
    .select("name")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categories = (data ?? []).map((r) => r.name);
  return NextResponse.json({ categories });
}
