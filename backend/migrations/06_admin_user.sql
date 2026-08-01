-- =============================================================
-- OBoost Manager — Create ADMIN user: Jonathan Segev
-- Run after 05_employees.sql in the Supabase SQL Editor.
--
-- Steps inside the DO block:
--   1. Create the auth user (email confirmed). The handle_new_user
--      trigger in 02_triggers.sql auto-creates the profiles row.
--   2. Insert the matching auth.identities row — REQUIRED for
--      password sign-in (GoTrue refuses login without it).
--   3. Promote the profiles row to role 'admin'.
--   4. Link the matching employees row (1:1 with profiles).
--
-- Idempotent: safe to re-run if the user already exists.
-- =============================================================

-- Ensure password-hashing helpers are available (no-op if already enabled)
create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
begin
  -- 1. Create the auth user if it does not exist yet
  select id into v_user_id
  from auth.users
  where email = 'yonatansegev14@gmail.com';

  if v_user_id is null then
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'yonatansegev14@gmail.com', crypt('Segev2002', gen_salt('bf')), now(),
      '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Jonathan Segev"}', now(), now()
    )
    returning id into v_user_id;
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

  -- 3. Promote to ADMIN
  update public.profiles
  set role = 'admin'
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
