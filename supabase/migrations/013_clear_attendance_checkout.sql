-- Koreksi khusus salah scan: kosongkan jam pulang tanpa mengubah jam masuk/status.
create or replace function public.clear_attendance_checkout(
  target_user_id uuid,
  target_date date,
  expected_check_out timestamptz,
  correction_reason text
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  existing public.attendance;
  result public.attendance;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus absen pulang';
  end if;
  if correction_reason is null or length(btrim(correction_reason)) < 5 then
    raise exception 'Alasan koreksi minimal 5 karakter';
  end if;
  if target_user_id is null or target_date is null then
    raise exception 'Pilih peserta dan tanggal absensi';
  end if;
  select * into existing from public.attendance
    where user_id = target_user_id and date = target_date for update;
  if existing.id is null then
    raise exception 'Absensi pada tanggal ini belum tercatat';
  end if;
  if existing.check_in is null then
    raise exception 'Jam masuk belum tercatat. Gunakan koreksi jam/status untuk meninjau absensi ini';
  end if;
  if existing.check_out is null then
    raise exception 'Jam pulang sudah kosong. Tidak ada yang perlu dihapus';
  end if;
  if expected_check_out is null or existing.check_out is distinct from expected_check_out then
    raise exception 'Jam pulang sudah berubah. Muat ulang dan periksa kembali sebelum menghapus';
  end if;
  update public.attendance set check_out = null where id = existing.id
    returning * into result;
  insert into public.audit_logs(actor_id, action, target_id, details)
    values(auth.uid(), 'clear_attendance_checkout', result.id, jsonb_build_object(
      'reason', btrim(correction_reason), 'user_id', target_user_id, 'date', target_date,
      'previous_check_out', existing.check_out, 'check_in', result.check_in, 'status', result.status
    ));
  insert into public.notifications(user_id, title, message)
    values(target_user_id, 'Absen pulang dikoreksi',
      'Jam pulang tanggal ' || to_char(target_date, 'DD-MM-YYYY') ||
      ' dihapus oleh pembimbing. Jam masuk dan status tetap tersimpan. Alasan: ' || btrim(correction_reason));
  return result;
end;
$$;
revoke all on function public.clear_attendance_checkout(uuid, date, timestamptz, text) from public, anon;
grant execute on function public.clear_attendance_checkout(uuid, date, timestamptz, text) to authenticated;
