-- Pulihkan fitur mingguan dan pengajuan setelah migrasi 026.
-- Memerlukan migrasi 017-025. Data, RLS, dan validasi RPC tetap dipertahankan.
begin;

revoke all on public.weekly_placement_rooms, public.daily_room_placements,
  public.placement_requests from public, anon, authenticated;
grant select on public.weekly_placement_rooms, public.daily_room_placements,
  public.placement_requests to authenticated;

do $$
declare
  feature_function regprocedure;
  feature_signature text;
  feature_table text;
begin
  foreach feature_signature in array array[
    'public.save_daily_room_placement(uuid,date,text,uuid)',
    'public.fill_week_room_placements(uuid,date,text,jsonb)',
    'public.copy_previous_week_placements(date,jsonb,boolean)',
    'public.bulk_place_interns(date,jsonb,boolean)',
    'public.bulk_place_interns_range(date,date,jsonb,boolean)',
    'public.submit_placement_request(date,text,text)',
    'public.submit_placement_request_range(date,date,text,text)',
    'public.review_placement_request(uuid,text,text,uuid)',
    'public.review_placement_request_range(uuid,text,text,jsonb)',
    'public.cancel_placement_request(uuid)',
    'public.mark_placement_replies_read(uuid[])'
  ]
  loop
    feature_function := to_regprocedure(feature_signature);
    if feature_function is null then
      raise exception 'Jalankan migrasi penempatan 017-025 sebelum 027. Fungsi belum tersedia: %', feature_signature;
    end if;
    execute format('revoke all on function %s from public, anon', feature_function);
    execute format('grant execute on function %s to authenticated', feature_function);
  end loop;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach feature_table in array array['daily_room_placements', 'placement_requests']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = feature_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', feature_table);
      end if;
    end loop;
  end if;
end;
$$;

commit;
