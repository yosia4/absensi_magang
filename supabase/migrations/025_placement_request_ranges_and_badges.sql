-- Jalankan setelah 024. Data pengajuan lama tetap menjadi rentang satu hari.
begin;
alter table public.placement_requests add column if not exists date_to date;
alter table public.placement_requests add column if not exists reply_read_at timestamptz;
update public.placement_requests set date_to = placement_date where date_to is null;
alter table public.placement_requests alter column date_to set not null;
-- placement_date tetap menjadi tanggal mulai agar data dan klien lama terbaca.
alter table public.placement_requests drop constraint if exists placement_requests_placement_date_check;
alter table public.placement_requests drop constraint if exists placement_requests_date_range_check;
alter table public.placement_requests add constraint placement_requests_date_range_check
  check (isfinite(placement_date) and isfinite(date_to) and date_to >= placement_date and date_to - placement_date < 366);
create index if not exists placement_requests_unread_replies
  on public.placement_requests(user_id) where status in ('Disetujui','Ditolak') and reply_read_at is null;

create or replace function public.submit_placement_request_range(
  requested_start date, requested_end date, requested_room text, request_reason text
) returns public.placement_requests
language plpgsql security definer set search_path = public as $$
declare
  person public.profiles;
  result public.placement_requests;
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into person from public.profiles where id = auth.uid() for update;
  if person.id is null or person.role <> 'intern' or not person.is_active or person.internship_end < today_wib then
    raise exception 'Hanya anak magang aktif yang dapat mengajukan penempatan';
  end if;
  if requested_start is null or requested_end is null or not isfinite(requested_start) or not isfinite(requested_end)
    or requested_start < today_wib or requested_end < requested_start then
    raise exception 'Pilih rentang mulai hari ini atau setelahnya; tanggal selesai tidak boleh sebelum tanggal mulai';
  end if;
  if requested_end - requested_start >= 366 then raise exception 'Rentang pengajuan maksimal 366 hari'; end if;
  if not exists(select 1 from generate_series(0, requested_end - requested_start) n
    where extract(isodow from requested_start + n) between 1 and 6) then
    raise exception 'Rentang harus memuat hari Senin sampai Sabtu. Hari Minggu dilewati';
  end if;
  if (person.internship_start is not null and requested_start < person.internship_start)
    or (person.internship_end is not null and requested_end > person.internship_end) then
    raise exception 'Rentang penempatan berada di luar masa magang Anda';
  end if;
  requested_room := nullif(btrim(requested_room), '');
  if requested_room is null or not exists(select 1 from public.weekly_placement_rooms where code = requested_room) then
    raise exception 'Pilih ruangan yang tersedia';
  end if;
  request_reason := btrim(request_reason);
  if request_reason is null or char_length(request_reason) not between 1 and 1000 then
    raise exception 'Alasan wajib diisi, maksimal 1000 karakter';
  end if;
  -- Kunci profil menserialisasi pengajuan yang beririsan dari tab berbeda.
  if exists(select 1 from public.placement_requests r
    where r.user_id = person.id and r.status = 'Menunggu'
      and r.placement_date <= requested_end and r.date_to >= requested_start
      and exists(select 1 from generate_series(0, least(r.date_to, requested_end) - greatest(r.placement_date, requested_start)) n
        where extract(isodow from greatest(r.placement_date, requested_start) + n) between 1 and 6)) then
    raise exception 'Masih ada pengajuan menunggu pada rentang ini. Batalkan pengajuan lama sebelum mengajukan kembali';
  end if;
  if not exists(select 1 from generate_series(0, requested_end - requested_start) n
    where extract(isodow from requested_start + n) between 1 and 6
      and not exists(select 1 from public.daily_room_placements p where p.user_id = person.id
        and p.date = requested_start + n and p.room_code = requested_room)) then
    raise exception 'Seluruh hari pada rentang ini sudah ditempatkan di ruangan tersebut';
  end if;
  insert into public.placement_requests(user_id, placement_date, date_to, room_code, reason)
    values(person.id, requested_start, requested_end, requested_room, request_reason) returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'submit_placement_request', result.id, to_jsonb(result));
  insert into public.notifications(user_id, title, message)
    select id, 'Pengajuan penempatan baru', person.name || ' mengajukan ruangan ' || requested_room || ' pada ' ||
      to_char(requested_start, 'DD-MM-YYYY') || ' sampai ' || to_char(requested_end, 'DD-MM-YYYY') || '. Tinjau di Penempatan Anak Magang.'
    from public.profiles where role = 'admin' and is_active;
  return result;
end;
$$;

create or replace function public.review_placement_request_range(
  request_id uuid, decision text, review_reason text default null, expected_versions jsonb default null
) returns public.placement_requests
language plpgsql security definer set search_path = public as $$
declare
  result public.placement_requests;
  participant uuid;
  scheduled_day date;
  days date[];
