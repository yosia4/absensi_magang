-- Jalankan SETELAH migration 003. Mengganti kolom "department" (divisi) anak magang
-- menjadi "university", dan menambahkan kolom baru "major" (jurusan).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'department')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'university') then
    alter table public.profiles rename column department to university;
  end if;
end $$;
alter table public.profiles add column if not exists university text;
alter table public.profiles add column if not exists major text;

create or replace function public.handle_new_intern() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, name, email, role, university, major, internship_start, internship_end, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'intern',
    nullif(new.raw_user_meta_data->>'university', ''),
    nullif(new.raw_user_meta_data->>'major', ''),
    nullif(new.raw_user_meta_data->>'internship_start', '')::date,
    nullif(new.raw_user_meta_data->>'internship_end', '')::date,
    true
  )
  on conflict (id) do update set
    name = excluded.name, email = excluded.email, university = excluded.university, major = excluded.major,
    internship_start = excluded.internship_start, internship_end = excluded.internship_end;
  return new;
end;
$$;
