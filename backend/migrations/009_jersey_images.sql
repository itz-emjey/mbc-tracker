-- MBC Arena - jersey design images
--
-- Apply after backend/migrations/008_club_activities.sql.
--
-- Image bytes live in Supabase Storage; this migration adds only the pointer,
-- the audited staff-only RPC that sets it, and the bucket itself. Bucket setup
-- is skipped when the `storage` schema is absent, which is how the local
-- PGlite harness runs.

begin;

alter table public.jersey_designs
  add column image_path text;

alter table public.jersey_designs
  add constraint jersey_designs_image_path_check
  check (
    image_path is null
    or (
      char_length(image_path) between 1 and 400
      and image_path ~ '^designs/[A-Za-z0-9/_.-]+$'
    )
  );

comment on column public.jersey_designs.image_path is
  'Object path inside the jersey-designs bucket; null when no mockup was uploaded.';

create function public.set_jersey_design_image(p_design_id uuid, p_image_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_design public.jersey_designs%rowtype;
  v_project_status text;
  v_path text;
begin
  v_actor := public.require_club_staff();

  select * into v_design
    from public.jersey_designs
   where id = p_design_id
     for update;

  if not found then
    raise exception 'design not found' using errcode = 'P0002';
  end if;

  select status into v_project_status
    from public.jersey_projects
   where id = v_design.project_id;

  if v_project_status not in ('draft', 'open') then
    raise exception 'images cannot change on a % project', v_project_status
      using errcode = '22023';
  end if;

  v_path := nullif(btrim(coalesce(p_image_path, '')), '');

  -- Anchored, so `..`, absolute URLs, and other buckets are impossible.
  if v_path is not null and v_path !~ '^designs/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$' then
    raise exception 'the image path must be a designs/<project>/<file> object ending in .png, .jpg, .jpeg, or .webp'
      using errcode = '22023';
  end if;

  update public.jersey_designs
     set image_path = v_path
   where id = v_design.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'jersey.design.image',
    'jersey_designs',
    v_design.id,
    jsonb_build_object('image_path', v_design.image_path),
    jsonb_build_object('image_path', v_path)
  );

  return jsonb_build_object('id', v_design.id, 'image_path', v_path);
end;
$function$;

revoke all on function public.set_jersey_design_image(uuid, text) from public;
grant execute on function public.set_jersey_design_image(uuid, text) to authenticated, service_role;

-- Public bucket: members must load the mockups in the browser. Uploads are
-- restricted to training staff by policies/009_jersey_images.sql.
do $bucket$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema is absent; skipping the jersey-designs bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'jersey-designs',
    'jersey-designs',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end;
$bucket$;

commit;
