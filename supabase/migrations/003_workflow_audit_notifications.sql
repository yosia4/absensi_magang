-- Jalankan setelah 002_security_and_private_photos.sql.
-- Workflow izin/sakit, koreksi absensi, audit, dan notifikasi sistem.

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('Izin', 'Sakit')),
  date_from date not null,
  date_to date not null,
  reason text not null,
  status text not null default 'Menunggu' check (status in ('Menunggu', 'Disetujui', 'Ditolak')),
  reviewer_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
alter table public.leave_requests enable row level security;
drop policy if exists "leave own select" on public.leave_requests;
drop policy if exists "leave own insert" on public.leave_requests;
drop policy if exists "leave admin select" on public.leave_requests;
drop policy if exists "leave admin update" on public.leave_requests;
create policy "leave own select" on public.leave_requests for select
  using (auth.uid() = user_id);
create policy "leave own insert" on public.leave_requests for insert
  with check (auth.uid() = user_id and status = 'Menunggu');
create policy "leave admin select" on public.leave_requests for select
  using (public.is_admin());
create policy "leave admin update" on public.leave_requests for update
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.review_leave_request(request_id uuid, decision text)
returns public.leave_requests language plpgsql security definer set search_path=public as $$
declare request_record public.leave_requests;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat memproses pengajuan'; end if;
  if decision not in ('Disetujui','Ditolak') then raise exception 'Keputusan tidak valid'; end if;
  update public.leave_requests set status=decision, reviewer_id=auth.uid(), reviewed_at=now()
  where id=request_id and status='Menunggu' returning * into request_record;
  if request_record.id is null then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
  if decision='Disetujui' then
    insert into public.attendance(user_id,date,status)
    select request_record.user_id, day_value::date, request_record.type
    from generate_series(request_record.date_from,request_record.date_to,interval '1 day') day_value
    where extract(isodow from day_value) between 1 and 5
    on conflict(user_id,date) do update set status=excluded.status
    where public.attendance.check_in is null;
  end if;
  insert into public.notifications(user_id,title,message)
  values(request_record.user_id,'Pengajuan '||lower(decision),
    request_record.type||' tanggal '||to_char(request_record.date_from,'DD-MM-YYYY')||' telah '||lower(decision)||'.');
  insert into public.audit_logs(actor_id,action,target_id,details)
  values(auth.uid(),'review_leave',request_record.id,jsonb_build_object('decision',decision,'user_id',request_record.user_id));
  return request_record;
end$$;

create or replace function public.correct_attendance(
  target_user_id uuid, target_date date, new_check_in time,
  new_check_out time, new_status text, correction_reason text
) returns public.attendance language plpgsql security definer set search_path=public as $$
declare result public.attendance;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengoreksi absensi'; end if;
  if correction_reason is null or length(trim(correction_reason)) < 5 then raise exception 'Alasan koreksi minimal 5 karakter'; end if;
  if new_status not in ('Hadir','Terlambat','Izin','Sakit','Alpa') then raise exception 'Status tidak valid'; end if;
  insert into public.attendance(user_id,date,check_in,check_out,status)
  values(
    target_user_id,target_date,
    case when new_check_in is null then null else target_date + new_check_in at time zone 'Asia/Jakarta' end,
    case when new_check_out is null then null else target_date + new_check_out at time zone 'Asia/Jakarta' end,
    new_status
  )
  on conflict(user_id,date) do update set check_in=excluded.check_in,check_out=excluded.check_out,status=excluded.status
  returning * into result;
  insert into public.audit_logs(actor_id,action,target_id,details)
  values(auth.uid(),'correct_attendance',result.id,jsonb_build_object('reason',correction_reason,'user_id',target_user_id,'date',target_date,'status',new_status));
  insert into public.notifications(user_id,title,message)
  values(target_user_id,'Absensi dikoreksi','Data absensi tanggal '||to_char(target_date,'DD-MM-YYYY')||' diperbarui admin. Alasan: '||correction_reason);
  return result;
end$$;

