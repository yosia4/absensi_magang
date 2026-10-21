-- Penempatan mingguan baru: satu ruangan per peserta per hari (Senin-Sabtu).
-- Jalankan setelah migrasi 016. Tabel baru terpisah dari fitur periode lama.
begin;

create table if not exists public.weekly_placement_rooms (
  code text primary key,
  name text not null,
  sort_order integer not null
);
insert into public.weekly_placement_rooms(code, name, sort_order) values
  ('A','Ruang Informasi / Humas',0), ('B','Ruang Persuratan',1),
  ('C','Drive Thru',2), ('D','Ruang Frontdesk / Keanggotaan',3),
  ('E','Ruang Koleksi Umum',4), ('F','Ruang Koleksi Anak',5),
  ('G','Ruang Bermain',6), ('H','Ruang Mendongeng',7),
  ('I','Ruang Musik Anak',8), ('J','Ruang Koleksi Budaya & Skripsi',9),
  ('K','Ruang Koleksi Referensi',10), ('L','Ruang Koleksi Langka',11),
  ('M','Ruang Koleksi Digital',12), ('N','Ruang Koleksi Braille',13),
  ('O','Ruang Jogja LiteraSpace',14), ('P','Ruang Audio Visual',15),
  ('Q','Ruang Bioskop 6 D',16), ('R','TU Balai Yanpus',17),
  ('S','Perpus Keliling / Ekstensi',18), ('T','Loker Depan Lt. 1',19),
  ('U','Teknologi Informasi (TI)',20), ('V','Ruang Tandon',21),
  ('W','Ruang SIF',22), ('AA','RBM',23), ('AB','JLC',24),
  ('AC','Pengolahan (opsi Surat ke DPAD)',25), ('AD','Pelestarian',26),
  ('X','Jadwal Khusus',27)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists public.daily_room_placements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null check (isfinite(date) and extract(isodow from date) between 1 and 6),
  -- Baris kosong tetap menyimpan versi agar perubahan bersamaan terdeteksi.
  room_code text references public.weekly_placement_rooms(code),
  version uuid not null default gen_random_uuid(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, date)
);
create index if not exists daily_room_placements_date on public.daily_room_placements(date);

alter table public.weekly_placement_rooms enable row level security;
alter table public.daily_room_placements enable row level security;
drop policy if exists "admin read weekly rooms" on public.weekly_placement_rooms;
create policy "admin read weekly rooms" on public.weekly_placement_rooms for select to authenticated using (public.is_admin());
drop policy if exists "admin read daily placements" on public.daily_room_placements;
create policy "admin read daily placements" on public.daily_room_placements for select to authenticated using (public.is_admin());
revoke all on public.weekly_placement_rooms, public.daily_room_placements from public, anon, authenticated;
grant select on public.weekly_placement_rooms, public.daily_room_placements to authenticated;

create or replace function public.save_daily_room_placement(
  participant_id uuid, placement_date date, selected_room text,
  expected_version uuid default null
) returns public.daily_room_placements
language plpgsql security definer set search_path = public as $$
declare
  person public.profiles;
  previous public.daily_room_placements;
  result public.daily_room_placements;
begin
  if not public.is_admin() then raise exception 'Hanya admin aktif yang dapat mengatur penempatan'; end if;
  if placement_date is null or not isfinite(placement_date) or extract(isodow from placement_date) not between 1 and 6 then
    raise exception 'Penempatan hanya tersedia pada Senin sampai Sabtu';
  end if;
  -- Mengunci profil juga melindungi sel yang belum memiliki baris dari dua admin.
  select * into person from public.profiles where id = participant_id for update;
  if person.id is null or person.role <> 'intern' or not person.is_active then
    raise exception 'Peserta bukan anak magang aktif. Muat ulang daftar peserta';
  end if;
  if (person.internship_start is not null and placement_date < person.internship_start)
    or (person.internship_end is not null and placement_date > person.internship_end) then
    raise exception 'Tanggal penempatan berada di luar masa magang peserta';
  end if;
  selected_room := nullif(btrim(selected_room), '');
  if selected_room is not null and not exists(select 1 from public.weekly_placement_rooms where code = selected_room) then
    raise exception 'Ruangan tidak ditemukan';
  end if;
  select * into previous from public.daily_room_placements
    where user_id = participant_id and date = placement_date for update;
  if previous.version is distinct from expected_version then
    raise exception 'Isian telah diubah oleh admin lain. Data dimuat ulang; silakan pilih kembali';
  end if;
  if previous.id is not null and previous.room_code is not distinct from selected_room then return previous; end if;
  insert into public.daily_room_placements(user_id, date, room_code, updated_by)
    values(participant_id, placement_date, selected_room, auth.uid())
    on conflict (user_id, date) do update set room_code = excluded.room_code,
      version = gen_random_uuid(), updated_by = excluded.updated_by, updated_at = clock_timestamp()
    returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'save_daily_room_placement', result.id,
      jsonb_build_object('previous', case when previous.id is null then null else to_jsonb(previous) end, 'placement', to_jsonb(result)));
  return result;
end;
$$;
revoke all on function public.save_daily_room_placement(uuid, date, text, uuid) from public, anon;
grant execute on function public.save_daily_room_placement(uuid, date, text, uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_room_placements'
  ) then
    alter publication supabase_realtime add table public.daily_room_placements;
  end if;
end $$;
commit;
