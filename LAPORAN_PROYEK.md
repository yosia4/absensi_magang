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
- Bagian **Koreksi absensi** pada Kelola Pengajuan menyediakan jenis koreksi **Hapus absen pulang (salah scan dua kali)**. Pembimbing memilih peserta dan tanggal, memeriksa jam masuk/pulang serta status dalam WIB, lalu mengisi alasan dan mengonfirmasi penghapusan. Hanya jam pulang yang dikosongkan; jam masuk dan status tetap tersimpan. Aksi dicatat pada audit dan diberitahukan kepada peserta. Data yang belum ada, jam pulang sudah kosong, jam masuk belum tercatat, atau jam pulang berubah sejak ditampilkan tidak dapat dihapus melalui aksi ini. Peserta yang masih berstatus Hadir/Terlambat dapat melakukan scan pulang kembali. Database yang sudah berjalan memerlukan migrasi `supabase/migrations/013_clear_attendance_checkout.sql`.
- Halaman pengajuan memakai kartu berisi nama peserta, ikon jenis pengajuan, tanggal, alasan, dan status. Bagian persetujuan hanya menampilkan pengajuan menunggu; seluruh pengajuan tetap tersedia dalam riwayat. Alasan penolakan ditampilkan dalam kotak merah muda lembut yang juga terlihat oleh peserta.
- Dashboard Admin menampilkan tanggal hari ini dalam WIB dan ringkasan kehadiran dengan aksen hijau Rawuh Pustaka. Kartu memisahkan seluruh akun peserta, akun aktif, serta Sudah Check-in (termasuk terlambat), dengan warna Hadir hijau, Terlambat kuning, Izin biru, Sakit ungu, dan Alpa merah.
- Panel **Perlu ditindaklanjuti** menampilkan pengajuan menunggu, peserta belum check-out setelah jam pulang dari pengaturan, serta peserta aktif yang masa magangnya selesai hari ini hingga tujuh hari ke depan. Setiap bagian menyediakan tombol ke halaman terkait.
- Jumlah pengajuan berstatus **Menunggu** ditandai badge merah hanya pada menu Kelola Pengajuan di desktop maupun ponsel. Dashboard menampilkan jumlah pengajuan dalam panel tindak lanjut tanpa badge. Jumlah mencakup izin, sakit, dan lupa absen; diperbarui melalui Realtime, setelah persetujuan/penolakan, saat tab kembali aktif, dan pemeriksaan berkala setiap 30 detik. Badge hilang saat tidak ada pengajuan menunggu.
- Menambah akun anak magang dengan nama, email, kata sandi, universitas, jurusan, serta periode magang.
- Melihat daftar anak magang dari database secara real-time.
- Mengubah data anak magang.
- Menghapus akun anak magang.
- Membuat QR Code absensi berdasarkan lokasi meja absensi.
- Memantau status hadir, terlambat, check-in, dan check-out.
- Melihat ringkasan laporan kehadiran.
- Halaman **Laporan Kehadiran** menyediakan periode aktif, pilihan jenis periode Tanggal/Bulanan/Rentang tanggal, serta validasi tanggal sebelum laporan ditampilkan melalui tombol Tampilkan. Tombol unduh Excel dan PDF berada di bagian atas.
- Kartu status memakai ikon dan warna yang konsisten. Jumlah peserta dipisahkan dari jumlah catatan absensi.
- Rekap menampilkan universitas, pilihan Semua peserta atau satu peserta, pencarian nama, pengurutan berdasarkan nama/keterlambatan, serta rincian absensi dalam WIB saat nama peserta diklik. Pilihan peserta menggunakan ID akun dan berlaku bersama pencarian pada ringkasan, tabel, Excel, dan PDF. Memilih peserta mengosongkan pencarian sebelumnya; nama peserta disertakan pada nama berkas unduhan individual.
- PDF hanya memuat rekap per peserta, tanpa tabel absensi harian, rincian izin/sakit, atau teks pencarian dan aturan perhitungan. Laporan satu peserta menampilkan identitas (nama, universitas, jurusan, masa magang), tabel status vertikal, dan total absensi tercatat. Laporan banyak peserta menampilkan nomor urut, identitas, lima status, serta total per peserta dan keseluruhan. Informasi menggunakan data tersimpan; tanggal magang yang kosong ditandai Belum diisi.
- PDF tetap memuat logo Rawuh Pustaka, periode, waktu cetak WIB, nomor halaman, serta ruang tanda tangan pembimbing opsional. Kolom nama pembimbing tersedia di samping centang tanda tangan dan wajib diisi jika tanda tangan diaktifkan; nama dicetak di bawah ruang tanda tangan. Kepala tabel diulang saat berpindah halaman. Excel menyertakan data absensi dan pengajuan sesuai peserta terpilih, serta informasi periode, pilihan peserta, pencarian, dan satuan pada lembar Keterangan.
- Rekap layar, Excel, dan PDF memisahkan Hadir, Terlambat, Izin, Sakit, dan Alpa berdasarkan status yang tersimpan pada periode pilihan hingga hari ini. Catatan akhir pekan tetap disertakan. Alpa hanya dihitung dari status yang tersimpan.
- Melihat grafik tren kehadiran mingguan atau bulanan di dashboard. Pilih batang/tanggal untuk melihat jumlah Hadir, Terlambat, Izin, Sakit, dan Alpa pada hari tersebut.

