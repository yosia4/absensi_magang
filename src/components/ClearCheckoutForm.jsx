import React, { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { attendanceTime, dateLabel, jakartaToday } from "../attendanceVisuals";
import "./ClearCheckoutForm.css";

export default function ClearCheckoutForm({
  client,
  rows,
  flash,
  onSaved,
  onBusyChange,
}) {
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(jakartaToday);
  const [record, setRecord] = useState(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const key = `${userId}:${date}`;
  const ready = loadedKey === key && !loading && !loadError;
  const canClear = Boolean(
    client &&
    ready &&
    record?.check_in &&
    record?.check_out &&
    reason.trim().length >= 5 &&
    !saving,
  );
  const name = rows.find((row) => row.id === userId)?.name || "Peserta";

  useEffect(() => {
    setConfirming(false);
    setRecord(null);
    setLoadedKey("");
    setLoadError("");
    if (!client || !userId || !date) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await client
          .from("attendance")
          .select("id,date,check_in,check_out,status")
          .eq("user_id", userId)
          .eq("date", date)
          .maybeSingle()
          .abortSignal(controller.signal);
        if (error) throw error;
        if (disposed) return;
        setRecord(data);
        setLoadedKey(key);
      } catch {
        if (!disposed)
          setLoadError(
            "Data absensi belum dapat dimuat. Coba lagi sebelum menghapus jam pulang.",
          );
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [client, userId, date, key, revision]);

  async function clearCheckout() {
    if (!canClear || busy.current) return;
    busy.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      const { data, error } = await client.rpc("clear_attendance_checkout", {
        target_user_id: userId,
        target_date: date,
        expected_check_out: record.check_out,
        correction_reason: reason.trim(),
      });
      if (error) throw error;
      setRecord(data);
      setReason("");
      setConfirming(false);
      flash(
        "Absen pulang berhasil dihapus. Jam masuk dan status tetap tersimpan.",
      );
      onSaved(date);
    } catch (error) {
      flash(
        error.code === "PGRST202"
          ? "Fitur hapus absen pulang belum aktif di database. Hubungi pengelola aplikasi."
          : error.message ||
              "Absen pulang belum dapat dihapus. Silakan coba lagi.",
        "error",
      );
      setConfirming(false);
      setRevision((value) => value + 1);
    } finally {
      busy.current = false;
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  return (
    <>
      <form
        className="checkout-correction"
        onSubmit={(event) => {
          event.preventDefault();
          if (canClear) setConfirming(true);
        }}
      >
        <p>
          Untuk peserta yang tidak sengaja scan dua kali. Jam masuk dan status
          kehadiran tetap disimpan; jam pulang dikosongkan agar peserta dapat
          scan pulang kembali.
        </p>
        {!client && (
          <p role="status">
            Koreksi ini tersedia setelah terhubung ke Supabase.
          </p>
        )}
        <label>
          Anak magang
          <select
            name="checkout_user_id"
            value={userId}
            required
            disabled={saving || !client}
            onChange={(event) => {
              setUserId(event.target.value);
              setReason("");
            }}
          >
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
          <input
            type="date"
            name="checkout_date"
            value={date}
            required
            disabled={saving || !client}
            onChange={(event) => {
              setDate(event.target.value);
              setReason("");
            }}
          />
        </label>
        {loading && <p role="status">Memuat absensi...</p>}
        {loadError && (
          <div role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              Coba lagi
            </button>
          </div>
        )}
        {ready &&
          (record ? (
            <div className="checkout-correction-preview" aria-live="polite">
              <h3>Absensi {name}</h3>
              <p>{dateLabel(date)} · WIB</p>
              <dl>
                <div>
                  <dt>Jam masuk (tetap)</dt>
                  <dd>{attendanceTime(record.check_in)}</dd>
                </div>
                <div>
                  <dt>Jam pulang yang akan dihapus</dt>
                  <dd>{attendanceTime(record.check_out)}</dd>
                </div>
                <div>
                  <dt>Status (tetap)</dt>
                  <dd>{record.status}</dd>
                </div>
              </dl>
              {!record.check_out ? (
                <p>Jam pulang belum tercatat. Tidak ada yang perlu dihapus.</p>
              ) : (
                !record.check_in && (
                  <p>
                    Jam masuk belum tercatat. Gunakan koreksi jam/status untuk
                    meninjau absensi ini.
                  </p>
                )
              )}
            </div>
          ) : (
            <p role="status">Belum ada absensi pada tanggal ini.</p>
          ))}
        <label>
          Alasan koreksi
          <textarea
            name="checkout_reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            required
            disabled={saving || !client}
            placeholder="Contoh: Peserta tidak sengaja scan dua kali saat masuk."
          />
        </label>
        <button className="primary" disabled={!canClear}>
          <Trash2 size={16} />
          {saving ? "Menghapus..." : "Hapus absen pulang"}
        </button>
      </form>
      {confirming && (
        <ConfirmDialog
          icon={<Trash2 size={23} />}
          title="Hapus absen pulang?"
          message={`Hapus jam pulang ${attendanceTime(record.check_out)} WIB milik ${name} pada ${dateLabel(date)}? Jam masuk ${attendanceTime(record.check_in)} WIB dan status ${record.status} tetap tersimpan.`}
          confirmLabel={saving ? "Menghapus..." : "Ya, hapus jam pulang"}
          danger
          confirmDisabled={saving || !canClear}
          onCancel={() => {
            if (!busy.current) setConfirming(false);
          }}
          onConfirm={clearCheckout}
        />
      )}
    </>
  );
}
