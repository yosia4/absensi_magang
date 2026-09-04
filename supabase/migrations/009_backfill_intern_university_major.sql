-- Melengkapi profile anak magang yang dibuat ketika trigger lama belum
-- menyimpan university dan major dari metadata akun Auth.

update public.profiles as profile
set
  university = coalesce(
    nullif(profile.university, ''),
    nullif(auth_user.raw_user_meta_data ->> 'university', '')
  ),
  major = coalesce(
    nullif(profile.major, ''),
    nullif(auth_user.raw_user_meta_data ->> 'major', '')
  )
from auth.users as auth_user
where auth_user.id = profile.id
  and profile.role = 'intern'
  and (
    nullif(profile.university, '') is null
    or nullif(profile.major, '') is null
  );