### Anak Magang

- Login menggunakan email dan kata sandi yang dibuat admin.
- Menu **Izin / Sakit** di desktop dan ponsel menampilkan badge merah untuk balasan persetujuan atau penolakan yang belum dibaca, termasuk pengajuan lupa absen. Badge diperbarui melalui Realtime dan pemeriksaan berkala. Balasan ditandai dibaca setelah riwayat pengajuan berhasil tampil tanpa filter, atau melalui panel notifikasi; status dibaca tersimpan di database sehingga tetap berlaku saat login ulang.
- Dashboard dengan data absensi aktual, tanpa data contoh.
- Dashboard membedakan Izin, Sakit, Alpa, belum absen, sudah check-in, dan absensi selesai. Check-out hanya ditawarkan jika ada jam masuk. Status Izin/Sakit/Alpa serta catatan tanpa jam masuk yang perlu ditinjau tidak membuka scanner dari antarmuka peserta.
- Scan QR melalui kamera perangkat.
- Beranda dan menu Scan Absen menyediakan tombol **Absen Masuk** (hijau, ikon masuk) dan **Absen Pulang** (biru, ikon keluar) berdampingan, termasuk pada ponsel. Sebelum masuk hanya tombol Masuk yang aktif; setelah masuk tombol tersebut menampilkan jam dan terkunci, sedangkan Pulang aktif. Setelah pulang kedua tombol menampilkan jam masing-masing dan terkunci. Izin/Sakit/Alpa serta catatan tanpa jam masuk tetap tidak membuka scanner. Tombol Pulang meminta konfirmasi **Ingin mencatat kepulangan sekarang?** sebelum membuka halaman kamera.
- Tujuan masuk/pulang dan tanggal WIB dikunci saat tombol dipilih, kemudian dikirim ke server. Pembacaan QR dihentikan sementara setelah terdeteksi dan satu permintaan diproses per sesi. Scan masuk berulang tidak dapat mengisi jam pulang; scan pulang berulang tidak mengganti jam yang sudah tercatat. Kegagalan tidak mengulang scan secara otomatis. Server tetap memeriksa akun aktif, QR, GPS, radius, hari kerja, status, dan tanggal; jalur RPC lama meminta aplikasi dimuat ulang. Perubahan ini memerlukan migrasi `014_explicit_attendance_scan.sql`.
- Validasi izin kamera dan lokasi GPS sebelum QR diproses.
- Validasi radius lokasi absensi (geofencing).
- Check-in dan check-out pada QR yang sama.
- Melihat riwayat absensi aktual.
- Melihat kalender kehadiran berwarna pada halaman Riwayat, berpindah bulan, dan memilih tanggal untuk melihat status serta jam masuk/pulang.
- Melihat dan mengubah profil, email, serta kata sandi.
- Profil peserta menampilkan foto atau inisial, nama, universitas, status akun sesuai data, tanggal mulai/selesai, dan sisa masa magang dalam satu kartu. Sisa hari menggunakan hari kalender WIB termasuk hari ini; sebelum mulai ditampilkan hitung mundur menuju hari pertama, sedangkan periode berakhir menampilkan nol hari. Tanggal yang belum lengkap atau tidak valid tidak menghasilkan angka perkiraan. Indikator perjalanan periode, detail email/jurusan, edit profil, serta pembesaran foto tetap tersedia.

