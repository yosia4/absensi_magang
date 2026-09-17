# Laporan Proyek Web Absensi Magang “Rawuh Pustaka”

## 1. Gambaran Umum

**Rawuh Pustaka** adalah aplikasi web absensi untuk anak magang. Aplikasi menyediakan dua peran pengguna: **admin/pembimbing** dan **anak magang**. Admin dapat mengelola data akun magang, membuat QR absensi, memantau kehadiran, serta melihat laporan. Anak magang dapat masuk menggunakan akun yang dibuat admin, melakukan scan QR, melihat riwayat absensi, dan mengubah profilnya.

Sistem dirancang dengan integrasi **Supabase** sehingga data pengguna, absensi, QR, dan pembaruan data dapat disimpan secara terpusat serta ditampilkan secara real-time.

## 2. Teknologi yang Digunakan

| Teknologi | Fungsi |
| --- | --- |
| React 18 | Membangun antarmuka pengguna berbasis komponen. |
| Vite 6 | Menjalankan server pengembangan dan membangun berkas produksi. |
| JavaScript (JSX) | Bahasa utama untuk logika aplikasi dan tampilan React. |
| CSS | Mengatur desain, warna, responsivitas, dan tampilan mobile. |
| Supabase | Backend untuk autentikasi, database PostgreSQL, real-time, dan Edge Functions. |
| PostgreSQL | Database untuk data profil, QR absensi, dan riwayat kehadiran. |
| Supabase Auth | Login menggunakan email dan kata sandi. |
| Supabase Realtime | Memperbarui data dashboard admin serta data absensi tanpa reload manual. |
| Supabase Edge Functions (Deno/TypeScript) | Membuat, mengubah, dan menghapus akun dengan aman menggunakan service role di sisi server. |
| html5-qrcode | Membuka kamera perangkat dan membaca QR Code absensi. |
| qrcode.react | Membuat QR Code absensi untuk dicetak admin. |
| Lucide React | Menyediakan ikon antarmuka. |

## 3. Bahasa Pemrograman

Proyek ini menggunakan beberapa bahasa dan format berikut.

1. **JavaScript / JSX**
   - Digunakan dalam `src/main.jsx`.
   - Mengatur komponen React, login, dashboard, scan QR, CRUD anak magang, dan integrasi Supabase.

2. **CSS**
   - Digunakan dalam `src/styles.css` dan `src/modal.css`.
   - Mengatur tampilan desktop, Android, iPhone, iPad, dan tablet.

3. **TypeScript**
   - Digunakan pada Supabase Edge Functions di folder `supabase/functions`.
   - Menangani proses sensitif seperti pembuatan akun, penghapusan akun, dan perubahan profil/kata sandi.

4. **SQL (PostgreSQL)**
   - Digunakan dalam `supabase/schema.sql`.
   - Membuat tabel, kebijakan keamanan RLS, trigger profil otomatis, dan fungsi scan absensi.

## 4. Fitur Utama

### Admin/Pembimbing

- Login sebagai admin.
- Menambah akun anak magang dengan nama, email, kata sandi, universitas, jurusan, serta periode magang.
- Melihat daftar anak magang dari database secara real-time.
- Mengubah data anak magang.
- Menghapus akun anak magang.
- Membuat QR Code absensi berdasarkan lokasi meja absensi.
- Memantau status hadir, terlambat, check-in, dan check-out.
- Melihat ringkasan laporan kehadiran.
- Rekap layar, Excel, dan PDF memisahkan Hadir, Terlambat, Izin, Sakit, Alpa, serta **Tanpa catatan**. Tanpa catatan dihitung pada Senin–Jumat dalam periode magang hingga hari ini; Sabtu opsional dan Minggu libur. Alpa hanya dihitung dari status yang tersimpan. Tanggal libur khusus belum diperhitungkan. Periode magang yang belum lengkap ditandai **—** agar tidak menghasilkan perkiraan ketidakhadiran.
- Melihat grafik tren kehadiran mingguan atau bulanan di dashboard. Pilih batang/tanggal untuk melihat jumlah Hadir, Terlambat, Izin, Sakit, dan Alpa pada hari tersebut.

### Anak Magang

- Login menggunakan email dan kata sandi yang dibuat admin.
- Dashboard dengan data absensi aktual, tanpa data contoh.
- Dashboard membedakan Izin, Sakit, Alpa, belum absen, sudah check-in, dan absensi selesai. Check-out hanya ditawarkan jika ada jam masuk. Status Izin/Sakit/Alpa serta catatan tanpa jam masuk yang perlu ditinjau tidak membuka scanner dari antarmuka peserta.
- Scan QR melalui kamera perangkat.
- Validasi izin kamera dan lokasi GPS sebelum QR diproses.
- Validasi radius lokasi absensi (geofencing).
- Check-in dan check-out pada QR yang sama.
- Melihat riwayat absensi aktual.
- Melihat kalender kehadiran berwarna pada halaman Riwayat, berpindah bulan, dan memilih tanggal untuk melihat status serta jam masuk/pulang.
- Melihat dan mengubah profil, email, serta kata sandi.

