# Client requirements (Joshua) vs implemented functionality

## 1. Supabase with Multi-Tenant RLS

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Schema with `tenant_id` on all tables | Done | `tenants`, `profiles` (current_tenant_id), `categories`, `plaid_items`, `transactions`, `txn_category_events`, `webhook_events`, `ai_action_proposals`, `ai_action_executions` all use tenant_id (or link to tenant via profile). |
| RLS policies enforcing tenant isolation | Done | All tenant tables have RLS enabled. Policies use `tenant_id = public.get_current_tenant_id()` for SELECT/UPDATE/INSERT where applicable. |
| Helper `get_current_tenant_id()` used in policies | Done | `public.get_current_tenant_id()` returns `profiles.current_tenant_id` for `auth.uid()`. Used in policies for categories, plaid_items, transactions, ai_action_proposals, ai_action_executions, txn_category_events. |

## 2. Foreign key constraints (defense in depth)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| FK constraints prevent cross-tenant references | Done | Composite PKs `(tenant_id, id)` and FKs like `(tenant_id, plaid_item_pk) REFERENCES plaid_items(tenant_id, id)`, `(tenant_id, category_id) REFERENCES categories(tenant_id, id)`. Same for txn_category_events, ai_action_executions → ai_action_proposals. |

## 3. Idempotent webhook handling (Plaid mock)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Endpoint that simulates receiving webhooks | Done | `POST /api/webhooks/plaid` in `app/api/webhooks/plaid/route.ts`. |
| Idempotency keys and deduplication | Done | Payload must include `idempotency_key`. RPC `insert_webhook_event_if_new(p_tenant_id, p_provider, p_idempotency_key, ...)` uses `ON CONFLICT (tenant_id, provider, idempotency_key) DO NOTHING` and returns `was_new`. Handler returns `{ ok: true, deduped: true }` when duplicate. |

## 4. Mapping external IDs to tenants

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Associate external id (e.g. Plaid `item_id`) with `tenant_id` | Done | Table `plaid_items(tenant_id, plaid_item_id)` with unique `plaid_item_id`. Webhook receives `item_id` → `SELECT tenant_id FROM plaid_items WHERE plaid_item_id = item_id` (service role). Data written only to that tenant. |
| Secure routing without user JWT | Done | Webhook uses `createServiceClient()` (service role). No JWT; tenant resolved server-side from `plaid_items` lookup. |

## 5. OpenAI function calling with guardrails

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Simple function e.g. `propose_recategorize(transaction_ids, category)` | Done | Tool `propose_recategorize` with `transaction_ids`, `category_name`, `rationale`, `citations`. |
| Layer 1: System prompt that forces citation | Done | `SYSTEM_PROMPT` in `lib/ai-tools.ts` and `lib/openai-tools.ts`: "Never invent...", "Every recommendation must cite the exact transaction UUIDs", "call the tool propose_recategorize with real transaction_ids only". |
| Layer 2: Structured function calling with JSON schema | Done | `proposeRecategorizeTool` in `lib/openai-tools.ts` with `strict: true`, `parameters` schema (transaction_ids, category_name, rationale, citations), required fields. |
| Layer 3: Backend validation (cited IDs exist and belong to tenant) | Done | In `app/api/ai/propose/route.ts`: transactions loaded via RLS (tenant-scoped); `proposeRecategorizeSchema.safeParse(args)`; `validateCitations(transaction_ids, citations)`; `missing = transaction_ids.filter(id => !txIds.has(id))` → 400 if any invalid; category checked against tenant. |

## 6. Confirmation flow

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Show proposal → user confirmation → write | Done | Propose returns proposal; user calls confirm with `proposal_id` and `confirm` flag. |
| API endpoint with `confirm=true` flag | Done | `POST /api/ai/confirm` accepts `{ proposal_id, confirm }` (body.confirm === true). |
| No mutation without consent | Done | RPC `confirm_proposal` writes only when `p_confirm` is true; otherwise records rejection in `ai_action_executions` and sets proposal status to 'rejected'. |

## 7. Audit trail tables

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| `ai_action_proposals` | Done | Columns: tenant_id, id, user_id, model, request_id, proposed_action (jsonb), referenced_transaction_ids, status, created_at. |
| `ai_action_executions` | Done | Columns: tenant_id, id, proposal_id (FK to proposals), confirmed_by_user_id, confirm_flag, execution_status, execution_result (jsonb), created_at. |
| Traceability: proposed, confirmed, executed | Done | Proposals have status (proposed → executed/rejected). Executions link to proposal and store confirm_flag and execution_result. |

## 8. Deployment

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Deploy to Vercel or similar; share URL | Not in repo | No `vercel.json` or deploy config in repo. Project is Next.js and can be deployed to Vercel with `vercel` or Git integration. |
| Simple API or Edge Function to interact with | Done | Next.js API routes serve as the API. No frontend required per spec; demo has optional UI. |

---

## Summary

- **Fully covered:** 1 (RLS), 2 (FKs), 3 (idempotent webhooks), 4 (item_id → tenant), 5 (OpenAI guardrails), 6 (confirm flow), 7 (audit tables).
- **Deployment:** Implementation is deployment-ready (Next.js); only the actual deploy step and URL are not in the repo.

## Optional improvements (not required by client)

- Document in README how to deploy to Vercel and which env vars to set (SUPABASE_*, OPENAI_*, WEBHOOK_SIGNING_SECRET, DEMO_ADMIN_SECRET).
- Ensure `webhook_events` has no RLS policies that would block service role (current behavior: RLS enabled, service role bypasses RLS — correct).