## 5. Struktur Data Utama

Kalender dan grafik membaca tabel `attendance` yang sudah ada dan mengikuti hak akses pengguna; tidak memerlukan migrasi database baru. Data diperbarui melalui Supabase Realtime. Kalender memakai warna status yang kontras. Minggu ditandai **Libur** dengan warna khusus, sedangkan Sabtu saat absensi belum tercatat ditandai **Masuk opsional**. Senin–Jumat yang sudah lewat atau hari ini saat absensi belum tercatat dalam masa magang ditandai **Belum Absen**, bukan otomatis **Alpa**. Catatan absensi yang sudah tersimpan pada akhir pekan tetap dapat dilihat. Grafik menghitung catatan harian per status, dengan Hadir dan Terlambat terpisah, dan tidak menghitung tanggal mendatang. Tampilan mingguan menggunakan Senin–Minggu, sedangkan tampilan bulanan menampilkan setiap tanggal dalam bulan yang dipilih. Tanggal dan waktu absensi mengikuti WIB.

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

Header Monitoring, Laporan, Pengajuan, dan Pengaturan memakai pola yang sama: judul besar, deskripsi singkat, serta ikon dalam kotak hijau muda. Label Rawuh Pustaka dan garis dekoratif kecil memakai aksen emas; warna utama dan aksi tetap hijau. Pengajuan peserta juga mengikuti pola header ini.

Kepala tabel memakai latar hijau lembut, garis pemisah tipis, serta sorotan baris saat diarahkan, ditekan, atau kontrol di dalamnya mendapat fokus. Nama peserta lebih tegas daripada universitas dan informasi pendukung. Grafik kehadiran memakai angka yang lebih besar, legenda tersusun dalam kartu, dan tiga garis bantu yang sejajar dengan nilai maksimum, tengah, dan nol pada sumbu. Rincian tanggal terpilih menampilkan total peserta dan hitungan tiap status; grafik bulanan tetap dapat digeser pada layar kecil.

Tombol memberikan perubahan warna singkat saat diarahkan atau ditekan, tanpa pergeseran posisi. Formulir yang sedang diisi dan kontrol yang dipilih melalui keyboard memiliki penanda fokus hijau. Pembukaan detail memakai transisi ringan 160 milidetik; animasi dan transisi dalam aplikasi dinonaktifkan saat perangkat meminta pengurangan gerakan.

Tampilan kosong memakai ikon dan pesan sesuai konteks, seperti **Belum ada absensi hari ini**, **Semua pengajuan sudah ditangani**, atau **Pengajuan tidak ditemukan** saat filter tidak cocok. Tombol Hapus filter, Buat pengajuan, Lihat riwayat pengajuan, dan Tambah anak magang tersedia sesuai kebutuhan. Pesan kosong tidak menggantikan indikator memuat atau kesalahan pengambilan data. Kartu pengajuan dan formulir menyesuaikan layar desktop maupun ponsel.

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
