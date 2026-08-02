-- =============================================================
-- OBoost Manager — Orange Carton Inventory (Phase E)
-- Run after 18_maintenance_reports_resolution_check.sql.
--
-- Shared inventory architecture (inventory_items + inventory_transactions)
-- so spare-parts inventory (Phase F) can reuse it later by adding
-- item_type = 'spare_part' rows, without a second schema.
--
-- Stock is never stored as a single editable number — it is always
-- the sum of every transaction's signed quantity for an item.
-- =============================================================

create table public.inventory_items (
  id          uuid        primary key default gen_random_uuid(),
  item_type   text        not null check (item_type in ('orange_carton', 'spare_part')),
  name        text        not null,
  description text        not null default '',
  unit        text        not null default 'unit',
  is_active   boolean     not null default true,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.handle_updated_at();

-- Seed the single orange-carton item this phase operates on.
insert into public.inventory_items (item_type, name, unit)
values ('orange_carton', 'Orange Cartons', 'carton');

-- ----------------------------------------------------------------
-- inventory_transactions
-- Append-only ledger. current stock = sum(quantity) per item_id.
-- quantity is signed: positive increases stock (delivery, positive
-- adjustment), negative decreases it (withdrawal, negative adjustment).
-- ----------------------------------------------------------------
create table public.inventory_transactions (
  id               uuid        primary key default gen_random_uuid(),
  item_id          uuid        not null references public.inventory_items(id) on delete cascade,
  transaction_type text        not null check (transaction_type in ('delivery', 'withdrawal', 'adjustment')),
  quantity         integer     not null check (quantity <> 0),
  recorded_by      uuid        not null references public.profiles(id),
  notes            text        not null default '',
  created_at       timestamptz not null default now()
);

-- ================================================================
-- Row Level Security
-- ================================================================
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

-- inventory_items: everyone authenticated can see item definitions
-- (both roles need this to know what they're viewing stock/movements for).
create policy "inventory_items: select all authenticated"
  on public.inventory_items for select
  using (true);

-- No client INSERT/UPDATE/DELETE policy on inventory_items — item
-- definitions are managed via migration for now (only one orange-carton
-- row exists today; Phase F will add spare_part rows the same way).

-- inventory_transactions: managers see every movement; employees see
-- only the ones they themselves recorded (mirrors the existing
-- cleaning_logs / maintenance_reports select-own-or-elevated pattern).
create policy "inventory_transactions: select own or elevated"
  on public.inventory_transactions for select
  using (
    public.is_admin_or_manager()
    or recorded_by = auth.uid()
  );

-- Append-only, and only ever written through the RPCs below (which
-- stamp recorded_by from auth.uid() themselves rather than trusting
-- client input, and enforce who may record which transaction_type) —
-- so there is no direct INSERT policy for authenticated at all.
create policy "inventory_transactions: update blocked"
  on public.inventory_transactions for update
  using (false);

create policy "inventory_transactions: delete blocked"
  on public.inventory_transactions for delete
  using (false);

grant select on public.inventory_items to authenticated;
grant select on public.inventory_transactions to authenticated;

-- ================================================================
-- RPCs
-- ================================================================

-- Current stock must be correct for every authenticated user (both
-- roles need to see true availability), but the detailed transaction
-- list above is intentionally role-scoped by RLS. A plain client-side
-- sum of whatever rows RLS returns would be wrong for an employee (it
-- would only total their own transactions). This function computes the
-- real total as its own owner, bypassing RLS for just this one number.
create or replace function public.get_orange_stock()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.inventory_transactions
  where item_id = (select id from public.inventory_items where item_type = 'orange_carton' limit 1);
$$;

create or replace function public.record_orange_delivery(p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_txn_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to record a delivery.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  select id into v_item_id from public.inventory_items where item_type = 'orange_carton' limit 1;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (v_item_id, 'delivery', p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

create or replace function public.record_orange_withdrawal(p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_txn_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  select id into v_item_id from public.inventory_items where item_type = 'orange_carton' limit 1;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (v_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

create or replace function public.record_orange_adjustment(p_quantity integer, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_txn_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to record an adjustment.';
  end if;

  if p_quantity is null or p_quantity = 0 then
    raise exception 'Adjustment quantity cannot be zero.';
  end if;

  if p_notes is null or length(trim(p_notes)) = 0 then
    raise exception 'An adjustment requires a note explaining the correction.';
  end if;

  select id into v_item_id from public.inventory_items where item_type = 'orange_carton' limit 1;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (v_item_id, 'adjustment', p_quantity, auth.uid(), p_notes)
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

revoke execute on function public.get_orange_stock() from public;
revoke execute on function public.get_orange_stock() from anon;
grant  execute on function public.get_orange_stock() to authenticated;

revoke execute on function public.record_orange_delivery(integer, text) from public;
revoke execute on function public.record_orange_delivery(integer, text) from anon;
grant  execute on function public.record_orange_delivery(integer, text) to authenticated;

revoke execute on function public.record_orange_withdrawal(integer, text) from public;
revoke execute on function public.record_orange_withdrawal(integer, text) from anon;
grant  execute on function public.record_orange_withdrawal(integer, text) to authenticated;

revoke execute on function public.record_orange_adjustment(integer, text) from public;
revoke execute on function public.record_orange_adjustment(integer, text) from anon;
grant  execute on function public.record_orange_adjustment(integer, text) to authenticated;