create or replace function public.create_own_system_notification(notification_title text, notification_message text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sesi tidak valid'; end if;
  if length(notification_title) > 80 or length(notification_message) > 300 then raise exception 'Notifikasi terlalu panjang'; end if;
  insert into public.notifications(user_id,title,message) values(auth.uid(),notification_title,notification_message);
end$$;

create or replace function public.notify_leave_submission() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,title,message)
  values(new.user_id,'Pengajuan terkirim',new.type||' tanggal '||to_char(new.date_from,'DD-MM-YYYY')||' sedang menunggu persetujuan.');
  return new;
end$$;
drop trigger if exists leave_submission_notification on public.leave_requests;
create trigger leave_submission_notification after insert on public.leave_requests
for each row execute procedure public.notify_leave_submission();

create or replace function public.notify_attendance() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(user_id,title,message)
    values(new.user_id,
      case when new.status in ('Izin','Sakit') then 'Status '||lower(new.status)||' tercatat'
           when new.status='Terlambat' then 'Anda tercatat terlambat'
           else 'Absensi masuk berhasil' end,
      case when new.check_in is null then 'Status kehadiran: '||new.status||'.'
           else 'Check-in tercatat pukul '||to_char(new.check_in at time zone 'Asia/Jakarta','HH24:MI')||'. Status: '||new.status end);
  elsif old.check_out is null and new.check_out is not null then
    insert into public.notifications(user_id,title,message)
    values(new.user_id,'Absensi pulang berhasil','Check-out tercatat pukul '||to_char(new.check_out at time zone 'Asia/Jakarta','HH24:MI')||'.');
  end if;
  return new;
end$$;

create or replace function public.generate_absence_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat membuat pengingat'; end if;
  insert into public.notifications(user_id,title,message)
  select p.id,'Pengingat absensi','Anda belum melakukan check-in hari ini.'
  from public.profiles p
  where p.role='intern' and p.is_active
    and not exists(select 1 from public.attendance a where a.user_id=p.id and a.date=(now() at time zone 'Asia/Jakarta')::date)
    and not exists(select 1 from public.notifications n where n.user_id=p.id and n.title='Pengingat absensi' and n.created_at::date=current_date);
  get diagnostics inserted_count = row_count;
  insert into public.audit_logs(actor_id,action,details) values(auth.uid(),'generate_absence_reminders',jsonb_build_object('count',inserted_count));
  return inserted_count;
end$$;

create or replace function public.audit_admin_changes() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then
    insert into public.audit_logs(actor_id,action,target_id,details)
    values(auth.uid(),tg_table_name||'_'||lower(tg_op),
      case when tg_op='DELETE' then old.id::text::uuid else new.id::text::uuid end,
      jsonb_build_object('old',case when tg_op='INSERT' then null else to_jsonb(old) end,
                         'new',case when tg_op='DELETE' then null else to_jsonb(new) end));
  end if;
  return coalesce(new,old);
end$$;
drop trigger if exists audit_profile_changes on public.profiles;
create trigger audit_profile_changes after update on public.profiles
for each row when (old.* is distinct from new.*) execute procedure public.audit_admin_changes();
drop trigger if exists audit_qr_changes on public.qr_sessions;
create trigger audit_qr_changes after insert or update or delete on public.qr_sessions
for each row execute procedure public.audit_admin_changes();
create or replace function public.audit_settings_changes() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and old.* is distinct from new.* then
    insert into public.audit_logs(actor_id,action,details)
    values(auth.uid(),'update_settings',jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)));
  end if;
  return new;
end$$;
drop trigger if exists audit_settings_update on public.system_settings;
create trigger audit_settings_update after update on public.system_settings
for each row execute procedure public.audit_settings_changes();

grant execute on function public.review_leave_request(uuid,text) to authenticated;
grant execute on function public.correct_attendance(uuid,date,time,time,text,text) to authenticated;
grant execute on function public.create_own_system_notification(text,text) to authenticated;
grant execute on function public.generate_absence_reminders() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='leave_requests') then
    alter publication supabase_realtime add table public.leave_requests;
  end if;
end $$;
