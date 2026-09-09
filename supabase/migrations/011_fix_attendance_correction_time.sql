-- Simpan jam koreksi persis seperti yang dipilih admin (zona waktu WIB).
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
    target_user_id,
    target_date,
    case when new_check_in is null then null else make_timestamptz(
      extract(year from target_date)::integer,
      extract(month from target_date)::integer,
      extract(day from target_date)::integer,
      extract(hour from new_check_in)::integer,
      extract(minute from new_check_in)::integer,
      extract(second from new_check_in),
      'Asia/Jakarta'
    ) end,
    case when new_check_out is null then null else make_timestamptz(
      extract(year from target_date)::integer,
      extract(month from target_date)::integer,
      extract(day from target_date)::integer,
      extract(hour from new_check_out)::integer,
      extract(minute from new_check_out)::integer,
      extract(second from new_check_out),
      'Asia/Jakarta'
    ) end,
    new_status
  )
  on conflict(user_id,date) do update
    set check_in=excluded.check_in, check_out=excluded.check_out, status=excluded.status
  returning * into result;

  insert into public.audit_logs(actor_id,action,target_id,details)
  values(auth.uid(),'correct_attendance',result.id,jsonb_build_object('reason',correction_reason,'user_id',target_user_id,'date',target_date,'status',new_status));
  insert into public.notifications(user_id,title,message)
  values(target_user_id,'Absensi dikoreksi','Data absensi tanggal '||to_char(target_date,'DD-MM-YYYY')||' diperbarui admin. Alasan: '||correction_reason);
  return result;
end$$;

grant execute on function public.correct_attendance(uuid,date,time,time,text,text) to authenticated;
