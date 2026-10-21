-- Jalankan setelah migrasi 018. Isi satu minggu dalam satu transaksi.
begin;
create or replace function public.fill_week_room_placements(
  participant_id uuid, week_start date, selected_room text, expected_versions jsonb
) returns setof public.daily_room_placements
language plpgsql security definer set search_path = public as $$
declare
  person public.profiles;
  scheduled_day date;
  available_days date[];
  result public.daily_room_placements;
begin
  if not public.is_admin() then raise exception 'Hanya admin aktif yang dapat mengatur penempatan'; end if;
  if week_start is null or not isfinite(week_start) or extract(isodow from week_start) <> 1 then
    raise exception 'Awal minggu harus tanggal Senin';
  end if;
  selected_room := nullif(btrim(selected_room), '');
  if selected_room is null or not exists(select 1 from public.weekly_placement_rooms where code = selected_room) then
    raise exception 'Pilih ruangan yang tersedia';
  end if;
  if expected_versions is null or jsonb_typeof(expected_versions) <> 'object' then
    raise exception 'Versi jadwal tidak valid. Muat ulang data';
  end if;
  select * into person from public.profiles where id = participant_id for update;
  if person.id is null or person.role <> 'intern' or not person.is_active then
    raise exception 'Peserta bukan anak magang aktif. Muat ulang daftar peserta';
  end if;
  select array_agg(week_start + n order by n) into available_days
    from generate_series(0, 5) n
    where (person.internship_start is null or week_start + n >= person.internship_start)
      and (person.internship_end is null or week_start + n <= person.internship_end);
  if coalesce(cardinality(available_days), 0) = 0 then
    raise exception 'Tidak ada hari tersedia pada minggu ini';
  end if;
  if (select count(*) from jsonb_object_keys(expected_versions)) <> cardinality(available_days)
    or exists(select 1 from unnest(available_days) d where not expected_versions ? to_char(d, 'YYYY-MM-DD')) then
    raise exception 'Masa magang telah berubah. Muat ulang data sebelum mengisi satu minggu';
  end if;
  foreach scheduled_day in array available_days loop
    select * into result from public.save_daily_room_placement(
      participant_id, scheduled_day, selected_room,
      (expected_versions ->> to_char(scheduled_day, 'YYYY-MM-DD'))::uuid
    );
    return next result;
  end loop;
  -- Konflik pada salah satu hari membatalkan seluruh perubahan dan audit.
end;
$$;
revoke all on function public.fill_week_room_placements(uuid, date, text, jsonb) from public, anon;
grant execute on function public.fill_week_room_placements(uuid, date, text, jsonb) to authenticated;
commit;
