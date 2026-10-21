-- Pengisian banyak peserta dari pratinjau; gagal satu sel membatalkan seluruh batch.
begin;
create or replace function public.bulk_place_interns(
  week_start date, changes jsonb, only_empty boolean default true
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  item record;
  target_row public.daily_room_placements;
  changed_count integer := 0;
begin
  if public.is_admin() is not true then raise exception 'Hanya admin aktif yang dapat mengatur penempatan'; end if;
  if week_start is null or not isfinite(week_start) or extract(isodow from week_start) <> 1 then
    raise exception 'Awal minggu harus tanggal Senin';
  end if;
  if only_empty is null or changes is null or jsonb_typeof(changes) <> 'array' then
    raise exception 'Pratinjau tidak valid. Buka ulang pratinjau';
  end if;
  if jsonb_array_length(changes) = 0 then raise exception 'Tidak ada penempatan untuk disimpan'; end if;
  if exists (
    select 1 from jsonb_to_recordset(changes) as x(user_id uuid, date date)
    group by user_id, date having count(*) > 1
  ) then raise exception 'Tanggal peserta duplikat'; end if;
  -- Urutan tetap dan kunci yang sama dengan editor harian serta salin minggu.
  perform p.id from public.profiles p
    where p.id in (select x.user_id from jsonb_to_recordset(changes) as x(user_id uuid))
    order by p.id for update;
  for item in select * from jsonb_to_recordset(changes) as x(
    user_id uuid, date date, room_code text, expected_version uuid
  ) order by user_id, date loop
    if item.date is null or item.date < week_start or item.date > week_start + 5 then
      raise exception 'Tanggal tujuan di luar minggu terpilih';
    end if;
    item.room_code := nullif(btrim(item.room_code), '');
    if item.room_code is null then raise exception 'Pilih ruangan yang tersedia'; end if;
    select * into target_row from public.daily_room_placements
      where user_id = item.user_id and date = item.date for update;
    if target_row.version is distinct from item.expected_version then
      raise exception 'Jadwal tujuan telah berubah. Buka ulang pratinjau';
    end if;
    if only_empty and target_row.room_code is not null then
      raise exception 'Jadwal tujuan sudah terisi. Buka ulang pratinjau';
    end if;
    -- RPC harian memeriksa peserta aktif, masa magang, ruangan, versi, dan audit.
    perform public.save_daily_room_placement(item.user_id, item.date, item.room_code, item.expected_version);
    if target_row.room_code is distinct from item.room_code then changed_count := changed_count + 1; end if;
  end loop;
  return changed_count;
end;
$$;
revoke all on function public.bulk_place_interns(date, jsonb, boolean) from public, anon;
grant execute on function public.bulk_place_interns(date, jsonb, boolean) to authenticated;
commit;
