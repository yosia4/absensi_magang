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

## Dua tombol absen masuk dan pulang

Sebelum merilis antarmuka dua tombol absensi, jalankan `supabase/migrations/014_explicit_attendance_scan.sql`. Migrasi menambahkan RPC dengan `scan_action` dan `scan_date` wajib. RPC tiga parameter lama berhenti melakukan perubahan dan meminta pengguna memuat ulang aplikasi; rilis frontend baru segera setelah migrasi agar pengguna dapat melanjutkan scan. QR yang sudah ada tetap dapat digunakan. Migrasi tidak mengubah catatan absensi atau fitur koreksi jam pulang.

Uji dengan akun peserta: masuk sekali, ulangi permintaan masuk dan pastikan jam pulang tetap kosong, konfirmasi pulang dan scan, lalu pastikan kedua tombol terkunci. Periksa juga Izin/Sakit/Alpa, tanggal berganti, dan koreksi hapus jam pulang. Uji lokal aturan tombol: `node --test tests/*.test.js`. Uji PostgreSQL sementara: `node tests/explicitScan.database.mjs`, dengan PGlite opsional atau `PGLITE_MODULE` seperti uji koreksi. Kamera/GPS perangkat dan integrasi Supabase tetap perlu diuji pada lingkungan tujuan.

## Penghapusan fitur penempatan anak magang

Fitur penempatan telah dihapus dari aplikasi: menu admin/peserta, kartu jadwal, pengajuan ruangan, dan badge penempatan sudah tidak tersedia. Rilis frontend terbaru dan jalankan `supabase/migrations/026_retire_intern_placements.sql` pada database yang sudah digunakan. Migrasi menonaktifkan akses tabel dan seluruh RPC penempatan untuk `PUBLIC`, `anon`, dan `authenticated`, serta mengeluarkan tabel penempatan dari Realtime agar klien lama tidak lagi dapat menggunakan fitur ini.

Data penempatan lama tetap tersimpan sebagai arsip yang dapat diakses administrator database. Data peserta, absensi, izin/sakit, notifikasi lama, dan audit tidak dihapus. Migrasi aman dijalankan ulang, termasuk jika fitur penempatan belum pernah dipasang. Jangan menjalankan ulang migrasi penempatan lama setelah 026 karena dapat membuka kembali akses. `schema.sql` untuk instalasi baru tidak lagi membuat fitur penempatan.

Validasi lokal: `node --test tests/*.test.js`, `npm.cmd run build`, dan `node tests/retiredPlacements.database.mjs` dengan PGlite opsional (`PGLITE_MODULE`). Uji database memakai PostgreSQL sementara tanpa mengakses Supabase online.

## Penonaktifan otomatis setelah magang selesai

Jalankan `020_auto_deactivate_finished_interns.sql` setelah migrasi sebelumnya. Tanggal selesai bersifat inklusif dalam WIB: peserta dengan tanggal selesai 25 September tetap aktif sepanjang 25 September, lalu memenuhi syarat nonaktif mulai 26 September pukul 00.00 WIB. Job `auto-deactivate-finished-interns` berjalan setiap menit melalui `pg_cron`, tanpa perlu aplikasi terbuka. Migrasi langsung menonaktifkan peserta yang sudah melewati tanggal selesai. Akun admin serta peserta tanpa tanggal selesai tidak diubah.

Trigger juga langsung menonaktifkan profil baru atau profil yang diedit dengan tanggal selesai di masa lalu. Akun yang sudah selesai tidak bisa diaktifkan kembali sebelum tanggal selesai diperbarui. Memperpanjang tanggal tidak otomatis mengaktifkan akun: admin tetap memilih aktivasi secara manual. Perubahan status dicatat di `audit_logs`; data peserta, absensi, dan penempatan tidak dihapus. Frontend menolak login akun nonaktif/kedaluwarsa serta memeriksa sesi peserta lewat Realtime, fokus tab, dan setiap 30 detik. Mode demo menerapkan aturan tanggal yang sama melalui penyimpanan browser.

Pastikan job aktif melalui `select jobname, schedule, active from cron.job where jobname = 'auto-deactivate-finished-interns';`. Riwayat eksekusi dapat diperiksa pada `cron.job_run_details`. Setelah migrasi, uji satu peserta dengan tanggal selesai kemarin dan satu peserta dengan tanggal selesai hari ini; hanya peserta pertama yang otomatis nonaktif. Penjadwal tidak bergantung pada pengaturan hari kerja absensi.

Uji lokal: `node tests/internAutoDeactivation.database.mjs` dengan PGlite opsional atau `PGLITE_MODULE`. Pengujian menjalankan trigger dan SQL penonaktifan pada PostgreSQL sementara; registrasi job menggunakan tiruan `pg_cron`, sehingga proses penjadwalan nyata tetap perlu diperiksa di Supabase.

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
