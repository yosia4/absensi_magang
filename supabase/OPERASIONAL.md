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

## Koreksi salah scan pulang

Jalankan `supabase/migrations/013_clear_attendance_checkout.sql` pada database yang sudah digunakan. Migrasi menambahkan RPC khusus pembimbing aktif untuk mengosongkan jam pulang, tanpa mengubah jam masuk atau status. Tidak ada data absensi yang diubah saat migrasi dijalankan. Struktur RPC ini juga tercantum pada `schema.sql` untuk instalasi baru.

Di **Kelola Pengajuan → Koreksi absensi**, pilih **Hapus absen pulang (salah scan dua kali)**, pilih peserta/tanggal, periksa catatan, isi alasan, dan konfirmasi. Operasi menolak data yang jam pulangnya berubah sejak dimuat. Riwayat audit menyimpan jam pulang sebelum penghapusan dan alasannya; peserta menerima notifikasi. Periksa bahwa peserta berstatus Hadir/Terlambat kembali dapat scan pulang setelah koreksi. Fitur ini memperbaiki catatan salah scan; alur scan otomatis masuk/pulang tetap mengikuti implementasi sebelumnya.

Uji regresi lokal: `node --test tests/*.test.js`. Uji RPC pada PostgreSQL sementara: `node tests/clearCheckout.database.mjs`, dengan paket pengujian opsional `@electric-sql/pglite` tersedia (atau `PGLITE_MODULE` menunjuk URL modul yang dipasang terpisah). Uji tersebut tidak mengakses Supabase dan mencakup hak akses, penjagaan jam masuk/status, konfirmasi yang sudah kedaluwarsa, audit/notifikasi, dan rollback transaksi jika pencatatan gagal.

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
