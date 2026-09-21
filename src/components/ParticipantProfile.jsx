import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  Mail,
  Pencil,
  UserRound,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { dateLabel, jakartaToday } from "../attendanceVisuals";
import { internshipPeriod } from "../internshipPeriod";
import "./ParticipantProfile.css";

export default function ParticipantProfile({ profile, onEdit, onViewPhoto }) {
  const [today, setToday] = useState(jakartaToday);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [profile.photo_url]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setToday(jakartaToday());
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const period = internshipPeriod(
    profile.internship_start,
    profile.internship_end,
    today,
  );
  const active = profile.is_active === true;
  const AccountIcon = active ? UserRoundCheck : UserRoundX;
  const upcoming = period.phase === "upcoming";
  const complete = period.phase === "complete";
  const SummaryIcon = complete ? CheckCircle2 : Clock3;
  const initials =
    profile.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  const formatDate = (value) => {
    if (!value) return "Belum diisi";
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
      ? "Perlu diperiksa"
      : dateLabel(value);
  };
  return (
    <section
      className="panel participant-profile"
      aria-labelledby="participant-profile-name"
    >
      <div className="participant-profile-heading">
        <span className="participant-eyebrow">PROFIL PESERTA</span>
        <button
          type="button"
          className="outline participant-edit"
          onClick={onEdit}
        >
          <Pencil size={16} aria-hidden="true" />
          Edit profil
        </button>
      </div>
      <div className="participant-identity">
        {profile.photo_url && !photoFailed ? (
          <button
            type="button"
            className="participant-photo"
            onClick={onViewPhoto}
            aria-label="Lihat foto profil ukuran besar"
          >
            <img
              src={profile.photo_url}
              alt={`Foto ${profile.name}`}
              onError={() => setPhotoFailed(true)}
            />
          </button>
        ) : (
          <span
            className="participant-initials"
            aria-label={`Inisial ${profile.name}`}
          >
            {initials}
          </span>
        )}
        <div className="participant-name">
          <h2 id="participant-profile-name">
            {profile.name || "Peserta magang"}
          </h2>
          <p>
            <GraduationCap size={19} aria-hidden="true" />
            <span>{profile.university || "Universitas belum diisi"}</span>
          </p>
          <span
            className={`participant-account ${active ? "is-active" : "is-inactive"}`}
          >
            <AccountIcon size={15} aria-hidden="true" />
            {active
              ? "Akun aktif"
              : profile.is_active === false
                ? "Akun nonaktif"
                : "Status akun belum tersedia"}
          </span>
        </div>
      </div>
      <div className="participant-period">
        <div className="participant-period-info">
          <div className="participant-section-heading">
            <h3>Masa magang</h3>
            <span>{period.label}</span>
          </div>
          <dl className="participant-dates">
            <div>
              <dt>
                <CalendarDays size={16} aria-hidden="true" />
                Tanggal mulai
              </dt>
              <dd>{formatDate(profile.internship_start)}</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={16} aria-hidden="true" />
                Tanggal selesai
              </dt>
              <dd>{formatDate(profile.internship_end)}</dd>
            </div>
          </dl>
          {period.progress !== null && (
            <div className="participant-progress">
              <div>
                <span>
                  {complete
                    ? "Periode magang telah berakhir"
                    : upcoming
                      ? "Menunggu hari pertama"
                      : `Hari ke-${period.day} dari ${period.total} hari`}
                </span>
                <b>{period.progress}%</b>
              </div>
              <progress
                max={100}
                value={period.progress}
                aria-label="Perjalanan masa magang"
              />
            </div>
          )}
        </div>
        <div
          className={`participant-countdown ${complete ? "is-complete" : ""}`}
        >
          <SummaryIcon size={23} aria-hidden="true" />
          <span>{upcoming ? "Menuju hari pertama" : "Sisa masa magang"}</span>
          <div>
            <b>{upcoming ? period.untilStart : (period.remaining ?? "—")}</b>
            {(upcoming || period.remaining !== null) && <span> hari</span>}
          </div>
          <p>
            {complete
              ? "Terima kasih atas perjalanan magang Anda."
              : upcoming
                ? "Hitungan hari kalender sampai tanggal mulai."
                : period.remaining !== null
                  ? "Hari kalender, termasuk hari ini. Dihitung dalam WIB."
                  : "Hitungan tersedia setelah periode magang dilengkapi dengan benar."}
          </p>
        </div>
      </div>
      <details className="participant-account-details">
        <summary>
          <span>
            <UserRound size={17} aria-hidden="true" />
            Detail akun
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <dl>
          <div>
            <dt>
              <Mail size={16} aria-hidden="true" />
              Email
            </dt>
            <dd>{profile.email || "Belum diisi"}</dd>
          </div>
          <div>
            <dt>
              <GraduationCap size={16} aria-hidden="true" />
              Jurusan
            </dt>
            <dd>{profile.major || "Belum diisi"}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