begin
  if public.is_admin() is not true then raise exception 'Hanya admin aktif yang dapat meninjau pengajuan'; end if;
  if decision is null or decision not in ('Disetujui', 'Ditolak') then raise exception 'Keputusan tidak valid'; end if;
  review_reason := nullif(btrim(review_reason), '');
  if decision = 'Ditolak' and review_reason is null then raise exception 'Alasan penolakan wajib diisi'; end if;
  if char_length(review_reason) > 1000 then raise exception 'Catatan maksimal 1000 karakter'; end if;
  select user_id into participant from public.placement_requests where id = request_id;
  if participant is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  perform 1 from public.profiles where id = participant for update;
  select * into result from public.placement_requests where id = request_id for update;
  if result.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if result.status <> 'Menunggu' then raise exception 'Pengajuan sudah diproses atau dibatalkan. Muat ulang daftar'; end if;
  if decision = 'Disetujui' then
    if result.placement_date < (now() at time zone 'Asia/Jakarta')::date then
      raise exception 'Tanggal mulai pengajuan sudah lewat. Tolak dan minta peserta memilih rentang baru';
    end if;
    select array_agg(result.placement_date + n order by n) into days
      from generate_series(0, result.date_to - result.placement_date) n
      where extract(isodow from result.placement_date + n) between 1 and 6;
    if coalesce(cardinality(days), 0) = 0 then raise exception 'Tidak ada hari penempatan dalam rentang ini'; end if;
    if expected_versions is null or jsonb_typeof(expected_versions) <> 'object' then
      raise exception 'Pratinjau jadwal tidak valid. Muat ulang jadwal';
    end if;
    if (select count(*) from jsonb_object_keys(expected_versions)) <> cardinality(days)
      or exists(select 1 from unnest(days) d where not expected_versions ? to_char(d, 'YYYY-MM-DD')) then
      raise exception 'Pratinjau belum mencakup seluruh rentang. Muat ulang jadwal';
    end if;
    -- Satu transaksi: konflik pada hari terakhir membatalkan seluruh rentang.
    foreach scheduled_day in array days loop
      perform public.save_daily_room_placement(result.user_id, scheduled_day, result.room_code,
        (expected_versions ->> to_char(scheduled_day, 'YYYY-MM-DD'))::uuid);
    end loop;
  end if;
  update public.placement_requests set status = decision, review_note = review_reason,
    reviewed_by = auth.uid(), reviewed_at = now(), reply_read_at = null where id = request_id returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'review_placement_request', result.id, to_jsonb(result));
  insert into public.notifications(user_id, title, message)
    values(result.user_id, 'Pengajuan penempatan ' || lower(decision),
      'Pengajuan ruangan ' || result.room_code || ' pada ' || to_char(result.placement_date, 'DD-MM-YYYY') ||
      ' sampai ' || to_char(result.date_to, 'DD-MM-YYYY') ||
      case when decision = 'Disetujui' then ' disetujui. Jadwal Senin–Sabtu langsung diperbarui; Minggu dilewati.' else ' ditolak.' end ||
      case when review_reason is not null then ' Catatan: ' || review_reason else '' end);
  return result;
end;
$$;

-- Klien lama tetap dapat mengajukan satu hari, tetapi tidak boleh menerapkan
-- hanya sebagian hari dari pengajuan rentang melalui RPC lama.
create or replace function public.submit_placement_request(requested_date date, requested_room text, request_reason text)
returns public.placement_requests language plpgsql security definer set search_path = public as $$
begin return public.submit_placement_request_range(requested_date, requested_date, requested_room, request_reason); end;
$$;
create or replace function public.review_placement_request(
  request_id uuid, decision text, review_reason text default null, expected_placement_version uuid default null
) returns public.placement_requests language plpgsql security definer set search_path = public as $$
declare r public.placement_requests;
begin
  if public.is_admin() is not true then raise exception 'Hanya admin aktif yang dapat meninjau pengajuan'; end if;
  select * into r from public.placement_requests where id = request_id;
  if r.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if r.date_to <> r.placement_date then raise exception 'Muat ulang aplikasi untuk meninjau pengajuan rentang tanggal'; end if;
  return public.review_placement_request_range(request_id, decision, review_reason,
    jsonb_build_object(to_char(r.placement_date, 'YYYY-MM-DD'), expected_placement_version));
end;
$$;

create or replace function public.mark_placement_replies_read(request_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'intern' and is_active) then
    raise exception 'Hanya peserta aktif yang dapat membaca balasan sendiri';
  end if;
  if request_ids is null or cardinality(request_ids) > 100 then raise exception 'Daftar balasan tidak valid'; end if;
  update public.placement_requests set reply_read_at = now()
    where id = any(request_ids) and user_id = auth.uid() and status in ('Disetujui','Ditolak') and reply_read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.submit_placement_request_range(date, date, text, text) from public, anon;
revoke all on function public.review_placement_request_range(uuid, text, text, jsonb) from public, anon;
revoke all on function public.mark_placement_replies_read(uuid[]) from public, anon;
grant execute on function public.submit_placement_request_range(date, date, text, text) to authenticated;
grant execute on function public.review_placement_request_range(uuid, text, text, jsonb) to authenticated;
grant execute on function public.mark_placement_replies_read(uuid[]) to authenticated;
commit;
