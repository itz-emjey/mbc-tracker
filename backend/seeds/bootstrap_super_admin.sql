-- MBC Arena — one-time first Super Admin bootstrap (decision D8)
--
-- There is no public Super Admin registration path, and approval needs an
-- existing Super Admin, so the very first one is granted here, by hand, as the
-- project owner. This file is a SQL script only: it creates no function, no
-- RPC, and no endpoint, so no client can ever call it.
--
-- Usage, in the Supabase SQL Editor, as the project owner:
--
--   1. Create or invite the account in Authentication → Users and confirm it
--      (or register through the app and confirm the email), then sign in once
--      so its profile row exists.
--   2. Paste this line and the whole of this file into the SAME SQL Editor
--      execution, replacing the address:
--
--        set mbc.bootstrap_super_admin_email = 'owner@example.com';
--
--   The setting is required. Without it this script refuses to run, so a
--   copied file cannot grant Super Admin to whoever happens to exist.
--
-- Behaviour:
--   * a pending profile is activated, because approval is what normally does
--     that and there is nobody to approve the first admin;
--   * `super_admin` is granted once (ON CONFLICT DO NOTHING);
--   * one `audit_logs` row records the before/after state;
--   * re-running with the same address is a no-op — no duplicate role, no
--     duplicate audit row;
--   * unknown addresses, and suspended/deactivated accounts, fail loudly.
--
-- Apply after migrations 001–003 and policies 001–004.

do $bootstrap_super_admin$
declare
  v_email text := nullif(btrim(current_setting('mbc.bootstrap_super_admin_email', true)), '');
  v_profile public.profiles%rowtype;
  v_role_id uuid;
  v_before_roles jsonb;
  v_after_roles jsonb;
  v_status_changed boolean;
  v_role_granted boolean;
begin
  if v_email is null then
    raise exception 'refusing to bootstrap: no email supplied'
      using errcode = '22023',
            hint = 'Run "set mbc.bootstrap_super_admin_email = ''owner@example.com'';" in the same SQL Editor execution as this file.';
  end if;

  select p.*
    into v_profile
    from public.profiles as p
    join auth.users as u on u.id = p.id
   where lower(u.email) = lower(v_email);

  if not found then
    raise exception 'no profile found for %', v_email
      using errcode = 'P0002',
            hint = 'Create or invite the account in Supabase Auth, sign in once so its profile exists, then run this again.';
  end if;

  if v_profile.status in ('suspended', 'deactivated') then
    raise exception 'refusing to bootstrap: profile is %', v_profile.status
      using errcode = '42501',
            hint = 'Reactivate the account through an existing Super Admin first.';
  end if;

  select r.id
    into v_role_id
    from public.roles as r
   where r.key = 'super_admin';

  select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
    into v_before_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.profile_id = v_profile.id;

  v_status_changed := v_profile.status <> 'active';
  v_role_granted := not (v_before_roles ? 'super_admin');

  if not v_status_changed and not v_role_granted then
    raise notice 'bootstrap: % is already an active Super Admin; nothing to do', lower(v_email);
    return;
  end if;

  if v_status_changed then
    update public.profiles
       set status = 'active'
     where id = v_profile.id;
  end if;

  insert into public.user_roles (profile_id, role_id, granted_by)
  values (v_profile.id, v_role_id, null)
  on conflict (profile_id, role_id) do nothing;

  select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
    into v_after_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.profile_id = v_profile.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    null,
    'profile.bootstrap_super_admin',
    'profiles',
    v_profile.id,
    jsonb_build_object('status', v_profile.status, 'roles', v_before_roles),
    jsonb_build_object('status', 'active', 'roles', v_after_roles, 'email', lower(v_email))
  );

  raise notice 'bootstrap: % is now an active Super Admin', lower(v_email);
end
$bootstrap_super_admin$;
