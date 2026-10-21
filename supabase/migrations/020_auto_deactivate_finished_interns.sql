-- Nonaktif otomatis setelah tanggal selesai magang terlewati (WIB).
-- Memerlukan pg_cron, sama seperti migrasi pengingat 007.
begin;
create extension if not exists pg_cron with schema extensions;
create index if not exists profiles_active_internship_end
  on public.profiles(internship_end) where role = 'intern' and is_active;

create or replace function public.enforce_internship_end_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role = 'intern' and new.internship_end < (now() at time zone 'Asia/Jakarta')::date then
    new.is_active := false;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_internship_end_status() from public, anon, authenticated;
drop trigger if exists enforce_internship_end_status on public.profiles;
create trigger enforce_internship_end_status
  before insert or update of role, internship_end, is_active on public.profiles
  for each row execute function public.enforce_internship_end_status();

create or replace function public.audit_internship_auto_deactivation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'intern' and not new.is_active
    and new.internship_end < (now() at time zone 'Asia/Jakarta')::date then
    if tg_op = 'INSERT' or old.is_active then
      insert into public.audit_logs(actor_id, action, target_id, details)
        values(null, 'auto_deactivate_finished_intern', new.id,
          jsonb_build_object('internship_end', new.internship_end,
            'effective_date', (now() at time zone 'Asia/Jakarta')::date,
            'reason', 'Masa magang telah selesai'));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.audit_internship_auto_deactivation() from public, anon, authenticated;
drop trigger if exists audit_internship_auto_deactivation on public.profiles;
create trigger audit_internship_auto_deactivation
  after insert or update of role, internship_end, is_active on public.profiles
  for each row execute function public.audit_internship_auto_deactivation();

create or replace function public.deactivate_finished_interns()
returns integer language plpgsql security definer set search_path = public as $$
declare changed_count integer;
begin
  update public.profiles set is_active = false
    where role = 'intern' and is_active
      and internship_end < (now() at time zone 'Asia/Jakarta')::date;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;
-- Hanya pemilik fungsi / scheduler database, bukan pemanggilan dari browser.
revoke all on function public.deactivate_finished_interns() from public, anon, authenticated;

-- Langsung bersihkan akun yang sudah selesai saat migrasi diterapkan.
select public.deactivate_finished_interns();

-- Nama job tetap membuat penjadwalan ulang idempoten.
select cron.schedule('auto-deactivate-finished-interns', '* * * * *',
  'select public.deactivate_finished_interns();');

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
commit;
