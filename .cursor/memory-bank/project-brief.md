# Project: Multi-Tenant Finance + Agentic AI Backend Demo

## Purpose
Minimal backend demo proving: multi-tenant isolation (RLS), defense-in-depth FKs, idempotent Plaid-like webhooks, secure external ID → tenant mapping, OpenAI tool-calling with guardrails, proposal → confirm → write pattern, full audit trail.

## Stack
- **DB**: Supabase (Postgres + RLS + migrations)
- **API**: Next.js route handlers on Vercel
- **AI**: OpenAI tools/function-calling with Structured Outputs (strict: true)

## Key Endpoints
- `POST /api/demo/bootstrap` — DEMO_ADMIN_SECRET; seeds tenants, users, profiles, transactions, categories; returns JWT for user A
- `GET /api/transactions` — User JWT; list transactions (RLS)
- `POST /api/webhooks/plaid` — Webhook secret; idempotent ingestion by item_id → tenant
- `POST /api/ai/propose` — User JWT; RLS transactions → OpenAI → validate → insert proposal
- `POST /api/ai/confirm` — User JWT; RPC confirm_proposal → execution record + deterministic writes

## Security
- User endpoints use anon key + user JWT so RLS enforces tenant isolation
- Webhook uses service role server-side only; tenant from plaid_items(item_id)
- Composite FKs (tenant_id, id) on all tables prevent cross-tenant references
