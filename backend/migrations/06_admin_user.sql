-- =============================================================
-- OBoost Manager — Promote manager user (template)
-- Run after 05_employees.sql in the Supabase SQL Editor.
--
-- This migration is a TEMPLATE. Before running it, replace the
-- placeholder email and name below with the real manager account
-- you want to promote. Never commit real personal details or a
-- password into this file — passwords are never handled here.
--
-- Prerequisite: the auth user for the target email must already
-- exist. Create it via Supabase Dashboard → Authentication →
-- Add user → Invite (or let them sign up normally) so the password
-- is set through Supabase's own invite/reset email flow — never
-- store a password in this file.
--
-- Steps inside the DO block:
--   1. Look up the existing auth user by email.
--   2. Insert the matching auth.identities row if missing — REQUIRED
--      for password sign-in (GoTrue refuses login without it).
--   3. Promote the profiles row to role 'manager' (elevated access).
--   4. Link the matching employees row (1:1 with profiles).
--
-- Idempotent: safe to re-run.
-- =============================================================

do $$
declare
  v_user_id uuid;
  v_email   text := 'manager@example.com';   -- CHANGE_ME before running
  v_first   text := 'Jane';                  -- CHANGE_ME before running
  v_last    text := 'Doe';                   -- CHANGE_ME before running
begin
  -- 1. Look up the existing auth user
  select id into v_user_id
  from auth.users
  where email = v_email;

  if v_user_id is null then
    raise exception 'Auth user for % does not exist yet — create it via Supabase Dashboard (Authentication → Add user → Invite) before running this migration.', v_email;
  end if;

  -- 2. Ensure the email identity exists (needed for sign-in)
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(), now(), now()
  where not exists (
    select 1 from auth.identities i
    where i.user_id = v_user_id and i.provider = 'email'
  );

  -- 3. Promote to manager (elevated role)
  update public.profiles
  set role = 'manager'
  where id = v_user_id;

  -- 4. Link the employees row
  insert into public.employees (employee_id, first_name, last_name, email)
  values (v_user_id, v_first, v_last, v_email)
  on conflict (employee_id) do nothing;
end $$;

-- To verify:
-- select u.id, u.email, u.email_confirmed_at,
--        (select count(*) from auth.identities i where i.user_id = u.id) as identities
-- from auth.users u where u.email = 'manager@example.com';
-- select id, email, role from public.profiles where email = 'manager@example.com';
-- select * from public.employees where email = 'manager@example.com';
