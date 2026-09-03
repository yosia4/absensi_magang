-- Jalankan setelah 001_safe_improvements.sql.
-- Memperketat notifikasi, validasi lokasi, realtime, dan foto profil private.

drop policy if exists "notifications own" on public.notifications;
drop policy if exists "own notifications" on public.notifications;
drop policy if exists "own notification read" on public.notifications;
drop policy if exists "notifications select own" on public.notifications;
drop policy if exists "notifications mark own read" on public.notifications;
create policy "notifications select own"
  on public.notifications for select
  using (auth.uid() = user_id);
create policy "notifications mark own read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
revoke insert, delete, update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "profile photo view" on storage.objects;
drop policy if exists "profile photo upload" on storage.objects;
drop policy if exists "profile photo update" on storage.objects;
drop policy if exists "profile photo delete" on storage.objects;
drop policy if exists "profile photo private view" on storage.objects;
drop policy if exists "profile photo own upload" on storage.objects;
drop policy if exists "profile photo own update" on storage.objects;
drop policy if exists "profile photo own delete" on storage.objects;
create policy "profile photo private view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())  
  );
create policy "profile photo own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "profile photo own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "profile photo own delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create or replace function public.scan_attendance(
  qr_token text,
  scan_latitude double precision,
  scan_longitude double precision
) returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  attendance_record public.attendance;
  qr_record public.qr_sessions;
  configured_start time;
  tolerance_minutes integer;
  allowed_days smallint[];
  qr_is_enabled boolean;
  local_day date := (now() at time zone 'Asia/Jakarta')::date;
  distance_m double precision;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'intern' and is_active
  ) then
    raise exception 'Hanya anak magang aktif yang dapat absensi';
  end if;

  select work_start_time, late_tolerance_minutes, work_days, qr_enabled
    into configured_start, tolerance_minutes, allowed_days, qr_is_enabled
  from public.system_settings where id = 1;

  if not coalesce(qr_is_enabled, true) then
    raise exception 'QR absensi sedang dinonaktifkan';
  end if;
  if not (
    extract(isodow from now() at time zone 'Asia/Jakarta')::smallint =
    any(coalesce(allowed_days, array[1,2,3,4,5]::smallint[]))
  ) then
    raise exception 'Absensi tidak tersedia pada hari ini';
  end if;

  select * into qr_record from public.qr_sessions
  where token = qr_token and is_active and expires_at > now();
  if qr_record.id is null then
    raise exception 'QR tidak valid atau sudah kedaluwarsa';
  end if;
  if qr_record.latitude is null or qr_record.longitude is null
     or scan_latitude is null or scan_longitude is null
     or scan_latitude not between -90 and 90
     or scan_longitude not between -180 and 180 then
    raise exception 'QR atau lokasi GPS tidak valid';
  end if;

  distance_m := 6371000 * acos(least(1.0, greatest(-1.0,
    cos(radians(qr_record.latitude)) * cos(radians(scan_latitude))
    * cos(radians(scan_longitude) - radians(qr_record.longitude))
    + sin(radians(qr_record.latitude)) * sin(radians(scan_latitude))
  )));
  if distance_m is null or distance_m > qr_record.radius_m then
    raise exception 'Anda berada di luar area absensi';
  end if;

  select * into attendance_record from public.attendance
  where user_id = auth.uid() and date = local_day for update;
  if attendance_record.id is null then
    insert into public.attendance(user_id, date, check_in, status)
    values (
      auth.uid(), local_day, now(),
      case when (now() at time zone 'Asia/Jakarta')::time >
        coalesce(configured_start, time '08:00')
        + make_interval(mins => coalesce(tolerance_minutes, 0))
      then 'Terlambat' else 'Hadir' end
    ) returning * into attendance_record;
  elsif attendance_record.check_out is null then
    update public.attendance set check_out = now()
    where id = attendance_record.id returning * into attendance_record;
  else
    raise exception 'Absensi hari ini sudah selesai';
  end if;
  return attendance_record;
end;
$$;

revoke all on function public.scan_attendance(text, double precision, double precision) from public, anon;
grant execute on function public.scan_attendance(text, double precision, double precision) to authenticated;
