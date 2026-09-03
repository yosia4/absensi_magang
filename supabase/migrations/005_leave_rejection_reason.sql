-- Alasan penolakan diisi pembimbing dan dapat dibaca oleh pemohon.
alter table public.leave_requests
  add column if not exists rejection_reason text;

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
  if decision='Disetujui' then
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

grant execute on function public.review_leave_request(uuid,text,text) to authenticated;
