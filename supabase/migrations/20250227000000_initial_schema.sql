create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists ix_profiles_current_tenant on public.profiles(current_tenant_id);

create table if not exists public.categories (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists ix_categories_tenant on public.categories(tenant_id);
create unique index if not exists ux_categories_tenant_lower_name on public.categories (tenant_id, lower(name));

create table if not exists public.plaid_items (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  plaid_item_id text not null,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (plaid_item_id)
);

create index if not exists ix_plaid_items_tenant on public.plaid_items(tenant_id);

create table if not exists public.transactions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  plaid_item_pk uuid not null,
  provider_transaction_id text not null,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  posted_date date not null,
  name text not null,
  category_id uuid null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  constraint fk_transactions_plaid_item
    foreign key (tenant_id, plaid_item_pk)
    references public.plaid_items (tenant_id, id)
    on delete restrict,
  constraint fk_transactions_category
    foreign key (tenant_id, category_id)
    references public.categories (tenant_id, id)
    on delete restrict
);

create unique index if not exists ux_transactions_provider_id
  on public.transactions(tenant_id, provider_transaction_id);

create index if not exists ix_transactions_tenant_posted_date
  on public.transactions(tenant_id, posted_date desc);

create index if not exists ix_transactions_plaid_item
  on public.transactions(tenant_id, plaid_item_pk);

create table if not exists public.txn_category_events (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  transaction_id uuid not null,
  old_category_id uuid null,
  new_category_id uuid null,
  changed_by_user_id uuid null references auth.users(id) on delete set null,
  source text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  constraint fk_txn_category_events_transaction
    foreign key (tenant_id, transaction_id)
    references public.transactions (tenant_id, id)
    on delete restrict,
  constraint fk_txn_category_events_old_cat
    foreign key (tenant_id, old_category_id)
    references public.categories (tenant_id, id)
    on delete restrict,
  constraint fk_txn_category_events_new_cat
    foreign key (tenant_id, new_category_id)
    references public.categories (tenant_id, id)
    on delete restrict
);

create index if not exists ix_txn_category_events_txn
  on public.txn_category_events(tenant_id, transaction_id, created_at desc);

create table if not exists public.webhook_events (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  provider text not null,
  idempotency_key text not null,
  item_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  primary key (tenant_id, id),
  unique (tenant_id, provider, idempotency_key)
);

create index if not exists ix_webhook_events_lookup
  on public.webhook_events(tenant_id, provider, idempotency_key);

create table if not exists public.ai_action_proposals (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  model text not null,
  request_id text null,
  proposed_action jsonb not null,
  referenced_transaction_ids uuid[] not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists ix_ai_action_proposals_status
  on public.ai_action_proposals(tenant_id, status, created_at desc);

create table if not exists public.ai_action_executions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  proposal_id uuid not null,
  confirmed_by_user_id uuid null references auth.users(id) on delete set null,
  confirm_flag boolean not null,
  execution_status text not null,
  execution_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  constraint fk_ai_action_executions_proposal
    foreign key (tenant_id, proposal_id)
    references public.ai_action_proposals (tenant_id, id)
    on delete restrict
);

create index if not exists ix_ai_action_executions_proposal
  on public.ai_action_executions(tenant_id, proposal_id, created_at desc);

create or replace function public.get_current_tenant_id()
returns uuid
language sql
stable
as $$
  select p.current_tenant_id
  from public.profiles p
  where p.user_id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.plaid_items enable row level security;
alter table public.transactions enable row level security;
alter table public.txn_category_events enable row level security;
alter table public.ai_action_proposals enable row level security;
alter table public.ai_action_executions enable row level security;
alter table public.webhook_events enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "categories_select_tenant"
on public.categories for select
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "plaid_items_select_tenant"
on public.plaid_items for select
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "transactions_select_tenant"
on public.transactions for select
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "transactions_update_tenant"
on public.transactions for update
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "ai_proposals_select_tenant"
on public.ai_action_proposals for select
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "ai_proposals_insert_tenant"
on public.ai_action_proposals for insert
to authenticated
with check (tenant_id = public.get_current_tenant_id());

create policy "ai_executions_select_tenant"
on public.ai_action_executions for select
to authenticated
using (tenant_id = public.get_current_tenant_id());

