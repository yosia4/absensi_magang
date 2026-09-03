import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { exportAttendanceExcel, exportAttendancePdf } from "./reportExport";
import ConfirmDialog from "./components/ConfirmDialog";
import NotificationPanel from "./components/NotificationPanel";
import {
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  MoreHorizontal,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

const cfg = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
// Nilai contoh di .env tidak dianggap sebagai konfigurasi aktif; aplikasi tetap dapat dicoba dalam mode demo.
const hasSupabase =
  cfg.url &&
  cfg.key &&
  !cfg.url.includes("your-project.supabase.co") &&
  cfg.key !== "your-anon-key";
const supabase = hasSupabase ? createClient(cfg.url, cfg.key) : null;
const today = (() => {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
})();
const sampleRows = [
  {
    name: "Andi Pratama",
    initials: "AP",
    in: "07:55",
    out: "16:02",
    status: "Hadir",
    university: "Universitas Indonesia",
    major: "Ilmu Komputer",
  },
  {
    name: "Budi Santoso",
    initials: "BS",
    in: "08:12",
    out: "-",
    status: "Terlambat",
    university: "Universitas Gadjah Mada",
    major: "Sistem Informasi",
  },
  {
    name: "Sinta Maharani",
    initials: "SM",
    in: "-",
    out: "-",
    status: "Belum Absen",
    university: "Institut Teknologi Bandung",
    major: "Teknik Informatika",
  },
  {
    name: "Rizky Ramadhan",
    initials: "RR",
    in: "07:48",
    out: "16:08",
    status: "Hadir",
    university: "Universitas Indonesia",
    major: "Manajemen Informatika",
  },
];
const demoAccountsKey = "magang-accounts";
const demoEnabled = import.meta.env.DEV && !supabase;
const getDemoAccounts = () =>
  JSON.parse(localStorage.getItem(demoAccountsKey) || "[]");
const getDemoRows = () => {
  const accounts = getDemoAccounts().filter((x) => x.role === "intern");
  return accounts.length
    ? accounts.map((x) => ({
        id: x.email,
        email: x.email,
        name: x.name,
        initials: x.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
        university: x.university || "-",
        major: x.major || "-",
        internship_start: x.internship_start || "",
        internship_end: x.internship_end || "",
        in: "-",
        out: "-",
        status: "Belum Absen",
      }))
    : sampleRows;
};
const getTime = () =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date());
const workStartKey = "magang-work-start-time";
const getWorkStartTime = () => localStorage.getItem(workStartKey) || "08:00";
const formatDate = (d) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(d));

const getPhotoPath = (value = "") => {
  const marker = "/profile-photos/";
  if (!value.startsWith("http") || !value.includes(marker)) return value;
  return decodeURIComponent(value.split(marker)[1].split("?")[0]);
};

const getSignedPhotoUrl = async (value) => {
  if (!supabase || !value) return value || "";
  const path = getPhotoPath(value);
  if (!path || (path.startsWith("http") && path === value)) return value;
  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(path, 60 * 60);
  // URL lama (public atau signed) tetap bisa dipakai. Untuk path private,
  // selalu buat URL baru agar foto yang baru diunggah langsung tampil.
  return error ? (path.startsWith("http") ? value : "") : data.signedUrl;
};

const showAppMessage = (message, type = "success") =>
  window.dispatchEvent(
    new CustomEvent("app-message", { detail: { message, type } }),
  );

