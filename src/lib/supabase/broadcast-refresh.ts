import type { MutableRefObject } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface BroadcastRefreshOptions {
  channelName: string;
  refresh: () => void;
  skipRefreshUntilRef?: MutableRefObject<number>;
  fallbackPollMs?: number;
  debounceMs?: number;
  realtimeGuardMs?: number;
  isTouchDevice?: boolean;
  mobileSafetyPollMs?: number;
  includeForegroundRefresh?: boolean;
}

export function attachBroadcastRefresh({
  channelName,
  refresh,
  skipRefreshUntilRef,
  fallbackPollMs = 30_000,
  debounceMs = 150,
  realtimeGuardMs = 3_000,
  isTouchDevice = false,
  mobileSafetyPollMs,
  includeForegroundRefresh = false
}: BroadcastRefreshOptions): () => void {
  const supabase = getSupabaseBrowserClient();
  let fallbackPoll: number | undefined;
  let debounce: number | undefined;
  let realtimeReady = false;

  const startFallbackPoll = () => {
    fallbackPoll ??= window.setInterval(refresh, fallbackPollMs);
  };

  const scheduleRefresh = () => {
    if (skipRefreshUntilRef && Date.now() < skipRefreshUntilRef.current) {
      skipRefreshUntilRef.current = 0;
      return;
    }
    if (debounce) window.clearTimeout(debounce);
    debounce = window.setTimeout(refresh, debounceMs);
  };

  const channel = supabase
    ?.channel(channelName)
    .on("broadcast", { event: "*" }, scheduleRefresh)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        realtimeReady = true;
        if (fallbackPoll) window.clearInterval(fallbackPoll);
        fallbackPoll = undefined;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        startFallbackPoll();
      }
    });

  const realtimeGuard = window.setTimeout(() => {
    if (!supabase || !realtimeReady) {
      startFallbackPoll();
    }
  }, realtimeGuardMs);

  const mobileSafetyPoll =
    isTouchDevice && mobileSafetyPollMs
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") refresh();
        }, mobileSafetyPollMs)
      : undefined;

  const handleForeground = () => {
    if (document.visibilityState === "visible") refresh();
  };

  if (includeForegroundRefresh) {
    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);
  }

  return () => {
    window.clearTimeout(realtimeGuard);
    if (debounce) window.clearTimeout(debounce);
    if (fallbackPoll) window.clearInterval(fallbackPoll);
    if (mobileSafetyPoll) window.clearInterval(mobileSafetyPoll);
    if (includeForegroundRefresh) {
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    }
    channel?.unsubscribe();
  };
}
