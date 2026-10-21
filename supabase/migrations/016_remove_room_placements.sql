-- Menghapus fitur penempatan, termasuk seluruh data penempatan lama.
-- Aman dijalankan juga jika migrasi 015 belum pernah diterapkan.
begin;

drop function if exists public.save_room_placements(uuid[], text, date, date, text, uuid, timestamptz);
drop function if exists public.cancel_room_placement(uuid, timestamptz);

-- DROP TABLE juga menghapus indeks, kebijakan RLS, dan keanggotaan Realtime.
-- Tanpa CASCADE agar dependensi di luar fitur ini tidak ikut terhapus.
drop table if exists public.room_placements;
drop table if exists public.placement_rooms;

commit;
