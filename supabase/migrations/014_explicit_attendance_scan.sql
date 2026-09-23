-- QR yang sama, aksi masuk/pulang eksplisit. Permintaan masuk tidak pernah menjadi pulang.
begin;
create or replace function public.scan_attendance(
  qr_token text, scan_latitude double precision, scan_longitude double precision,
  scan_action text, scan_date date
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  attendance_record public.attendance;
  qr_record public.qr_sessions;
  configured_start time;
  tolerance_minutes integer;
  allowed_days smallint[];
  qr_is_enabled boolean;
  scan_time timestamptz := clock_timestamp();
  local_day date := (scan_time at time zone 'Asia/Jakarta')::date;
  distance_m double precision;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'intern' and is_active
  ) then raise exception 'Hanya anak magang aktif yang dapat absensi'; end if;
  if scan_action is null or scan_action not in ('check_in', 'check_out') then
    raise exception 'Pilih Absen Masuk atau Absen Pulang';
  end if;
  if scan_date is null or scan_date <> local_day then
    raise exception 'Tanggal sudah berganti. Kembali ke beranda dan mulai scan kembali';
  end if;
  select work_start_time, late_tolerance_minutes, work_days, qr_enabled
    into configured_start, tolerance_minutes, allowed_days, qr_is_enabled
    from public.system_settings where id = 1;
  if not coalesce(qr_is_enabled, true) then raise exception 'QR absensi sedang dinonaktifkan'; end if;
  if not (extract(isodow from local_day)::smallint = any(coalesce(allowed_days, array[1,2,3,4,5]::smallint[]))) then
    raise exception 'Absensi tidak tersedia pada hari ini';
  end if;
  select * into qr_record from public.qr_sessions
    where token = qr_token and is_active and expires_at > scan_time;
  if qr_record.id is null then raise exception 'QR tidak valid atau sudah kedaluwarsa'; end if;
  if qr_record.latitude is null or qr_record.longitude is null
    or scan_latitude is null or scan_longitude is null
    or scan_latitude not between -90 and 90 or scan_longitude not between -180 and 180 then
    raise exception 'QR atau lokasi GPS tidak valid';
  end if;
  distance_m := 6371000 * acos(least(1.0, greatest(-1.0,
    cos(radians(qr_record.latitude)) * cos(radians(scan_latitude))
    * cos(radians(scan_longitude) - radians(qr_record.longitude))
    + sin(radians(qr_record.latitude)) * sin(radians(scan_latitude))
  )));
  if distance_m is null or distance_m > qr_record.radius_m then raise exception 'Anda berada di luar area absensi'; end if;

  -- Serialisasi juga berlaku ketika baris absensi pertama belum ada.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || local_day::text, 0));
  if scan_action = 'check_in' then
    insert into public.attendance(user_id, date, check_in, status)
      values(auth.uid(), local_day, scan_time,
        case when (scan_time at time zone 'Asia/Jakarta')::time > coalesce(configured_start, time '08:00')
          + make_interval(mins => coalesce(tolerance_minutes, 0)) then 'Terlambat' else 'Hadir' end)
      on conflict (user_id, date) do nothing;
  end if;
  select * into attendance_record from public.attendance
    where user_id = auth.uid() and date = local_day for update;
  if attendance_record.id is null or attendance_record.check_in is null then
    raise exception 'Jam masuk belum tercatat. Lakukan absen masuk atau hubungi pembimbing';
  end if;
  if attendance_record.status not in ('Hadir', 'Terlambat') then
    raise exception 'Status absensi tidak mengizinkan scan. Hubungi pembimbing';
  end if;
  -- Scan masuk berulang hanya mengembalikan catatan yang ada, tanpa mengubah jam.
  if scan_action = 'check_out' and attendance_record.check_out is null then
    if attendance_record.check_in > scan_time then raise exception 'Jam masuk belum valid untuk absen pulang'; end if;
    update public.attendance set check_out = scan_time where id = attendance_record.id
      returning * into attendance_record;
  end if;
  return attendance_record;
end;
$$;
revoke all on function public.scan_attendance(text, double precision, double precision, text, date) from public, anon;
grant execute on function public.scan_attendance(text, double precision, double precision, text, date) to authenticated;

-- Aplikasi lama harus dimuat ulang; jangan biarkan jalur lama tetap melakukan toggle.
create or replace function public.scan_attendance(
  qr_token text, scan_latitude double precision, scan_longitude double precision
) returns public.attendance language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Muat ulang aplikasi, lalu pilih tombol Absen Masuk atau Absen Pulang';
end;
$$;
revoke all on function public.scan_attendance(text, double precision, double precision) from public, anon;
grant execute on function public.scan_attendance(text, double precision, double precision) to authenticated;
commit;
