"use client";

import { useEffect } from "react";
import { syncTimezone } from "./actions";

/** Keeps the Learner's stored timezone in step with their device. Renders nothing. */
export function TimezoneSync({ current }: { current: string }) {
  useEffect(() => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device && device !== current) void syncTimezone(device);
  }, [current]);
  return null;
}
