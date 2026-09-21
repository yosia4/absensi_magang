import { useCallback, useEffect, useRef, useState } from "react";

// One shared count for the sidebar, mobile menu and dashboard.
export default function usePendingRequests(client, userId) {
  const [state, setState] = useState({
    userId: null,
    count: null,
    error: "",
    updatedAt: 0,
  });
  const sequence = useRef(0);
  const controller = useRef(null);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    controller.current?.abort();
    if (!client || !userId) return;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { count, error } = await client
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "Menunggu")
        .abortSignal(abort.signal);
      if (error) throw error;
      if (request === sequence.current && !abort.signal.aborted) {
        setState({
          userId,
          count: count ?? 0,
          error: "",
          updatedAt: Date.now(),
        });
      }
    } catch {
      if (request === sequence.current && !abort.signal.aborted) {
        setState((current) => ({
          userId,
          count: current.userId === userId ? current.count : null,
          error: "Jumlah pengajuan belum dapat diperbarui.",
          updatedAt: current.userId === userId ? current.updatedAt : 0,
        }));
      }
    }
  }, [client, userId]);
  useEffect(() => {
    if (!client || !userId) return;
    refresh();
    const channel = client
      .channel("admin-pending-requests-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(onVisible, 30000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sequence.current++;
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      client.removeChannel(channel);
    };
  }, [client, userId, refresh]);
  const current =
    !client || !userId
      ? { count: 0, error: "", updatedAt: 0 }
      : state.userId === userId
        ? state
        : { count: null, error: "", updatedAt: 0 };
  return {
    ...current,
    loading: current.count === null && !current.error,
    refresh,
  };
}
