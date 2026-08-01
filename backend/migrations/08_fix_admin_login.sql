-- =============================================================
-- OBoost Manager — Fix admin login (Jonathan Segev)
-- Run AFTER the earlier 06_admin_user.sql that left the user
-- unable to sign in (500 on /auth/v1/token).
--
-- Cause: manually-inserted auth.users rows are missing the
-- matching row in auth.identities, which GoTrue requires for
-- every sign-in path (including email/password). Some auth.users
-- token columns may also be NULL.
--
-- This migration repairs the existing user in place (idempotent).
-- =============================================================

-- 1. Ensure no NULL string columns that GoTrue scans into strings
update auth.users
set confirmation_token          = coalesce(confirmation_token, ''),
    recovery_token              = coalesce(recovery_token, ''),
    email_change                = coalesce(email_change, ''),
    email_change_token_new      = coalesce(email_change_token_new, ''),
    email_change_token_current  = coalesce(email_change_token_current, ''),
    phone_change                = coalesce(phone_change, ''),
    phone_change_token          = coalesce(phone_change_token, ''),
    reauthentication_token      = coalesce(reauthentication_token, '')
where email = 'yonatansegev14@gmail.com';

-- 2. Create the email identity row (required for password sign-in)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.email = 'yonatansegev14@gmail.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 3. Make sure role is ADMIN and employees row is linked
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'yonatansegev14@gmail.com');

insert into public.employees (employee_id, first_name, last_name, email)
select id, 'Jonathan', 'Segev', 'yonatansegev14@gmail.com'
from auth.users
where email = 'yonatansegev14@gmail.com'
on conflict (employee_id) do nothing;

-- Verify:
-- select u.id, u.email, u.email_confirmed_at,
--        (select count(*) from auth.identities i where i.user_id = u.id) as identities
-- from auth.users u where u.email = 'yonatansegev14@gmail.com';
-- select id, email, role from public.profiles where email = 'yonatansegev14@gmail.com';
