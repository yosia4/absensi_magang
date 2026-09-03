-- Foto lama sudah ada di Storage pada path {user_id}/profile, tetapi pada
-- beberapa profil path-nya belum tersimpan. Lengkapi tanpa menimpa data yang ada.
update public.profiles as profile
set photo_url = object.name
from storage.objects as object
where object.bucket_id = 'profile-photos'
  and object.name = profile.id::text || '/profile'
  and coalesce(profile.photo_url, '') = '';
