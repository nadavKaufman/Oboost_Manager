-- =============================================================
-- OBoost Manager — Spare Parts Inventory (Phase F)
-- Run after 19_orange_inventory.sql.
--
-- Reuses the shared inventory_items / inventory_transactions tables
-- from Phase E — no new tables. Spare parts are just inventory_items
-- rows with item_type = 'spare_part', tracked with the same signed-
-- quantity transaction ledger as orange cartons.
-- =============================================================

-- Managers may create/edit spare-part item definitions, but the
-- WITH CHECK on both policies pins item_type = 'spare_part' so this
-- can never be used to create a second orange_carton row (which the
-- Phase E RPCs assume is a singleton) or repurpose that row.
create policy "inventory_items: manager insert spare parts"
  on public.inventory_items for insert
  with check (
    public.is_admin_or_manager()
    and item_type = 'spare_part'
  );

create policy "inventory_items: manager update spare parts"
  on public.inventory_items for update
  using (
    public.is_admin_or_manager()
    and item_type = 'spare_part'
  )
  with check (
    public.is_admin_or_manager()
    and item_type = 'spare_part'
  );

grant insert, update on public.inventory_items to authenticated;

-- ================================================================
-- RPCs — same shape as the Phase E orange-carton RPCs, parameterized
-- by item_id instead of hardcoding a single item.
-- ================================================================

create or replace function public.get_spare_part_stock(p_item_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.inventory_transactions
  where item_id = p_item_id;
$$;

create or replace function public.record_spare_part_delivery(p_item_id uuid, p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
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

  if not exists (select 1 from public.inventory_items where id = p_item_id and item_type = 'spare_part') then
    raise exception 'Spare part not found.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (p_item_id, 'delivery', p_quantity, auth.uid(), coalesce(p_notes, ''))
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
  v_txn_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  if not exists (select 1 from public.inventory_items where id = p_item_id and item_type = 'spare_part') then
    raise exception 'Spare part not found.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (p_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

create or replace function public.record_spare_part_adjustment(p_item_id uuid, p_quantity integer, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
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

  if not exists (select 1 from public.inventory_items where id = p_item_id and item_type = 'spare_part') then
    raise exception 'Spare part not found.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (p_item_id, 'adjustment', p_quantity, auth.uid(), p_notes)
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

revoke execute on function public.get_spare_part_stock(uuid) from public;
revoke execute on function public.get_spare_part_stock(uuid) from anon;
grant  execute on function public.get_spare_part_stock(uuid) to authenticated;

revoke execute on function public.record_spare_part_delivery(uuid, integer, text) from public;
revoke execute on function public.record_spare_part_delivery(uuid, integer, text) from anon;
grant  execute on function public.record_spare_part_delivery(uuid, integer, text) to authenticated;

revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from public;
revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from anon;
grant  execute on function public.record_spare_part_withdrawal(uuid, integer, text) to authenticated;

revoke execute on function public.record_spare_part_adjustment(uuid, integer, text) from public;
revoke execute on function public.record_spare_part_adjustment(uuid, integer, text) from anon;
grant  execute on function public.record_spare_part_adjustment(uuid, integer, text) to authenticated;
