-- =============================================================
-- OBoost Manager — Inventory Stock Safety Guard
-- Run after 21_tasks.sql.
--
-- Prevents inventory (orange cartons and spare parts) from ever
-- going negative. Redefines the two withdrawal RPCs from
-- 19_orange_inventory.sql / 20_spare_parts.sql via CREATE OR
-- REPLACE — no schema changes, no new tables or columns.
--
-- Concurrency: stock is a computed sum over an append-only ledger
-- (inventory_transactions), so there is no single stock row to
-- lock directly. Instead, each function takes a row lock
-- (`FOR UPDATE`) on the relevant inventory_items row before
-- computing current stock. Because the lock is held for the rest
-- of the function's transaction, a second concurrent withdrawal
-- for the same item blocks until the first commits or rolls back,
-- so the stock check always sees an up-to-date total — this makes
-- the negative-stock check atomic and race-safe.
-- =============================================================

create or replace function public.record_orange_withdrawal(p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id       uuid;
  v_txn_id        uuid;
  v_current_stock integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  -- Lock the item row first: serializes concurrent withdrawals for
  -- this item so the stock check below can't race.
  select id into v_item_id
  from public.inventory_items
  where item_type = 'orange_carton'
  limit 1
  for update;

  select coalesce(sum(quantity), 0)::integer into v_current_stock
  from public.inventory_transactions
  where item_id = v_item_id;

  if v_current_stock - p_quantity < 0 then
    raise exception 'Insufficient stock.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (v_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

create or replace function public.record_spare_part_withdrawal(p_item_id uuid, p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn_id        uuid;
  v_current_stock integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  -- Lock the item row first: serializes concurrent withdrawals for
  -- this item so the stock check below can't race.
  if not exists (
    select 1 from public.inventory_items
    where id = p_item_id and item_type = 'spare_part'
    for update
  ) then
    raise exception 'Spare part not found.';
  end if;

  select coalesce(sum(quantity), 0)::integer into v_current_stock
  from public.inventory_transactions
  where item_id = p_item_id;

  if v_current_stock - p_quantity < 0 then
    raise exception 'Insufficient stock.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (p_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

-- Grants are unchanged from 19/20 (CREATE OR REPLACE keeps existing
-- grants), but restated here for clarity/idempotency.
revoke execute on function public.record_orange_withdrawal(integer, text) from public;
revoke execute on function public.record_orange_withdrawal(integer, text) from anon;
grant  execute on function public.record_orange_withdrawal(integer, text) to authenticated;

revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from public;
revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from anon;
grant  execute on function public.record_spare_part_withdrawal(uuid, integer, text) to authenticated;
