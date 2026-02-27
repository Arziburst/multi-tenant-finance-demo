import { createHmac, timingSafeEqual } from "crypto";

const secret = process.env.WEBHOOK_SIGNING_SECRET ?? "";

export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!secret || !signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
