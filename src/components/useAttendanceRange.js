import { useEffect, useRef, useState } from "react";
import { fetchAttendanceRange } from "../attendanceVisuals";

const EMPTY = [];

export default function useAttendanceRange(
  client,
  { from, to, userId, demoData = EMPTY },
) {
  const [state, setState] = useState({
    rows: [],
    loading: !!client,
    error: "",
    key: "",
  });
  const [revision, setRevision] = useState(0);
  const instance = useRef(Math.random().toString(36).slice(2));
  const key = `${userId || "all"}:${from}:${to}`;
  useEffect(() => {
    if (!client) return;
    let disposed = false;
    let controller;
    let request = 0;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const current = ++request;
      setState({ rows: [], loading: true, error: "", key });
      try {
        const rows = await fetchAttendanceRange(client, {
          from,
          to,
          userId,
          signal: controller.signal,
        });
        if (!disposed && current === request)
          setState({ rows, loading: false, error: "", key });
      } catch {
        if (!disposed && current === request)
          setState({
            rows: [],
            loading: false,
            error:
              "Data absensi belum dapat dimuat. Periksa koneksi, lalu coba lagi.",
            key,
          });
      }
    };
    load();
    const channel = client
      .channel(`attendance-visual-${instance.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
        },
        load,
      )
      .subscribe();
    return () => {
      disposed = true;
      controller?.abort();
      client.removeChannel(channel);
    };
  }, [client, from, to, userId, key, revision]);

  if (!client)
    return {
      rows: demoData.filter((row) => row.date >= from && row.date <= to),
      loading: false,
      error: "",
      retry: () => {},
    };
  return {
    ...(state.key === key ? state : { rows: [], loading: true, error: "" }),
    retry: () => setRevision((value) => value + 1),
  };
}
