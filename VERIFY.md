# Verify setup

## 1. Migration (once)

Supabase Dashboard → your project → **SQL Editor** → paste full content of `supabase/migrations/20250227000000_initial_schema.sql` → **Run**.

## 2. Env

Create `.env.local` in project root with:

```
SUPABASE_URL=<from Supabase: Settings → API>
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
OPENAI_API_KEY=<from https://platform.openai.com/api-keys>
ANTHROPIC_API_KEY=<from https://console.anthropic.com — for Claude>
WEBHOOK_SIGNING_SECRET=<any random string>
DEMO_ADMIN_SECRET=<any random string, e.g. 1234567890>
```

## 3. Run and test

Terminal 1:

```bash
npm run dev
```

Terminal 2 (replace `1234567890` with your `DEMO_ADMIN_SECRET`):

```bash
curl -s -X POST http://localhost:3000/api/demo/bootstrap -H "Authorization: Bearer 1234567890"
```

Copy `token_user_a` from the JSON, then:

```bash
curl -s http://localhost:3000/api/transactions -H "Authorization: Bearer PASTE_token_user_a_HERE"
```

You should see a non-empty `transactions` array.

## 4. OpenAI (propose)

Ensure `OPENAI_API_KEY` is in `.env.local` and restart `npm run dev`. Then (paste your token):

```bash
curl -s -X POST http://localhost:3000/api/ai/propose -H "Authorization: Bearer PASTE_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"question\":\"Recategorize my Starbucks transactions to Coffee\"}"
```

To confirm the proposal (use `proposal_id` from the response):

```bash
curl -s -X POST http://localhost:3000/api/ai/confirm -H "Authorization: Bearer PASTE_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"proposal_id\":\"PASTE_PROPOSAL_ID\",\"confirm\":true}"
```
