# LAPORAN FUNGSI DAN MANFAAT WEBSITE RAWUH PUSTAKA

## Sistem Absensi dan Penempatan Anak Magang

Sudut pandang anak magang dan pembimbing/admin

Tanggal penyusunan: 1 Oktober 2026

Laporan ini disusun berdasarkan fitur dalam kode proyek saat ditinjau. Istilah pembimbing dalam laporan merujuk pada pengguna dengan peran admin. Pengoperasian fitur yang terhubung ke database memerlukan konfigurasi Supabase, migrasi, dan layanan pendukung yang sesuai; laporan ini bukan hasil pemeriksaan server produksi.

## 1. Gambaran umum

Rawuh Pustaka merupakan aplikasi berbasis web untuk membantu pencatatan kehadiran, pengelolaan peserta, pengajuan izin, penempatan ruangan, serta penyusunan laporan magang. Aplikasi membagi hak akses menjadi dua peran, yaitu anak magang sebagai peserta dan pembimbing/admin sebagai pengelola.

Peserta menggunakan aplikasi untuk melakukan absensi masuk dan pulang melalui QR, melihat jadwal penempatan, memeriksa riwayat kehadiran, serta mengirim pengajuan. Pembimbing menggunakan aplikasi untuk membuat akun peserta, menyediakan QR, memantau kehadiran, mengatur penempatan, meninjau pengajuan, dan mengunduh laporan.

Tujuan penggunaan website ini adalah menyatukan administrasi kehadiran dan penempatan dalam satu sistem, mengurangi pencatatan berulang, serta memudahkan peserta dan pembimbing mendapatkan informasi yang dibutuhkan.

## 2. Pembagian hak akses

| Pengguna | Ruang lingkup penggunaan |
| --- | --- |
| Anak magang | Mengakses profil, absensi, penempatan, pengajuan, dan notifikasi miliknya sendiri. |
| Pembimbing/admin | Mengelola data peserta, QR absensi, monitoring, penempatan, pengajuan, laporan, serta pengaturan absensi. |

Menu anak magang terdiri atas Beranda, Scan Absen, Riwayat, Izin / Sakit, dan Profil. Informasi penempatan peserta ditampilkan pada beranda. Menu pembimbing terdiri atas Dashboard, QR Absensi, Monitoring, Anak Magang, Penempatan Anak Magang, Kelola Pengajuan, Laporan, dan Pengaturan.

## 3. Fungsi website dari sudut pandang anak magang

### 3.1 Login dan pengelolaan akses

Peserta masuk menggunakan email dan kata sandi akun yang dibuat pembimbing. Aplikasi menyediakan alur lupa kata sandi melalui email dan pengaturan kata sandi baru, dengan dukungan layanan autentikasi yang dikonfigurasi.

Kegunaan: peserta memiliki akses pribadi untuk melihat informasi dan melakukan kegiatan absensi sesuai akun masing-masing.

### 3.2 Beranda dan ringkasan kehadiran

Beranda menampilkan status kehadiran hari ini, jam masuk, jam pulang, serta keterangan tahapan absensi. Peserta juga dapat melihat total hadir, jumlah keterlambatan, persentase absensi selesai, dan aktivitas terakhir.

Kegunaan: peserta dapat segera mengetahui apakah sudah absen masuk, masih perlu absen pulang, atau absensinya sudah selesai. Persentase absensi selesai menunjukkan perbandingan catatan yang memiliki proses masuk dan pulang lengkap terhadap catatan kehadiran, bukan persentase kehadiran terhadap seluruh hari kerja.

### 3.3 Absen masuk dan absen pulang melalui QR

Peserta memilih tombol Absen Masuk atau Absen Pulang, memberikan izin kamera dan lokasi, lalu memindai QR meja absensi. Server memeriksa akun, QR, lokasi, hari kerja, tanggal, dan status absensi sebelum mencatat hasilnya.

Tombol masuk dan pulang dipisahkan. Absen pulang meminta konfirmasi sebelum kamera dibuka. Pemindaian masuk berulang tidak otomatis berubah menjadi absen pulang, dan pemindaian pulang berulang tidak mengganti jam yang sudah tercatat.

Kegunaan: mempercepat pencatatan kehadiran dan mengurangi kesalahan akibat pemindaian ganda. Waktu pencatatan diproses oleh server dan ditampilkan dalam WIB.

### 3.4 Melihat penempatan ruangan