create policy "ai_executions_insert_tenant"
on public.ai_action_executions for insert
to authenticated
with check (tenant_id = public.get_current_tenant_id());

create policy "ai_proposals_update_tenant"
on public.ai_action_proposals for update
to authenticated
using (tenant_id = public.get_current_tenant_id())
with check (tenant_id = public.get_current_tenant_id());

create policy "txn_category_events_insert_tenant"
on public.txn_category_events for insert
to authenticated
with check (tenant_id = public.get_current_tenant_id());

revoke update on table public.transactions from authenticated;
grant update (category_id) on table public.transactions to authenticated;

create or replace function public.insert_webhook_event_if_new(
  p_tenant_id uuid,
  p_provider text,
  p_idempotency_key text,
  p_item_id text,
  p_payload jsonb
)
returns table (id uuid, was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_exists boolean;
begin
  insert into public.webhook_events (tenant_id, provider, idempotency_key, item_id, payload)
  values (p_tenant_id, p_provider, p_idempotency_key, p_item_id, p_payload)
  on conflict (tenant_id, provider, idempotency_key) do nothing
  returning webhook_events.id into v_id;
  if v_id is not null then
    return query select v_id, true;
  else
    select we.id into v_id
    from public.webhook_events we
    where we.tenant_id = p_tenant_id and we.provider = p_provider and we.idempotency_key = p_idempotency_key;
    return query select v_id, false;
  end if;
end;
$$;

create or replace function public.confirm_proposal(
  p_tenant_id uuid,
  p_user_id uuid,
  p_proposal_id uuid,
  p_confirm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.ai_action_proposals%rowtype;
  v_category_id uuid;
  v_txn_id uuid;
  v_old_cat uuid;
  v_exec_id uuid;
  v_result jsonb := '{}'::jsonb;
  v_updated int := 0;
begin
  select * into v_proposal
  from public.ai_action_proposals
  where tenant_id = p_tenant_id and id = p_proposal_id
  for update;

  if not found or v_proposal.status <> 'proposed' then
    return jsonb_build_object('error', 'Not confirmable');
  end if;

  insert into public.ai_action_executions (
    tenant_id, proposal_id, confirmed_by_user_id, confirm_flag, execution_status, execution_result
  ) values (
    p_tenant_id, p_proposal_id, p_user_id, p_confirm,
    case when p_confirm then 'executed' else 'rejected' end,
    '{}'::jsonb
  )
  returning id into v_exec_id;

  if not p_confirm then
    update public.ai_action_proposals set status = 'rejected'
    where tenant_id = p_tenant_id and id = p_proposal_id;
    return jsonb_build_object('execution_id', v_exec_id, 'status', 'rejected');
  end if;

  select id into v_category_id
  from public.categories
  where tenant_id = p_tenant_id
  and lower(name) = lower((v_proposal.proposed_action->>'category_name')::text);

  if v_category_id is null then
    update public.ai_action_executions set execution_status = 'failed', execution_result = '{"error":"category not found"}'::jsonb
    where tenant_id = p_tenant_id and id = v_exec_id;
    return jsonb_build_object('execution_id', v_exec_id, 'error', 'category not found');
  end if;

  for v_txn_id in select (elem::text)::uuid from jsonb_array_elements_text(v_proposal.proposed_action->'transaction_ids') as elem
  loop
    select category_id into v_old_cat
    from public.transactions
    where tenant_id = p_tenant_id and id = v_txn_id;

    if found then
      update public.transactions set category_id = v_category_id
      where tenant_id = p_tenant_id and id = v_txn_id;
      insert into public.txn_category_events (tenant_id, transaction_id, old_category_id, new_category_id, changed_by_user_id, source)
      values (p_tenant_id, v_txn_id, v_old_cat, v_category_id, p_user_id, 'ai_confirmed');
      v_updated := v_updated + 1;
    end if;
  end loop;

  update public.ai_action_proposals set status = 'executed'
  where tenant_id = p_tenant_id and id = p_proposal_id;

  v_result := jsonb_build_object('updated_transactions', v_updated, 'new_category_id', v_category_id);
  update public.ai_action_executions set execution_result = v_result
  where tenant_id = p_tenant_id and id = v_exec_id;

  return jsonb_build_object('execution_id', v_exec_id, 'result', v_result);
end;
$$;

grant execute on function public.confirm_proposal(uuid, uuid, uuid, boolean) to authenticated;
