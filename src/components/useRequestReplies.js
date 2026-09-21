import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllPages } from "../attendanceSummary";

const EMPTY_IDS = [];
const REPLY_TITLES = ["Pengajuan disetujui", "Pengajuan ditolak"];

export default function useRequestReplies(client, userId) {
  const [state, setState] = useState({ userId: null, ids: EMPTY_IDS });
  const sequence = useRef(0);
  const controller = useRef(null);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    controller.current?.abort();
    if (!client || !userId) return;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const rows = await fetchAllPages(
        () =>
          client
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .in("title", REPLY_TITLES)
            .is("read_at", null)
            .order("id"),
        abort.signal,
      );
      if (request !== sequence.current || abort.signal.aborted) return;
      const ids = rows.map((row) => row.id);
      setState((current) =>
        current.userId === userId && current.ids.join(",") === ids.join(",")
          ? current
          : { userId, ids },
      );
    } catch {
      // Keep the last confirmed badge when offline; retry on focus or the timer.
    }
  }, [client, userId]);

  const markRead = useCallback(
    async (ids) => {
      if (!client || !userId || !ids.length) return;
      try {
        // Only acknowledge the snapshot loaded before the request history.
        for (let offset = 0; offset < ids.length; offset += 100) {
          const { error } = await client
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", userId)
            .in("title", REPLY_TITLES)
            .is("read_at", null)
            .in("id", ids.slice(offset, offset + 100));
          if (error) throw error;
        }
        await refresh();
      } catch {
        // A failed acknowledgement must not clear the badge locally.
      }
    },
    [client, userId, refresh],
  );

  useEffect(() => {
    if (!client || !userId) return;
    refresh();
    const channel = client
      .channel("intern-request-replies-" + userId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + userId,
        },
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

  const ids =
    client && userId && state.userId === userId ? state.ids : EMPTY_IDS;
  return { ids, count: ids.length, refresh, markRead };
}