Bagian Penempatan Saya menampilkan ruangan tugas hari ini serta jadwal Senin sampai Sabtu pada minggu berjalan. Informasi berasal dari penempatan yang dibuat pembimbing. Jika belum ada penempatan, aplikasi memberikan keterangan bahwa jadwal belum diatur.

Kegunaan: peserta mengetahui ruangan tempat bertugas tanpa perlu menanyakan jadwal berulang kali. Peserta melihat penempatannya sendiri dan tidak mengubah pembagian ruangan.

### 3.5 Riwayat dan kalender absensi

Peserta dapat melihat tanggal, jam masuk, jam pulang, dan status kehadiran sebelumnya. Tersedia penyaringan berdasarkan tanggal, bulan, serta status. Kalender kehadiran menggunakan warna status dan dapat dibuka per tanggal untuk melihat rinciannya.

Kegunaan: memudahkan peserta memeriksa kelengkapan absensi, menelusuri keterlambatan, dan menemukan catatan yang perlu dikonfirmasikan kepada pembimbing.

### 3.6 Pengajuan izin, sakit, dan lupa absen

Melalui menu Izin / Sakit, peserta memilih jenis pengajuan, mengisi tanggal dan alasan, lalu mengirimkannya kepada pembimbing. Izin dan sakit dapat menggunakan rentang tanggal, sedangkan pengajuan lupa absen menggunakan satu tanggal.

Kegunaan: menyediakan jalur pengajuan yang tercatat dan dapat ditinjau, sehingga keterangan ketidakhadiran atau kelalaian absensi tidak hanya disampaikan secara lisan.

### 3.7 Memantau keputusan pembimbing

Riwayat pengajuan menampilkan status Menunggu, Disetujui, atau Ditolak. Apabila pengajuan ditolak, peserta dapat membaca alasan penolakannya. Riwayat juga dapat disaring berdasarkan jenis, status, tanggal, dan bulan.

Kegunaan: peserta dapat mengetahui perkembangan pengajuan dan memahami keputusan pembimbing.

### 3.8 Notifikasi dan pengingat

Panel notifikasi menampilkan pemberitahuan sistem. Balasan pengajuan yang belum dibaca ditandai melalui badge pada menu peserta. Proyek juga menyediakan pengingat absensi otomatis dalam rentang sepuluh menit sebelum batas check-in, apabila penjadwalan database telah diaktifkan.

Kegunaan: membantu peserta memperhatikan balasan pengajuan dan mengingat waktu absensi. Pemberitahuan ini berada di dalam aplikasi; tidak dinyatakan sebagai layanan pesan WhatsApp atau notifikasi push perangkat.

### 3.9 Profil dan informasi masa magang

Profil memuat identitas, foto atau inisial, universitas, jurusan, status akun, masa magang, serta informasi sisa periode magang. Peserta dapat menggunakan formulir profil untuk mengubah informasi yang diizinkan, termasuk nama, email, foto, dan kata sandi.

Kegunaan: memudahkan peserta memeriksa identitas akun dan memahami periode magangnya. Pengaturan data peserta oleh pembimbing tetap berada pada menu pengelolaan peserta.

## 4. Fungsi website dari sudut pandang pembimbing/admin

### 4.1 Dashboard dan tindak lanjut

Dashboard menampilkan jumlah seluruh akun peserta, peserta aktif, peserta yang sudah check-in, serta jumlah status Hadir, Terlambat, Izin, Sakit, dan Alpa. Terdapat grafik tren kehadiran mingguan atau bulanan dan tabel absensi hari ini.

Panel Perlu ditindaklanjuti menampilkan pengajuan menunggu, peserta yang belum check-out setelah jam pulang, dan peserta aktif yang masa magangnya berakhir hari ini hingga tujuh hari ke depan.

Kegunaan: membantu pembimbing menentukan pekerjaan yang perlu diprioritaskan tanpa harus membuka seluruh data satu per satu.

### 4.2 Pembuatan dan pencetakan QR absensi

Pembimbing dapat membuat QR meja absensi berdasarkan lokasi perangkat saat pembuatan dan mencetaknya untuk ditempel di meja. Pada implementasi saat ini, QR dibuat dengan masa berlaku satu tahun dan radius pemeriksaan lokasi 150 meter. Pembuatan QR baru menonaktifkan QR meja lama yang masih aktif.

Kegunaan: menyediakan titik absensi bersama yang dapat digunakan peserta. Pemeriksaan GPS membantu membatasi penerimaan scan pada area yang ditetapkan.

