-- Membuat pengingat absensi otomatis 10 menit sebelum batas check-in.
-- Batas check-in = jam masuk normal + toleransi keterlambatan.

create extension if not exists pg_cron with schema extensions;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_key_idx
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.generate_scheduled_attendance_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := now() at time zone 'Asia/Jakarta';
  local_day date := local_now::date;
  current_minute integer := extract(hour from local_now)::integer * 60
    + extract(minute from local_now)::integer;
  deadline_minute integer;
  configured_days smallint[];
  qr_is_enabled boolean;
  inserted_count integer := 0;
begin
  select
    extract(hour from work_start_time)::integer * 60
      + extract(minute from work_start_time)::integer
      + coalesce(late_tolerance_minutes, 0),
    coalesce(work_days, array[1,2,3,4,5]::smallint[]),
    coalesce(qr_enabled, true)
  into deadline_minute, configured_days, qr_is_enabled
  from public.system_settings
  where id = 1;

  deadline_minute := coalesce(deadline_minute, 8 * 60);

  -- Scheduler berjalan tiap menit. Rentang sepuluh menit dan dedupe_key
  -- mencegah pengingat terlewat atau dibuat lebih dari sekali.
  if not qr_is_enabled
     or not (extract(isodow from local_now)::smallint = any(configured_days))
     or current_minute < deadline_minute - 10
     or current_minute >= deadline_minute then
    return 0;
  end if;

  insert into public.notifications(user_id, title, message, dedupe_key)
  select
    profile.id,
    'Pengingat absensi',
    'Batas waktu check-in tinggal 10 menit. Segera buka menu Scan Absen.',
    'attendance-reminder-10m:' || local_day::text
  from public.profiles profile
  where profile.role = 'intern'
    and profile.is_active
    and not exists (
      select 1
      from public.attendance attendance
      where attendance.user_id = profile.id
        and attendance.date = local_day
    )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_scheduled_attendance_reminders() from public, anon, authenticated;

-- Hapus jadwal lama dengan nama sama supaya migrasi aman dijalankan ulang.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'automatic-attendance-reminder'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'automatic-attendance-reminder',
  '* * * * *',
  'select public.generate_scheduled_attendance_reminders();'
);

