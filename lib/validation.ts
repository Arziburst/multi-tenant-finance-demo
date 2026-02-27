import { z } from "zod";

export const proposeRecategorizeSchema = z.object({
  transaction_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(50),
  category_name: z.string().min(1).max(64),
  rationale: z.string().min(1).max(500),
  citations: z
    .array(z.string())
    .min(1),
});

export type ProposeRecategorizeInput = z.infer<typeof proposeRecategorizeSchema>;

export function validateCitations(
  transactionIds: string[],
  citations: string[]
): boolean {
  const set = new Set(transactionIds);
  return citations.every((c) => set.has(c));
}