### 4.3 Monitoring kehadiran

Menu Monitoring menampilkan kehadiran peserta berdasarkan tanggal, termasuk jam masuk, jam pulang, dan status. Pembimbing dapat mencari nama serta menyaring peserta yang belum absen, terlambat, atau sudah absen.

Kegunaan: mempercepat pemeriksaan kondisi kehadiran harian dan menemukan peserta yang perlu ditindaklanjuti.

### 4.4 Pengelolaan data anak magang

Pembimbing dapat menambah, mengubah, dan menghapus akun peserta. Data yang dikelola mencakup nama, email, kata sandi saat pembuatan atau perubahan yang tersedia, universitas, jurusan, dan tanggal mulai serta selesai magang. Daftar mendukung pencarian nama, universitas, atau jurusan dan filter masa magang aktif, belum mulai, atau selesai.

Pembimbing juga dapat membuka riwayat absensi peserta dan melihat foto profil yang tersedia.

Kegunaan: menjaga data administrasi peserta dalam satu tempat dan mempermudah pemeriksaan individu.

### 4.5 Impor peserta melalui CSV atau Excel

Pembimbing dapat mengunduh template, mengunggah file CSV/Excel, dan membuat banyak akun melalui proses impor. Kata sandi dibuat otomatis untuk setiap akun. Hasil impor menampilkan akun yang berhasil dan yang gagal beserta keterangannya; kata sandi akun yang berhasil ditampilkan pada hasil tersebut.

Kegunaan: mengurangi pengisian formulir satu per satu ketika menerima banyak peserta. Hasil per baris membantu pembimbing mengetahui data yang masih perlu diperbaiki.

### 4.6 Penempatan anak magang

Penempatan menggunakan tampilan mingguan Senin sampai Sabtu dan mendukung tampilan per peserta maupun per ruangan. Fungsi yang tersedia meliputi:

- Memilih minggu, menyaring universitas, dan mencari nama atau jurusan.
- Memilih ruangan pada sel tanggal untuk mengatur penempatan harian.
- Mengisi satu minggu untuk seorang peserta pada hari yang tersedia.
- Memilih beberapa peserta, menentukan ruangan serta rentang tanggal lintas minggu, lalu memeriksa pratinjau sebelum menyimpan.
- Mengisi hanya jadwal kosong secara default atau memilih penggantian jadwal melalui opsi yang tersedia.
- Menyalin penempatan minggu sebelumnya dengan pratinjau perubahan.
- Menampilkan peserta yang jadwalnya belum lengkap atau belum ditempatkan pada tanggal tertentu.
- Melihat daftar peserta per ruangan dan menambahkan peserta yang belum ditempatkan.

Kegunaan: mempermudah pembagian tugas ruangan dan pengisian jadwal berulang. Penempatan melewati hari Minggu serta tanggal di luar masa magang. Penyimpanan massal memeriksa versi data untuk mendeteksi jadwal yang berubah sejak pratinjau dibuat.

Jumlah peserta pada pilihan ruangan membantu melihat keterisian. Fitur ini tidak dinyatakan sebagai pembatas kapasitas ruangan otomatis.

### 4.7 Persetujuan dan penolakan pengajuan

Pembimbing dapat melihat pengajuan izin, sakit, dan lupa absen yang menunggu peninjauan. Pengajuan dapat disetujui atau ditolak, dengan alasan penolakan yang disampaikan kepada peserta. Badge pada menu Kelola Pengajuan membantu menunjukkan jumlah pengajuan menunggu.

Kegunaan: membuat proses pengajuan lebih tertib dan memperjelas komunikasi keputusan kepada peserta.

### 4.8 Koreksi absensi

Pembimbing dapat mengoreksi jam masuk, jam pulang, dan status dengan mencantumkan alasan. Tersedia pula tindakan khusus untuk menghapus jam pulang yang salah tercatat, tanpa menghapus jam masuk. Tindakan khusus tersebut meminta pemeriksaan data dan konfirmasi serta memeriksa apakah jam pulang telah berubah.

Kegunaan: menyediakan cara memperbaiki catatan yang keliru dengan alasan yang terdokumentasi. Sistem menyimpan jejak audit untuk tindakan terkait dan memberi pemberitahuan sesuai alur yang tersedia.

### 4.9 Pengingat absensi

