# Operasional Supabase

## Sebelum deploy

1. Pastikan repository sudah bersih atau seluruh perubahan telah di-commit.
2. Login dan hubungkan CLI dengan project Supabase:

   ```powershell
   supabase login
   supabase link
   ```

3. Periksa perbedaan migration sebelum melakukan perubahan:

   ```powershell
   supabase migration list
   supabase db push --dry-run
   ```

## Backup database

Jalankan dari root project. Simpan file hasil backup di lokasi aman di luar repository.

```powershell
New-Item -ItemType Directory -Force backups
supabase db dump --linked --data-only -f backups/data-backup.sql
supabase db dump --linked -f backups/schema-backup.sql
```

Backup database tidak menyertakan file di Supabase Storage. Unduh juga foto atau berkas penting dari bucket Storage bila diperlukan.

## Deploy database dan Edge Function

Setelah backup berhasil:

```powershell
supabase db push
supabase functions deploy create-intern
supabase functions deploy delete-intern
supabase functions deploy update-intern
supabase functions deploy update-own-profile
```

Uji login admin, tambah anak magang, hapus anak magang, dan scan absensi setelah deploy.

## Pemulihan jika terjadi masalah

1. Hentikan sementara penggunaan aplikasi agar data tidak berubah.
2. Untuk project berbayar, buka **Database → Backups** pada Dashboard Supabase dan pilih backup sebelum masalah terjadi. Pemulihan membuat project tidak dapat diakses sementara.
3. Untuk backup SQL manual, pulihkan hanya ke project/staging kosong terlebih dahulu untuk diverifikasi:

   ```powershell
   psql -d "CONNECTION_STRING_PROJECT_TARGET" -f backups/schema-backup.sql
   psql -d "CONNECTION_STRING_PROJECT_TARGET" -f backups/data-backup.sql
   ```

4. Deploy ulang seluruh Edge Function karena backup database tidak mencakup Edge Function, Auth settings, atau file Storage.

> Jangan menjalankan `supabase db reset --linked` pada production. Perintah tersebut menghapus dan membangun ulang database remote.
