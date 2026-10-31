-- MBC Arena - Storage policies for jersey design images
--
-- Apply after backend/migrations/009_jersey_images.sql.
--
-- The `jersey-designs` bucket is public so players can load mockups without a
-- signed URL; only training staff may upload, replace, or delete an object.
-- The whole file is skipped when the `storage` schema is absent, which is how
-- the local PGlite harness runs.

begin;

do $policy$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema is absent; skipping jersey design image policies';
    return;
  end if;

  execute $sql$
    create policy jersey_design_images_read
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'jersey-designs')
  $sql$;

  execute $sql$
    create policy jersey_design_images_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'jersey-designs'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'trainer')
      )
    )
  $sql$;

  execute $sql$
    create policy jersey_design_images_update
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'jersey-designs'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'trainer')
      )
    )
    with check (
      bucket_id = 'jersey-designs'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'trainer')
      )
    )
  $sql$;

  execute $sql$
    create policy jersey_design_images_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'jersey-designs'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'trainer')
      )
    )
  $sql$;
end;
$policy$;

commit;
