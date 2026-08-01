-- =============================================================
-- OBoost Manager — Promote manager user: Jonathan Segev
-- Run after 05_employees.sql in the Supabase SQL Editor.
--
-- Prerequisite: the auth user for yonatansegev14@gmail.com must
-- already exist. Create it via Supabase Dashboard → Authentication →
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
begin
  -- 1. Look up the existing auth user
  select id into v_user_id
  from auth.users
  where email = 'yonatansegev14@gmail.com';

  if v_user_id is null then
    raise exception 'Auth user for yonatansegev14@gmail.com does not exist yet — create it via Supabase Dashboard (Authentication → Add user → Invite) before running this migration.';
  end if;

  -- 2. Ensure the email identity exists (needed for sign-in)
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'yonatansegev14@gmail.com'),
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
  values (v_user_id, 'Jonathan', 'Segev', 'yonatansegev14@gmail.com')
  on conflict (employee_id) do nothing;
end $$;

-- To verify:
-- select u.id, u.email, u.email_confirmed_at,
--        (select count(*) from auth.identities i where i.user_id = u.id) as identities
-- from auth.users u where u.email = 'yonatansegev14@gmail.com';
-- select id, email, role from public.profiles where email = 'yonatansegev14@gmail.com';
-- select * from public.employees where email = 'yonatansegev14@gmail.com';
