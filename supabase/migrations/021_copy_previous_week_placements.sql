-- Salin hanya perubahan yang sudah ditinjau, seluruhnya dalam satu transaksi.
begin;
create or replace function public.copy_previous_week_placements(
  week_start date, changes jsonb, only_empty boolean default true
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  item record;
  person public.profiles;
  source_row public.daily_room_placements;
  target_row public.daily_room_placements;
  changed_count integer := 0;
begin
  if not public.is_admin() then raise exception 'Hanya admin aktif yang dapat mengatur penempatan'; end if;
  if week_start is null or not isfinite(week_start) or extract(isodow from week_start) <> 1 then
    raise exception 'Awal minggu harus tanggal Senin';
  end if;
  if only_empty is null or changes is null or jsonb_typeof(changes) <> 'array' then
    raise exception 'Pratinjau tidak valid. Buka ulang pratinjau';
  end if;
  if jsonb_array_length(changes) = 0 then raise exception 'Tidak ada jadwal untuk disalin'; end if;
  if exists (
    select 1 from jsonb_to_recordset(changes) as x(user_id uuid, date date)
    group by user_id, date having count(*) > 1
  ) then raise exception 'Tanggal peserta duplikat'; end if;

  -- Urutan penguncian tetap; RPC editor harian juga mengunci profil ini.
  perform p.id from public.profiles p
    where p.id in (select x.user_id from jsonb_to_recordset(changes) as x(user_id uuid))
    order by p.id for update;

  for item in select * from jsonb_to_recordset(changes) as x(
    user_id uuid, date date, room_code text, expected_version uuid, source_version uuid
  ) order by user_id, date loop
    if item.date is null or item.date < week_start or item.date > week_start + 5 then
      raise exception 'Tanggal tujuan di luar minggu terpilih';
    end if;
    select * into person from public.profiles where id = item.user_id;
    if person.id is null or person.role <> 'intern' or not person.is_active then
      raise exception 'Peserta bukan anak magang aktif. Buka ulang pratinjau';
    end if;
    if (person.internship_start is not null and item.date < person.internship_start)
      or (person.internship_end is not null and item.date > person.internship_end) then
      raise exception 'Masa magang telah berubah. Buka ulang pratinjau';
    end if;
    select * into source_row from public.daily_room_placements
      where user_id = item.user_id and date = item.date - 7 for update;
    if source_row.id is null or source_row.room_code is null
      or source_row.version is distinct from item.source_version
      or source_row.room_code is distinct from item.room_code then
      raise exception 'Jadwal sumber telah berubah. Buka ulang pratinjau';
    end if;
    select * into target_row from public.daily_room_placements
      where user_id = item.user_id and date = item.date for update;
    if target_row.version is distinct from item.expected_version then
      raise exception 'Jadwal tujuan telah berubah. Buka ulang pratinjau';
    end if;
    if only_empty and target_row.room_code is not null then
      raise exception 'Jadwal tujuan sudah terisi. Buka ulang pratinjau';
    end if;
    perform public.save_daily_room_placement(item.user_id, item.date, item.room_code, item.expected_version);
    changed_count := changed_count + 1;
  end loop;
  return changed_count;
end;
$$;
revoke all on function public.copy_previous_week_placements(date, jsonb, boolean) from public, anon;
grant execute on function public.copy_previous_week_placements(date, jsonb, boolean) to authenticated;
commit;
