-- Memungkinkan admin menghapus akun anak magang yang memiliki riwayat absensi.
-- Attendance ikut dihapus bersama profile; audit tetap tersimpan tanpa actor_id.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where ns.nspname = 'public'
      and rel.relname = 'attendance'
      and con.contype = 'f'
      and att.attname = 'user_id'
  loop
    execute format('alter table public.attendance drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.attendance
  add constraint attendance_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where ns.nspname = 'public'
      and rel.relname = 'audit_logs'
      and con.contype = 'f'
      and att.attname = 'actor_id'
  loop
    execute format('alter table public.audit_logs drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.audit_logs
  add constraint audit_logs_actor_id_profiles_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
