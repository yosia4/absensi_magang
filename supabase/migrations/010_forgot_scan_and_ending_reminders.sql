-- Jalankan setelah 009_backfill_intern_university_major.sql.
-- 1) Menambahkan jenis pengajuan "Lupa Absen" agar anak magang punya jalur
--    in-app untuk minta koreksi saat lupa scan / GPS gagal, tanpa membuat
--    sistem otomatis menulis status "Lupa Absen" ke tabel attendance (admin
--    tetap memakai "Edit Absensi" untuk koreksi sesungguhnya).
-- 2) Pengingat otomatis (pg_cron) untuk masa magang yang akan berakhir,
--    mengikuti pola generate_scheduled_attendance_reminders() di migrasi 007.

alter table public.leave_requests
  drop constraint if exists leave_requests_type_check;
alter table public.leave_requests
  add constraint leave_requests_type_check
  check (type in ('Izin', 'Sakit', 'Lupa Absen'));

create or replace function public.review_leave_request(
  request_id uuid,
  decision text,
  rejection_note text default null
)
returns public.leave_requests language plpgsql security definer set search_path=public as $$
declare request_record public.leave_requests;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat memproses pengajuan'; end if;
  if decision not in ('Disetujui','Ditolak') then raise exception 'Keputusan tidak valid'; end if;
  if decision = 'Ditolak' and nullif(trim(coalesce(rejection_note, '')), '') is null then
    raise exception 'Alasan penolakan wajib diisi';
  end if;
  update public.leave_requests set
    status = decision,
    reviewer_id = auth.uid(),
    reviewed_at = now(),
    rejection_reason = case when decision = 'Ditolak' then trim(rejection_note) else null end
  where id = request_id and status = 'Menunggu'
  returning * into request_record;
  if request_record.id is null then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
  -- "Lupa Absen" hanyalah permintaan agar admin meninjau; jangan menulis
  -- status "Lupa Absen" ke attendance. Koreksi sesungguhnya tetap lewat
  -- correct_attendance (menu Edit Absensi) supaya nilai status yang dipakai
  -- selalu konsisten (Hadir/Terlambat/Izin/Sakit/Alpa).
  if decision='Disetujui' and request_record.type in ('Izin','Sakit') then
    insert into public.attendance(user_id,date,status)
    select request_record.user_id, day_value::date, request_record.type
    from generate_series(request_record.date_from,request_record.date_to,interval '1 day') day_value
    where extract(isodow from day_value) between 1 and 5
    on conflict(user_id,date) do update set status=excluded.status
    where public.attendance.check_in is null;
  end if;
  insert into public.notifications(user_id,title,message)
  values(
    request_record.user_id,
    'Pengajuan '||lower(decision),
    case when decision = 'Ditolak'
      then request_record.type||' ditolak. Alasan: '||request_record.rejection_reason
      else request_record.type||' tanggal '||to_char(request_record.date_from,'DD-MM-YYYY')||' telah disetujui.'
    end
  );
  insert into public.audit_logs(actor_id,action,target_id,details)
  values(auth.uid(),'review_leave',request_record.id,jsonb_build_object('decision',decision,'user_id',request_record.user_id,'rejection_reason',request_record.rejection_reason));
  return request_record;
end$$;

create or replace function public.generate_internship_ending_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  -- Dipanggil pg_cron (tanpa sesi auth), bukan dari klien: tidak ada
  -- pengecekan is_admin() di sini, dan hak eksekusinya dicabut dari
  -- authenticated/anon di bawah — sama seperti pola pengingat absensi
  -- terjadwal pada migrasi 007.
  insert into public.notifications(user_id, title, message, dedupe_key)
  select intern.id, 'Magang segera berakhir',
    'Masa magang Anda berakhir pada '||to_char(intern.internship_end,'DD-MM-YYYY')||'.',
    'internship-ending:'||intern.id||':'||intern.internship_end
  from public.profiles intern
  where intern.role = 'intern' and intern.is_active
    and intern.internship_end between current_date and current_date + 7
  union all
  select admin.id, 'Masa magang anak magang segera berakhir',
    intern.name||coalesce(' ('||intern.university||')', '')||' berakhir pada '||to_char(intern.internship_end,'DD-MM-YYYY')||'.',
    'internship-ending:'||intern.id||':'||intern.internship_end
  from public.profiles intern
  cross join public.profiles admin
  where intern.role = 'intern' and intern.is_active
    and admin.role = 'admin' and admin.is_active
    and intern.internship_end between current_date and current_date + 7
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_internship_ending_reminders() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'internship-ending-reminder'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

-- Sekali sehari jam 08:00 WIB (01:00 UTC) sudah cukup; dedupe_key mencegah
-- pengingat yang sama terkirim berulang selama masih dalam jendela 7 hari.
select cron.schedule(
  'internship-ending-reminder',
  '0 1 * * *',
  'select public.generate_internship_ending_reminders();'
);