## 5. Struktur Data Utama

Kalender dan grafik membaca tabel `attendance` yang sudah ada dan mengikuti hak akses pengguna; tidak memerlukan migrasi database baru. Data diperbarui melalui Supabase Realtime. Kalender memakai warna status yang kontras. Minggu ditandai **Libur** dengan warna khusus, sedangkan Sabtu tanpa catatan ditandai **Masuk opsional**. Senin?Jumat yang sudah lewat atau hari ini tanpa catatan dalam masa magang ditandai **Belum Absen**, bukan otomatis **Alpa**. Catatan absensi yang sudah tersimpan pada akhir pekan tetap dapat dilihat. Grafik menghitung catatan harian per status, dengan Hadir dan Terlambat terpisah, dan tidak menghitung tanggal mendatang. Tampilan mingguan menggunakan Senin–Minggu, sedangkan tampilan bulanan menampilkan setiap tanggal dalam bulan yang dipilih. Tanggal dan waktu absensi mengikuti WIB.

### `profiles`

Menyimpan data pengguna seperti nama, email, peran (`admin` atau `intern`), universitas, jurusan, periode magang, dan status aktif.

### `attendance`

Menyimpan tanggal absensi, waktu check-in, check-out, dan status kehadiran setiap anak magang.

### `qr_sessions`

Menyimpan token QR, status aktif, masa berlaku, koordinat lokasi, dan radius absensi.

## 6. Keamanan Sistem

- Login ditangani oleh Supabase Auth.
- Kata sandi tidak disimpan langsung pada tabel profil aplikasi.
- Row Level Security (RLS) membatasi akses data sesuai peran pengguna.
- Proses membuat dan menghapus akun dilakukan melalui Edge Functions agar service role tidak terekspos ke browser.
- Scan absensi diproses melalui fungsi SQL sehingga waktu, QR aktif, serta jarak lokasi dapat diverifikasi oleh server.

## 7. Responsivitas

Skeleton loading ditampilkan pada kartu ringkasan, daftar peserta/riwayat, laporan, dan grafik saat data dimuat. Animasi mengikuti preferensi perangkat untuk mengurangi gerakan. Laporan yang gagal dimuat menyediakan tombol coba lagi; ekspor dinonaktifkan hingga data periode yang dipilih berhasil dimuat.

Warna status Hadir, Terlambat, Izin, Sakit, dan Alpa memakai palet yang sama pada kalender, grafik, dan badge absensi. Pada kalender, hari ini ditandai lingkaran pada angka tanggal, sedangkan tanggal yang dipilih ditandai garis tepi kotak.

Pada layar HP hingga 640 piksel, tabel absensi dan daftar peserta ditampilkan sebagai kartu ringkas. Kartu absensi menampilkan nama, status, serta jam masuk/pulang. Bagian **Lihat detail** memuat informasi tambahan dan aksi pengelolaan yang tersedia. Tampilan desktop tetap menggunakan tabel. Pola ini juga diterapkan pada riwayat peserta dan riwayat yang dibuka admin.

Antarmuka dibuat responsif untuk desktop, Android, iPhone, iPad, dan tablet. Navigasi samping berubah menjadi navigasi bawah pada layar kecil. Modal, tabel, tombol, scanner kamera, dan area aman perangkat juga disesuaikan dengan ukuran layar.

## 8. Cara Menjalankan Proyek

1. Instal dependensi:

   ```bash
   npm install
   ```

2. Isi konfigurasi Supabase pada file `.env`:

   ```env
   VITE_SUPABASE_URL=alamat-project-supabase
   VITE_SUPABASE_ANON_KEY=anon-key-supabase
   ```

3. Jalankan isi `supabase/schema.sql` pada Supabase SQL Editor.

4. Deploy Edge Functions:

   ```bash
   supabase functions deploy create-intern
   supabase functions deploy update-intern
   supabase functions deploy delete-intern
   supabase functions deploy update-own-profile
   ```

5. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

## 9. Kesimpulan

Rawuh Pustaka merupakan aplikasi absensi magang berbasis web modern yang memakai React sebagai frontend dan Supabase sebagai backend. Kombinasi autentikasi, database PostgreSQL, real-time, QR Code, kamera, serta validasi GPS membuat proses absensi lebih terstruktur, aman, dan mudah dipantau oleh pembimbing.