Pembimbing dapat membuat pengingat bagi peserta yang belum check-in melalui fungsi yang tersedia pada pengelolaan pengajuan. Pengingat otomatis juga disediakan pada sisi database dan mengikuti jadwal serta pengaturan yang berlaku.

Kegunaan: membantu mengingatkan peserta tanpa harus memeriksa dan menghubungi setiap orang secara terpisah melalui proses manual di luar aplikasi.

### 4.10 Laporan kehadiran dan ekspor

Laporan dapat disusun untuk tanggal, bulan, atau rentang tanggal tertentu. Tersedia pemilihan semua peserta atau satu peserta, filter universitas, pencarian nama, pengurutan, serta rincian absensi peserta.

- Excel memuat data rekap, rincian absensi dan pengajuan, serta keterangan periode dan filter yang digunakan.
- PDF memuat rekap per peserta. Untuk satu peserta, laporan menampilkan identitas dan ringkasan status; untuk banyak peserta, laporan menampilkan rekap bersama.
- PDF dapat dilengkapi ruang tanda tangan dan nama pembimbing. Ruang tersebut bukan tanda tangan elektronik.

Kegunaan: memudahkan pengarsipan, pencetakan, pemeriksaan kehadiran, dan penyerahan rekap kepada pihak yang memerlukan.

### 4.11 Pengaturan absensi dan profil admin

Pembimbing dapat mengatur jam masuk normal, jam pulang normal, toleransi keterlambatan, hari kerja, dan status aktif QR absensi. Perubahan aturan tersebut tidak mengharuskan QR yang sudah dicetak diganti. Tersedia pula pengaturan profil admin, termasuk identitas, foto, email, dan kata sandi.

Kegunaan: menyesuaikan aturan absensi dengan kebutuhan operasional dan memperbarui identitas pengelola.

### 4.12 Penonaktifan setelah masa magang selesai

Proyek menyediakan proses database yang menonaktifkan akun peserta setelah tanggal selesai magang terlewati menurut WIB. Proses ini memerlukan migrasi dan penjadwalan terkait, serta menyimpan catatan audit penonaktifan.

Kegunaan: membantu menjaga agar status akun peserta sesuai periode magang tanpa harus diperbarui satu per satu. Penonaktifan berbeda dari penghapusan akun.

## 5. Contoh alur penggunaan sehari-hari

### Dari sudut pandang anak magang

1. Masuk ke website menggunakan akun pribadi.
2. Membuka beranda untuk memeriksa status absensi dan ruangan tugas.
3. Memilih Absen Masuk dan memindai QR di area absensi.
4. Melaksanakan kegiatan pada ruangan yang ditetapkan pembimbing.
5. Jika diperlukan, mengirim pengajuan izin, sakit, atau lupa absen dan memeriksa balasannya.
6. Saat pulang, memilih Absen Pulang, mengonfirmasi tindakan, dan memindai QR kembali.
7. Memeriksa riwayat untuk memastikan catatan masuk dan pulang sudah sesuai.

### Dari sudut pandang pembimbing

1. Menyiapkan data peserta, aturan absensi, dan QR meja.
2. Mengatur penempatan ruangan sesuai kebutuhan kegiatan.
3. Memeriksa dashboard serta monitoring kehadiran.
4. Meninjau pengajuan dan memperbaiki catatan yang memerlukan koreksi.
5. Menindaklanjuti peserta yang belum check-out atau mendekati akhir masa magang.
6. Menyusun serta mengunduh laporan pada akhir periode yang diperlukan.

## 6. Nilai tambah atau kelebihan menggunakan website

| Kelebihan | Manfaat bagi pengguna |
| --- | --- |
| Administrasi terpusat | Data peserta, absensi, penempatan, pengajuan, dan laporan tersedia dalam satu aplikasi. |
| Mengurangi pekerjaan berulang | Impor peserta, penempatan massal, salin minggu, dan ekspor laporan mempercepat pekerjaan pembimbing. |
| Informasi lebih transparan | Peserta dapat memeriksa jam absensi, jadwal ruangan, status pengajuan, dan alasan penolakan sendiri. |
| Pemantauan lebih cepat | Dashboard, filter, pencarian, dan pembaruan data membantu pembimbing menemukan hal yang perlu ditindaklanjuti. |
| Pencatatan lebih konsisten | Waktu server, aturan keterlambatan, dan pemisahan aksi masuk/pulang membantu mengurangi kesalahan pencatatan. |
| Lebih mudah ditelusuri | Riwayat absensi, riwayat pengajuan, alasan koreksi, dan catatan audit menyediakan bahan pemeriksaan. |
| Pembagian tugas lebih jelas | Peserta dan pembimbing dapat mengacu pada jadwal ruangan yang tersimpan. |
| Mendukung administrasi digital | Rekap dapat diunduh untuk diarsipkan atau dicetak sehingga mengurangi penyalinan data secara manual. |
| Dapat diakses melalui browser | Tampilan menyesuaikan komputer dan ponsel tanpa memerlukan aplikasi khusus untuk penggunaan dasarnya. |
| Pembatasan akses berdasarkan peran | Hak peserta dan pembimbing dipisahkan, dengan dukungan autentikasi dan kebijakan akses database. |

