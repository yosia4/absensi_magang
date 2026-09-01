-- Run this in the Supabase SQL editor. The RPC protects QR validation and timestamps.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null, email text, role text not null check (role in ('admin','intern')) default 'intern',
  photo_url text, department text, internship_start date, internship_end date,
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.qr_sessions (
 id uuid primary key default gen_random_uuid(), token text not null unique, expires_at timestamptz not null,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.qr_sessions add column if not exists latitude double precision;
alter table public.qr_sessions add column if not exists longitude double precision;
alter table public.qr_sessions add column if not exists radius_m integer not null default 150 check (radius_m between 25 and 1000);
alter table public.qr_sessions add column if not exists is_static boolean not null default false;
alter table public.qr_sessions add column if not exists label text;
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 date date not null default current_date, check_in timestamptz, check_out timestamptz,
 status text not null default 'Hadir', created_at timestamptz not null default now(), unique(user_id,date)
);
alter table public.profiles enable row level security; alter table public.qr_sessions enable row level security; alter table public.attendance enable row level security;
-- SECURITY DEFINER avoids recursive RLS checks when resolving the current user's role.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true);
$$;
-- Create the intern profile at the same time an Authentication user is created.
-- This prevents an account from being created without a matching login profile.
create or replace function public.handle_new_intern() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, name, email, role, department, internship_start, internship_end, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'intern',
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'internship_start', '')::date,
    nullif(new.raw_user_meta_data->>'internship_end', '')::date,
    true
  )
  on conflict (id) do update set
    name = excluded.name, email = excluded.email, department = excluded.department,
    internship_start = excluded.internship_start, internship_end = excluded.internship_end;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_intern();
drop policy if exists "own profile" on public.profiles;
drop policy if exists "admin create profile" on public.profiles;
drop policy if exists "admin update profile" on public.profiles;
drop policy if exists "admin delete profile" on public.profiles;
drop policy if exists "own attendance" on public.attendance;
drop policy if exists "admin qr management" on public.qr_sessions;
create policy "own profile" on public.profiles for select using (auth.uid()=id or public.is_admin());
create policy "admin create profile" on public.profiles for insert with check (public.is_admin());
create policy "admin update profile" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete profile" on public.profiles for delete using (public.is_admin());
create policy "own attendance" on public.attendance for select using (auth.uid()=user_id or public.is_admin());
create policy "admin qr management" on public.qr_sessions for all using (public.is_admin()) with check (public.is_admin());
drop function if exists public.scan_attendance(text);
create or replace function public.scan_attendance(qr_token text, scan_latitude double precision, scan_longitude double precision) returns public.attendance language plpgsql security definer set search_path=public as $$
declare a public.attendance; session_record public.qr_sessions; attendance_day date := (now() at time zone 'Asia/Jakarta')::date; distance_m double precision; begin
 select * into session_record from qr_sessions where token=qr_token and is_active and expires_at>now();
 if session_record.id is null then raise exception 'QR Code tidak valid atau sudah kedaluwarsa'; end if;
 if session_record.latitude is null or session_record.longitude is null then raise exception 'QR ini tidak memiliki lokasi gedung yang valid'; end if;
 if scan_latitude is null or scan_longitude is null then raise exception 'Lokasi GPS diperlukan untuk absensi'; end if;
 distance_m := 6371000 * acos(least(1.0, greatest(-1.0, cos(radians(session_record.latitude)) * cos(radians(scan_latitude)) * cos(radians(scan_longitude) - radians(session_record.longitude)) + sin(radians(session_record.latitude)) * sin(radians(scan_latitude)))));
 if distance_m > session_record.radius_m then raise exception 'Anda berada di luar area absensi gedung (jarak % meter)', round(distance_m); end if;
 select * into a from attendance where user_id=auth.uid() and date=attendance_day for update;
 if a.id is null then insert into attendance(user_id,date,check_in,status) values(auth.uid(),attendance_day,now(),case when (now() at time zone 'Asia/Jakarta')::time > time '08:00' then 'Terlambat' else 'Hadir' end) returning * into a;
 elsif a.check_out is null then update attendance set check_out=now() where id=a.id returning * into a;
 else raise exception 'Absensi hari ini sudah selesai'; end if; return a; end; $$;
grant execute on function public.scan_attendance(text, double precision, double precision) to authenticated;

-- Enable live dashboard updates (safe to run more than once).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='attendance') then
    alter publication supabase_realtime add table public.attendance;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
