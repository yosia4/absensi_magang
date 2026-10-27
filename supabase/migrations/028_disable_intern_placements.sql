-- Menonaktifkan kembali fitur penempatan setelah migrasi pemulihan sebelumnya.
-- Data lama tetap menjadi arsip administrator dan tidak dihapus.
begin;

do $$
declare
  feature_function regprocedure;
  feature_table text;
begin
  for feature_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'save_room_placements', 'cancel_room_placement',
      'save_daily_room_placement', 'fill_week_room_placements',
      'copy_previous_week_placements', 'bulk_place_interns',
      'bulk_place_interns_range', 'submit_placement_request',
      'submit_placement_request_range', 'review_placement_request',
      'review_placement_request_range', 'cancel_placement_request',
      'mark_placement_replies_read'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', feature_function);
  end loop;

  foreach feature_table in array array[
    'room_placements', 'placement_rooms', 'weekly_placement_rooms',
    'daily_room_placements', 'placement_requests'
  ]
  loop
    if to_regclass(format('public.%I', feature_table)) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', feature_table);
      if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = feature_table
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', feature_table);
      end if;
    end if;
  end loop;
end;
$$;

commit;
