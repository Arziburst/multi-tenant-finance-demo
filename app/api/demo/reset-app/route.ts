import { NextRequest } from "next/server";
import { POST as resetHandler } from "../reset/route";

export async function POST(req: NextRequest) {
  const secret = process.env.DEMO_ADMIN_SECRET;
  if (!secret) {
    return Response.json({ error: "DEMO_ADMIN_SECRET not configured" }, { status: 500 });
  }
  const authedReq = new Request(req.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return resetHandler(authedReq);
}
