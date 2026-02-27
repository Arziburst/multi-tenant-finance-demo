# Multi-Tenant Finance + Agentic AI Backend Demo

Minimal backend demonstrating: multi-tenant isolation (RLS), defense-in-depth FKs, idempotent Plaid-like webhooks, OpenAI tool-calling with guardrails, and proposal → confirm → deterministic write with full audit trail.

## Stack

- **Database**: Supabase (Postgres + RLS + migrations)
- **API**: Next.js route handlers (Vercel-ready)
- **AI**: OpenAI with Structured Outputs (`strict: true`) and backend validation

## Setup

1. Create a Supabase project and run migrations:

   ```bash
   npx supabase link --project-ref YOUR_REF
   npx supabase db push
   ```

   Or run `supabase/migrations/20250227000000_initial_schema.sql` manually in the SQL editor.

2. Copy `.env.example` to `.env.local` and set:

   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `WEBHOOK_SIGNING_SECRET` (e.g. a random string; used for HMAC of webhook body)
   - `DEMO_ADMIN_SECRET` (e.g. a random string; protects bootstrap)

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   API base: `http://localhost:3000/api`

## 3 curl commands to prove each requirement

### 1. Tenant isolation (RLS)

Bootstrap creates two tenants and returns a JWT for Tenant A. With that JWT, you only see Tenant A data.

```bash
# Bootstrap (replace DEMO_ADMIN_SECRET)
curl -s -X POST http://localhost:3000/api/demo/bootstrap \
  -H "Authorization: Bearer YOUR_DEMO_ADMIN_SECRET" | jq

# Copy token_user_a from the response, then list transactions (RLS enforced)
curl -s http://localhost:3000/api/transactions \
  -H "Authorization: Bearer TOKEN_USER_A" | jq
```

User B cannot see Tenant A transactions because RLS restricts rows to `get_current_tenant_id()`.

### 2. Webhook idempotency

Send the same webhook twice; the second returns `deduped: true` and does not create duplicate rows.

```bash
# Sign with HMAC-SHA256 of body (use same secret as WEBHOOK_SIGNING_SECRET)
# Example (Node): require('crypto').createHmac('sha256', secret).update(body).digest('hex')
SIG=$(echo -n '{"item_id":"item-demo-tenant-a","idempotency_key":"key-1","transactions":[]}' | openssl dgst -sha256 -hmac "$WEBHOOK_SIGNING_SECRET" | awk '{print "sha256=" $2}')

curl -s -X POST http://localhost:3000/api/webhooks/plaid \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIG" \
  -d '{"item_id":"item-demo-tenant-a","idempotency_key":"key-1","transactions":[]}'

# Run again: response should include "deduped": true
```

### 3. AI proposal → confirm → deterministic write

Propose recategorizes transactions (only real IDs; backend validates). Confirm applies the change in a transaction and writes to `txn_category_events`.

```bash
# Propose (model will use real transaction IDs from your tenant)
curl -s -X POST http://localhost:3000/api/ai/propose \
  -H "Authorization: Bearer TOKEN_USER_A" \
  -H "Content-Type: application/json" \
  -d '{"question":"Recategorize my Starbucks transactions to Coffee"}' | jq

# Confirm (use proposal_id from response)
curl -s -X POST http://localhost:3000/api/ai/confirm \
  -H "Authorization: Bearer TOKEN_USER_A" \
  -H "Content-Type: application/json" \
  -d '{"proposal_id":"PROPOSAL_UUID","confirm":true}' | jq
```

Invalid proposal (e.g. non-existent transaction ID) is rejected by backend validation; no proposal is written.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/demo/bootstrap` | `DEMO_ADMIN_SECRET` | Seeds two tenants, users, profiles, categories, plaid item, transactions; returns JWT for user A |
| POST | `/api/webhooks/plaid` | `x-webhook-signature` (HMAC) | Idempotent ingestion by `item_id` → tenant; dedupe by `(tenant_id, provider, idempotency_key)` |
| POST | `/api/ai/propose` | User JWT | Reads transactions (RLS), calls OpenAI tool, validates, inserts `ai_action_proposals` |
| GET | `/api/transactions` | User JWT | Lists transactions for current tenant (RLS); use to get IDs for propose |
| POST | `/api/ai/confirm` | User JWT | Locks proposal, inserts `ai_action_executions`, applies category updates + `txn_category_events` in one transaction |

## Security

- User endpoints use the **anon key + user JWT** so RLS enforces tenant isolation.
- Webhook uses **service role** server-side only; tenant is resolved from `plaid_items.plaid_item_id`.
- All FKs are composite `(tenant_id, id)` so cross-tenant references are impossible at the DB level.
- `transactions` update is restricted to `category_id` via column-level grant.
