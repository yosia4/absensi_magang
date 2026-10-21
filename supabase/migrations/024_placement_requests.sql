-- Jalankan setelah 023. Pengajuan satu ruangan untuk satu tanggal (Senin-Sabtu).
begin;

create table if not exists public.placement_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  placement_date date not null check (isfinite(placement_date) and extract(isodow from placement_date) between 1 and 6),
  room_code text not null references public.weekly_placement_rooms(code),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'Menunggu' check (status in ('Menunggu','Disetujui','Ditolak','Dibatalkan')),
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'Ditolak' or coalesce(char_length(btrim(review_note)), 0) > 0)
);
create unique index if not exists placement_requests_pending_day
  on public.placement_requests(user_id, placement_date) where status = 'Menunggu';
create index if not exists placement_requests_created on public.placement_requests(created_at desc, id);
create index if not exists placement_requests_own_created on public.placement_requests(user_id, created_at desc, id);
alter table public.placement_requests enable row level security;
drop policy if exists "read placement requests" on public.placement_requests;
create policy "read placement requests" on public.placement_requests for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'intern' and is_active
  )));
revoke all on public.placement_requests from public, anon, authenticated;
grant select on public.placement_requests to authenticated;

create or replace function public.submit_placement_request(
  requested_date date, requested_room text, request_reason text
) returns public.placement_requests
language plpgsql security definer set search_path = public as $$
declare
  person public.profiles;
  result public.placement_requests;
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into person from public.profiles where id = auth.uid() for update;
  if person.id is null or person.role <> 'intern' or not person.is_active
    or person.internship_end < today_wib then
    raise exception 'Hanya anak magang aktif yang dapat mengajukan penempatan';
  end if;
  if requested_date is null or not isfinite(requested_date) or requested_date < today_wib then
    raise exception 'Pilih tanggal hari ini atau setelahnya';
  end if;
  if extract(isodow from requested_date) not between 1 and 6 then
    raise exception 'Penempatan hanya tersedia pada Senin sampai Sabtu';
  end if;
  if (person.internship_start is not null and requested_date < person.internship_start)
    or (person.internship_end is not null and requested_date > person.internship_end) then
    raise exception 'Tanggal penempatan berada di luar masa magang Anda';
  end if;
  requested_room := nullif(btrim(requested_room), '');
  if requested_room is null or not exists(select 1 from public.weekly_placement_rooms where code = requested_room) then
    raise exception 'Pilih ruangan yang tersedia';
  end if;
  request_reason := btrim(request_reason);
  if request_reason is null or char_length(request_reason) not between 1 and 1000 then
    raise exception 'Alasan wajib diisi, maksimal 1000 karakter';
  end if;
  if exists(select 1 from public.placement_requests where user_id = person.id
    and placement_date = requested_date and status = 'Menunggu') then
    raise exception 'Masih ada pengajuan menunggu untuk tanggal ini. Batalkan pengajuan lama sebelum mengajukan kembali';
  end if;
  if exists(select 1 from public.daily_room_placements where user_id = person.id
    and date = requested_date and room_code = requested_room) then
    raise exception 'Anda sudah ditempatkan di ruangan tersebut pada tanggal ini';
  end if;
  insert into public.placement_requests(user_id, placement_date, room_code, reason)
    values(person.id, requested_date, requested_room, request_reason) returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'submit_placement_request', result.id, to_jsonb(result));
  insert into public.notifications(user_id, title, message)
    select id, 'Pengajuan penempatan baru',
      person.name || ' mengajukan ruangan ' || requested_room || ' pada ' || to_char(requested_date, 'DD-MM-YYYY') || '. Tinjau di Penempatan Anak Magang.'
    from public.profiles where role = 'admin' and is_active;
  return result;
end;
$$;

create or replace function public.review_placement_request(
  request_id uuid, decision text, review_reason text default null,
  expected_placement_version uuid default null
) returns public.placement_requests
language plpgsql security definer set search_path = public as $$
declare
  result public.placement_requests;
  participant uuid;
begin
  if public.is_admin() is not true then raise exception 'Hanya admin aktif yang dapat meninjau pengajuan'; end if;
  if decision is null or decision not in ('Disetujui', 'Ditolak') then raise exception 'Keputusan tidak valid'; end if;
  review_reason := nullif(btrim(review_reason), '');
  if decision = 'Ditolak' and review_reason is null then raise exception 'Alasan penolakan wajib diisi'; end if;
  if char_length(review_reason) > 1000 then raise exception 'Catatan maksimal 1000 karakter'; end if;
  select user_id into participant from public.placement_requests where id = request_id;
  if participant is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  -- Urutan kunci sama dengan editor penempatan: profil lebih dahulu.
  perform 1 from public.profiles where id = participant for update;
  select * into result from public.placement_requests where id = request_id for update;
  if result.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if result.status <> 'Menunggu' then raise exception 'Pengajuan sudah diproses atau dibatalkan. Muat ulang daftar'; end if;
  if decision = 'Disetujui' then
    if result.placement_date < (now() at time zone 'Asia/Jakarta')::date then
      raise exception 'Tanggal pengajuan sudah lewat. Tolak pengajuan dan minta peserta memilih tanggal baru';
    end if;
    -- Memeriksa akun, masa magang, serta versi jadwal yang ditinjau admin.
    perform public.save_daily_room_placement(result.user_id, result.placement_date,
      result.room_code, expected_placement_version);
  end if;
  update public.placement_requests set status = decision, review_note = review_reason,
    reviewed_by = auth.uid(), reviewed_at = now() where id = request_id returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'review_placement_request', result.id, to_jsonb(result));
  insert into public.notifications(user_id, title, message)
    values(result.user_id, 'Pengajuan penempatan ' || lower(decision),
      'Pengajuan ruangan ' || result.room_code || ' pada ' || to_char(result.placement_date, 'DD-MM-YYYY') ||
      case when decision = 'Disetujui' then ' disetujui. Jadwal penempatan telah diperbarui.' else ' ditolak.' end ||
      case when review_reason is not null then ' Catatan: ' || review_reason else '' end);
  return result;
end;
$$;

create or replace function public.cancel_placement_request(request_id uuid)
returns public.placement_requests
language plpgsql security definer set search_path = public as $$
declare result public.placement_requests;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'intern' and is_active) then
    raise exception 'Hanya anak magang aktif yang dapat membatalkan pengajuan';
  end if;
  select * into result from public.placement_requests where id = request_id and user_id = auth.uid() for update;
  if result.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if result.status <> 'Menunggu' then raise exception 'Hanya pengajuan menunggu yang dapat dibatalkan'; end if;
  update public.placement_requests set status = 'Dibatalkan' where id = request_id returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'cancel_placement_request', result.id, to_jsonb(result));
  return result;
end;
$$;

revoke all on function public.submit_placement_request(date, text, text) from public, anon;
revoke all on function public.review_placement_request(uuid, text, text, uuid) from public, anon;
revoke all on function public.cancel_placement_request(uuid) from public, anon;
grant execute on function public.submit_placement_request(date, text, text) to authenticated;
grant execute on function public.review_placement_request(uuid, text, text, uuid) to authenticated;
grant execute on function public.cancel_placement_request(uuid) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'placement_requests'
  ) then alter publication supabase_realtime add table public.placement_requests; end if;
end $$;
commit;