Manfaat tersebut merupakan kegunaan yang didukung oleh fungsi aplikasi, bukan hasil pengukuran penghematan waktu atau biaya. Validasi GPS membantu pemeriksaan lokasi, tetapi tidak menjadi jaminan mutlak pencegahan seluruh bentuk penyalahgunaan.

## 7. Hal penting agar penggunaan dan laporan dipahami dengan benar

- Penggunaan data bersama memerlukan koneksi internet dan layanan Supabase yang tersedia. Scan memerlukan izin kamera dan lokasi melalui browser yang mendukung serta akses HTTPS pada penggunaan produksi.
- Belum ada catatan absensi tidak otomatis berarti Alpa. Rekap Alpa mengikuti status yang benar-benar tersimpan.
- Hari kerja absensi mengikuti pengaturan pembimbing. Jadwal penempatan saat ini menggunakan Senin sampai Sabtu; keduanya perlu dipahami sebagai pengaturan yang berbeda.
- Pengingat otomatis dan penonaktifan akun memerlukan migrasi serta penjadwalan database terkait. Keberadaan kode tidak membuktikan fitur tersebut sudah aktif pada server produksi.
- Pengajuan peserta, impor akun, dan fungsi administrasi yang memerlukan server tidak seluruhnya berjalan dalam mode demo.
- Notifikasi yang dibahas merupakan pemberitahuan dalam aplikasi. Laporan ini tidak mencakup jurnal kegiatan, evaluasi akhir, sertifikat, atau fitur saran lain yang belum diterapkan.

## 8. Penutup

Rawuh Pustaka mendukung pengelolaan absensi dan penempatan magang dari dua sisi yang saling melengkapi. Anak magang memperoleh sarana untuk mencatat kehadiran, mengetahui ruangan tugas, mengirim pengajuan, dan memeriksa data pribadinya. Pembimbing memperoleh sarana untuk mengelola peserta, memantau kedisiplinan, membagi ruangan, menangani pengajuan, serta menyiapkan laporan.

Nilai utama website ini adalah keterpaduan proses administrasi, kemudahan pemantauan, dan keterlacakan informasi. Dengan konfigurasi layanan serta pengelolaan data yang sesuai, aplikasi dapat membantu kegiatan magang menjadi lebih tertib dan mudah dikelola.

## Lampiran: dasar pemeriksaan fitur

Laporan merujuk pada kode proyek, khususnya:

- src/main.jsx: menu pengguna, autentikasi, scanner, pengelolaan peserta, impor, pengajuan, koreksi, QR, dan pengaturan.
- src/components/InternDashboard.jsx dan InternPlacements.jsx: beranda peserta serta penempatan pribadi.
- src/components/AdminDashboard.jsx: ringkasan dan tindak lanjut pembimbing.
- src/components/WeeklyPlacements.jsx, WeeklyPlacementTools.jsx, WeeklyBulkPlacementDialog.jsx, dan useWeeklyPlacements.js: penempatan harian, mingguan, massal, serta salin jadwal.
- src/components/AttendanceReports.jsx dan src/reportExport.js: laporan dan ekspor.
- src/components/ParticipantProfile.jsx, NotificationPanel.jsx, AttendanceCalendar.jsx, usePendingRequests.js, dan useRequestReplies.js: profil, notifikasi, kalender, serta indikator pengajuan.
- supabase/migrations/007_automatic_attendance_reminders.sql, 014_explicit_attendance_scan.sql, 020_auto_deactivate_finished_interns.sql, dan 023_bulk_placement_date_range.sql: fungsi pendukung yang dijalankan di database.

Pemeriksaan dilakukan terhadap kode lokal; tidak mencakup audit keamanan menyeluruh atau verifikasi konfigurasi server produksi.
