-- Jalankan setelah migrasi 017 agar peserta dapat melihat penempatan sendiri.
begin;

drop policy if exists "intern read placement rooms" on public.weekly_placement_rooms;
create policy "intern read placement rooms" on public.weekly_placement_rooms
  for select to authenticated using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'intern' and p.is_active)
  );

drop policy if exists "intern read own daily placements" on public.daily_room_placements;
create policy "intern read own daily placements" on public.daily_room_placements
  for select to authenticated using (
    user_id = auth.uid() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'intern' and p.is_active
    )
  );

-- Hak tulis tetap melalui RPC admin pada migrasi 017.
commit;