const saveFailureNotification = async (message) => {
  if (!supabase) return;
  await supabase.rpc("create_own_system_notification", {
    notification_title: "Absensi gagal",
    notification_message: String(message).slice(0, 300),
  });
};

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [attendance, setAttendance] = useState(() =>
    JSON.parse(localStorage.getItem("magang-attendance") || "[]"),
  );
  const flash = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };
  useEffect(
    () => localStorage.setItem("magang-attendance", JSON.stringify(attendance)),
    [attendance],
  );
  useEffect(() => {
    const handleMessage = ({ detail }) => {
      setToast(detail);
      setTimeout(() => setToast(null), 3500);
    };
    window.addEventListener("app-message", handleMessage);
    return () => window.removeEventListener("app-message", handleMessage);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!session?.user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (profile?.is_active) {
          const photoPath = getPhotoPath(profile.photo_url || "");
          const signedPhotoUrl = await getSignedPhotoUrl(photoPath);
          setUser({
            ...profile,
            photo_path: photoPath,
            photo_url: signedPhotoUrl,
            initials: profile.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")
              .toUpperCase(),
          });
        }
      })
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--active-profile-photo",
      user?.photo_url ? `url("${user.photo_url}")` : "none",
    );
  }, [user]);
  useEffect(() => {
    if (!supabase || !user?.id) return;
    const loadNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,message,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(data || []);
    };
    loadNotifications();
    const channel = supabase
      .channel("user-notifications-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + user.id,
        },
        loadNotifications,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);
  const openNotifications = async () => {
    setNotificationsOpen((value) => !value);
    const unread = notifications
      .filter((item) => !item.read_at)
      .map((item) => item.id);
    if (supabase && unread.length) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread);
      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        })),
      );
    }
  };
  const completeLogin = (profile) => setUser(profile);
  if (!authReady)
    return (
      <div className="auth-loading">
        <ShieldCheck size={28} />
        <b>Memeriksa sesi login...</b>
      </div>
    );
  if (!user) return <Login onLogin={completeLogin} />;
  const logout = async () => {
    if (supabase && user.id) {
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "logout",
        details: { name: user.name },
      });
      await supabase.auth.signOut();
    }
    localStorage.removeItem("magang-attendance");
    setLogoutOpen(false);
    setUser(null);
  };
  const nav =
    user.role === "admin"
      ? [
          ["dashboard", "Dashboard", LayoutDashboard],
          ["qr", "QR Absensi", QrCode],
          ["monitor", "Monitoring", CalendarDays],
          ["interns", "Anak Magang", Users],
          ["requests", "Pengajuan", FileText],
          ["reports", "Laporan", FileText],
          ["settings", "Pengaturan", Settings],
        ]
      : [
          ["dashboard", "Beranda", Home],
          ["scan", "Scan Absen", QrCode],
          ["history", "Riwayat", CalendarDays],
          ["leave", "Izin / Sakit", FileText],
          ["profile", "Profil", User],
        ];
  const content =
    user.role === "admin" ? (
      <AdminPage page={page} nav={setPage} flash={flash} />
    ) : (
      <InternPage
        page={page}
        nav={setPage}
        user={user}
        attendance={attendance}
        setAttendance={setAttendance}
        flash={flash}
        updateUser={(changes) =>
          setUser((current) => ({ ...current, ...changes }))
        }
      />
    );
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck />
          </span>
          <span>
            Hadir<span>in</span>
          </span>
        </div>
        <p className="side-label">MENU UTAMA</p>
        {nav.map(([id, label, Icon]) => (
          <button
            className={"nav-item " + (page === id ? "active" : "")}
            onClick={() => setPage(id)}
            key={id}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
        <div className="side-bottom">
          <button className="nav-item" onClick={() => setLogoutOpen(true)}>
            <LogOut size={19} />
            Keluar
          </button>
          <small>© 2026 Hadirin</small>
        </div>
      </aside>
      <main>
        <header>
          <div className="mobile-brand">
            Hadir<span>in</span>
          </div>
          <div>
            <p className="crumb">
              {user.role === "admin"
                ? "Admin Panel"
                : "Selamat datang kembali,"}
            </p>
            <h1>
              {user.role === "admin"
                ? nav.find((x) => x[0] === page)?.[1]
                : user.name.split(" ")[0] + "! 👋"}
            </h1>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={openNotifications}
              aria-label="Notifikasi"
            >
              <Bell size={20} />
              {notifications.some((item) => !item.read_at) && <i />}
            </button>
            {notificationsOpen && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setNotificationsOpen(false)}
              />
            )}
            <div className="avatar">{user.initials}</div>
          </div>
        </header>
        {content}
      </main>
      <nav className="bottom-nav">
        {nav
          .slice(0, user.role === "admin" ? 4 : 5)
          .map(([id, label, Icon]) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              key={id}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
      </nav>
      {toast && (
        <div className={"toast " + toast.type}>
          <Check size={18} />
          {toast.message}
        </div>
      )}
      {logoutOpen && (
        <ConfirmDialog
          icon={<LogOut size={23} />}
          title="Keluar dari akun?"
          message="Sesi Anda akan diakhiri dari perangkat ini."
          confirmLabel="Ya, keluar"
          onCancel={() => setLogoutOpen(false)}
          onConfirm={logout}
        />
      )}
    </div>
  );
}
function Login({ onLogin }) {
  const [admin, setAdmin] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!supabase) {
      if (!demoEnabled) {
        setError(
          "Konfigurasi Supabase belum tersedia. Mode demo dinonaktifkan pada produksi.",
        );
        return;
      }
      const email = String(form.get("email")).trim().toLowerCase(),
        password = String(form.get("password"));
      const account = getDemoAccounts().find(
        (x) => x.email.toLowerCase() === email && x.password === password,
      );
      if (account) {
        if (
          (admin && account.role !== "admin") ||
          (!admin && account.role !== "intern")
        ) {
          setError("Role akun tidak sesuai portal yang dipilih.");
          return;
        }
        onLogin({
          ...account,
          initials: account.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        });
        return;
      }
      setError("Email atau kata sandi belum terdaftar.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile?.is_active) {
      await supabase.auth.signOut();
      setError("Profil tidak aktif atau belum tersedia.");
      setLoading(false);
      return;
    }
    if (
      (admin && profile.role !== "admin") ||
      (!admin && profile.role !== "intern")
    ) {
      await supabase.auth.signOut();
      setError("Role akun tidak sesuai portal yang dipilih.");
      setLoading(false);
      return;
    }
    onLogin({
      ...profile,
      initials: profile.name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    });
    setLoading(false);
  };
  return (
    <div className="login">
      <section className="login-copy">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck />
          </span>
          Hadir<span>in</span>
        </div>
        <div>
          <span className="eyebrow">SISTEM ABSENSI MAGANG</span>
          <h1>
            Hadir tepat waktu,
            <br />
            <em>bertumbuh setiap hari.</em>
          </h1>
          <p>
            Kelola kehadiran magang dengan cepat, aman, dan modern melalui QR
            Code.
          </p>
        </div>
        <div className="quote">
          “Disiplin adalah jembatan antara tujuan dan pencapaian.”
        </div>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="eyebrow">
            {admin ? "PORTAL PEMBIMBING" : "SELAMAT DATANG"}
          </span>
          <h2>Masuk ke akun Anda</h2>
          <p>Gunakan akun terdaftar untuk melanjutkan.</p>
          <form onSubmit={submit}>
            <label>
              Email atau username
              <input
                name="email"
                type="email"
                placeholder="nama@instansi.go.id"
                required
              />
            </label>
            <label>
              Kata sandi
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={loading} className="primary full">
              {loading ? "Memverifikasi..." : "Masuk"}{" "}
              <ChevronLeft className="rotate" size={18} />
            </button>
          </form>
          <div className="role-switch" aria-label="Pilih portal login">
            <button
              type="button"
              className={!admin ? "active" : ""}
              onClick={() => setAdmin(false)}
            >
              <ChevronLeft size={16} /> Anak magang
            </button>
            <button
              type="button"
              className={admin ? "active" : ""}
              onClick={() => setAdmin(true)}
            >
              Admin/pembimbing <ChevronRight size={16} />
            </button>
          </div>
          <small className="secure">
            <ShieldCheck size={14} /> Koneksi aman dan terlindungi
          </small>
        </div>
      </section>
    </div>
  );
}
function InternPage({
  page,
  nav,
  user,
  attendance,
  setAttendance,
  flash,
  updateUser,
}) {
  const record = attendance.find((x) => x.date === today);
  useEffect(() => {
    if (!supabase || !user.id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("date,check_in,check_out,status")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      if (error) {
        flash(error.message, "error");
        return;
      }
      setAttendance(
        (data || []).map((x) => ({
          date: x.date,
          check_in: x.check_in
            ? new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Jakarta",
              }).format(new Date(x.check_in))
            : null,
          check_out: x.check_out
            ? new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Jakarta",
              }).format(new Date(x.check_out))
            : null,
          status: x.status,
        })),
      );
    };
    load();
    const channel = supabase
      .channel("intern-attendance-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: "user_id=eq." + user.id,
        },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user.id]);
  const processScan = async (token, location) => {
    if (supabase) {
      const { data, error } = await supabase.rpc("scan_attendance", {
        qr_token: token,
        scan_latitude: location?.latitude,
        scan_longitude: location?.longitude,
      });
      if (error) {
        await saveFailureNotification(error.message);
        flash(error.message, "error");
        return false;
      }
      setAttendance((a) => [
        {
          date: data.date,
          check_in: data.check_in
            ? new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Jakarta",
              }).format(new Date(data.check_in))
            : null,
          check_out: data.check_out
            ? new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Jakarta",
              }).format(new Date(data.check_out))
            : null,
          status: data.status,
        },
        ...a.filter((x) => x.date !== data.date),
      ]);
      flash(
        data.check_out ? "Check-out berhasil dicatat!" : "Absensi berhasil!",
      );
      nav("dashboard");
      return true;
    }
    const now = getTime();
    setAttendance((a) =>
      a.some((x) => x.date === today)
        ? a.map((x) =>
            x.date === today ? { ...x, check_out: now, status: "Hadir" } : x,
          )
        : [
            { date: today, check_in: now, check_out: null, status: "Hadir" },
            ...a,
          ],
    );
    flash(
      record
        ? "Check-out berhasil dicatat!"
        : "Absensi berhasil! Jam masuk: " + now,
    );
    nav("dashboard");
    return true;
  };
  if (page === "scan")
    return (
      <Scanner
        record={record}
        onDone={processScan}
        onCancel={() => nav("dashboard")}
      />
    );
  if (page === "history") return <History data={attendance} />;
  if (page === "leave") return <LeaveRequests user={user} flash={flash} />;
  if (page === "profile")
    return <Profile user={user} updateUser={updateUser} />;
  return (
    <InternDashboard
      user={user}
      record={record}
      nav={nav}
      attendance={attendance}
    />
  );
}
function InternDashboard({ user, record, nav, attendance }) {
  const complete = record?.check_out;
  const history = [...attendance].sort((a, b) => b.date.localeCompare(a.date));
  const hadir = history.filter((x) => x.check_in).length;
  const terlambat = history.filter((x) => x.status === "Terlambat").length;
  const selesai = history.filter((x) => x.check_out).length;
  const rate = hadir ? Math.round((selesai / hadir) * 100) : 0;
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">{formatDate(today)}</span>
          <h2>
            {complete
              ? "Absensi hari ini selesai"
              : "Saatnya mulai hari yang produktif!"}
          </h2>
          <p>
            {complete
              ? "Terima kasih sudah menyelesaikan absensi Anda."
              : "Pastikan melakukan scan untuk mencatat kehadiran."}
          </p>
        </div>
        <div className="hero-orb">
          <Clock3 size={30} />
          <b>{record?.check_in || "--:--"}</b>
          <small>JAM MASUK</small>
        </div>
      </div>
      <section className="status-grid">
        <div className="status-card">
          <div className="avatar large">{user.initials}</div>
          <div>
            <small>STATUS KEHADIRAN</small>
            <h3>
              {complete ? "Selesai" : record ? "Sudah Check-in" : "Belum Absen"}
            </h3>
            <span
              className={
                "badge " + (complete ? "green" : record ? "blue" : "gray")
              }
            >
              {complete
                ? "Hadir hari ini"
                : record
                  ? "Menunggu check-out"
                  : "Belum tercatat"}
            </span>
          </div>
        </div>
        <div className="time-card">
          <small>JAM MASUK</small>
          <strong>{record?.check_in || "--:--"}</strong>
          <span>{record ? "Tercatat hari ini" : "Belum melakukan scan"}</span>
        </div>
        <div className="time-card">
          <small>JAM PULANG</small>
          <strong>{record?.check_out || "--:--"}</strong>
          <span>{complete ? "Tercatat hari ini" : "Menunggu check-out"}</span>
        </div>
      </section>
      <button
        disabled={complete}
        className="scan-cta"
        onClick={() => nav("scan")}
      >
        <span className="scan-icon">
          <QrCode size={30} />
        </span>
        <span>
          <b>
            {complete
              ? "ABSENSI HARI INI SELESAI"
              : record
                ? "SCAN UNTUK CHECK-OUT"
                : "SCAN ABSEN"}
          </b>
          <small>
            {complete ? "Sampai jumpa besok" : "Ketuk untuk membuka kamera"}
          </small>
        </span>
        <ChevronLeft className="rotate" />
      </button>
      <section className="split">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Ringkasan Kehadiran</h3>
              <p>Data absensi Anda saat ini</p>
            </div>
            <MoreHorizontal />
          </div>
          <div className="metrics">
            <div>
              <b>{hadir}</b>
              <span>Total hadir</span>
            </div>
            <div>
              <b>{rate}%</b>
              <span>Absensi selesai</span>
            </div>
            <div>
              <b>{terlambat}</b>
              <span>Terlambat</span>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Aktivitas Terakhir</h3>
              <p>Riwayat absensi Anda</p>
            </div>
            <button className="text-btn" onClick={() => nav("history")}>
              Lihat semua
            </button>
          </div>
          {history.length ? (
            history.slice(0, 2).map((x, i) => (
              <div className="activity" key={i}>
                <span className="mini-icon">
                  <CalendarDays size={16} />
                </span>
                <div>
                  <b>{formatDate(x.date)}</b>
                  <small>
                    {x.check_in || "-"} — {x.check_out || "Belum pulang"}
                  </small>
                </div>
                <span
                  className={
                    "badge " + (x.status === "Terlambat" ? "orange" : "green")
                  }
                >
                  {x.status}
                </span>
              </div>
            ))
          ) : (
            <div className="activity">
              <span className="mini-icon">
                <CalendarDays size={16} />
              </span>
              <div>
                <b>Belum ada aktivitas</b>
                <small>Riwayat absensi akan tampil setelah scan pertama.</small>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
function Scanner({ record, onDone, onCancel }) {
  const [error, setError] = useState(""),
    [userLocation, setUserLocation] = useState(null),
    [requesting, setRequesting] = useState(false),
    [cameraReady, setCameraReady] = useState(false);
  const scanner = useRef(),
    busy = useRef(false),
    locationRef = useRef(null);
  const activateLocation = async () => {
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("Lokasi dan kamera hanya dapat digunakan melalui HTTPS.");
      return;
    }
    if (!navigator.geolocation || !navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini tidak mendukung GPS atau kamera.");
      return;
    }
    setRequesting(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraReady(true);
    } catch {
      setError(
        "Izin kamera ditolak. Izinkan Kamera untuk situs ini pada pengaturan browser.",
      );
      setRequesting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        };
        locationRef.current = next;
        setUserLocation(next);
        setRequesting(false);
      },
      (e) => {
        const message =
          e.code === 1
            ? "Izin lokasi ditolak. Izinkan Lokasi untuk situs ini pada pengaturan browser."
            : e.code === 2
              ? "GPS/lokasi perangkat belum aktif atau sinyal belum tersedia. Nyalakan Lokasi perangkat lalu coba lagi."
              : "Lokasi terlalu lama ditemukan. Pastikan GPS aktif, lalu coba lagi.";
        setError(message);
        setRequesting(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  useEffect(() => {
    if (!userLocation || !cameraReady) return;
    scanner.current = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false,
    );
    scanner.current.render(
      async (decoded) => {
        if (busy.current) return;
        busy.current = true;
        const success = await onDone(decoded, locationRef.current);
        if (success) scanner.current.clear().catch(() => {});
        else busy.current = false;
      },
      () => {},
    );
    return () => scanner.current?.clear().catch(() => {});
  }, [userLocation, cameraReady]);
  return (
    <div className="scanner-page">
      <button className="back" onClick={onCancel}>
        <ChevronLeft size={20} /> Kembali
      </button>
      <div className="scanner-copy">
        <span className="eyebrow">{record ? "CHECK-OUT" : "CHECK-IN"}</span>
        <h2>Scan Absensi</h2>
        <p>Tekan tombol untuk mengizinkan lokasi dan kamera.</p>
      </div>
      <button
        className={
          "primary full location-button " +
          (userLocation ? "location-ready" : "")
        }
        onClick={activateLocation}
        disabled={requesting}
      >
        {userLocation ? (
          <>
            <Check size={17} /> Lokasi aktif — kamera terbuka
          </>
        ) : (
          <>
            <MapPin size={17} />
            {requesting
              ? "Meminta izin perangkat..."
              : "Aktifkan lokasi & kamera"}
          </>
        )}
      </button>
      <div className="reader-wrap">
        {userLocation && cameraReady ? (
          <div id="qr-reader" />
        ) : (
          <div className="camera-placeholder">
            <Camera size={28} />
            <b>Kamera siap digunakan</b>
            <span>
              Tekan tombol di atas untuk memberi izin lokasi dan kamera.
            </span>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="scanner-tip">
        <MapPin size={16} /> Pemindaian hanya menggunakan kamera perangkat.
      </p>
    </div>
  );
}
function History({ data }) {
  const rows = [...data].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Riwayat Absensi</h2>
          <p>Catatan kehadiran magang Anda</p>
        </div>
        <button className="filter">
          <CalendarDays size={16} /> Semua riwayat
        </button>
      </div>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i}>
                <td>
                  <b>{formatDate(x.date)}</b>
                </td>
                <td>{x.check_in || "-"}</td>
                <td>{x.check_out || "-"}</td>
                <td>
                  <span
                    className={
                      "badge " + (x.status === "Terlambat" ? "orange" : "green")
                    }
                  >
                    {x.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">Belum ada riwayat absensi.</p>
      )}
    </div>
  );
}
function Profile({ user, updateUser }) {
  const [profile, setProfile] = useState(user),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [photoName, setPhotoName] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    let photoPath = profile.photo_path || getPhotoPath(profile.photo_url || ""),
      photoUrl = profile.photo_url || "",
      file = form.get("photo");
    if (file instanceof File && file.size) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        showAppMessage("Gunakan gambar maksimal 5 MB.", "error");
        setSaving(false);
        return;
      }
      const path = `${user.id}/profile`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        showAppMessage(error.message, "error");
        setSaving(false);
        return;
      }
      photoPath = path;
      photoUrl = await getSignedPhotoUrl(path);
    }
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      photo_url: photoPath,
    };
    const { error } = await supabase.functions.invoke("update-own-profile", {
      body,
    });
    setSaving(false);
    if (error) {
      showAppMessage(error.message || "Profil tidak dapat diperbarui", "error");
      return;
    }
    setProfile((p) => ({
      ...p,
      ...body,
      photo_path: photoPath,
      photo_url: photoUrl,
      initials: body.name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    }));
    updateUser({
      name: body.name,
      email: body.email,
      photo_path: photoPath,
      photo_url: photoUrl,
      initials: body.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    });
    setOpen(false);
  };
  return (
    <div className="profile-grid">
      <div className="panel profile-card">
        {profile.photo_url ? (
          <img
            className="profile-photo"
            src={profile.photo_url}
            alt="Foto profil"
          />
        ) : (
          <div className="avatar xl">{profile.initials}</div>
        )}
        <h2>{profile.name}</h2>
        <p>Anak Magang · {profile.university || "-"}</p>
        <span className="badge green">Aktif</span>
        <hr />
        <div>
          <small>EMAIL</small>
          <b>{profile.email || "-"}</b>
        </div>
        <div>
          <small>UNIVERSITAS</small>
          <b>{profile.university || "-"}</b>
        </div>
        <div>
          <small>JURUSAN</small>
          <b>{profile.major || "-"}</b>
        </div>
      </div>
      <div className="panel detail-panel">
        <div className="panel-heading">
          <div>
            <h2>Informasi Magang</h2>
            <p>Data pribadi dan penempatan</p>
          </div>
          <button className="text-btn" onClick={() => setOpen(true)}>
            Edit profil
          </button>
        </div>
        {[
          [
            "Tanggal mulai",
            profile.internship_start
              ? formatDate(profile.internship_start)
              : "-",
          ],
          [
            "Tanggal selesai",
            profile.internship_end ? formatDate(profile.internship_end) : "-",
          ],
          ["Status akun", profile.is_active ? "Aktif" : "Nonaktif"],
        ].map((x) => (
          <div className="info-row" key={x[0]}>
            <span>{x[0]}</span>
            <b>{x[1]}</b>
          </div>
        ))}
      </div>
      {open && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={submit}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            <h2>Edit Profil</h2>
            <p>Ubah data dan foto profil Anda.</p>
            <label>
              Nama lengkap
              <input name="name" defaultValue={profile.name} required />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                defaultValue={profile.email}
                required
              />
            </label>
            <label>
              Foto profil
              <input
                name="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")}
              />
              <small>{photoName || "Pilih file gambar, maksimal 5 MB."}</small>
            </label>
            <label>
              Kata sandi baru <small>(kosongkan jika tidak diubah)</small>
              <input type="password" name="password" minLength="6" />
            </label>
            <button disabled={saving} className="primary full">
              {saving ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function AdminPage({ page, nav, flash }) {
  const [rows, setRows] = useState(supabase ? [] : getDemoRows()),
    [loading, setLoading] = useState(!!supabase);
  const load = async () => {
    if (!supabase) {
      setRows(getDemoRows());
      return;
    }
    setLoading(true);
    const [
      { data: profiles, error: profileError },
      { data: attendances, error: attendanceError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,name,email,role,photo_url,university,major,internship_start,internship_end,is_active",
        )
        .order("name"),
      supabase
        .from("attendance")
        .select("user_id,check_in,check_out,status")
        .eq("date", today),
    ]);
    if (profileError || attendanceError) {
      flash((profileError || attendanceError).message, "error");
      setLoading(false);
      return;
    }
    const byUser = new Map((attendances || []).map((a) => [a.user_id, a]));
    setRows(
      await Promise.all(
        // Jangan membatasi query dengan role di database. Data lama bisa saja
        // belum memiliki role "intern", tetapi tetap perlu terlihat di admin.
        (profiles || [])
          .filter((p) => p.role !== "admin")
          .map(async (p) => {
          const a = byUser.get(p.id);
          const signedPhotoUrl = await getSignedPhotoUrl(p.photo_url);
          const time = (v) =>
            v
              ? new Intl.DateTimeFormat("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Jakarta",
                }).format(new Date(v))
              : "-";
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            photo_url: signedPhotoUrl,
            internship_start: p.internship_start,
            internship_end: p.internship_end,
            initials: p.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")
              .toUpperCase(),
            university: p.university || "",
            major: p.major || "",
            in: time(a?.check_in),
            out: time(a?.check_out),
            status: a?.status || (p.is_active ? "Belum Absen" : "Nonaktif"),
          };
          }),
      ),
    );
    setLoading(false);
  };
  useEffect(() => {
    load();
    if (!supabase) return;
    const channel = supabase
      .channel("admin-live-attendance")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  if (page === "qr") return <QrGenerator flash={flash} />;
  if (page === "monitor") return <Monitoring rows={rows} loading={loading} />;
  if (page === "interns")
    return (
      <Interns rows={rows} loading={loading} refresh={load} flash={flash} />
    );
  if (page === "requests")
    return <AdminWorkflows rows={rows} refresh={load} flash={flash} />;
  if (page === "reports") return <Reports flash={flash} rows={rows} />;
  if (page === "settings") return <SettingsPage />;
  return <AdminDashboard rows={rows} nav={nav} loading={loading} />;
}
function AdminDashboard({ rows, nav, loading }) {
  const present = rows.filter((x) => x.in !== "-"),
    late = rows.filter((x) => x.status === "Terlambat"),
    absent = rows.filter((x) => x.status === "Belum Absen");
  const stats = [
    [String(rows.length), "Total Anak Magang", Users, "blue"],
    [String(present.length), "Hadir Hari Ini", Check, "green"],
    [String(absent.length), "Belum Absen", Clock3, "orange"],
    [String(late.length), "Terlambat", Bell, "red"],
  ];
  return (
    <>
      <section className="stat-grid">
        {stats.map(([n, l, I, c]) => (
          <div className="stat-card" key={l}>
            <span className={"stat-icon " + c}>
              <I size={20} />
            </span>
            <div>
              <b>{loading ? "…" : n}</b>
              <small>{l}</small>
            </div>
          </div>
        ))}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Absensi Hari Ini</h2>
            <p>{formatDate(today)} · data langsung dari Supabase</p>
          </div>
          <button className="text-btn" onClick={() => nav("monitor")}>
            Lihat monitoring
          </button>
        </div>
        <AttendanceTable rows={rows} />
      </section>
    </>
  );
}
function AttendanceTable({ rows, onEdit, onDelete }) {
  const manageable = !!(onEdit || onDelete);
  return (
    <table>
      <thead>
        <tr>
          <th>Nama</th>
          <th>Universitas</th>
          <th>Jurusan</th>
          <th>Jam Masuk</th>
          <th>Jam Pulang</th>
          <th>Status</th>
          {manageable && <th>Aksi</th>}
        </tr>
      </thead>
      <tbody>
        {!rows.length && (
          <tr>
            <td colSpan={manageable ? 7 : 6} className="empty-table">
              Belum ada data anak magang di database.
            </td>
          </tr>
        )}
        {rows.map((x, i) => (
          <tr key={x.id || i}>
            <td>
              <span className="person">
                {x.photo_url ? (
                  <img
                    className="avatar small table-photo"
                    src={x.photo_url}
                    alt={x.name}
                  />
                ) : (
                  <span className="avatar small">{x.initials}</span>
                )}
                <b>{x.name}</b>
              </span>
            </td>
            <td>{x.university}</td>
            <td>{x.major}</td>
            <td>{x.in}</td>
            <td>{x.out}</td>
            <td>
              <span
                className={
                  "badge " +
                  (x.status === "Terlambat"
                    ? "orange"
                    : x.status === "Hadir"
                      ? "green"
                      : "gray")
                }
              >
                {x.status}
              </span>
            </td>
            {manageable && (
              <td className="table-actions">
                <button className="text-btn" onClick={() => onEdit?.(x)}>
                  Edit
                </button>
                <button
                  className="text-btn danger-btn"
                  onClick={() => onDelete?.(x)}
                >
                  Hapus
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function QrGenerator({ flash }) {
  const [token, setToken] = useState(""),
    [location, setLocation] = useState(null),
    [locationError, setLocationError] = useState(""),
    [loading, setLoading] = useState(!!supabase);
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Perangkat tidak mendukung GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocationError("");
      },
      () =>
        setLocationError("Aktifkan izin lokasi saat pembimbing membuat QR."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };
  useEffect(() => {
    getLocation();
    if (!supabase) {
      setToken("DEMO-QR-MEJA-ABSENSI");
      setLoading(false);
      return;
    }
    supabase
      .from("qr_sessions")
      .select("token")
      .eq("is_static", true)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) flash(error.message, "error");
        if (data) setToken(data.token);
        setLoading(false);
      });
  }, []);
  const createPrintedQr = async () => {
    if (!location) {
      getLocation();
      flash("Izinkan lokasi terlebih dahulu, lalu klik buat QR lagi.", "error");
      return;
    }
    const next = crypto.randomUUID();
    if (supabase) {
      await supabase
        .from("qr_sessions")
        .update({ is_active: false })
        .eq("is_static", true)
        .eq("is_active", true);
      const { error } = await supabase.from("qr_sessions").insert({
        token: next,
        label: "QR Meja Absensi",
        is_static: true,
        expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_active: true,
        latitude: location.latitude,
        longitude: location.longitude,
        radius_m: 150,
      });
      if (error) {
        flash(error.message, "error");
        return;
      }
    }
    setToken(next);
    flash("QR Meja berhasil dibuat. Silakan cetak dan tempel di meja.");
  };
  return (
    <div className="qr-page">
      <section>
        <span className="eyebrow">QR MEJA + GEOFENCING</span>
        <h2>QR Absensi untuk Dicetak</h2>
        <p>
          QR ini dibuat di meja absensi dan berlaku satu tahun. Scan hanya
          diterima dalam radius 150 meter.
        </p>
      </section>
      <div className="qr-card">
        <div className="qr-status">
          <span className={location ? "dot" : "dot offline"} />{" "}
          {location
            ? "Lokasi meja terverifikasi"
            : "Menunggu izin lokasi pembimbing"}
        </div>
        <div className="qr-box">
          {token ? (
            <QRCodeSVG
              value={token}
              size={230}
              level="H"
              includeMargin
              imageSettings={{
                src: "/logo-balaitemu.png",
                height: 42,
                width: 42,
                excavate: true,
              }}
            />
          ) : (
            <span>Menyiapkan QR...</span>
          )}
        </div>
        <h3>QR Meja Absensi</h3>
        <p>
          {location
            ? "Tempel QR ini pada meja absensi. Lokasi scan tetap divalidasi GPS."
            : locationError || "Meminta akses lokasi GPS..."}
        </p>
        <div className="countdown">
          <MapPin size={18} />
          <b>Radius area: 150 meter</b>
        </div>
        <div className="qr-actions">
          <button className="outline" onClick={createPrintedQr}>
            <QrCode size={17} /> Buat QR Baru
          </button>
          <button
            className="primary"
            disabled={!token || loading}
            onClick={() => window.print()}
          >
            <FileText size={17} /> Cetak QR
          </button>
        </div>
      </div>
    </div>
  );
}
function Monitoring({ rows, loading }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((x) =>
    x.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Monitoring Absensi</h2>
          <p>
            {loading
              ? "Memuat data..."
              : "Pembaruan otomatis saat absensi masuk."}
          </p>
        </div>
        <button className="filter">
          <CalendarDays size={16} /> Hari ini
        </button>
      </div>
      <div className="search">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama anak magang..."
        />
      </div>
      <AttendanceTable rows={filtered} />
    </div>
  );
}
function Interns({ rows, loading, refresh, flash }) {
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null);
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  const submit = async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    if (!supabase) {
      const accounts = getDemoAccounts();
      if (editing) {
        const i = accounts.findIndex((x) => x.email === editing.email);
        if (i >= 0)
          accounts[i] = {
            ...accounts[i],
            name: form.name,
            university: form.university,
            major: form.major,
            internship_start: form.internship_start,
            internship_end: form.internship_end,
          };
        localStorage.setItem(demoAccountsKey, JSON.stringify(accounts));
        flash("Data anak magang diperbarui.");
        close();
        return;
      }
      if (
        accounts.some(
          (x) => x.email.toLowerCase() === form.email.trim().toLowerCase(),
        )
      ) {
        flash("Email ini sudah terdaftar. Gunakan email lain.", "error");
        return;
      }
      accounts.push({
        ...form,
        email: form.email.trim().toLowerCase(),
        role: "intern",
      });
      localStorage.setItem(demoAccountsKey, JSON.stringify(accounts));
      flash("Akun berhasil ditambahkan dan langsung dapat login.");
      close();
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: form.name,
          university: form.university || null,
          major: form.major || null,
          internship_start: form.internship_start || null,
          internship_end: form.internship_end || null,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        flash(error.message, "error");
        return;
      }
      flash("Data anak magang diperbarui.");
      close();
      refresh();
      return;
    }
    const { error } = await supabase.functions.invoke("create-intern", {
      body: form,
    });
    setSaving(false);
    if (error) {
      let message = error.message || "Akun tidak dapat dibuat";
      try {
        const body = await error.context?.json();
        message = body.error || message;
      } catch {}
      flash(message, "error");
      return;
    }
    flash(
      "Akun anak magang berhasil ditambahkan dan siap digunakan untuk login.",
    );
    close();
    refresh();
  };
  const remove = async (intern) => {
    if (!supabase) {
      localStorage.setItem(
        demoAccountsKey,
        JSON.stringify(
          getDemoAccounts().filter((x) => x.email !== intern.email),
        ),
      );
      flash("Akun anak magang dihapus.");
      setDeleting(null);
      return;
    }
    const { error } = await supabase.functions.invoke("delete-intern", {
      body: { id: intern.id },
    });
    if (error) {
      flash(error.message || "Akun tidak dapat dihapus", "error");
      return;
    }
    flash("Akun anak magang dihapus.");
    setDeleting(null);
    refresh();
  };
  const edit = (intern) => {
    setEditing(intern);
    setOpen(true);
  };
  return (
    <div className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Data Anak Magang</h2>
          <p>{loading ? "Memuat data..." : "Kelola data anak magang."}</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + Tambah Anak Magang
        </button>
      </div>
      <AttendanceTable rows={rows} onEdit={edit} onDelete={setDeleting} />
      {open && (
        <div className="modal-backdrop">
          <form className="modal" key={editing?.id || "new"} onSubmit={submit}>
            <button type="button" className="modal-close" onClick={close}>
              <X size={20} />
            </button>
            <h2>{editing ? "Edit Anak Magang" : "Tambah Anak Magang"}</h2>
            <p>
              {editing
                ? "Perbarui data penempatan anak magang."
                : "Akun dan data magang langsung dibuat oleh pembimbing."}
            </p>
            <label>
              Nama lengkap
              <input name="name" defaultValue={editing?.name} required />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                defaultValue={editing?.email}
                readOnly={!!editing}
                required
              />
            </label>
            {!editing && (
              <label>
                Kata sandi awal
                <input type="password" name="password" minLength="6" required />
              </label>
            )}
            <label>
              Universitas
              <input
                name="university"
                defaultValue={editing?.university}
                placeholder="Contoh: Universitas Indonesia"
              />
            </label>
            <label>
              Jurusan
              <input
                name="major"
                defaultValue={editing?.major}
                placeholder="Contoh: Ilmu Komputer"
              />
            </label>
            <div className="date-inputs">
              <label>
                Mulai
                <input
                  type="date"
                  name="internship_start"
                  defaultValue={editing?.internship_start}
                />
              </label>
              <label>
                Selesai
                <input
                  type="date"
                  name="internship_end"
                  defaultValue={editing?.internship_end}
                />
              </label>
            </div>
            <button disabled={saving} className="primary full">
              {saving
                ? "Menyimpan..."
                : editing
                  ? "Simpan perubahan"
                  : "Buat akun anak magang"}
            </button>
          </form>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          icon={<Users size={23} />}
          title="Hapus anak magang?"
          message={`Akun ${deleting.name} dan data terkait akan dihapus permanen.`}
          confirmLabel="Ya, hapus"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      )}
    </div>
  );
}

function LeaveRequests({ user, flash }) {
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id,type,date_from,date_to,reason,status,rejection_reason,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) flash(error.message, "error");
    else setRequests(data || []);
  };
  useEffect(() => {
    load();
    if (!supabase) return;
    const channel = supabase
      .channel(`leave-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
          filter: `user_id=eq.${user.id}`,
        },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user.id]);
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase)
      return flash("Fitur pengajuan memerlukan Supabase.", "error");
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      type: form.get("type"),
      date_from: form.get("date_from"),
      date_to: form.get("date_to"),
      reason: form.get("reason"),
    });
    setSaving(false);
    if (error) return flash(error.message, "error");
    event.currentTarget.reset();
    flash("Pengajuan berhasil dikirim.");
    load();
  };
  return (
    <div className="workflow-grid">
      <form className="panel settings" onSubmit={submit}>
        <h2>Ajukan izin atau sakit</h2>
        <label>
          Jenis
          <select name="type">
            <option>Izin</option>
            <option>Sakit</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Mulai
            <input type="date" name="date_from" required />
          </label>
          <label>
            Selesai
            <input type="date" name="date_to" required />
          </label>
        </div>
        <label>
          Alasan
          <textarea name="reason" rows="4" minLength="5" required />
        </label>
        <button className="primary" disabled={saving}>
          {saving ? "Mengirim..." : "Kirim pengajuan"}
        </button>
      </form>
      <div className="panel">
        <h2>Riwayat pengajuan</h2>
        {requests.length ? (
          requests.map((item) => (
            <div className="workflow-item" key={item.id}>
              <div>
                <b>{item.type}</b>
                <p>
                  {formatDate(item.date_from)} – {formatDate(item.date_to)}
                </p>
                <small>{item.reason}</small>
                {item.status === "Ditolak" && item.rejection_reason && (
                  <small className="rejection-reason">Alasan penolakan: {item.rejection_reason}</small>
                )}
              </div>
              <span
                className={`badge ${item.status === "Disetujui" ? "green" : item.status === "Ditolak" ? "red" : "orange"}`}
              >
                {item.status}
              </span>
            </div>
          ))
        ) : (
          <p className="empty-state">Belum ada pengajuan.</p>
        )}
      </div>
    </div>
  );
}

function AdminWorkflows({ rows, refresh, flash }) {
  const [requests, setRequests] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [historyStatus, setHistoryStatus] = useState("Semua");
  const [historyType, setHistoryType] = useState("Semua");
  const [historyMonth, setHistoryMonth] = useState("");
  const load = async () => {
    if (!supabase) return;
    const { data: leaveData, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) flash(error.message, "error");
    setRequests(leaveData || []);
  };
  useEffect(() => {
    load();
  }, []);
  const review = async (id, decision, rejectionNote = null) => {
    const { error } = await supabase.rpc("review_leave_request", {
      request_id: id,
      decision,
      rejection_note: rejectionNote,
    });
    if (error) return flash(error.message, "error");
    flash(`Pengajuan ${decision.toLowerCase()}.`);
    load();
  };
  const correct = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("correct_attendance", {
      target_user_id: form.get("user_id"),
      target_date: form.get("date"),
      new_check_in: form.get("check_in") || null,
      new_check_out: form.get("check_out") || null,
      new_status: form.get("status"),
      correction_reason: form.get("reason"),
    });
    if (error) return flash(error.message, "error");
    flash("Koreksi absensi berhasil disimpan.");
    event.currentTarget.reset();
    refresh();
    load();
  };
  const remind = async () => {
    const { data, error } = await supabase.rpc("generate_absence_reminders");
    if (error) return flash(error.message, "error");
    flash(`${data} pengingat belum absen dikirim.`);
    load();
  };
  const nameOf = (id) =>
    rows.find((row) => row.id === id)?.name || "Anak magang";
  const historyRequests = requests.filter((item) => {
    const matchesStatus =
      historyStatus === "Semua" || item.status === historyStatus;
    const matchesType = historyType === "Semua" || item.type === historyType;
    const matchesMonth = !historyMonth || item.date_from.startsWith(historyMonth);
    return matchesStatus && matchesType && matchesMonth;
  });
  return (
    <div className="admin-workflows">
      <div className="panel">
        <div className="section-head">
          <div>
            <h2>Persetujuan izin/sakit</h2>
            <p>Periksa pengajuan anak magang.</p>
          </div>
          <button className="outline" onClick={remind}>
            <Bell size={16} /> Kirim pengingat
          </button>
        </div>
        {requests.length ? (
          requests.map((item) => (
            <div className="workflow-item" key={item.id}>
              <div>
                <b>
                  {nameOf(item.user_id)} · {item.type}
                </b>
                <p>
                  {formatDate(item.date_from)} – {formatDate(item.date_to)}
                </p>
                <small>{item.reason}</small>
              </div>
              {item.status === "Menunggu" ? (
                <div className="workflow-actions">
                  <button
                    className="outline"
                    onClick={() => setRejecting(item)}
                  >
                    Tolak
                  </button>
                  <button
                    className="primary"
                    onClick={() => review(item.id, "Disetujui")}
                  >
                    Setujui
                  </button>
                </div>
              ) : (
                <span
                  className={`badge ${item.status === "Disetujui" ? "green" : "red"}`}
                >
                  {item.status}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="empty-state">Belum ada pengajuan.</p>
        )}
      </div>
      <form className="panel settings" onSubmit={correct}>
        <h2>Koreksi absensi</h2>
        <label>
          Anak magang
          <select name="user_id" required>
            <option value="">Pilih akun</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tanggal
          <input type="date" name="date" required />
        </label>
        <div className="form-grid">
          <label>
            Jam masuk
            <input type="time" name="check_in" />
          </label>
          <label>
            Jam pulang
            <input type="time" name="check_out" />
          </label>
        </div>
        <label>
          Status
          <select name="status">
            <option>Hadir</option>
            <option>Terlambat</option>
            <option>Izin</option>
            <option>Sakit</option>
            <option>Alpa</option>
          </select>
        </label>
        <label>
          Alasan koreksi
          <textarea name="reason" minLength="5" required />
        </label>
        <button className="primary">Simpan koreksi</button>
      </form>
      <div className="panel audit-panel">
        <div className="section-head">
          <div>
            <h2>Riwayat pengajuan</h2>
            <p>Semua pengajuan izin dan sakit yang telah dikirim.</p>
          </div>
        </div>
        <div className="history-filters">
          <input
            type="month"
            value={historyMonth}
            onChange={(event) => setHistoryMonth(event.target.value)}
            aria-label="Filter bulan pengajuan"
          />
          <select value={historyType} onChange={(event) => setHistoryType(event.target.value)}>
            <option>Semua</option><option>Izin</option><option>Sakit</option>
          </select>
          <select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}>
            <option>Semua</option><option>Menunggu</option><option>Disetujui</option><option>Ditolak</option>
          </select>
        </div>
        {historyRequests.length ? (
          historyRequests.map((item) => (
            <div className="workflow-item" key={item.id}>
              <div>
                <b>{nameOf(item.user_id)} · {item.type}</b>
                <p>{formatDate(item.date_from)} – {formatDate(item.date_to)}</p>
                <small>{item.reason}</small>
                {item.status === "Ditolak" && item.rejection_reason && <small className="rejection-reason">Alasan penolakan: {item.rejection_reason}</small>}
              </div>
              <span className={`badge ${item.status === "Disetujui" ? "green" : item.status === "Ditolak" ? "red" : "orange"}`}>
                {item.status}
              </span>
            </div>
          ))
        ) : (
          <p className="empty-state">Tidak ada pengajuan sesuai filter.</p>
        )}
      </div>
      {rejecting && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={async (event) => {
            event.preventDefault();
            const note = new FormData(event.currentTarget).get("rejection_reason");
            await review(rejecting.id, "Ditolak", note);
            setRejecting(null);
          }}>
            <button type="button" className="modal-close" onClick={() => setRejecting(null)}><X size={18} /></button>
            <h2>Tolak pengajuan</h2>
            <p>Tulis alasan penolakan agar dapat dilihat oleh {nameOf(rejecting.user_id)}.</p>
            <label>Alasan penolakan<textarea name="rejection_reason" minLength="5" rows="4" required autoFocus /></label>
            <button className="primary full">Kirim penolakan</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Reports({ flash, rows }) {
  const [mode, setMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendance, setAttendance] = useState([]);
  const [sickRequests, setSickRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const period = mode === "month" ? selectedMonth : selectedDate;
  const range = useMemo(() => {
    if (mode === "date") return { from: selectedDate, to: selectedDate };
    const [year, month] = selectedMonth.split("-").map(Number);
    const last = new Date(year, month, 0).getDate();
    return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${String(last).padStart(2, "0")}` };
  }, [mode, selectedMonth, selectedDate]);
  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: attendanceData, error }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.from("attendance").select("user_id,date,check_in,check_out,status").gte("date", range.from).lte("date", range.to).order("date"),
      supabase.from("leave_requests").select("user_id,type,date_from,date_to,reason,status").eq("type", "Sakit").eq("status", "Disetujui").lte("date_from", range.to).gte("date_to", range.from),
    ]);
    if (error || requestError) flash((error || requestError).message, "error");
    else { setAttendance(attendanceData || []); setSickRequests(requestData || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [range.from, range.to]);
  const nameOf = (id) => rows.find((x) => x.id === id);
  const reportRows = attendance.map((item) => {
    const person = nameOf(item.user_id);
    return { ...item, name: person?.name || "Anak magang", university: person?.university || "-", major: person?.major || "-", in: item.check_in ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(item.check_in)) : "-", out: item.check_out ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(item.check_out)) : "-" };
  });
  const summary = rows.map((person) => {
    const own = attendance.filter((item) => item.user_id === person.id);
    return { name: person.name, hadir: own.filter((x) => x.status === "Hadir").length, terlambat: own.filter((x) => x.status === "Terlambat").length, sakit: own.filter((x) => x.status === "Sakit").length, alpa: own.filter((x) => x.status === "Alpa").length };
  });
  const approvedSick = sickRequests.map((item) => ({ ...item, name: nameOf(item.user_id)?.name || "Anak magang" }));
  const hadir = summary.reduce((total, item) => total + item.hadir, 0);
  const terlambat = summary.reduce((total, item) => total + item.terlambat, 0);
  const sakit = summary.reduce((total, item) => total + item.sakit, 0);
  const alpa = summary.reduce((total, item) => total + item.alpa, 0);
  const payload = { rows: reportRows, summary, requests: approvedSick, label: mode === "month" ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T00:00:00`)) : formatDate(selectedDate), fileKey: period };
  const excel = async () => {
    await exportAttendanceExcel(payload);
    flash("File Excel berhasil diunduh.");
  };
  const pdf = async () => {
    await exportAttendancePdf(payload);
    flash("File PDF berhasil diunduh.");
  };
  return (
    <>
      <div className="panel report-filter">
        <div>
          <h2>Rekap Laporan</h2>
          <p>Pilih tanggal atau bulan untuk melihat dan mengunduh rekap.</p>
        </div>
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="date">Tanggal</option>
          <option value="month">Bulanan</option>
        </select>
        <input type={mode === "month" ? "month" : "date"} value={mode === "month" ? selectedMonth : selectedDate} onChange={(event) => mode === "month" ? setSelectedMonth(event.target.value) : setSelectedDate(event.target.value)} />
        <button className="primary" onClick={load} disabled={loading}>{loading ? "Memuat..." : "Tampilkan"}</button>
      </div>
      <section className="stat-grid report-stats">
        {[
          [String(hadir), "Hadir"],
          [String(terlambat), "Terlambat"],
          [String(sakit), "Sakit"],
          [String(alpa), "Alpa"],
        ].map((x) => (
          <div className="stat-card simple" key={x[1]}>
            <b>{x[0]}</b>
            <small>{x[1]}</small>
          </div>
        ))}
      </section>
      <div className="panel export">
        <FileText size={28} />
        <div>
          <h3>Unduh laporan absensi</h3>
          <p>Ekspor {payload.label}, termasuk rekap per peserta dan sakit yang disetujui.</p>
        </div>
        <button className="outline" onClick={excel}>
          <Download size={16} /> Export Excel
        </button>
        <button className="primary" onClick={pdf}>
          <Download size={16} /> Export PDF
        </button>
      </div>
    </>
  );
}
function SettingsPage() {
  const [settings, setSettings] = useState({
      work_start_time: getWorkStartTime(),
      late_tolerance_minutes: 0,
      work_days: [1, 2, 3, 4, 5],
      qr_enabled: true,
    }),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("system_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setSettings({
            ...data,
            work_start_time: String(data.work_start_time).slice(0, 5),
          });
      });
  }, []);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      id: 1,
      ...settings,
      work_start_time: settings.work_start_time + ":00",
    };
    const { error } = supabase
      ? await supabase
          .from("system_settings")
          .upsert(payload, { onConflict: "id" })
      : { error: null };
    setSaving(false);
    if (error) {
      showAppMessage(error.message, "error");
      return;
    }
    localStorage.setItem(workStartKey, settings.work_start_time);
    showAppMessage("Pengaturan absensi berhasil disimpan.");
  };
  const toggleDay = (day) =>
    setSettings((s) => ({
      ...s,
      work_days: s.work_days.includes(day)
        ? s.work_days.filter((x) => x !== day)
        : [...s.work_days, day].sort(),
    }));
  return (
    <>
      <form className="panel settings advanced-settings" onSubmit={save}>
        <h2>Pengaturan Absensi</h2>
        <p>Mengubah pengaturan tidak mengubah QR yang sudah dicetak.</p>
        <label>
          Jam masuk normal
          <input
            type="time"
            value={settings.work_start_time}
            onChange={(e) =>
              setSettings((s) => ({ ...s, work_start_time: e.target.value }))
            }
            required
          />
        </label>
        <label>
          Toleransi keterlambatan (menit)
          <input
            type="number"
            min="0"
            max="120"
            value={settings.late_tolerance_minutes}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                late_tolerance_minutes: Number(e.target.value),
              }))
            }
          />
        </label>
        <fieldset>
          <legend>Hari kerja</legend>
          {[
            ["Sen", 1],
            ["Sel", 2],
            ["Rab", 3],
            ["Kam", 4],
            ["Jum", 5],
            ["Sab", 6],
            ["Min", 7],
          ].map(([label, day]) => (
            <label className="day-check" key={day}>
              <input
                type="checkbox"
                checked={settings.work_days.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="switch-row">
          <span>QR absensi aktif</span>
          <input
            type="checkbox"
            checked={settings.qr_enabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, qr_enabled: e.target.checked }))
            }
          />
        </label>
        <button className="primary" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
      </form>
      <AccountSettings />
    </>
  );
}
function AccountSettings() {
  const [profile, setProfile] = useState(null),
    [saving, setSaving] = useState(false),
    [photoName, setPhotoName] = useState("");
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("name,email,photo_url")
        .eq("id", user.id)
        .single();
      const photoPath = getPhotoPath(data?.photo_url || "");
      setProfile({
        ...data,
        photo_path: photoPath,
        photo_url: await getSignedPhotoUrl(photoPath),
      });
    });
  }, []);
  const save = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      file = form.get("photo");
    setSaving(true);
    let photoPath = profile.photo_path || getPhotoPath(profile.photo_url || ""),
      photoUrl = profile.photo_url || "";
    if (file instanceof File && file.size) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        showAppMessage("Gunakan gambar maksimal 5 MB.", "error");
        setSaving(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const path = `${user.id}/profile`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        showAppMessage(uploadError.message, "error");
        setSaving(false);
        return;
      }
      photoPath = path;
      photoUrl = await getSignedPhotoUrl(path);
    }
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      photo_url: photoPath,
    };
    const { error } = await supabase.functions.invoke("update-own-profile", {
      body,
    });
    setSaving(false);
    if (error) {
      showAppMessage(error.message || "Profil tidak dapat diperbarui", "error");
      return;
    }
    setProfile((p) => ({
      ...p,
      name: body.name,
      email: body.email,
      photo_path: photoPath,
      photo_url: photoUrl,
    }));
    showAppMessage("Profil berhasil diperbarui.");
  };
  if (!profile) return null;
  return (
    <form className="panel settings account-settings" onSubmit={save}>
      <h2>Profil Admin</h2>
      <p>Ubah nama, email, kata sandi, dan foto profil.</p>
      <label>
        Nama lengkap
        <input name="name" defaultValue={profile.name} required />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          defaultValue={profile.email}
          required
        />
      </label>
      <label className="photo-picker">
        Foto profil
        <input
          name="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")}
        />
        <span>{photoName || "Pilih atau tarik file gambar ke sini"}</span>
        <small>JPG, PNG, atau WebP — maksimal 5 MB.</small>
      </label>
      <label>
        Kata sandi baru <small>(kosongkan jika tidak diubah)</small>
        <input name="password" type="password" minLength="6" />
      </label>
      <button className="primary" disabled={saving}>
        {saving ? "Menyimpan..." : "Simpan profil"}
      </button>
    </form>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div
          style={{ padding: "32px", fontFamily: "system-ui", color: "#172b4d" }}
        >
          <h2>Aplikasi tidak dapat dimuat</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => location.reload()}>Muat ulang</button>
        </div>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
